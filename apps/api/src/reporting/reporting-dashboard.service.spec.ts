import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { ReportingService } from './reporting.service';
import { dashboardPersianDateParts } from './reporting-dashboard-calendar';
import type { ReportingRepository } from './reporting.repository';

const actor = {
  userId: 'test-user',
  permissions: ['reporting.read'],
  branchIds: [],
};
const demoFact = {
  id: 'demo-1',
  occurredAt: new Date('2026-09-15T06:00:00.000Z'),
  dataAsOf: new Date('2026-09-15T06:00:00.000Z'),
  currencyCode: 'IRR',
  salesAmount: new Prisma.Decimal(12_000_000),
  purchaseAmount: new Prisma.Decimal(8_000_000),
  refundAmount: new Prisma.Decimal(0),
  settledAmount: new Prisma.Decimal(12_000_000),
  commissionAmount: new Prisma.Decimal(300_000),
  passengerCount: 2,
  ticketCount: 2,
  issueStatus: 'ISSUED',
  paymentStatus: 'SETTLED',
  orderStatus: 'CONFIRMED',
  reservationStatus: 'CONFIRMED',
  serviceType: 'FLIGHT',
  salesChannel: 'وب‌سایت اول',
  destinationCity: 'دبی',
  providerName: 'ایران‌ایر',
  agencyName: null,
};

