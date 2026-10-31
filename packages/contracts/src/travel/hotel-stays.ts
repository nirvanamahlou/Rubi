import { readLegacyServiceParties } from '../sales/legacy-service-parties';
import { moneyDecimal, moneyUnits } from '../sales/pricing';
import {
  reservationServicePurchaseTotal,
  type ReservationRoomPriceV1,
} from './index';
import type {
  SalesHotelSelectionInput,
  SalesReservationRequestV1,
} from '../sales';

/** Identities are scoped to the immutable Sales intake snapshot, not hotel names. */
export function reservationHotelStays(
  snapshot: Pick<SalesReservationRequestV1, 'hotelSelection'>,
) {
  const primary = snapshot.hotelSelection;
  if (!primary) return [];
  return [primary, ...(primary.additionalStays ?? [])].map((stay, index) => ({
    key:
      index === 0
        ? primary.serviceClientKey
        : 'hotel-stay:' + (index + 1) + ':' + stay.hotelId,
    ordinal: index + 1,
    hotel:
      index === 0
        ? primary
        : ({
            ...primary,
            ...stay,
            additionalStays: [],
            rooms: stay.rooms?.map((room) => ({ ...room })),
            roomCount: stay.rooms?.length ?? primary.roomCount,
          } as SalesHotelSelectionInput),
  }));
}

/** A read-only execution projection; canonical Sales allocations remain untouched. */
export function scopeReservationHotel(
  snapshot: SalesReservationRequestV1,
  key: string,
): SalesReservationRequestV1 {
  const stay = reservationHotelStays(snapshot).find((stay) => stay.key === key);
  if (!stay) throw Error('اقامت هتل انتخاب‌شده معتبر نیست.');
  const parent = snapshot.hotelSelection!.serviceClientKey;
  if (
    key !== parent &&
    snapshot.serviceSelections.some((service) => service.clientKey === key)
  )
    throw Error('اقامت هتل انتخاب‌شده معتبر نیست.');
  const parties = readLegacyServiceParties(snapshot.serviceSelections);
  const metadata = (
    service: SalesReservationRequestV1['serviceSelections'][number],
  ) => {
    if (!service.metadata) return {};
    const value = { ...service.metadata };
    if (value.legacyServicePartiesV2 !== undefined && parties)
      value.legacyServicePartiesV2 = JSON.stringify(
        Object.fromEntries(
          Object.entries(parties).map(([name, party]) => [
            name === parent ? key : name,
            party,
          ]),
        ),
      );
    if (stay.ordinal > 1 && service.clientKey === parent)
      delete value.passengerHotelStaysV1;
    return value;
  };
  return {
    ...snapshot,
    hotelSelection: {
      ...stay.hotel,
      additionalStays: [],
      serviceClientKey: key,
    },
    ...(snapshot.passengerAssignments
      ? {
          passengerAssignments: snapshot.passengerAssignments.map((person) => ({
            ...person,
            serviceClientKeys: person.serviceClientKeys.map((service) =>
              service === parent ? key : service,
            ),
          })),
        }
      : {}),
    serviceSelections: snapshot.serviceSelections.map((service) =>
      service.clientKey === parent
        ? {
            ...service,
            metadata: metadata(service),
            clientKey: key,
            referenceId: stay.hotel.hotelId,
            titleSnapshot: stay.hotel.hotelNameSnapshot,
          }
        : { ...service, metadata: metadata(service) },
    ),
  };
}

export function hotelRoomQuotationTotal(
  rows: readonly ReservationRoomPriceV1[],
  nights: number,
  ordinals: readonly number[],
) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > 50 ||
    rows.length !== ordinals.length ||
    new Set(rows.map((row) => row.roomOrdinal)).size !== rows.length ||
    rows.some(
      (row) =>
        !row ||
        !ordinals.includes(row.roomOrdinal) ||
        Object.keys(row).some(
          (key) => !['roomOrdinal', 'baseAmount', 'factor'].includes(key),
        ),
    )
  )
    throw Error('اطلاعات خرید خدمت معتبر نیست.');
  return moneyDecimal(
    rows.reduce(
      (sum, row) =>
        sum +
        moneyUnits(
          reservationServicePurchaseTotal(row.baseAmount, row.factor, nights),
        ),
      0n,
    ),
  );
}

export function reservationHotelTransferKeys(
  snapshot: SalesReservationRequestV1,
  key: string,
) {
  const stay = reservationHotelStays(snapshot).find((stay) => stay.key === key);
  if (!stay) throw Error('اقامت هتل انتخاب‌شده معتبر نیست.');
  const original = snapshot.serviceSelections
    .filter((service) => service.kind === 'TRANSFER')
    .map((service) => service.clientKey);
  return stay.ordinal === 1 && original.length
    ? original
    : ['hotel-transfer:' + stay.ordinal + ':' + stay.hotel.hotelId];
}

/** Add a return member without changing the historical aggregate identity API. */
export function reservationHotelTransferLegKeys(
  snapshot: SalesReservationRequestV1,
  key: string,
) {
  const keys = reservationHotelTransferKeys(snapshot, key);
  return keys.length === 1 && keys[0]!.startsWith('hotel-transfer:')
    ? [keys[0]!, keys[0]! + ':return']
    : keys;
}

/** Attribute only the covered legs; a single historical key represents both legs. */
export function reservationHotelTransferCounts(
  snapshot: SalesReservationRequestV1,
  stayKey: string,
  covered: readonly string[],
  counts: { outbound: number; returning: number },
) {
  const keys = reservationHotelTransferLegKeys(snapshot, stayKey);
  if (keys.length === 1) return { ...counts };
  const returning = (key: string) =>
    snapshot.serviceSelections.find((s) => s.clientKey === key)?.metadata
      ?.direction === 'RETURN' || /(?:^|[-_:])(?:return|back|in)$/.test(key);
  const returnKey = keys.find(returning) ?? keys[1]!;
  return {
    outbound: covered.some((key) => key !== returnKey && keys.includes(key))
      ? counts.outbound
      : 0,
    returning: covered.includes(returnKey) ? counts.returning : 0,
  };
}
