import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-transportation-workspace.tsx',
  ),
  'utf8',
);

describe('transportation workspace', () => {
  it('implements every mockup catalog tab without a profile section', () => {
    for (const label of [
      'ایرلاین‌ها',
      'انواع هواپیما',
      'کلاس پروازی',
      'قواعد بار',
      'قالب Manifest',
      'شرکت‌های ریلی',
      'انواع قطار',
      'شرکت‌های اتوبوس',
      'انواع اتوبوس',
    ])
      expect(source).toContain(label);

    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('const attributeLabels'),
    );
    expect(tabs).not.toContain('پروفایل ایرلاین');
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('keeps the KPI names aligned with the supplied mockup', () => {
    for (const label of [
      'کل ایرلاین‌ها',
      'ایرلاین فعال',
      'Connection فعال',
      'نیازمند تکمیل برند',
      'انواع هواپیما',
      'نوع فعال',
      'سازندگان',
      'کلاس‌ها',
      'Cabinها',
      'قواعد فعال',
      'نسخه امروز',
      'ایرلاین‌ها',
      'در انتظار تأیید',
      'کل قالب‌ها',
      'نسخه فعال',
      'فرمت‌های فایل',
      'در انتظار انتشار',
    ])
      expect(source).toContain(label);
  });

  it('does not include provider secrets or mockup fixtures', () => {
    expect(source).toContain('بدون Secret و Reference ساختگی');
    expect(source).toContain('Credential');
    expect(source).not.toContain('apiKey');
    expect(source).not.toContain('ماهان');
  });
});
