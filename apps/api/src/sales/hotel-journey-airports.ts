import { BadRequestException } from '@nestjs/common';
import {
  readHotelJourneys,
  salesContractFlights,
  type SalesContractCreateRequest,
} from '@nora/contracts';
import type { MasterDataService } from '../master-data/master-data.service';

type JourneyContext = Pick<
  SalesContractCreateRequest,
  'services' | 'hotelSelection' | 'ticketSelections' | 'destinationId'
>;
export async function assertHotelJourneyAirports(
  input: JourneyContext,
  references: Pick<MasterDataService, 'detail'> | undefined,
  previous?: JourneyContext,
) {
  const entries = (value: JourneyContext) => {
    const journeys = readHotelJourneys(value.services);
    if (!journeys.length) return [];
    const hotel = value.hotelSelection;
    const stays = hotel ? [hotel, ...(hotel.additionalStays ?? [])] : [];
    const returnCity =
      salesContractFlights(value.services, value.ticketSelections).find(
        (f) => f.direction === 'RETURN',
      )?.originId ?? value.destinationId;
    return journeys.flatMap((leg) => {
      const from =
        stays.find((s) => s.hotelId === leg.fromHotelId)?.cityId ?? '';
      const to =
        leg.toHotelId === null
          ? returnCity
          : (stays.find((s) => s.hotelId === leg.toHotelId)?.cityId ?? '');
      return [
        ...(leg.airport ? [{ cityId: to, airport: leg.airport }] : []),
        ...(leg.flight?.originAirport
          ? [{ cityId: from, airport: leg.flight.originAirport }]
          : []),
        ...(leg.flight?.destinationAirport
          ? [{ cityId: to, airport: leg.flight.destinationAirport }]
          : []),
      ];
    });
  };
  const next = entries(input);
  if (!next.length) return;
  const checked = new Set(
    previous ? entries(previous).map((e) => JSON.stringify(e)) : [],
  );
  for (const entry of next) {
    const key = JSON.stringify(entry);
    if (checked.has(key)) continue;
    if (!references) throw new BadRequestException('مشخصات خدمت کامل نیست.');
    const { airport, cityId } = entry;
    const [{ data: saved }, { data: city }, { data: airportCity }] =
      await Promise.all([
        references.detail('airports', airport.id),
        references.detail('cities', cityId),
        references.detail('cities', airport.cityId),
      ]);
    if (
      saved.status !== 'active' ||
      saved.attributes.cityId !== airport.cityId ||
      city.attributes.countryId !== airport.countryId ||
      airportCity.attributes.countryId !== airport.countryId ||
      String(saved.attributes.iataCode || saved.code)
        .trim()
        .toUpperCase() !== airport.code ||
      String(saved.attributes.englishName || saved.name) !== airport.name
    )
      throw new BadRequestException(
        'فرودگاه جابه‌جایی با کشور مسیر سازگار نیست.',
      );
    checked.add(key);
  }
}
