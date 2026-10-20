import { usesRoomDrivenGuests } from './contract-guest-stays';
import { hotelAgeOn } from '@nora/contracts';
import type { SalesFormState } from './sales-form';
export interface HotelChildChoice {
  key: string;
  label: string;
  age: number | null;
  previousAge: number | null;
  flightAge: number | null;
}
export function hotelChildChoices(
  state: SalesFormState,
  travelDate: string,
): HotelChildChoice[] {
  const counts = state.passengerComposition ?? {
    adults: 1,
    children: 0,
    infants: 0,
  };
  const actual = state.passengers.map((p) => ({
    person: p,
    age: hotelAgeOn(p.birthDate, travelDate),
  }));
  const complete =
    actual.length === counts.adults + counts.children + counts.infants &&
    actual.every((p) => p.age !== null) &&
    actual.filter((p) => p.age! >= 12).length === counts.adults &&
    actual.filter((p) => p.age! >= 2 && p.age! < 12).length ===
      counts.children &&
    actual.filter((p) => p.age! < 2).length === counts.infants;
  return (['child', 'infant'] as const).flatMap((kind) => {
    const number = kind === 'child' ? counts.children : counts.infants;
    const declared = kind === 'child' ? state.childAges : state.infantAges;
    const people = actual.filter((p) =>
      kind === 'child' ? p.age! >= 2 && p.age! < 12 : p.age! < 2,
    );
    return Array.from({ length: number }, (_, i) => {
      const p = complete ? people[i] : undefined;
      const age = p
        ? hotelAgeOn(p.person.birthDate, state.hotel.checkIn || travelDate)
        : (declared?.[i] ?? null);
      return {
        key: kind + ':' + i,
        label:
          (kind === 'child' ? 'کودک' : 'نوزاد') +
          ' ' +
          (i + 1) +
          (age === null ? '' : ' · ' + age + ' سال'),
        age,
        previousAge: declared?.[i] ?? null,
        flightAge: p?.age ?? declared?.[i] ?? null,
      };
    });
  });
}
/** Draft-only child slot references; API rooms still contain canonical ages only. */
export function syncHotelChildSelections(
  state: SalesFormState,
  travelDate: string,
): SalesFormState {
  if (usesRoomDrivenGuests(state)) return state;
  if (
    !state.serviceKinds.includes('FLIGHT') ||
    !state.serviceKinds.includes('HOTEL') ||
    !state.hotel.rooms
  )
    return state;
  if (
    state.childAges === undefined &&
    state.infantAges === undefined &&
    state.hotelChildAssignments === undefined &&
    !state.passengers.length
  )
    return state;
  const choices = hotelChildChoices(state, travelDate),
    used = new Set<string>(),
    assignments: NonNullable<SalesFormState['hotelChildAssignments']> = {};
  const rooms = state.hotel.rooms.map((room) => {
    const previous = state.hotelChildAssignments?.[String(room.ordinal)];
    const keys: (string | null)[] = [];
    const childAges = room.childAges.map((age, i) => {
      const saved = previous?.[i];
      if (saved === 'adult') {
        keys.push('adult');
        return age;
      }
      let choice = saved
        ? choices.find((c) => c.key === saved)
        : previous === undefined
          ? choices.find(
              (c) =>
                !used.has(c.key) &&
                age !== null &&
                (c.age === age || c.previousAge === age),
            )
          : undefined;
      if (choice && used.has(choice.key)) choice = undefined;
      if (choice) {
        used.add(choice.key);
        keys.push(choice.key);
        return choice.age !== null && choice.age < 15 ? choice.age : null;
      }
      if (previous === undefined && age !== null && age >= 12) {
        keys.push('adult');
        return age;
      }
      keys.push(null);
      return null;
    });
    assignments[String(room.ordinal)] = keys;
    return { ...room, childAges };
  });
  return {
    ...state,
    hotel: { ...state.hotel, rooms },
    hotelChildAssignments: assignments,
    childAges: choices
      .filter((c) => c.key.startsWith('child:'))
      .map((c) => c.flightAge),
    infantAges: choices
      .filter((c) => c.key.startsWith('infant:'))
      .map((c) => c.flightAge),
  };
}
export function selectHotelChild(
  state: SalesFormState,
  travelDate: string,
  ordinal: number,
  index: number,
  key: string,
): SalesFormState {
  const current = syncHotelChildSelections(state, travelDate);
  if (!current.hotel.rooms) return current;
  if (
    key &&
    key !== 'adult' &&
    !hotelChildChoices(current, travelDate).some(
      (c) => c.key === key && c.age !== null && c.age < 15,
    )
  )
    return current;
  if (
    key &&
    key !== 'adult' &&
    Object.entries(current.hotelChildAssignments ?? {}).some(([room, keys]) =>
      keys.some(
        (value, i) =>
          value === key && (Number(room) !== ordinal || i !== index),
      ),
    )
  )
    return current;
  const assignments = {
    ...current.hotelChildAssignments,
    [String(ordinal)]: [
      ...(current.hotelChildAssignments?.[String(ordinal)] ?? []),
    ],
  };
  assignments[String(ordinal)]![index] = key || null;
  return syncHotelChildSelections(
    {
      ...current,
      hotelChildAssignments: assignments,
      hotel: {
        ...current.hotel,
        rooms: current.hotel.rooms.map((r) =>
          r.ordinal === ordinal
            ? {
                ...r,
                childAges: r.childAges.map((age, i) =>
                  i === index ? null : age,
                ),
              }
            : r,
        ),
      },
    },
    travelDate,
  );
}
