import { defaultSalesRoomCategory } from '@nora/contracts';
import type { SalesFormState } from './sales-form';

/** Later stays use the same room guest composition; their room products remain independent. */
export function withCompositeGuests(state: SalesFormState): SalesFormState {
  const primary = state.hotel.rooms;
  if (!primary?.length || !state.hotel.additionalStays?.length) return state;
  return {
    ...state,
    hotel: {
      ...state.hotel,
      additionalStays: state.hotel.additionalStays.map((stay) => ({
        ...stay,
        rooms: primary.map((room, i) => {
          const saved = stay.rooms?.[i];
          const next = {
            ordinal: i + 1,
            roomTypeId: saved?.roomTypeId ?? '',
            roomTypeNameSnapshot: saved?.roomTypeNameSnapshot ?? '',
            adults: room.adults,
            childAges: [...room.childAges],
            ...(saved?.roomCategory
              ? { roomCategory: saved.roomCategory }
              : {}),
          };
          return { ...next, roomCategory: defaultSalesRoomCategory(next) };
        }),
      })),
    },
  };
}
