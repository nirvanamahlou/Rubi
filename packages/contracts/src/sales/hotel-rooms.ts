export interface SalesHotelRoomV1 {
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
            /^[A-Z]{3}$/.test(room.agreedPrice.currencyCode) &&
            room.agreedPrice.currencyCode !== 'IRR')) &&
        Number.isInteger(room.adults) &&
        room.adults >= 1 &&
        room.adults <= 20 &&
        Array.isArray(room.childAges) &&
        room.childAges.length <= 20 &&
        room.childAges.every(
          (age: number) => Number.isInteger(age) && age >= 0 && age < 15,
        ),
    )
  );
}
