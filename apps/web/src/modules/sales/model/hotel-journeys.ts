import {
  validateHotelJourneys,
  retainHotelJourneyRoutes,
  type HotelJourneyV1,
  type SalesHotelSelectionInput,
} from '@nora/contracts';
import type { SalesFormState } from './sales-form';

export function selectedHotelJourneys(state: SalesFormState): HotelJourneyV1[] {
  if (
    !state.serviceKinds.includes('HOTEL') ||
    !state.hotel.additionalStays?.length
  )
    return [];
  const ids = [
    state.hotel.hotelId,
    ...state.hotel.additionalStays.map((s) => s.hotelId),
  ];
  return retainHotelJourneyRoutes(state.hotel.journeys ?? [], ids);
}

export function salesHotelJourneyError(
  state: SalesFormState,
): string | undefined {
  try {
    validateHotelJourneys(
      selectedHotelJourneys(state),
      {
        ...state.hotel,
        checkInDate: state.hotel.checkIn,
        checkOutDate: state.hotel.checkOut,
      } as unknown as SalesHotelSelectionInput,
      state.contractFlights?.RETURN?.departureAt
        ? /(?:Z|[+-]\d{2}:\d{2})$/.test(
            state.contractFlights.RETURN.departureAt,
          )
          ? state.contractFlights.RETURN.departureAt
          : state.contractFlights.RETURN.departureAt + '+03:30'
        : state.returnOffer?.departureAt ||
            state.ticket.returnDepartureAt ||
            undefined,
    );
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'اطلاعات جابه‌جایی هتل‌ها معتبر نیست.';
  }
  return undefined;
}
