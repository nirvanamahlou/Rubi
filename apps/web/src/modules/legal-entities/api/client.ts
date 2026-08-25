import type {
  LegalEntityContext,
  LegalEntityDetail,
  LegalEntitySelection,
  LegalEntitySummary,
  LegalEntityUpdateRequest,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';

export class LegalEntitiesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new LegalEntitiesApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/legal-entities${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new LegalEntitiesApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'عملیات شرکت صادرکننده ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

export interface LegalEntitiesListMeta {
  canAggregate: boolean;
  canManage: boolean;
  canManageBranding: boolean;
  canReadAudit: boolean;
}

export interface LegalEntityAuditItem {
  id: string;
  actorUserId: string;
  action: string;
  outcome: string;
  reason: string | null;
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  occurredAt: string;
}

export const legalEntitiesApi = {
  selectable: () =>
    request<{ data: LegalEntitySummary[]; meta: { canAggregate: boolean } }>(
      '/selectable',
    ),
  current: () => request<{ data: LegalEntityContext }>('/context'),
  switch(selection: LegalEntitySelection, expectedVersion?: number) {
    return request<{ data: LegalEntityContext }>('/context', {
      method: 'PATCH',
      body: JSON.stringify({ selection, expectedVersion }),
    });
  },
  list: () =>
    request<{ data: LegalEntityDetail[]; meta: LegalEntitiesListMeta }>(''),
  update(id: string, input: LegalEntityUpdateRequest) {
    return request<{ data: LegalEntityDetail }>(`/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  status(id: string, status: 'active' | 'inactive', expectedVersion: number) {
    return request<{ data: LegalEntityDetail }>(
      `/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, expectedVersion, confirm: true }),
      },
    );
  },
  audit(id: string) {
    return request<{ data: LegalEntityAuditItem[] }>(
      `/${encodeURIComponent(id)}/audit`,
    );
  },
};
