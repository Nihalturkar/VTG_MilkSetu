import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const sessionSchema = new Schema(
  {
    dairyId: { type: Schema.Types.ObjectId, ref: 'Dairy', required: true, index: true },
    // SHA-256 of the raw token. The raw token is returned to the device once
    // and never stored or logged.
    tokenHash: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Let Mongo reap expired sessions on its own.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = HydratedDocument<InferSchemaType<typeof sessionSchema>>;
export const Session = model('Session', sessionSchema);
