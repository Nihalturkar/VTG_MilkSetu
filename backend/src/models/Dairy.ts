import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { MILK_TYPES, RATE_MODES, RATE_MAX, REFERRAL_CODE_RE } from '../utils/domain';

const rateSchema = new Schema(
  {
    rateMode: { type: String, enum: RATE_MODES, required: true, default: 'perFatPoint' },
    rate: { type: Number, required: true, min: 0, max: RATE_MAX, default: 0 },
  },
  { _id: false },
);

const dairySchema = new Schema(
  {
    ownerName: { type: String, required: true, trim: true, maxlength: 80 },
    // Normalized to bare 10 digits at the controller boundary.
    mobile: { type: String, required: true, unique: true, match: /^[6-9]\d{9}$/ },
    dairyName: { type: String, required: true, trim: true, maxlength: 80 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    rateSettings: {
      type: new Schema(
        {
          buffalo: { type: rateSchema, required: true },
          cow: { type: rateSchema, required: true },
        },
        { _id: false },
      ),
      required: true,
      default: () => ({
        buffalo: { rateMode: 'perFatPoint', rate: 0 },
        cow: { rateMode: 'perFatPoint', rate: 0 },
      }),
    },
    // Own share code. Assigned on register; unique so it can be looked up directly.
    referralCode: { type: String, match: REFERRAL_CODE_RE, unique: true, sparse: true },
    // Who brought this dairy in. Null for organic signups, never self.
    referredBy: { type: Schema.Types.ObjectId, ref: 'Dairy', default: null, index: true },
    // Denormalised count of successful referrals, kept in step with referredBy
    // so the referral page and milestone checks don't re-count on every read.
    referralCount: { type: Number, default: 0, min: 0 },
    // Milestone ids already paid out, so a reward is granted at most once.
    referralRewardsClaimed: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type DairyDoc = HydratedDocument<InferSchemaType<typeof dairySchema>>;
export const Dairy = model('Dairy', dairySchema);
export { MILK_TYPES };
