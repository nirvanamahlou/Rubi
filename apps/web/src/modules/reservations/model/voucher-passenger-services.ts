import type { VoucherSettingsV1 } from '@nora/contracts';
import { readPassengerHotelStays, salesContractFlights } from '@nora/contracts';
import {
  reservationFormDate,
  type ReservationFormIntake,
} from './reservation-form';
import type { voucherFormData } from './voucher-settings';

export const voucherServiceColumns = [
  ['#', 4],
  ['SURNAME / NAME', 21],
  ['SEX', 5],
  ['AGE RATE', 9],
  ['FLIGHT OUT', 6],
  ['FLIGHT RETURN', 6],
  ['HOTEL CHECK-IN', 12],
  ['HOTEL CHECK-OUT', 12],
  ['TRANSFER OUT', 7],
  ['TRANSFER RETURN', 7],
  ['OTHER SERVICES', 11],
] as const;

/** Read-only projection of selected voucher passengers and canonical Sales allocations. */
export function voucherPassengerServices(
  intake: ReservationFormIntake,
  data: ReturnType<typeof voucherFormData>,
) {
  const { snapshot, workflow } = intake;
  const settings = workflow.voucherSettings;
  const hotel = snapshot.hotelSelection;
  const stays = readPassengerHotelStays(snapshot.serviceSelections, hotel);
  const flights = salesContractFlights(
    snapshot.serviceSelections,
    snapshot.ticketSelections ?? [],
  );
  const direction = (service: (typeof snapshot.serviceSelections)[number]) =>
    service.metadata?.direction ??
    flights.find((f) => f.serviceClientKey === service.clientKey)?.direction ??
    (/(?:^|[-_])(?:out|outbound)$/.test(service.clientKey)
      ? 'OUTBOUND'
      : /(?:^|[-_])(?:return|back|in)$/.test(service.clientKey)
        ? 'RETURN'
        : undefined);
  return Object.fromEntries(
    data.passengers.map((person) => {
      const assignment = snapshot.passengerAssignments?.find(
        (p) => p.customerId === person.id,
      );
      const allocated = snapshot.serviceSelections.filter((s) =>
        assignment?.serviceClientKeys?.includes(s.clientKey),
      );
      const hasLeg = (
        kind: 'FLIGHT' | 'TRANSFER',
        leg: 'OUTBOUND' | 'RETURN',
      ) =>
        (kind !== 'TRANSFER' || settings?.flags.transfer !== false) &&
        allocated.some((s) => s.kind === kind && direction(s) === leg);
      const hotelGuest =
        settings?.flags.hotel !== false &&
        hotel &&
        assignment?.serviceClientKeys?.includes(hotel.serviceClientKey);
      const stay = stays?.[person.id];
      const different = Boolean(hotelGuest && stay?.different);
      const other =
        [
          ...new Set(
            allocated
              .filter(
                (s) =>
                  !['FLIGHT', 'HOTEL', 'TRANSFER'].includes(s.kind) &&
                  s.metadata?.insuranceAgeSurcharge !== true,
              )
              .map((s) => s.kind.replaceAll('_', ' ')),
          ),
        ].join(' / ') || '—';
      return [
        person.id,
        {
          flightOut: hasLeg('FLIGHT', 'OUTBOUND') ? 'YES' : '—',
          flightReturn: hasLeg('FLIGHT', 'RETURN') ? 'YES' : '—',
          checkIn: hotelGuest
            ? different
              ? reservationFormDate(stay!.checkInDate)
              : data.checkIn
            : '—',
          checkOut: hotelGuest
            ? different
              ? reservationFormDate(stay!.checkOutDate)
              : data.checkOut
            : '—',
          different,
          transferOut: hasLeg('TRANSFER', 'OUTBOUND') ? 'YES' : '—',
          transferReturn: hasLeg('TRANSFER', 'RETURN') ? 'YES' : '—',
          other,
        },
      ] as const;
    }),
  );
}

export function voucherPassengerCells(
  person: ReturnType<typeof voucherFormData>['passengers'][number],
  service: ReturnType<typeof voucherPassengerServices>[string],
  ordinal: number,
) {
  return [
    String(ordinal).padStart(2, '0'),
    person.name,
    person.sex,
    person.age,
    service.flightOut,
    service.flightReturn,
    service.checkIn,
    service.checkOut,
    service.transferOut,
    service.transferReturn,
    service.other,
  ];
}

/** Wider service rows need a smaller per-sheet budget than the legacy name list. */
export function voucherPassengerPageUnits(
  settings?: VoucherSettingsV1,
  notes = '',
) {
  const textLength = settings
    ? Object.values(settings.text).join('').length
    : 0;
  const roomPenalty = Math.min(
    2,
    Math.max(0, (settings?.rooms?.length ?? 0) - 2),
  );
  return Math.max(
    2,
    6 -
      roomPenalty -
      Math.ceil(Math.max(0, Math.max(textLength, notes.length) - 350) / 350),
  );
}
