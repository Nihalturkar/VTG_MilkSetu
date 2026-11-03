import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

/**
 * Milestone: hit `referrals` successful referrals, earn `reward`.
 *
 * `id` is a stable slug the admin sets, NOT the array index — Dairy stores
 * claimed ids, so reordering or deleting a milestone must not silently
 * re-grant or re-claim a different one.
 */
const milestoneSchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 40 },
    referrals: { type: Number, required: true, min: 1, max: 10_000 },
    reward: { type: String, required: true, trim: true, maxlength: 120 },
    rewardAmount: { type: Number, default: 0, min: 0, max: 1_000_000 },
  },
  { _id: false },
);

/**
 * Singleton config, found by `key`. One document means the admin edits terms
 * and milestones in place and every dairy reads the same live copy.
 */
const referralSettingSchema = new Schema(
  {
    key: { type: String, default: 'default', unique: true },
    enabled: { type: Boolean, default: true },
    // Shown verbatim on the app's referral page. Hindi copy lives in the DB,
    // not the code, so the admin can reword it without a release.
    terms: { type: String, trim: true, maxlength: 4000, default: '' },
    shareMessage: { type: String, trim: true, maxlength: 500, default: '' },
    milestones: { type: [milestoneSchema], default: [] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

export type ReferralSettingDoc = HydratedDocument<InferSchemaType<typeof referralSettingSchema>>;
export const ReferralSetting = model('ReferralSetting', referralSettingSchema);

/** Read the live config, creating the default row on first use. */
export async function getReferralSetting(): Promise<ReferralSettingDoc> {
  return ReferralSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { upsert: true, new: true },
  );
}
