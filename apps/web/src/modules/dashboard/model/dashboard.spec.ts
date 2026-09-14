import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { dashboardProjectionClient } from './projection-client';
import {
  dashboardDateRangeError,
  dashboardFilterSnapshot,
  dashboardFiltersFromSearchParams,
  dashboardFiltersToSearchParams,
  defaultDashboardFilters,
} from './query';
import {
  dashboardKpis,
  dashboardNavigation,
  dashboardOpenDecisions,
  dashboardPages,
} from './registry';

describe('dashboard registry', () => {
  it('defines all 51 decision-oriented KPIs with auditable metadata', () => {
    expect(dashboardKpis).toHaveLength(51);
    expect(new Set(dashboardKpis.map((kpi) => kpi.id)).size).toBe(
      dashboardKpis.length,
    );
    for (const kpi of dashboardKpis) {
      expect(kpi.grain).not.toBe('');
      expect(kpi.rule).not.toBe('');
      expect(kpi.exclusions).not.toBe('');
      expect(kpi.source.length).toBeGreaterThan(0);
      expect(kpi.permission).toMatch(/^reports\.dashboard\./);
      expect(['required', 'not-applicable']).toContain(kpi.currency);
      expect(['outcome', 'driver', 'guardrail', 'diagnostic']).toContain(
        kpi.role,
      );
      expect(kpi.decision).not.toBe('');
      expect(kpi.comparison).not.toBe('');
      expect(kpi.reportCode).toMatch(/^RPT-\d{3}$/);
    }
  });

  it('keeps fifteen decision-oriented pages with the requested sidebar hierarchy', () => {
    expect(dashboardPages).toHaveLength(15);
    expect(dashboardNavigation).toEqual([
      { pageId: 'executive-overview' },
      {
        pageId: 'commercial-performance',
        children: [
          { pageId: 'revenue-collections' },
          { pageId: 'travel-operations' },
          { pageId: 'inventory-products' },
          { pageId: 'procurement-suppliers' },
        ],
      },
      { pageId: 'finance-treasury' },
      {
        pageId: 'customer-growth',
        children: [
          { pageId: 'customer-crm' },
          { pageId: 'support-service-quality' },
          { pageId: 'partners-b2b' },
          { pageId: 'marketing-growth' },
        ],
      },
      { pageId: 'workforce-hr' },
    ]);
    const navigationIds = dashboardNavigation.flatMap((item) => [
      item.pageId,
      ...(item.children?.map((child) => child.pageId) ?? []),
    ]);
    expect(navigationIds).toHaveLength(13);
    expect(navigationIds).not.toContain('tasks-automation');
    expect(navigationIds).not.toContain('documents-reports-data-quality');
    expect(dashboardPages.map((page) => page.id)).toEqual(
      expect.arrayContaining([
        'tasks-automation',
        'documents-reports-data-quality',
      ]),
    );
    for (const pageId of navigationIds) {
      const page = dashboardPages.find((item) => item.id === pageId);
      expect(page?.kpiIds.length).toBeGreaterThanOrEqual(4);
      expect(page?.visualizations.length).toBeGreaterThanOrEqual(3);
    }
    for (const page of dashboardPages) {
      expect(page.technicalName).not.toBe('');
      expect(page.visualizations.length).toBeGreaterThan(0);
      for (const visualization of page.visualizations) {
        expect(visualization.source.length).toBeGreaterThan(0);
        expect(visualization.drilldown).toMatch(/^\//);
      }
    }
    expect(dashboardOpenDecisions.map(([id]) => id)).toEqual([
      'DEC-OPEN-001',
      'DEC-OPEN-004',
      'DEC-OPEN-008',
      'DEC-OPEN-009',
      'DEC-OPEN-012',
    ]);
  });

  it('never multiplies financial measures through passenger or segment grains', () => {
    const financialSources = dashboardKpis
      .filter((kpi) => kpi.currency === 'required')
      .flatMap((kpi) => kpi.source);
    expect(financialSources).not.toContain(
      'reporting_contract_passenger_facts',
    );
    expect(financialSources).not.toContain('reporting_segment_facts');
  });
});

describe('dashboard URL filters', () => {
  it('validates the custom date range before loading dashboard data', () => {
    expect(dashboardDateRangeError('2026-09-10', '2026-09-01')).toBe(
      'تاریخ شروع باید قبل از تاریخ پایان یا برابر با آن باشد.',
    );
    expect(dashboardDateRangeError('2026-09-01', '2026-09-10')).toBe('');
    expect(dashboardDateRangeError(null, '2026-09-10')).toBe('');
  });

  it('round-trips every shared filter and custom date range', () => {
    const input = new URLSearchParams(
      'range=custom&from=2026-09-01&to=2026-09-13&dateBasis=paid&salesChannel=WEB&branch=THR&agent=u1&service=FLIGHT&agency=a1&provider=p1&currency=IRR&status=SETTLED&page=finance-treasury&widget=due-checks',
    );
    const filters = dashboardFiltersFromSearchParams(input);
    expect(filters).toMatchObject({
      range: 'custom',
      dateBasis: 'paid',
      salesChannel: 'WEB',
      branch: 'THR',
      currency: 'IRR',
      page: 'finance-treasury',
      widget: 'due-checks',
    });
    expect(dashboardFiltersToSearchParams(filters).toString()).toContain(
      'provider=p1',
    );
    expect(dashboardFilterSnapshot(filters)).toEqual(filters);
  });

  it('falls back safely for unknown range and date basis', () => {
    expect(
      dashboardFiltersFromSearchParams(
        new URLSearchParams('range=tomorrow&dateBasis=deleted'),
      ),
    ).toMatchObject(defaultDashboardFilters);
  });

  it('maps legacy section links to a dashboard page without exposing task pages', () => {
    expect(
      dashboardFiltersFromSearchParams(
        new URLSearchParams('section=finance-treasury'),
      ),
    ).toMatchObject({ page: 'finance-treasury' });
  });
});

describe('dashboard permission and data states', () => {
  it('denies data by default while no public projection exists', async () => {
    await expect(
      dashboardProjectionClient.load({
        filters: defaultDashboardFilters,
        legalEntity: 'NIYAYESH_SEIR_SAHAR',
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      state: 'blocked',
      message: expect.any(String),
      metadata: null,
    });
  });

  it('honors abort signals', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      dashboardProjectionClient.load({
        filters: defaultDashboardFilters,
        legalEntity: null,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps the UI explicit about every state and never embeds fake chart values', () => {
    const source = readFileSync(
      resolve(
        process.cwd().endsWith('apps\\web') ||
          process.cwd().endsWith('apps/web')
          ? process.cwd()
          : resolve(process.cwd(), 'apps/web'),
        'src/modules/dashboard/components/dashboard-workspace.tsx',
      ),
      'utf8',
    );
    for (const state of [
      'Loading',
      'Empty',
      'Error + Retry',
      'Forbidden',
      'Stale Data',
      'Blocked',
    ])
      expect(source).toContain(state);
    expect(source).toContain('بدون دادهٔ تأییدشده');
    expect(source).not.toMatch(/\b(value|amount|count):\s*\d+/);
    expect(source).not.toContain('Math.random');
    expect(source).toContain('min-w-0');
    expect(source).toContain('DashboardSidebar');
    expect(source).toContain('kpiRoleLabels');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('<Drawer');
    expect(source).toContain('id="kpi-definition-panel"');
    expect(source).toContain('تعریف و هدف کسب‌وکار');
    expect(source).toContain('فرمول و قاعده محاسبه');
    expect(source).toContain('فیچرها و منابع داده');
    expect(source).toContain('حذف‌ها و محدودیت‌های محاسبه');
    expect(source).toContain('حاکمیت و ردگیری');
    expect(source).toContain('رفتن به فرم پیکربندی گزارش مرتبط');
    expect(source).toContain('visualLabels');
    expect(source).toContain('داده‌ای رسم نشده');
    expect(source).toContain('در انتظار دادهٔ تأییدشده');
    expect(source).toContain('items-baseline');
    expect(source).toContain('dashboard-sidebar-filters-title');
    expect(source).toContain('پاک‌کردن فیلترهای داشبورد');
    expect(source).toContain('page: activePage.id');
    expect(source.match(/id="dashboard-range"/g)).toHaveLength(2);
    expect(source).toContain('dashboard-date-range-error');
    expect(source.match(/gregorianEnglish/g)).toHaveLength(2);
    expect(source).not.toContain("disabled={filters.range !== 'custom'}");
    expect(source.indexOf('id="dashboard-from"')).toBeLessThan(
      source.indexOf('id="dashboard-range"'),
    );
    expect(source).toContain('faMessages.shell.collapseSidebar');
    expect(source).toContain('ChevronsLeft');
    expect(source).toContain('ChevronsRight');
    expect(source).not.toContain('BLOCKED_BY_PUBLIC_PROJECTION');
    expect(source).not.toContain('داشبورد مدیریتی و عملیاتی');
    expect(source).not.toContain(
      "activePage.visualizations.length.toLocaleString('fa-IR')",
    );
    expect(source).not.toMatch(/['"`]sticky\b/);
  });
});
