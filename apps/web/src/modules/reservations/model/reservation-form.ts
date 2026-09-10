import { salesContractFlights } from '@rubi/contracts';
import type {
  MasterDataRecord,
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
export type ReservationFormIntake = ReservationIntakeV1 & {
  workflow: TravelWorkflowStateV1;
};
export type ReservationFormReferences = Record<string, MasterDataRecord>;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '-';
export function reservationFormDate(value?: string, timeZone = 'UTC') {
  if (!value || !Number.isFinite(Date.parse(value))) return '-';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  })
    .format(new Date(value))
    .toUpperCase();
}
export function reservationFormData(
  intake: ReservationFormIntake,
  references: ReservationFormReferences = {},
) {
  const { snapshot, workflow } = intake;
  const hotel = snapshot.hotelSelection;
  const services = snapshot.serviceSelections;
  const flights = salesContractFlights(
    services,
    snapshot.ticketSelections ?? [],
  ).sort((a, b) =>
    a.direction === b.direction
      ? a.departureAt.localeCompare(b.departureAt)
      : a.direction === 'OUTBOUND'
        ? -1
        : 1,
  );
  const hotelRecord = hotel ? references[hotel.hotelId] : undefined;
  const city = references[hotel?.cityId ?? flights[0]?.destinationId ?? ''];
  const name = (record?: MasterDataRecord) =>
    text(record?.attributes.englishName || record?.name);
  const ids = [
    ...new Set([...workflow.roomOrder, ...snapshot.passengerIds]),
  ].filter((id) => snapshot.passengerIds.includes(id));
  const passengers = ids.map((id) => {
    const person = snapshot.passengerAssignments?.find(
      (p) => p.customerId === id,
    );
    const age =
      workflow.ageOverrides[id] ??
      ({ ADT: 'ADULT', CHD: 'CHILD', INF: 'INFANT' } as const)[
        person?.ageCategory ?? 'ADT'
      ];
    return {
      id,
      name: text(person?.displayNameSnapshot),
      sex: '-',
      age:
        !person && !workflow.ageOverrides[id]
          ? '-'
          : age === 'ADULT'
            ? 'ADL'
            : age === 'CHILD'
              ? 'CHD'
              : 'INF',
    };
  });
  const nights = hotel
    ? (Date.parse(hotel.checkOutDate) - Date.parse(hotel.checkInDate)) /
      86400000
    : NaN;
  const labels: Record<string, string> = {
    FLIGHT: 'FLIGHT',
    HOTEL: 'HOTEL',
    TRANSFER: 'TRANSFER',
    TRAIN: 'TRAIN',
    BUS: 'BUS',
    VISA: 'VISA',
    INSURANCE: 'INSURANCE',
    OTHER: 'OTHER',
  };
  return {
    request: snapshot.contractNumber,
    issueDate: reservationFormDate(
      workflow.updatedAt ?? intake.receivedAt,
      'Asia/Tehran',
    ),
    supplier: text(
      services.find((s) => typeof s.metadata?.supplierName === 'string')
        ?.metadata?.supplierName,
    ),
    services:
      [
        ...new Set(
          services
            .filter((s) => s.metadata?.insuranceAgeSurcharge !== true)
            .map((s) => labels[s.kind] ?? s.kind),
        ),
      ].join(' / ') || '-',
    destination: name(city),
    adults: passengers.filter((p) => p.age === 'ADL').length,
    children: passengers.filter((p) => p.age === 'CHD').length,
    infants: passengers.filter((p) => p.age === 'INF').length,
    rooms: intake.arrangement?.roomCount ?? hotel?.roomCount ?? '-',
    nights: Number.isInteger(nights) && nights > 0 ? nights : '-',
    leader: text(
      services.find((s) => typeof s.metadata?.tourLeader === 'string')?.metadata
        ?.tourLeader,
    ),
    excursion: text(
      services.find((s) => typeof s.metadata?.excursion === 'string')?.metadata
        ?.excursion,
    ),
    flights: flights.map((f) => ({
      leg: f.direction,
      airline: f.carrierNameSnapshot,
      number: f.serviceNumberSnapshot,
      date: reservationFormDate(f.departureAt, 'Asia/Tehran'),
      time: new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Tehran',
      }).format(new Date(f.departureAt)),
    })),
    hotel: text(
      hotelRecord?.attributes.englishName || hotel?.hotelNameSnapshot,
    ),
    stars: text(
      String(
        hotelRecord?.attributes.starRating ??
          hotelRecord?.attributes.stars ??
          '-',
      ),
    ),
    meal: hotel?.mealServiceId
      ? name(references[hotel.mealServiceId])
      : text(
          hotelRecord?.attributes.mealServiceCodes ||
            hotelRecord?.attributes.mealServiceNames,
        ),
    roomType: hotel?.roomTypeId ? name(references[hotel.roomTypeId]) : '-',
    checkIn: reservationFormDate(hotel?.checkInDate),
    checkOut: reservationFormDate(hotel?.checkOutDate),
    double:
      intake.arrangement?.doubleRoomCount ?? hotel?.doubleRoomCount ?? '-',
    single:
      intake.arrangement?.singleRoomCount ?? hotel?.singleRoomCount ?? '-',
    extra: intake.arrangement?.extraBedCount ?? hotel?.extraBedCount ?? '-',
    passengers,
    notes: workflow.note || '',
    brand: workflow.branding?.name ?? '',
  };
}
/** Estimate wrapped name rows so long names get room without shrinking or clipping. */
export function reservationPassengerPages(
  passengers: ReturnType<typeof reservationFormData>['passengers'],
) {
  const pages: (typeof passengers)[] = [[]];
  let used = 0;
  for (const person of passengers) {
    const units = Math.max(1, Math.ceil(person.name.length / 48));
    if (used && used + units > 10) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1]!.push(person);
    used += units;
  }
  return pages;
}
