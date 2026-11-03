'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { API_BASE_URL, TOKEN_COOKIE } from '../../lib/api';
import { ART_SLOTS } from '../../lib/constants';

export interface ImageFormState {
  error?: string;
  saved?: string;
}

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const KEYS = ART_SLOTS.map(s => s.key) as readonly string[];

/**
 * Server action: forward the picked file to the API as raw bytes.
 *
 * The API takes the image body directly rather than JSON, so this streams the
 * file through instead of base64-encoding it.
 */
export async function uploadImage(
  _prev: ImageFormState,
  formData: FormData,
): Promise<ImageFormState> {
  const key = String(formData.get('key') ?? '');
  const file = formData.get('file');

  if (!KEYS.includes(key)) return { error: 'Unknown image slot.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image first.' };
  if (file.size > MAX_BYTES) return { error: 'Image must be 3MB or smaller.' };
  if (!ALLOWED.includes(file.type)) return { error: 'Use a JPG, PNG or WebP image.' };

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return { error: 'Session expired. Sign in again.' };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/images/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, Authorization: `Bearer ${token}` },
      body: Buffer.from(await file.arrayBuffer()),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Cannot reach the backend.' };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.ok === false) {
    return { error: json?.error?.message ?? 'Upload failed.' };
  }

  revalidatePath('/images');
  return { saved: key };
}

/** Server action: drop an override so the app uses its bundled artwork. */
export async function resetImage(
  _prev: ImageFormState,
  formData: FormData,
): Promise<ImageFormState> {
  const key = String(formData.get('key') ?? '');
  if (!KEYS.includes(key)) return { error: 'Unknown image slot.' };

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return { error: 'Session expired. Sign in again.' };

  try {
    const res = await fetch(`${API_BASE_URL}/images/${key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) {
      return { error: json?.error?.message ?? 'Could not reset.' };
    }
  } catch {
    return { error: 'Cannot reach the backend.' };
  }

  revalidatePath('/images');
  return { saved: key };
}
