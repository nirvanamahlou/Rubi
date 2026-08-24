import { describe, expect, it } from 'vitest';

import {
  createPaginatedResult,
  normalizeLeadListQuery,
  normalizeTicketListQuery,
  type TicketListQuery,
} from './customer-affairs.contracts';

describe('customer affairs module-local list contracts', () => {
  it('normalizes page and pageSize into server-safe bounds', () => {
    expect(
      normalizeTicketListQuery({
        search: '  واچر نمایشی  ',
        page: -4,
        pageSize: 500,
      }),
    ).toMatchObject({
      search: 'واچر نمایشی',
      page: 1,
      pageSize: 100,
    });

    expect(
      normalizeTicketListQuery({
        page: Number.NaN,
        pageSize: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({ page: 1, pageSize: 25 });
  });

  it('normalizes lead pagination and rejects unknown sort fields', () => {
    expect(
      normalizeLeadListQuery({
        search: '  Lead نمونه  ',
        page: 0,
        pageSize: 500,
        sortBy: 'title' as never,
      }),
    ).toMatchObject({
      search: 'Lead نمونه',
      page: 1,
      pageSize: 100,
      sortBy: 'updatedAt',
    });
  });
  it('preserves the allowed ticket filters for future server-side queries', () => {
    expect(
      normalizeTicketListQuery({
        status: 'IN_PROGRESS',
        category: 'REFUND',
        priority: 'CRITICAL',
        assigneeReference: '  assignee-ref-01  ',
        slaState: 'AT_RISK',
        overdueOnly: true,
        sortBy: 'resolutionDueAt',
        sortDirection: 'asc',
      }),
    ).toMatchObject({
      status: 'IN_PROGRESS',
      category: 'REFUND',
      priority: 'CRITICAL',
      assigneeReference: 'assignee-ref-01',
      slaState: 'AT_RISK',
      overdueOnly: true,
      sortBy: 'resolutionDueAt',
      sortDirection: 'asc',
    });
  });

  it('does not accept a ticket sort field outside the allowlist', () => {
    const query = normalizeTicketListQuery({
      sortBy: 'subject' as TicketListQuery['sortBy'],
    });

    expect(query.sortBy).toBe('updatedAt');
  });

  it('returns stable pagination metadata', () => {
    expect(createPaginatedResult(['ticket-1', 'ticket-2'], 51, 2, 25)).toEqual({
      data: ['ticket-1', 'ticket-2'],
      total: 51,
      page: 2,
      pageSize: 25,
      totalPages: 3,
    });
    expect(createPaginatedResult([], 0, 1, 25).totalPages).toBe(0);
  });
});
