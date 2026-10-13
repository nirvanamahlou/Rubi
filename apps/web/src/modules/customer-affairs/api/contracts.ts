export const CUSTOMER_AFFAIRS_UI_VERSION = 'customer-affairs.ui.v1-preview';
export const CUSTOMER_AFFAIRS_PREVIEW_NOTICE =
  'داده‌ها کاملاً ساختگی‌اند؛ Persistence و تبدیل بین‌ماژولی هنوز فعال نیست.';

export type CustomerAffairsPreviewState =
  'preview' | 'loading' | 'empty' | 'error' | 'forbidden';

export interface CustomerAffairsListQuery {
  search: string;
  status: string;
  priority: string;
  overdueOnly: boolean;
  sortBy: 'updatedAt' | 'nextActionAt' | 'priority';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const customerAffairsLocalPermissions = [
  'customer_affairs.lead.read',
  'customer_affairs.lead.create',
  'customer_affairs.lead.update',
  'customer_affairs.lead.qualify',
  'customer_affairs.lead.handoff.propose',
  'customer_affairs.ticket.read',
  'customer_affairs.ticket.create',
  'customer_affairs.ticket.update',
  'customer_affairs.ticket.assign',
  'customer_affairs.ticket.escalate',
  'customer_affairs.ticket.close',
  'customer_affairs.ticket.reopen',
  'customer_affairs.sla.manage',
  'customer_affairs.satisfaction.read',
  'customer_affairs.satisfaction.record',
] as const;

export function normalizeCustomerAffairsQuery(
  input: Partial<CustomerAffairsListQuery>,
): CustomerAffairsListQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    status: input.status?.trim() || 'ALL',
    priority: input.priority?.trim() || 'ALL',
    overdueOnly: input.overdueOnly ?? false,
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection ?? 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(50, Math.max(2, Math.trunc(input.pageSize ?? 2))),
  };
}
