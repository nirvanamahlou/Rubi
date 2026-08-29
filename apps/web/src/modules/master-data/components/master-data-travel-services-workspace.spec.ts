import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-travel-services-workspace.tsx',
  ),
  'utf8',
);

describe('travel services workspace', () => {
  it('implements all seven mockup tabs with exact KPI labels', () => {
    for (const label of [
      'لیدرها',
      'نوع تور',
      'نوع ترانسفر',
      'CIP',
      'ویزا',
      'شرکت اتوبوس',
      'نوع اتوبوس',
      'کل لیدرها',
      'مقصدها',
      'مدرک ناقص',
      'داخلی',
      'خارجی',
      'اختصاصی',
      'اشتراکی',
      'فرودگاه‌ها',
      'Providerها',
      'Organization',
      'امکانات',
      'شرکت‌ها',
    ])
      expect(source).toContain(label);
  });

  it('opens every profile from the list without a standalone profile tab', () => {
    const tabs = source.slice(source.indexOf('const tabs'), source.indexOf('const rules'));
    expect(tabs).not.toContain('پروفایل');
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('uses backend summaries and never embeds mockup sample records', () => {
    expect(source).toContain('masterDataApi.travelServicesSummary()');
    expect(source).not.toContain('سارا احمدی');
    expect(source).not.toContain('Marhaba Elite');
    expect(source).not.toMatch(/value:\s*(?:86|74|48|41|26|23)\b/);
  });
});
