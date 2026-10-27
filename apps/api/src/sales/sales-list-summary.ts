import { readLegacyServiceParties } from '@nora/contracts';
import type {
  SalesContractDetail,
  SalesContractSummary,
} from '@nora/contracts';
import { passengerAgeYears } from './sales.domain';

/** Safe list projection: no birth dates or passenger identities leave this helper. */
export function salesListTravelSummary(
  detail: SalesContractDetail,
): Pick<SalesContractSummary, 'travelDates' | 'passengerComposition'> {
  const calendar = (
    key: string | undefined,
    fallback: 'persian' | 'gregorian',
  ) => {
    const value = detail.servicesDetail.find((s) => s.clientKey === key)
      ?.metadata?.dateCalendarSystem;
    return value === 'persian' || value === 'gregorian' ? value : fallback;
  };
  const flightDate = (direction: 'OUTBOUND' | 'RETURN') => {
    const ticket = detail.ticketSelections.find(
      (t) => t.direction === direction,
    );
    return ticket
      ? {
          date: new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(ticket.departureAt)),
          calendar: calendar(ticket.serviceClientKey, 'persian'),
        }
      : null;
  };
  const hotel = detail.hotelSelection;
  const hotelDay = (value: string | undefined) =>
    value
      ? {
          date: value,
          calendar: calendar(hotel?.serviceClientKey, 'gregorian'),
        }
      : null;
  const hasFlights = detail.ticketSelections.length > 0;
  const travelDates = {
    outbound:
      flightDate('OUTBOUND') ??
      (!hasFlights
        ? (hotelDay(hotel?.checkInDate) ?? {
            date: detail.departureDate,
            calendar: 'persian' as const,
          })
        : null),
    returning:
      flightDate('RETURN') ??
      (!hasFlights ? hotelDay(hotel?.checkOutDate) : null),
  };
  const passengerComposition = {
    adults: 0,
    children2To6: 0,
    children6To12: 0,
    infants: 0,
    childrenUnknownAge: 0,
  };
  const parties = readLegacyServiceParties(detail.servicesDetail);
  if (parties) {
    // Service parties overlap; select the same largest party used by passengerCount, never sum them.
    const party = Object.values(parties).sort(
      (a, b) =>
        b.adults + b.children + b.infants - (a.adults + a.children + a.infants),
    )[0]!;
    passengerComposition.adults = party.adults;
    passengerComposition.infants = party.infants;
    passengerComposition.childrenUnknownAge = party.children;
  } else {
    for (const person of detail.passengersDetail) {
      if (person.ageCategory === 'ADT') passengerComposition.adults++;
      else if (person.ageCategory === 'INF') passengerComposition.infants++;
      else {
        const band = person.childAgeBand;
        if (!person.birthDate && !band) {
          passengerComposition.childrenUnknownAge++;
          continue;
        }
        const age = person.birthDate
          ? passengerAgeYears(person.birthDate, detail.departureDate)
          : null;
        if (band === 'AGE_2_6' || (!band && age !== null && age < 6))
          passengerComposition.children2To6++;
        else passengerComposition.children6To12++;
      }
    }
  }
  return { travelDates, passengerComposition };
}
