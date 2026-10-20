import { describe, expect, it } from 'vitest';
import {
  passengerHotelStay,
  passengerHotelStayError,
  roomDrivenFlightParty,
} from './contract-guest-stays';
describe('room driven combined contract parties and hotel stays', () => {
  const shared = { checkIn: '2026-11-01', checkOut: '2026-11-07' };
  it('adds flight-only people once and applies flight age boundaries to room occupants', () => {
    const party = roomDrivenFlightParty(
      [
        {
          ordinal: 1,
          roomTypeId: 'double',
          roomTypeNameSnapshot: 'Double',
          adults: 2,
          childAges: [1, 5, 12],
        },
      ],
      { adults: 1, childAges: [8], infantAges: [] },
    );
    expect(party.passengerComposition).toEqual({
      adults: 4,
      children: 2,
      infants: 1,
    });
    expect(party.childAges).toEqual([5, 8]);
  });
  it('inherits live shared dates while locked, not stale saved dates', () => {
    expect(
      passengerHotelStay(true, shared, {
        ...shared,
        checkIn: '2026-10-01',
        different: false,
      }),
    ).toEqual({ ...shared, different: false });
  });
  it('keeps an explicit different stay and never assigns a stay to a flight-only person', () => {
    const override = {
      different: true,
      checkIn: '2026-11-02',
      checkOut: '2026-11-05',
    };
    expect(passengerHotelStay(true, shared, override)).toEqual(override);
    expect(passengerHotelStay(false, shared, override)).toBeNull();
    expect(passengerHotelStayError(override)).toBeNull();
  });
  it('rejects impossible, missing, equal and reversed dates', () => {
    for (const checkOut of ['', '2026-02-30', '2026-11-01', '2026-10-31'])
      expect(
        passengerHotelStayError({ ...shared, checkOut, different: true }),
      ).not.toBeNull();
  });
});
