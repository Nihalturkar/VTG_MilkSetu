import { RequestHandler } from 'express';
import { z } from 'zod';
import { AppImage } from '../models/AppImage';
import { ART_KEYS, IMAGE_MAX_BYTES, IMAGE_TYPES } from '../utils/domain';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, notFound } from '../middleware/errors';

export const imageKeySchema = z.object({ key: z.enum(ART_KEYS) });

/** Magic-byte signatures. An extension or client-sent type proves nothing. */
const SNIFFERS: Array<{ type: string; test: (b: Buffer) => boolean }> = [
  { type: 'image/jpeg', test: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    test: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  },
  {
    type: 'image/webp',
    test: b =>
      b.length > 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

const sniff = (buf: Buffer): string | null => SNIFFERS.find(s => s.test(buf))?.type ?? null;

/**
 * Which slots have an override and at what version. The app calls this once
 * on launch and only downloads the slots whose version it has not cached.
 */
export const listImages: RequestHandler = asyncHandler(async (_req, res) => {
  const rows = await AppImage.find({}, { key: 1, version: 1, bytes: 1, contentType: 1, updatedAt: 1 })
    .lean();

  res.json({
    ok: true,
    data: {
      images: rows.map(r => ({
        key: r.key,
        version: r.version,
        bytes: r.bytes,
        contentType: r.contentType,
        updatedAt: r.updatedAt,
      })),
    },
  });
});

/** Serve one image. Public: the app fetches these before it has any session. */
export const getImage: RequestHandler = asyncHandler(async (req, res) => {
  const { key } = req.params as z.infer<typeof imageKeySchema>;
  const row = await AppImage.findOne({ key }).lean();
  if (!row) throw notFound('No image set for this slot');

  // Content is immutable per version, so let clients cache hard and bust on
  // the ?v= the listing hands them.
  const etag = `"${key}-${row.version}"`;
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  // .lean() hands back BSON Binary, not a Node Buffer. Passing that to
  // res.send() would serialize it as base64 JSON -- a third larger and
  // undecodable as an image -- so normalise it first.
  const raw = row.data as unknown as Buffer | { buffer: Buffer };
  const body = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer);

  res.set({
    'Content-Type': row.contentType,
    'Content-Length': String(body.length),
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: etag,
  });
  res.end(body);
});

/**
 * Replace a slot's image (admin only). The body is the raw image, not JSON:
 * base64 in JSON would inflate it by a third and collide with the API's small
 * body limit.
 */
export const putImage: RequestHandler = asyncHandler(async (req, res) => {
  const { key } = req.params as z.infer<typeof imageKeySchema>;
  const buf = req.body as Buffer;

  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw badRequest('Request body must be the image file', 'empty_body');
  }
  if (buf.length > IMAGE_MAX_BYTES) {
    throw badRequest(
      `Image must be ${Math.floor(IMAGE_MAX_BYTES / 1024 / 1024)}MB or smaller`,
      'too_large',
    );
  }

  // Trust the bytes, not the header: a mislabelled upload would be served
  // back to the app with a Content-Type it cannot decode.
  const contentType = sniff(buf);
  if (!contentType || !IMAGE_TYPES.includes(contentType as (typeof IMAGE_TYPES)[number])) {
    throw badRequest('File must be a JPEG, PNG or WebP image', 'bad_type');
  }

  const existing = await AppImage.findOne({ key });
  const version = (existing?.version ?? 0) + 1;

  const row = await AppImage.findOneAndUpdate(
    { key },
    {
      key,
      data: buf,
      contentType,
      bytes: buf.length,
      version,
      updatedBy: req.adminId,
    },
    { upsert: true, new: true },
  );

  res.json({
    ok: true,
    data: { key, version: row!.version, bytes: row!.bytes, contentType: row!.contentType },
  });
});

/** Drop an override so the app falls back to its bundled artwork. */
export const deleteImage: RequestHandler = asyncHandler(async (req, res) => {
  const { key } = req.params as z.infer<typeof imageKeySchema>;
  const row = await AppImage.findOneAndDelete({ key });
  if (!row) throw notFound('No image set for this slot');
  res.json({ ok: true, data: { key, removed: true } });
});
