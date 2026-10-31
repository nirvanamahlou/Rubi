import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import type {
  InsuranceConfigurationV1,
  InsurancePolicyRowV1,
} from '@nora/contracts';

export interface InsuranceSettingsResponse {
  config: InsuranceConfigurationV1;
  version: number;
  canManage: boolean;
  providerStatus: 'NOT_CONFIGURED';
}
export interface InsuranceListResponse {
  data: InsurancePolicyRowV1[];
  count: number;
  page: number;
  pageSize: number;
  canManage: boolean;
  totals: {
    status: string;
    currencyCode: string | null;
    amount: string | null;
    count: number;
  }[];
}
export interface InsuranceCandidate {
  intakeId: string;
  branchId: string;
  customerId: string;
  contractNumber: string;
  passengerName: string;
}
export interface InsuranceReference {
  id: string;
  code: string;
  name: string;
}

export async function insuranceRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const send = () =>
    fetch(base + '/reservations/insurance/' + path, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof value?.message === 'string'
        ? value.message
        : 'اطلاعات بیمه دریافت نشد.',
    );
  return value as T;
}

export async function insuranceReferences(branchId: string, resource: string) {
  const rows: InsuranceReference[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await insuranceRequest<{
      data: InsuranceReference[];
      meta: { total: number };
    }>(
      'references?' +
        new URLSearchParams({ branchId, resource, page: String(page) }),
    );
    rows.push(...result.data);
    if (rows.length >= result.meta.total || result.data.length < 100)
      return rows;
  }
  throw new Error('فهرست اطلاعات پایه بیش از حد مجاز است.');
}

export const insuranceStatusLabels = {
  DRAFT: 'پیش‌نویس',
  INPUT_ERROR: 'نقص اطلاعات',
  PROVIDER_ERROR: 'خطای بیمه‌گر',
  ISSUED: 'صادرشده',
  CANCELLED: 'باطل‌شده',
} as const;
