import { expect, it } from 'vitest';
import {
  packageAmountToRial,
  packageRoomToRial,
  packageFieldsToRial,
} from './rial-conversion';
it('multiplies exactly and rounds only the final rial, including large prices and losses', () => {
  expect(
    packageAmountToRial('123456789012345.67', 'EUR', { EUR: '600000' }),
  ).toBe('74074073407407402000');
  expect(packageAmountToRial('-1.25', 'USD', { USD: '10' })).toBe('-13');
  expect(() => packageAmountToRial('100', 'EUR', {})).toThrow('EUR');
});
it('combines foreign and rial components without inventing unknown purchase costs', () => {
  const row = {
    hotelPurchase: '100',
    hotelSale: '120',
    currencyCode: 'EUR',
    currencyAmounts: [
      {
        currencyCode: 'EUR',
        sale: '120',
        purchase: '100',
        commission: '6',
        profit: '14',
      },
      {
        currencyCode: 'IRR',
        sale: '1000',
        purchase: '500',
        commission: '50',
        profit: '450',
      },
    ],
  };
  const converted = packageRoomToRial(row, { EUR: '100' });
  expect(converted.currencyCode).toBe('IRR');
  expect(converted.currencyAmounts).toEqual([
    {
      currencyCode: 'IRR',
      sale: '13000',
      purchase: '10500',
      commission: '650',
      profit: '1850',
    },
  ]);
  expect(row.currencyCode).toBe('EUR');
  expect(
    packageRoomToRial(
      {
        ...row,
        currencyAmounts: [{ ...row.currencyAmounts[0]!, purchase: null }],
      },
      { EUR: '100' },
    ).currencyAmounts[0]?.profit,
  ).toBeNull();
});
it('converts monetary footer fields while keeping commission percentages intact', () => {
  const fields = [
    {
      id: 'adult',
      title: 'Adult',
      kind: 'adultFlight' as const,
      amount: '10',
      currencyCode: 'EUR',
      mode: 'fixed' as const,
    },
    {
      id: 'commission',
      title: 'Commission',
      kind: 'commission' as const,
      amount: '5',
      currencyCode: 'EUR',
      mode: 'percent' as const,
    },
  ];
  expect(packageFieldsToRial(fields, { EUR: '100' })).toEqual([
    { ...fields[0], amount: '1000', currencyCode: 'IRR' },
    fields[1],
  ]);
});
