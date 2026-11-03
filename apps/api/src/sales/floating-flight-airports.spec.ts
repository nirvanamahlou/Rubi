import { it, expect, vi } from 'vitest';
import {
  contractFlightMetadata,
  salesContractOnlyFlights,
  type SalesServiceInput,
} from '@nora/contracts';
import { assertFloatingFlightAirports } from './floating-flight-airports';
const airport = {
  id: '10000000-0000-4000-8000-000000000005',
  cityId: '10000000-0000-4000-8000-000000000003',
  countryId: '10000000-0000-4000-8000-000000000009',
  code: 'AYT',
  name: 'Antalya Airport',
};
const services = (): SalesServiceInput[] => [
  {
    clientKey: 'flight-outbound',
    kind: 'FLIGHT',
    titleSnapshot: 'Synthetic',
    status: 'NEEDS_RESERVATION_CONFIRMATION',
    metadata: contractFlightMetadata({
      version: 1,
      direction: 'OUTBOUND',
      originId: '10000000-0000-4000-8000-000000000002',
      destinationId: airport.cityId,
      departureAt: '2026-10-01T06:00:00.000Z',
      arrivalAt: '2026-10-01T08:00:00.000Z',
      carrierNameSnapshot: 'Synthetic',
      serviceNumberSnapshot: '123',
      cabinClassCode: 'ECONOMY',
      destinationAirport: airport,
    }),
  },
];
const reference = () => ({
  id: airport.id,
  resource: 'airports' as const,
  status: 'active' as const,
  name: 'Airport',
  code: 'ALT',
  attributes: {
    cityId: airport.cityId,
    iataCode: 'AYT',
    englishName: airport.name,
  },
  version: 1,
  createdAt: '',
  updatedAt: '',
});
it('round trips and validates the selected city airport without changing the input', async () => {
  const input = services(),
    before = structuredClone(input);
  const detail = vi.fn().mockImplementation(async (resource: string) => ({
    data:
      resource === 'airports'
        ? reference()
        : { attributes: { countryId: airport.countryId } },
  }));
  await assertFloatingFlightAirports(input, { detail } as never);
  expect(detail).toHaveBeenCalledWith('airports', airport.id);
  expect(salesContractOnlyFlights(input)[0]?.destinationAirport).toEqual(
    airport,
  );
  expect(input).toEqual(before);
});
it.each(['inactive', 'wrong-city', 'wrong-code', 'wrong-name'])(
  'rejects an invalid new airport reference: %s',
  async (kind) => {
    const row = reference();
    if (kind === 'inactive') row.status = 'inactive' as never;
    if (kind === 'wrong-city') row.attributes.cityId = 'another';
    if (kind === 'wrong-code') row.attributes.iataCode = 'XYZ';
    if (kind === 'wrong-name') row.attributes.englishName = 'Other';
    await expect(
      assertFloatingFlightAirports(services(), {
        detail: vi.fn().mockResolvedValue({ data: row }),
      } as never),
    ).rejects.toThrow();
  },
);
it('preserves an unchanged historical selection and accepts legacy flights without airports', async () => {
  const detail = vi.fn();
  await assertFloatingFlightAirports(
    services(),
    { detail } as never,
    services(),
  );
  const legacy = services();
  legacy[0]!.metadata = Object.fromEntries(
    Object.entries(legacy[0]!.metadata!).filter(
      ([key]) => key !== 'flightDestinationAirportV1',
    ),
  );
  await assertFloatingFlightAirports(legacy, undefined);
  expect(detail).not.toHaveBeenCalled();
});
it.each([
  { ...airport, id: 'bad' },
  { ...airport, cityId: 'other' },
  { ...airport, code: 'invalid' },
])('rejects malformed metadata: %j', (value) => {
  const input = services();
  input[0]!.metadata = {
    ...input[0]!.metadata,
    flightDestinationAirportV1: JSON.stringify(value),
  };
  expect(() => salesContractOnlyFlights(input)).toThrow();
});

it('allows another city in the destination country and rejects a different country', async () => {
  const input = services();
  input[0]!.metadata = {
    ...input[0]!.metadata,
    destinationId: '10000000-0000-4000-8000-000000000008',
  };
  const detail = vi.fn().mockImplementation(async (resource: string) => ({
    data:
      resource === 'airports'
        ? reference()
        : { attributes: { countryId: airport.countryId } },
  }));
  await expect(
    assertFloatingFlightAirports(input, { detail } as never),
  ).resolves.toBeUndefined();
  detail.mockImplementation(async (resource: string, id: string) => ({
    data:
      resource === 'airports'
        ? reference()
        : {
            attributes: {
              countryId:
                id === airport.cityId ? 'other-country' : airport.countryId,
            },
          },
  }));
  await expect(
    assertFloatingFlightAirports(input, { detail } as never),
  ).rejects.toThrow();
});
