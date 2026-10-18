import { hotelAgeOn } from '@nora/contracts';
import type { SalesPassengerInput } from '@nora/contracts';
/** Hotel age at stay date; never changes the passenger's flight age category. */
export function reservationChildAgeBand(
  birthDate: string,
  on: string,
): SalesPassengerInput['childAgeBand'] {
  const age = hotelAgeOn(birthDate, on);
  return age === null || age < 0 || age >= 12
    ? undefined
    : age < 6
      ? 'AGE_2_6'
      : 'AGE_6_12';
}

export function reservationChildBandFields(
  passenger: {
    birthDate: string;
    ageCategory: string;
    childAgeBand?: SalesPassengerInput['childAgeBand'];
  },
  on: string,
) {
  const band =
    passenger.childAgeBand ??
    (passenger.ageCategory === 'CHD'
      ? reservationChildAgeBand(passenger.birthDate, on)
      : undefined);
  return band ? { childAgeBand: band } : {};
}
