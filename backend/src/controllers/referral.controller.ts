import { RequestHandler } from 'express';
import { z } from 'zod';
import { Dairy } from '../models/Dairy';
import { ReferralSetting, getReferralSetting } from '../models/ReferralSetting';
import { REFERRAL_CODE_RE, randomReferralCode, milestoneProgress } from '../utils/domain';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest, notFound } from '../middleware/errors';

export const applyCodeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(REFERRAL_CODE_RE, 'रेफरल कोड गलत है'),
});

const milestoneInput = z.object({
  id: z.string().trim().min(1).max(40),
  referrals: z.coerce.number().int().min(1).max(10_000),
  reward: z.string().trim().min(1).max(120),
  rewardAmount: z.coerce.number().min(0).max(1_000_000).default(0),
});

export const updateSettingSchema = z.object({
  enabled: z.boolean().optional(),
  terms: z.string().trim().max(4000).optional(),
  shareMessage: z.string().trim().max(500).optional(),
  milestones: z.array(milestoneInput).max(20).optional(),
}).refine(
  // Claimed rewards are keyed by milestone id, so duplicates would make
  // "already claimed" ambiguous.
  b => !b.milestones || new Set(b.milestones.map(m => m.id)).size === b.milestones.length,
  { message: 'Milestone ids must be unique', path: ['milestones'] },
);

/**
 * Assign a unique code, retrying on the unique-index collision rather than
 * pre-checking — the race between check and write is what actually bites.
 */
export async function ensureReferralCode(dairyId: unknown): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomReferralCode();
    try {
      const updated = await Dairy.findOneAndUpdate(
        { _id: dairyId, referralCode: { $in: [null, undefined] } },
        { $set: { referralCode: code } },
        { new: true },
      );
      // Already had one (another request won, or it was set earlier).
      if (!updated) {
        const existing = await Dairy.findById(dairyId).select('referralCode').lean();
        if (existing?.referralCode) return existing.referralCode;
        continue;
      }
      return code;
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      // Code taken by another dairy; loop picks a new one.
    }
  }
  throw new Error('could not allocate a referral code');
}

