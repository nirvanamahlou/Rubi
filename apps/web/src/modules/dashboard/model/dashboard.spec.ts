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
  it('defines all 84 decision-oriented KPIs with auditable metadata', () => {
    expect(dashboardKpis).toHaveLength(84);
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

  it('covers the requested executive sales, customer, lead and cancellation decisions', () => {
    const executive = dashboardPages.find(
      (page) => page.id === 'executive-overview',
    );
    const executiveDetail = dashboardPages.find(
      (page) => page.id === 'executive-growth-risk',
    );
    const executiveKpis = [
      ...(executive?.kpiIds ?? []),
      ...(executiveDetail?.kpiIds ?? []),
    ];
    const executiveVisuals = [
      ...(executive?.visualizations ?? []),
      ...(executiveDetail?.visualizations ?? []),
    ];
    expect(executiveKpis).toEqual(
      expect.arrayContaining([
        'collected',
        'net-sales',
        'new-customers',
        'returning-customers',
        'new-leads',
        'lead-growth-rate',
        'lead-conversion-rate',
        'cancelled-reservations',
      ]),
    );
    expect(executiveVisuals.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'executive-trend',
        'executive-sales-by-service',
        'executive-customer-retention',
        'executive-lead-acquisition',
        'executive-lead-conversion',
        'executive-reservation-cancellations',
      ]),
    );
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'new-customers')?.rule,
    ).toContain('نخستین خرید پرداخت‌شده');
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'returning-customers')?.rule,
    ).toContain('پیش از شروع بازه');
  });

  it('covers employee activity and sales without using sale count as converted lead count', () => {
    const employeePages = dashboardPages.filter((page) =>
      [
        'employee-commercial-performance',
        'employee-crm-activity',
        'employee-sales-quality',
      ].includes(page.id),
    );
    expect(employeePages.flatMap((page) => page.kpiIds)).toEqual(
      expect.arrayContaining([
        'employee-lead-count',
        'employee-call-count',
        'employee-followup-count',
        'employee-finalized-sales-count',
        'employee-sales-amount',
        'employee-lead-conversion',
        'employee-average-sale',
        'employee-contract-count',
        'employee-cancellation-count',
        'employee-sales-rank',
      ]),
    );
    expect(
      new Set(
        employeePages.flatMap((page) =>
          page.visualizations.map((visual) => visual.id),
        ),
      ).size,
    ).toBe(10);
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'employee-lead-conversion')?.rule,
    ).toContain('تعداد قرارداد به‌جای تعداد لید تبدیل‌شده استفاده نمی‌شود');
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'employee-average-sale')
        ?.exclusions,
    ).toContain('میانگین ارزهای متفاوت');
  });

  it('covers customer interests, destination, service and acquisition-channel analysis', () => {
    const customerGrowth = dashboardPages.find(
      (page) => page.id === 'customer-behavior-analysis',
    );
    expect(customerGrowth?.kpiIds).toEqual(
      expect.arrayContaining([
        'customer-interest-coverage',
        'customer-destination-demand',
        'customer-service-usage',
        'customers-by-acquisition-channel',
      ]),
    );
    expect(customerGrowth?.visualizations.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'customer-interest-distribution',
        'customer-destination-distribution',
        'customer-service-distribution',
        'customer-acquisition-channel-mix',
        'customer-acquisition-channel-trend',
      ]),
    );
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'customer-interest-coverage')
        ?.exclusions,
    ).toContain('متن آزاد طبقه‌بندی‌نشده');
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'customers-by-acquisition-channel')
        ?.source,
    ).toContain('reporting_customer_portfolio_growth_facts_v1');
  });

  it('covers financial income, profit, expenses, commissions, debt and refunds without duplicate KPIs', () => {
    const commercial = dashboardPages.find(
      (page) => page.id === 'commercial-performance',
    );
    const finance = dashboardPages.find(
      (page) => page.id === 'finance-treasury',
    );
    const financeProfitability = dashboardPages.find(
      (page) => page.id === 'finance-profitability-costs',
    );
    const financeObligations = dashboardPages.find(
      (page) => page.id === 'finance-obligations-risk',
    );
    const revenue = dashboardPages.find(
      (page) => page.id === 'revenue-collections',
    );
    const marketing = dashboardPages.find(
      (page) => page.id === 'marketing-growth',
    );

    const financeKpis = [
      ...(finance?.kpiIds ?? []),
      ...(financeProfitability?.kpiIds ?? []),
      ...(financeObligations?.kpiIds ?? []),
    ];
    const financeVisuals = [
      ...(finance?.visualizations ?? []),
      ...(financeProfitability?.visualizations ?? []),
      ...(financeObligations?.visualizations ?? []),
    ];
    expect(financeKpis).toEqual(
      expect.arrayContaining([
        'gross-profit',
        'net-profit',
        'operating-expenses',
        'paid-commissions',
        'receivables',
      ]),
    );
    expect(financeVisuals.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'finance-profit-trend',
        'gross-profit-by-service',
        'expense-structure',
        'expense-trend',
        'paid-commission-by-recipient',
        'paid-commission-trend',
        'customer-debt-aging',
      ]),
    );
    expect(revenue?.visualizations.map((item) => item.id)).toContain(
      'refund-by-service',
    );
    expect(marketing?.kpiIds).toContain('advertising-spend');
    expect(marketing?.visualizations.map((item) => item.id)).toContain(
      'advertising-spend-by-channel',
    );
    expect(
      commercial?.visualizations.find((item) => item.id === 'service-type'),
    ).toMatchObject({
      title: 'درآمد به تفکیک نوع خدمت',
      drilldown: '/reports?report=sales_by_service_route',
    });
    expect(
      dashboardKpis.filter((kpi) => kpi.id === 'receivables'),
    ).toHaveLength(1);
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'net-profit')?.rule,
    ).toContain('حساب‌های درآمد Posted');
  });

  it('covers sales and travel-service analysis without duplicating time-grain charts', () => {
    const commercialPages = dashboardPages.filter((page) =>
      [
        'commercial-performance',
        'sales-profitability-analysis',
        'sales-segment-analysis',
      ].includes(page.id),
    );
    const travelPages = dashboardPages.filter((page) =>
      ['travel-operations', 'flight-route-analysis'].includes(page.id),
    );
    const inventoryPages = dashboardPages.filter((page) =>
      ['inventory-products', 'tour-hotel-performance'].includes(page.id),
    );
    const commercialKpis = commercialPages.flatMap((page) => page.kpiIds);
    const commercialVisualIds = commercialPages.flatMap((page) =>
      page.visualizations.map((item) => item.id),
    );
    const travelKpis = travelPages.flatMap((page) => page.kpiIds);
    const travelVisualIds = travelPages.flatMap((page) =>
      page.visualizations.map((item) => item.id),
    );
    const inventoryKpis = inventoryPages.flatMap((page) => page.kpiIds);
    const inventoryVisualIds = inventoryPages.flatMap((page) =>
      page.visualizations.map((item) => item.id),
    );

    expect(commercialKpis).toEqual(
      expect.arrayContaining([
        'gross-sales',
        'finalized-sales-count',
        'average-sale-value',
        'discount-amount',
        'gross-profit',
      ]),
    );
    expect(commercialVisualIds).toEqual(
      expect.arrayContaining([
        'finalized-sales-trend',
        'sales-weekday-pattern',
        'average-sale-trend',
        'discount-analysis',
        'discount-trend',
        'service-sales-portfolio',
        'sales-destination-ranking',
        'sales-country-ranking',
        'sales-channel-trend',
      ]),
    );
    expect(
      commercialPages
        .flatMap((page) => page.visualizations)
        .find((item) => item.id === 'service-sales-portfolio')?.kind,
    ).toBe('donut');
    expect(travelKpis).toEqual(
      expect.arrayContaining([
        'average-ticket-price',
        'ticket-cancellation-rate',
      ]),
    );
    expect(travelVisualIds).toEqual(
      expect.arrayContaining([
        'airline-sales-performance',
        'route-sales-performance',
        'average-ticket-price-trend',
        'ticket-cancellation-analysis',
      ]),
    );
    expect(inventoryKpis).toEqual(
      expect.arrayContaining([
        'tour-reservations',
        'tour-remaining-capacity',
        'tour-sell-through-rate',
        'hotel-reservations',
        'average-stay-length',
      ]),
    );
    expect(inventoryVisualIds).toEqual(
      expect.arrayContaining([
        'tour-sales-ranking',
        'tour-capacity-performance',
        'hotel-sales-ranking',
        'popular-hotel-cities',
        'average-stay-analysis',
      ]),
    );
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'average-sale-value')?.rule,
    ).toContain('در صورت صفر بودن مخرج نتیجه ناموجود است');
    expect(
      dashboardKpis.find((kpi) => kpi.id === 'discount-amount')?.rule,
    ).toContain('DISCOUNT');
  });

  it('uses donut only for explicit low-cardinality share visuals', () => {
    const visuals = dashboardPages.flatMap((page) => page.visualizations);
    expect(visuals.find((item) => item.id === 'collection-status')?.kind).toBe(
      'donut',
    );
    expect(
      visuals.find((item) => item.id === 'customer-service-distribution')?.kind,
    ).toBe('donut');
    expect(
      visuals.find((item) => item.id === 'sales-destination-ranking')?.kind,
    ).toBe('bar');
  });

  it('keeps summary pages focused and moves related analysis into sidebar subpages', () => {
    expect(dashboardPages).toHaveLength(27);
    expect(dashboardNavigation).toEqual([
      {
        pageId: 'executive-overview',
        children: [{ pageId: 'executive-growth-risk' }],
      },
      {
        pageId: 'commercial-performance',
        children: [
          { pageId: 'sales-profitability-analysis' },
          { pageId: 'sales-segment-analysis' },
          { pageId: 'revenue-collections' },
          { pageId: 'travel-operations' },
          { pageId: 'flight-route-analysis' },
          { pageId: 'inventory-products' },
          { pageId: 'tour-hotel-performance' },
          { pageId: 'procurement-suppliers' },
        ],
      },
      {
        pageId: 'finance-treasury',
        children: [
          { pageId: 'finance-profitability-costs' },
          { pageId: 'finance-obligations-risk' },
        ],
      },
      {
        pageId: 'customer-growth',
        children: [
          { pageId: 'customer-behavior-analysis' },
          { pageId: 'customer-crm' },
          { pageId: 'support-service-quality' },
          { pageId: 'partners-b2b' },
          { pageId: 'marketing-growth' },
        ],
      },
      {
        pageId: 'workforce-hr',
        children: [
          { pageId: 'hr-record-quality' },
          { pageId: 'employee-commercial-performance' },
          { pageId: 'employee-crm-activity' },
          { pageId: 'employee-sales-quality' },
        ],
      },
    ]);
    const navigationIds = dashboardNavigation.flatMap((item) => [
      item.pageId,
      ...(item.children?.map((child) => child.pageId) ?? []),
    ]);
    expect(navigationIds).toHaveLength(25);
    expect(navigationIds).not.toContain('tasks-automation');
    expect(navigationIds).not.toContain('documents-reports-data-quality');
    expect(dashboardPages.map((page) => page.id)).toEqual(
      expect.arrayContaining([
        'tasks-automation',
        'documents-reports-data-quality',
      ]),
    );
    for (const pageId of [
      'executive-overview',
      'commercial-performance',
      'finance-treasury',
      'customer-growth',
      'workforce-hr',
    ]) {
      const page = dashboardPages.find((item) => item.id === pageId)!;
      expect(page.kpiIds.length).toBeLessThanOrEqual(6);
      expect(page.visualizations.length).toBeLessThanOrEqual(4);
    }
    for (const pageId of navigationIds) {
      const page = dashboardPages.find((item) => item.id === pageId)!;
      expect(page.kpiIds.length).toBeLessThanOrEqual(6);
      expect(page.visualizations.length).toBeLessThanOrEqual(5);
      expect(page.visualizations.length).toBeGreaterThan(0);
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
  it('keeps a blocked state when the API base URL is unavailable', async () => {
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
      metrics: {},
      visuals: {},
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

  it('keeps the UI explicit about every state and renders only projection values', () => {
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
      'query.isPending',
      'query.isError',
      "state === 'forbidden'",
      "state === 'empty'",
      "state === 'stale'",
    ])
      expect(source).toContain(state);
    expect(source).toContain('داده‌ای دریافت نشده');
    expect(source).not.toMatch(/\b(value|amount|count):\s*\d+/);
    expect(source).not.toContain('Math.random');
    expect(source).toContain('min-w-0');
    expect(source).toContain('DashboardSidebar');
    expect(source).toContain('data-dashboard-sidebar');
    expect(source).toContain('data-dashboard-kpi');
    expect(source).toContain('data-dashboard-visual');
    expect(source).toContain('OperationalDataTable');
    expect(source).toContain('EmployeePerformanceBars');
    expect(source).toContain('MiniTrend');
    expect(source).toContain('GrowthIndicator');
    expect(source).toContain(
      'comparison?: DashboardComparisonSnapshot | undefined;',
    );
    expect(source).toContain('!hasComparison || unavailable');
    expect(source).not.toContain('comparisonUnavailableForPeriod');
    expect(source).toContain('currencyMetricParts');
    expect(source).toContain('compactCurrencyAmount');
    expect(source).toContain('compactCurrencyTypography');
    expect(source).toContain('compactChartValue');
    expect(source).toContain('trendTemporalGrain');
    expect(source).toContain('trendDateLabel');
    expect(source).toContain('trendTooltipTime');
    expect(source).not.toContain('بازه انتخاب‌شده — ${labels[index]}');
    expect(source).toContain('adverseKpiIdPattern');
    expect(source).toContain("definition.role === 'guardrail'");
    expect(source).toContain("semanticTone === 'negative'");
    expect(source).toContain('trendCalendarOptions');
    expect(source).toContain('تقویم برچسب‌های محور زمان');
    expect(source).toContain("key) => key === 'currency'");
    expect(source).not.toContain(
      'comparisonValues?: readonly number[] | undefined;',
    );
    expect(source).not.toContain('strokeDasharray="5 6"');
    expect(source).toContain('strokeDasharray="2 5"');
    expect(source).toContain('preserveAspectRatio="none"');
    expect(source).not.toContain('تاریخ (${calendarLabel})');
    expect(source).not.toContain('transform="rotate(-90 18 82)"');
    expect(source).toContain('formatDashboardNumber');
    expect(source).toContain('latinizeDashboardNumericText');
    expect(source).toContain("Intl.NumberFormat('en-US'");
    expect(source).toContain(".replaceAll('میلیون', 'M')");
    expect(source).not.toContain("toLocaleString('fa-IR')");
    expect(source).toContain('whitespace-nowrap');
    expect(source).toContain('[container-type:inline-size]');
    expect(source).toContain('cqw');
    expect(source).not.toContain('KpiComparisonBadges');
    expect(source).toContain('linearGradient');
    expect(source).toContain('stopOpacity="0.32"');
    expect(source).toContain('h-14 w-full overflow-visible');
    expect(source).not.toContain('هر ارز مستقل و بدون تبدیل نمایش داده می‌شود');
    expect(source).toContain('currencySymbols');
    expect(source).toContain('راهنمای روند ارزها');
    expect(source).toContain('data-dashboard-employee-visual');
    expect(source).toContain('مقیاس نوار: بیشترین مقدار');
    expect(source).toContain("visualId.startsWith('employee-')");
    expect(source).not.toContain('شاخص‌های کلیدی');
    expect(source).not.toContain('تحلیل‌های تصمیم‌ساز');
    expect(source).toContain('kpiGridColumns(activePageKpis.length)');
    expect(source).toContain('hover:bg-primary hover:text-primary-foreground');
    expect(source).toContain(
      'data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground',
    );
    expect(source).toContain('xl:grid-cols-3 2xl:grid-cols-6');
    expect(source).toContain('dashboardVisualIsWide(');
    expect(source).toContain("kind === 'line'");
    expect(source).toContain("kind === 'table'");
    expect(source).toContain("kind === 'queue'");
    expect(source).not.toContain('grid-flow-row-dense');
    expect(source).toContain('فیچرهای استفاده‌شده در فرمول');
    expect(source).toContain('calculationFeatureFor(source)');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).not.toContain('جزئیات تعریف شاخص');
    expect(source).toContain('<Drawer');
    expect(source).toContain('id="kpi-definition-panel"');
    expect(source).toContain('تعریف و هدف کسب‌وکار');
    expect(source).toContain(
      'این شاخص نشان می‌دهد «{definition.title}» در بازه و فیلترهای',
    );
    expect(source).toContain('این شاخص برای پاسخ به این تصمیم استفاده می‌شود:');
    expect(source).not.toContain('تصمیم: </span>');
    const kpiCardSource = source.slice(
      source.indexOf('function KpiCard'),
      source.indexOf('function KpiDefinitionPanel'),
    );
    expect(kpiCardSource).not.toContain('definition.dateBasis');
    expect(kpiCardSource).not.toContain('definition.reportCode');
    expect(kpiCardSource).not.toContain('ارز/FX الزامی');
    const projectionSlotSource = source.slice(
      source.indexOf('function ProjectionSlot'),
      source.indexOf('function DashboardSidebar'),
    );
    expect(projectionSlotSource).not.toContain('data?.comparison');
    expect(projectionSlotSource).not.toContain('data?.trend');
    expect(projectionSlotSource).not.toContain('روند بازهٔ انتخاب‌شده');
    expect(projectionSlotSource).not.toContain('منبع:');
    const kpiDefinitionPanelSource = source.slice(
      source.indexOf('function KpiDefinitionPanel'),
      source.indexOf('function DimensionFilter'),
    );
    expect(kpiDefinitionPanelSource).not.toContain('سطح محاسبه (Grain)');
    expect(kpiDefinitionPanelSource).not.toContain('مبنای زمانی');
    expect(kpiDefinitionPanelSource).not.toContain('سیاست واحد پول');
    expect(kpiDefinitionPanelSource).not.toContain('مبنای مقایسه');
    expect(kpiDefinitionPanelSource).not.toContain('definition.grain');
    expect(kpiDefinitionPanelSource).not.toContain('definition.dateBasis');
    expect(kpiDefinitionPanelSource).toContain('مقدار دقیق در بازهٔ انتخابی');
    expect(kpiDefinitionPanelSource).toContain("metric.value.split(' · ')");
    expect(kpiDefinitionPanelSource).not.toContain('definition.comparison');
    expect(kpiDefinitionPanelSource).not.toContain('تعریف قابل ممیزی KPI');
    expect(kpiDefinitionPanelSource).not.toContain('KPI ID:');
    expect(kpiDefinitionPanelSource).not.toContain('فیچرها و منابع داده');
    expect(kpiDefinitionPanelSource).not.toContain('حاکمیت و ردگیری');
    expect(kpiDefinitionPanelSource).toContain('size="icon"');
    expect(kpiDefinitionPanelSource).toContain('<X aria-hidden="true"');
    expect(kpiDefinitionPanelSource).toContain('text-2xl font-black');
    expect(kpiDefinitionPanelSource).toContain('!text-white');
    expect(kpiDefinitionPanelSource).toContain('hover:!text-white');
    expect(kpiDefinitionPanelSource).toContain('focus-visible:!text-white');
    expect(kpiDefinitionPanelSource).toContain('[&_*]:!text-white');
    expect(kpiDefinitionPanelSource).toContain('[&_svg]:!text-white');
    expect(kpiDefinitionPanelSource).toContain('فیچرهای استفاده‌شده در فرمول');
    expect(kpiDefinitionPanelSource).toContain('definition.source.map');
    expect(kpiDefinitionPanelSource).toContain('calculationFeatureFor(source)');
    expect(source).toContain('recognized sale revenue');
    expect(source).toContain('matched purchase cost');
    expect(source).toContain('فرمول و قاعده محاسبه');
    expect(source).toContain('حذف‌ها و محدودیت‌های محاسبه');
    expect(source).toContain('رفتن به فرم پیکربندی گزارش مرتبط');
    expect(source).toContain('onOpenReportConfiguration(report.code)');
    expect(source).toContain('configurationOnly');
    expect(source).toContain('dashboardReportCodeFromDrilldown');
    expect(source).not.toContain('<Link href={reportHref}>');
    expect(source).toContain('setReportConfigurationCode(reportCode);\n  };');
    expect(source).toContain('() => new Set(),');
    expect(source).not.toContain(
      "new Set(['commercial-performance', 'customer-growth', 'workforce-hr'])",
    );
    expect(source).toContain('visualLabels');
    expect(source).toContain('EmptyVisualCanvas');
    expect(source).toContain('dashboardVisualKindForData');
    expect(source).toContain('<polyline');
    expect(source).toContain('strokeDashoffset={-segment.start}');
    expect(source).toContain('externalLabels');
    expect(source).toContain('ringEdgeX');
    expect(source).toContain('lineEndY');
    expect(source).toContain('connectorEndX');
    expect(source).toContain('labelY');
    expect(source).toContain('textAnchor="middle"');
    expect(source).toContain('compactChartValue(item.value)');
    expect(source).toContain('max-w-[26rem]');
    expect(source).toContain('const donutCenterY = 160');
    expect(source).toContain('strokeWidth={22}');
    expect(source).toContain('comparisonRankPalette');
    expect(source).toContain('comparisonRankColor');
    expect(source).toContain("'#93c5fd'");
    expect(source).not.toContain('قرارداد state و دسترسی');
    expect(source).not.toContain('تصمیم‌های باز و metadata');
    expect(source).toContain('میانگین روند');
    expect(source).toContain('rankedRows');
    expect(source).toContain('جمع نمایش‌داده‌شده');
    expect(source).toContain('values.length > 6');
    expect(source).toContain('خلاصه متنی و جدول داده');
    expect(source).toContain('تفکیک زمانی:');
    expect(source).toContain('<table');
    expect(source).toContain('role="img"');
    expect(source).toContain('focus-visible:ring-offset-2');
    expect(source).not.toContain('منبع داده');
    expect(source).not.toContain('تازگی داده');
    expect(source).not.toContain('پوشش داده');
    expect(source).not.toContain('آخرین Refresh');
    expect(source).toContain('دادهٔ تأییدشده برای نمایش موجود نیست');
    expect(source).not.toContain('KPI و تحلیل‌های عملیاتی');
    for (const title of [
      'فروش امروز',
      'فروش این هفته',
      'فروش این ماه',
      'فروش این فصل',
      'فروش بازه انتخابی',
    ])
      expect(source).toContain(title);
    expect(source).toContain('items-baseline');
    expect(source).toContain('dashboard-sidebar-filters-title');
    expect(source).toContain('ActivePageIcon');
    expect(source).toContain('dashboardHeaderThemeByPageId');
    expect(source).toContain('activePageHeaderTheme');
    expect(source).toContain('dashboardHeaderArtworkByPageId');
    expect(source).toContain('activePageHeaderArtwork');
    expect(source).toContain(
      "'/images/dashboard-headers/executive-overview.png'",
    );
    expect(source).toContain('quality={45}');
    expect(source).toContain('pointer-events-none absolute -bottom-10 -end-2');
    expect(source).toContain('size-44 stroke-[1.15] sm:size-52');
    expect(source).toContain("'tour-hotel-performance': Hotel");
    expect(source).toContain("'flight-route-analysis': Ticket");
    expect(source).toContain("'finance-obligations-risk': ShieldAlert");
    expect(source).toContain("'marketing-growth': Megaphone");
    expect(source).toContain("'employee-crm-activity': PhoneCall");
    expect(source).toContain('items-center text-center');
    expect(source).toContain("'from-cyan-50 via-surface to-blue-50");
    expect(source).toContain(
      'max-w-2xl text-sm leading-6 text-muted-foreground',
    );
    expect(source).toContain('lg:sticky lg:top-20');
    expect(source).toContain('lg:overflow-y-auto');
    expect(source).toContain('صفحه‌های داشبورد');
    expect(source).toContain('فیلترهای این صفحه');
    expect(source).toContain('فیلترهای ${activePage.title}');
    expect(source).toContain('statusFilterCopyByPage');
    expect(source).toContain('semanticFilterCopyByPage');
    expect(source).toContain('وضعیت رزرو و صدور');
    expect(source).toContain('وضعیت مالی');
    expect(source).toContain('کانال جذب');
    expect(source).toContain('کارشناس پشتیبانی');
    expect(source).toContain("activePanel === 'filters'");
    expect(source).toContain('پاک‌کردن ${activeFiltersTitle}');
    expect(source).toContain('page: activePage.id');
    expect(source.match(/id="dashboard-range"/g)).toHaveLength(2);
    expect(source).toContain('dashboard-date-range-error');
    expect(source.match(/gregorianEnglish/g)).toHaveLength(2);
    expect(source.match(/calendarSystem=\{dateCalendarSystem\}/g)).toHaveLength(
      2,
    );
    expect(
      source.match(/onCalendarSystemChange=\{setDateCalendarSystem\}/g),
    ).toHaveLength(2);
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
