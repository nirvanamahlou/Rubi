import type {
  B2bAgreementCaseV1,
  B2bAgreementActionRequestV1,
  B2bCooperationRole,
  SaveB2bAgreementTermsRequestV1,
  B2bAgencyWorkspaceV1,
  BranchReference,
  CreateB2bAgencyAgreedRateRequestV1,
  CreateB2bAgencyAgreementRequestV1,
  MasterDataListResponse,
  MasterDataRecord,
  MasterDataStatus,
  MasterDataSortField,
  MasterDataSortDirection,
  UpsertB2bAgencyCreditPolicyRequestV1,
  UpsertB2bAgencyProfileRequestV1,
  B2bAgencyProfileDetailsV1,
  B2bAgencyAgreedRateV1,
  UpdateB2bAgencyAgreedRateRequestV1,
  B2bRecordDeleteRequestV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { masterDataApi } from '@/modules/master-data/api/client';

export interface AgencyListQuery {
  search: string;
  status: 'all' | MasterDataStatus;
  page: number;
  pageSize: number;
  role?: 'AGENCY' | 'CORPORATE_CUSTOMER';
  sortBy?: MasterDataSortField;
  sortDirection?: MasterDataSortDirection;
}

export class B2bApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function b2bRequest<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new B2bApiError('نشانی API پیکربندی نشده است.', 0);
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
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return b2bRequest<T>(path, init, true);
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
      error?: { message?: string; code?: string };
    } | null;
    throw new B2bApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت اطلاعات عملیاتی آژانس ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

export const agencyClient = {
  profileDetails(organizationId: string, branchId: string) {
    return b2bRequest<{ data: B2bAgencyProfileDetailsV1 }>(
      `/agencies/${encodeURIComponent(organizationId)}/profile`,
      { headers: { 'x-branch-id': branchId } },
    );
  },
  rates(organizationId: string, branchId: string) {
    return b2bRequest<{ data: B2bAgencyAgreedRateV1[] }>(
      `/agencies/${encodeURIComponent(organizationId)}/agreed-rates`,
      { headers: { 'x-branch-id': branchId } },
    );
  },
  updateRate(
    organizationId: string,
    rateId: string,
    input: UpdateB2bAgencyAgreedRateRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/agreed-rates/${encodeURIComponent(rateId)}`,
      { method: 'PUT', body: JSON.stringify(input) },
    );
  },
  deleteRate(
    organizationId: string,
    rateId: string,
    input: B2bRecordDeleteRequestV1,
  ) {
    return b2bRequest(
      `/agencies/${encodeURIComponent(organizationId)}/agreed-rates/${encodeURIComponent(rateId)}`,
      { method: 'DELETE', body: JSON.stringify(input) },
    );
  },
  agreements(
    organizationId: string,
    branchId: string,
    role: B2bCooperationRole,
    page = 1,
  ) {
    return b2bRequest<{
      data: B2bAgreementCaseV1[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(
      `/agencies/${encodeURIComponent(organizationId)}/agreements?role=${role}&page=${page}`,
      { headers: { 'x-branch-id': branchId } },
    );
  },
  saveAgreementTerms(
    organizationId: string,
    input: SaveB2bAgreementTermsRequestV1,
    agreementId?: string,
  ) {
    return b2bRequest<B2bAgreementCaseV1>(
      `/agencies/${encodeURIComponent(organizationId)}/agreements/${agreementId ? encodeURIComponent(agreementId) : 'drafts'}`,
      { method: agreementId ? 'PUT' : 'POST', body: JSON.stringify(input) },
    );
  },
  agreementAction(
    organizationId: string,
    agreementId: string,
    action: 'submit' | 'review',
    input: B2bAgreementActionRequestV1,
  ) {
    return b2bRequest<B2bAgreementCaseV1>(
      `/agencies/${encodeURIComponent(organizationId)}/agreements/${encodeURIComponent(agreementId)}/${action}`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },
  saveContact(
    organizationId: string,
    values: Record<string, string>,
    existing?: MasterDataRecord,
  ) {
    if (
      existing &&
      String(existing.attributes.organizationId) !== organizationId
    )
      throw new B2bApiError(
        'مخاطب متعلق به این سازمان نیست.',
        409,
        'B2B_CONTACT_ORGANIZATION_CONFLICT',
      );
    const body = { values: { ...values, organizationId } };
    return existing
      ? masterDataApi.update('organization-contacts', existing.id, {
          ...body,
          version: existing.version,
        })
      : masterDataApi.create('organization-contacts', body);
  },
  list(query: AgencyListQuery): Promise<MasterDataListResponse> {
    const {
      role = 'AGENCY',
      sortBy = 'updatedAt',
      sortDirection = 'desc',
      ...filters
    } = query;
    return masterDataApi.list('organizations', {
      ...filters,
      organizationRole: role,
      sortBy,
      sortDirection,
    });
  },
  contacts(organizationId: string, page = 1): Promise<MasterDataListResponse> {
    return masterDataApi.list('organization-contacts', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
      organizationId,
    });
  },
  async session() {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl) throw new B2bApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(baseUrl);
    if (!session)
      throw new B2bApiError('نشست شما معتبر نیست؛ دوباره وارد شوید.', 401);
    return session.user;
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
