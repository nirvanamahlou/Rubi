import { expect, it } from 'vitest';
import { reservationFormPriceText } from './reservation-form-price';

it('keeps proposed multicurrency prices exact and entirely English without conversion or summation', () => {
  const prices = [
    { amount: '9007199254740993.25', currencyCode: 'IRR' },
    { amount: '123.50', currencyCode: 'EUR' },
    { amount: '0', currencyCode: 'USD' },
  ];
  expect(reservationFormPriceText(prices, 'code')).toBe(
    '9,007,199,254,740,993.25 IRR · 123.50 EUR · 0 USD',
  );
  expect(reservationFormPriceText([], 'code')).toBe('');
  expect(
    reservationFormPriceText([{ amount: '123.50', currencyCode: 'EUR' }]),
  ).toBe('123.50 €');
});
