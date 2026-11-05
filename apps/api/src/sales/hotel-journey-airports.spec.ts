import { expect, it, vi } from 'vitest';
import {
  HOTEL_JOURNEYS,
  type SalesContractCreateRequest,
} from '@nora/contracts';
import { assertHotelJourneyAirports } from './hotel-journey-airports';
const airport = {
  id: 'airport',
  cityId: 'paris',
  countryId: 'france',
  name: 'Charles de Gaulle',
  code: 'CDG',
};
const input = {
  destinationId: 'istanbul',
  hotelSelection: {
    hotelId: 'one',
    cityId: 'istanbul',
    additionalStays: [{ hotelId: 'two', cityId: 'paris' }],
  },
  services: [
    {
      kind: 'HOTEL',
      metadata: {
        [HOTEL_JOURNEYS]: JSON.stringify([
          {
            fromHotelId: 'one',
            toHotelId: 'two',
            mode: 'FLIGHT',
            flight: { destinationAirport: airport },
          },
        ]),
      },
    },
  ],
} as unknown as SalesContractCreateRequest;
it('does not inspect unrelated historical flights when no journeys are present', async () => {
  const withoutJourneys: SalesContractCreateRequest = {
    ...input,
    services: [
      {
        clientKey: 'historical-flight',
        titleSnapshot: 'Historical flight',
        kind: 'FLIGHT',
        metadata: { contractFlightVersion: 1 },
      },
    ],
  };
  await expect(
    assertHotelJourneyAirports(withoutJourneys, undefined, withoutJourneys),
  ).resolves.toBeUndefined();
});
it('checks the airport against the next hotel country instead of the main contract destination', async () => {
  const detail = vi.fn(async (resource: string, id: string) => ({
    data:
      resource === 'airports'
        ? {
            status: 'active',
            name: airport.name,
            code: 'CDG',
            attributes: { cityId: 'paris' },
          }
        : { attributes: { countryId: id === 'paris' ? 'france' : 'turkey' } },
  }));
  await expect(
    assertHotelJourneyAirports(input, { detail } as never),
  ).resolves.toBeUndefined();
  expect(detail).toHaveBeenCalledWith('cities', 'paris');
  expect(detail).not.toHaveBeenCalledWith('cities', 'istanbul');
  detail.mockResolvedValue({
    data: {
      status: 'active',
      name: airport.name,
      code: 'CDG',
      attributes: { cityId: 'paris', countryId: 'wrong-country' },
    },
  } as never);
  await expect(
    assertHotelJourneyAirports(input, { detail } as never),
  ).rejects.toThrow('کشور');
});
it('preserves unchanged recorded airports during unrelated amendments but rechecks changed destinations', async () => {
  await expect(
    assertHotelJourneyAirports(input, undefined, input),
  ).resolves.toBeUndefined();
  const changed = structuredClone(input);
  changed.hotelSelection!.additionalStays![0]!.cityId = 'berlin';
  await expect(
    assertHotelJourneyAirports(changed, undefined, input),
  ).rejects.toThrow();
});
