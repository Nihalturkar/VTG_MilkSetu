import { Schema, model, InferSchemaType, HydratedDocument, Types } from 'mongoose';
import { MILK_TYPES, SHIFTS, RATE_MODES, FAT_MIN, FAT_MAX, QTY_MAX, RATE_MAX } from '../utils/domain';

const milkEntrySchema = new Schema(
  {
    dairyId: { type: Schema.Types.ObjectId, ref: 'Dairy', required: true, index: true },
    // UTC midnight of the dairy's local calendar day.
    entryDate: { type: Date, required: true },
    shift: { type: String, enum: SHIFTS, required: true },
    milkType: { type: String, enum: MILK_TYPES, required: true },
    quantityLitres: { type: Number, required: true, min: 0.01, max: QTY_MAX },
    fatPercentage: { type: Number, required: true, min: FAT_MIN, max: FAT_MAX },
    // Rate mode + rate are snapshotted per entry so later rate changes
    // never retroactively alter historical records.
    rateMode: { type: String, enum: RATE_MODES, required: true },
    appliedRate: { type: Number, required: true, min: 0, max: RATE_MAX },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

milkEntrySchema.index({ dairyId: 1, entryDate: -1 });
milkEntrySchema.index({ dairyId: 1, entryDate: 1, shift: 1 });
milkEntrySchema.index({ entryDate: -1 }); // admin global feed

export type MilkEntryDoc = HydratedDocument<InferSchemaType<typeof milkEntrySchema>>;
export const MilkEntry = model('MilkEntry', milkEntrySchema);
export type { Types };
