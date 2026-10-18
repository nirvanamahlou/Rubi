import { expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@nora/contracts';
import { reservationOutputPassengers } from './reservation-passenger-output';
import { ReservationRequestsController } from './reservations-runtime.module';
const snapshot = {
  passengerIds: ['a', 'b', 'a'],
  serviceSelections: [],
  hotelSelection: { checkInDate: '2026-10-18' },
} as unknown as SalesReservationRequestV1;
const actor = {
  permissions: ['reservations.read'],
  branchIds: ['branch'],
} as AuthenticatedActor;
it('resolves only request members, once per ID, at the trip date', async () => {
  const reservationOutputIdentity = vi.fn(async (id: string) => ({
    customerId: id,
    passportName: 'TEST / ' + id,
    hotelChildAgeBand: null,
  }));
  const result = await reservationOutputPassengers(
    snapshot,
    { reservationOutputIdentity } as never,
    actor,
  );
  expect(result.map((row) => row.customerId)).toEqual(['a', 'b']);
  expect(reservationOutputIdentity.mock.calls.map((call) => call[0])).toEqual([
    'a',
    'b',
  ]);
  expect(reservationOutputIdentity).toHaveBeenCalledWith(
    'a',
    '2026-10-18',
    actor,
  );
});
it('checks request branch before any identity reads and rejects readers without Reservations authority', async () => {
  const detail = vi.fn().mockRejectedValue(new Error('outside branch'));
  const reservationOutputIdentity = vi.fn();
  const controller = new ReservationRequestsController(
    {} as never,
    {} as never,
    {} as never,
    { detail } as never,
    {} as never,
    { reservationOutputIdentity } as never,
    {} as never,
  );
  await expect(
    controller.workflowDetail('request', { actor } as never),
  ).rejects.toThrow('outside branch');
  expect(reservationOutputIdentity).not.toHaveBeenCalled();
  detail.mockClear();
  await expect(
    controller.workflowDetail('request', {
      actor: { ...actor, permissions: [] },
    } as never),
  ).rejects.toThrow();
  expect(detail).not.toHaveBeenCalled();
});
it('uses the Tehran departure day rather than UTC, issuance time or hotel arrival for age calculation', async () => {
  const reservationOutputIdentity = vi.fn().mockResolvedValue({
    customerId: 'a',
    passportName: 'TEST / A',
    hotelChildAgeBand: null,
  });
  await reservationOutputPassengers(
    {
      ...snapshot,
      passengerIds: ['a'],
      ticketSelections: [
        { direction: 'OUTBOUND', departureAt: '2026-10-17T22:00:00Z' },
      ] as never,
    },
    { reservationOutputIdentity } as never,
    actor,
  );
  expect(reservationOutputIdentity).toHaveBeenCalledWith(
    'a',
    '2026-10-18',
    actor,
  );
});
