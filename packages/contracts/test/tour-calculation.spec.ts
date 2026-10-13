import { describe, expect, it } from 'vitest';
import {
  calculateTourRoom,
  type TourRoomCalculationInput,
} from '../src/package-pricing/tour-calculation';

const input = (): TourRoomCalculationInput => ({
  basePerNight: '100',
  factor: '1',
  nights: 6,
  hotelCurrency: 'EUR',
  adjustment: { direction: 'increase', mode: 'percent', value: '10' },
  adults: 2,
  children: 0,
  adultFlight: { amount: '10000000', currencyCode: 'IRR' },
  childFlight: { amount: '5000000', currencyCode: 'IRR' },
  businessUplift: { amount: '20', currencyCode: 'USD' },
  businessCabin: false,
  commissionPercent: '5',
  flightCosts: [
    { adultUnitCost: '8000000', childUnitCost: '4000000', currencyCode: 'IRR' },
  ],
});
describe('tour package exact multi-currency pricing', () => {
  it('prices six nights, applies one markup and keeps flight currency separate', () => {
    const result = calculateTourRoom(input());
    expect(result.hotelPurchase).toBe('600.00');
    expect(result.hotelSale).toBe('660.00');
    expect(result.currencyAmounts).toEqual([
      {
        currencyCode: 'EUR',
        purchase: '600.00',
        sale: '660.00',
        commission: '33.00',
        profit: '27.00',
      },
      {
        currencyCode: 'IRR',
        purchase: '16000000',
        sale: '20000000',
        commission: '1000000',
        profit: '3000000',
      },
    ]);
  });
  it('applies a fixed discount once for the stay and includes child and business fares', () => {
    const result = calculateTourRoom({
      ...input(),
      children: 1,
      businessCabin: true,
      adjustment: { direction: 'decrease', mode: 'fixed', value: '25' },
    });
    expect(result.hotelSale).toBe('575.00');
    expect(
      result.currencyAmounts.find((item) => item.currencyCode === 'IRR')?.sale,
    ).toBe('25000000');
    expect(
      result.currencyAmounts.find((item) => item.currencyCode === 'USD')?.sale,
    ).toBe('40.00');
    expect(
      result.currencyAmounts.find((item) => item.currencyCode === 'EUR')
        ?.profit,
    ).toBe('-53.75');
  });
  it('sums same-currency components and never invents profit without purchase data', () => {
    const result = calculateTourRoom({
      ...input(),
      flightCosts: undefined,
      adultFlight: { amount: '200', currencyCode: 'EUR' },
    });
    expect(result.currencyAmounts).toEqual([
      {
        currencyCode: 'EUR',
        purchase: null,
        sale: '1060.00',
        commission: '53.00',
        profit: null,
      },
    ]);
  });
  it('deducts one fixed commission only from the selected currency profit', () => {
    const result = calculateTourRoom({
      ...input(),
      commissionMode: 'fixed',
      commissionAmount: { amount: '7', currencyCode: 'EUR' },
    });
    expect(
      result.currencyAmounts.find((item) => item.currencyCode === 'EUR'),
    ).toMatchObject({ commission: '7.00', profit: '53.00' });
    expect(
      result.currencyAmounts.find((item) => item.currencyCode === 'IRR'),
    ).toMatchObject({ commission: '0', profit: '4000000' });
  });
  it('rejects a discount greater than the stay cost and fractional rials', () => {
    expect(() =>
      calculateTourRoom({
        ...input(),
        adjustment: { direction: 'decrease', mode: 'fixed', value: '601' },
      }),
    ).toThrow();
    expect(() =>
      calculateTourRoom({
        ...input(),
        adultFlight: { amount: '10.1', currencyCode: 'IRR' },
      }),
    ).toThrow();
  });
});
