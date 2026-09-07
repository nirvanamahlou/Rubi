import { describe, expect, it } from 'vitest';
import { contractPrintHtml, contractMoney } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
describe('Saved contract print output', () => {
  it('applies the reference palette while preserving field and section order', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain('background:#10386b');
    expect(html).toContain('background:#dce6ee;color:#15375c');
    const body = html.slice(html.indexOf('<body>'));
    const labels = [
      'CONTRACT PARTIES',
      'PASSENGERS & PRICING',
      'FLIGHT INFORMATION',
      'HOTEL INFORMATION',
      'OTHER SERVICES',
      'APPROVAL & SIGNATURE',
    ];
    for (const label of labels) expect(body).toContain(label);
    expect(labels.map((label) => body.indexOf(label))).toEqual(
      labels.map((label) => body.indexOf(label)).sort((a, b) => a - b),
    );
    expect(body).toContain('نشانی:');
    expect(body).toContain('مبلغ توافق‌شده قرارداد');
    expect(body).not.toContain('021-72075000');
    expect(body).not.toContain('support@');
  });
  it.each([6, 42, 100, 250])(
    'renders every passenger and complete totals for %s people without truncation',
    (count) => {
      const output = structuredClone(printFixture);
      output.contract.passengersDetail = Array.from(
        { length: count },
        (_, i) => ({
          ...printFixture.contract.passengersDetail[0]!,
          id: 'test-' + i,
          displayNameSnapshot: 'PASSENGER-' + String(i).padStart(4, '0'),
          agreedPrices: [
            { currencyCode: 'IRR', amount: '100000000' },
            { currencyCode: 'USD', amount: '900.50' },
          ],
        }),
      );
      const html = contractPrintHtml(output, printReferences);
      for (const p of output.contract.passengersDetail)
        expect(html.split(p.displayNameSnapshot).length - 1).toBe(1);
      expect(html).toContain(contractMoney(String(count * 100000000)));
      expect(html).toContain('thead{display:table-header-group}');
      expect(html).toContain('.financial-summary{break-inside:avoid}');
      expect(html).toContain(
        'counter(page) " / " counter(pages);direction:ltr',
      );
      expect(html).not.toContain('max-height:297');
    },
  );
  it.each(['person', 'organization'] as const)(
    'allocates the complete passenger table width for %s contracts',
    (kind) => {
      const output = structuredClone(printFixture);
      output.customer.kind = kind;
      const html = contractPrintHtml(output, printReferences);
      const cols = [...html.matchAll(/<col style="width:(\d+)%">/g)].map(
        (match) => Number(match[1]),
      );
      expect(cols).toHaveLength(kind === 'person' ? 8 : 9);
      expect(cols.reduce((sum, width) => sum + width, 0)).toBe(100);
      expect(html).toContain('overflow-wrap:anywhere');
    },
  );
  it('includes the three user-supplied notices below signatures and above the site', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain(
      'در صورت تأیید نشدن هتل درخواستی، هتل مشابه جایگزین می‌گردد.',
    );
    expect(html).toContain(
      'این برگه بدون قبض رسید صندوق فاقد هرگونه اعتبار می‌باشد.',
    );
    expect(html).toContain('با آگاهی از مفاد قراردادهای خارج از کشور');
    expect(html).toContain('ارسال درخواست به آژانس نیایش سیر سحر');
    expect(html).toContain(
      'قبول تمامی شرایط، مواد و تبصره‌های قرارداد فوق می‌باشد.',
    );
    const terms = html.indexOf('<div class="customer-terms">');
    expect(terms).toBeGreaterThan(html.indexOf('<div class="signatures">'));
    expect(terms).toBeLessThan(html.indexOf('<footer>'));
    expect(html).toContain('.customer-terms{font-size:8.5pt;line-height:1.35');
  });
  it('separates passenger IRR and foreign amounts, sums each currency and prints hotel references', () => {
    const output = structuredClone(printFixture);
    output.contract.passengersDetail = output.contract.passengersDetail.map(
      (p, i) => ({
        ...p,
        accommodationKind: i ? 'CHILD_WITHOUT_BED' : 'DBL',
        agreedPrices: i
          ? [{ currencyCode: 'IRR', amount: '2.25' }]
          : [
              { currencyCode: 'IRR', amount: '9007199254740993.12' },
              { currencyCode: 'EUR', amount: '50.25' },
            ],
      }),
    );
    const html = contractPrintHtml(output, {
      ...printReferences,
      hotelLatinName: 'SAMPLE HOTEL',
      hotelWebsite: 'https://hotel.example',
    });
    expect(html).toContain('9,007,199,254,740,995.37');
    expect(html).toContain('50.25 EUR');
    expect(html).toContain(
      '<td class="contract-total"><div><bdi class="money">2.25</bdi></div></td><td></td>',
    );
    expect(html).toContain('کودک بدون تخت');
    expect(html).toContain('DBL');
    expect(html).toContain('SAMPLE HOTEL');
    expect(html).toContain('https://hotel.example');
    expect(html).toContain('Nystkt.ir');
    expect(html).not.toContain('>هتل نمونه<');
  });
  it('leaves the IRR cell blank for a foreign-only passenger and escapes hotel fields', () => {
    const output = structuredClone(printFixture);
    output.contract.passengersDetail = output.contract.passengersDetail.map(
      (p) => ({
        ...p,
        agreedPrices: [{ currencyCode: 'USD', amount: '100' }],
      }),
    );
    const html = contractPrintHtml(output, {
      ...printReferences,
      hotelLatinName: '<script>',
      hotelWebsite: '<img>',
    });
    expect(html).toContain(
      '<td class="contract-total"></td><td><div><bdi class="money">100 USD',
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img>');
  });
  it('prints entered whole-package passenger amounts with English money glyphs', () => {
    const output = structuredClone(printFixture);
    output.contract.passengersDetail = output.contract.passengersDetail.map(
      (p, i) => ({
        ...p,
        agreedPrices: [
          { currencyCode: 'IRR', amount: i ? '23456789.25' : '100000000' },
        ],
      }),
    );
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('100,000,000');
    expect(html).toContain('23,456,789.25');
    expect(html).toContain('font-family:Arial,sans-serif!important');
    expect(html).not.toContain('قیمت تفکیکی مسافر ثبت نشده');
  });
  it('uses agreed totals and confirmed Finance values without offer or purchase prices', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain('123,456,789.25');
    expect(html).toContain('103,456,789.25');
    expect(html).toContain('20,000,000');
    expect(html).not.toContain('999,999,999');
    expect(html).not.toContain('40,000,000');
    expect(html).toContain('900.50');
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
    expect(html).toContain('123,456,789.25');
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
  it('keeps B Nazanin and signatures but excludes operator notes and technical footer metadata', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain("local('B Nazanin')");
    expect(html).toContain('th,h2 em{background:#173d7a}');
    expect(html).not.toContain('رسید پرداخت');
    expect(html).not.toContain('شرکت فعال انتخاب‌شده');
    expect(html).not.toContain('travel-services-v1');
    expect(html).not.toContain('تهیه خروجی:');
    expect(html).not.toContain('localhost');
    expect(html).toContain('نام و امضای مسافر / نماینده');
    expect(html).toContain('نام و امضای مسئول فروش');
    expect(html).toContain('قیمت تفکیکی مسافر ثبت نشده');
    expect((html.match(/<section/g) || []).length).toBe(6);
  });
  it('formats large decimals without floating point loss', () => {
    expect(contractMoney('9007199254740993.12')).toBe(
      '9,007,199,254,740,993.12',
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
