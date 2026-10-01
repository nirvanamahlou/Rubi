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
  it('keeps baggage rules in the airline form without a separate section or profile route', () => {
    for (const label of [
      'ایرلاین‌ها',
      'انواع هواپیما',
      'کلاس پروازی',
      'قالب Manifest',
      'شرکت‌های ریلی',
      'انواع قطار',
      'شرکت‌های اتوبوس',
      'انواع اتوبوس',
    ])
      expect(source).toContain(label);

    const tabs = source.slice(
      source.indexOf('const tabs'),
      source.indexOf('type TransportResource'),
    );
    expect(tabs).not.toContain('پروفایل ایرلاین');
    expect(tabs).not.toContain("resource: 'baggage-rules'");
    expect(source).not.toContain('const airlineViews');
    expect(source).not.toContain('بخش‌های داخلی فرم ایرلاین');
    expect(source).not.toContain(
      "resource: 'baggage-rules', label: 'قواعد بار'",
    );
    expect(source).toContain(
      "resource === 'airlines' && formMode === 'create'",
    );
    expect(source).toContain('<MasterDataProfileDialog');
    expect(source).toContain('setProfileOpen(true)');
  });

  it('keeps the unchanged KPI names and maps all six replacement metrics', () => {
    for (const label of [
      'کل ایرلاین‌ها',
      'ایرلاین فعال',
      'Connection فعال',
      'کشورهای مبدأ',
      'انواع هواپیما',
      'نوع فعال',
      'سازندگان',
      'کلاس‌ها',
      'Cabinها',
      'ایرلاین‌ها',
      'کل قالب‌ها',
      'نسخه فعال',
      'فرمت‌های فایل',
      'در انتظار انتشار',
      'انواع بدنه',
      'کشورهای ثبت‌شده',
      'دسته‌های قطار',
      'کلاس‌های خدمات',
    ])
      expect(source).toContain(label);
  });

  it('loads the replacement summaries from every unfiltered global page', () => {
    const summary = source.slice(
      source.indexOf('const loadSummary'),
      source.indexOf('useEffect(() =>', source.indexOf('const loadSummary')),
    );
    expect(summary).toContain('for (let summaryPage = 1; ; summaryPage += 1)');
    expect(summary).toContain("search: ''");
    expect(summary).toContain("status: 'all'");
    expect(summary).toContain('page: summaryPage');
    expect(summary).toContain('pageSize: 100');
    expect(summary).toContain('const requestId = ++summaryRequestRef.current');
    expect(summary).toContain(
      'if (requestId !== summaryRequestRef.current) return;',
    );
    expect(source).toContain(
      'function changeResource(next: TransportResource) {\n    summaryRequestRef.current += 1;',
    );
  });

  it('does not include provider secrets or mockup fixtures', () => {
    expect(source).toContain('بدون Secret و Reference ساختگی');
    expect(source).toContain('Credential');
    expect(source).not.toContain('apiKey');
    expect(source).not.toContain('ماهان');
  });
});