/** The referral page: own code, who you referred, live terms, milestones. */
export const getMyReferrals: RequestHandler = asyncHandler(async (req, res) => {
  const dairy = req.dairy!;
  const code = dairy.referralCode ?? (await ensureReferralCode(dairy._id));

  const [setting, invitees] = await Promise.all([
    getReferralSetting(),
    Dairy.find({ referredBy: dairy._id })
      .select('ownerName dairyName mobile createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  ]);

  const claimed = dairy.referralRewardsClaimed ?? [];
  const count = invitees.length;

  // Self-heal the denormalised counter if it ever drifts from reality.
  if (dairy.referralCount !== count) {
    await Dairy.updateOne({ _id: dairy._id }, { $set: { referralCount: count } });
  }

  res.json({
    ok: true,
    data: {
      code,
      enabled: setting.enabled,
      terms: setting.terms,
      shareMessage: (setting.shareMessage || '').replace('{code}', code),
      referralCount: count,
      // Mobile is masked: the referrer should see who joined, not harvest numbers.
      invitees: invitees.map(d => ({
        ownerName: d.ownerName,
        dairyName: d.dairyName,
        mobile: d.mobile ? `${d.mobile.slice(0, 2)}XXXXX${d.mobile.slice(-3)}` : '',
        joinedAt: d.createdAt,
      })),
      milestones: milestoneProgress(setting.milestones ?? [], count, claimed),
      rewardsClaimed: claimed,
    },
  });
});

/**
 * Attach a referrer after signup, for users who got the code late.
 *
 * One-time and irreversible: a dairy that already has a referrer cannot be
 * re-pointed, which is what stops code-swapping to farm milestones.
 */
export const applyReferralCode: RequestHandler = asyncHandler(async (req, res) => {
  const { code } = req.body as z.infer<typeof applyCodeSchema>;
  const dairy = req.dairy!;

  const setting = await getReferralSetting();
  if (!setting.enabled) throw badRequest('रेफरल प्रोग्राम बंद है', 'referral_disabled');
  if (dairy.referredBy) throw badRequest('रेफरल कोड पहले ही लगाया जा चुका है', 'already_referred');

  const referrer = await Dairy.findOne({ referralCode: code }).select('_id status');
  if (!referrer) throw notFound('यह रेफरल कोड मौजूद नहीं है');
  if (String(referrer._id) === String(dairy._id)) {
    throw badRequest('अपना ही कोड नहीं लगा सकते', 'self_referral');
  }
  if (referrer.status !== 'active') throw badRequest('यह कोड अब मान्य नहीं है', 'referrer_inactive');

  // Guard the write too, so two parallel requests can't both attach.
  const claimed = await Dairy.updateOne(
    { _id: dairy._id, referredBy: null },
    { $set: { referredBy: referrer._id } },
  );
  if (claimed.modifiedCount === 0) {
    throw badRequest('रेफरल कोड पहले ही लगाया जा चुका है', 'already_referred');
  }
  await Dairy.updateOne({ _id: referrer._id }, { $inc: { referralCount: 1 } });

  res.json({ ok: true, data: { applied: true } });
});

// --- Admin --------------------------------------------------------------

const serializeSetting = (s: any) => ({
  enabled: s.enabled,
  terms: s.terms,
  shareMessage: s.shareMessage,
  milestones: (s.milestones ?? []).map((m: any) => ({
    id: m.id,
    referrals: m.referrals,
    reward: m.reward,
    rewardAmount: m.rewardAmount ?? 0,
  })),
  updatedAt: s.updatedAt,
});

export const adminGetSetting: RequestHandler = asyncHandler(async (_req, res) => {
  res.json({ ok: true, data: serializeSetting(await getReferralSetting()) });
});

/** Partial update — only the keys sent are touched. */
export const adminUpdateSetting: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof updateSettingSchema>;

  const $set: Record<string, any> = { updatedBy: req.adminId ?? null };
  for (const k of ['enabled', 'terms', 'shareMessage', 'milestones'] as const) {
    if (body[k] !== undefined) $set[k] = body[k];
  }

  const updated = await ReferralSetting.findOneAndUpdate(
    { key: 'default' },
    { $set, $setOnInsert: { key: 'default' } },
    { upsert: true, new: true, runValidators: true },
  );

  res.json({ ok: true, data: serializeSetting(updated) });
});

export const adminLeaderboardSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Who is actually referring, so the admin can verify payouts. */
export const adminLeaderboard: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof adminLeaderboardSchema>;
  const filter = { referralCount: { $gt: 0 } };

  const [items, total] = await Promise.all([
    Dairy.find(filter)
      .select('ownerName dairyName mobile referralCode referralCount referralRewardsClaimed')
      .sort({ referralCount: -1, createdAt: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Dairy.countDocuments(filter),
  ]);

  res.json({
    ok: true,
    data: {
      items: items.map(d => ({
        id: String(d._id),
        ownerName: d.ownerName,
        dairyName: d.dairyName,
        mobile: d.mobile,
        referralCode: d.referralCode ?? null,
        referralCount: d.referralCount ?? 0,
        rewardsClaimed: d.referralRewardsClaimed ?? [],
      })),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});

export const adminMarkRewardSchema = z.object({
  dairyId: z.string().regex(/^[a-f\d]{24}$/i),
  milestoneId: z.string().trim().min(1).max(40),
});

/** Record a reward as paid. $addToSet keeps it idempotent. */
export const adminMarkReward: RequestHandler = asyncHandler(async (req, res) => {
  const { dairyId, milestoneId } = req.body as z.infer<typeof adminMarkRewardSchema>;

  const setting = await getReferralSetting();
  const milestone = (setting.milestones ?? []).find((m: any) => m.id === milestoneId);
  if (!milestone) throw notFound('यह माइलस्टोन मौजूद नहीं है');

  const dairy = await Dairy.findById(dairyId).select('referralCount referralRewardsClaimed');
  if (!dairy) throw notFound('डेयरी नहीं मिली');
  if ((dairy.referralCount ?? 0) < milestone.referrals) {
    throw badRequest('इस माइलस्टोन तक रेफरल पूरे नहीं हुए', 'milestone_not_reached');
  }

  await Dairy.updateOne({ _id: dairyId }, { $addToSet: { referralRewardsClaimed: milestoneId } });
  res.json({ ok: true, data: { dairyId, milestoneId, claimed: true } });
});
