import { RequestHandler } from 'express';
import { z } from 'zod';
import { Dairy } from '../models/Dairy';
import { Session } from '../models/Session';
import { getReferralSetting } from '../models/ReferralSetting';
import { ensureReferralCode } from './referral.controller';
import { REFERRAL_CODE_RE } from '../utils/domain';
import { env } from '../config/env';
import { hashToken, newSessionToken } from '../middleware/authenticate';
import { asyncHandler } from '../middleware/errorHandler';
import { conflict, unauthorized } from '../middleware/errors';

const mobile = z
  .string()
  .trim()
  .transform(s => s.replace(/[\s-]/g, '').replace(/^(\+91|91|0)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'मोबाइल नंबर 10 अंकों का होना चाहिए'));

export const registerSchema = z.object({
  ownerName: z.string().trim().min(2, 'मालिक का नाम ज़रूरी है').max(80),
  mobile,
  dairyName: z.string().trim().min(2, 'डेयरी का नाम ज़रूरी है').max(80),
  deviceId: z.string().trim().min(8).max(128),
  referralCode: z.string().trim().toUpperCase().regex(REFERRAL_CODE_RE, 'रेफरल कोड गलत है').optional(),
});

export const sessionSchema = z.object({
  mobile,
  deviceId: z.string().trim().min(8).max(128),
});

function expiry(): Date {
  return new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
}

/** Issue a session: raw token returned once, only its hash is stored. */
async function issueSession(dairyId: unknown, deviceId: string) {
  const raw = newSessionToken();
  await Session.create({ dairyId, tokenHash: hashToken(raw), deviceId, expiresAt: expiry() });
  return raw;
}

const publicDairy = (d: any) => ({
  id: String(d._id),
  ownerName: d.ownerName,
  mobile: d.mobile,
  dairyName: d.dairyName,
  status: d.status,
  rateSettings: d.rateSettings,
  referralCode: d.referralCode ?? null,
  referralCount: d.referralCount ?? 0,
});

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const { ownerName, mobile, dairyName, deviceId, referralCode } = req.body as z.infer<typeof registerSchema>;

  if (await Dairy.exists({ mobile })) {
    throw conflict('यह मोबाइल नंबर पहले से रजिस्टर्ड है', 'mobile_exists');
  }

  // An unknown or disabled code must not block the signup itself — the user
  // still gets an account, they just don't get attributed.
  let referredBy: unknown = null;
  if (referralCode) {
    const setting = await getReferralSetting();
    if (setting.enabled) {
      const referrer = await Dairy.findOne({ referralCode, status: 'active' }).select('_id').lean();
      if (referrer) referredBy = referrer._id;
    }
  }

  const dairy = await Dairy.create({ ownerName, mobile, dairyName, referredBy });
  if (referredBy) await Dairy.updateOne({ _id: referredBy }, { $inc: { referralCount: 1 } });
  await ensureReferralCode(dairy._id);

  const token = await issueSession(dairy._id, deviceId);

  res.status(201).json({ ok: true, data: { token, dairy: publicDairy(dairy) } });
});

/**
 * Re-establish a session on a known mobile number.
 *
 * NOTE: with OTP disabled this proves possession of a number, not identity.
 * It is rate-limited and every session is independently revocable; treat it
 * as device enrolment, never as verification.
 */
export const createSession: RequestHandler = asyncHandler(async (req, res) => {
  const { mobile, deviceId } = req.body as z.infer<typeof sessionSchema>;

  const dairy = await Dairy.findOne({ mobile });
  if (!dairy) throw unauthorized('यह नंबर रजिस्टर्ड नहीं है');
  if (dairy.status !== 'active') throw unauthorized('यह खाता निलंबित है');

  const token = await issueSession(dairy._id, deviceId);
  res.json({ ok: true, data: { token, dairy: publicDairy(dairy) } });
});

/** Validate the current token and return fresh dairy info (app startup). */
export const me: RequestHandler = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: { dairy: publicDairy(req.dairy) } });
});
