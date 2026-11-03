import { RequestHandler } from 'express';
import { z } from 'zod';
import { Expense } from '../models/Expense';
import { MilkEntry } from '../models/MilkEntry';
import {
  EXPENSE_CATEGORIES, EXPENSE_SCOPES, EXPENSE_MAX, MILK_TYPES, round2,
} from '../utils/domain';
import { parseEntryDate, formatEntryDate, todayIST } from '../utils/dates';
import { asyncHandler } from '../middleware/errorHandler';
import { badRequest } from '../middleware/errors';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');

export const createExpenseSchema = z.object({
  spentOn: ymd.optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  milkType: z.enum(EXPENSE_SCOPES).default('shared'),
  amount: z.coerce.number().positive('खर्च 0 से अधिक होना चाहिए').max(EXPENSE_MAX),
  note: z.string().trim().max(120).optional(),
});

export const listExpenseSchema = z.object({
  from: ymd.optional(),
  to: ymd.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  milkType: z.enum(EXPENSE_SCOPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const profitSchema = z.object({ from: ymd, to: ymd });

export const serializeExpense = (e: any) => ({
  id: String(e._id),
  spentOn: formatEntryDate(e.spentOn),
  category: e.category,
  milkType: e.milkType,
  amount: e.amount,
  note: e.note ?? '',
  createdAt: e.createdAt,
});

export const createExpense: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof createExpenseSchema>;

  const spentOn = parseEntryDate(body.spentOn ?? todayIST());
  if (spentOn.getTime() > parseEntryDate(todayIST()).getTime()) {
    throw badRequest('भविष्य की तारीख नहीं चुन सकते', 'future_date');
  }

  const expense = await Expense.create({
    dairyId: req.dairy!._id,
    spentOn,
    category: body.category,
    milkType: body.milkType,
    amount: round2(body.amount),
    note: body.note ?? '',
  });

  res.status(201).json({ ok: true, data: serializeExpense(expense) });
});

export const listExpenses: RequestHandler = asyncHandler(async (req, res) => {
  const q = req.query as unknown as z.infer<typeof listExpenseSchema>;

  const filter: Record<string, any> = { dairyId: req.dairy!._id };
  if (q.from || q.to) {
    filter.spentOn = {};
    if (q.from) filter.spentOn.$gte = parseEntryDate(q.from);
    if (q.to) filter.spentOn.$lte = parseEntryDate(q.to);
  }
  if (q.category) filter.category = q.category;
  if (q.milkType) filter.milkType = q.milkType;

  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ spentOn: -1, createdAt: -1 })
      .skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Expense.countDocuments(filter),
  ]);

  res.json({
    ok: true,
    data: {
      items: items.map(serializeExpense),
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  });
});

const ZERO_SIDE = { income: 0, expense: 0, profit: 0, litres: 0 };

/**
 * Milk income vs expenses for a window, overall and per animal.
 *
 * Per-animal profit only counts expenses tagged to that animal; 'shared' costs
 * are reported separately rather than split, because any split would be a
 * guess. So: overall.profit = buffalo.profit + cow.profit - sharedExpense.
 */
export const getProfit: RequestHandler = asyncHandler(async (req, res) => {
  const { from, to } = req.query as unknown as z.infer<typeof profitSchema>;
  const dairyId = req.dairy!._id;
  const range = { $gte: parseEntryDate(from), $lte: parseEntryDate(to) };

  const [milkRows, expenseRows] = await Promise.all([
    MilkEntry.aggregate([
      { $match: { dairyId, entryDate: range } },
      { $group: { _id: '$milkType', amount: { $sum: '$totalAmount' }, litres: { $sum: '$quantityLitres' } } },
    ]),
    Expense.aggregate([
      { $match: { dairyId, spentOn: range } },
      { $group: { _id: { milkType: '$milkType', category: '$category' }, amount: { $sum: '$amount' } } },
    ]),
  ]);

  const perType: Record<string, typeof ZERO_SIDE> = {};
  for (const t of MILK_TYPES) perType[t] = { ...ZERO_SIDE };

  for (const r of milkRows) {
    if (perType[r._id]) {
      perType[r._id].income = r.amount;
      perType[r._id].litres = r.litres;
    }
  }

  let sharedExpense = 0;
  const byCategory: Record<string, number> = {};
  for (const r of expenseRows) {
    const { milkType, category } = r._id;
    byCategory[category] = round2((byCategory[category] ?? 0) + r.amount);
    if (perType[milkType]) perType[milkType].expense += r.amount;
    else sharedExpense += r.amount;
  }

  for (const t of MILK_TYPES) {
    const s = perType[t];
    s.income = round2(s.income);
    s.expense = round2(s.expense);
    s.litres = round2(s.litres);
    s.profit = round2(s.income - s.expense);
  }

  const income = round2(perType.buffalo.income + perType.cow.income);
  const expense = round2(perType.buffalo.expense + perType.cow.expense + sharedExpense);

  res.json({
    ok: true,
    data: {
      from,
      to,
      overall: {
        income,
        expense,
        profit: round2(income - expense),
        litres: round2(perType.buffalo.litres + perType.cow.litres),
      },
      buffalo: perType.buffalo,
      cow: perType.cow,
      sharedExpense: round2(sharedExpense),
      byCategory,
    },
  });
});
