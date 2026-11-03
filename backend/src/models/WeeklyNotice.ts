import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

/**
 * Admin-configured weekly payout summary shown to dairies.
 *
 * A single settings row (there is one dairy-facing app), holding which
 * weekday the popup appears on and which stretch of days it totals.
 */
const weeklyNoticeSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    // 0 = Sunday … 6 = Saturday. The popup shows on startDay; the window it
    // totals runs from the most recent startDay through the following endDay.
    startDay: { type: Number, min: 0, max: 6, required: true, default: 4 },
    endDay: { type: Number, min: 0, max: 6, required: true, default: 2 },
    title: { type: String, trim: true, maxlength: 80, default: 'इस हफ़्ते का हिसाब' },
    message: { type: String, trim: true, maxlength: 300, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

export type WeeklyNoticeDoc = HydratedDocument<InferSchemaType<typeof weeklyNoticeSchema>>;
export const WeeklyNotice = model('WeeklyNotice', weeklyNoticeSchema);
