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
    (flight) => flight.destinationAirport,
  );
  if (!flights.length) return;
  const old = new Map(
    salesContractOnlyFlights(
      previous.filter(
        (service) => service.metadata?.flightDestinationAirportV1 !== undefined,
      ),
    ).map((flight) => [flight.serviceClientKey, flight]),
  );
  for (const flight of flights) {
    const airport = flight.destinationAirport;
    if (
      !airport ||
      (old.get(flight.serviceClientKey)?.destinationId ===
        flight.destinationId &&
        JSON.stringify(old.get(flight.serviceClientKey)?.destinationAirport) ===
          JSON.stringify(airport))
    )
      continue;
    if (!references) throw new BadRequestException('مشخصات خدمت کامل نیست.');
    const { data } = await references.detail('airports', airport.id);
    const [{ data: destination }, { data: airportCity }] = await Promise.all([
      references.detail('cities', flight.destinationId),
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
