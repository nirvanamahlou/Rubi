import type { PartnerFinanceV1, PartnerRoleV1 } from '@nora/contracts';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

async function request<T>(
  path: string,
  branchId: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API تنظیم نشده است.');
  const send = () =>
    localizedFetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'x-branch-id': branchId,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(signal ? { signal } : {}),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw Object.assign(
      new Error(
        result?.error?.message ??
          result?.message ??
          'دریافت پرونده طرف همکاری ناموفق بود.',
      ),
      { status: response.status },
    );
  }
  return response.json() as Promise<T>;
}
export const partnerClient = {
  prepare(resource: 'suppliers' | 'brokers', branchId: string) {
    return request<{ prepared: number; remaining: number }>(
      `/master-data/partner-dossiers/${resource}/prepare`,
      branchId,
      undefined,
      {},
    );
  },
  createFinanceRequest(
    organizationId: string,
    role: PartnerRoleV1,
    branchId: string,
    input: {
      operationId: string;
      kind: 'CHECK' | 'COMMISSION' | 'ADJUSTMENT';
      title: string;
      party: string;
      description: string;
      reference: string;
      amount: string;
      currencyCode: string;
      dueAt: string;
    },
  ) {
    return request<{ requestId: string; status: string }>(
      '/finance/requests',
      branchId,
      undefined,
      {
        ...input,
        branchId,
        counterpartyOrganizationId: organizationId,
        counterpartyRole: role,
      },
    );
  },
  finance(
    organizationId: string,
    role: PartnerRoleV1,
    branchId: string,
    signal?: AbortSignal,
  ) {
    return request<PartnerFinanceV1>(
      `/finance/partners/${role}/${encodeURIComponent(organizationId)}`,
      branchId,
      signal,
    );
  },
  connect(
    resource: 'suppliers' | 'brokers',
    id: string,
    version: number,
    branchId: string,
  ) {
    return request<{ organizationId: string }>(
      `/master-data/partner-dossiers/${resource}/${encodeURIComponent(id)}`,
      branchId,
      undefined,
      { version },
    );
  },
};
