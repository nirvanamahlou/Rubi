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
