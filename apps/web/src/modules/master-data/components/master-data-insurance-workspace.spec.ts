import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import {
  bindInsurancePlanParent,
  fetchInsurerPlanPage,
  INSURER_PLAN_PAGE_SIZE,
  refreshInsurancePlanViews,
} from './master-data-insurance-workspace';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-insurance-workspace.tsx',
  ),
  'utf8',
);

describe('insurance workspace', () => {
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

  it('implements all three mockup tabs with exact KPI labels', () => {
    for (const label of [
      'شرکت‌های بیمه',
      'طرح‌های بیمه',
      'پوشش‌ها',
      'کل شرکت‌ها',
      'کشورهای تحت پوشش',
      'لوگوی ناقص',
      'کل طرح‌ها',
      'در حال انقضا',
      'مناطق مقصد',
      'کل پوشش‌ها',
      'ارزهای مرجع',
      'نیازمند بازبینی',
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
