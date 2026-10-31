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
  it('contains the requested currency fields without manual date/time or display policy', () => {
    for (const label of [
      'نام فارسی ارز',
      'وضعیت ارز',
      'نرخ خرید',
      'نرخ فروش',
      'منبع',
      'ثبت‌کننده',
      'وضعیت نرخ',
    ])
      expect(source).toContain(label);
    expect(source).not.toContain('displayPolicy');
    expect(source).not.toContain('currency-base');
    expect(source).not.toContain('سیاست نمایش');
    expect(source).not.toContain('تاریخ و ساعت');
    expect(source).not.toContain('observedAt');
    expect(source).toContain('MasterDataNumberInput');
    expect(source).toContain('MasterDataProfileDialog');
  });
  it('uses atomic quote API and opens it inside currencies without changing sections', () => {
    expect(source).toContain(
      'masterDataApi.createCurrencyQuote(validated.input)',
    );
    expect(workspace).toContain('<MasterDataCurrencyForm');
    expect(workspace).not.toContain("changeTab('approvals')");
    expect(source).not.toContain('قرارداد آن هنوز متصل نیست');
    expect(source).not.toContain('masterDataApi.decideCurrencyRate');
  });
  it('shows quote registration only when editing an existing currency', () => {
    expect(source).toMatch(/\{record \? \(\s*<Card className="p-5">/);
    expect(source).not.toContain('مشخصات ارز جدید را ثبت کنید.');
    expect(source).not.toContain(
      'نرخ جدید را می‌توانید در بخش پایین همین فرم ثبت کنید.',
    );
  });
  it('returns to the profile and reloads history after direct registration, without an approval call', () => {
    expect(source).toContain('onQuoteSaved(saved, response.data)');
    expect(source).not.toContain('در انتظار تأیید');
    expect(source).not.toContain('برای تأیید ارسال');
    expect(workspace).toContain('onQuoteSaved={(record, rates) =>');
    expect(workspace).toContain('setSelectedPair(ratePairKey(rates[0]))');
    expect(workspace).toContain('setSelectedCurrency({ ...record })');
    expect(workspace).toContain('setCurrencyProfileOpen(true)');
    expect(workspace).not.toContain('پس از تأیید نرخ');
  });
});
