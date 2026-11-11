import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { ReportingExportService } from './reporting-export.service';
import type { LocalDocumentStorage } from '../documents/documents.storage';
import type { DatabaseService } from '../database/database.service';
import { Prisma, type DatabaseClient } from '@nora/database';
import { readSalesReportingProjection } from '../sales/sales-reporting.public';
import { nativeSalesReport } from './reporting-native-sales';
import { ReportingService } from './reporting.service';
import { ReportingRepository } from './reporting.repository';

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
    customer: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'organization', displayName: 'سازمان نمونه' },
        ]),
    },
    reservationIntake: { findMany: vi.fn().mockResolvedValue([]) },
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
  it('reports organizational customer sales without inventing agency credit or profit', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockResolvedValue([
      {
        ...one,
        customerId: 'organization',
      },
    ]);
    const result = await nativeSalesReport(
      client,
      'agency_performance',
      query,
      { ...actor, permissions: [...actor.permissions, 'customers.read'] },
      true,
    );
    expect(client.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'ORGANIZATION',
          ownerBranchId: { in: ['branch'] },
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.rows[0]?.orderCount).toBe(1);
    expect(result.rows[0]?.passengerCount).toBe(3);
    expect(result.rows[0]?.primaryDimension).toBe('سازمان نمونه');
    expect(result.columns.map((c) => c.key)).not.toContain('grossProfit');
  });
  it('requires customer-source permission before resolving organizational identities', async () => {
    const { client } = fixture();
    await expect(
      nativeSalesReport(client, 'agency_performance', query, actor),
    ).rejects.toThrow('مجوز مشاهده منبع این گزارش وجود ندارد.');
    expect(client.customer.findMany).not.toHaveBeenCalled();
  });
  it('uses departure date rather than creation date for future travel', async () => {
    const { client, findMany } = fixture();
    const result = await nativeSalesReport(
      client,
      'future_travel_commitments',
      query,
      actor,
      true,
    );
    expect(findMany.mock.calls.at(-1)?.[0].where.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          departureDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      ]),
    );
    expect(result.filterSnapshot.filters.fromUtc).toBeTruthy();
    expect(result.rows[0]?.orderCount).toBe(1);
  });
  it.each(['route_passengers', 'sales_contract_pipeline'])(
    'consolidates %s without counting currency legs as contracts or passengers',
    async (code) => {
      const { client } = fixture();
      const result = await nativeSalesReport(client, code, query, actor, true);
      expect(result.total).toBe(1);
      expect(result.rows[0]?.orderCount).toBe(1);
      expect(result.rows[0]?.passengerCount).toBe(3);
      expect(result.rows[0]?.sourceValues?.salesAmount).toBe('900 ریال + 20 $');
      expect(result.columns.map((c) => c.key)).not.toContain('currencyCode');
    },
  );
  it('groups a package once by its distinct service combination without multiplying sales', async () => {
    const { client } = fixture();
    const result = await nativeSalesReport(
      client,
      'sales_by_service_route',
      query,
      actor,
      true,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.primaryDimension).toBe('پرواز + هتل');
    expect(result.rows[0]?.salesAmount).toBe('900');
    expect(result.columns[0]?.label).toBe('ترکیب خدمات قرارداد');
    expect(result.rows[0]?.orderCount).toBe(1);
    expect(result.rows[0]?.passengerCount).toBe(3);
    expect(result.rows[0]?.sourceValues?.salesAmount).toBe('900 ریال + 20 $');
    expect(result.rows[0]?.amountsByCurrency).toEqual([
      { currencyCode: 'IRR', amount: '900' },
      { currencyCode: 'USD', amount: '20' },
    ]);
    expect(result.columns.map((c) => c.key)).not.toContain('currencyCode');
    const preview = await nativeSalesReport(
      client,
      'sales_by_service_route',
      query,
      actor,
    );
    expect(preview.rows).toEqual(result.rows);
    expect(preview.totalsByCurrency).toEqual(result.totalsByCurrency);
    const file = new ReportingExportService({} as LocalDocumentStorage).build(
      'XLSX',
      result,
      'خدمات و مسیر',
    );
    const sheet = strFromU8(
      unzipSync(new Uint8Array(file.buffer))['xl/worksheets/sheet1.xml']!,
    );
    expect(sheet.replaceAll('\u200e', '').replaceAll('\u00a0', ' ')).toContain(
      '900 ریال + 20 $',
    );
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
  it('deduplicates contracts across currencies before pagination and keeps different route IDs separate', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockResolvedValue([
      one,
      { ...one, id: 'two', _count: { passengers: 2 } },
      { ...one, id: 'three', destinationId: 'other-destination' },
    ]);
    const all = await nativeSalesReport(
      client,
      'sales_by_service_route',
      query,
      actor,
      true,
    );
    expect(all.total).toBe(2);
    expect(all.rows[0]?.orderCount).toBe(2);
    expect(all.rows[0]?.passengerCount).toBe(5);
    expect(all.rows[0]?.sourceValues?.salesAmount).toBe('1800 ریال + 40 $');
    const page = await nativeSalesReport(
      client,
      'sales_by_service_route',
      query,
      actor,
    );
    expect(page.total).toBe(2);
    expect(page.rows).toEqual(all.rows.slice(0, 1));
    const second = await nativeSalesReport(
      client,
      'sales_by_service_route',
      { ...query, page: 2 },
      actor,
    );
    expect(second.rows).toEqual(all.rows.slice(1));
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
    expect(exported.rows).toHaveLength(1);
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
    expect(exported.filterSnapshot.grain).toBe('CONTRACT');
    expect(exported.rows[0]?.orderCount).toBe(1);
    expect(exported.rows[0]?.sourceValues?.salesAmount).toBe('900 ریال + 20 $');
    expect(exported.columns.map((c) => c.key)).not.toContain('currencyCode');
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
  it('counts two multi-currency contracts once, preserves precision and exports the combined column', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockResolvedValue([
      one,
      {
        ...one,
        id: 'two',
        _count: { passengers: 2 },
        priceComponents: [
          {
            type: 'BASE',
            title: 'خدمت',
            amount: new Prisma.Decimal('9007199254740993.1234'),
            currencyCode: 'EUR',
          },
        ],
      },
    ]);
    const r = await nativeSalesReport(
      client,
      'sales_by_organization',
      query,
      actor,
      true,
    );
    expect(r.total).toBe(1);
    expect(r.rows[0]?.orderCount).toBe(2);
    expect(r.rows[0]?.passengerCount).toBe(5);
    expect(r.rows[0]?.sourceValues?.salesAmount).toBe(
      '900 ریال + 9007199254740993.1234 € + 20 $',
    );
    const workbook = unzipSync(
      new Uint8Array(
        new ReportingExportService({} as LocalDocumentStorage).build(
          'XLSX',
          r,
          'گزارش فروش',
        ).buffer,
      ),
    );
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']!);
    expect(sheet.replaceAll('\u200e', '').replaceAll('\u00a0', ' ')).toContain(
      '900 ریال + 9,007,199,254,740,993.1234 € + 20 $',
    );
    expect(r.columns.map((c) => c.key)).toEqual([
      'primaryDimension',
      'secondaryDimension',
      'orderCount',
      'passengerCount',
      'salesAmount',
    ]);
  });
  it('re-reads operational cancellation and reopen on each preview and keeps cancelled money out of pipeline totals', async () => {
    const { client } = fixture();
    const intake = vi.mocked(client.reservationIntake.findMany);
    expect(
      (await nativeSalesReport(client, 'sales_by_organization', query, actor))
        .rows,
    ).toHaveLength(1);
    intake.mockResolvedValue([
      {
        contractId: 'one',
        workflowRevisions: [
          { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
        ],
      },
    ] as never);
    const cancelled = await nativeSalesReport(
      client,
      'sales_by_organization',
      query,
      actor,
    );
    expect(cancelled.rows).toHaveLength(0);
    expect(cancelled.totalsByCurrency).toHaveLength(0);
    const pipeline = await nativeSalesReport(
      client,
      'sales_contract_pipeline',
      query,
      actor,
      true,
    );
    expect(pipeline.rows.every((r) => r.primaryDimension === 'CANCELLED')).toBe(
      true,
    );
    expect(pipeline.totalsByCurrency).toHaveLength(0);
    intake.mockResolvedValue([
      {
        contractId: 'one',
        workflowRevisions: [
          { state: { supplierStatus: 'NEW' }, createdAt: new Date() },
        ],
      },
    ] as never);
    expect(
      (await nativeSalesReport(client, 'sales_by_organization', query, actor))
        .rows,
    ).toHaveLength(1);
  });

  it('projects each bounded Sales batch before reading the next and respects cancellations across batches', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockClear();
    const first = Array.from({ length: 500 }, (_, index) => ({
      ...one,
      id: 'contract-' + index,
    }));
    const intake = vi.mocked(client.reservationIntake.findMany);
    findMany.mockResolvedValueOnce(first).mockImplementationOnce(async () => {
      expect(intake).toHaveBeenCalledTimes(1);
      return [{ ...one, id: 'cancelled' }];
    });
    intake.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        contractId: 'cancelled',
        workflowRevisions: [
          { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
        ],
      },
    ] as never);

    const projected = await readSalesReportingProjection(client, actor, {
      filters: {},
    });
    expect(projected).toHaveLength(1000);
    expect(projected[0]?.id).toBe('contract-0');
    expect(projected.at(-1)?.id).toBe('contract-499');
    expect(findMany).toHaveBeenNthCalledWith(2, {
      ...findMany.mock.calls[0]![0],
      take: 500,
      cursor: { id: 'contract-499' },
      skip: 1,
    });
    expect(intake).toHaveBeenCalledTimes(2);
  });

  it('uses a new read-only repeatable-read snapshot for each native request', async () => {
    const { client } = fixture();
    const execute = vi.fn();
    const transaction = vi.fn(
      async (fn: (tx: unknown) => unknown, options: unknown) => {
        expect(options).toBeDefined();
        return fn({ ...client, $executeRawUnsafe: execute });
      },
    );
    const repository = new ReportingRepository({
      client: { $transaction: transaction },
    } as unknown as DatabaseService);
    await repository.nativeResult('sales_by_organization', query, actor);
    await repository.nativeResult('sales_by_organization', query, actor, true);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction.mock.calls[0]?.[1]).toMatchObject({
      isolationLevel: 'RepeatableRead',
    });
    expect(execute).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
  });
  it('applies effective cancelled status before checking prices of unrelated unpriced drafts', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockResolvedValue([
      one,
      { ...one, id: 'draft', status: 'DRAFT', priceComponents: [] },
    ]);
    vi.mocked(client.reservationIntake.findMany).mockResolvedValue([
      {
        contractId: 'one',
        workflowRevisions: [
          { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
        ],
      },
    ] as never);
    const result = await readSalesReportingProjection(
      client,
      actor,
      { filters: { status: 'CANCELLED' } },
      true,
    );
    expect(new Set(result.map((r) => r.id))).toEqual(new Set(['one']));
    expect(result.every((r) => r.status === 'CANCELLED')).toBe(true);
  });
  it('applies output filters inside the authorized snapshot before paging or exporting', async () => {
    const { client, findMany } = fixture();
    const [one] = await findMany();
    findMany.mockResolvedValue([
      one,
      { ...one, id: 'two', destinationId: 'destination-two' },
    ]);
    vi.mocked(client.masterCity.findMany).mockResolvedValue([
      { id: 'origin', name: 'تهران' },
      { id: 'destination', name: 'مشهد' },
      { id: 'destination-two', name: 'تبریز' },
    ] as never);
    const repository = new ReportingRepository({
      client: {
        $transaction: async (fn: (tx: unknown) => unknown) =>
          fn({ ...client, $executeRawUnsafe: vi.fn() }),
      },
    } as unknown as DatabaseService);
    const input = { ...query, filters: { columnPrimaryDimension: 'تبریز' } };
    const result = await repository.nativeResult(
      'route_passengers',
      input,
      actor,
    );
    const exported = await repository.nativeResult(
      'route_passengers',
      input,
      actor,
      true,
    );
    expect(result?.rows).toEqual(exported?.rows);
    expect(result?.total).toBe(1);
    expect(result?.rows[0]?.primaryDimension).toBe('تبریز');
    expect(result?.rows[0]?.orderCount).toBe(1);
    expect(result?.filterSnapshot.filters.columnPrimaryDimension).toBe('تبریز');
    expect(
      result?.totalsByCurrency.find((t) => t.currencyCode === 'IRR')
        ?.salesAmount,
    ).toBe('900');
  });
});
