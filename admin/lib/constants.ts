/**
 * Values shared by server and client components.
 *
 * Kept out of lib/api.ts because that module imports next/headers, which
 * cannot be pulled into a client component.
 */

export interface NoticeSettings {
  enabled: boolean;
  startDay: number;
  endDay: number;
  title: string;
  message: string;
  updatedAt?: string;
}

export interface AppImageRow {
  key: string;
  version: number;
  bytes: number;
  contentType: string;
  updatedAt?: string;
}

/** Artwork slots the app renders, in the order the panel lists them. */
export const ART_SLOTS = [
  { key: 'hero', label: 'Home banner', hint: 'Wide photo on the home screen (about 1000x580)' },
  { key: 'buffalo', label: 'Buffalo card', hint: 'Shown when picking buffalo milk (about 600x420)' },
  { key: 'cow', label: 'Cow card', hint: 'Shown when picking cow milk (about 600x420)' },
  { key: 'morning', label: 'Morning shift', hint: 'Sunrise image on the shift screen (about 800x420)' },
  { key: 'evening', label: 'Evening shift', hint: 'Evening image on the shift screen (about 800x420)' },
  { key: 'success', label: 'Success badge', hint: 'Shown after an entry is saved (square)' },
] as const;

export const WEEKDAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export const kb = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
