import { RequestHandler } from 'express';
import { z } from 'zod';
import { WeeklyNotice } from '../models/WeeklyNotice';
import { buildSummary } from './summary.service';
import { parseEntryDate, formatEntryDate, todayIST } from '../utils/dates';
import { asyncHandler } from '../middleware/errorHandler';

export const updateNoticeSchema = z.object({
  enabled: z.boolean(),
  startDay: z.coerce.number().int().min(0).max(6),
  endDay: z.coerce.number().int().min(0).max(6),
  title: z.string().trim().max(80).optional(),
  message: z.string().trim().max(300).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const shift = (ymd: string, days: number) =>
  formatEntryDate(new Date(parseEntryDate(ymd).getTime() + days * DAY_MS));

/** The single settings row, created with defaults on first access. */
async function settings() {
  return (await WeeklyNotice.findOne()) ?? (await WeeklyNotice.create({}));
}

/**
 * The window a notice shown on `today` covers.
 *
 * `today` is the startDay (the caller has checked), so the window opens today
 * and runs forward to the next endDay. A Thursday→Tuesday setting therefore
 * covers Thursday through the following Tuesday: 6 days. When start and end
 * are the same weekday the window is a full 7 days, not a single one,
 * because a one-day "week" is never what an admin means by it.
 */
export function noticeWindow(today: string, startDay: number, endDay: number) {
  // Both ends are inclusive, so a 7-day week advances 6 days. The `|| 6`
  // makes start==end mean a full week rather than a single day.
  const span = (endDay - startDay + 7) % 7 || 6;
  return { from: today, to: shift(today, span) };
}

/**
 * Dairy-facing: the notice to show today, or null.
 *
 * Returns null unless the feature is on and today is the configured start
 * weekday, so the app can call this on every launch and simply render what
 * it gets back.
 */
export const getTodayNotice: RequestHandler = asyncHandler(async (req, res) => {
  const cfg = await settings();
  const today = todayIST();
  const todayDow = parseEntryDate(today).getUTCDay();

  if (!cfg.enabled || todayDow !== cfg.startDay) {
    res.json({ ok: true, data: { notice: null } });
    return;
  }

  const { from, to } = noticeWindow(today, cfg.startDay, cfg.endDay);
  const summary = await buildSummary(req.dairy!._id, from, to);

  res.json({
    ok: true,
    data: {
      notice: {
        // Lets the app remember "already shown" without a server round trip.
        id: `${formatEntryDate(parseEntryDate(from))}-${cfg.startDay}-${cfg.endDay}`,
        title: cfg.title,
        message: cfg.message ?? '',
        from,
        to,
        overall: summary.overall,
        morning: summary.morning,
        evening: summary.evening,
        buffalo: summary.buffalo,
        cow: summary.cow,
      },
    },
  });
});

/** Admin: read the current configuration. */
export const getNoticeSettings: RequestHandler = asyncHandler(async (_req, res) => {
  const cfg = await settings();
  res.json({
    ok: true,
    data: {
      enabled: cfg.enabled,
      startDay: cfg.startDay,
      endDay: cfg.endDay,
      title: cfg.title,
      message: cfg.message ?? '',
      updatedAt: cfg.updatedAt,
    },
  });
});

/** Admin: change it. */
export const updateNoticeSettings: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof updateNoticeSchema>;
  const cfg = await settings();

  cfg.enabled = body.enabled;
  cfg.startDay = body.startDay;
  cfg.endDay = body.endDay;
  if (body.title !== undefined) cfg.title = body.title;
  if (body.message !== undefined) cfg.message = body.message;
  cfg.updatedBy = req.adminId as never;
  await cfg.save();

  res.json({
    ok: true,
    data: {
      enabled: cfg.enabled,
      startDay: cfg.startDay,
      endDay: cfg.endDay,
      title: cfg.title,
      message: cfg.message ?? '',
      updatedAt: cfg.updatedAt,
    },
  });
});
