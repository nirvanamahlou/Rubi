import type {
  CustomerAffairsDashboard,
  CustomerAffairsLeadInput,
  CustomerAffairsLeadView,
  CustomerAffairsListResponse,
  CustomerAffairsTicketInput,
  CustomerAffairsTicketView,
  CustomerAffairsTimelineInput,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';

export class CustomerAffairsApiError extends Error {
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
  if (!base)
    throw new CustomerAffairsApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${base}/customer-affairs${path}`, {
    credentials: 'include',
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
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new CustomerAffairsApiError(
      body?.error?.message ?? body?.message ?? 'عملیات امور مشتریان انجام نشد.',
      response.status,
      body?.error?.code ?? body?.code,
    );
  }
  return response.json() as Promise<T>;
}

function query(search: string, status?: string) {
  const params = new URLSearchParams({ page: '1', pageSize: '50' });
  if (search.trim()) params.set('search', search.trim());
  if (status && status !== 'ALL') params.set('status', status);
  return params.toString();
}

export const customerAffairsApi = {
  dashboard: () => request<{ data: CustomerAffairsDashboard }>('/dashboard'),
  leads: (search = '') =>
    request<CustomerAffairsListResponse<CustomerAffairsLeadView>>(
      `/leads?${query(search)}`,
    ),
  lead: (id: string) =>
    request<{
      data: CustomerAffairsLeadView & {
        timeline: CustomerAffairsTimelineInput[];
      };
    }>(`/leads/${id}`),
  createLead: (input: CustomerAffairsLeadInput, branchId?: string) =>
    request<{ data: CustomerAffairsLeadView }>('/leads', {
      method: 'POST',
      headers: {
        'idempotency-key': crypto.randomUUID(),
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify(input),
    }),
  addLeadTimeline: (id: string, input: CustomerAffairsTimelineInput) =>
    request(`/leads/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  qualify: (id: string, version: number) =>
    request(`/leads/${id}/qualification`, {
      method: 'POST',
      body: JSON.stringify({
        travelNeedConfirmed: true,
        destinationKnown: true,
        timingKnown: true,
        budgetDiscussed: true,
        decisionMakerReachable: true,
        contactable: true,
        expectedVersion: version,
      }),
    }),
  proposeHandoff: (id: string, version: number) =>
    request(`/leads/${id}/handoffs`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ expectedVersion: version }),
    }),
  tickets: (search = '', status = 'ALL') =>
    request<CustomerAffairsListResponse<CustomerAffairsTicketView>>(
      `/tickets?${query(search, status)}`,
    ),
  ticket: (id: string) =>
    request<{
      data: CustomerAffairsTicketView & {
        timeline: CustomerAffairsTimelineInput[];
        referrals: Array<Record<string, unknown>>;
        correctiveActions: Array<Record<string, unknown>>;
      };
    }>(`/tickets/${id}`),
  createTicket: (input: CustomerAffairsTicketInput, branchId?: string) =>
    request<{ data: CustomerAffairsTicketView }>('/tickets', {
      method: 'POST',
      headers: {
        'idempotency-key': crypto.randomUUID(),
        ...(branchId ? { 'x-branch-id': branchId } : {}),
      },
      body: JSON.stringify(input),
    }),
  addTicketTimeline: (id: string, input: CustomerAffairsTimelineInput) =>
    request(`/tickets/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  transitionTicket: (
    id: string,
    status:
      | 'TRIAGED'
      | 'IN_PROGRESS'
      | 'WAITING_CUSTOMER'
      | 'WAITING_EXTERNAL'
      | 'CANCELLED',
    expectedVersion: number,
    reason: string,
  ) =>
    request(`/tickets/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status, expectedVersion, reason }),
    }),
  refer: (id: string, input: Record<string, unknown>) =>
    request(`/tickets/${id}/referrals`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(input),
    }),
  action: (
    id: string,
    action: 'escalate' | 'resolve' | 'close' | 'reopen',
    input: Record<string, unknown>,
  ) =>
    request(`/tickets/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createSatisfactionInvitation: (id: string) =>
    request<{ data: { token: string; expiresAt: string } }>(
      `/tickets/${id}/satisfaction-invitations`,
      { method: 'POST' },
    ),
  submitSatisfaction: (
    token: string,
    input: { score: number; comment?: string },
  ) =>
    request<{ data: { score: number; submittedAt: string } }>(
      `/public/satisfaction/${encodeURIComponent(token)}`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  workbenchReferrals: () =>
    request<{
      data: Array<{
        id: string;
        ticketId: string;
        trackingNumber: string;
        ticketSubject: string;
        title: string;
        destinationModule: string;
        destinationUnit: string | null;
        status: string;
        dueAt: string;
      }>;
    }>('/workbench/referrals'),
  respondReferral: (
    id: string,
    status: 'IN_PROGRESS' | 'DONE',
    responseSummary: string,
  ) =>
    request(`/referrals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, responseSummary }),
    }),
};
