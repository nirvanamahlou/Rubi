import { describe, it, expect } from 'vitest';
import {
  validateTicketFlightNumbers,
  reservationFlightOutputKey,
  type TravelWorkflowCommandV1,
} from '@nora/contracts';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow,
} from './travel-workflow';
const key = reservationFlightOutputKey('flight-out', 'offer');
const command: TravelWorkflowCommandV1 = {
  action: 'TICKET_FLIGHT_NUMBERS',
  expectedVersion: 0,
  note: 'Synthetic output correction',
  ticketFlightNumbers: { [key]: ' b9 4512 ' },
};
describe('ticket output flight numbers', () => {
  it('normalizes only allowed flight keys and preserves previous immutable state', () => {
    const before = initialTravelWorkflow();
    const after = transitionTravelWorkflow(before, command, [], [key]);
    expect(after.ticketFlightNumbers).toEqual({ [key]: 'B9 4512' });
    expect(after.version).toBe(1);
    expect(before.ticketFlightNumbers).toBeUndefined();
    expect(after.supplierStatus).toBe(before.supplierStatus);
    expect(
      transitionTravelWorkflow(
        after,
        { ...command, expectedVersion: 1, ticketFlightNumbers: {} },
        [],
        [key],
      ).ticketFlightNumbers,
    ).toEqual({});
  });
  it('allows document-only edits after voucher issuance without changing issuance', () => {
    const state = { ...initialTravelWorkflow(), voucherIssued: true };
    expect(
      transitionTravelWorkflow(state, command, [], [key]).voucherIssued,
    ).toBe(true);
  });
  it('rejects cancelled and stale updates', () => {
    expect(() =>
      transitionTravelWorkflow(
        { ...initialTravelWorkflow(), supplierStatus: 'CANCELLED' },
        command,
        [],
        [key],
      ),
    ).toThrow('بسته');
    expect(() =>
      transitionTravelWorkflow(
        { ...initialTravelWorkflow(), version: 1 },
        command,
        [],
        [key],
      ),
    ).toThrow('نسخه');
  });
  it.each([
    null,
    [],
    { foreign: '123' },
    { [key]: '' },
    { [key]: '<script>' },
    { [key]: 'a'.repeat(33) },
    { [key]: 123 },
  ])('rejects malformed or foreign settings %#', (value) => {
    expect(() => validateTicketFlightNumbers(value, [key])).toThrow();
  });
});
