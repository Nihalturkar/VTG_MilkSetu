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

export const EXPENSE_CATEGORIES = ['feed', 'medicine', 'labour', 'transport', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
/** 'shared' = a cost not attributable to one animal (labour, electricity). */
export const EXPENSE_SCOPES = [...MILK_TYPES, 'shared'] as const;
export type ExpenseScope = (typeof EXPENSE_SCOPES)[number];
export const EXPENSE_MAX = 1_000_000;

/** Referral codes: uppercase, no 0/O/1/I to survive being read aloud. */
export const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 6;
export const REFERRAL_CODE_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

export function randomReferralCode(): string {
  let out = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    out += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
  }
  return out;
}

export type Milestone = { id: string; referrals: number; reward: string; rewardAmount?: number };

/**
 * Milestones in ascending order with each one's progress.
 *
 * `reached` and `claimed` are deliberately separate: the admin pays out, so a
 * milestone can be earned but not yet settled, and the app must show both.
 */
export function milestoneProgress(milestones: Milestone[], count: number, claimed: string[]) {
  return [...milestones]
    .sort((a, b) => a.referrals - b.referrals)
    .map(m => ({
      id: m.id,
      referrals: m.referrals,
      reward: m.reward,
      rewardAmount: m.rewardAmount ?? 0,
      reached: count >= m.referrals,
      claimed: claimed.includes(m.id),
      remaining: Math.max(0, m.referrals - count),
    }));
}

/** Artwork slots the app renders and the admin panel can replace. */
export const ART_KEYS = ['hero', 'buffalo', 'cow', 'morning', 'evening', 'success'] as const;
export type ArtKey = (typeof ART_KEYS)[number];
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 0 = Sunday … 6 = Saturday, matching JS getUTCDay(). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];
