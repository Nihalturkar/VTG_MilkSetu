import { RequestHandler } from 'express';
import { z } from 'zod';
import { RATE_MODES, RATE_MAX, MILK_TYPES } from '../utils/domain';
import { asyncHandler } from '../middleware/errorHandler';

const rate = z.object({
  rateMode: z.enum(RATE_MODES),
  rate: z.coerce.number().min(0, 'रेट ऋणात्मक नहीं हो सकता').max(RATE_MAX),
});

/** Either or both milk types may be updated in one call. */
export const updateRatesSchema = z
  .object({ buffalo: rate.optional(), cow: rate.optional() })
  .refine(v => v.buffalo || v.cow, { message: 'कम से कम एक रेट भेजें' });

export const getRates: RequestHandler = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: req.dairy!.rateSettings });
});

/**
 * Update rates. Existing milk entries keep their snapshotted rate/mode, so
 * changing a rate here never alters past records.
 */
export const updateRates: RequestHandler = asyncHandler(async (req, res) => {
  const dairy = req.dairy!;
  const body = req.body as z.infer<typeof updateRatesSchema>;

  for (const type of MILK_TYPES) {
    const next = body[type];
    if (next) dairy.rateSettings[type] = { rateMode: next.rateMode, rate: next.rate };
  }
  await dairy.save();

  res.json({ ok: true, data: dairy.rateSettings });
});
