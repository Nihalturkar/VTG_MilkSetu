'use server';

import { revalidatePath } from 'next/cache';
import { adminFetch, AdminApiError } from '../../lib/api';
import type { NoticeSettings } from '../../lib/constants';

export interface NoticeFormState {
  error?: string;
  saved?: boolean;
}

/** Server action: save the weekly popup configuration. */
export async function saveNotice(
  _prev: NoticeFormState,
  formData: FormData,
): Promise<NoticeFormState> {
  const startDay = Number(formData.get('startDay'));
  const endDay = Number(formData.get('endDay'));

  if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) {
    return { error: 'Pick both a start and an end day.' };
  }

  try {
    await adminFetch<NoticeSettings>('/admin/notice', {
      method: 'PUT',
      body: JSON.stringify({
        enabled: formData.get('enabled') === 'on',
        startDay,
        endDay,
        title: String(formData.get('title') ?? '').trim(),
        message: String(formData.get('message') ?? '').trim(),
      }),
    });
  } catch (err) {
    return { error: err instanceof AdminApiError ? err.message : 'Could not save. Try again.' };
  }

  revalidatePath('/notice');
  return { saved: true };
}
