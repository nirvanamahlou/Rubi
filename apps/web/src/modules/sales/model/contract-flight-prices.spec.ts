import { expect, it } from 'vitest';
import { PASSENGER_FLIGHT_PRICES } from '@nora/contracts';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
it('prints all flight currencies and compatible legacy room shares without double charging', () => {
  const out = structuredClone(printFixture),
    p = out.contract.passengersDetail[0]!;
  out.contract.servicesDetail[0]!.metadata = {
    [PASSENGER_FLIGHT_PRICES]: JSON.stringify({
      [p.customerId]: [
        { amount: '12345', currencyCode: 'IRR' },
        { amount: '12.50', currencyCode: 'USD' },
      ],
    }),
  };
  out.contract.passengersDetail = out.contract.passengersDetail.map((p) => ({
    ...p,
    birthDate: '1990-01-01',
    serviceClientKeys: [...new Set([...p.serviceClientKeys, 'hotel'])],
  }));
  out.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'double',
      roomTypeNameSnapshot: 'DOUBLE VIEW',
      adults: 2,
      childAges: [],
      agreedPrice: { amount: '100', currencyCode: 'USD' },
    },
  ];
  const html = contractPrintHtml(out, printReferences),
    table = html.split('PASSENGERS & PRICING')[1]!.split('</table>')[0]!;
  expect(table).toContain('قیمت ریالی');
  expect(table).not.toContain('مبلغ پرواز');
  expect(table).toContain('قیمت ارزی');
  expect(table).toContain('50 $');
  expect(table).toContain('12.50 $');
  expect(table).toContain('12,345');
  expect(table).not.toContain('مبلغ فروش');
  expect(html).not.toContain('اتاق‌های قرارداد:');
});
it('hides only the main hotel room-type column for mixed types', () => {
  const out = structuredClone(printFixture);
  out.contract.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'single',
      roomTypeNameSnapshot: 'SINGLE VIEW',
      adults: 1,
      childAges: [],
    },
    {
      ordinal: 2,
      roomTypeId: 'double',
      roomTypeNameSnapshot: 'DOUBLE VIEW',
      adults: 2,
      childAges: [],
    },
  ];
  const section = contractPrintHtml(out, printReferences)
    .split('HOTEL INFORMATION')[1]!
    .split('</section>')[0]!;
  expect(section.split('</table>')[0]).not.toContain('نوع اتاق');
  expect(section).toContain('SINGLE VIEW');
  expect(section).toContain('DOUBLE VIEW');
});
it('keeps unknown passenger amounts blank without labeling whole-service prices as flights', () => {
  const html = contractPrintHtml(printFixture, printReferences);
  expect(html.split('PASSENGERS & PRICING')[1]!.split('</table>')[0]).toContain(
    '<td class="contract-total">—</td>',
  );
});
