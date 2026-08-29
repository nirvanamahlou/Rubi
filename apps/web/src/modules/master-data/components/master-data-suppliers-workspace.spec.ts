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
  it('implements all approved mockup tabs', () => {
    for (const label of [
      'تأمین‌کنندگان',
      'پروفایل تأمین‌کننده',
      'کارگزاران',
      'پروفایل کارگزار',
      'اطلاعات تماس',
      'وضعیت همکاری',
    ])
      expect(source).toContain(label);
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
      'کل مخاطبان',
      'مخاطب فعال',
      'دارای WhatsApp',
      'در حال بررسی',
      'تعلیق خرید',
      'پایان همکاری',
    ])
      expect(source).toContain(label);
  });

  it('uses real APIs, masks contacts and leaves module-owned metrics unknown', () => {
    expect(source).toContain('organizationSupplierSummary');
    expect(source).toContain('unmaskOrganizationContact');
    expect(source).toContain("label: 'طرف قرارداد'");
    expect(source).toContain("value: '—'");
    expect(source).not.toContain('سپهر سفر');
    expect(source).not.toContain('CTR-');
  });
});
