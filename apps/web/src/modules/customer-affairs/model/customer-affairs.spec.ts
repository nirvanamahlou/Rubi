import { describe, expect, it } from 'vitest';

import {
  customerAffairsLocalPermissions,
  normalizeCustomerAffairsQuery,
} from '../api/contracts';
import {
  filterPreviewRecords,
  paginatePreview,
  previewLeads,
  previewStates,
  previewTickets,
  validateCustomerAffairsDraft,
} from './customer-affairs';

describe('customer affairs frontend foundation', () => {
  it('covers preview, loading, empty, error and forbidden states', () => {
    expect(previewStates.map(([state]) => state)).toEqual([
      'preview',
      'loading',
      'empty',
      'error',
      'forbidden',
    ]);
  });

  it('uses only synthetic ids and contract references', () => {
    expect(
      previewLeads.every((lead) => lead.id.startsWith('preview-lead-')),
    ).toBe(true);
    expect(
      previewTickets.every(
        (ticket) =>
          ticket.id.startsWith('preview-ticket-') &&
          ticket.customerReference.startsWith('preview-customer-ref-') &&
          ticket.salesReference.startsWith('preview-sales-ref-'),
      ),
    ).toBe(true);
  });

  it('normalizes search, pagination and page-size limits', () => {
    expect(
      normalizeCustomerAffairsQuery({
        search: '  درخواست نمایشی  ',
        page: -2,
        pageSize: 500,
      }),
    ).toMatchObject({ search: 'درخواست نمایشی', page: 1, pageSize: 50 });
  });

  it('filters, sorts and paginates lead and ticket previews', () => {
    const leadQuery = normalizeCustomerAffairsQuery({
      overdueOnly: true,
      sortBy: 'priority',
      sortDirection: 'desc',
    });
    expect(filterPreviewRecords(previewLeads, leadQuery)).toHaveLength(2);
    const ticketQuery = normalizeCustomerAffairsQuery({ status: 'RESOLVED' });
    expect(filterPreviewRecords(previewTickets, ticketQuery)).toHaveLength(1);
    expect(paginatePreview(previewLeads, 1, 2)).toHaveLength(2);
  });

  it('validates create/edit preview forms without persistence', () => {
    expect(
      validateCustomerAffairsDraft({
        title: '',
        details: '',
        priority: 'NORMAL',
        assignee: '',
        nextActionAt: '',
      }).valid,
    ).toBe(false);
    expect(
      validateCustomerAffairsDraft({
        title: 'درخواست نمونه',
        details: 'شرح کاملاً نمایشی درخواست',
        priority: 'HIGH',
        assignee: 'کارشناس نمونه',
        nextActionAt: '2026-08-25T08:00',
      }).valid,
    ).toBe(true);
  });

  it('publishes an explicit local deny-by-default permission proposal', () => {
    expect(customerAffairsLocalPermissions).toHaveLength(13);
    expect(customerAffairsLocalPermissions).toContain(
      'customer_affairs.lead.handoff.propose',
    );
    expect(customerAffairsLocalPermissions).toContain(
      'customer_affairs.ticket.escalate',
    );
  });
});
