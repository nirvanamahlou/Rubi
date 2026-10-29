import { describe, expect, it } from 'vitest';
import { contractPrintHtml, contractMoney } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
describe('Saved contract print output', () => {
  it('prints saved agreed prices by currency without obsolete flight columns or stale split amounts', () => {
    const output = structuredClone(printFixture);
    output.contract.passengersDetail[0]!.agreedPrices = [
      { amount: '345678', currencyCode: 'IRR' },
      { amount: '91.25', currencyCode: 'EUR' },
    ];
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('<th>قیمت ریالی</th><th>قیمت ارزی</th>');
    expect(html).toContain('345,678');
    expect(html).toContain('91.25');
    expect(html).not.toContain('<th>مبلغ پرواز</th>');
  });
  it('prints each subsequent actual hotel with its own dates and escapes snapshot text', () => {
    const output = structuredClone(printFixture);
    output.contract.hotelSelection!.additionalStays = [
      {
        hotelId: 'hotel-two',
        cityId: 'city-two',
        hotelNameSnapshot: 'SECOND <HOTEL>',
        checkInDate: '2026-10-04',
        checkOutDate: '2026-10-08',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: 'room-two',
            roomTypeNameSnapshot: 'Suite <SEA>',
            adults: 2,
            childAges: [4, 0],
            roomCategory: 'DOUBLE_EXTRA',
          },
        ],
      },
    ];
    const before = structuredClone(output);
    const html = contractPrintHtml(output, {
      ...printReferences,
      names: { ...printReferences.names, 'city-two': 'City Two' },
    });
    expect(html).toContain('SECOND &lt;HOTEL&gt;');
    expect(html).toContain('City Two');
    expect(html).toContain('اقامت‌های بعدی');
    expect(html).toContain('Suite &lt;SEA&gt;');
    expect(html).toContain('2 بزرگسال');
    expect(html).toContain('1 کودک');
    expect(html).toContain('1 نوزاد');
    expect(html).toContain('Double + 1 Extra Bed');
    expect(html).toContain('4 نفر');
    expect(output).toEqual(before);
  });
  it('shows the saved cheque policy and total including interest without changing passenger service prices', () => {
    const output = structuredClone(printFixture);
    output.contract.paymentTerms = {
      version: 1,
      mode: 'CHECK',
      plans: [
        {
          currencyCode: 'IRR',
          downPayment: '30000000',
          months: 3,
          firstDueDate: '2026-11-30',
        },
      ],
    };
    output.contract.priceComponents = [
      {
        type: 'BASE',
        title: 'خدمات',
        amount: '100000000',
        currencyCode: 'IRR',
      },
    ];
    output.contract.balances = [
      {
        currencyCode: 'IRR',
        amount: '110500000',
        confirmedPaid: '0',
        pendingFinance: '0',
        outstanding: '110500000',
      },
    ];
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('110,500,000');
    expect(html).toContain('30,000,000');
    expect(html).toContain('10,500,000');
    expect(html).toContain('فروش چکی');
    expect(html).toContain('اولین سررسید');
  });
  it('prints and escapes all four buyer fields independently from passenger names', () => {
    const output = structuredClone(printFixture);
    output.contract.customerNameSnapshot = 'Synthetic <Buyer>';
    output.customer = {
      kind: 'person',
      address: 'Saved <Address>',
      phone: '09120000000',
      postalCode: '0012345678',
    };
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('Synthetic &lt;Buyer&gt;');
    expect(html).toContain('Saved &lt;Address&gt;');
    expect(html).toContain('09120000000');
    expect(html).toContain('0012345678');
    expect(html).not.toContain('Synthetic <Buyer>');
  });
  it('keeps agreed total but omits paid and outstanding cards from customer output', () => {
    const output = structuredClone(printFixture);
    const before = structuredClone(output);
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('قیمت توافق‌شده قرارداد');
    expect(html).not.toContain('پرداخت تأییدشده مالی:');
    expect(html).not.toContain('مانده:');
    expect(html.match(/class="summary-card"/g)).toHaveLength(1);
    expect(output).toEqual(before);
  });
  it('applies the reference palette while preserving field and section order', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain('background:#10386b');
    expect(html).toContain('background:#dce6ee;color:#15375c');
    const body = html.slice(html.indexOf('<body>'));
    const labels = [
      'CONTRACT PARTIES',
      'PASSENGER SERVICES',
      'PASSENGERS & PRICING',
      'FLIGHT INFORMATION',
      'HOTEL INFORMATION',
      'APPROVAL & SIGNATURE',
    ];
    for (const label of labels) expect(body).toContain(label);
    expect(labels.map((label) => body.indexOf(label))).toEqual(
      labels.map((label) => body.indexOf(label)).sort((a, b) => a - b),
    );
    expect(body).toContain('نشانی:');
    expect(body).toContain('قیمت توافق‌شده قرارداد');
    expect(body).toContain('021-72075000');
    expect(body).toContain('support@niyayeshseir.com');
    expect(body).toContain('<em>01</em>');
    expect(body).toContain('<h1>قرارداد فروش خدمات مسافرتی</h1>');
    expect(body).toContain('class="summary-grid"');
  });
  it('uses the selected Master Data room type only in the hotel section', () => {
    const output = structuredClone(printFixture);
    output.contract.passengersDetail[0]!.accommodationKind = 'DBL';
    const html = contractPrintHtml(output, {
      ...printReferences,
      names: { ...printReferences.names, double: 'DELUXE SEA VIEW' },
    });
    const hotel = html.split('HOTEL INFORMATION')[1]!.split('</section>')[0]!;
    expect(hotel).toContain('DELUXE SEA VIEW');
    expect(hotel).not.toContain('DBL');
    expect(html.split('HOTEL INFORMATION')[0]).not.toContain('DBL');
    const missing = contractPrintHtml(output, { names: {} })
      .split('HOTEL INFORMATION')[1]!
      .split('</section>')[0]!;
    expect(missing).toContain('نام مرجع در دسترس نیست');
    expect(missing).not.toContain('DBL');
  });
  it('ignores legacy operational reservation amendments in the sales contract', () => {
    const output = structuredClone(printFixture);
    output.contract.servicesDetail[0]!.metadata = {
      reservationFormAmendment: JSON.stringify({
        settings: {
          text: {
            contractPartyName: 'طرف عملیاتی ساختگی',
            hotel: 'OPERATIONAL HOTEL',
            roomType: 'OPERATIONAL ROOM',
          },
          passengers: [
            {
              id: output.contract.passengersDetail[1]!.customerId,
              selected: true,
              age: 'CHD',
              hotelChildAgeBand: 'CHD_2_TO_6',
            },
          ],
        },
      }),
    };
    const html = contractPrintHtml(output, printReferences);
    expect(html).toContain('مشتری نمونه');
    expect(html).toContain('کودک (<bdi dir="ltr">6-12</bdi>)');
    expect(html).not.toContain('کودک ·');
    expect(html).not.toContain('طرف عملیاتی ساختگی');
    expect(html).not.toContain('OPERATIONAL HOTEL');
    expect(html).not.toContain('اصلاحات عملیاتی ثبت‌شده در قرارداد');
    expect((html.match(/<section/g) || []).length).toBe(6);
  });
  it('does not assign Niyayesh contact details to another issuer', () => {
    const output = structuredClone(printFixture);
    output.company.code = 'JAHAN_BASTAN';
    const html = contractPrintHtml(output, printReferences);
    expect(html).not.toContain('021-72075000');
    expect(html).not.toContain('support@niyayeshseir.com');
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
        expect(html.split(p.displayNameSnapshot).length - 1).toBe(2);
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
      expect(cols).toHaveLength(6);
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
  it('prints a saved plain-text notice once at the bottom before signatures and escapes HTML', () => {
    const output = structuredClone(printFixture);
    output.contract.servicesDetail[0]!.metadata = {
      ...output.contract.servicesDetail[0]!.metadata,
      contractNotice: '  توافق فروش\n<script>alert(1)</script> & مهم  ',
    };
    const html = contractPrintHtml(output, printReferences);
    const notice = html.indexOf('<section class="contract-notice">');
    expect(notice).toBeGreaterThan(html.indexOf('HOTEL INFORMATION'));
    expect(notice).toBeLessThan(html.indexOf('<tfoot>'));
    expect(html.match(/<section class="contract-notice">/g)).toHaveLength(1);
    expect(html).toContain(
      'توافق فروش\n&lt;script&gt;alert(1)&lt;/script&gt; &amp; مهم',
    );
    expect(html).not.toContain('<script>alert(1)</script>');
  });
  it.each([null, '', '   ', false])(
    'omits empty or invalid saved notice %s',
    (notice) => {
      const output = structuredClone(printFixture);
      output.contract.servicesDetail[0]!.metadata = { contractNotice: notice };
      expect(contractPrintHtml(output, printReferences)).not.toContain(
        '<section class="contract-notice">',
      );
    },
  );
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
    expect(html).toContain('>50.25</bdi>');
    expect(html).toContain('9,007,199,254,740,993.12');
    expect(html).toContain('<th>قیمت ریالی</th><th>قیمت ارزی</th>');
    expect(html).not.toContain('کودک بدون تخت');
    expect(html).not.toContain('DBL');
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
      '<td class="contract-total">—</td><td><div><bdi class="money">100 ',
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
    expect(html).toContain('123,456,789.25');
    expect(
      html.split('PASSENGERS & PRICING')[1]!.split('</table>')[0],
    ).toContain('23,456,789.25');
    expect(html).toContain('font-family:Arial,sans-serif!important');
    expect(html).not.toContain('قیمت تفکیکی مسافر ثبت نشده');
  });
  it('uses agreed totals without paid, outstanding, offer or purchase prices', () => {
    const html = contractPrintHtml(printFixture, printReferences);
    expect(html).toContain('123,456,789.25');
    expect(html).not.toContain('103,456,789.25');
    expect(html).not.toContain('20,000,000');
    expect(html).not.toContain('999,999,999');
    expect(html).not.toContain('40,000,000');
    expect(html).toContain('900.50');
    expect(html).toContain('$');
    expect(html).toContain('BUSINESS');
    expect(html).toContain('ترانسفر رفت');
    expect(html).not.toContain('OTHER SERVICES');
    expect(html).not.toContain('<th>کمیسیون</th>');
  });
  it('omits unrecorded commission for agency customers without inventing a deduction', () => {
    const html = contractPrintHtml(
      {
        ...printFixture,
        customer: { ...printFixture.customer, kind: 'organization' },
      },
      printReferences,
    );
    expect(html).not.toContain('<th>کمیسیون</th>');
    expect(html).not.toContain('هیچ مبلغی بابت آن');
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
    expect(html).toContain('h2 em{background:#10386b;color:white');
    expect(html).not.toContain('رسید پرداخت');
    expect(html).not.toContain('شرکت فعال انتخاب‌شده');
    expect(html).not.toContain('travel-services-v1');
    expect(html).not.toContain('تهیه خروجی:');
    expect(html).not.toContain('localhost');
    expect(html).toContain('نام و امضای مسافر / نماینده');
    expect(html).toContain('نام و امضای مسئول فروش');
    expect(html).not.toContain(
      'مبلغ پرواز هر مسافر جزئی از مبلغ کل قرارداد است.',
    );
    expect(html).toContain('<th>قیمت ریالی</th>');
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

it('uses the Jahan Bastan issuer throughout the contract without Niyayesh contact data', () => {
  const output = structuredClone(printFixture);
  output.company.code = 'JAHAN_BASTAN';
  output.company.persianName = 'شرکت نیایش سیر سحر';
  output.company.latinName = 'JAHAN BASTAN';
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('ارسال درخواست به آژانس جهان باستان');
  expect(html).toContain('jahan-brand');
  expect(html).not.toContain('نیایش');
  expect(html).not.toContain('Nystkt.ir');
  expect(html).not.toContain('niyayeshseir.com');
});

it('prints aggregate passenger prices as IRR and foreign totals without inventing flight/hotel prices', () => {
  const output = structuredClone(printFixture);
  const prices = Object.fromEntries(
    output.contract.passengersDetail.map((p) => [
      p.customerId,
      [
        { amount: '234567', currencyCode: 'IRR' },
        { amount: '123.45', currencyCode: 'USD' },
      ],
    ]),
  );
  output.contract.servicesDetail = output.contract.servicesDetail.map(
    (s, i) => ({
      ...s,
      metadata: {
        passengerPackagePricingVersion: 1,
        ...(i === 0 ? { passengerTotalPricesV1: JSON.stringify(prices) } : {}),
      },
    }),
  );
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('<th>قیمت ریالی</th>');
  expect(html).toContain('234,567');
  expect(html).toContain('123.45');
  expect(html).not.toContain('<th>مبلغ پرواز</th>');
  expect(html).not.toContain(
    'مبالغ ریالی و ارزی، قیمت کل خدمات هر مسافر هستند.',
  );
});

it('uses compact soft Latin names and room types, isolated rial glyphs and left-aligned stay dates', () => {
  const out = structuredClone(printFixture);
  out.contract.passengersDetail[0]!.displayNameSnapshot = 'SAMPLE <PASSENGER>';
  out.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'double',
      roomTypeNameSnapshot: 'DELUXE <ROOM>',
      adults: 1,
      childAges: [],
      agreedPrice: { amount: '1000', currencyCode: 'IRR' },
    },
  ];
  const before = structuredClone(out);
  const html = contractPrintHtml(out, {
    ...printReferences,
    international: true,
  });
  expect(html).toContain(
    'class="passenger-name"><bdi>SAMPLE &lt;PASSENGER&gt;</bdi>',
  );
  expect(html).toContain('class="room-type"><bdi>DELUXE &lt;ROOM&gt;');
  expect(html).toContain(
    'font-family:"Segoe UI",Tahoma,sans-serif;font-size:8.5pt;font-weight:400',
  );
  expect(html).toContain('<span class="currency-symbol" dir="ltr">IRR</span>');
  expect(html).toContain('font-family:Tahoma,"Segoe UI",sans-serif!important');
  expect(html).toContain(
    'class="stay-date-cell"><bdi class="stay-date" dir="ltr">',
  );
  expect(html).toContain('.stay-date-cell{text-align:left;direction:ltr}');
  expect(out).toEqual(before);
});

