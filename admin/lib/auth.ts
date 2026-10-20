'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE_URL, TOKEN_COOKIE } from './api';

const TWELVE_HOURS = 12 * 60 * 60;

export interface LoginState {
  error?: string;
}

/** Server action: exchange credentials for an admin token cookie. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Enter both email and password.' };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Cannot reach the backend. Is it running?' };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.ok === false) {
    return { error: json?.error?.message ?? 'Login failed.' };
  }

  (await cookies()).set(TOKEN_COOKIE, json.data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TWELVE_HOURS,
  });

  redirect('/');
}

export async function logout() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/login');
}

export async function requireAdminToken(): Promise<string> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) redirect('/login');
  return token;
}
