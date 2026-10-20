import { RequestHandler } from 'express';
import { z } from 'zod';
import { MilkEntry } from '../models/MilkEntry';
import { MILK_TYPES, SHIFTS, FAT_MIN, FAT_MAX, QTY_MAX, round2 } from '../utils/domain';
import { calculateAmount } from '../utils/calculateAmount';
import { parseEntryDate, formatEntryDate, todayIST } from '../utils/dates';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest } from '../middleware/errors';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');

export const createMilkSchema = z.object({
  entryDate: ymd.optional(),
  shift: z.enum(SHIFTS),
  milkType: z.enum(MILK_TYPES),
  quantityLitres: z.coerce.number().positive('मात्रा 0 से अधिक होनी चाहिए').max(QTY_MAX),
  fatPercentage: z.coerce.number().min(FAT_MIN).max(FAT_MAX),
});

export const listMilkSchema = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  shift: z.enum(SHIFTS).optional(),
  milkType: z.enum(MILK_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const serializeEntry = (e: any) => ({
  id: String(e._id),
  entryDate: formatEntryDate(e.entryDate),
  shift: e.shift,
  milkType: e.milkType,
  quantityLitres: e.quantityLitres,
  fatPercentage: e.fatPercentage,
  rateMode: e.rateMode,
  appliedRate: e.appliedRate,
  totalAmount: e.totalAmount,
  createdAt: e.createdAt,
});

/**
 * Create an entry. The rate and amount come from the dairy's saved settings
 * and are recomputed here -- a client-sent amount is never trusted -- then
 * snapshotted onto the row so later rate edits don't rewrite history.
 */
export const createMilkEntry: RequestHandler = asyncHandler(async (req, res) => {
  const dairy = req.dairy!;
  const body = req.body as z.infer<typeof createMilkSchema>;

  const { rateMode, rate } = dairy.rateSettings[body.milkType];
  if (!rate || rate <= 0) {
    throw badRequest('पहले रेट सेटिंग में रेट सेव करें', 'rate_not_set');
  }

  const entryDate = parseEntryDate(body.entryDate ?? todayIST());
  if (entryDate.getTime() > parseEntryDate(todayIST()).getTime()) {
    throw badRequest('भविष्य की तारीख नहीं चुन सकते', 'future_date');
  }

  const quantityLitres = round2(body.quantityLitres);
  const fatPercentage = round2(body.fatPercentage);
  const totalAmount = calculateAmount({
    quantityLitres,
    fatPercentage,
    rateMode,
    appliedRate: rate,
  });

  const entry = await MilkEntry.create({
    dairyId: dairy._id,
    entryDate,
    shift: body.shift,
    milkType: body.milkType,
    quantityLitres,
    fatPercentage,
    rateMode,
    appliedRate: rate,
    totalAmount,
  });

  res.status(201).json({ ok: true, data: serializeEntry(entry) });
});

/** Build a dairy-scoped filter. dairyId is always forced from the session. */
export function entryFilter(dairyId: unknown, q: z.infer<typeof listMilkSchema>) {
  const filter: Record<string, any> = { dairyId };
  if (q.from || q.to) {
    filter.entryDate = {};
    if (q.from) filter.entryDate.$gte = parseEntryDate(q.from);
    if (q.to) filter.entryDate.$lte = parseEntryDate(q.to);
  }
  if (q.shift) filter.shift = q.shift;
  if (q.milkType) filter.milkType = q.milkType;
  return filter;
}

export const listMilkEntries: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listMilkSchema>;
  const filter = entryFilter(req.dairy!._id, q);

  const [items, total] = await Promise.all([
    MilkEntry.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    MilkEntry.countDocuments(filter),
  ]);

  res.json({
    ok: true,
    data: {
      items: items.map(serializeEntry),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});
