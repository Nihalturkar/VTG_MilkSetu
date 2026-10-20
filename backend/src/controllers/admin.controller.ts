import { RequestHandler } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Admin } from '../models/Admin';
import { Dairy } from '../models/Dairy';
import { MilkEntry } from '../models/MilkEntry';
import { AuditLog } from '../models/AuditLog';
import { signAdminToken } from '../middleware/authenticate';
import { serializeEntry } from './milk.controller';
import { parseEntryDate, todayIST } from '../utils/dates';
import { round2, MILK_TYPES, SHIFTS } from '../utils/domain';
import { asyncHandler } from '../middleware/errorHandler';
import { unauthorized } from '../middleware/errors';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export const adminListSchema = z.object({
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminMilkSchema = adminListSchema.extend({
  dairyId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
  shift: z.enum(SHIFTS).optional(),
  milkType: z.enum(MILK_TYPES).optional(),
});

const audit = (adminId: string, action: string, target?: string, meta?: unknown) =>
  AuditLog.create({ adminId, action, target: target ?? null, meta: meta ?? null }).catch(err =>
    console.error('[audit] failed', err),
  );

export const adminLogin: RequestHandler = asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof adminLoginSchema>;

  const admin = await Admin.findOne({ email });
  // Compare against a dummy hash when absent so timing doesn't reveal
  // whether the email exists.
  const hash = admin?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduu';
  const valid = await bcrypt.compare(password, hash);

  if (!admin || !valid || admin.status !== 'active') throw unauthorized('Invalid credentials');

  await audit(String(admin._id), 'admin.login');
  res.json({
    ok: true,
    data: { token: signAdminToken(String(admin._id)), admin: { email: admin.email, role: admin.role } },
  });
});

/** Global stats across all dairies. */
export const adminDashboard: RequestHandler = asyncHandler(async (req, res) => {
  const today = todayIST();
  const dayMatch = { entryDate: parseEntryDate(today) };

  const [totalDairies, activeDairies, todayAgg, totalEntries] = await Promise.all([
    Dairy.countDocuments({}),
    Dairy.countDocuments({ status: 'active' }),
    MilkEntry.aggregate([
      { $match: dayMatch },
      { $group: { _id: null, litres: { $sum: '$quantityLitres' }, amount: { $sum: '$totalAmount' }, entries: { $sum: 1 } } },
    ]),
    MilkEntry.countDocuments({}),
  ]);

  const t = todayAgg[0] ?? { litres: 0, amount: 0, entries: 0 };
  res.json({
    ok: true,
    data: {
      date: today,
      totalDairies,
      activeDairies,
      totalEntries,
      today: { litres: round2(t.litres), amount: round2(t.amount), entries: t.entries },
    },
  });
});

export const adminDairies: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof adminListSchema>;

  const filter: Record<string, any> = {};
  if (q.search) {
    // Escape regex metacharacters from user input.
    const safe = q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ dairyName: rx }, { ownerName: rx }, { mobile: rx }];
  }

  const [items, total] = await Promise.all([
    Dairy.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Dairy.countDocuments(filter),
  ]);

  res.json({
    ok: true,
    data: {
      items: items.map(d => ({
        id: String(d._id),
        dairyName: d.dairyName,
        ownerName: d.ownerName,
        mobile: d.mobile,
        status: d.status,
        rateSettings: d.rateSettings,
        createdAt: d.createdAt,
      })),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});

/** Global milk feed with the dairy name joined in. */
export const adminMilk: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof adminMilkSchema>;

  const filter: Record<string, any> = {};
  if (q.dairyId) filter.dairyId = q.dairyId;
  if (q.from || q.to) {
    filter.entryDate = {};
    if (q.from) filter.entryDate.$gte = parseEntryDate(q.from);
    if (q.to) filter.entryDate.$lte = parseEntryDate(q.to);
  }
  if (q.shift) filter.shift = q.shift;
  if (q.milkType) filter.milkType = q.milkType;

  const [items, total] = await Promise.all([
    MilkEntry.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('dairyId', 'dairyName ownerName mobile')
      .lean(),
    MilkEntry.countDocuments(filter),
  ]);

  res.json({
    ok: true,
    data: {
      items: items.map((e: any) => ({
        ...serializeEntry(e),
        dairy: e.dairyId
          ? { id: String(e.dairyId._id), dairyName: e.dairyId.dairyName, ownerName: e.dairyId.ownerName }
          : null,
      })),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});
