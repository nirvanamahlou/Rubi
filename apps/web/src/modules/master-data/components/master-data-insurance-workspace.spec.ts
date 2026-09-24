import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-insurance-workspace.tsx',
  ),
  'utf8',
);

describe('insurance workspace', () => {
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
