import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  HotelPurchaseSavings,
  hotelSavingsDifference,
} from './hotel-purchase-savings';
describe('hotel savings presentation', () => {
  it('subtracts exactly without floating-point or currency mixing', () => {
    expect(
      hotelSavingsDifference('9007199254740993.0001', '9007199254740993'),
    ).toBe('0.0001');
    expect(hotelSavingsDifference('100', '110')).toBe('-10.0000');
  });
  it('shows unavailable comparison rather than invented zero savings', () => {
    expect(renderToStaticMarkup(<HotelPurchaseSavings />)).toContain(
      'مقایسه قابل محاسبه نیست',
    );
  });
});

it('shows final hotel purchase even without a matching reference', () => {
  const html = renderToStaticMarkup(
    <HotelPurchaseSavings
      value={{
        version: 1,
        status: 'UNAVAILABLE',
        reason: 'NO_MATCHING_RATE',
        actualAmount: '180',
        referenceAmount: null,
        savingsAmount: null,
        currencyCode: 'USD',
        capturedAt: '',
        sourceBatchId: null,
        sourceBrokerName: null,
        checkIn: '',
        checkOut: '',
      }}
    />,
  );
  expect(html).toContain('180');
  expect(html).toContain('$');
  expect(html).toContain('خرید واقعی رزرواسیون');
  expect(html).toContain('مقایسه قابل محاسبه نیست');
});
