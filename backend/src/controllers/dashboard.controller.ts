import { RequestHandler } from 'express';
import { MilkEntry } from '../models/MilkEntry';
import { buildSummary } from './summary.service';
import { serializeEntry } from './milk.controller';
import { todayIST } from '../utils/dates';
import { asyncHandler } from '../middleware/errorHandler';

/** Today's totals + the latest entries, for the home screen. */
export const getDashboard: RequestHandler = asyncHandler(async (req, res) => {
  const dairy = req.dairy!;
  const today = todayIST();

  const [summary, recent] = await Promise.all([
    buildSummary(dairy._id, today, today),
    MilkEntry.find({ dairyId: dairy._id })
      .sort({ entryDate: -1, createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  res.json({
    ok: true,
    data: {
      date: today,
      dairy: { id: String(dairy._id), dairyName: dairy.dairyName, ownerName: dairy.ownerName },
      today: summary,
      rateSettings: dairy.rateSettings,
      recentEntries: recent.map(serializeEntry),
    },
  });
});
