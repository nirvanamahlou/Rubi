import type { VoucherSettingsV1 } from '@nora/contracts';

/** Fill unset execution room choices from booked room composition, without moving saved choices. */
export function contractRoomDefaults(
  settings: VoucherSettingsV1,
): VoucherSettingsV1 {
  if (!settings.rooms?.length) return settings;
  const rooms = settings.rooms.map((room) => ({
    ...room,
    adultsLeft: room.adults,
    childrenLeft: [...room.childAges],
  }));
  const bookedBand = (age: number) =>
    age < 6 ? ('CHD_2_TO_6' as const) : ('CHD_6_TO_12' as const);
  const available = (
    person: VoucherSettingsV1['passengers'][number],
    room: (typeof rooms)[number],
  ) =>
    person.age === 'ADL'
      ? room.adultsLeft > 0
      : room.childrenLeft.some((age) =>
          person.age === 'INF'
            ? age < 2
            : age >= 2 &&
              (!person.hotelChildAgeBand ||
                bookedBand(age) === person.hotelChildAgeBand),
        );
  const consume = (
    person: VoucherSettingsV1['passengers'][number],
    room: (typeof rooms)[number],
  ) => {
    if (person.age === 'ADL')
      room.adultsLeft = Math.max(0, room.adultsLeft - 1);
    else {
      const index = room.childrenLeft.findIndex((age) =>
        person.age === 'INF'
          ? age < 2
          : age >= 2 &&
            (!person.hotelChildAgeBand ||
              bookedBand(age) === person.hotelChildAgeBand),
      );
      if (index >= 0) return room.childrenLeft.splice(index, 1)[0];
    }
    return undefined;
  };
  const savedAges = new Map<string, number>();
  // Reserve saved selections first, so defaults never consume their capacity.
  for (const person of settings.passengers) {
    if (!person.selected || !person.services?.hotel || !person.roomOrdinal)
      continue;
    const room = rooms.find((room) => room.ordinal === person.roomOrdinal);
    if (room) {
      const age = consume(person, room);
      if (age !== undefined) savedAges.set(person.id, age);
    }
  }
  return {
    ...settings,
    passengers: settings.passengers.map((person) => {
      if (!person.selected || !person.services?.hotel) return person;
      if (person.roomOrdinal) {
        const age = savedAges.get(person.id);
        return person.age === 'CHD' &&
          !person.hotelChildAgeBand &&
          age !== undefined
          ? { ...person, hotelChildAgeBand: bookedBand(age) }
          : person;
      }
      const room = rooms.find((room) => available(person, room));
      if (!room) return person;
      const age = consume(person, room);
      return {
        ...person,
        roomOrdinal: room.ordinal,
        roomType: room.roomTypeNameSnapshot,
        ...(person.age === 'CHD' &&
        !person.hotelChildAgeBand &&
        age !== undefined
          ? { hotelChildAgeBand: bookedBand(age) }
          : {}),
      };
    }),
  };
}
