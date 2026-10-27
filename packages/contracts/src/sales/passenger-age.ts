import { hotelAgeOn } from '../package-pricing/hotel-occupancy';
import type { SalesPassengerAgeCategory } from './index';

export interface SalesAgeIdentity {
  birthDate: string;
  ageCategory?: SalesPassengerAgeCategory;
}

export function salesBookedAgeCategory(
  person: SalesAgeIdentity,
  travelDate: string,
): SalesPassengerAgeCategory | null {
  if (person.birthDate) {
    const date = new Date(person.birthDate + 'T00:00:00Z');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== person.birthDate
    )
      return null;
    const age = hotelAgeOn(person.birthDate, travelDate);
    return age === null ? null : age < 2 ? 'INF' : age < 12 ? 'CHD' : 'ADT';
  }
  return ['ADT', 'CHD', 'INF'].includes(person.ageCategory ?? '')
    ? person.ageCategory!
    : null;
}

/** Match unknown DOBs to already-booked occupancy slots; never create a DOB. */
export function salesHotelGuestAges(
  people: readonly SalesAgeIdentity[],
  travelDate: string,
  bookedAges: readonly (number | null)[],
): number[] | null {
  if (bookedAges.length !== people.length || bookedAges.some((a) => a === null))
    return null;
  const available = [...bookedAges] as number[];
  const result: number[] = [];
  for (let index = 0; index < people.length; index++) {
    const person = people[index]!;
    if (!person.birthDate) continue;
    if (!salesBookedAgeCategory(person, travelDate)) return null;
    const age = hotelAgeOn(person.birthDate, travelDate);
    if (age === null) return null;
    const slot = available.indexOf(age >= 15 ? 15 : age);
    if (slot < 0) return null;
    result[index] = available.splice(slot, 1)[0]!;
  }
  for (let index = 0; index < people.length; index++) {
    const person = people[index]!;
    if (person.birthDate) continue;
    const category = salesBookedAgeCategory(person, travelDate);
    if (!category) return null;
    const slot = available.findIndex((age) =>
      category === 'INF'
        ? age < 2
        : category === 'CHD'
          ? age >= 2 && age < 12
          : age >= 12,
    );
    if (slot < 0) return null;
    result[index] = available.splice(slot, 1)[0]!;
  }
  return result;
}
