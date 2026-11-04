import { expect, it } from 'vitest';
import {
  PASSENGER_DEDUCTIONS,
  PASSENGER_FLIGHT_PRICES,
  PASSENGER_HOTEL_PRICES,
  moneyUnits,
} from '@nora/contracts';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
import {
  contractSaleComponents,
  emptySalesForm,
  salesPayload,
} from './sales-form';
import { printCityInternational } from './contract-print-country';

it('sends both service prices and per-person deductions with matching exact net totals', () => {
  const state = {
    ...emptySalesForm,
    priceEntryMode: 'CONTRACT_TOTAL' as const,
    automaticComponentPricing: true,
    serviceKinds: ['FLIGHT', 'HOTEL'] as typeof emptySalesForm.serviceKinds,
    passengers: [
      { customerId: 'a', displayName: 'Person', birthDate: '1990-01-01' },
    ],
    hotel: { ...emptySalesForm.hotel, guestCustomerIds: ['a'] },
    passengerFlightPrices: { a: [{ currencyCode: 'IRR', amount: '100' }] },
    passengerHotelPrices: { a: [{ currencyCode: 'IRR', amount: '200' }] },
    passengerDeductions: {
      a: {
        discount: { currencyCode: 'IRR', amount: '10' },
        commission: { currencyCode: 'IRR', amount: '5' },
      },
    },
  };
  const parts = contractSaleComponents(state);
  expect(
    parts.reduce(
      (sum, p) =>
        sum + moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
      0n,
    ),
  ).toBe(moneyUnits('285'));
  const payload = salesPayload(state);
  expect(payload.services[0]!.metadata?.[PASSENGER_DEDUCTIONS]).toBe(
    JSON.stringify(state.passengerDeductions),
  );
});
it('prints actual hotel and flight amounts in any currency and omits only empty deduction columns', () => {
  const output = structuredClone(printFixture);
  const [a, b] = output.contract.passengersDetail;
  output.contract.servicesDetail[0]!.metadata = {
    [PASSENGER_FLIGHT_PRICES]: JSON.stringify({
      [a!.customerId]: [{ currencyCode: 'USD', amount: '80' }],
      [b!.customerId]: [{ currencyCode: 'IRR', amount: '2000' }],
    }),
    [PASSENGER_DEDUCTIONS]: JSON.stringify({
      [a!.customerId]: { discount: { currencyCode: 'USD', amount: '5' } },
    }),
  };
  output.contract.servicesDetail.find((s) => s.kind === 'HOTEL')!.metadata = {
    [PASSENGER_HOTEL_PRICES]: JSON.stringify({
      [a!.customerId]: [{ currencyCode: 'IRR', amount: '5000' }],
      [b!.customerId]: [{ currencyCode: 'USD', amount: '30' }],
    }),
  };
  const table = contractPrintHtml(output, printReferences)
    .split('PASSENGERS & PRICING')[1]!
    .split('</table>')[0]!;
  expect(table).toContain('قیمت ارزی');
  expect(table).toContain('80 $');
  expect(table).toContain(
    '5,000 <span class="currency-symbol" dir="ltr">IRR</span>',
  );
  expect(table).toContain('30 $');
  expect(table).toContain('<th>تخفیف</th>');
  expect(table).not.toContain('<th>کمیسیون</th>');
  output.customer.kind = 'organization';
  output.contract.servicesDetail[0]!.metadata = {
    ...output.contract.servicesDetail[0]!.metadata,
    [PASSENGER_DEDUCTIONS]: JSON.stringify({
      [a!.customerId]: { commission: { amount: '5', currencyCode: 'USD' } },
    }),
  };
  const agencyPrint = contractPrintHtml(output, printReferences);
  expect(agencyPrint).toContain('<th>کمیسیون</th>');
  expect(agencyPrint).not.toContain('هیچ مبلغی بابت آن');
  expect(contractPrintHtml(printFixture, printReferences)).not.toContain(
    '<th>تخفیف</th>',
  );
});
it('uses English Gregorian travel dates for international prints, without changing registration dates', () => {
  const html = contractPrintHtml(printFixture, {
    ...printReferences,
    international: true,
  });
  expect(html.split('FLIGHT INFORMATION')[1]).toContain('19 September 2026');
  expect(html.split('HOTEL INFORMATION')[1]).toContain('20/09/2026');
});
it('resolves foreign countries from canonical references and falls back without inventing geography', async () => {
  expect(
    await printCityInternational(
      { attributes: { countryId: 'country' } },
      async () => ({ code: 'TR', attributes: {} }),
    ),
  ).toBe(true);
  expect(
    await printCityInternational(
      { attributes: { countryId: 'country' } },
      async () => ({ code: 'IR', attributes: {} }),
    ),
  ).toBe(false);
  expect(
    await printCityInternational({ attributes: {} }, async () => undefined),
  ).toBe(false);
});

it('uses passenger IRR and foreign sale amounts without adding historical room amounts', () => {
  const state = {
    ...emptySalesForm,
    passengerTotalPricing: true,
    serviceKinds: ['HOTEL'] as typeof emptySalesForm.serviceKinds,
    passengers: [
      { customerId: 'a', displayName: 'Synthetic Guest', birthDate: '' },
    ],
    passengerPrices: {
      a: [
        { currencyCode: 'IRR', amount: '25000.125' },
        { currencyCode: 'EUR', amount: '75.5' },
      ],
    },
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Synthetic Room',
          adults: 1,
          childAges: [],
          agreedPrice: { currencyCode: 'USD', amount: '999999' },
        },
      ],
    },
  };
  const before = structuredClone(state);
  expect(
    contractSaleComponents(state).map((p) => [p.currencyCode, p.amount]),
  ).toEqual([
    ['IRR', '25000.125'],
    ['EUR', '75.5'],
  ]);
  expect(state).toEqual(before);
});