it('prints actual airport endpoints only in the flight section and preserves the contract destination', () => {
  const before = structuredClone(printFixture);
  const html = contractPrintHtml(printFixture, {
    ...printReferences,
    flightFacts: {
      offer1: {
        originAirport: {
          code: 'IKA',
          name: 'Imam Khomeini',
          cityName: 'Tehran',
        },
        destinationAirport: {
          code: 'GZP',
          name: 'Gazipasa Airport',
          cityName: 'Gazipasa',
        },
      },
    },
  });
  const section =
    html.split('FLIGHT INFORMATION')[1]?.split('HOTEL INFORMATION')[0] || '';
  expect(section).toContain('Gazipasa (GZP)');
  expect(section).toContain('Tehran (IKA)');
  expect(html).toContain('مقصد:');
  expect(printFixture).toEqual(before);
  expect(printFixture.contract.destinationId).toBe('antalya');
});

it('reserves every printed page for approval/footer and keeps compact two-column details', () => {
  const html = contractPrintHtml(printFixture, {
    ...printReferences,
    international: true,
  });
  expect(html).toContain('margin:7mm 7mm 12mm');
  expect(html).toContain('.document-pages>tfoot{display:table-footer-group}');
  expect(html.match(/class="contract-closing"/g)).toHaveLength(1);
  expect(html).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(html).toContain('<div>تلفن ثابت: <bdi>—</bdi></div><div>نشانی:');
  expect(html).toContain('ورود هتل</th>');
  expect(html).toContain('خروج هتل</th>');
  expect(html).not.toContain('چک‌این هتل</th>');
  expect(html).toContain('class="flight-route"');
  expect(html).toContain('IRR</span>');
});

