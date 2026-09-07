import { describe, expect, it } from 'vitest';
import { contractPrintHtml, contractMoney } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
describe('Saved contract print output', () => {
  it('uses agreed totals and confirmed Finance values without offer or purchase prices', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain('123٬456٬789٫25');
    expect(html).toContain('103٬456٬789٫25');
    expect(html).toContain('20٬000٬000');
    expect(html).not.toContain('999٬999٬999');
    expect(html).not.toContain('40٬000٬000');
    expect(html).toContain('900٫50');
    expect(html).toContain('USD');
    expect(html).toContain('BUSINESS');
    expect(html).toContain('ترانسفر رفت');
    expect(html).not.toContain('<th>کمیسیون</th>');
  });
  it('shows unrecorded commission only for agency customers without inventing a deduction', () => {
    const html = contractPrintHtml(
      {
        ...printFixture,
        customer: { ...printFixture.customer, kind: 'organization' },
      },
      printReferences,
    );
    expect(html).toContain('<th>کمیسیون</th>');
    expect(html).toContain('هیچ مبلغی بابت آن');
    expect(html).toContain('123٬456٬789٫25');
  });
  it('escapes all dynamic content and rejects active logo sources', () => {
    const html = contractPrintHtml(
      { ...printFixture, ownerName: '<script>alert(1)</script>' },
      { ...printReferences, logoDataUrl: 'https://invalid.example/image' },
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('https://invalid.example');
    expect(html).toContain("default-src 'none'");
  });
  it('uses B Nazanin and distinguishes a contract copy from a receipt and official issuance', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain("local('B Nazanin')");
    expect(html).toContain('رسید پرداخت');
    expect(html).toContain('شرکت فعال انتخاب‌شده');
    expect(html).toContain('قیمت تفکیکی مسافر ثبت نشده');
    expect((html.match(/<section/g) || []).length).toBe(6);
  });
  it('formats large decimals without floating point loss', () => {
    expect(contractMoney('9007199254740993.12')).toBe(
      '9٬007٬199٬254٬740٬993٫12',
    );
    expect(() => contractMoney('Infinity')).toThrow();
  });
  it('keeps passenger rows independent across print pages and marks cancelled copies', () => {
    const output = {
      ...printFixture,
      contract: { ...printFixture.contract, status: 'CANCELLED' as const },
    };
    const html = contractPrintHtml(output, printReferences);
    expect(html).not.toContain('rowspan=');
    expect(html).toContain('این قرارداد لغو شده است');
    for (const p of output.contract.passengersDetail)
      expect(html).toContain(p.displayNameSnapshot);
  });
});
