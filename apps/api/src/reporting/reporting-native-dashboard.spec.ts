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
  it('wires the producer leaf modules without importing their private repositories', async () => {
    const module = await Test.createTestingModule({
      imports: [
        DashboardTestDatabaseModule,
        SalesDashboardPublicModule,
        CustomerDashboardPublicModule,
        LeadDashboardPublicModule,
      ],
      providers: [
        ReportingNativeDashboard,
        { provide: IamFinanceDirectory, useValue: { branches: vi.fn() } },
      ],
    }).compile();
    expect(module.get(ReportingNativeDashboard)).toBeInstanceOf(
      ReportingNativeDashboard,
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
    expect(result.metrics['gross-sales']?.observations[0]?.value).toBe('100');
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
      (await source.read(query)).metrics['new-customers']?.observations,
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
    const result = await new LeadDashboardSource({
      client: { customerAffairsLead: { findMany } },
    } as never).read(query);
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