it('uses the dedicated public contract capability instead of the pending QR', () => {
  const url = 'https://example.test/d/' + 'a'.repeat(32);
  const html = contractPrintHtml(printFixture, {
    ...printReferences,
    publicDocumentUrl: url,
  });
  expect(html).toContain(url);
  expect(html).toContain('data-public-document-qr');
  expect(html).not.toContain('pending-server');
});

it('prints aggregate historical service age counts instead of empty personal passenger tables', () => {
  const output = structuredClone(printFixture);
  output.contract.passengersDetail = [];
  const parties = Object.fromEntries(
    output.contract.servicesDetail.map((s) => [
      s.clientKey,
      { adults: 2, children: 1, infants: 1 },
    ]),
  );
  output.contract.servicesDetail[0]!.metadata = {
    legacyServicePartiesV2: JSON.stringify(parties),
  };
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('تعداد: 4 نفر');
  expect(html).toContain('<th>نوزاد</th>');
  expect(html).not.toContain('class="passengers passenger-services"');
  expect(html).not.toContain('class="passengers passenger-prices"');
});

it('renders the supplied seller safely in the header shared by preview and PDF', () => {
  const output = {
    ...structuredClone(printFixture),
    ownerName: 'Actual <Seller> & Team',
  };
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain(
    'مسئول فروش<strong>Actual &lt;Seller&gt; &amp; Team</strong>',
  );
  expect(html).not.toContain('Actual <Seller>');
});

