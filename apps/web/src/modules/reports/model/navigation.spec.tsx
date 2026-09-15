import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportingWorkspace } from '../components/reporting-workspace';
import Page from '../../../app/(crm)/reports/page';
import {
  parseReportingFilterState,
  parseReportingNavigation,
  reportingConfigurationState,
  reportingFilterStateHref,
  reportingOperationConfigurationHref,
  reportingViewHref,
  reportingViewIds,
  reportingWorkspaceKey,
} from './navigation';

describe('Reporting navigation', () => {
  it.each(reportingViewIds)(
    'restores %s from a directly loaded URL',
    async (view) => {
      const page = await Page({ searchParams: Promise.resolve({ view }) });
      const html = renderToStaticMarkup(page);
      expect(html).toContain(`href="${reportingViewHref(view)}"`);
      expect(html).toContain('aria-current="page"');
      expect(parseReportingNavigation({ view }).view).toBe(view);
    },
  );

  it('falls back safely for missing, invalid and repeated view values', () => {
    for (const params of [
      {},
      { view: 'unknown' },
      { view: ['catalog', 'shared'] },
    ]) {
      expect(parseReportingNavigation(params)).toEqual({
        view: 'catalog',
        savedFilter: 'all',
      });
    }
  });

  it('parses the legacy favorites URL without rendering removed controls', () => {
    const state = parseReportingNavigation({
      view: 'saved',
      filter: 'favorites',
    });
    expect(parseReportingNavigation({ view: 'favorites' })).toEqual(state);
    expect(
      parseReportingNavigation({ view: 'catalog', filter: 'favorites' })
        .savedFilter,
    ).toBe('all');
    const html = renderToStaticMarkup(<ReportingWorkspace {...state} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('فیلتر گزارش‌های من');
    expect(html).not.toContain('/reports?view=saved&amp;filter=favorites');
    expect(html).not.toContain('/reports?view=favorites');
  });

  it('renders five useful report views without home or scheduling entries', () => {
    const html = renderToStaticMarkup(<ReportingWorkspace />);
    const nav =
      html.match(/<nav[^>]*aria-label="نماهای گزارش"[\s\S]*?<\/nav>/)?.[0] ??
      '';
    expect(nav.match(/<a /g)).toHaveLength(5);
    expect(nav).toContain('اشتراک‌گذاری‌شده با من');
    expect(nav).not.toContain('محبوب‌ها');
    expect(nav).toContain('در حال دریافت تعداد گزارش‌های من');
    expect(nav).not.toContain('تعداد هنوز در دسترس نیست');
    expect(nav).not.toContain('خانه گزارش‌ها');
    expect(nav).not.toContain('زمان‌بندی‌ها');
    expect(nav).toContain('!text-white');
    expect(nav).toContain('[&amp;_*]:!text-white');
    expect(html).not.toContain('گزارش‌های متصل');
    expect(html).not.toContain('اجرای خودکار بعدی');
    expect(html).not.toContain('وضعیت خروجی‌ها');
  });

  it('parses and serializes refresh-safe report filter state', () => {
    const state = parseReportingFilterState({
      branch: 'BRANCH-01',
      company: 'NIYAYESH_SEIR_SAHAR',
      currency: 'USD',
      from: '2026-09-01',
      report: 'sales_by_organization',
      status: 'ACTIVE',
      to: '2026-09-10',
    });
    const stateWithIdentity = {
      ...state,
      filterValues: { ...state.filterValues, کارشناس: 'کارشناس نمونه' },
    };

    expect(state).toEqual({
      reportCode: 'sales_by_organization',
      fromDate: '2026-09-01',
      toDate: '2026-09-10',
      legalEntity: 'NIYAYESH_SEIR_SAHAR',
      currency: 'USD',
      filterValues: { شعبه: 'BRANCH-01', وضعیت: 'ACTIVE' },
    });
    expect(
      reportingFilterStateHref(
        'http://localhost:3000/reports?view=catalog&priority=P0',
        stateWithIdentity,
      ),
    ).toBe(
      '/reports?view=catalog&priority=P0&report=sales_by_organization&from=2026-09-01&to=2026-09-10&company=NIYAYESH_SEIR_SAHAR&currency=USD&status=ACTIVE&branch=BRANCH-01',
    );
  });

  it('drops invalid, repeated and unrestricted URL filter values', () => {
    expect(
      parseReportingFilterState({
        branch: 'ALL',
        company: 'UNKNOWN',
        currency: ['USD', 'EUR'],
        from: '2026-02-31',
        report: '../unsafe',
      }),
    ).toEqual({
      reportCode: undefined,
      fromDate: '',
      toDate: '',
      legalEntity: 'ALL',
      currency: 'ALL',
      filterValues: {},
    });
  });

  it('restores the current saved configuration shape', () => {
    expect(
      reportingConfigurationState('sales_by_organization', {
        currency: 'USD',
        filterValues: { شعبه: 'BRANCH-01', کارشناس: 'user-1' },
        fromDate: '2026-09-01',
        legalEntity: 'NIYAYESH_SEIR_SAHAR',
        toDate: '2026-09-10',
      }),
    ).toEqual({
      reportCode: 'sales_by_organization',
      fromDate: '2026-09-01',
      toDate: '2026-09-10',
      legalEntity: 'NIYAYESH_SEIR_SAHAR',
      currency: 'USD',
      filterValues: { شعبه: 'BRANCH-01', کارشناس: 'user-1' },
    });
  });

  it('opens configured reports without leaving the active operations view', () => {
    const state = reportingConfigurationState('sales_by_service_route', {
      currency: 'USD',
      filterValues: { مسیر: 'تهران ← شیراز' },
      fromDate: '2026-09-01',
      legalEntity: 'NIYAYESH_SEIR_SAHAR',
      toDate: '2026-09-10',
    });
    const savedKey = reportingWorkspaceKey('saved', 'all', {
      reportCode: undefined,
      fromDate: '',
      toDate: '',
      legalEntity: 'ALL',
      currency: 'ALL',
      filterValues: {},
    });
    const configuredKey = reportingWorkspaceKey('saved', 'all', state);

    expect(configuredKey).not.toBe(savedKey);
    expect(
      reportingWorkspaceKey('saved', 'all', {
        ...state,
        filterValues: { مسیر: 'تهران ← شیراز', وضعیت: 'ACTIVE' },
      }),
    ).not.toBe(configuredKey);
    expect(reportingOperationConfigurationHref('saved', 'all', state)).toBe(
      '/reports?view=saved&report=sales_by_service_route&from=2026-09-01&to=2026-09-10&company=NIYAYESH_SEIR_SAHAR&currency=USD&route=%D8%AA%D9%87%D8%B1%D8%A7%D9%86+%E2%86%90+%D8%B4%DB%8C%D8%B1%D8%A7%D8%B2',
    );
    for (const view of ['shared', 'recent'] as const) {
      expect(reportingOperationConfigurationHref(view, 'all', state)).toContain(
        `view=${view}&report=sales_by_service_route`,
      );
    }
  });

  it('restores legacy saved filters and server run snapshots', () => {
    expect(
      reportingConfigurationState('sales_by_service_route', {
        'بازه تاریخ': '2026-09-01 تا 2026-09-10',
        شرکت: 'نیایش سیر سحر',
        ارز: 'IRR',
        مسیر: 'تهران ← شیراز',
      }),
    ).toMatchObject({
      fromDate: '2026-09-01',
      toDate: '2026-09-10',
      legalEntity: 'NIYAYESH_SEIR_SAHAR',
      currency: 'IRR',
      filterValues: { مسیر: 'تهران ← شیراز' },
    });

    expect(
      reportingConfigurationState('sales_by_organization', {
        legalEntityId: 'JAHAN_BASTAN',
        branchIds: [],
        filters: {
          fromUtc: '2026-08-31T20:30:00.000Z',
          toUtc: '2026-09-10T20:30:00.000Z',
          currencyCode: 'USD',
          branchId: 'BRANCH-02',
          ownerUserId: 'user-2',
        },
      }),
    ).toEqual({
      reportCode: 'sales_by_organization',
      fromDate: '2026-09-01',
      toDate: '2026-09-10',
      legalEntity: 'JAHAN_BASTAN',
      currency: 'USD',
      filterValues: { شعبه: 'BRANCH-02', کارشناس: 'user-2' },
    });
  });
});
