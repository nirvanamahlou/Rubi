import type {
  B2bAgencyWorkspaceV1,
  BranchReference,
  CreateB2bAgencyAgreedRateRequestV1,
  CreateB2bAgencyAgreementRequestV1,
  MasterDataListResponse,
  MasterDataStatus,
  UpsertB2bAgencyCreditPolicyRequestV1,
  UpsertB2bAgencyProfileRequestV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { masterDataApi } from '@/modules/master-data/api/client';

export interface AgencyListQuery {
  search: string;
  status: 'all' | MasterDataStatus;
  page: number;
  pageSize: number;
}

async function b2bRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await fetch(`${baseUrl}/b2b${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new Error(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت اطلاعات عملیاتی آژانس ناموفق بود.',
    );
  }
  return response.json() as Promise<T>;
}

export const agencyClient = {
  list(query: AgencyListQuery): Promise<MasterDataListResponse> {
    return masterDataApi.list('organizations', {
      ...query,
      organizationRole: 'AGENCY',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  },
  contacts(organizationId: string): Promise<MasterDataListResponse> {
    return masterDataApi.list('organization-contacts', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
      organizationId,
    });
  },
  async branches(): Promise<readonly BranchReference[]> {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
    const session = await refreshAuthenticatedSession(baseUrl);
    if (!session?.user.branches) throw new Error('دریافت شعب مجاز ناموفق بود.');
    return session.user.branches;
  },
  workspace(organizationId: string, branchId?: string) {
    return b2bRequest<{ data: B2bAgencyWorkspaceV1 }>(
      `/agencies/${encodeURIComponent(organizationId)}`,
      branchId ? { headers: { 'x-branch-id': branchId } } : undefined,
    );
  },
  upsertProfile(
    organizationId: string,
    input: UpsertB2bAgencyProfileRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/profile`,
      { method: 'PUT', body: JSON.stringify(input) },
    );
  },
  createAgreement(
    organizationId: string,
    input: CreateB2bAgencyAgreementRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/agreements`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },
  upsertCreditPolicy(
    organizationId: string,
    input: UpsertB2bAgencyCreditPolicyRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/credit-policy`,
      { method: 'PUT', body: JSON.stringify(input) },
    );
  },
  createAgreedRate(
    organizationId: string,
    input: CreateB2bAgencyAgreedRateRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/agreed-rates`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },
};
