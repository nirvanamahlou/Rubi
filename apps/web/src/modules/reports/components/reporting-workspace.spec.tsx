import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  buildReportingFilterSnapshot,
  createAndDownloadReportExport,
  ReportCategorySelectOption,
  ReportDateRangeFields,
  reportChartTypes,
  ReportResultPanel,
  ReportingWorkspace,
  nextReportSort,
  reportResultPageSize,
  reportingAllFilterLabel,
  reportingDateRangeError,
  reportingLegalEntityLabel,
  reportingRunError,
  workspaceCountForView,
} from './reporting-workspace';
import { reportCatalog } from '../model/reporting';
import {
  ReportingApiError,
  type SalesByOrganizationReportResult,
} from '../model/client';

const reportResult: SalesByOrganizationReportResult = {
  reportCode: 'sales_by_organization',
  reportVersion: 2,
  grain: 'CONTRACT_CURRENCY',
  rowGrain: 'BRANCH_OWNER_CURRENCY',
  sourceProjection: 'sales.reporting.organization.v2',
  rows: [
    {
      grainId: 'branch-1:owner-1:IRR',
      branchId: 'branch-1',
      ownerUserId: 'owner-1',
      amount: '1250000',
      currencyCode: 'IRR',
      contractCount: 2,
      passengerCount: 4,
      ticketCount: 3,
      purchaseAmount: '900000',
      grossProfit: '350000',
      refundAmount: '50000',
      settlementBalance: '125000',
      pendingReservationActions: 1,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 5,
  previewLimit: 100,
  generatedAtUtc: '2026-09-12T08:00:00.000Z',
  sourceDataAsOfUtc: '2026-09-12T07:55:00.000Z',
  totalsByCurrency: [{ amount: '1250000', currencyCode: 'IRR' }],
  contractCount: 2,
  reconciliation: {
    matchesApprovedProjection: true,
    referenceTotalsByCurrency: [{ amount: '1250000', currencyCode: 'IRR' }],
  },
  filterSnapshot: {
    capturedAtUtc: '2026-09-12T08:00:00.000Z',
    branchIds: ['branch-1'],
    filters: {},
  },
  filterOptions: {
    branchIds: ['branch-1'],
    ownerUserIds: ['owner-1'],
    currencyCodes: ['IRR'],
    statuses: ['CONFIRMED'],
  },
  capabilities: {
    filters: ['branchId'],
    sort: ['amount'],
    unsupportedFilters: [],
  },
  warnings: [],
  summary: {
    todayContracts: 1,
    activeContracts: 2,
    unpaidContracts: 0,
    partiallySettledContracts: 0,
    settledContracts: 2,
    pendingFinancePayments: 0,
    pendingReservationActions: 1,
  },
};

function renderResultPanel(
  overrides: Partial<React.ComponentProps<typeof ReportResultPanel>> = {},
) {
  const report = reportCatalog.find(
    (item) => item.code === 'sales_by_organization',
  )!;
  return renderToStaticMarkup(
    <ReportResultPanel
      chartType="horizontal-bar"
      connected
      error={null}
      mode="table"
      onChartTypeChange={vi.fn()}
      onModeChange={vi.fn()}
      onPageChange={vi.fn()}
      onRetry={vi.fn()}
      onSortChange={vi.fn()}
      report={report}
      result={null}
      running={false}
      sort={{ column: 'amount', direction: 'DESC' }}
      started={false}
      {...overrides}
    />,
  );
}

describe('ReportingWorkspace', () => {
  it('right-aligns catalog categories with monochrome icons beside their labels', () => {
    const html = renderToStaticMarkup(
      <ReportCategorySelectOption category="فروش و قراردادها" />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('text-right');
    expect(html).toContain('text-foreground');
    expect(html).toContain('فروش و قراردادها');
    expect(html).toContain('<svg');
  });
  it('maps authoritative workspace counts to every operational navigation item', () => {
    const counts = {
      myReports: 3,
      sharedWithMe: 2,
      runs: 9,
      exports: 7,
    };

    expect(workspaceCountForView('saved', counts)).toBe(3);
    expect(workspaceCountForView('shared', counts)).toBe(2);
    expect(workspaceCountForView('recent', counts)).toBe(9);
    expect(workspaceCountForView('downloads', counts)).toBe(7);
    expect(workspaceCountForView('saved', null)).toBeUndefined();
  });

  it('creates the selected export directly and starts its download without a second dialog', async () => {
    const createExport = vi.fn(async () => ({ id: 'artifact-1' }));
    const startDownload = vi.fn();

    await expect(
      createAndDownloadReportExport({
        createExport,
        format: 'XLSX',
        query: { filters: { currencyCode: 'IRR' } },
        reportCode: 'sales_by_service_route',
        startDownload,
      }),
    ).resolves.toBe('artifact-1');

    expect(createExport).toHaveBeenCalledWith('sales_by_service_route', {
      format: 'XLSX',
      query: { filters: { currencyCode: 'IRR' } },
    });
    expect(startDownload).toHaveBeenCalledWith(
      expect.stringContaining('/reports/exports/artifact-1/download'),
    );

    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'modules',
        'reports',
        'components',
        'reporting-workspace.tsx',
      ),
      'utf8',
    );
    expect(source).not.toContain('function ExportDialog');
    expect(source).not.toContain('setExportOpen(true)');
  });
  it('renders the Persian RTL catalog without fabricated KPI values', () => {
    const html = renderToStaticMarkup(<ReportingWorkspace view="catalog" />);

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('گزارش‌ها و خروجی‌های مدیریتی');
    expect(html).toContain('در انتظار منبع داده');
    expect(html).toContain('کاتالوگ گزارش‌ها');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(
      'هر کارشناس چه تعداد قرارداد و چه مبلغ فروشی ثبت کرده است؟',
    );
    expect(html).toContain(
      'کدام پروازها و مسیرها بیشترین صدور و ظرفیت مصرف‌شده را دارند؟',
    );
    expect(html).not.toContain('اولویت اول ضروری و عملیاتی');
    expect(html).not.toContain('اولویت دوم کنترل عملکرد');
    expect(html).not.toContain('اولویت سوم تحلیلی و حاکمیتی');
    expect(html).toContain('پیکربندی گزارش');
    expect(html).toContain('اتصال محدود قابل اجرا');
    expect(html).not.toContain('آخرین به‌روزرسانی داده');
    expect(html).not.toContain('قابلیت فعلی');
    expect(html).not.toContain('RPT-001');
    expect(html).toContain('aria-label="وضعیت اتصال گزارش"');
    expect(html).not.toContain('aria-label="اولویت گزارش"');
    expect(html).not.toMatch(/>P[012]</);
    expect(html).toContain(
      'xl:grid-cols-[minmax(20rem,1fr)_repeat(2,minmax(13rem,auto))]',
    );
    expect(html).not.toContain('repeat(3,minmax(13rem,auto))');
    expect(html).not.toContain('نشان محبوب در این پروتوتایپ');
    expect(html).not.toContain('REPORTING-001 · Phase A');
    expect(html).not.toContain('وضعیت اتصال داده');
    expect(html).not.toContain('خروجی جدید');
    expect(html).toContain('whitespace-nowrap');
    expect(html).not.toContain('aria-label="افزودن به محبوب‌های این نشست"');
    expect(html).not.toContain('aria-label="حذف از محبوب‌های این نشست"');
    expect(html).not.toContain('فیلترهای قابل استفاده');
    expect(html).not.toContain('>Filter Snapshot</h2>');
    expect(html).not.toContain('id="report-from-date"');
    expect(html).not.toContain('aria-label="فیلتر وضعیت"');
    expect(html).not.toContain('نمایش نمایه نتیجه');
    expect(html).not.toContain('aria-label="نوع فایل خروجی"');
    expect(html).not.toContain('reporting.sales.read');
    expect(html).not.toMatch(/تومان|ریال|درآمد امروز/);
    expect(html).not.toContain('خانه گزارش‌ها');
  });

  it('can render only a report configuration without its reports-page shell', () => {
    const html = renderToStaticMarkup(
      <ReportingWorkspace
        configurationOnly
        initialFilterState={{
          reportCode: 'sales_by_organization',
          fromDate: '',
          toDate: '',
          legalEntity: 'ALL',
          currency: 'ALL',
          filterValues: {},
        }}
      />,
    );
    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'modules',
        'reports',
        'components',
        'reporting-workspace.tsx',
      ),
      'utf8',
    );

    expect(html).not.toContain('گزارش‌ها و خروجی‌های مدیریتی');
    expect(source).toContain('configurationOnly = false');
    expect(source).toContain('!configurationOnly ?');
    expect(source).toContain('onConfigurationOpenChange?.(open)');
    expect(source).toContain('configurationOnly ||');
  });

  it('shows the selected company name in the filter summary', () => {
    expect(reportingLegalEntityLabel('ALL')).toBe('همه شرکت‌ها');
    expect(reportingLegalEntityLabel('NIYAYESH_SEIR_SAHAR')).toBe(
      'نیایش سیر سحر',
    );
    expect(reportingLegalEntityLabel('JAHAN_BASTAN')).toBe('جهان باستان');
    expect(reportingLegalEntityLabel('JAHAN_ACADEMIA')).toBe('جهان آکادمیا');
    expect(reportingLegalEntityLabel('GHESATI_RO')).toBe('قسطی رو');
  });

  it('renders customer-style interactive date controls for a configured report', () => {
    const html = renderToStaticMarkup(
      <ReportDateRangeFields
        error=""
        fromDate=""
        onFromDateChange={vi.fn()}
        onToDateChange={vi.fn()}
        toDate=""
      />,
    );

    expect(html).not.toContain('نوع تقویم فیلتر گزارش');
    expect(html).toContain('id="report-from-date"');
    expect(html).toContain('id="report-to-date"');
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(html).not.toContain('شمسی');
    expect(html).not.toContain('میلادی');
  });

  it('labels dynamic filters with an unrestricted all option', () => {
    expect(reportingAllFilterLabel('وضعیت')).toBe('همه وضعیت‌ها');
    expect(reportingAllFilterLabel('شعبه')).toBe('همه شعبه‌ها');
    expect(reportingAllFilterLabel('کارشناس')).toBe('همه کارشناسان');
    expect(reportingAllFilterLabel('نوع خدمت')).toBe('همه انواع خدمت');
    expect(reportingAllFilterLabel('وضعیت Refund')).toBe(
      'همه وضعیت‌های Refund',
    );
  });

  it('mirrors current report filters in the Filter Snapshot', () => {
    const report = reportCatalog.find(
      (item) => item.code === 'sales_by_service_route',
    )!;
    const snapshot = buildReportingFilterSnapshot({
      currency: 'USD',
      filterValues: { وضعیت: 'ACTIVE', مسیر: 'THR-DXB' },
      fromDate: '2026-09-01',
      legalEntity: 'NIYAYESH_SEIR_SAHAR',
      report,
      toDate: '2026-09-10',
    });

    expect(snapshot).toEqual(
      expect.arrayContaining([
        {
          active: true,
          label: 'بازه تاریخ',
          value: '2026-09-01 تا 2026-09-10',
        },
        { active: true, label: 'شرکت', value: 'نیایش سیر سحر' },
        { active: true, label: 'ارز', value: 'USD' },
        { active: true, label: 'وضعیت', value: 'ACTIVE' },
        { active: true, label: 'مسیر', value: 'THR-DXB' },
        { active: false, label: 'شعبه', value: 'همه شعبه‌ها' },
      ]),
    );
  });

  it('validates the date range and exposes the standard filter dimensions', () => {
    expect(reportingDateRangeError('2026-09-10', '2026-09-01')).toBe(
      'تاریخ شروع باید قبل از تاریخ پایان یا برابر با آن باشد.',
    );
    expect(reportingDateRangeError('2026-09-01', '2026-09-10')).toBe('');
    expect(reportingDateRangeError('', '2026-09-10')).toBe('');
    expect(reportCatalog[0]?.filters).toEqual(
      expect.arrayContaining([
        'بازه تاریخ',
        'شرکت',
        'شعبه',
        'سایت',
        'کارشناس',
        'ارز',
        'وضعیت',
      ]),
    );
  });

  it('renders every required result state without fabricating report rows', () => {
    expect(renderResultPanel()).toContain('گزارش هنوز اجرا نشده است');
    expect(renderResultPanel({ running: true, started: true })).toContain(
      'در حال دریافت نتیجه از نمای تأییدشده',
    );
    expect(
      renderResultPanel({
        started: true,
        result: { ...reportResult, rows: [], total: 0 },
      }),
    ).toContain('نتیجه‌ای پیدا نشد');
    expect(
      renderResultPanel({
        error: { kind: 'connection', message: 'offline' },
        started: true,
      }),
    ).toContain('خطا در اتصال به سرور گزارش‌ها');
    expect(
      renderResultPanel({
        error: { kind: 'denied', message: 'forbidden' },
        started: true,
      }),
    ).toContain('دسترسی به این گزارش مجاز نیست');
    expect(
      renderResultPanel({
        started: true,
        result: { ...reportResult, sourceDataAsOfUtc: null },
      }),
    ).toContain('داده ناقص');
  });

  it('renders table, chart, freshness, sorting and pagination for a successful result', () => {
    const table = renderResultPanel({ started: true, result: reportResult });
    expect(table).not.toContain('در کل محدوده فیلترشده');
    expect(table).not.toContain('بدون تکثیر Passenger یا Segment');
    expect(table).toContain('آخرین دریافت');
    expect(table).not.toContain('id="report-result-sort"');
    expect(table).toContain('مرتب‌سازی براساس مبلغ قرارداد');
    expect(table).toContain('aria-sort="descending"');
    expect(table.match(/aria-sort=/g)).toHaveLength(12);
    expect(table).toContain('مرتب‌سازی براساس تعداد مسافر');
    expect(table).toContain('مرتب‌سازی براساس تعداد بلیت');
    expect(table).toContain('مرتب‌سازی براساس مبلغ خرید');
    expect(table).toContain('مرتب‌سازی براساس سود ناخالص');
    expect(table).toContain('مرتب‌سازی براساس مبلغ استرداد');
    expect(table).toContain('مرتب‌سازی براساس مانده تسویه');
    expect(table).not.toContain('نوع نمودار');
    expect(table).toContain('مبلغ قرارداد');
    expect(table).toContain('text-center');
    expect(table).toContain('تعداد مسافر');
    expect(table).toContain('تعداد بلیت');
    expect(table).toContain('مبلغ خرید');
    expect(table).toContain('سود ناخالص');
    expect(table).toContain('مبلغ استرداد');
    expect(table).toContain('مانده تسویه');
    expect(table).toContain('اقدام رزرو در انتظار');
    expect(table).toContain('۱ مورد');
    expect(table).toContain('900000');
    expect(table).toContain('350000');
    expect(table).toContain('صفحه');
    expect(table).toContain('۵ رکورد در هر صفحه');
    expect(table).toContain('تطبیق مبلغ با نمای مرجع: تأییدشده');

    const chart = renderResultPanel({
      mode: 'chart',
      started: true,
      result: reportResult,
    });
    expect(chart).toContain('role="img"');
    expect(chart).toContain('مبلغ قرارداد به تفکیک شرکت و سایت');
    expect(chart).toContain('نمودار میله‌ای افقی');
    expect(chart).toContain('نوع نمودار');
    expect(chart).toContain('id="report-result-sort"');
    expect(chart).toContain('max-h-[32rem]');
    expect(chart).toContain('overflow-y-auto');
    expect(chart).toContain('نمودار قابل اسکرول است');
    expect(chart).not.toContain('۵ رکورد در هر صفحه');
    expect(chart).not.toContain('>قبلی</button>');

    const columnChart = renderResultPanel({
      chartType: 'column',
      mode: 'chart',
      started: true,
      result: reportResult,
    });
    expect(columnChart).toContain('نمودار ستونی');
    expect(columnChart).toContain('ارتفاع هر ستون');
    expect(columnChart).toContain('overflow-auto');
    const pieChart = renderResultPanel({
      chartType: 'pie',
      mode: 'chart',
      started: true,
      result: reportResult,
    });
    expect(pieChart).toContain('نمودار دایره‌ای');
    expect(pieChart).toContain('سهم هر بخش در هر ارز به‌صورت مستقل');
    expect(pieChart).toContain('conic-gradient');
    expect(pieChart).toContain('overflow-auto');
    expect(pieChart).toContain('راهنمای رنگ‌های نمودار');
    expect(pieChart).toContain('mt-4 border-t border-border pt-4');
    expect(pieChart).toContain('flex flex-col items-center text-center');
    expect(pieChart).not.toContain('sm:grid-cols-[12rem_1fr]');
    expect(reportChartTypes(reportCatalog[0]!)).toEqual([
      'horizontal-bar',
      'column',
      'pie',
    ]);
  });

  it('uses standard sortable-table direction behavior', () => {
    expect(
      nextReportSort('amount', { column: 'amount', direction: 'DESC' }),
    ).toEqual({ column: 'amount', direction: 'ASC' });
    expect(
      nextReportSort('contractCount', {
        column: 'branchId',
        direction: 'ASC',
      }),
    ).toEqual({ column: 'contractCount', direction: 'DESC' });
    expect(
      nextReportSort('ownerUserId', {
        column: 'amount',
        direction: 'DESC',
      }),
    ).toEqual({ column: 'ownerUserId', direction: 'ASC' });
    expect(
      nextReportSort('grossProfit', {
        column: 'ownerUserId',
        direction: 'ASC',
      }),
    ).toEqual({ column: 'grossProfit', direction: 'DESC' });
  });

  it('removes result summary cards and highlights pending reservation actions in the table', () => {
    const groupedResult = {
      ...reportResult,
      contractCount: reportResult.total,
      rowGrain: 'ORDER_ITEM_CURRENCY',
    };
    const html = renderResultPanel({
      started: true,
      result: groupedResult,
    });

    expect(html).not.toContain('در کل محدوده فیلترشده');
    expect(html).not.toContain('جمع مستقل در هر ارز');
    expect(html).not.toContain('نیازمند پیگیری عملیاتی');
    expect(html).toContain('اقدام رزرو در انتظار');
    expect(html).toContain('۱ مورد');
  });

  it('uses five rows only for table pages and the full preview cap for charts', () => {
    expect(reportResultPageSize('table')).toBe(5);
    expect(reportResultPageSize('chart')).toBe(100);
  });

  it('maps authorization failures separately from connection failures', () => {
    expect(reportingRunError(new ReportingApiError('ممنوع', 403))).toEqual({
      kind: 'denied',
      message: 'ممنوع',
    });
    expect(reportingRunError(new ReportingApiError('قطع ارتباط', 0))).toEqual({
      kind: 'connection',
      message: 'قطع ارتباط',
    });
  });

  it('does not render saved-report favorite filters', () => {
    const html = renderToStaticMarkup(
      <ReportingWorkspace savedFilter="all" view="saved" />,
    );
    expect(html).not.toContain('همه گزارش‌های من');
    expect(html).not.toContain('محبوب‌ها');
    expect(html).not.toContain('aria-label="فیلتر گزارش‌های من"');
  });
});
