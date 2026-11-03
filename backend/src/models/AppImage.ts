import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { ART_KEYS } from '../utils/domain';

/**
 * Artwork the mobile app shows, overridable from the admin panel.
 *
 * Stored in Mongo rather than on disk because Render's filesystem is
 * ephemeral: anything written there is lost on the next deploy or restart.
 * One document per slot; the app falls back to its bundled asset when a slot
 * has no row.
 */
const appImageSchema = new Schema(
  {
    key: { type: String, enum: ART_KEYS, required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    bytes: { type: Number, required: true },
    // Cheap cache validator, so the app re-downloads only on a real change.
    version: { type: Number, required: true, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

export type AppImageDoc = HydratedDocument<InferSchemaType<typeof appImageSchema>>;
export const AppImage = model('AppImage', appImageSchema);
