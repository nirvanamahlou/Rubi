import type { HotelRoomRateV1, MasterDataRecord } from '@nora/contracts';
import { salesHotelRoomTypes } from './sales-form';

export function salesHotelRoomOptions(
  hotelId: string,
  hotels: readonly MasterDataRecord[],
  rooms: readonly MasterDataRecord[],
  rates: readonly HotelRoomRateV1[],
) {
  if (!hotelId) return [];
  const options = new Map<
    string,
    Pick<MasterDataRecord, 'id' | 'name' | 'code'> & Partial<MasterDataRecord>
  >(
    salesHotelRoomTypes(
      hotelId,
      hotels,
      rooms,
      rates.map((r) => r.roomTypeId),
    ).map((room) => [room.id, room]),
  );
  for (const rate of rates)
    if (!options.has(rate.roomTypeId))
      options.set(rate.roomTypeId, {
        id: rate.roomTypeId,
        code: rate.roomTypeId,
        name: rate.roomTypeName,
      });
  return [...options.values()];
}
