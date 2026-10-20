import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const adminSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin'], default: 'admin' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AdminDoc = HydratedDocument<InferSchemaType<typeof adminSchema>>;
export const Admin = model('Admin', adminSchema);
