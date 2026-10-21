import { expect, it } from 'vitest';
import {
  passengerNetPrices,
  readPassengerDeductions,
  PASSENGER_DEDUCTIONS,
} from './passenger-deductions';
const money = (amount: string, currencyCode = 'IRR') => ({
  amount,
  currencyCode,
});
it('subtracts both deductions per person and currency with exact decimal precision', () => {
  expect(
    passengerNetPrices(
      {
        a: [money('9007199254740993.1234'), money('100', 'USD')],
        b: [money('50')],
      },
      {
        a: { discount: money('0.0001'), commission: money('10', 'USD') },
      },
    ),
  ).toEqual({
    a: [money('9007199254740993.1233'), money('90', 'USD')],
    b: [money('50')],
  });
});
it('never deducts against another passenger or converts currencies', () => {
  expect(() =>
    passengerNetPrices(
      { a: [money('20')], b: [money('100')] },
      { a: { discount: money('21') } },
    ),
  ).toThrow();
  expect(() =>
    passengerNetPrices(
      { a: [money('100')] },
      { a: { discount: money('1', 'USD') } },
    ),
  ).toThrow();
  expect(() =>
    passengerNetPrices({ a: [money('100')] }, { b: { discount: money('1') } }),
  ).toThrow();
  expect(
    passengerNetPrices(
      { a: [money('100')] },
      { a: { discount: money('80'), commission: money('20') } },
    ),
  ).toEqual({ a: [money('0')] });
});
it('validates optional, bounded metadata without changing legacy contracts', () => {
  expect(readPassengerDeductions([], [])).toEqual({});
  const parse = (data: unknown) =>
    readPassengerDeductions(
      [{ metadata: { [PASSENGER_DEDUCTIONS]: JSON.stringify(data) } }],
      [{ customerId: 'a' }],
    );
  expect(parse({ a: { discount: money('0') } })).toEqual({
    a: { discount: money('0') },
  });
  for (const value of [
    { b: { discount: money('1') } },
    { a: { discount: money('-1') } },
    { a: { commission: money('1.12345') } },
    { a: { other: money('1') } },
    [],
    null,
  ])
    expect(() => parse(value)).toThrow();
});
