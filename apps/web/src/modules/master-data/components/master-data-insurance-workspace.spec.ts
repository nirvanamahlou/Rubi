import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { MasterDataRecord, MasterInsuranceSummary } from '@nora/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  bindInsurancePlanParent,
  countRecordsLinkedToPlans,
  fetchInsuranceRelationSummary,
  fetchInsurerPlanPage,
  INSURER_PLAN_PAGE_SIZE,
  insuranceKpiItems,
  refreshInsurancePlanViews,
} from './master-data-insurance-workspace';
import { MasterDataKpiGrid } from './master-data-kpi-grid';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-insurance-workspace.tsx',
  ),
  'utf8',
);

const summary: MasterInsuranceSummary = {
  insurers: { total: 8, active: 6, countries: 3, missingLogo: 2 },
  plans: { total: 4, active: 3, expiringSoon: 1, destinations: 2 },
  coverages: { total: 9, active: 7, currencies: 2, needsReview: 3 },
};

function record(
  id: string,
  resource: 'insurers' | 'insurance-coverages',
  planCount: unknown,
): MasterDataRecord {
  return {
    id,
    resource,
    code: id,
    name: id,
    status: 'active',
    attributes: { planCount: planCount as number },
    version: 1,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
  };
}

describe('insurance workspace', () => {
  it('keeps the insurer name as View trigger and centers plan expansion with Operations', () => {
    const actions = source.slice(
      source.indexOf('const actions ='),
      source.indexOf('const table ='),
    );
    const insurerNameCell = source.slice(
      source.indexOf('<MasterDataLogoCell record={record} />'),
      source.indexOf('<td className="p-4" dir="ltr">'),
    );

    expect(actions).toContain(
      'className="flex flex-wrap justify-center gap-2"',
    );
    expect(actions).toContain("resource === 'insurers'");
    expect(actions).toContain('<Button');
    expect(actions).toContain('type="button"');
    expect(actions).toContain('aria-controls={`insurer-plans-${record.id}`}');
    expect(actions).toContain(
      'aria-expanded={expandedInsurerId === record.id}',
    );
    expect(actions).toContain('current === record.id ? null : record.id');
    expect(actions).toContain("? 'بستن' : 'نمایش'");
    expect(actions).toContain('<ChevronDown');
    expect(insurerNameCell).toContain('onClick={() => openProfile(record)}');
    expect(insurerNameCell).not.toContain('<ChevronDown');
    expect(insurerNameCell).not.toContain('setExpandedInsurerId');
    expect(source.match(/aria-controls=\{`insurer-plans-/g)).toHaveLength(1);
  });

  it('nests plans under insurers and binds every write to the expanded parent', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const rules'),
    );
    expect(tabs).not.toContain("resource: 'insurance-plans'");
    expect(source).toContain('fetchInsurerPlanPage(');
    expect(source).toContain('masterDataApi.list,');
    expect(source).toContain('insurerId: insurer.id');
    expect(source).toContain('generation !== requestGeneration.current');
    expect(source).toContain('requestGeneration.current += 1');
    expect(source).toContain('expandedInsurerId === record.id');
    expect(source).toContain('<MasterDataInsurerPlans');
    expect(source).toContain('colSpan={9}');
    expect(source).toContain('initialValues={{ insurerId: insurer.id }}');
    expect(source).toContain("lockedFields={['insurerId']}");
    expect(source).toContain('aria-controls={`insurer-plans-${record.id}`}');
    expect(source).toContain('<MasterDataLogoCell record={plan} />');
    expect(source).toContain("attribute(plan, 'coverageNames')");
    expect(INSURER_PLAN_PAGE_SIZE).toBeGreaterThanOrEqual(10);
    expect(source).toContain('pageSize: INSURER_PLAN_PAGE_SIZE');
    expect(source).toContain('page * INSURER_PLAN_PAGE_SIZE >= total');
    expect(
      bindInsurancePlanParent({ name: 'طرح', insurerId: 'forged' }, 'parent'),
    ).toEqual({
      name: 'طرح',
      insurerId: 'parent',
    });
  });

  it('rejects stale child responses and refreshes child and parent after CRUD', async () => {
    let resolveList!: (value: {
      data: readonly [];
      meta: { total: number };
    }) => void;
    const list = vi.fn(
      () =>
        new Promise<{ data: readonly []; meta: { total: number } }>(
          (resolve) => {
            resolveList = resolve;
          },
        ),
    );
    const pending = fetchInsurerPlanPage(
      list,
      {
        insurerId: 'insurer-1',
        page: 1,
        pageSize: INSURER_PLAN_PAGE_SIZE,
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
      },
      1,
      (generation) => generation === 2,
    );
    resolveList({ data: [], meta: { total: 0 } });
    await expect(pending).resolves.toBeNull();
    expect(list).toHaveBeenCalledWith(
      'insurance-plans',
      expect.objectContaining({ insurerId: 'insurer-1' }),
    );

    const load = vi.fn(async () => undefined);
    const onChanged = vi.fn(async () => undefined);
    await refreshInsurancePlanViews(load, onChanged);
    expect(load).toHaveBeenCalledOnce();
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('keeps insurer headers and cells aligned without last change', () => {
    const headersSource = source.slice(
      source.indexOf("{resource === 'insurers' ? ("),
      source.indexOf(") : resource === 'insurance-plans' ? ("),
    );
    const headerList = headersSource.slice(
      headersSource.indexOf('{['),
      headersSource.indexOf('].map('),
    );
    const headers = [...headerList.matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    const rowsStart = source.indexOf('{records.map((record) => (');
    const cellsSource = source.slice(
      source.indexOf("{resource === 'insurers' ? (", rowsStart),
      source.indexOf(") : resource === 'insurance-plans' ? (", rowsStart),
    );

    expect(headers).toEqual([
      'کد',
      'لوگو',
      'نام فارسی',
      'نام انگلیسی',
      'سازمان مرتبط',
      'کشور',
      'طرح فعال',
      'وضعیت',
      'عملیات',
    ]);
    expect((cellsSource.match(/<td\b/g) ?? []).length + 3).toBe(headers.length);
    expect(headers).not.toContain('آخرین تغییر');
    expect(cellsSource).not.toContain('record.updatedAt');
  });

  it('replaces review-style cards with truthful global relation metrics', () => {
    const insurerRows = [
      record('i-1', 'insurers', 2),
      record('i-2', 'insurers', 0),
      record('i-3', 'insurers', 1),
    ];
    const coverageRows = [
      record('c-1', 'insurance-coverages', 0),
      record('c-2', 'insurance-coverages', 4),
    ];
    expect(countRecordsLinkedToPlans(insurerRows)).toBe(2);
    expect(countRecordsLinkedToPlans([])).toBe(0);
    for (const invalid of [undefined, null, '1', -1, 0.5, NaN, 2 ** 54])
      expect(
        countRecordsLinkedToPlans([record('invalid', 'insurers', invalid)]),
      ).toBeNull();

    const insurerCards = insuranceKpiItems(
      'insurers',
      summary,
      insurerRows,
      'ready',
    );
    const coverageCards = insuranceKpiItems(
      'insurance-coverages',
      summary,
      coverageRows,
      'ready',
    );
    expect(insurerCards.map(({ label }) => label)).toEqual([
      'کل شرکت‌ها',
      'فعال',
      'کشورهای تحت پوشش',
      'دارای طرح بیمه',
    ]);
    expect(insurerCards[3]).toMatchObject({
      value: 2,
    });
    expect(coverageCards.map(({ label }) => label)).toEqual([
      'کل پوشش‌ها',
      'فعال',
      'ارزهای مرجع',
      'متصل به طرح‌ها',
    ]);
    expect(coverageCards[3]).toMatchObject({
      value: 1,
    });
    expect(insuranceKpiItems('insurers', summary, [], 'ready')[3]?.value).toBe(
      0,
    );
    for (const state of ['loading', 'error'] as const)
      expect(
        insuranceKpiItems('insurers', summary, insurerRows, state)[3]?.value,
      ).toBe('—');
    expect(
      insuranceKpiItems(
        'insurance-coverages',
        summary,
        [record('bad', 'insurance-coverages', undefined)],
        'ready',
      )[3]?.value,
    ).toBe('—');

    const html = renderToStaticMarkup(
      createElement(MasterDataKpiGrid, {
        items: coverageCards,
        label: 'شاخص‌های پوشش بیمه',
      }),
    );
    expect((html.match(/min-h-28/g) ?? []).length).toBe(4);
    expect(html).toContain('متصل به طرح‌ها');
    expect(html).not.toContain('نیازمند بازبینی');
    expect(source).not.toContain('لوگوی ناقص');
    expect(source).not.toContain('نیازمند بازبینی');
  });

  it('loads the complete unfiltered relation dataset and rejects stale pages', async () => {
    const rows = Array.from({ length: 101 }, (_, index) =>
      record(`i-${index}`, 'insurers', index % 2),
    );
    const list = vi.fn(
      async (
        _resource: 'insurers' | 'insurance-coverages',
        query: { page: number },
      ) => ({
        data: rows.slice((query.page - 1) * 100, query.page * 100),
        meta: { total: rows.length },
      }),
    );
    await expect(
      fetchInsuranceRelationSummary(list, 'insurers', 1, () => true),
    ).resolves.toHaveLength(101);
    expect(list).toHaveBeenNthCalledWith(
      1,
      'insurers',
      expect.objectContaining({
        search: '',
        status: 'all',
        page: 1,
        pageSize: 100,
      }),
    );
    expect(list).toHaveBeenNthCalledWith(
      2,
      'insurers',
      expect.objectContaining({ page: 2, pageSize: 100 }),
    );
    await expect(
      fetchInsuranceRelationSummary(list, 'insurers', 2, () => false),
    ).resolves.toBeNull();

    const duplicateList = vi.fn(async () => ({
      data: [rows[0]!, rows[0]!],
      meta: { total: 2 },
    }));
    await expect(
      fetchInsuranceRelationSummary(duplicateList, 'insurers', 1, () => true),
    ).rejects.toThrow('Duplicate insurance relation summary record');
  });

  it('keeps the remaining Insurance KPI labels', () => {
    for (const label of [
      'شرکت‌های بیمه',
      'پوشش‌ها',
      'کل شرکت‌ها',
      'کشورهای تحت پوشش',
      'کل پوشش‌ها',
      'ارزهای مرجع',
      'دارای طرح بیمه',
      'متصل به طرح‌ها',
    ])
      expect(source).toContain(label);
  });

  it('opens profiles from the list without a standalone profile tab', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const rules'),
    );
    expect(tabs).not.toContain('پروفایل');
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('uses backend summaries and does not embed mockup sample records', () => {
    expect(source).toContain('masterDataApi.insuranceSummary()');
    expect(source).not.toContain('بیمه سامان');
    expect(source).not.toContain('شرکت بیمه ملت');
    expect(source).not.toMatch(/value:\s*(?:18|21|46|136)\b/);
  });
});
