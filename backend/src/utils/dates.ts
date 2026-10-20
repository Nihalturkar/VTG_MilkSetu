/**
 * Entry dates are stored as UTC midnight of the *local calendar day* the
 * dairy entered, so a day's rows group the same way regardless of server TZ.
 * India has no DST, so a fixed +05:30 offset is correct here.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' -> Date at UTC midnight. Throws on malformed input. */
export function parseEntryDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Invalid date: ${ymd}`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== +m[3]) {
    throw new Error(`Invalid date: ${ymd}`);
  }
  return d;
}

/** Date -> 'YYYY-MM-DD' using its UTC fields (entry dates are UTC-midnight). */
export function formatEntryDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in India, as 'YYYY-MM-DD'. */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
