import { Schema, model } from 'mongoose';

/** Append-only record of admin actions. */
const auditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    action: { type: String, required: true },
    target: { type: String, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLog = model('AuditLog', auditLogSchema);
