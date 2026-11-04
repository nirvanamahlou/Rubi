import {
  defaultSalesRoomCategory,
  type SalesRoomCategory,
} from '@nora/contracts';

/** Queue product counters: EXT counts Double Extra rooms, never child beds. */
export function reservationRoomCategoryCounts(
  rooms: readonly {
    adults: number;
    childAges: readonly unknown[];
    roomCategory?: SalesRoomCategory | undefined;
  }[],
) {
  const counts = {
    roomCount: rooms.length,
    singleRoomCount: 0,
    doubleRoomCount: 0,
    extraBedCount: 0,
    familyTripleRoomCount: 0,
  };
  for (const room of rooms) {
    const category = room.roomCategory ?? defaultSalesRoomCategory(room);
    if (category === 'SINGLE') counts.singleRoomCount++;
    if (category === 'DOUBLE' || category === 'DOUBLE_EXTRA')
      counts.doubleRoomCount++;
    if (category === 'DOUBLE_EXTRA') counts.extraBedCount++;
    if (category === 'FAMILY' || category === 'TRIPLE')
      counts.familyTripleRoomCount++;
  }
  return counts;
}