describe('dashboard travel projection date boundaries', () => {
  it('publishes dimension filter options from the scoped fact source', async () => {
    const facts = vi.fn().mockResolvedValue([demoFact]);
    const dashboardFilterOptions = vi.fn().mockResolvedValue({
      salesChannel: ['وب‌سایت اول'],
      branch: ['شعبه مرکزی'],
      agent: ['کارشناس نمونه'],
      service: ['FLIGHT'],
      agency: [],
      provider: ['ایران‌ایر'],
      currency: ['IRR'],
      status: ['CONFIRMED'],
    });
    const service = new ReportingService({
      facts,
      dashboardFilterOptions,
    } as unknown as ReportingRepository);

    const result = await service.dashboardProjection(
      { range: 'month', service: 'FLIGHT', kpiIds: 'gross-sales' },
      actor,
    );

    expect(result.filterOptions?.service).toEqual(['FLIGHT']);
    expect(dashboardFilterOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ fromUtc: expect.any(String) }),
        page: 1,
        pageSize: 1000,
        timezone: 'Asia/Tehran',
      }),
      [],
    );
  });

  it('uses the current Persian calendar month in Tehran and reads demo rows', async () => {
    const facts = vi.fn().mockResolvedValue([demoFact]);
    const service = new ReportingService({
      facts,
    } as unknown as ReportingRepository);
    const result = await service.dashboardProjection(
      { range: 'month', kpiIds: 'gross-sales' },
      actor,
    );
    expect(result.state).toBe('ready');
    expect(result.metrics['gross-sales']?.value).toBeTruthy();
    expect(result.metrics['gross-sales']?.comparison?.direction).toBe('flat');
    expect(result.metrics['gross-sales']?.trend?.values.length).toBeGreaterThan(
      0,
    );
    expect(result.metrics['gross-sales']?.trend?.series).toEqual([
      expect.objectContaining({ currencyCode: 'IRR' }),
    ]);
    expect(facts).toHaveBeenCalledTimes(2);
    const fromUtc = (
      facts.mock.calls[0]?.[0] as { filters: { fromUtc: string } }
    ).filters.fromUtc;
    expect(new Date(fromUtc).toISOString()).toBe(fromUtc);
    expect(dashboardPersianDateParts(new Date(fromUtc)).day).toBe(1);
  });

  it('computes KPI and chart growth from the immediately preceding equal-length period', async () => {
    const facts = vi
      .fn()
      .mockResolvedValueOnce([demoFact])
      .mockResolvedValueOnce([
        {
          ...demoFact,
          id: 'demo-previous',
          occurredAt: new Date('2026-08-15T06:00:00.000Z'),
          salesAmount: new Prisma.Decimal(6_000_000),
          settledAmount: new Prisma.Decimal(6_000_000),
        },
      ]);
    const service = new ReportingService({
      facts,
    } as unknown as ReportingRepository);

    const result = await service.dashboardProjection(
      {
        range: 'month',
        currency: 'IRR',
        kpiIds: 'gross-sales',
        visualIds: 'executive-sales-by-service,finalized-sales-trend',
      },
      actor,
    );

    expect(result.metrics['gross-sales']?.comparison).toMatchObject({
      label: 'دوره قبل هم‌طول',
      previousValue: 6_000_000,
      deltaPercent: 100,
      direction: 'up',
    });
    expect(
      result.visuals['executive-sales-by-service']?.comparison,
    ).toMatchObject({ deltaPercent: 100, direction: 'up' });
    expect(
      result.visuals['executive-sales-by-service']?.trend?.values.length,
    ).toBeGreaterThan(0);
    expect(result.visuals['finalized-sales-trend']).toMatchObject({
      currencyCode: 'IRR',
    });
    expect(
      result.visuals['finalized-sales-trend']?.values.reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(12_000_000);
    expect(result.visuals['finalized-sales-trend']).not.toHaveProperty(
      'comparisonValues',
    );
  });

  it('rejects malformed or reversed custom boundaries before accessing facts', async () => {
    const facts = vi.fn();
    const service = new ReportingService({
      facts,
    } as unknown as ReportingRepository);
    await expect(
      service.dashboardProjection({ from: 'not-a-date' }, actor),
    ).rejects.toThrow(/تاریخ/);
    await expect(
      service.dashboardProjection(
        { from: '2026-09-16', to: '2026-09-15' },
        actor,
      ),
    ).rejects.toThrow(/شروع/);
    expect(facts).not.toHaveBeenCalled();
  });

  it('does not fabricate unsupported KPIs or combine currencies in a monetary chart', async () => {
    const facts = vi.fn().mockResolvedValue([
      demoFact,
      {
        ...demoFact,
        id: 'demo-2',
        currencyCode: 'USD',
        salesAmount: new Prisma.Decimal(100),
      },
    ]);
    const service = new ReportingService({
      facts,
    } as unknown as ReportingRepository);
    const result = await service.dashboardProjection(
      {
        range: 'month',
        kpiIds: 'gross-sales,account-balance',
        visualIds: 'executive-sales-by-service',
      },
      actor,
    );
    expect(result.metrics['gross-sales']?.value).toContain('﷼');
    expect(result.metrics['gross-sales']?.value).toContain('$');
    expect(result.metrics['gross-sales']?.trend?.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currencyCode: 'IRR' }),
        expect.objectContaining({ currencyCode: 'USD' }),
      ]),
    );
    expect(result.metrics['gross-sales']?.comparisonSeries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currencyCode: 'IRR', direction: 'flat' }),
        expect.objectContaining({ currencyCode: 'USD', direction: 'flat' }),
      ]),
    );
    expect(result.metrics).not.toHaveProperty('account-balance');
    expect(result.visuals['executive-sales-by-service']?.values).toEqual([
      12_000_000,
    ]);
    expect(
      result.visuals['executive-sales-by-service']?.currencySeries,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currencyCode: 'IRR',
          values: [12_000_000],
        }),
        expect.objectContaining({ currencyCode: 'USD', values: [100] }),
      ]),
    );
  });

  it('publishes trend, action queue, decision funnel and team comparison from the approved fact projection', async () => {
    const facts = vi.fn().mockResolvedValue([
      { ...demoFact, ownerName: 'کارشناس دمو آریا' },
      {
        ...demoFact,
        id: 'demo-pending-payment',
        ownerName: 'کارشناس دمو پارسا',
        paymentStatus: 'PENDING',
        issueStatus: 'PENDING',
      },
      {
        ...demoFact,
        id: 'demo-pending-reservation',
        ownerName: 'کارشناس دمو سارا',
        reservationStatus: 'PENDING',
      },
    ]);
    const service = new ReportingService({
      facts,
    } as unknown as ReportingRepository);

      const result = await service.dashboardProjection(
        {
          range: 'month',
          currency: 'IRR',
          kpiIds:
            'issue-success-rate,collection-rate,refund-rate,lead-conversion-rate',
          visualIds:
          'finalized-sales-trend,crm-followup-queue,commercial-pipeline,employee-performance-ranking,employee-sales-count-by-agent,employee-sales-amount-by-agent,employee-conversion-by-agent,employee-cancellations-by-agent',
      },
      actor,
    );

    expect(
      result.visuals['finalized-sales-trend']?.values.length,
    ).toBeGreaterThan(0);
    expect(result.visuals['crm-followup-queue']).toMatchObject({
      labels: expect.arrayContaining(['پرداخت در انتظار', 'رزرو در انتظار']),
    });
    expect(result.visuals['commercial-pipeline']).toMatchObject({
      labels: ['رزرو ثبت‌شده', 'رزرو تأییدشده', 'پرداخت‌شده', 'صدور نهایی'],
      values: [3, 2, 2, 2],
    });
    expect(result.visuals['employee-performance-ranking']).toMatchObject({
      labels: expect.arrayContaining(['کارشناس دمو آریا', 'کارشناس دمو پارسا']),
    });
    expect(result.visuals['employee-sales-count-by-agent']).toMatchObject({
      metricId: 'employee-sales-count-by-agent',
      aggregation: 'count distinct confirmed non-cancelled orders',
      values: [1, 1, 1],
    });
    expect(result.visuals['employee-sales-count-by-agent']).not.toHaveProperty(
      'currencySeries',
    );
    expect(result.visuals['employee-sales-amount-by-agent']).toMatchObject({
      metricId: 'employee-sales-amount-by-agent',
      aggregation: 'sum salesAmount at order-item-currency grain',
      values: [12_000_000, 12_000_000, 12_000_000],
    });
    expect(result.visuals['employee-conversion-by-agent']?.values).toEqual([
      100, 100, 0,
    ]);
    expect(result.visuals['employee-cancellations-by-agent']?.values).toEqual([
      0, 0, 0,
    ]);
    expect(result.metrics['issue-success-rate']).toMatchObject({
      unit: 'درصد',
      value: '۶۷',
    });
    expect(result.metrics['collection-rate']?.unit).toBe('درصد');
    expect(result.metrics['refund-rate']?.unit).toBe('درصد');
    expect(result.metrics['lead-conversion-rate']?.unit).toBe('درصد');
  });
});
