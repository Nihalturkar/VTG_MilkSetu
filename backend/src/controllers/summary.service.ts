import { MilkEntry } from '../models/MilkEntry';
import { formatEntryDate, parseEntryDate } from '../utils/dates';
import { round2, Shift, MilkType } from '../utils/domain';

export interface Totals {
  litres: number;
  amount: number;
  entries: number;
}

const ZERO: Totals = { litres: 0, amount: 0, entries: 0 };

const totalsFrom = (r?: any): Totals =>
  r ? { litres: round2(r.litres), amount: round2(r.amount), entries: r.entries } : { ...ZERO };

export interface SummaryFilters {
  shift?: Shift;
  milkType?: MilkType;
}

/**
 * One aggregation producing overall / per-shift / per-type / per-day totals
 * for a dairy and date window. Used by both the dashboard and the reports.
 *
 * Optional shift/milkType narrow the window the same way the PDF does, so the
 * on-screen summary and the downloaded report always agree.
 */
export async function buildSummary(
  dairyId: unknown,
  from: string,
  to: string,
  filters: SummaryFilters = {},
) {
  const match: Record<string, unknown> = {
    dairyId,
    entryDate: { $gte: parseEntryDate(from), $lte: parseEntryDate(to) },
  };
  if (filters.shift) match.shift = filters.shift;
  if (filters.milkType) match.milkType = filters.milkType;

  const [agg] = await MilkEntry.aggregate([
    { $match: match },
    {
      $facet: {
        overall: [{ $group: { _id: null, litres: { $sum: '$quantityLitres' }, amount: { $sum: '$totalAmount' }, entries: { $sum: 1 } } }],
        byShift: [{ $group: { _id: '$shift', litres: { $sum: '$quantityLitres' }, amount: { $sum: '$totalAmount' }, entries: { $sum: 1 } } }],
        byType: [{ $group: { _id: '$milkType', litres: { $sum: '$quantityLitres' }, amount: { $sum: '$totalAmount' }, entries: { $sum: 1 } } }],
        byDay: [
          { $group: { _id: '$entryDate', litres: { $sum: '$quantityLitres' }, amount: { $sum: '$totalAmount' }, entries: { $sum: 1 } } },
          { $sort: { _id: -1 } },
        ],
      },
    },
  ]);

  const pick = (rows: any[], key: string) => totalsFrom(rows.find(r => r._id === key));

  return {
    from,
    to,
    overall: totalsFrom(agg.overall[0]),
    morning: pick(agg.byShift, 'morning'),
    evening: pick(agg.byShift, 'evening'),
    buffalo: pick(agg.byType, 'buffalo'),
    cow: pick(agg.byType, 'cow'),
    daily: agg.byDay.map((d: any) => ({
      date: formatEntryDate(d._id),
      ...totalsFrom(d),
    })),
  };
}

export type Summary = Awaited<ReturnType<typeof buildSummary>>;
