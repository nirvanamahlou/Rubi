import { describe, expect, it, vi } from 'vitest';
import { Prisma, type DatabaseClient } from '@nora/database';
import { readSalesReportingProjection } from '../sales/sales-reporting.public';
import { nativeSalesReport } from './reporting-native-sales';
import { ReportingService } from './reporting.service';
import type { ReportingRepository } from './reporting.repository';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: [
    'reporting.read',
    'reporting.sales.read',
    'sales.contracts.read.own',
  ],
};
const query = {
  filters: {},
  page: 1,
  pageSize: 1,
  timezone: 'Asia/Tehran' as const,
};
function fixture() {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'one',
      contractNumber: 'S-1',
      branchId: 'branch',
      ownerUserId: 'user',
      originId: 'origin',
      destinationId: 'destination',
      status: 'CONFIRMED',
      reservationStatus: 'QUEUED',
      createdAt: new Date('2026-10-20T00:00:00Z'),
      updatedAt: new Date('2026-10-21T00:00:00Z'),
      departureDate: new Date('2026-11-01T00:00:00Z'),
      _count: { passengers: 3 },
      services: [{ kind: 'HOTEL' }, { kind: 'FLIGHT' }, { kind: 'FLIGHT' }],
      priceComponents: [
        {
          type: 'BASE',
          title: 'خدمت',
          amount: new Prisma.Decimal(1000),
          currencyCode: 'IRR',
        },
        {
          type: 'DISCOUNT',
          title: 'تخفیف',
          amount: new Prisma.Decimal(100),
          currencyCode: 'IRR',
        },
        {
          type: 'BASE',
          title: 'خدمت',
          amount: new Prisma.Decimal(20),
          currencyCode: 'USD',
        },
      ],
      payments: [],
    },
  ]);
  const client = {
    salesContract: { findMany },
    branch: {
      findMany: vi.fn().mockResolvedValue([{ id: 'branch', name: 'مرکزی' }]),
    },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'user', displayName: 'کارشناس' }]),
    },
    masterCity: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'origin', name: 'تهران' },
        { id: 'destination', name: 'مشهد' },
      ]),
    },
  } as unknown as DatabaseClient;
  return { client, findMany };
}
describe('native Sales report source and shared preview/export path', () => {
  it('groups a package once by its distinct service combination without multiplying sales', async () => {
    const { client } = fixture();
    const result = await nativeSalesReport(
      client,
      'sales_by_service_route',
      query,
      actor,
      true,
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.primaryDimension).toBe('پرواز + هتل');
    expect(result.rows[0]?.salesAmount).toBe('900');
    expect(result.columns[0]?.label).toBe('ترکیب خدمات قرارداد');
  });
  it('rejects sorting by an unavailable financial metric before reading the source', async () => {
    const { client, findMany } = fixture();
    await expect(
      nativeSalesReport(
        client,
        'sales_by_organization',
        { ...query, sort: { column: 'grossProfit', direction: 'DESC' } },
        actor,
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('requires native authorization even when the actor has generic reporting read', async () => {
    const { client, findMany } = fixture();
    await expect(
      readSalesReportingProjection(
        client,
        { ...actor, permissions: ['reporting.read'] },
        query,
      ),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('intersects own/branch scope with requested filters and excludes unconfirmed sales', async () => {
    const { client, findMany } = fixture();
    await readSalesReportingProjection(client, actor, {
      filters: { branchId: 'other', fromUtc: '2026-10-01T00:00:00Z' },
    });
    expect(findMany.mock.calls[0]?.[0].where.AND).toEqual(
      expect.arrayContaining([
        { branchId: { in: ['branch'] }, ownerUserId: 'user' },
        { branchId: 'other' },
        expect.objectContaining({ confirmedAt: { not: null } }),
      ]),
    );
    expect(findMany.mock.calls[0]?.[0].select.payments.where).toEqual({
      id: { in: [] },
    });
  });
  it('rejects unsupported filters instead of silently returning unfiltered data', async () => {
    const { client, findMany } = fixture();
    await expect(
      readSalesReportingProjection(client, actor, {
        filters: { provider: 'x' },
      }),
    ).rejects.toThrow();
    await expect(
      readSalesReportingProjection(client, actor, {
        filters: {},
        legalEntityId: 'company',
      }),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
  it('keeps currencies separate, never multiplies contract money by passengers and omits unavailable costs', async () => {
    const { client } = fixture();
    const preview = await nativeSalesReport(
      client,
      'sales_by_organization',
      query,
      actor,
    );
    const exported = await nativeSalesReport(
      client,
      'sales_by_organization',
      query,
      actor,
      true,
    );
    expect(preview.rows).toHaveLength(1);
    expect(exported.rows).toHaveLength(2);
    expect(
      exported.totalsByCurrency.map((row) => [
        row.currencyCode,
        row.salesAmount,
      ]),
    ).toEqual([
      ['IRR', '900'],
      ['USD', '20'],
    ]);
    expect(exported.rows[0]?.passengerCount).toBe(3);
    expect(exported.columns.map((column) => column.key)).not.toContain(
      'grossProfit',
    );
    expect(exported.columns[0]?.label).toBe('شعبه');
    expect(preview.totalsByCurrency).toEqual(exported.totalsByCurrency);
    expect(exported.filterSnapshot.grain).toBe('CONTRACT_CURRENCY');
  });
  it('refuses a complete-looking money report for unpriced contracts', async () => {
    const { client, findMany } = fixture();
    const rows = await findMany();
    rows[0].priceComponents = [];
    findMany.mockResolvedValue(rows);
    await expect(
      nativeSalesReport(client, 'sales_contract_pipeline', query, actor),
    ).rejects.toThrow('قیمت');
  });
  it('preview calls the owner projection and never reads the empty travel staging table', async () => {
    const { client } = fixture();
    const facts = vi.fn();
    const nativeResult = vi.fn((code, q, a) =>
      nativeSalesReport(client, code, q, a),
    );
    const service = new ReportingService({
      facts,
      nativeResult,
    } as unknown as ReportingRepository);
    const result = await service.preview('sales_by_organization', query, actor);
    expect(result.rows[0]?.salesAmount).toBe('900');
    expect(facts).not.toHaveBeenCalled();
  });
});
