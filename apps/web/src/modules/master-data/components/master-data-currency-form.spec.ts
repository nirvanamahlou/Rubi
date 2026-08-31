import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-currency-form.tsx',
  ),
  'utf8',
);
const workspace = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-finance-workspace.tsx',
  ),
  'utf8',
);

describe('currency popup form', () => {
  it('contains both mockup field sets and no display policy control', () => {
    for (const label of [
      'نام فارسی ارز',
      'وضعیت ارز',
      'ارز پایه',
      'نرخ خرید',
      'نرخ فروش',
      'منبع',
      'تاریخ و ساعت',
      'ثبت‌کننده',
      'وضعیت نرخ',
    ])
      expect(source).toContain(label);
    expect(source).not.toContain('displayPolicy');
    expect(source).not.toContain('سیاست نمایش');
    expect(source).toContain('MasterDataProfileDialog');
  });
  it('uses atomic quote API and opens it inside currencies without changing sections', () => {
    expect(source).toContain(
      'masterDataApi.createCurrencyQuote(validated.input)',
    );
    expect(workspace).toContain('<MasterDataCurrencyForm');
    expect(workspace).not.toContain("changeTab('approvals')");
    expect(source).toContain('قرارداد آن هنوز متصل نیست');
    expect(source).not.toContain('masterDataApi.decideCurrencyRate');
  });
});
