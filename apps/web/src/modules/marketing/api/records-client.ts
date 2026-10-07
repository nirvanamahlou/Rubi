import {
  MARKETING_RECORDS_CONTRACT_VERSION,
  type AuthenticatedActor,
  type CustomerAffairsMarketingIntakeInputV1,
  type CustomerAffairsMarketingIntakeViewV1,
  type MarketingAssetInputV1,
  type MarketingAssetKind,
  type MarketingAssetViewV1,
  type MarketingCampaignInputV1,
  type MarketingCampaignViewV1,
  type MarketingSourceCountsResponseV1,
} from '@nora/contracts';

/*
 * Campaign mutation responses participate in a multi-command client state
 * machine. A 2xx status alone cannot prove that the command's result is known;
 * validate its envelope and identity before notification or adopting the row.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.endsWith('Z') &&
      Number.isFinite(Date.parse(value)))
  );
}

function isRequiredIsoDate(value: unknown): value is string {
  return typeof value === 'string' && isIsoDate(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^(?:\d+)(?:\.\d+)?$/.test(value);
}

function sameNullableInstant(
  actual: string | null,
  expected: string | null,
): boolean {
  if (actual === null || expected === null) return actual === expected;
  return Date.parse(actual) === Date.parse(expected);
}

function validCampaignView(value: unknown): value is MarketingCampaignViewV1 {
  if (!isRecord(value)) return false;
  const requiredStrings = [
    'id',
    'branchId',
    'internalCode',
    'name',
    'campaignType',
    'objective',
    'executionCompany',
    'ownerUserId',
    'salesTarget',
    'targetCurrencyCode',
    'budgetAmount',
    'budgetCurrencyCode',
    'declaredByUserId',
  ] as const;
  if (
    value.contractVersion !== MARKETING_RECORDS_CONTRACT_VERSION ||
    !requiredStrings.every((key) => isNonEmptyString(value[key])) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !Number.isSafeInteger(value.frequencyCap) ||
    Number(value.frequencyCap) < 1 ||
    !isRequiredIsoDate(value.startsAt) ||
    !isRequiredIsoDate(value.endsAt) ||
    !isRequiredIsoDate(value.createdAt) ||
    !isRequiredIsoDate(value.updatedAt) ||
    !isRequiredIsoDate(value.declaredAt) ||
    !['DRAFT', 'ACTIVE', 'SCHEDULED', 'PAUSED', 'CANCELLED'].includes(
      String(value.status),
    ) ||
    value.externalPublicationStatus !== 'UNAVAILABLE' ||
    !isIsoDate(value.publicationRequestedAt) ||
    !isIsoDate(value.scheduledFor) ||
    !Array.isArray(value.channels) ||
    !value.channels.length ||
    !value.channels.every(isNonEmptyString) ||
    !isDecimalString(value.salesTarget) ||
    !isDecimalString(value.budgetAmount) ||
    !Array.isArray(value.spendLines) ||
    !value.spendLines.every(
      (line) =>
        isRecord(line) &&
        isNonEmptyString(line.label) &&
        isDecimalString(line.amount) &&
        isNonEmptyString(line.currencyCode),
    ) ||
    !Array.isArray(value.links) ||
    !value.links.every((link) => typeof link === 'string')
  )
    return false;

  const nullableStrings = [
    'segmentId',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmTerm',
    'utmContent',
  ] as const;
  return (
    nullableStrings.every(
      (key) => value[key] === null || typeof value[key] === 'string',
    ) &&
    (value.progressPercent === undefined ||
      isDecimalString(value.progressPercent))
  );
}

function campaignMutationResponse(
  value: unknown,
  expected: {
    id?: string;
    branchId?: string;
    minimumVersion?: number;
    status?: 'DRAFT' | 'ACTIVE' | 'SCHEDULED';
    scheduledFor?: string | null;
  },
): { data: MarketingCampaignViewV1 } {
  if (!isRecord(value) || !validCampaignView(value.data))
    throw new MarketingApiError(
      'پاسخ ثبت کمپین ناقص یا نامعتبر است؛ نتیجه درخواست باید دوباره بررسی شود.',
      200,
      'INVALID_CAMPAIGN_MUTATION_RESPONSE',
    );
  const campaign = value.data;
  if (
    (expected.id && campaign.id !== expected.id) ||
    (expected.branchId && campaign.branchId !== expected.branchId) ||
    (expected.minimumVersion !== undefined &&
      campaign.version < expected.minimumVersion) ||
    (expected.status && campaign.status !== expected.status) ||
    (expected.scheduledFor !== undefined &&
      !sameNullableInstant(campaign.scheduledFor, expected.scheduledFor))
  )
    throw new MarketingApiError(
      'پاسخ ثبت کمپین با درخواست انجام‌شده تطبیق ندارد؛ نتیجه درخواست باید دوباره بررسی شود.',
      200,
      'CAMPAIGN_MUTATION_RESPONSE_MISMATCH',
    );
  return { data: campaign };
}

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

async function campaignMutation(
  path: string,
  init: RequestInit,
  expected: {
    id?: string;
    branchId?: string;
    minimumVersion: number;
    status?: 'DRAFT' | 'ACTIVE' | 'SCHEDULED';
    scheduledFor?: string | null;
  },
): Promise<{ data: MarketingCampaignViewV1 }> {
  const result = campaignMutationResponse(
    await request<unknown>(path, init),
    expected,
  );
  notifyNotificationFeedChanged();
  return result;
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
    campaignMutation(
      '/marketing/campaigns',
      {
        method: 'POST',
        headers: mutationHeaders(branchId, key),
        body: JSON.stringify(input),
      },
      {
        ...(branchId ? { branchId } : {}),
        minimumVersion: 1,
        status: 'DRAFT',
      },
    ),
  updateCampaign: (id: string, input: MarketingCampaignInputV1, key?: string) =>
    campaignMutation(
      `/marketing/campaigns/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify(input),
      },
      {
        id,
        minimumVersion: (input.expectedVersion ?? 0) + 1,
      },
    ),
  publishCampaign: (
    id: string,
    expectedVersion: number,
    scheduledFor?: string | null,
    key?: string,
  ) =>
    campaignMutation(
      `/marketing/campaigns/${encodeURIComponent(id)}/publication`,
      {
        method: 'POST',
        headers: mutationHeaders(undefined, key),
        body: JSON.stringify({
          expectedVersion,
          scheduledFor: scheduledFor ?? null,
        }),
      },
      {
        id,
        minimumVersion: expectedVersion + 1,
        status: scheduledFor ? 'SCHEDULED' : 'ACTIVE',
        scheduledFor: scheduledFor ?? null,
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
