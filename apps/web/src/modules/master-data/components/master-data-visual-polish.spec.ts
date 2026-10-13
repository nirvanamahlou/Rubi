import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(fileName: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/modules/master-data/components', fileName),
    'utf8',
  );
}

describe('Master Data visual polish contract', () => {
  it('shows saved logos in the form and every logo-bearing Master Data workspace', () => {
    expect(source('master-data-logo-upload.tsx')).toContain(
      '<MasterDataLogoImage',
    );
    for (const file of [
      'master-data-finance-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-accommodation-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
    ]) {
      expect(source(file), file).toContain('<MasterDataLogoCell');
    }
  });
  it('omits technical contract and backend badges throughout the Master Data UI', () => {
    const directory = resolve(
      process.cwd(),
      'src/modules/master-data/components',
    );
    for (const fileName of readdirSync(directory).filter((file) =>
      file.endsWith('.tsx'),
    )) {
      const component = source(fileName);
      expect(component, fileName).not.toMatch(/master-data\.v\d+/);
      expect(component, fileName).not.toContain('Backend واقعی');
      expect(component, fileName).not.toContain(
        'اطلاعات پس از اعتبارسنجی در Backend ثبت و Audit می‌شود.',
      );
      expect(component, fileName).not.toContain(
        'مشترک بین شرکت‌ها · بدون فیلتر Legal Entity',
      );
    }
  });

  it('preserves form behavior, record versions and honest preview disclosure', () => {
    const form = source('master-data-live-form.tsx');
    expect(form).toContain('<DialogTitle className={readonly');
    expect(form).toContain('aria-describedby={undefined}');
    expect(form).toContain('validateMasterDataDraft(definition.key, values)');
    expect(form).toContain('await onPersist(');
    expect(form).toContain(
      'supplierEditValues(result.values, supplierPhoneTouched)',
    );
    expect(form).toContain("record.version.toLocaleString('fa-IR')");
    expect(source('master-data-form.tsx')).toContain(
      'Blocked by Migration Lock',
    );
  });

  it('does not render generic guidance beneath Master Data headings', () => {
    expect(source('master-data-hub.tsx')).not.toContain(
      '{section.description}',
    );
    expect(source('master-data-live-workspace.tsx')).not.toContain(
      'definition.description}',
    );
    expect(source('master-data-finance-workspace.tsx')).not.toContain(
      '{copy.description ? (',
    );
    expect(source('master-data-profile-dialog.tsx')).not.toContain(
      '<DialogDescription>',
    );
    expect(source('master-data-live-form.tsx')).not.toContain(
      '<DialogDescription>',
    );
  });

  it('uses pastel KPI cards with a semantic icon in every card', () => {
    const kpis = source('master-data-kpi-grid.tsx');
    const liveWorkspace = source('master-data-live-workspace.tsx');
    const finance = source('master-data-finance-workspace.tsx');
    const geography = source('master-data-geography-workspace.tsx');
    const suppliers = source('master-data-suppliers-workspace.tsx');
    const accommodation = source('master-data-accommodation-workspace.tsx');

    expect(kpis).toContain('bg-gradient-to-br');
    expect(kpis).toContain('<Icon aria-hidden="true"');
    expect(liveWorkspace).toContain('<MasterDataKpiGrid');
    expect(finance).toContain('<MasterDataKpiGrid');
    expect(geography).toContain('<MasterDataKpiGrid');
    expect(suppliers).toContain('<MasterDataKpiGrid');
    expect(accommodation).toContain('<MasterDataKpiGrid');
  });

  it('omits explanatory callouts immediately below KPI cards in every section', () => {
    const sectionFiles = [
      'master-data-finance-workspace.tsx',
      'master-data-geography-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-accommodation-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
      'master-data-live-workspace.tsx',
    ];

    for (const fileName of sectionFiles) {
      const workspace = source(fileName);
      const kpiStart = workspace.indexOf('<MasterDataKpiGrid');
      const filtersStart = workspace.indexOf('<MasterDataFilterBar', kpiStart);

      expect(kpiStart, `${fileName}: KPI grid`).toBeGreaterThanOrEqual(0);
      expect(
        filtersStart,
        `${fileName}: filters after KPI grid`,
      ).toBeGreaterThan(kpiStart);

      const postKpiContent = workspace.slice(kpiStart, filtersStart);
      expect(postKpiContent, fileName).not.toMatch(/<(?:Alert|Card)\b/);
      expect(postKpiContent, fileName).not.toMatch(
        /LockKeyhole|ShieldCheck|قاعده یکپارچگی|مرز دامنه/,
      );
    }
  });

  it('keeps geography KPI names aligned with the approved mockup', () => {
    const geography = [
      source('master-data-geography-workspace.tsx'),
      source('master-data-geography-kpis.ts'),
    ].join('\n');
    for (const label of [
      'کل کشورها',
      'کشور فعال',
      'کشور دارای مقصد',
      'کل شهرهای مرتبط',
      'کل شهرها',
      'شهر فعال',
      'کل استان‌ها',
      'استان فعال',
      'کل فرودگاه‌ها',
      'فرودگاه فعال',
      'شهرهای مرتبط',
      'ترمینال‌های مرتبط',
      'کل ترمینال‌ها',
      'ترمینال فعال',
      'بین‌المللی',
    ]) {
      expect(geography).toContain(label);
    }
  });

  it('keeps finance KPI names aligned with the approved mockups', () => {
    const finance = source('master-data-finance-workspace.tsx');
    for (const label of [
      'کل ارزها',
      'ارز فعال',
      'ارز پایه سازمان',
      'آخرین همگام‌سازی',
      'نرخ جاری تأییدشده',
      'تغییر نسبت به نرخ قبل',
      'آخرین مشاهده',
      'رکورد تاریخچه در بازه',
      'در انتظار بررسی',
      'تأییدشده امروز',
      'ردشده امروز',
      'میانگین زمان تأیید',
      'کل بانک‌ها',
      'بانک فعال',
      'حساب‌های متصل',
      'بانک غیرفعال',
      'روش‌های فعال',
      'تراکنش‌های امروز',
      'درگاه‌های متصل',
      'نیازمند پیکربندی',
    ]) {
      expect(finance).toContain(label);
    }
    expect(finance).toContain('<MasterDataBankProfile');
    expect(finance).not.toContain("key: 'branches'");
  });

  it('does not draw an underline on section-card hover', () => {
    const hub = source('master-data-hub.tsx');
    expect(hub).not.toContain('group-hover:scale-x-100');
  });

  it('aligns navigation and action button groups to the physical left in RTL sections', () => {
    const sectionFiles = [
      'master-data-finance-workspace.tsx',
      'master-data-geography-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-accommodation-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
      'master-data-live-workspace.tsx',
    ];

    for (const fileName of sectionFiles) {
      const workspace = source(fileName);
      expect(workspace, `${fileName}: all-sections action`).toContain(
        'ms-auto`}',
      );
      expect(workspace, `${fileName}: left-aligned actions`).toContain(
        'justify-end gap-2',
      );
      expect(workspace, `${fileName}: unaligned button group`).not.toMatch(
        /<div className="flex flex-wrap gap-2">\s*<(?:Button|MasterData)/,
      );
    }
  });

  it('consolidates currency history and nests cities under countries', () => {
    const finance = source('master-data-finance-workspace.tsx');
    const financeTabs = finance.slice(
      finance.indexOf('const tabs'),
      finance.indexOf('const tabCopy'),
    );
    const geography = source('master-data-geography-workspace.tsx');
    const geographyTabs = geography.slice(
      geography.indexOf('const geographyTabs'),
      geography.indexOf('const terminalLabels'),
    );

    expect(financeTabs).not.toContain("key: 'rates'");
    expect(finance).toContain('<MasterDataProfileDialog');
    expect(finance).toContain('fromCurrencyId: selectedCurrency.id');
    expect(finance).toContain('toCurrencyId: selectedCurrency.id');
    expect(geographyTabs).toContain("label: 'کشورها و شهرها'");
    expect(geographyTabs).not.toContain("resource: 'cities'");
    expect(geography).not.toContain("changeResource('cities')");
    expect(geography).toContain("openRelatedCreate('cities', country)");
    expect(geography).toMatch(/openRelatedCreate\(\s*'airports',\s*city/);
    expect(geography).toMatch(/openRelatedCreate\(\s*'terminals',\s*airport,/);
  });
});
