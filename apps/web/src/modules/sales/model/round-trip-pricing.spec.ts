import { describe, expect, it } from 'vitest';
import { moneyUnits, type SalesServicePricingV1 } from '@nora/contracts';
import {
  combinedFlightPrices,
  splitFlightPrices,
  tripPricingView,
} from './round-trip-pricing';
import { emptySalesForm, salesPayload } from './sales-form';
const price = (
  day: string,
  agreed: string,
  currencyCode = 'IRR',
): SalesServicePricingV1 => ({
  version: 1,
  currencyCode,
  daySale: { basis: 'TOTAL', amount: day },
  agreed: { basis: 'TOTAL', amount: agreed },
});
describe('round-trip contract totals', () => {
  it('sends two service identities without doubling the agreed contract total', () => {
    const payload = salesPayload({
      ...emptySalesForm,
      tripType: 'ROUND_TRIP',
      serviceKinds: ['FLIGHT'],
      servicePricing: splitFlightPrices([price('200', '180.0001')], {}),
    });
    expect(payload.services.map((s) => s.clientKey)).toEqual([
      'flight-outbound',
      'flight-return',
    ]);
    const total = payload.priceComponents.reduce(
      (sum, p) =>
        sum + moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
      0n,
    );
    expect(total).toBe(moneyUnits('180.0001'));
  });
  it('keeps an incomplete decimal editable without crashing the form', () => {
    const split = splitFlightPrices([price('100', '.')], {});
    expect(combinedFlightPrices(split)[0]!.agreed.amount).toBe('.');
    expect(
      combinedFlightPrices(splitFlightPrices([price('100', '12.5')], split))[0]!
        .agreed.amount,
    ).toBe('12.5');
  });
  it('shows one round-trip row and keeps other services and currencies separate', () => {
    const view = tripPricingView(
      [
        { key: 'flight-outbound', title: 'رفت', hotel: false },
        { key: 'flight-return', title: 'برگشت', hotel: false },
        { key: 'hotel', title: 'هتل', hotel: true },
      ],
      {
        'flight-outbound': [price('100', '90'), price('1', '0.9', 'USD')],
        'flight-return': [price('200', '180')],
        hotel: [price('500', '450')],
      },
    );
    expect(view.services.map((s) => s.key)).toEqual([
      'flight-round-trip',
      'hotel',
    ]);
    expect(view.values['flight-round-trip']).toEqual([
      price('300', '270'),
      price('1', '0.9', 'USD'),
    ]);
    expect(view.values.hotel).toEqual([price('500', '450')]);
  });
  it('preserves catalog per-leg day snapshots and exact odd agreed units without floating-point loss', () => {
    const old = {
      'flight-outbound': [price('9007199254740993.0001', '10')],
      'flight-return': [price('3.0002', '20')],
    };
    const combined = combinedFlightPrices(old);
    combined[0]!.agreed.amount = '123.0001';
    const next = splitFlightPrices(combined, old);
    expect(next['flight-outbound']![0]!.daySale).toEqual(
      old['flight-outbound'][0]!.daySale,
    );
    expect(next['flight-return']![0]!.daySale).toEqual(
      old['flight-return'][0]!.daySale,
    );
    expect(
      moneyUnits(next['flight-outbound']![0]!.agreed.amount) +
        moneyUnits(next['flight-return']![0]!.agreed.amount),
    ).toBe(moneyUnits('123.0001'));
    expect(old['flight-outbound'][0]!.agreed.amount).toBe('10');
    expect(combinedFlightPrices(next)[0]!.agreed.amount).toBe('123.0001');
  });
  it('clears both legs when the combined entry is cleared and does not duplicate a total', () => {
    const next = splitFlightPrices([price('100', '')], {});
    expect(next['flight-outbound']![0]!.agreed.amount).toBe('');
    expect(next['flight-return']![0]!.agreed.amount).toBe('');
    expect(combinedFlightPrices(next)[0]!.daySale.amount).toBe('100');
    expect(splitFlightPrices([], next)['flight-return']).toEqual([]);
  });
  it('does not group one-way tickets', () => {
    const view = tripPricingView(
      [{ key: 'flight-return', title: 'برگشت', hotel: false }],
      { 'flight-return': [price('20', '15')] },
    );
    expect(view.combined).toBe(false);
    expect(view.services[0]!.key).toBe('flight-return');
  });
});
