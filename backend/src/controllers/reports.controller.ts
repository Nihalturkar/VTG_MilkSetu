import { RequestHandler } from 'express';
import { z } from 'zod';
import { MilkEntry } from '../models/MilkEntry';
import { buildSummary } from './summary.service';
import { serializeEntry } from './milk.controller';
import { generateReportPdf } from '../utils/generatePdf';
import { parseEntryDate, todayIST } from '../utils/dates';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest } from '../middleware/errors';
import { MILK_TYPES, SHIFTS } from '../utils/domain';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');

export const reportSchema = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  shift: z.enum(SHIFTS).optional(),
  milkType: z.enum(MILK_TYPES).optional(),
});

/** Resolve + sanity-check the window, defaulting to today. */
function window(q: z.infer<typeof reportSchema>) {
  const from = q.from ?? todayIST();
  const to = q.to ?? from;
  if (parseEntryDate(from) > parseEntryDate(to)) {
    throw badRequest('शुरू की तारीख अंतिम तारीख से बाद की है', 'bad_range');
  }
  // One year cap keeps a runaway range from streaming a huge PDF.
  const days = (parseEntryDate(to).getTime() - parseEntryDate(from).getTime()) / 86400000;
  if (days > 366) throw badRequest('अधिकतम 1 वर्ष की रिपोर्ट चुनें', 'range_too_large');
  return { from, to };
}

const scopedFilter = (dairyId: unknown, q: z.infer<typeof reportSchema>, from: string, to: string) => {
  const f: Record<string, any> = {
    dairyId,
    entryDate: { $gte: parseEntryDate(from), $lte: parseEntryDate(to) },
  };
  if (q.shift) f.shift = q.shift;
  if (q.milkType) f.milkType = q.milkType;
  return f;
};

/** JSON summary for the records screen. */
export const getReport: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof reportSchema>;
  const { from, to } = window(q);
  const summary = await buildSummary(req.dairy!._id, from, to, {
    shift: q.shift,
    milkType: q.milkType,
  });
  res.json({ ok: true, data: summary });
});

/**
 * Stream a PDF built from this dairy's records only. Nothing is persisted:
 * the document is generated on demand and piped straight to the client.
 */
export const getReportPdf: RequestHandler = asyncHandler(async (req, res) => {
  const dairy = req.dairy!;
  const q = req.query as unknown as z.infer<typeof reportSchema>;
  const { from, to } = window(q);

  const [summary, entries] = await Promise.all([
    // Same filters as the table below, so the cards and rows cannot disagree.
    buildSummary(dairy._id, from, to, { shift: q.shift, milkType: q.milkType }),
    MilkEntry.find(scopedFilter(dairy._id, q, from, to))
      .sort({ entryDate: 1, createdAt: 1 })
      .limit(5000)
      .lean(),
  ]);

  const filename = `VTGMilkSetu_${from}_to_${to}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  generateReportPdf(res, {
    dairyName: dairy.dairyName,
    ownerName: dairy.ownerName,
    summary,
    entries: entries.map(serializeEntry),
  });
});
