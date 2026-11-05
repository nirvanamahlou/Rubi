import { hotelAgeOn } from '@nora/contracts';
import {
  salesPassengerAgeLabel,
  salesTravelDate,
  type SalesFormState,
} from './sales-form';

/** Display only: preserve the saved child band and use stay dates for hotel ages. */
export function passengerPricingAgeLabel(
  state: SalesFormState,
  passenger: SalesFormState['passengers'][number],
): string {
  const date =
    (state.serviceKinds.includes('HOTEL') && state.hotel.checkIn) ||
    salesTravelDate(state);
  const label = salesPassengerAgeLabel(
    passenger.birthDate,
    date,
    passenger.ageCategory ?? (passenger.childAgeBand ? 'CHD' : undefined),
  );
  if (label !== 'کودک') return label;
  if (passenger.childAgeBand === 'AGE_2_6') return 'کودک (2-6)';
  if (passenger.childAgeBand === 'AGE_6_12') return 'کودک (6-12)';
  const age = hotelAgeOn(passenger.birthDate, date);
  return age === null || age === undefined
    ? label
    : age < 6
      ? 'کودک (2-6)'
      : 'کودک (6-12)';
}
