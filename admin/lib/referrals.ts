'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch, AdminApiError, type ReferralMilestone } from './api';
import type { SettingsState } from './referralTypes';

/**
 * Milestones arrive as parallel id/referrals/reward/amount field arrays from
 * the form's repeated inputs. Rows with a blank id or reward are dropped, so
 * the admin can clear a row to delete it instead of needing a separate button.
 */
function readMilestones(formData: FormData): ReferralMilestone[] {
  const ids = formData.getAll('ms_id').map(String);
  const counts = formData.getAll('ms_referrals').map(String);
  const rewards = formData.getAll('ms_reward').map(String);
  const amounts = formData.getAll('ms_amount').map(String);

  const out: ReferralMilestone[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = (ids[i] ?? '').trim();
    const reward = (rewards[i] ?? '').trim();
    if (!id || !reward) continue;
    out.push({
      id,
      referrals: Number(counts[i] ?? 0) || 0,
      reward,
      rewardAmount: Number(amounts[i] ?? 0) || 0,
    });
  }
  return out;
}

export async function saveReferralSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const milestones = readMilestones(formData);

  // Validate here as well as server-side: the API rejects these, but a
  // round-trip error message would lose the admin's unsaved edits.
  const ids = milestones.map(m => m.id);
  if (new Set(ids).size !== ids.length) {
    return { error: 'Milestone IDs must be unique.' };
  }
  const bad = milestones.find(m => m.referrals < 1);
  if (bad) {
    return { error: `Milestone “${bad.id}” needs a referral count of at least 1.` };
  }

  try {
    await adminFetch('/admin/referrals/settings', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: formData.get('enabled') === 'on',
        terms: String(formData.get('terms') ?? '').trim(),
        shareMessage: String(formData.get('shareMessage') ?? '').trim(),
        milestones,
      }),
    });
  } catch (e) {
    return { error: (e as AdminApiError).message };
  }

  revalidatePath('/referrals');
  return { ok: true };
}

export async function markRewardPaid(formData: FormData): Promise<void> {
  const dairyId = String(formData.get('dairyId') ?? '');
  const milestoneId = String(formData.get('milestoneId') ?? '');
  if (!dairyId || !milestoneId) return;

  try {
    await adminFetch('/admin/referrals/reward', {
      method: 'POST',
      body: JSON.stringify({ dairyId, milestoneId }),
    });
  } catch {
    // Surfaced on the next render via the refreshed claimed list; a failed
    // payout mark must not take the whole page down.
  }
  revalidatePath('/referrals');
}
