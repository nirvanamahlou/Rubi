import { expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { emptySalesForm } from './sales-form';
import { withAutomaticReturn } from './automatic-return';
const out: TicketOfferV1 = {
  id: 'out',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T10:00:00Z',
  arrivalAt: '2099-10-01T12:00:00Z',
  carrierName: 'Carrier',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  loadGroupId: 'load',
  scheduledReturnDate: '2099-10-08',
  returnMinDays: 7,
  returnMaxDays: 7,
};
const back = {
  ...out,
  id: 'back',
  originId: 'destination',
  destinationId: 'origin',
  departureAt: '2099-10-08T10:00:00Z',
  arrivalAt: '2099-10-08T12:00:00Z',
};
const state = {
  ...emptySalesForm,
  originId: 'origin',
  destinationId: 'destination',
  serviceKinds: ['FLIGHT' as const],
  tripType: 'ROUND_TRIP' as const,
  outboundOffer: out,
  ticket: { ...emptySalesForm.ticket, outboundOfferId: out.id },
};
it('fills a registered return when the calendar finishes after outbound selection', () => {
  const selected = withAutomaticReturn(state, 'origin:destination', [back]);
  expect(selected.returnOffer?.id).toBe('back');
  expect(selected.returnDate).toBe('2099-10-08');
  expect(selected.ticket.returnOfferId).toBe('back');
});
it('uses the configured load and return offset, ignoring other loads and dates', () => {
  const selected = withAutomaticReturn(state, 'origin:destination', [
    { ...back, id: 'other-load', loadGroupId: 'different' },
    { ...back, id: 'wrong-day', departureAt: '2099-10-09T10:00:00Z' },
    back,
  ]);
  expect(selected.returnOffer?.id).toBe(back.id);
  expect(selected.returnDate).toBe('2099-10-08');
});
it('preserves manual returns and rejects stale routes, sold out and ambiguous partners', () => {
  const manual = { ...state, returnOffer: { ...back, id: 'manual' } };
  expect(withAutomaticReturn(manual, 'origin:destination', [back])).toBe(
    manual,
  );
  expect(withAutomaticReturn(state, 'old:route', [back])).toBe(state);
  expect(
    withAutomaticReturn(state, 'origin:destination', [
      { ...back, remainingCapacity: 0 },
    ]),
  ).toBe(state);
  expect(
    withAutomaticReturn(state, 'origin:destination', [
      back,
      { ...back, id: 'second' },
    ]),
  ).toBe(state);
  const floating = {
    ...state,
    contractFlights: {
      RETURN: {
        departureAt: back.departureAt,
        arrivalAt: back.arrivalAt,
        carrierName: 'Manual',
        serviceNumber: '9',
        cabinClassCode: 'ECONOMY' as const,
      },
    },
  };
  expect(withAutomaticReturn(floating, 'origin:destination', [back])).toBe(
    floating,
  );
});
