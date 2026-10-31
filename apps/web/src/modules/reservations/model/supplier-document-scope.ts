import type { VoucherSettingsV1 } from '@nora/contracts';
import {
  reservationFormData,
  type ReservationFormIntake,
} from './reservation-form';
export type SupplierDocumentKind = 'HOTEL' | 'TRANSFER' | 'OUTBOUND' | 'RETURN';
export function separateHotelTransfer(settings?: VoucherSettingsV1) {
  return settings?.hotelTransferSeparate === true;
}
export function supplierDocumentKinds(
  settings?: VoucherSettingsV1,
): SupplierDocumentKind[] {
  return separateHotelTransfer(settings)
    ? settings?.hotelTransferSplit
      ? ['HOTEL', 'OUTBOUND', 'RETURN']
      : ['HOTEL', 'TRANSFER']
    : ['HOTEL'];
}
/** Read-only derived output: all documents share the same immutable saved/sent revision. */
export function supplierDocumentScope(
  intake: ReservationFormIntake,
  kind: SupplierDocumentKind = 'HOTEL',
  preview?: VoucherSettingsV1,
): ReservationFormIntake {
  const source = preview ?? intake.workflow.supplierFormSettings;
  if (!source) {
    if (kind !== 'HOTEL') throw Error('نوع سند معتبر نیست.');
    return intake;
  }
  const original = {
    ...intake,
    workflow: { ...intake.workflow, supplierFormSettings: source },
  };
  if (!supplierDocumentKinds(source).includes(kind))
    throw Error('نوع سند معتبر نیست.');
  if (!separateHotelTransfer(source)) return original;
  const settings = structuredClone(source);
  const hotel = kind === 'HOTEL';
  const outgoing = kind === 'TRANSFER' || kind === 'OUTBOUND';
  const returning = kind === 'TRANSFER' || kind === 'RETURN';
  settings.flags = { ...settings.flags, hotel, transfer: !hotel };
  settings.hotelTransferCounts = {
    outbound: outgoing ? (source.hotelTransferCounts?.outbound ?? 0) : 0,
    returning: returning ? (source.hotelTransferCounts?.returning ?? 0) : 0,
  };
  const facts = reservationFormData(intake).passengers;
  settings.passengers = settings.passengers.map((saved) => {
    const actual = facts.find((person) => person.id === saved.id);
    const person = saved.services
      ? saved
      : {
          ...saved,
          services: {
            outboundFlight: actual?.outboundFlight ?? false,
            returnFlight: actual?.returnFlight ?? false,
            outboundTransfer: actual?.outboundTransfer ?? false,
            returnTransfer: actual?.returnTransfer ?? false,
            hotel: Boolean(actual?.checkIn && actual.checkIn !== '-'),
          },
        };
    return {
      ...person,
      selected:
        person.selected &&
        (hotel
          ? person.services?.hotel !== false
          : (outgoing && person.services?.outboundTransfer === true) ||
            (returning && person.services?.returnTransfer === true)),
      ...(person.services
        ? {
            services: {
              ...person.services,
              hotel: hotel && person.services.hotel,
              outboundTransfer:
                !hotel && outgoing && person.services.outboundTransfer,
              returnTransfer:
                !hotel && returning && person.services.returnTransfer,
            },
          }
        : {}),
    };
  });
  if (hotel) {
    settings.supplierFormPrices = { ...settings.supplierFormPrices };
    delete settings.supplierFormPrices.transferPp;
  } else {
    const quote =
      kind === 'RETURN'
        ? source.hotelTransferReturn
        : source.supplierFormPrices?.transferPp;
    const brokerId =
      kind === 'RETURN'
        ? source.hotelTransferReturn?.brokerId
        : source.transferBrokerId;
    if (brokerId) settings.brokerId = brokerId;
    else delete settings.brokerId;
    settings.text = {
      ...settings.text,
      broker:
        (kind === 'RETURN'
          ? source.hotelTransferReturn?.brokerName
          : source.transferBrokerName) ?? '',
      checkIn: '',
      checkOut: '',
    };
    settings.rooms = [];
    delete settings.hotelRoomPrices;
    delete settings.hotelPurchasePrices;
    settings.flags.tourLeader = false;
    settings.flags.excursion = false;
    settings.supplierFormPrices = quote
      ? {
          transferPp: {
            amount: quote.amount,
            currencyCode: quote.currencyCode,
          },
        }
      : {};
    if (kind === 'OUTBOUND')
      for (const key of [
        'departureAirline',
        'departureFlight',
        'departureDate',
        'departureTime',
      ] as const)
        settings.text[key] = '';
    if (kind === 'RETURN')
      for (const key of [
        'arrivalAirline',
        'arrivalFlight',
        'arrivalDate',
        'arrivalTime',
      ] as const)
        settings.text[key] = '';
  }
  return {
    ...original,
    supplierDocumentKind: kind,
    workflow: { ...original.workflow, supplierFormSettings: settings },
  };
}
