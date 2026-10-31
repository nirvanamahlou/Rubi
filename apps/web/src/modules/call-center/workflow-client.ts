import { callCenterRequest } from './client';
export interface Operator {
  id: string;
  displayName: string;
  position?: string | null;
  showPosition?: boolean;
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
  canEditManagement?: boolean;
  result?: string;
  customerId?: string | null;
  privateHistory: {
    at: string;
    actorId: string;
    title: string;
    reason: string;
    result?: string;
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
  requestOperators: (branch: string) =>
    callCenterRequest<{ data: Operator[] }>('/request-operators', branch),
  nextAction: (branch: string, contact: string, signal: AbortSignal) =>
    callCenterRequest<{
      data: {
        id: string;
        requestId: string;
        requestTitle: string;
        requestStatus: string;
        action: string;
        ownerName: string | null;
        dueAt: string;
        overdue?: boolean;
      } | null;
    }>(`/contacts/${contact}/next-action`, branch, { signal }),
  queue: (branch: string, view: string, page: number, signal?: AbortSignal) =>
    callCenterRequest<{
      data: {
        id: string;
        contactId: string;
        branchId: string;
        branchName: string;
        title: string;
        ownerName: string | null;
        status: string;
        priority: string;
        createdAt: string;
        dueAt?: string | null;
      }[];
      meta: {
        total: number;
        page: number;
        pageSize: number;
        counts?: Record<string, number>;
        asOf?: string;
      };
    }>(`/queue?view=${view}&page=${page}`, branch, signal ? { signal } : {}),
  link: (branch: string, callId: string, input: unknown) =>
    callCenterRequest<{ data: { id: string; ticketId: string } }>(
      `/calls/${callId}/request`,
      branch,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  operators: (branch: string) =>
    callCenterRequest<{ data: Operator[] }>('/operators', branch),
  list: (
    branch: string,
    contact: string,
    signal?: AbortSignal,
    page = 1,
    taskPage = 1,
    requestId?: string,
    openOnly = false,
  ) =>
    callCenterRequest<{
      data: RequestCase[];
      meta?: {
        total: number;
        hasMoreTasks: boolean;
        contactCallCount?: number;
      };
    }>(
      `/contacts/${contact}/requests?page=${page}&taskPage=${taskPage}${requestId ? `&requestId=${requestId}` : ''}${openOnly ? '&openOnly=true' : ''}`,
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
