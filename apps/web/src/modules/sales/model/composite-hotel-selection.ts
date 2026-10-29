import type { MasterDataRecord } from '@nora/contracts';
import type { SalesFormState } from './sales-form';

const compositePrefix = 'composite:';
export function hotelsAtContractDestination(
  hotels: readonly MasterDataRecord[],
  destinationId: string,
) {
  return hotels.filter(
    (hotel) =>
      Boolean(destinationId) && hotel.attributes.cityId === destinationId,
  );
}
export function contractHotelChoices(
  hotels: readonly MasterDataRecord[],
  composites: readonly MasterDataRecord[],
) {
  return [
    ...hotels,
    ...composites.map((record) => ({
      ...record,
      id: compositePrefix + record.id,
      attributes: { ...record.attributes, englishName: '' },
    })),
  ];
}
export function selectedContractHotelKey(
  state: SalesFormState,
  composites: readonly MasterDataRecord[],
) {
  if (!state.hotel.additionalStays?.length) return state.hotel.hotelId;
  const ids = [
    state.hotel.hotelId,
    ...state.hotel.additionalStays.map((stay) => stay.hotelId),
  ].join(',');
  const composite = composites.find(
    (record) => String(record.attributes.memberHotelIds ?? '') === ids,
  );
  return composite ? compositePrefix + composite.id : state.hotel.hotelId;
}
export function compositeHotelChoice(
  key: string,
  composites: readonly MasterDataRecord[],
) {
  return key.startsWith(compositePrefix)
    ? composites.find((record) => compositePrefix + record.id === key)
    : undefined;
}

export function withCompositeHotel(
  state: SalesFormState,
  record: MasterDataRecord,
): SalesFormState {
  const members: unknown = JSON.parse(
    String(record.attributes.memberHotels ?? '[]'),
  );
  if (
    !Array.isArray(members) ||
    !members.length ||
    members.length > 50 ||
    members.some(
      (member) =>
        !member ||
        typeof member.hotelId !== 'string' ||
        !member.hotelId ||
        typeof member.cityId !== 'string' ||
        !member.cityId ||
        typeof member.hotelName !== 'string',
    )
  )
    throw new Error('اطلاعات هتل ترکیبی کامل نیست؛ فهرست را تازه‌سازی کنید.');
  const stays = members.map(
    (member: { hotelId: string; cityId: string; hotelName: string }) => ({
      hotelId: member.hotelId,
      cityId: member.cityId,
      hotelNameSnapshot: member.hotelName,
      checkInDate: '',
      checkOutDate: '',
    }),
  );
  if (new Set(stays.map((stay) => stay.hotelId)).size !== stays.length)
    throw new Error('هتل تکراری در ترکیب وجود دارد.');
  const first = stays[0]!;
  return {
    ...state,
    hotelChildAssignments: {},
    hotel: {
      ...state.hotel,
      multiHotel: true,
      hotelId: first.hotelId,
      name: first.hotelNameSnapshot,
      cityId: first.cityId,
      checkIn: '',
      checkOut: '',
      checkInManual: true,
      checkOutManual: true,
      roomTypeId: '',
      rooms: [],
      guestCustomerIds: undefined,
      additionalStays: stays.slice(1).map((stay) => ({ ...stay, rooms: [] })),
    },
  };
}
