import { expect, it, vi } from 'vitest';
import {
  completionRows,
  completionPersonInput,
  completionSelectedPerson,
  completionRegistrationLookup,
  validateCompletionRow,
} from './passenger-completion';
import { emptyPeopleValues } from '../model/sales-people-sheet';

it('lets a name-only correction proceed without calling the ten-digit national-ID lookup', async () => {
  const input = completionPersonInput({
    values: {
      ...emptyPeopleValues(),
      passportFirstName: 'Synthetic',
      passportLastName: 'Traveler',
    },
  });
  const lookup = vi
    .fn()
    .mockRejectedValue(new Error('national ID requires ten digits'));
  expect(await completionRegistrationLookup(input, lookup)).toBeNull();
  expect(lookup).not.toHaveBeenCalled();
  expect(input).not.toHaveProperty('nationalId');
  expect(input).not.toHaveProperty('birthDate');
  expect(input).not.toHaveProperty('passportNumber');
});

it('retains national-ID matching and explicit existing-person review when an ID is supplied', async () => {
  const found = { id: 'existing-person' };
  const lookup = vi.fn().mockResolvedValue({ data: found });
  const input = {
    kind: 'person' as const,
    displayName: 'Synthetic Traveler',
    firstName: 'Synthetic',
    lastName: 'Traveler',
    nationalId: '0013547893',
    roles: ['passenger' as const],
  };
  expect(await completionRegistrationLookup(input, lookup)).toBe(found);
  expect(lookup).toHaveBeenCalledWith({
    nationalId: input.nationalId,
    firstName: input.firstName,
    lastName: input.lastName,
  });
});
it('shows registered first and last names for an existing person without passport fields', () => {
  const row = completionSelectedPerson({
    id: 'person',
    firstName: 'Registered',
    lastName: 'Passenger',
    displayName: 'Registered Passenger',
    birthDate: null,
    contacts: [],
  } as never);
  expect(row.values.passportFirstName).toBe('Registered');
  expect(row.values.passportLastName).toBe('Passenger');
  expect(() => completionPersonInput(row)).not.toThrow();
});
it('requires only first and last names when adding a correction passenger', () => {
  const values = {
    ...emptyPeopleValues(),
    nationalityCode: '',
    passportIssuingCountryCode: '',
    birthCountryCode: '',
    passportFirstName: 'Example',
    passportLastName: 'Traveller',
  };
  const row = {
    key: 'slot',
    category: 'children' as const,
    person: { values },
    services: ['hotel'],
    different: false,
    checkInDate: '',
    checkOutDate: '',
  };
  expect(() => validateCompletionRow(row, '2027-01-01')).not.toThrow();
  expect(completionPersonInput(row.person)).toMatchObject({
    firstName: 'Example',
    lastName: 'Traveller',
    roles: ['passenger'],
    passportFirstName: 'EXAMPLE',
    passportLastName: 'TRAVELLER',
  });
  expect(completionPersonInput(row.person)).not.toHaveProperty('birthDate');
  expect(completionPersonInput(row.person)).not.toHaveProperty('nationalId');
  expect(completionPersonInput(row.person)).not.toHaveProperty(
    'passportNumber',
  );
  values.passportFirstName = '';
  expect(() => completionPersonInput(row.person)).toThrow();
  values.passportFirstName = 'Example';
  values.passportLastName = '';
  expect(() => completionPersonInput(row.person)).toThrow();
});
it('still validates a birth date or passport number when supplied', () => {
  const row = {
    key: 'slot',
    category: 'children' as const,
    person: {
      values: {
        ...emptyPeopleValues(),
        passportFirstName: 'Example',
        passportLastName: 'Child',
        birthDate: '1990-01-01',
      },
    },
    services: ['hotel'],
    different: false,
    checkInDate: '',
    checkOutDate: '',
  };
  expect(() => validateCompletionRow(row, '2027-01-01')).toThrow('رده سنی');
  row.person.values.birthDate = '';
  row.person.values.passportNumber = '!';
  expect(() => completionPersonInput(row.person)).toThrow('پاسپورت');
  row.person.values.passportNumber = '';
  row.person.values.nationalId = '123';
  expect(() => completionPersonInput(row.person)).toThrow('کد ملی');
});
it('creates booked adult/child/infant slots and preserves per-leg service counts', () => {
  const rows = completionRows({
    version: 1,
    available: true,
    departureDate: '2027-01-01',
    hotel: {
      serviceKey: 'hotel',
      checkInDate: '2027-01-01',
      checkOutDate: '2027-01-07',
    },
    services: [
      {
        key: 'out',
        kind: 'FLIGHT',
        direction: 'OUTBOUND',
        title: 'Out',
        party: { adults: 2, children: 1, infants: 1 },
      },
      {
        key: 'back',
        kind: 'FLIGHT',
        direction: 'RETURN',
        title: 'Back',
        party: { adults: 1, children: 1, infants: 1 },
      },
      {
        key: 'hotel',
        kind: 'HOTEL',
        direction: null,
        title: 'Hotel',
        party: { adults: 2, children: 1, infants: 1 },
      },
    ],
  });
  expect(rows).toHaveLength(4);
  expect(rows.map((r) => r.category)).toEqual([
    'adults',
    'adults',
    'children',
    'infants',
  ]);
  expect(rows[1]!.services).toEqual(['out', 'hotel']);
  expect(
    rows.every(
      (r) => !r.person.person && r.person.values.nationalityCode === 'IRN',
    ),
  ).toBe(true);
  expect(rows[0]!.checkOutDate).toBe('2027-01-07');
});
