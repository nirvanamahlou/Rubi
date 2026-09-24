'use client';

import type {
  LoginResponse,
  PackageBannerFormat,
  PackageListQueryV1,
  PackagePageV1,
  PackageTourCostGridV1,
  PackageTourDraftSaveV1,
  PackageTourDraftV1,
  PackageTourPublicationV1,
  PackageTourPublishV1,
  TourDepartureV1,
} from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class PackagePricingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface PackageBannerTemplateV1 {
  id: string;
  branchId: string;
  issuerLegalEntityId: string;
  code: string;
  title: string;
  format: PackageBannerFormat;
  version: number;
  width: number;
  height: number;
  templateDefinition: Readonly<Record<string, unknown>>;
  isActive: boolean;
}

async function session(): Promise<LoginResponse> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new PackagePricingApiError('نشانی API پیکربندی نشده است.', 0);
  const value = await refreshAuthenticatedSession(baseUrl);
  if (!value)
    throw new PackagePricingApiError(
      'نشست شما پایان یافته است؛ دوباره وارد حساب شوید.',
      401,
    );
  return value;
}

async function request<T>(
  path: string,
  activeSession: LoginResponse,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new PackagePricingApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/sales/pricing${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  }).catch(() => {
    throw new PackagePricingApiError(
      'ارتباط با سرور برقرار نشد؛ اتصال را بررسی و دوباره تلاش کنید.',
      0,
      'NETWORK_ERROR',
    );
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    const code = payload?.error?.code ?? payload?.code;
    const fallback =
      response.status === 403
        ? 'برای مشاهده این اطلاعات مجوز کافی ندارید.'
        : response.status === 409
          ? 'اطلاعات هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.'
          : 'دریافت اطلاعات قیمت‌گذاری ناموفق بود.';
    throw new PackagePricingApiError(
      payload?.error?.message ?? payload?.message ?? fallback,
      response.status,
      code,
    );
  }
  return response.json() as Promise<T>;
}

function queryString(query: PackageListQueryV1) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') parameters.set(key, String(value));
  return parameters.toString();
}

export const packagePricingApi = {
  session,
  list: (
    query: PackageListQueryV1,
    activeSession: LoginResponse,
  ): Promise<PackagePageV1> =>
    request(`/packages?${queryString(query)}`, activeSession),
  tours: (
    activeSession: LoginResponse,
  ): Promise<{ version: 1; data: readonly TourDepartureV1[] }> =>
    request('/tour-departures', activeSession),
  tourCosts: (
    tourDepartureId: string,
    activeSession: LoginResponse,
  ): Promise<PackageTourCostGridV1> =>
    request(
      `/tour-costs/${encodeURIComponent(tourDepartureId)}`,
      activeSession,
    ),
  tourDraft: (
    tourId: string,
    batchId: string,
    activeSession: LoginResponse,
  ): Promise<PackageTourDraftV1 | null> =>
    request(
      `/tour-drafts?tourDepartureId=${encodeURIComponent(tourId)}&batchId=${encodeURIComponent(batchId)}`,
      activeSession,
    ),
  saveTourDraft: (
    input: PackageTourDraftSaveV1,
    activeSession: LoginResponse,
  ): Promise<PackageTourDraftV1> =>
    request('/tour-drafts', activeSession, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  tourPublications: (
    tourId: string,
    batchId: string,
    activeSession: LoginResponse,
  ): Promise<readonly PackageTourPublicationV1[]> =>
    request(
      `/tour-drafts/publications?tourDepartureId=${encodeURIComponent(tourId)}&batchId=${encodeURIComponent(batchId)}`,
      activeSession,
    ),
  bannerTemplates: (
    branchId: string,
    activeSession: LoginResponse,
  ): Promise<{ version: 1; data: readonly PackageBannerTemplateV1[] }> =>
    request(
      `/banner-templates?branchId=${encodeURIComponent(branchId)}`,
      activeSession,
    ),
  publishTourDraft: (
    draftId: string,
    input: PackageTourPublishV1,
    activeSession: LoginResponse,
  ): Promise<PackageTourPublicationV1> =>
    request(
      `/tour-drafts/${encodeURIComponent(draftId)}/publish`,
      activeSession,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
