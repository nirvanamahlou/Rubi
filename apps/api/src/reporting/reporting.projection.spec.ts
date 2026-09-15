import { Prisma } from '@rubi/database';
import { describe, expect, it } from 'vitest';

import { buildTravelReportResult } from './reporting.projection';
import type { ReportingFactRow } from './reporting.repository';

function fact(overrides: Partial<ReportingFactRow> = {}): ReportingFactRow {
  return {
    id: 'fact-1', orderNumber: 'TR-1001', occurredAt: new Date('2026-09-10T08:00:00Z'),
    legalEntityCode: 'NIYAYESH', legalEntityName: 'نیایش سیر سحر', branchId: 'branch-1',
    branchName: 'شعبه مرکزی', ownerName: 'کارشناس دمو', siteCode: 'وب‌سایت اول',
    salesChannel: 'WEBSITE_1', serviceType: 'FLIGHT', customerType: 'AGENCY',
    customerName: 'آژانس نمونه', agencyName: 'آژانس نمونه', leadSource: 'جست‌وجوی اینترنتی',
    providerName: 'سامانه پرواز نمونه', airlineName: 'هواپیمایی نمونه', originCity: 'تهران',
    destinationCity: 'شیراز', routeLabel: 'تهران–شیراز', orderStatus: 'CONFIRMED',
    reservationStatus: 'CONFIRMED', issueStatus: 'ISSUED', paymentStatus: 'PAID',
    pnrCode: 'DEMO12', passengerCount: 3, segmentCount: 4, ticketCount: 3,
    currencyCode: 'IRR', salesAmount: new Prisma.Decimal(12_000_000),
    purchaseAmount: new Prisma.Decimal(9_000_000), commissionAmount: new Prisma.Decimal(500_000),
    refundAmount: new Prisma.Decimal(0), settledAmount: new Prisma.Decimal(12_000_000),
    dataAsOf: new Date('2026-09-10T09:00:00Z'), ...overrides,
  };
}

describe('travel reporting approved projection', () => {
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
      facts: [fact(), fact({ id: 'fact-2', salesAmount: new Prisma.Decimal(3_000_000) })],
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
});
