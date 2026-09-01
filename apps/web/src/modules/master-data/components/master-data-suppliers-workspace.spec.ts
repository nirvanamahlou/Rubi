import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-suppliers-workspace.tsx',
  ),
  'utf8',
);

describe('organizations and suppliers workspace', () => {
  it('keeps profiles in popups and removes standalone profile/contact tabs', () => {
    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const tabCopy'),
    );

    expect(tabs).toContain("id: 'suppliers'");
    expect(tabs).toContain("id: 'brokers'");
    expect(tabs).toContain("id: 'collaboration'");
    expect(tabs).not.toContain("id: 'supplier-profile'");
    expect(tabs).not.toContain("id: 'broker-profile'");
    expect(tabs).not.toContain("id: 'contacts'");
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('keeps every KPI label aligned with the approved mockup', () => {
    for (const label of [
      'کل تأمین‌کنندگان',
      'همکاری فعال',
      'طرف قرارداد',
      'متصل به Provider/API',
      'کل کارگزاران',
      'پروفایل فعال',
      'شهرهای تحت پوشش',
      'نیازمند تکمیل',
      'در حال بررسی',
      'تعلیق خرید',
      'پایان همکاری',
    ])
      expect(source).toContain(label);
  });

  it('uses real APIs and leaves module-owned metrics unknown', () => {
    expect(source).toContain('organizationSupplierSummary');
    expect(source).not.toContain('unmaskOrganizationContact');
    expect(source).toContain("label: 'طرف قرارداد'");
    expect(source).toContain("value: '—'");
    expect(source).not.toContain('سپهر سفر');
    expect(source).not.toContain('CTR-');
  });

  it('keeps collaboration editing in source forms but permits the shared status action', () => {
    expect(source).not.toContain('تعریف وضعیت');
    expect(source).toContain("formMode && tab !== 'collaboration'");
    const actions = source.slice(
      source.indexOf('const rowActions'),
      source.indexOf('function renderProfile'),
    );
    const writeGuard = actions.indexOf("tab !== 'collaboration'");
    expect(writeGuard).toBeGreaterThan(actions.indexOf('openProfile(record)'));
    expect(writeGuard).toBeLessThan(actions.indexOf("setFormMode('edit')"));
    expect(writeGuard).toBeGreaterThan(
      actions.indexOf('<MasterDataPowerButton'),
    );
    expect(source).toContain('تازه‌سازی وضعیت‌ها');
  });

  it('reads both source lists and provides pagination for the collaboration board', () => {
    expect(source).toContain('loadSupplierCollaborationPage(masterDataApi, {');
    expect(source).toMatch(
      /groupSupplierCollaborationRecords\(\s*records,\s*collaborationRecords/,
    );
    expect(source).toContain('page >= collaborationPageCount');
    expect(source).not.toContain('pageSize: 100');
    expect(source).toContain('laneRecords.length.toLocaleString');
    expect(source).toContain('if (sequence !== loadSequence.current) return;');
  });
});
