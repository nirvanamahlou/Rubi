import { describe, expect, it } from 'vitest';
import { reportPdfRows } from './customer-affairs-report-pdf';

describe('Customer Affairs PDF report data', () => {
  it('includes every report distribution and real totals', () => {
    const rows = reportPdfRows({
      generatedAt: '2026-09-29T09:00:00Z',
      leadStages: [{ stage: 'NEW', _count: { _all: 2 } }],
      ticketStatuses: [{ status: 'CLOSED', _count: { _all: 3 } }],
      ticketPriorities: [{ priority: 'HIGH', _count: { _all: 1 } }],
      ticketCategories: [{ category: 'COMPLAINT', _count: { _all: 1 } }],
      satisfaction: { average: 4, count: 2 },
      correctiveActions: [{ status: 'DONE', _count: { _all: 1 } }],
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'درخواست‌های مشتریان', value: '2' }),
        expect.objectContaining({ label: 'تیکت‌های پشتیبانی', value: '3' }),
        expect.objectContaining({ label: 'COMPLAINT', value: '1' }),
        expect.objectContaining({ label: 'DONE', value: '1' }),
      ]),
    );
  });
});