it('prints saved room prices for booked adults without optional birth dates', () => {
  const output = structuredClone(printFixture);
  output.contract.passengersDetail = output.contract.passengersDetail.map(
    (p) => ({ ...p, birthDate: '', ageCategory: 'ADT' }),
  );
  output.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Synthetic Double',
      adults: 2,
      childAges: [],
      agreedPrice: { amount: '100', currencyCode: 'USD' },
    },
  ];
  const before = structuredClone(output);
  expect(() => contractPrintHtml(output, printReferences)).not.toThrow();
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('50');
  expect(html).toContain('Synthetic Double');
  expect(output).toEqual(before);
});

it('keeps saved room totals printable before historical passenger slots are completed', () => {
  const output = structuredClone(printFixture);
  output.contract.passengersDetail = [];
  output.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Synthetic Double',
      adults: 2,
      childAges: [],
      agreedPrice: { amount: '123.4567', currencyCode: 'USD' },
    },
  ];
  const before = structuredClone(output);
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('123.4567');
  expect(output).toEqual(before);
});
it('does not allocate a room share to a child whose birth date is absent', () => {
  const output = structuredClone(printFixture);
  output.contract.passengersDetail = output.contract.passengersDetail.map(
    (p) => ({ ...p, birthDate: '' }),
  );
  output.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'Synthetic Double',
      adults: 2,
      childAges: [],
      agreedPrice: { amount: '123.4567', currencyCode: 'USD' },
    },
  ];
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('123.4567');
  expect(html).not.toContain('61.7283');
  expect(html).not.toContain('61.7284');
});
