import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { MILK_TYPES, RATE_MODES, RATE_MAX } from '../utils/domain';

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
  },
  { timestamps: true },
);

export type DairyDoc = HydratedDocument<InferSchemaType<typeof dairySchema>>;
export const Dairy = model('Dairy', dairySchema);
export { MILK_TYPES };
