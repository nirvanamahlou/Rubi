import { readLegacyServiceParties } from '@nora/contracts';
import { salesRoomDisplayName } from '@nora/contracts';
import { readPassengerHotelStays } from '@nora/contracts';
import { salesHotelRoomSummary } from '@nora/contracts';
export function englishOutputName(
  value: string,
  references: ReservationFormReferences,
) {
  const name = value.trim();
  const match = Object.values(references).find((r) =>
    [r.name, r.attributes.englishName, r.code].some(
      (v) =>
        typeof v === 'string' && v.trim().toLowerCase() === name.toLowerCase(),
    ),
  );
  return typeof match?.attributes.englishName === 'string' &&
    match.attributes.englishName.trim()
    ? match.attributes.englishName.trim()
    : typeof match?.name === 'string' &&
        /[A-Za-z]/.test(match.name) &&
        !/[\u0600-\u06ff]/.test(match.name)
      ? match.name.trim()
      : value;
}
import { salesContractFlights } from '@nora/contracts';
import type {
  MasterDataRecord,
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
export type ReservationFormIntake = ReservationIntakeV1 & {
  workflow: TravelWorkflowStateV1;
  hotelStayKey?: string;
  supplierDocumentKind?: 'HOTEL' | 'TRANSFER' | 'OUTBOUND' | 'RETURN';
  hotelStayOrdinal?: number;
  contractPartyName?: string | null;
  /** Minimal request-scoped Customer projection; no DOB or passport numbers. */
  outputPassengers?: readonly {
    customerId: string;
    passportName: string | null;
    gender?: 'M' | 'F' | null;
    hotelChildAgeBand: 'CHD_2_TO_6' | 'CHD_6_TO_12' | null;
  }[];
};
/** Historical counts do not imply named passenger records or identities. */
export function isAggregateReservationForm(intake: ReservationFormIntake) {
  return (
    intake.snapshot.passengerIds?.length === 0 &&
    (intake.snapshot.serviceSelections.some(
      (service) => service.metadata?.legacyContractV1 === true,
    ) ||
      readLegacyServiceParties(intake.snapshot.serviceSelections) !== null)
  );
}
export type ReservationFormReferences = Record<string, MasterDataRecord>;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '-';

export function reservationPassengerAgeLabel(
  age: string,
  hotelChildAgeBand?: string,
) {
  if (age !== 'CHD') return age;
  if (hotelChildAgeBand === 'CHD_2_TO_6') return 'CHD (2-6)';
  if (hotelChildAgeBand === 'CHD_6_TO_12') return 'CHD (6-12)';
  return 'CHD';
}

export function reservationFormDate(value?: string, timeZone = 'UTC') {
  if (!value || !Number.isFinite(Date.parse(value))) return '-';
  return new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
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
  const roomSummary = hotel?.rooms?.length
    ? salesHotelRoomSummary(hotel.rooms)
    : undefined;
  const services = snapshot.serviceSelections;
  const legacyParties = readLegacyServiceParties(services);
  const legacyHotel = hotel
    ? legacyParties?.[hotel.serviceClientKey]
    : undefined;
  const passengerStays = readPassengerHotelStays(services, hotel);
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
  const passengers: Array<{
    id: string;
    name: string;
    sex: string;
    age: string;
    hotelChildAgeBand?: string | undefined;
    differentStay?: boolean;
    checkIn?: string;
    checkOut?: string;
    outboundFlight: boolean;
    returnFlight: boolean;
    outboundTransfer: boolean;
    returnTransfer: boolean;
    otherServices: string;
  }> = ids.map((id) => {
    const person = snapshot.passengerAssignments?.find(
      (p) => p.customerId === id,
    );
    const age =
      workflow.ageOverrides[id] ??
      ({ ADT: 'ADULT', CHD: 'CHILD', INF: 'INFANT' } as const)[
        person?.ageCategory ?? 'ADT'
      ];
    const identity = intake.outputPassengers?.find(
      (person) => person.customerId === id,
    );
    const hotelChildAgeBand =
      age === 'CHILD'
        ? person?.childAgeBand === 'AGE_2_6'
          ? 'CHD_2_TO_6'
          : person?.childAgeBand === 'AGE_6_12'
            ? 'CHD_6_TO_12'
            : identity?.hotelChildAgeBand || undefined
        : undefined;
    const allocated = services.filter((service) =>
      person?.serviceClientKeys?.includes(service.clientKey),
    );
    const direction = (service: (typeof services)[number]) =>
      service.metadata?.direction ??
      flights.find((flight) => flight.serviceClientKey === service.clientKey)
        ?.direction ??
      (/(?:^|[-_])(?:out|outbound)$/.test(service.clientKey)
        ? 'OUTBOUND'
        : /(?:^|[-_])(?:return|back|in)$/.test(service.clientKey)
          ? 'RETURN'
          : undefined);
    const has = (kind: 'FLIGHT' | 'TRANSFER', leg: string) =>
      allocated.some(
        (service) => service.kind === kind && direction(service) === leg,
      );
    const hotelGuest =
      !!hotel && !!person?.serviceClientKeys?.includes(hotel.serviceClientKey);
    const stay = passengerStays
      ? passengerStays[id]
      : hotelGuest
        ? hotel
        : undefined;
    return {
      id,
      outboundFlight: has('FLIGHT', 'OUTBOUND'),
      returnFlight: has('FLIGHT', 'RETURN'),
      outboundTransfer: has('TRANSFER', 'OUTBOUND'),
      returnTransfer: has('TRANSFER', 'RETURN'),
      otherServices:
        [
          ...new Set(
            allocated
              .filter(
                (service) =>
                  !['FLIGHT', 'HOTEL', 'TRANSFER'].includes(service.kind) ||
                  (service.kind === 'TRANSFER' && !direction(service)),
              )
              .map((service) =>
                service.kind === 'OTHER'
                  ? service.titleSnapshot?.trim() &&
                    !/^(?:other|other services)$/i.test(
                      service.titleSnapshot.trim(),
                    ) &&
                    !/[\u0600-\u06ff]/.test(service.titleSnapshot)
                    ? service.titleSnapshot.trim()
                    : ''
                  : service.kind,
              )
              .filter(Boolean),
          ),
        ].join(' / ') || '-',

      ...(passengerStays || stay
        ? {
            differentStay: Boolean(
              stay && 'different' in stay && stay.different === true,
            ),
            checkIn: reservationFormDate(stay?.checkInDate),
            checkOut: reservationFormDate(stay?.checkOutDate),
          }
        : {}),
      name: text(identity?.passportName || person?.displayNameSnapshot),
      sex:
        identity?.gender === 'M'
          ? 'Male'
          : identity?.gender === 'F'
            ? 'Female'
            : '-',
      hotelChildAgeBand,
      age:
        !person && !workflow.ageOverrides[id]
          ? '-'
          : age === 'ADULT'
            ? 'ADL'
            : age === 'CHILD'
              ? reservationPassengerAgeLabel('CHD', hotelChildAgeBand)
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
    transfer: (() => {
      const legs = services
        .filter((s) => s.kind === 'TRANSFER')
        .map((s) => {
          const eligible = snapshot.passengerAssignments?.filter(
            (p) =>
              p.ageCategory !== 'INF' &&
              p.serviceClientKeys.includes(s.clientKey),
          ).length;
          const saved = s.metadata?.passengerCount;
          const count =
            typeof saved === 'number' && Number.isFinite(saved)
              ? Math.max(0, Math.min(eligible ?? saved, Math.trunc(saved)))
              : (eligible ?? 0);
          return {
            direction:
              s.metadata?.direction === 'RETURN'
                ? 'RETURN ONLY'
                : 'OUTBOUND ONLY',
            count,
          };
        });
      if (
        legs.length === 2 &&
        legs[0]!.direction !== legs[1]!.direction &&
        legs[0]!.count === legs[1]!.count
      )
        return 'ROUND TRIP · ' + legs[0]!.count + ' PAX';
      return (
        legs.map((l) => l.direction + ' · ' + l.count + ' PAX').join(' / ') ||
        '-'
      );
    })(),
    request: snapshot.contractNumber,
    contractPartyName: intake.contractPartyName ?? '',
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
    adults:
      legacyHotel?.adults ?? passengers.filter((p) => p.age === 'ADL').length,
    children:
      legacyHotel?.children ??
      passengers.filter((p) => p.age.startsWith('CHD')).length,
    children2To6: passengers.filter((p) => p.hotelChildAgeBand === 'CHD_2_TO_6')
      .length,
    children6To12: passengers.filter(
      (p) => p.hotelChildAgeBand === 'CHD_6_TO_12',
    ).length,
    childrenUnclassified: passengers.filter((p) => p.age === 'CHD').length,
    infants:
      legacyHotel?.infants ?? passengers.filter((p) => p.age === 'INF').length,
    rooms:
      roomSummary?.roomCount ??
      intake.arrangement?.roomCount ??
      hotel?.roomCount ??
      '-',
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
      airline: englishOutputName(f.carrierNameSnapshot, references),
      number: f.serviceNumberSnapshot,
      date: reservationFormDate(f.departureAt, 'Asia/Tehran'),
      time: new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Tehran',
      }).format(new Date(f.departureAt)),
    })),
    hotel: text(
      hotelRecord?.attributes.englishName ||
        (typeof hotelRecord?.name === 'string' &&
        /[A-Za-z]/.test(hotelRecord.name) &&
        !/[\u0600-\u06ff]/.test(hotelRecord.name)
          ? hotelRecord.name
          : hotel?.hotelNameSnapshot),
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
    roomBreakdown: (hotel?.rooms ?? []).map((r) => ({
      ordinal: r.ordinal,
      roomType: salesRoomDisplayName({
        ...r,
        roomTypeNameSnapshot: references[r.roomTypeId]
          ? name(references[r.roomTypeId])
          : r.roomTypeNameSnapshot,
      }),
      adults: r.adults,
      childAges: [...r.childAges],
    })),
    roomType: hotel?.roomTypeId ? name(references[hotel.roomTypeId]) : '-',
    checkIn: reservationFormDate(hotel?.checkInDate),
    checkOut: reservationFormDate(hotel?.checkOutDate),
    double:
      roomSummary?.doubleRoomCount ??
      intake.arrangement?.doubleRoomCount ??
      hotel?.doubleRoomCount ??
      '-',
    single:
      roomSummary?.singleRoomCount ??
      intake.arrangement?.singleRoomCount ??
      hotel?.singleRoomCount ??
      '-',
    extra:
      roomSummary?.extraBedCount ??
      intake.arrangement?.extraBedCount ??
      hotel?.extraBedCount ??
      '-',
    passengers,
    notes: workflow.note || '',
    brand:
      workflow.branding?.kind === 'OWN' &&
      workflow.branding.companyCode === 'JAHAN_BASTAN'
        ? 'Jahan Bastan'
        : (workflow.branding?.name ?? ''),
  };
}
/** Estimate wrapped name rows so long names get room without shrinking or clipping. */
export function reservationPassengerPages<T extends { name: string }>(
  passengers: T[],
  pageUnits = 10,
) {
  const pages: (typeof passengers)[] = [[]];
  let used = 0;
  for (const person of passengers) {
    const units = Math.max(1, Math.ceil(person.name.length / 48));
    if (used && used + units > pageUnits) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1]!.push(person);
    used += units;
  }
  return pages;
}

export function reservationRoomAppendices(
  rooms: ReturnType<typeof reservationFormData>['roomBreakdown'],
) {
  return Array.from(
    { length: Math.ceil(Math.max(0, rooms.length - 4) / 12) },
    (_, i) => rooms.slice(4 + i * 12, 4 + (i + 1) * 12),
  );
}
