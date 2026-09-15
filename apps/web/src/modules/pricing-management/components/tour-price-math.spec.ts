import { describe, expect, it } from 'vitest';
import { previewHotelRoomSale } from './tour-price-math';

describe('hotel room sale preview', () => {
  const increase = {
    direction: 'increase',
    mode: 'percent',
    value: '10',
  } as const;

  it('prices one hotel room for five nights with its factor', () => {
    expect(previewHotelRoomSale('60', '1.7', 5, 'EUR', increase)).toEqual({
      purchase: '510.00',
      sale: '561.00',
    });
  });

  it('applies one fixed decrease to the stay, not each night', () => {
    expect(
      previewHotelRoomSale('60', '1', 5, 'EUR', {
        direction: 'decrease',
        mode: 'fixed',
        value: '20',
      }),
    ).toEqual({ purchase: '300.00', sale: '280.00' });
  });

  it('rejects invalid or below-zero selling prices', () => {
    expect(
      previewHotelRoomSale('60', '1', 5, 'EUR', {
        direction: 'decrease',
        mode: 'percent',
        value: '101',
      }),
    ).toBeNull();
    expect(
      previewHotelRoomSale('60', '1', 5, 'EUR', {
        direction: 'increase',
        mode: 'fixed',
        value: 'not a number',
      }),
    ).toBeNull();
  });

  it('keeps IRR fixed amounts integral', () => {
    expect(
      previewHotelRoomSale('1000', '1', 2, 'IRR', {
        direction: 'increase',
        mode: 'fixed',
        value: '150',
      }),
    ).toEqual({ purchase: '2000', sale: '2150' });
    expect(
      previewHotelRoomSale('1000', '1', 2, 'IRR', {
        direction: 'increase',
        mode: 'fixed',
        value: '1.5',
      }),
    ).toBeNull();
  });
});
