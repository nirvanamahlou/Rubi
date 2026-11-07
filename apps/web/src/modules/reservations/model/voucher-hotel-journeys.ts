import {
  hotelJourneyArrivalDate,
  HOTEL_JOURNEY_MODES,
  readHotelJourneys,
} from '@nora/contracts';
import {
  englishOutputName,
  reservationFormDate,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from './reservation-form';

export const voucherJourneyColumns = [
  'FROM / TO',
  'TRANSPORT',
  'DEPARTURE',
  'ARRIVAL',
  'FLIGHT DETAILS',
];

/** Only the current hotel's outgoing leg belongs on its voucher. */
export function voucherHotelJourneyRows(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
): string[][] {
  if (intake.workflow.voucherSettings?.flags.hotel === false) return [];
  const source = intake.hotelJourneySourceSnapshot ?? intake.snapshot;
  const hotel = source.hotelSelection;
  if (!hotel?.additionalStays?.length) return [];
  const stays = [hotel, ...hotel.additionalStays];
  const english = (value: string) => {
    const name = englishOutputName(value, refs);
    return /[\u0600-\u06ff]/.test(name) ? '—' : name || '—';
  };
  const hotelName = (id: string) => {
    const stay = stays.find((s) => s.hotelId === id);
    const record = refs[id];
    return english(
      String(
        record?.attributes.englishName ||
          record?.name ||
          stay?.hotelNameSnapshot ||
          '',
      ),
    );
  };
  return readHotelJourneys(source.serviceSelections)
    .filter((leg) => {
      const index = stays.findIndex((s) => s.hotelId === leg.fromHotelId);
      return (
        leg.fromHotelId === intake.snapshot.hotelSelection?.hotelId &&
        index >= 0 &&
        Object.hasOwn(HOTEL_JOURNEY_MODES, leg.mode) &&
        (leg.toHotelId === null
          ? index === stays.length - 1
          : stays[index + 1]?.hotelId === leg.toHotelId)
      );
    })
    .map((leg) => {
      const flight = leg.mode === 'FLIGHT' ? leg.flight : undefined;
      const airport = (value: typeof leg.airport) =>
        value ? `${english(value.name)} (${value.code})` : '—';
      return [
        `${hotelName(leg.fromHotelId)} → ${leg.toHotelId ? hotelName(leg.toHotelId) : airport(leg.airport)}`,
        { BUS: 'BUS', CAR: 'CAR', FLIGHT: 'FLIGHT' }[leg.mode],
        `${reservationFormDate(leg.departureDate)} · ${leg.departureTime}`,
        `${reservationFormDate(hotelJourneyArrivalDate(leg))} · ${leg.arrivalTime}`,
        flight
          ? `${english(flight.airline)} · ${flight.number} · ${flight.cabinClass}\n${airport(flight.originAirport)} → ${airport(flight.destinationAirport)}`
          : '—',
      ];
    });
}
