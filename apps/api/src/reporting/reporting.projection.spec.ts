import { Prisma } from '@nora/database';
import { describe, expect, it } from 'vitest';

import { buildTravelReportResult } from './reporting.projection';
import type { ReportingFactRow } from './reporting.repository';

function fact(overrides: Partial<ReportingFactRow> = {}): ReportingFactRow {
  return {
    id: 'fact-1',
    orderNumber: 'TR-1001',
    occurredAt: new Date('2026-09-10T08:00:00Z'),
    legalEntityCode: 'NIYAYESH',
    legalEntityName: 'نیایش سیر سحر',
    branchId: 'branch-1',
    branchName: 'شعبه مرکزی',
    ownerName: 'کارشناس دمو',
    siteCode: 'وب‌سایت اول',
    salesChannel: 'WEBSITE_1',
    serviceType: 'FLIGHT',
    customerType: 'AGENCY',
    customerName: 'آژانس نمونه',
    agencyName: 'آژانس نمونه',
    leadSource: 'جست‌وجوی اینترنتی',
    providerName: 'سامانه پرواز نمونه',
    airlineName: 'هواپیمایی نمونه',
    originCity: 'تهران',
    destinationCity: 'شیراز',
    routeLabel: 'تهران–شیراز',
    orderStatus: 'CONFIRMED',
    reservationStatus: 'CONFIRMED',
    issueStatus: 'ISSUED',
    paymentStatus: 'PAID',
    pnrCode: 'DEMO12',
    passengerCount: 3,
    segmentCount: 4,
    ticketCount: 3,
    currencyCode: 'IRR',
    salesAmount: new Prisma.Decimal(12_000_000),
    purchaseAmount: new Prisma.Decimal(9_000_000),
    commissionAmount: new Prisma.Decimal(500_000),
    refundAmount: new Prisma.Decimal(0),
    settledAmount: new Prisma.Decimal(12_000_000),
    dataAsOf: new Date('2026-09-10T09:00:00Z'),
    ...overrides,
  };
}

