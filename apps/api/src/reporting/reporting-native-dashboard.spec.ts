import { describe, expect, it, vi } from 'vitest';
import { ReportingNativeDashboard } from './reporting-native-dashboard';
import { ReportingService } from './reporting.service';
import { SalesDashboardSource } from '../sales/sales-dashboard.public';
import { CustomerDashboardSource } from '../customers/customer-dashboard.public';
import { LeadDashboardSource } from '../customer-affairs/lead-dashboard.public';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { Prisma } from '@nora/database';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { SalesDashboardPublicModule } from '../sales/sales-dashboard.public';
import { CustomerDashboardPublicModule } from '../customers/customer-dashboard.public';
import { LeadDashboardPublicModule } from '../customer-affairs/lead-dashboard.public';
import { SalesDashboardCustomersModule } from '../sales/sales-dashboard-customers.public';
import {
  SalesDashboardPayments,
  SalesDashboardPaymentsModule,
} from '../sales/sales-dashboard-payments.public';

@Global()
@Module({
  providers: [{ provide: DatabaseService, useValue: { client: {} } }],
  exports: [DatabaseService],
})
class DashboardTestDatabaseModule {}

const actor = {
  userId: 'owner',
  permissions: [
    'reporting.read',
    'customers.read',
    'customer_affairs.lead.read',
    'sales.contracts.read.own',
  ],
  branchIds: ['branch-a'],
};
const query: DashboardSourceQuery = {
  actor,
  from: new Date('2026-10-01T00:00:00Z'),
  to: new Date('2026-11-01T00:00:00Z'),
  filters: {},
  dateBasis: 'effective',
};
const absent = (source = 'fixture'): DashboardSourceResult => ({
  source,
  state: 'forbidden',
  metrics: {},
});
const customerResult: DashboardSourceResult = {
  source: 'customers',
  state: 'ready',
  metrics: {
    'new-customers': {
      kind: 'count',
      aggregation: 'actual registrations',
      observations: [
        { at: new Date('2026-10-15'), value: '1' },
        { at: new Date('2026-10-16'), value: '1' },
      ],
    },
  },
};
function setup(sales = absent(), customers = customerResult, leads = absent()) {
  const salesReader = { read: vi.fn().mockResolvedValue(sales) };
  const customerReader = { read: vi.fn().mockResolvedValue(customers) };
  const leadReader = { read: vi.fn().mockResolvedValue(leads) };
  const native = new ReportingNativeDashboard(
    salesReader as never,
    customerReader as never,
    leadReader as never,
    {
      branches: vi
        .fn()
        .mockResolvedValue([{ id: 'branch-a', name: 'Synthetic Branch' }]),
    } as never,
  );
  return { native, salesReader, customerReader, leadReader };
}
const filters = {
  fromUtc: query.from.toISOString(),
  toUtc: query.to.toISOString(),
};

