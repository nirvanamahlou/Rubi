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

export interface AffairsListOptions {
  createdFrom?: string;
  createdTo?: string;
  sourceSite?: string;
  page?: number;
  pageSize?: number;
  stage?: string;
  priority?: string;
  overdueOnly?: boolean;
}

export interface AffairsReport {
  generatedAt: string;
  leadStages: Array<{ stage: string; _count: { _all: number } }>;
  ticketStatuses: Array<{ status: string; _count: { _all: number } }>;
  satisfaction: { average: number | null; count: number };
  correctiveActions: Array<{ status: string; _count: { _all: number } }>;
}

function query(
  search: string,
  status?: string,
  options: AffairsListOptions = {},
) {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 50),
  });
  const boundary = (value: string, nextDay = false) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error('تاریخ فیلتر معتبر نیست.');
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(date.getTime()))
      throw new Error('تاریخ فیلتر معتبر نیست.');
    if (nextDay) date.setDate(date.getDate() + 1);
    return date.toISOString();
  };
  if (options.createdFrom)
    params.set('createdFrom', boundary(options.createdFrom));
  if (options.createdTo)
    params.set('createdBefore', boundary(options.createdTo, true));
  if (search.trim()) params.set('search', search.trim());
  if (status && status !== 'ALL') params.set('status', status);
  if (options.stage && options.stage !== 'ALL')
    params.set('stage', options.stage);
  if (options.priority && options.priority !== 'ALL')
    params.set('priority', options.priority);
  if (options.overdueOnly) params.set('overdueOnly', 'true');
  if (options.sourceSite && options.sourceSite !== 'ALL')
    params.set('sourceSite', options.sourceSite);
  return params.toString();
}

export const customerAffairsApi = {
  createWorkbenchRequest: (
    input: CustomerAffairsTicketInput,
    branchId: string,
  ) =>
    request<{ data: CustomerAffairsTicketView }>('/workbench/requests', {
      method: 'POST',
      headers: {
        'idempotency-key': crypto.randomUUID(),
        'x-branch-id': branchId,
      },
      body: JSON.stringify(input),
    }),
  workbenchRequests: () =>
    request<{
      data: Array<{
        id: string;
        trackingNumber: string;
        subject: string;
        destinationUnit: string | null;
        status: string;
        priority: string;
        nextActionAt: string;
        updatedAt: string;
      }>;
    }>('/workbench/requests'),
  sendSms: (
    id: string,
    input: { mobile: string; message: string },
    key: string,
  ) =>
    request<{ data: { id: string; status: string; replay: boolean } }>(
      `/tickets/${encodeURIComponent(id)}/sms`,
      {
        method: 'POST',
        headers: { 'idempotency-key': key },
        body: JSON.stringify(input),
      },
    ),
  convertCustomer: (
    id: string,
    input: {
      firstName: string;
      lastName: string;
      nationalId: string;
      expectedVersion: number;
    },
  ) =>
    request(`/leads/${encodeURIComponent(id)}/customer`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  respondHandoff: (
    id: string,
    input: { status: string; reason: string; salesContractId?: string },
  ) =>
    request(`/handoffs/${encodeURIComponent(id)}/respond`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateFollowup: (
    record: CustomerAffairsLeadView | CustomerAffairsTicketView,
    nextAction: string,
    nextActionAt: string,
    changes: Record<string, unknown> = {},
  ) => {
    const lead = 'stage' in record;
    const keys = lead
      ? [
          'title',
          'sourceReference',
          'inboundChannel',
          'contactOccurredAt',
          'travelNeed',
          'originReference',
          'destinationReference',
          'travelStart',
          'travelEnd',
          'datePrecision',
          'dateFlexibility',
          'passengerCount',
          'passengerComposition',
          'requestedServices',
          'budget',
          'specialPreferences',
          'contactFingerprint',
          'customerId',
          'priority',
          'assigneeUserId',
          'queueCode',
        ]
      : [
          'subject',
          'description',
          'channel',
          'contactOccurredAt',
          'category',
          'serviceType',
          'impact',
          'urgency',
          'priority',
          'customerId',
          'customerOwnerUserId',
          'executionOwnerUserId',
          'executionUnit',
          'references',
        ];
    const input = Object.fromEntries(
      keys
        .filter((key) => key in record || key in changes)
        .map((key) => [
          key,
          Object.prototype.hasOwnProperty.call(changes, key)
            ? changes[key]
            : (record as unknown as Record<string, unknown>)[key],
        ]),
    );
    return request(`/${lead ? 'leads' : 'tickets'}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...input,
        nextAction,
        nextActionAt,
        expectedVersion: record.version,
      }),
    });
  },
  transitionLead: (
    id: string,
    input: {
      stage: string;
      reason: string;
      lostReason?: string;
      expectedVersion: number;
    },
  ) =>
    request(`/leads/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCorrectiveAction: (
    id: string,
    input: {
      status: string;
      result: string;
      effectivenessReview: string;
      expectedVersion: number;
    },
  ) =>
    request(`/corrective-actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  dashboard: () => request<{ data: CustomerAffairsDashboard }>('/dashboard'),
  report: () => request<{ data: AffairsReport }>('/reports/summary'),
  leads: (search = '', options: AffairsListOptions = {}) =>
    request<CustomerAffairsListResponse<CustomerAffairsLeadView>>(
      `/leads?${query(search, undefined, options)}`,
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
  qualify: (
    id: string,
    version: number,
    assessment: {
      travelNeedConfirmed: boolean;
      destinationKnown: boolean;
      timingKnown: boolean;
      budgetDiscussed: boolean;
      decisionMakerReachable: boolean;
      contactable: boolean;
      conversionProbability?: number;
    },
  ) =>
    request(`/leads/${id}/qualification`, {
      method: 'POST',
      body: JSON.stringify({
        ...assessment,
        expectedVersion: version,
      }),
    }),
  proposeHandoff: (id: string, version: number) =>
    request(`/leads/${id}/handoffs`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ expectedVersion: version }),
    }),
  tickets: (search = '', status = 'ALL', options: AffairsListOptions = {}) =>
    request<CustomerAffairsListResponse<CustomerAffairsTicketView>>(
      `/tickets?${query(search, status, options)}`,
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