describe('travel reporting approved projection', () => {
  it('keeps cancelled pipeline rows separate without adding them or drafts to confirmed sales totals', () => {
    const input = {
      code: 'sales_contract_pipeline',
      query: {
        filters: {},
        page: 1,
        pageSize: 1,
        timezone: 'Asia/Tehran' as const,
      },
      now: new Date(),
      facts: [
        fact({ id: 'active', salesAmount: new Prisma.Decimal(100) }),
        fact({
          id: 'cancelled',
          orderNumber: 'cancelled',
          orderStatus: 'CANCELLED',
          salesAmount: new Prisma.Decimal(900),
        }),
        fact({
          id: 'draft',
          orderNumber: 'draft',
          orderStatus: 'DRAFT',
          salesAmount: new Prisma.Decimal(50),
        }),
      ],
    };
    const preview = buildTravelReportResult(input);
    const exported = buildTravelReportResult({
      ...input,
      includeAllRows: true,
    });
    expect(
      exported.rows.some(
        (row) =>
          row.primaryDimension === 'CANCELLED' && row.salesAmount === '900',
      ),
    ).toBe(true);
    expect(exported.totalsByCurrency[0]?.salesAmount).toBe('100');
    expect(preview.totalsByCurrency).toEqual(exported.totalsByCurrency);
    for (const code of [
      'sales_by_organization',
      'sales_by_service_route',
      'route_passengers',
      'contract_service_profit',
      'agency_performance',
      'lead_to_order_conversion',
    ]) {
      const result = buildTravelReportResult({
        ...input,
        code,
        facts: input.facts.slice(0, 2),
        includeAllRows: true,
      });
      expect(result.totalsByCurrency[0]?.salesAmount).toBe('100');
    }
    const cancelledOnly = buildTravelReportResult({
      ...input,
      facts: [input.facts[1]!],
    });
    expect(cancelledOnly.total).toBe(1);
    expect(cancelledOnly.totalsByCurrency).toEqual([]);
  });
  it('excludes issued, unpaid, cancelled and unknown issuance before preview/export reconciliation', () => {
    const input = {
      code: 'paid_not_issued',
      query: {
        filters: {},
        page: 1,
        pageSize: 1,
        timezone: 'Asia/Tehran' as const,
      },
      facts: [
        fact({
          id: 'pending-paid',
          issueStatus: 'PENDING',
          salesAmount: new Prisma.Decimal(100),
        }),
        fact({
          id: 'failed-paid',
          issueStatus: 'FAILED',
          providerName: 'تأمین‌کننده دوم',
          salesAmount: new Prisma.Decimal(200),
        }),
        fact(),
        fact({ issueStatus: 'PENDING', paymentStatus: 'UNPAID' }),
        fact({ issueStatus: 'PENDING', orderStatus: 'CANCELLED' }),
        fact({ issueStatus: 'UNKNOWN' }),
      ],
      now: new Date('2026-10-27T10:00:00Z'),
    };
    const preview = buildTravelReportResult(input);
    const exported = buildTravelReportResult({
      ...input,
      includeAllRows: true,
    });
    expect(preview.total).toBe(2);
    expect(preview.rows).toHaveLength(1);
    expect(exported.rows).toHaveLength(2);
    expect(preview.totalsByCurrency[0]?.salesAmount).toBe('300');
    expect(exported.totalsByCurrency).toEqual(preview.totalsByCurrency);
    expect(preview.reconciliation.sourceRowCount).toBe(2);
  });

  it('keeps failure and cancellation/refund reports on their actual eligible populations', () => {
    const input = {
      query: {
        filters: {},
        page: 1,
        pageSize: 20,
        timezone: 'Asia/Tehran' as const,
      },
      facts: [
        fact({ id: 'ordinary' }),
        fact({ id: 'error', reservationStatus: 'ERROR' }),
        fact({ id: 'cancelled', reservationStatus: 'CANCELLED' }),
        fact({ id: 'refunded', refundAmount: new Prisma.Decimal(500) }),
      ],
      now: new Date('2026-10-27T10:00:00Z'),
    };
    expect(
      buildTravelReportResult({ ...input, code: 'reservation_errors' })
        .reconciliation.sourceRowCount,
    ).toBe(1);
    expect(
      buildTravelReportResult({ ...input, code: 'cancellations_refunds' })
        .reconciliation.sourceRowCount,
    ).toBe(2);
  });

  it('keeps money at order-item currency grain while passenger and segment counts vary', () => {
    const result = buildTravelReportResult({
      code: 'sales_by_service_route',
      query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
      facts: [fact()],
      now: new Date('2026-09-12T08:00:00Z'),
    });

    expect(result.grain).toBe('ORDER_ITEM_CURRENCY');
    expect(result.rows[0]).toMatchObject({
      passengerCount: 3,
      salesAmount: '12000000',
      purchaseAmount: '9000000',
      grossProfit: '3500000',
    });
    expect(result.totalsByCurrency[0]?.salesAmount).toBe('12000000');
    expect(result.filterSnapshot.grain).toBe('ORDER_ITEM_CURRENCY');
    expect(result.reconciliation.matchesApprovedProjection).toBe(true);
  });

  it('counts an order once across multiple service items while summing each item once', () => {
    const result = buildTravelReportResult({
      code: 'sales_by_service_route',
      query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
      facts: [
        fact(),
        fact({ id: 'fact-2', salesAmount: new Prisma.Decimal(3_000_000) }),
      ],
      now: new Date('2026-09-12T08:00:00Z'),
    });
    expect(result.rows[0]?.orderCount).toBe(1);
    expect(result.rows[0]?.salesAmount).toBe('15000000');
  });

  it('uses report-specific names for the two exported dimensions', () => {
    const result = buildTravelReportResult({
      code: 'cancellations_refunds',
      query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
      facts: [fact({ reservationStatus: 'CANCELLED', serviceType: 'FLIGHT' })],
      now: new Date('2026-09-12T08:00:00Z'),
    });

    expect(result.columns.slice(0, 2)).toEqual([
      expect.objectContaining({ key: 'primaryDimension', label: 'وضعیت رزرو' }),
      expect.objectContaining({ key: 'secondaryDimension', label: 'نوع خدمت' }),
    ]);
  });

  it('marks grouped rows with pending reservation actions without duplicating an order', () => {
    const result = buildTravelReportResult({
      code: 'paid_not_issued',
      query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
      facts: [
        fact({ reservationStatus: 'QUEUED', issueStatus: 'PENDING' }),
        fact({
          id: 'fact-2',
          reservationStatus: 'PARTIALLY_FULFILLED',
          issueStatus: 'PENDING',
          salesAmount: new Prisma.Decimal(3_000_000),
        }),
      ],
      now: new Date('2026-09-12T08:00:00Z'),
    });

    expect(result.rows[0]?.pendingReservationActions).toBe(1);
    expect(result.columns).toContainEqual({
      key: 'pendingReservationActions',
      label: 'اقدام رزرو در انتظار',
      kind: 'NUMBER',
    });
  });

  it('does not expose pending reservation actions outside its operational report', () => {
    const result = buildTravelReportResult({
      code: 'sales_by_service_route',
      query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
      facts: [fact({ reservationStatus: 'QUEUED' })],
      now: new Date('2026-09-12T08:00:00Z'),
    });

    expect(result.columns).not.toContainEqual(
      expect.objectContaining({ key: 'pendingReservationActions' }),
    );
  });

  it('includes every matching dataset row for export while preview remains paginated', () => {
    const input = {
      code: 'sales_by_service_route',
      query: {
        filters: {},
        page: 1,
        pageSize: 1,
        timezone: 'Asia/Tehran' as const,
      },
      facts: [fact(), fact({ id: 'fact-2', serviceType: 'HOTEL' })],
      now: new Date('2026-09-12T08:00:00Z'),
    };

    expect(buildTravelReportResult(input).rows).toHaveLength(1);
    expect(
      buildTravelReportResult({ ...input, includeAllRows: true }).rows,
    ).toHaveLength(2);
  });
});
