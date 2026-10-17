import { describe, it, expect } from 'vitest';
import {
  applyPackageRoomSales,
  changePackageSale,
  validatePackageRoomSales,
} from './room-sale-overrides';
describe('package room sale changes', () => {
  it('adjusts the current sale repeatedly with exact rounding', () => {
    expect(changePackageSale('200', 'EUR', 'PERCENT', '10', 'increase')).toBe(
      '220.00',
    );
    expect(changePackageSale('220', 'EUR', 'PERCENT', '10', 'increase')).toBe(
      '242.00',
    );
    expect(changePackageSale('242', 'EUR', 'AMOUNT', '5', 'decrease')).toBe(
      '237.00',
    );
    expect(changePackageSale('237', 'EUR', 'SET', '0', 'increase')).toBe(
      '0.00',
    );
    expect(() =>
      changePackageSale('10', 'EUR', 'AMOUNT', '11', 'decrease'),
    ).toThrow();
    expect(() =>
      changePackageSale('10', 'IRR', 'SET', '1.25', 'increase'),
    ).toThrow();
  });
  it('changes only the selected room/currency and recomputes profit and commission without changing purchase', () => {
    const price = {
      hotelRateId: 'r',
      roomCode: 'double',
      hotelPurchase: '200',
      hotelSale: '200',
      currencyAmounts: [
        {
          currencyCode: 'EUR',
          purchase: '100',
          sale: '150',
          commission: '15',
          profit: '35',
        },
        {
          currencyCode: 'IRR',
          purchase: null,
          sale: '500',
          commission: '50',
          profit: null,
        },
      ],
    };
    const result = applyPackageRoomSales(
      price,
      [
        {
          hotelRateId: 'r',
          roomCode: 'double',
          currencyCode: 'EUR',
          amount: '180',
        },
      ],
      'percent',
      '10',
    );
    expect(result.currencyAmounts[0]).toEqual({
      currencyCode: 'EUR',
      purchase: '100',
      sale: '180.00',
      commission: '18.00',
      profit: '62.00',
    });
    expect(result.currencyAmounts[1]).toEqual(price.currencyAmounts[1]);
    expect(result.hotelPurchase).toBe('200');
    expect(price.currencyAmounts[0]?.sale).toBe('150');
    expect(
      applyPackageRoomSales(
        { ...price, roomCode: 'single' },
        [
          {
            hotelRateId: 'r',
            roomCode: 'double',
            currencyCode: 'EUR',
            amount: '180',
          },
        ],
        'percent',
        '10',
      ),
    ).toEqual({ ...price, roomCode: 'single' });
  });
  it('rejects duplicate keys, invalid precision, unfinished text and unknown composition', () => {
    const item = {
      hotelRateId: 'r',
      roomCode: 'double',
      currencyCode: 'EUR',
      amount: '12.5',
    };
    expect(validatePackageRoomSales([item])[0]?.amount).toBe('12.50');
    expect(() => validatePackageRoomSales([item, item])).toThrow();
    for (const amount of ['', '-2', 'NaN', '12.', '1.123'])
      expect(() => validatePackageRoomSales([{ ...item, amount }])).toThrow();
    expect(() =>
      validatePackageRoomSales([{ ...item, roomCode: 'unknown' }]),
    ).toThrow();
  });
});
