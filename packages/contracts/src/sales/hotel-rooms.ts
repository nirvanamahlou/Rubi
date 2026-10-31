export type SalesRoomCategory =
  'SINGLE' | 'DOUBLE' | 'DOUBLE_EXTRA' | 'TRIPLE' | 'FAMILY';
export function salesRoomCategories(
  adults: number,
  children = 0,
): SalesRoomCategory[] {
  return adults === 1
    ? children
      ? ['SINGLE', 'DOUBLE_EXTRA']
      : ['SINGLE']
    : adults === 2
      ? children
        ? ['DOUBLE', 'DOUBLE_EXTRA', 'FAMILY']
        : ['DOUBLE']
      : adults === 3
        ? ['TRIPLE', 'FAMILY', 'DOUBLE_EXTRA']
        : adults > 3
          ? ['FAMILY', 'DOUBLE_EXTRA']
          : [];
}
export function defaultSalesRoomCategory(room: {
  adults: number;
  childAges: readonly unknown[];
  roomCategory?: SalesRoomCategory | undefined;
}) {
  const choices = salesRoomCategories(room.adults, room.childAges.length);
  return room.roomCategory && choices.includes(room.roomCategory)
    ? room.roomCategory
    : choices[0];
}
export function salesRoomCategoryLabel(category: SalesRoomCategory, n: number) {
  return category === 'DOUBLE_EXTRA'
    ? `Double + ${Math.max(1, n - 2)} Extra Bed`
    : {
        SINGLE: 'Single',
        DOUBLE: 'Double',
        TRIPLE: 'Triple',
        FAMILY: 'Family',
      }[category];
}
export function salesRoomDisplayName(room: SalesHotelRoomV1) {
  return (
    room.roomTypeNameSnapshot +
    (room.roomCategory
      ? ' · ' + salesRoomCategoryLabel(room.roomCategory, room.adults)
      : '')
  );
}
export interface SalesHotelRoomV1 {
  roomCategory?: SalesRoomCategory | undefined;
  ordinal: number;
  roomTypeId: string;
  roomTypeNameSnapshot: string;
  adults: number;
  childAges: readonly number[];
  agreedPrice?: { amount: string; currencyCode: string };
}
export function validSalesHotelRooms(rooms: unknown, count: number) {
  return (
    Array.isArray(rooms) &&
    rooms.length === count &&
    rooms.length > 0 &&
    rooms.length <= 50 &&
    rooms.every(
      (room, index) =>
        room !== null &&
        typeof room === 'object' &&
        room.ordinal === index + 1 &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          room.roomTypeId,
        ) &&
        typeof room.roomTypeNameSnapshot === 'string' &&
        room.roomTypeNameSnapshot.trim().length > 0 &&
        room.roomTypeNameSnapshot.length <= 240 &&
        (room.agreedPrice === undefined ||
          (room.agreedPrice !== null &&
            typeof room.agreedPrice === 'object' &&
            typeof room.agreedPrice.amount === 'string' &&
            /^\d{1,18}(?:\.\d{1,4})?$/.test(room.agreedPrice.amount) &&
            /^[A-Z]{3}$/.test(room.agreedPrice.currencyCode))) &&
        Number.isInteger(room.adults) &&
        room.adults >= 1 &&
        room.adults <= 20 &&
        Array.isArray(room.childAges) &&
        (room.roomCategory === undefined ||
          salesRoomCategories(room.adults, room.childAges.length).includes(
            room.roomCategory,
          )) &&
        room.childAges.length <= 20 &&
        room.childAges.every(
          (age: number) => Number.isInteger(age) && age >= 0 && age < 15,
        ),
    )
  );
}

/** Occupancy summary for ordered room products; no named sleeping assignment. */
export function salesHotelRoomSummary(
  rooms: readonly {
    adults: number;
    childAges: readonly unknown[];
    roomCategory?: SalesRoomCategory | undefined;
  }[],
) {
  return rooms.reduce(
    (summary, room) => {
      const occupants = room.adults + room.childAges.length;
      summary.roomCount += 1;
      summary.singleRoomCount += (
        room.roomCategory ? room.roomCategory === 'SINGLE' : occupants === 1
      )
        ? 1
        : 0;
      summary.doubleRoomCount += (
        room.roomCategory ? room.roomCategory !== 'SINGLE' : occupants >= 2
      )
        ? 1
        : 0;
      summary.extraBedCount += room.roomCategory
        ? room.roomCategory === 'DOUBLE_EXTRA'
          ? Math.max(1, room.adults - 2)
          : 0
        : Math.max(0, occupants - 2);
      summary.occupancy += occupants;
      return summary;
    },
    {
      roomCount: 0,
      singleRoomCount: 0,
      doubleRoomCount: 0,
      extraBedCount: 0,
      occupancy: 0,
    },
  );
}
