import { expect, it } from 'vitest';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
it.each([
  [2, 'کودک (2-6)'],
  [5, 'کودک (2-6)'],
  [6, 'کودک (6-12)'],
  [11, 'کودک (6-12)'],
  [12, 'کودک (12-18)'],
  [17, 'کودک (12-18)'],
])(
  'prints the saved child birthday band at departure for age %s in both passenger tables',
  (age, label) => {
    const out = structuredClone(printFixture);
    out.contract.departureDate = '2026-09-19';
    const child = out.contract.passengersDetail[1]!;
    child.birthDate = `${2026 - Number(age)}-09-19`;
    child.ageCategory = 'CHD';
    const html = contractPrintHtml(out, printReferences);
    for (const section of ['PASSENGER SERVICES', 'PASSENGERS & PRICING'])
      expect(
        html
          .split(section)[1]!
          .split('</table>')[0]!
          .replace(/<[^>]*>/g, ''),
      ).toContain(label);
  },
);
it('prints actual service membership and distinct hotel stays separately from money', () => {
  const output = structuredClone(printFixture);
  const [a, b] = output.contract.passengersDetail;
  output.contract.servicesDetail = [
    ...output.contract.servicesDetail,
    {
      clientKey: 'transfer-return',
      kind: 'TRANSFER',
      titleSnapshot: 'ترانسفر برگشت',
      metadata: { direction: 'RETURN' },
    },
  ];
  a!.serviceClientKeys = ['flight-out', 'hotel', 'transfer-out', 'visa'];
  b!.serviceClientKeys = ['flight-return', 'hotel', 'transfer-return'];
  output.contract.servicesDetail.find((s) => s.kind === 'HOTEL')!.metadata = {
    passengerHotelStaysV1: JSON.stringify({
      [a!.customerId]: {
        different: true,
        checkInDate: '2026-09-21',
        checkOutDate: '2026-09-24',
      },
    }),
    passengerHotelPricesV1: JSON.stringify({
      [a!.customerId]: [{ amount: '70.25', currencyCode: 'USD' }],
      [b!.customerId]: [{ amount: '90', currencyCode: 'USD' }],
    }),
  };
  output.contract.servicesDetail[0]!.metadata = {
    passengerFlightPricesV1: JSON.stringify({
      [a!.customerId]: [{ amount: '12000', currencyCode: 'IRR' }],
      [b!.customerId]: [{ amount: '13000', currencyCode: 'IRR' }],
    }),
  };
  const before = structuredClone(output);
  const html = contractPrintHtml(output, {
    ...printReferences,
    international: true,
  });
  const services = html.split('PASSENGER SERVICES')[1]!.split('</section>')[0]!;
  const prices = html.split('PASSENGERS & PRICING')[1]!.split('</table>')[0]!;
  const rows = [...services.matchAll(/<tr>(.*?)<\/tr>/g)]
    .slice(1)
    .map((m) => [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((c) => c[1]!));
  expect(rows).toHaveLength(2);
  expect(rows[0]![3]).toContain('service-selected');
  expect(rows[0]![4]).toContain('service-empty');
  expect(rows[0]![5]).toContain('21/09/2026');
  expect(rows[0]![6]).toContain('24/09/2026');
  expect(rows[0]![7]).toContain('service-selected');
  expect(rows[0]![8]).toContain('service-empty');
  expect(rows[1]![3]).toContain('service-empty');
  expect(rows[1]![4]).toContain('service-selected');
  expect(rows[1]![5]).toContain('20/09/2026');
  expect(rows[1]![6]).toContain('25/09/2026');
  expect(rows[1]![7]).toContain('service-empty');
  expect(rows[1]![8]).toContain('service-selected');
  expect(rows[0]![9]).toContain('ویزا');
  expect(rows[1]![9]).not.toContain('ویزا');
  expect(services).not.toContain('70.25');
  expect(services).not.toContain('12,000');
  expect(prices).toContain('70.25 $');
  expect(prices).toContain('90 $');
  expect(prices).toContain('12,000');
  expect(prices).toContain('13,000');
  expect(prices).not.toContain('چک‌این');
  expect(prices).not.toContain('ترانسفر');
  expect(output).toEqual(before);
});
it('leaves hotel dates blank for flight-only guests and escapes passenger and other-service names', () => {
  const output = structuredClone(printFixture);
  const person = output.contract.passengersDetail[0]!;
  person.displayNameSnapshot = '<Passenger>';
  person.serviceClientKeys = ['flight-out', 'custom'];
  output.contract.servicesDetail = [
    ...output.contract.servicesDetail,
    {
      clientKey: 'custom',
      kind: 'OTHER',
      titleSnapshot: '<Other>',
    },
  ];
  const services = contractPrintHtml(output, printReferences)
    .split('PASSENGER SERVICES')[1]!
    .split('</section>')[0]!;
  expect(services).toContain('&lt;Passenger&gt;');
  expect(services).toContain('&lt;Other&gt;');
  expect(services).not.toContain('<Passenger>');
  const firstRow = [...services.matchAll(/<tr>(.*?)<\/tr>/g)][1]![1]!;
  expect(firstRow).toContain(
    '<td class="stay-date-cell">—</td><td class="stay-date-cell">—</td>',
  );
});

it('prints city tour, guide and visa only in each assigned passenger Other Services cell', () => {
  const out = structuredClone(printFixture);
  out.contract.servicesDetail = [
    ...out.contract.servicesDetail,
    {
      clientKey: 'city-tour',
      kind: 'OTHER',
      titleSnapshot: 'گشت شهری',
      metadata: { additionalServiceRole: 'CITY_TOUR' },
    },
    {
      clientKey: 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: 'راهنما',
      metadata: { additionalServiceRole: 'TOUR_GUIDE' },
    },
  ];
  out.contract.passengersDetail[0]!.serviceClientKeys = [
    ...out.contract.passengersDetail[0]!.serviceClientKeys,
    'city-tour',
    'tour-guide',
  ];
  const html = contractPrintHtml(out, printReferences);
  expect(html).not.toContain('OTHER SERVICES');
  const rows = [
    ...html
      .split('PASSENGER SERVICES')[1]!
      .split('</table>')[0]!
      .matchAll(/<tr>(.*?)<\/tr>/g),
  ]
    .slice(1)
    .map((m) => m[1]!);
  expect(rows[0]).toContain('ویزا، گشت شهری، راهنما');
  expect(rows[1]).not.toContain('گشت شهری');
  expect(rows[1]).not.toContain('راهنما');
  expect(rows[1]).not.toContain('ویزا');
});
