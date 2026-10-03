import { describe, expect, it } from 'vitest';
import {
  resetSalesTicketRange,
  salesFlightRangeReady,
} from './sales-flight-range';
import { emptySalesForm } from './sales-form';

describe('ticket search date gate', () => {
  it.each([
    { from: '', to: '' },
    { from: '2026-10-01', to: '' },
    { from: '2026-10-08', to: '2026-10-01' },
    { from: '2026-02-30', to: '2026-03-05' },
  ])('rejects partial, reversed or invalid calendar dates %j', (range) => {
    expect(salesFlightRangeReady(range)).toBe(false);
  });
  it('allows one day and an ordered date range', () => {
    expect(
      salesFlightRangeReady({ from: '2026-10-01', to: '2026-10-01' }),
    ).toBe(true);
    expect(
      salesFlightRangeReady({ from: '2026-10-01', to: '2026-10-08' }),
    ).toBe(true);
  });
  it('clears both catalog selections and quotes while retaining unrelated hotel pricing', () => {
    const pricing = [
      {
        version: 1 as const,
        currencyCode: 'USD',
        daySale: { basis: 'TOTAL' as const, amount: '20' },
        agreed: { basis: 'TOTAL' as const, amount: '20' },
      },
    ];
    const state = {
      ...emptySalesForm,
      ticket: {
        ...emptySalesForm.ticket,
        outboundOfferId: 'old-out',
        returnOfferId: 'old-back',
      },
      servicePricing: {
        'flight-outbound': pricing,
        'flight-return': pricing,
        hotel: pricing,
      },
    };
    const patch = resetSalesTicketRange(state);
    expect(patch.ticket).toMatchObject({
      outboundOfferId: '',
      returnOfferId: '',
    });
    expect(patch.servicePricing).toEqual({ hotel: pricing });
    expect(state.ticket.outboundOfferId).toBe('old-out');
  });
});
