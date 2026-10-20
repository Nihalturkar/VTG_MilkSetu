import { cookies } from 'next/headers';

/**
 * Where this panel's server-side code calls the API.
 *
 * In production the API and the panel are the same Node process, so these
 * requests go back to this server's own port over loopback — never to a
 * public hostname, which would add a pointless round trip through the proxy.
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 4000}/api`;
export const TOKEN_COOKIE = 'vtg_admin_token';

export class AdminApiError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}

/**
 * Server-side fetch against the backend. The admin token lives in an
 * httpOnly cookie, so it is never exposed to client JS.
 */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;

  const res = await fetch(API_BASE_URL + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.ok === false) {
    throw new AdminApiError(
      res.status,
      json?.error?.message ?? 'Request failed',
      json?.error?.code ?? 'error',
    );
  }
  return json.data as T;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminStats {
  date: string;
  totalDairies: number;
  activeDairies: number;
  totalEntries: number;
  today: { litres: number; amount: number; entries: number };
}

export interface AdminDairy {
  id: string;
  dairyName: string;
  ownerName: string;
  mobile: string;
  status: 'active' | 'suspended';
  rateSettings: {
    buffalo: { rateMode: string; rate: number };
    cow: { rateMode: string; rate: number };
  };
  createdAt: string;
}

export interface AdminMilkRow {
  id: string;
  entryDate: string;
  shift: 'morning' | 'evening';
  milkType: 'buffalo' | 'cow';
  quantityLitres: number;
  fatPercentage: number;
  rateMode: 'perLitre' | 'perFatPoint';
  appliedRate: number;
  totalAmount: number;
  dairy: { id: string; dairyName: string; ownerName: string } | null;
}

export const money = (n: number) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SHIFT_LABEL = { morning: 'Morning', evening: 'Evening' } as const;
export const TYPE_LABEL = { buffalo: 'Buffalo', cow: 'Cow' } as const;