describe('native dashboard independent source composition', () => {
  it('derives unconverted lead growth from comparable authorized periods and withholds a zero or missing baseline', async () => {
    const count = (n: number): DashboardSourceResult => ({
      source: 'leads',
      state: 'ready',
      metrics: {
        'new-leads': {
          kind: 'count',
          aggregation: 'unconverted leads',
          observations: Array.from({ length: n }, () => ({
            at: new Date('2026-10-15'),
            value: '1',
          })),
        },
      },
    });
    for (const [priorCount, expected] of [
      [2, '۵۰'],
      [0, null],
    ] as const) {
      const { native, leadReader } = setup(absent(), absent(), count(3));
      leadReader.read
        .mockResolvedValueOnce(count(3))
        .mockResolvedValueOnce(count(priorCount));
      const result = await native.load(
        { kpiIds: 'lead-growth-rate' },
        actor,
        filters,
        new Date('2026-11-01'),
      );
      expect(result.metrics['new-leads']).toBeUndefined();
      if (expected)
        expect(result.metrics['lead-growth-rate']).toMatchObject({
          value: expected,
          unit: 'درصد',
        });
      else
        expect(result.unavailableMetrics?.['lead-growth-rate']).toBe(
          'ZERO_DENOMINATOR',
        );
    }
    const { native, leadReader } = setup();
    leadReader.read
      .mockResolvedValueOnce(count(3))
      .mockResolvedValueOnce(absent());
    expect(
      (
        await native.load(
          { kpiIds: 'lead-growth-rate' },
          actor,
          filters,
          new Date('2026-11-01'),
        )
      ).metrics,
    ).toEqual({});
  });
  it('reconciles weekday sales in Tehran across the UTC boundary, without mixing currencies', async () => {
    const source: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'confirmed contract currency',
          observations: [
            {
              at: new Date('2026-10-01T20:29:59Z'),
              value: '10',
              currencyCode: 'USD',
            },
            {
              at: new Date('2026-10-01T20:30:00Z'),
              value: '20',
              currencyCode: 'USD',
            },
            {
              at: new Date('2026-10-08T20:30:00Z'),
              value: '-5',
              currencyCode: 'USD',
            },
            {
              at: new Date('2026-10-01T20:30:00Z'),
              value: '7',
              currencyCode: 'EUR',
            },
          ],
        },
      },
    };
    const result = await setup(source).native.load(
      { kpiIds: 'net-sales', visualIds: 'sales-weekday-pattern' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    const chart = result.visuals['sales-weekday-pattern']!;
    const usd = chart.currencySeries!.find((x) => x.currencyCode === 'USD')!;
    expect(usd.labels).toHaveLength(7);
    expect(usd.values[usd.labels.indexOf('پنجشنبه')]).toBe(10);
    expect(usd.values[usd.labels.indexOf('جمعه')]).toBe(15);
    expect(usd.values.reduce((a, b) => a + b, 0)).toBe(25);
    expect(result.metrics['net-sales']?.value).toContain('۲۵ USD');
    expect(
      chart
        .currencySeries!.find((x) => x.currencyCode === 'EUR')!
        .values.reduce((a, b) => a + b, 0),
    ).toBe(7);
    expect(chart.notice).toContain('تعداد فروش روی این محور نیست');
  });
  it('does not invent accounting balances from sales and distinguishes absent accounting from missing matched cost', async () => {
    const result = await setup().native.load(
      { kpiIds: 'account-balance,receivables,net-profit,gross-profit' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics).toEqual({});
    for (const id of ['account-balance', 'receivables', 'net-profit'])
      expect(result.unavailableMetrics?.[id]).toBe(
        'POSTED_ACCOUNTING_SOURCE_REQUIRED',
      );
    expect(result.unavailableMetrics?.['gross-profit']).toBe(
      'APPROVED_MATCHED_COST_REQUIRED',
    );
  });
  it('withholds a weekday chart when its actual Sales source is forbidden or exceeds numeric range', async () => {
    const denied = await setup(absent()).native.load(
      { kpiIds: '', visualIds: 'sales-weekday-pattern' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(denied.visuals).toEqual({});
    expect(denied.unavailableVisuals?.['sales-weekday-pattern']).toBe(
      'SOURCE_OR_SCOPE_UNAVAILABLE',
    );
    const source: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'exact',
          observations: [
            {
              at: new Date('2026-10-15'),
              currencyCode: 'IRR',
              value: '9007199254740992',
            },
          ],
        },
      },
    };
    const large = await setup(source).native.load(
      { kpiIds: 'net-sales', visualIds: 'sales-weekday-pattern' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(large.visuals).toEqual({});
    expect(large.unavailableVisuals?.['sales-weekday-pattern']).toBe(
      'CHART_NUMERIC_RANGE',
    );
    expect(large.metrics['net-sales']?.value).toContain(
      '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۲',
    );
  });
  it('recomputes average sale from contract amounts per currency and keeps empty denominators unavailable', async () => {
    const at = new Date('2026-10-15');
    const source: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'average-sale-value': {
          kind: 'money',
          calculation: 'mean',
          aggregation: 'contract mean',
          observations: [
            { at, value: '10', currencyCode: 'USD' },
            { at, value: '30', currencyCode: 'USD' },
            { at, value: '90', currencyCode: 'EUR' },
          ],
        },
      },
    };
    const result = await setup(source).native.load(
      { kpiIds: 'average-sale-value' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics['average-sale-value']?.value).toBe('۹۰ EUR · ۲۰ USD');
    expect(result.metrics['average-sale-value']?.trend).toBeUndefined();
    source.metrics['average-sale-value']!.observations = [];
    const empty = await setup(source).native.load(
      { kpiIds: 'average-sale-value' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(empty.metrics['average-sale-value']).toBeUndefined();
    expect(empty.unavailableMetrics?.['average-sale-value']).toBe(
      'ZERO_DENOMINATOR',
    );
  });
  it('reconciles service buckets to the monetary KPI without duplicating composite contracts', async () => {
    const at = new Date('2026-10-15');
    const source: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'fixture',
          observations: [
            {
              at,
              value: '100',
              currencyCode: 'USD',
              dimensions: { service: 'خدمات ترکیبی' },
            },
            {
              at,
              value: '20',
              currencyCode: 'USD',
              dimensions: { service: 'هتل' },
            },
            {
              at,
              value: '15',
              currencyCode: 'EUR',
              dimensions: { service: 'هتل' },
            },
          ],
        },
      },
    };
    const result = await setup(source).native.load(
      {
        kpiIds: 'net-sales,gross-profit',
        visualIds:
          'service-type,executive-sales-by-service,service-sales-portfolio',
      },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics['net-sales']?.value).toContain('۱۲۰ USD');
    for (const chart of Object.values(result.visuals)) {
      const usd = chart.currencySeries?.find(
        (series) => series.currencyCode === 'USD',
      );
      expect(usd?.values.reduce((a, b) => a + b, 0)).toBe(120);
      expect(usd?.labels).toContain('خدمات ترکیبی');
      expect(
        chart.currencySeries?.find((series) => series.currencyCode === 'EUR')
          ?.values,
      ).toEqual([15]);
    }
    expect(result.metrics['gross-profit']).toBeUndefined();
    expect(result.unavailableMetrics?.['gross-profit']).toBe(
      'APPROVED_MATCHED_COST_REQUIRED',
    );
  });
  it('connects actual registry chart IDs, separates metric and currency series, and labels missing profit', async () => {
    const sales: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'fixture',
          observations: [
            { at: new Date('2026-10-15'), value: '30', currencyCode: 'EUR' },
            { at: new Date('2026-10-15'), value: '20', currencyCode: 'USD' },
          ],
        },
        collected: { kind: 'money', aggregation: 'fixture', observations: [] },
        refunded: { kind: 'money', aggregation: 'fixture', observations: [] },
      },
    };
    const result = await setup(sales).native.load(
      {
        kpiIds: '',
        visualIds: 'executive-trend,sales-collection-trend,unknown-chart',
      },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics).toEqual({});
    const chart = result.visuals['executive-trend']!;
    expect(chart.notice).toContain('سود ناخالص');
    expect(chart.currencySeries?.map((series) => series.currencyCode)).toEqual([
      'EUR',
      'USD',
    ]);
    expect(
      chart.currencySeries?.[0]?.series?.map((series) => series.label),
    ).toEqual(['فروش خالص', 'وصول تأییدشده']);
    expect(
      chart.currencySeries?.[0]?.series?.[0]?.values.reduce((a, b) => a + b, 0),
    ).toBe(30);
    expect(
      chart.currencySeries?.[1]?.series?.[0]?.values.reduce((a, b) => a + b, 0),
    ).toBe(20);
    expect(
      chart.currencySeries?.[0]?.series?.[1]?.values.every(
        (value) => value === 0,
      ),
    ).toBe(true);
    expect(
      result.visuals['sales-collection-trend']?.currencySeries?.[0]?.series,
    ).toHaveLength(3);
    expect(result.unavailableVisuals?.['unknown-chart']).toBe(
      'SOURCE_OR_SCOPE_UNAVAILABLE',
    );
  });
  it('wires the producer leaf modules without importing their private repositories', async () => {
    const module = await Test.createTestingModule({
      imports: [
        DashboardTestDatabaseModule,
        SalesDashboardPublicModule,
        CustomerDashboardPublicModule,
        LeadDashboardPublicModule,
        SalesDashboardPaymentsModule,
        SalesDashboardCustomersModule,
      ],
      providers: [
        ReportingNativeDashboard,
        { provide: IamFinanceDirectory, useValue: { branches: vi.fn() } },
      ],
    }).compile();
    expect(module.get(ReportingNativeDashboard)).toBeInstanceOf(
      ReportingNativeDashboard,
    );
    expect(module.get(SalesDashboardPayments)).toBeInstanceOf(
      SalesDashboardPayments,
    );
    await module.close();
  });
  it('serves actual customer data without querying an empty travel staging table', async () => {
    const { native } = setup();
    const facts = vi.fn(() => {
      throw Error('Legacy staging table must not be queried');
    });
    const service = new ReportingService(
      { facts } as never,
      undefined,
      undefined,
      native,
    );
    const result = await service.dashboardProjection(
      {
        from: '2026-10-01',
        to: '2026-10-31',
        kpiIds: 'new-customers,new-leads,gross-profit',
      },
      actor,
    );
    expect(result.state).toBe('ready');
    expect(result.metrics['new-customers']?.value).toBe('۲');
    expect(result.metrics['new-leads']).toBeUndefined();
    expect(result.metrics['gross-profit']).toBeUndefined();
    expect(result.metadata?.reportVersion).toBe(
      'reporting.dashboard.native.v1',
    );
    expect(facts).not.toHaveBeenCalled();
  });
  it('does not erase working domains or invent zero after another source fails', async () => {
    const { native, salesReader } = setup();
    salesReader.read.mockRejectedValue(Error('PRIVATE_DATABASE_DETAILS'));
    const result = await native.load(
      { kpiIds: 'new-customers,net-sales' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics['new-customers']?.value).toBe('۲');
    expect(result.metrics['net-sales']).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('PRIVATE_DATABASE_DETAILS');
    expect(
      result.sourceCoverage?.some((source) => source.state === 'unavailable'),
    ).toBe(true);
  });
  it('distinguishes an authorized genuine zero from missing source permission', async () => {
    const zero = {
      ...customerResult,
      metrics: {
        'new-customers': {
          ...customerResult.metrics['new-customers']!,
          observations: [],
        },
      },
    };
    const { native } = setup(absent(), zero);
    const result = await native.load(
      { kpiIds: 'new-customers' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.state).toBe('ready');
    expect(result.metrics['new-customers']?.value).toBe('۰');
    const blocked = await setup(absent(), absent()).native.load(
      { kpiIds: 'new-customers' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(blocked.state).toBe('blocked');
    expect(blocked.metrics).toEqual({});
  });
  it('rejects an unauthorized branch instead of silently ignoring the filter', async () => {
    const { native, customerReader } = setup();
    await expect(
      native.load(
        { kpiIds: 'new-customers' },
        actor,
        { ...filters, branch: 'Other Branch' },
        new Date('2026-11-01'),
      ),
    ).rejects.toThrow();
    expect(customerReader.read).not.toHaveBeenCalled();
  });
  it('keeps issuer context separate from operational branch permissions', async () => {
    const { native, customerReader } = setup();
    const result = await native.load(
      { kpiIds: 'new-customers', legalEntity: 'NIYAYESH_SEIR_SAHAR' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics['new-customers']?.value).toBe('۲');
    expect(customerReader.read.mock.calls[0]?.[0].filters).not.toHaveProperty(
      'legalEntity',
    );
    expect(customerReader.read.mock.calls[0]?.[0].actor.branchIds).toEqual([
      'branch-a',
    ]);
  });
  it('can return the sales chart independently of selected KPI cards', async () => {
    const sales: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'synthetic',
          observations: [
            { at: new Date('2026-10-15'), value: '10', currencyCode: 'USD' },
          ],
        },
      },
    };
    const result = await setup(sales).native.load(
      { kpiIds: '', visualIds: 'revenue-collections' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.state).toBe('ready');
    expect(result.metrics).toEqual({});
    expect(
      result.visuals['revenue-collections']?.currencySeries?.[0]?.currencyCode,
    ).toBe('USD');
    expect(
      result.visuals['revenue-collections']?.values.reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(10);
  });
  it('keeps currencies separate and preserves exact large monetary totals', async () => {
    const sales: DashboardSourceResult = {
      source: 'sales',
      state: 'ready',
      metrics: {
        'net-sales': {
          kind: 'money',
          aggregation: 'synthetic verified totals',
          observations: [
            {
              at: new Date('2026-10-15'),
              value: '9007199254740993.1234',
              currencyCode: 'IRR',
            },
            { at: new Date('2026-10-15'), value: '10.25', currencyCode: 'USD' },
          ],
        },
      },
    };
    const result = await setup(sales).native.load(
      { kpiIds: 'net-sales' },
      actor,
      filters,
      new Date('2026-11-01'),
    );
    expect(result.metrics['net-sales']?.value).toContain(
      '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۱۲۳۴ IRR',
    );
    expect(result.metrics['net-sales']?.value).toContain('۱۰٫۲۵ USD');
    expect(result.metrics['net-sales']?.trend).toBeUndefined();
    expect(result.metadata?.currencyFxBasis).toBe(
      'SOURCE_CURRENCY_NO_CONVERSION',
    );
  });
});

describe('producer-owned native dashboard readers', () => {
  it('puts a multi-service contract in one composite bucket with its complete amount once', async () => {
    const at = new Date('2026-10-15');
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          createdAt: at,
          confirmedAt: at,
          services: [{ kind: 'FLIGHT' }, { kind: 'HOTEL' }],
          payments: [],
          priceComponents: [
            {
              type: 'BASE',
              title: 'fixture',
              amount: new Prisma.Decimal(100),
              currencyCode: 'USD',
            },
          ],
        },
      ])
      .mockResolvedValueOnce([]);
    const result = await new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never).read(query);
    expect(result.metrics['net-sales']?.observations).toEqual([
      {
        at,
        value: '100',
        currencyCode: 'USD',
        dimensions: { service: 'خدمات ترکیبی' },
      },
    ]);
  });
  it('counts new orders by creation independently of finalized contracts', async () => {
    const at = new Date('2026-10-15');
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ createdAt: at }]);
    const result = await new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never).read(query);
    expect(result.metrics['new-orders']?.observations).toEqual([
      { at, value: '1' },
    ]);
    expect(result.metrics['finalized-sales-count']?.observations).toEqual([]);
    expect(findMany.mock.calls[1]?.[0].where.AND).toContainEqual({
      createdAt: { gte: query.from, lt: query.to },
    });
    expect(JSON.stringify(findMany.mock.calls[1]?.[0].where)).not.toContain(
      'confirmedAt',
    );
  });
  it('counts each finalized contract once, not once per price component or currency', async () => {
    const at = new Date('2026-10-15');
    const findMany = vi.fn().mockResolvedValue([
      {
        createdAt: at,
        confirmedAt: at,
        payments: [],
        priceComponents: [
          {
            type: 'BASE',
            title: 'Synthetic',
            amount: new Prisma.Decimal('100'),
            currencyCode: 'USD',
          },
          {
            type: 'BASE',
            title: 'Synthetic',
            amount: new Prisma.Decimal('200'),
            currencyCode: 'EUR',
          },
        ],
      },
      { createdAt: at, confirmedAt: at, payments: [], priceComponents: [] },
    ]);
    const source = new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never);
    expect(
      (await source.read(query)).metrics['finalized-sales-count']?.observations,
    ).toHaveLength(2);
    const usd = await source.read({
      ...query,
      filters: { currencyCode: 'USD' },
    });
    expect(usd.metrics['finalized-sales-count']?.observations).toHaveLength(1);
    expect(usd.metrics['gross-sales']?.observations).toEqual([
      { at, value: '100', currencyCode: 'USD' },
    ]);
  });
  it('applies own+branch sales scope, canonical discounts and completed refunds once per currency', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        createdAt: new Date('2026-10-12'),
        confirmedAt: new Date('2026-10-15'),
        priceComponents: [
          {
            type: 'BASE',
            title: 'Synthetic',
            amount: new Prisma.Decimal('110'),
            currencyCode: 'USD',
          },
          {
            type: 'DISCOUNT',
            title: 'Synthetic',
            amount: new Prisma.Decimal('10'),
            currencyCode: 'USD',
          },
        ],
        payments: [
          {
            currencyCode: 'USD',
            refunds: [{ amount: new Prisma.Decimal('25') }],
          },
        ],
      },
    ]);
    const source = new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never);
    const result = await source.read(query);
    expect(findMany.mock.calls[0]?.[0].where.AND[0]).toEqual({
      branchId: { in: ['branch-a'] },
      ownerUserId: 'owner',
    });
    expect(result.metrics['gross-sales']?.observations[0]?.value).toBe('110');
    expect(result.metrics['discount-amount']?.observations[0]?.value).toBe(
      '10',
    );
    expect(result.metrics['finalized-sales-count']?.observations).toHaveLength(
      1,
    );
    expect(result.metrics['net-sales']?.observations[0]?.value).toBe('75');
    expect(findMany.mock.calls[0]?.[0].select.passengers).toBeUndefined();
    expect(findMany.mock.calls[0]?.[0].select.payments.where.status).toBe(
      'FINANCE_CONFIRMED',
    );
    expect(
      findMany.mock.calls[0]?.[0].select.payments.select.refunds.where.createdAt
        .lt,
    ).toEqual(query.to);
  });
  it('never treats reporting permission alone as permission to read sales', async () => {
    const findMany = vi.fn();
    const source = new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never);
    expect(
      (
        await source.read({
          ...query,
          actor: { ...actor, permissions: ['reporting.read'] },
        })
      ).state,
    ).toBe('forbidden');
    expect(findMany).not.toHaveBeenCalled();
  });
  it('does not discard unsupported sales filters or infer issuer company ownership', async () => {
    const findMany = vi.fn();
    const source = new SalesDashboardSource({
      client: { salesContract: { findMany } },
    } as never);
    expect(
      (await source.read({ ...query, filters: { provider: 'Synthetic' } }))
        .state,
    ).toBe('unsupported');
    expect(
      (await source.read({ ...query, filters: { legalEntity: 'NIYAYESH' } }))
        .state,
    ).toBe('unsupported');
    expect(findMany).not.toHaveBeenCalled();
  });
  it('counts customer identities independently of sales and excludes merged/passenger-only identities', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ createdAt: new Date('2026-10-15') }]);
    const source = new CustomerDashboardSource({
      client: { customer: { findMany } },
    } as never);
    expect(
      (await source.read(query)).metrics['registered-customers']?.observations,
    ).toHaveLength(1);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      ownerBranchId: { in: ['branch-a'] },
      isCustomer: true,
      mergedIntoId: null,
      createdAt: { gte: query.from, lt: query.to },
    });
    expect(findMany.mock.calls[0]?.[0].select).toEqual({ createdAt: true });
  });
  it('treats real empty lead source as zero without inventing leads from contracts', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const result = await new LeadDashboardSource(
      {
        client: { customerAffairsLead: { findMany } },
      } as never,
      { convertedLeadReferencesV1: vi.fn() } as never,
    ).read(query);
    expect(result.state).toBe('ready');
    expect(result.metrics['new-leads']?.observations).toEqual([]);
  });
  it('refuses silently truncated totals', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 10001 }, () => ({ createdAt: query.from })),
      );
    const source = new CustomerDashboardSource({
      client: { customer: { findMany } },
    } as never);
    expect(await source.read(query)).toMatchObject({
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    });
  });
});
