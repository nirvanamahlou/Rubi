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
it('falls back to Tehran arrival day when no hotel check-in is saved', async () => {
  const reservationOutputIdentity = vi
    .fn()
    .mockResolvedValue({ customerId: 'a', hotelChildAgeBand: null });
  await reservationOutputPassengers(
    {
      ...snapshot,
      hotelSelection: undefined,
      passengerIds: ['a'],
      ticketSelections: [
        {
          direction: 'OUTBOUND',
          departureAt: '2026-10-16T18:00:00Z',
          arrivalAt: '2026-10-17T22:00:00Z',
        },
      ] as never,
    } as unknown as SalesReservationRequestV1,
    { reservationOutputIdentity } as never,
    actor,
  );
  expect(reservationOutputIdentity).toHaveBeenCalledWith(
    'a',
    '2026-10-18',
    actor,
  );
});
it('loads the saved buyer through Sales only after authorizing the historical request and leaves passengers empty', async () => {
  const detail = vi.fn().mockResolvedValue({
    contractId: 'contract',
    snapshot: { ...snapshot, passengerIds: [] },
  });
  const read = vi
    .fn()
    .mockResolvedValue(
      new Map([['contract', { contractPartyName: 'SYNTHETIC BUYER' }]]),
    );
  const reservationOutputIdentity = vi.fn();
  const controller = new ReservationRequestsController(
    {} as never,
    {} as never,
    {} as never,
    { detail } as never,
    { read: vi.fn().mockResolvedValue({}) } as never,
    { reservationOutputIdentity } as never,
    {} as never,
    { read } as never,
  );
  const result = await controller.workflowDetail('request', { actor } as never);
  expect(result.data.contractPartyName).toBe('SYNTHETIC BUYER');
  expect(result.data.outputPassengers).toEqual([]);
  expect(read).toHaveBeenCalledWith(['contract'], actor);
  expect(reservationOutputIdentity).not.toHaveBeenCalled();
  detail.mockRejectedValueOnce(new Error('outside branch'));
  read.mockClear();
  await expect(
    controller.workflowDetail('request', { actor } as never),
  ).rejects.toThrow('outside branch');
  expect(read).not.toHaveBeenCalled();
});
it('resolves only request members, once per ID, at the trip date', async () => {
  const reservationOutputIdentity = vi.fn(async (id: string) => ({
    customerId: id,
    passportName: 'TEST / ' + id,
    gender: id === 'a' ? 'M' : 'F',
    hotelChildAgeBand: null,
  }));
  const result = await reservationOutputPassengers(
    snapshot,
    { reservationOutputIdentity } as never,
    actor,
  );
  expect(result.map((row) => row.customerId)).toEqual(['a', 'b']);
  expect(result.map((row) => row.gender)).toEqual(['M', 'F']);
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
it('uses hotel check-in rather than flight departure for child age calculation', async () => {
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
        {
          direction: 'OUTBOUND',
          departureAt: '2026-10-16T22:00:00Z',
          arrivalAt: '2026-10-17T02:00:00Z',
        },
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
