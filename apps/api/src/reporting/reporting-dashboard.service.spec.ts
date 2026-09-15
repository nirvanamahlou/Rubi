import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { ReportingService } from './reporting.service';
import type { ReportingRepository } from './reporting.repository';

const actor = { userId: 'test-user', permissions: ['reporting.read'], branchIds: [] };
const demoFact = {
  id: 'demo-1', occurredAt: new Date('2026-09-15T06:00:00.000Z'),
  dataAsOf: new Date('2026-09-15T06:00:00.000Z'),
  currencyCode: 'IRR', salesAmount: new Prisma.Decimal(12_000_000),
  purchaseAmount: new Prisma.Decimal(8_000_000),
  refundAmount: new Prisma.Decimal(0), settledAmount: new Prisma.Decimal(12_000_000),
  commissionAmount: new Prisma.Decimal(300_000), passengerCount: 2,
  ticketCount: 2, issueStatus: 'ISSUED', paymentStatus: 'SETTLED',
  orderStatus: 'CONFIRMED', reservationStatus: 'CONFIRMED',
  serviceType: 'FLIGHT', salesChannel: 'وب‌سایت اول', destinationCity: 'دبی',
  providerName: 'ایران‌ایر', agencyName: null,
};

describe('dashboard travel projection date boundaries', () => {
  it('keeps the default rolling range as an ISO instant and reads demo rows', async () => {
    const facts = vi.fn().mockResolvedValue([demoFact]);
    const service = new ReportingService({ facts } as unknown as ReportingRepository);
    const result = await service.dashboardProjection({ range: 'month', kpiIds: 'gross-sales' }, actor);
    expect(result.state).toBe('ready');
    expect(result.metrics['gross-sales']?.value).toBeTruthy();
    const fromUtc = (facts.mock.calls[0]?.[0] as { filters: { fromUtc: string } }).filters.fromUtc;
    expect(new Date(fromUtc).toISOString()).toBe(fromUtc);
    expect(Date.now() - new Date(fromUtc).getTime()).toBeGreaterThan(30 * 86_400_000);
  });

  it('rejects malformed or reversed custom boundaries before accessing facts', async () => {
    const facts = vi.fn();
    const service = new ReportingService({ facts } as unknown as ReportingRepository);
    await expect(service.dashboardProjection({ from: 'not-a-date' }, actor)).rejects.toThrow(/تاریخ/);
    await expect(service.dashboardProjection({ from: '2026-09-16', to: '2026-09-15' }, actor)).rejects.toThrow(/شروع/);
    expect(facts).not.toHaveBeenCalled();
  });

  it('does not fabricate unsupported KPIs or combine currencies in a monetary chart', async () => {
    const facts = vi.fn().mockResolvedValue([
      demoFact,
      { ...demoFact, id: 'demo-2', currencyCode: 'USD', salesAmount: new Prisma.Decimal(100) },
    ]);
    const service = new ReportingService({ facts } as unknown as ReportingRepository);
    const result = await service.dashboardProjection({
      range: 'month', kpiIds: 'gross-sales,account-balance', visualIds: 'executive-sales-by-service',
    }, actor);
    expect(result.metrics['gross-sales']?.value).toContain('IRR');
    expect(result.metrics['gross-sales']?.value).toContain('USD');
    expect(result.metrics).not.toHaveProperty('account-balance');
    expect(result.visuals['executive-sales-by-service']?.values).toEqual([12_000_000]);
  });
});
