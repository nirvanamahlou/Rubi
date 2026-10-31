import { callCenterRequest } from './client';
import type { CallNote } from './client';
import type { Call } from './model';
export interface SearchFilters {
  query: string;
  scope: string;
  teamId: string;
  direction: string;
  outcome: string;
  source: string;
  unit: string;
  agentId: string;
  requestStatus: string;
  followUp: string;
  origin: string;
  incomplete: string;
  from: string;
  to: string;
}
export const emptySearch: SearchFilters = {
  query: '',
  scope: 'LATEST',
  teamId: '',
  direction: '',
  outcome: '',
  source: '',
  unit: '',
  agentId: '',
  requestStatus: '',
  followUp: '',
  origin: '',
  incomplete: '',
  from: '',
  to: '',
};
export interface ContactSummary {
  id: string;
  latest: Omit<Call, 'note' | 'recordings'>;
  callCount: number;
}
export interface SearchPage {
  data: ContactSummary[];
  meta: {
    branchId: string;
    total: number;
    page: number;
    pageSize: number;
    revision: string;
    asOf: string;
  };
}
export interface CallKpis {
  data: {
    today: number;
    week: number;
    withoutOutcome: number;
    needsFollowUp: number;
  };
  meta: {
    branchId: string;
    asOf: string;
    timezone: string;
    todayFrom: string;
    weekFrom: string;
  };
}
export interface Report {
  data: {
    calls: number;
    contacts: number;
    incomplete: number;
    unindexed: number;
    groups: {
      direction: string;
      outcome: string | null;
      origin: string | null;
      count: number;
    }[];
    sources: { label: string; count: number }[];
    registrations: { actorId: string; count: number }[];
    topFollowUps?: { contactId: string; name: string; count: number }[];
    requests: { status: string; count: number }[];
    tasks: {
      activity: { actorId: string | null; role: string; count: number }[];
      open: number;
      today: number;
      overdue: number;
      completed: number;
      onTime: number;
      onTimeRate: number | null;
    };
  };
  meta: { from: string; to: string; asOf: string; timezone: string };
}
export function searchBody(filters: SearchFilters) {
  return Object.fromEntries(
    Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k, v]) => [
        k,
        k === 'from' || k === 'to'
          ? new Date(`${v}T00:00:00+03:30`).toISOString()
          : v,
      ]),
  );
}
export const readApi = {
  withoutOutcome: (
    branch: string,
    page: number,
    revision: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{
      data: { call: ContactSummary['latest']; callCount: number }[];
      meta: {
        total: number;
        page: number;
        pageSize: number;
        revision: string;
        asOf: string;
      };
    }>('/without-outcome', branch, {
      method: 'POST',
      body: JSON.stringify({
        page,
        pageSize: 20,
        ...(revision ? { revision } : {}),
      }),
      signal,
    }),
  todayCalls: (
    branch: string,
    page: number,
    revision: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{
      data: { call: ContactSummary['latest']; callCount: number }[];
      meta: {
        total: number;
        page: number;
        pageSize: number;
        revision: string;
        asOf: string;
      };
    }>('/today-calls', branch, {
      method: 'POST',
      body: JSON.stringify({
        page,
        pageSize: 20,
        ...(revision ? { revision } : {}),
      }),
      signal,
    }),
  weekCalls: (
    branch: string,
    page: number,
    revision: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{
      data: { call: ContactSummary['latest']; callCount: number }[];
      meta: {
        total: number;
        page: number;
        pageSize: number;
        revision: string;
        asOf: string;
      };
    }>('/week-calls', branch, {
      method: 'POST',
      body: JSON.stringify({
        page,
        pageSize: 20,
        ...(revision ? { revision } : {}),
      }),
      signal,
    }),
  missedCallbacks: (
    branch: string,
    page: number,
    revision: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{
      data: { call: ContactSummary['latest']; callCount: number }[];
      meta: {
        total: number;
        page: number;
        pageSize: number;
        revision: string;
        asOf: string;
      };
    }>('/missed-callbacks', branch, {
      method: 'POST',
      body: JSON.stringify({
        page,
        pageSize: 20,
        ...(revision ? { revision } : {}),
      }),
      signal,
    }),
  kpis: (branch: string, signal: AbortSignal) =>
    callCenterRequest<CallKpis>('/kpis', branch, { signal }),
  branches: (branch: string) =>
    callCenterRequest<{ data: { id: string; name: string }[] }>(
      '/branches',
      branch,
    ),
  teams: (branch: string) =>
    callCenterRequest<{ units: { id: string; name: string }[] }>(
      '/teams',
      branch,
    ),
  search: (
    branch: string,
    filters: SearchFilters,
    page: number,
    revision: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<SearchPage>('/search', branch, {
      method: 'POST',
      body: JSON.stringify({
        ...searchBody(filters),
        page,
        pageSize: 20,
        ...(revision ? { revision } : {}),
      }),
      signal,
    }),
  report: (branch: string, filters: SearchFilters, signal: AbortSignal) =>
    callCenterRequest<Report>('/report', branch, {
      method: 'POST',
      body: JSON.stringify(searchBody(filters)),
      signal,
    }),
  calls: (
    branch: string,
    id: string,
    after: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{ data: Call[]; meta: { next: string | null } }>(
      `/contacts/${id}/calls?pageSize=20${after ? `&after=${after}` : ''}`,
      branch,
      { signal },
    ),
  notes: (
    branch: string,
    id: string,
    after: string | undefined,
    signal: AbortSignal,
  ) =>
    callCenterRequest<{ data: CallNote[]; meta: { next: string | null } }>(
      `/contacts/${id}/notes?pageSize=20${after ? `&after=${after}` : ''}`,
      branch,
      { signal },
    ),
};
