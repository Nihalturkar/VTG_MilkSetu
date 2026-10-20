export const MILK_TYPES = ['buffalo', 'cow'] as const;
export const SHIFTS = ['morning', 'evening'] as const;
export const RATE_MODES = ['perLitre', 'perFatPoint'] as const;

export type MilkType = (typeof MILK_TYPES)[number];
export type Shift = (typeof SHIFTS)[number];
export type RateMode = (typeof RATE_MODES)[number];

export const FAT_MIN = 1;
export const FAT_MAX = 15;
export const QTY_MAX = 5000;
export const RATE_MAX = 5000;

/** Round to 2dp without binary-float drift (1.005 -> 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
