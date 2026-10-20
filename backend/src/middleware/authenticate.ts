import { RequestHandler } from 'express';
import crypto from 'node:crypto';
import { Session } from '../models/Session';
import { Dairy, DairyDoc } from '../models/Dairy';
import { Admin } from '../models/Admin';
import { env } from '../config/env';
import { unauthorized, forbidden } from './errors';
import { asyncHandler } from './errorHandler';
import jwt from 'jsonwebtoken';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      dairy?: DairyDoc;
      adminId?: string;
    }
  }
}

export const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');
export const newSessionToken = () => crypto.randomBytes(32).toString('hex');

function bearer(req: { headers: Record<string, any> }): string | null {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  const t = h.slice(7).trim();
  return t.length ? t : null;
}

/**
 * Dairy session auth. The dairy identity is resolved from the stored session
 * only -- a client-supplied dairyId is never trusted.
 */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const raw = bearer(req);
  if (!raw) throw unauthorized();

  const session = await Session.findOne({
    tokenHash: hashToken(raw),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!session) throw unauthorized('Session expired. Please register again.');

  const dairy = await Dairy.findById(session.dairyId);
  if (!dairy) throw unauthorized('Dairy not found');
  if (dairy.status !== 'active') throw forbidden('This dairy account is suspended');

  req.dairy = dairy;
  next();
});

export const signAdminToken = (adminId: string) =>
  jwt.sign({ sub: adminId, kind: 'admin' }, env.jwtSecret, {
    expiresIn: `${env.adminTokenTtlHours}h`,
  });

export const requireAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  const raw = bearer(req);
  if (!raw) throw unauthorized();

  let payload: any;
  try {
    payload = jwt.verify(raw, env.jwtSecret);
  } catch {
    throw unauthorized('Admin session expired');
  }
  if (payload?.kind !== 'admin') throw forbidden();

  const admin = await Admin.findById(payload.sub);
  if (!admin || admin.status !== 'active') throw forbidden('Admin account disabled');

  req.adminId = String(admin._id);
  next();
});
