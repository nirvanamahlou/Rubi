import type {
  AuthenticatedActor,
  CustomerAffairsMarketingIntakeInputV1,
  CustomerAffairsMarketingIntakeViewV1,
  MarketingAssetInputV1,
  MarketingAssetKind,
  MarketingAssetViewV1,
  MarketingCampaignInputV1,
  MarketingCampaignViewV1,
  MarketingSourceCountsResponseV1,
} from '@nora/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';
import { notifyNotificationFeedChanged } from '@/modules/notifications/api/client';

export class MarketingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new MarketingApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${base}${path}`, {
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
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string | string[];
      error?: { code?: string; message?: string };
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('، ')
      : (body?.error?.message ?? body?.message ?? 'عملیات مارکتینگ انجام نشد.');
    throw new MarketingApiError(
      message,
      response.status,
      body?.error?.code ?? body?.code,
    );
  }
  return response.json() as Promise<T>;
}

function mutationHeaders(branchId?: string, key = crypto.randomUUID()) {
  return {
    'idempotency-key': key,
    'x-request-id': crypto.randomUUID(),
    ...(branchId ? { 'x-branch-id': branchId } : {}),
  };
}

async function mutation<T>(path: string, init: RequestInit): Promise<T> {
  const response = await request<T>(path, init);
  notifyNotificationFeedChanged();
  return response;
}

export const marketingApi = {
  access: () => request<AuthenticatedActor>('/iam/auth/access'),
  campaigns: () =>
    request<{ data: MarketingCampaignViewV1[] }>('/marketing/campaigns'),
  createCampaign: (
    input: MarketingCampaignInputV1,
    branchId?: string,
    key?: string,
  ) =>
    mutation<{ data: MarketingCampaignViewV1 }>('/marketing/campaigns', {
      method: 'POST',
      headers: mutationHeaders(branchId, key),
      body: JSON.stringify(input),
    }),
  updateCampaign: (id: string, input: MarketingCampaignInputV1, key?: string) =>
    mutation<{ data: MarketingCampaignViewV1 }>(
      `/marketing/campaigns/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify(input),
      },
    ),
  publishCampaign: (
    id: string,
    expectedVersion: number,
    scheduledFor?: string | null,
    key?: string,
  ) =>
    mutation<{ data: MarketingCampaignViewV1 }>(
      `/marketing/campaigns/${encodeURIComponent(id)}/publication`,
      {
        method: 'POST',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify({
          expectedVersion,
          scheduledFor: scheduledFor ?? null,
        }),
      },
    ),
  assets: (kind?: MarketingAssetKind) =>
    request<{ data: MarketingAssetViewV1[] }>(
      `/marketing/assets${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`,
    ),
  saveAsset: (
    input: MarketingAssetInputV1,
    options: { id?: string; branchId?: string; key?: string } = {},
  ) =>
    mutation<{ data: MarketingAssetViewV1 }>(
      options.id
        ? `/marketing/assets/${encodeURIComponent(options.id)}`
        : '/marketing/assets',
      {
        method: options.id ? 'PATCH' : 'POST',
        headers: mutationHeaders(options.branchId, options.key),
        body: JSON.stringify(input),
      },
    ),
  deleteAsset: (id: string, expectedVersion: number, key?: string) =>
    mutation<{ data: MarketingAssetViewV1 }>(
      `/marketing/assets/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify({ expectedVersion }),
      },
    ),
  intakes: () =>
    request<{ data: CustomerAffairsMarketingIntakeViewV1[] }>(
      '/customer-affairs/marketing-intakes',
    ),
  createIntake: (
    input: CustomerAffairsMarketingIntakeInputV1,
    branchId?: string,
    key?: string,
  ) =>
    mutation<{ data: CustomerAffairsMarketingIntakeViewV1 }>(
      '/customer-affairs/marketing-intakes',
      {
        method: 'POST',
        headers: mutationHeaders(branchId, key),
        body: JSON.stringify(input),
      },
    ),
  scoreIntake: (
    id: string,
    ruleIds: string[],
    expectedVersion: number,
    key?: string,
  ) =>
    mutation<{ data: CustomerAffairsMarketingIntakeViewV1 }>(
      `/customer-affairs/marketing-intakes/${encodeURIComponent(id)}/score`,
      {
        method: 'POST',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify({ ruleIds, expectedVersion }),
      },
    ),
  sourceCounts: (startsAt: string, endsAt: string) =>
    request<MarketingSourceCountsResponseV1>(
      `/customer-affairs/marketing-intakes/source-counts?${new URLSearchParams({ startsAt, endsAt })}`,
    ),
};
