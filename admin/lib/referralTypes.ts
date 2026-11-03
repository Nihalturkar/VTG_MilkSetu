/** Kept out of referrals.ts because a 'use server' file may only export async functions. */
export interface SettingsState {
  error?: string;
  ok?: boolean;
}
