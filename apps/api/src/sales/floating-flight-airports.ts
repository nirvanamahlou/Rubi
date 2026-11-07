import { BadRequestException } from '@nestjs/common';
import {
  salesContractOnlyFlights,
  type SalesServiceInput,
} from '@nora/contracts';
import type { MasterDataService } from '../master-data/master-data.service';

export async function assertFloatingFlightAirports(
  services: readonly SalesServiceInput[],
  references: Pick<MasterDataService, 'detail'> | undefined,
  previous: readonly SalesServiceInput[] = [],
) {
  const flights = salesContractOnlyFlights(services).filter(
    (flight) => flight.originAirport || flight.destinationAirport,
  );
  if (!flights.length) return;
  const old = new Map(
    salesContractOnlyFlights(
      previous.filter(
        (service) =>
          service.metadata?.flightOriginAirportV1 !== undefined ||
          service.metadata?.flightDestinationAirportV1 !== undefined,
      ),
    ).map((flight) => [flight.serviceClientKey, flight]),
  );
  for (const flight of flights) {
    for (const side of ['origin', 'destination'] as const) {
      const airportKey =
        side === 'origin' ? 'originAirport' : 'destinationAirport';
      const cityKey = side === 'origin' ? 'originId' : 'destinationId';
      const airport = flight[airportKey];
      if (
        !airport ||
        (old.get(flight.serviceClientKey)?.[cityKey] === flight[cityKey] &&
          JSON.stringify(old.get(flight.serviceClientKey)?.[airportKey]) ===
            JSON.stringify(airport))
      )
        continue;
      if (!references) throw new BadRequestException('مشخصات خدمت کامل نیست.');
      const { data } = await references.detail('airports', airport.id);
      const [{ data: destination }, { data: airportCity }] = await Promise.all([
        references.detail('cities', flight[cityKey]),
        references.detail('cities', airport.cityId),
      ]);
      if (
        data.status !== 'active' ||
        data.attributes.cityId !== airport.cityId ||
        destination.attributes.countryId !== airport.countryId ||
        airportCity.attributes.countryId !== airport.countryId ||
        String(data.attributes.iataCode || data.code)
          .trim()
          .toUpperCase() !== airport.code ||
        String(data.attributes.englishName || data.name) !== airport.name
      )
        throw new BadRequestException('مشخصات خدمت کامل نیست.');
    }
  }
}
