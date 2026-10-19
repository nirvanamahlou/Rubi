import { callCenterRequest } from './client';
export interface Operator {
  id: string;
  displayName: string;
}
export interface FollowUp {
  ownerName?: string;
  id: string;
  version: number;
  ownerId: string;
  dueAt: string;
  action: string;
  priority: string;
  status: string;
  result: string;
  history: {
    at: string;
    actorId: string;
    ownerId: string;
    dueAt: string;
    status: string;
    version: number;
  }[];
}
export interface RequestCase {
  privateHistory: {
    at: string;
    actorId: string;
    title: string;
    reason: string;
    status: string;
    ownerId: string | null;
    version: number;
  }[];
  id: string;
  version: number;
  title: string;
  reason: string;
  status: string;
  priority: string;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
  followUps: FollowUp[];
  history: {
    id: string;
    action: string;
    at: string;
    actorId: string | null;
    version: number;
    changes: unknown;
  }[];
}
export const workflowApi = {
  queue: (branch: string, view: string, page: number, signal?: AbortSignal) =>
    callCenterRequest<{
      data: {
        id: string;
        contactId: string;
        title: string;
        ownerName: string | null;
        status: string;
      }[];
      meta: { total: number; page: number; pageSize: number };
    }>(`/queue?view=${view}&page=${page}`, branch, signal ? { signal } : {}),
  link: (branch: string, callId: string, input: unknown) =>
    callCenterRequest<{ data: { id: string; ticketId: string } }>(
      `/calls/${callId}/request`,
      branch,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  operators: (branch: string) =>
    callCenterRequest<{ data: Operator[] }>('/operators', branch),
  list: (branch: string, contact: string, signal?: AbortSignal) =>
    callCenterRequest<{ data: RequestCase[] }>(
      `/contacts/${contact}/requests`,
      branch,
      signal ? { signal } : {},
    ),
  saveRequest: (branch: string, contact: string, input: unknown) =>
    callCenterRequest<{ data: RequestCase[] }>(
      `/contacts/${contact}/requests`,
      branch,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  saveFollowUp: (branch: string, ticket: string, input: unknown) =>
    callCenterRequest<{ data: RequestCase[] }>(
      `/requests/${ticket}/follow-ups`,
      branch,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
