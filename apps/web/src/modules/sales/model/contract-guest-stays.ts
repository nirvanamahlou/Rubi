import type { SalesFormState } from './sales-form';
export interface PassengerHotelStay {
  different: boolean;
  checkIn: string;
  checkOut: string;
}
export interface FlightOnlyParty {
  adults: number;
  childAges: number[];
  infantAges: number[];
}
/** Flight age bands differ from hotel age bands (hotel children may be 12–14). */
export function roomDrivenFlightParty(
  rooms: SalesFormState['hotel']['rooms'],
  flightOnly: FlightOnlyParty,
) {
  const childAges = (rooms ?? [])
    .flatMap((r) => r.childAges)
    .filter((age): age is number => age !== null);
  const allAges = [
    ...childAges,
    ...flightOnly.childAges,
    ...flightOnly.infantAges,
  ];
  return {
    passengerComposition: {
      adults:
        (rooms ?? []).reduce((count, room) => count + room.adults, 0) +
        flightOnly.adults +
        allAges.filter((a) => a >= 12).length,
      children: allAges.filter((a) => a >= 2 && a < 12).length,
      infants: allAges.filter((a) => a < 2).length,
    },
    childAges: allAges.filter((a) => a >= 2 && a < 12),
    infantAges: allAges.filter((a) => a < 2),
  };
}
export function passengerHotelStay(
  isHotelGuest: boolean,
  shared: { checkIn: string; checkOut: string },
  override?: PassengerHotelStay,
): PassengerHotelStay | null {
  if (!isHotelGuest) return null;
  return override?.different
    ? { ...override }
    : { ...shared, different: false };
}
export function passengerHotelStayError(
  stay: PassengerHotelStay | null,
): string | null {
  if (!stay) return null;
  const valid = (day: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  return !valid(stay.checkIn) ||
    !valid(stay.checkOut) ||
    stay.checkOut <= stay.checkIn
    ? 'تاریخ ورود و خروج هتل مسافر معتبر نیست.'
    : null;
}

export function usesRoomDrivenGuests(state: SalesFormState) {
  return (
    state.roomDrivenGuests === true &&
    state.serviceKinds.includes('FLIGHT') &&
    state.serviceKinds.includes('HOTEL')
  );
}
export function withRoomDrivenGuests(state: SalesFormState): SalesFormState {
  if (!usesRoomDrivenGuests(state)) return state;
  const additional = state.flightOnlyPassengers ?? [];
  const party = roomDrivenFlightParty(state.hotel.rooms, {
    adults: additional.filter((p) => p.age >= 12).length,
    childAges: additional
      .filter((p) => p.age >= 2 && p.age < 12)
      .map((p) => p.age),
    infantAges: additional.filter((p) => p.age < 2).map((p) => p.age),
  });
  return { ...state, ...party };
}
