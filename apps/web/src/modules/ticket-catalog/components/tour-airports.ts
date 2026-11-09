import type { MasterDataRecord } from '@nora/contracts';

/** Prefer the selected city, while allowing other airports in its country. */
export function tourAirports(
  cityId: string,
  cities: MasterDataRecord[],
  airports: MasterDataRecord[],
) {
  const countryId = cities.find((city) => city.id === cityId)?.attributes
    .countryId;
  if (!cityId) return [];
  return airports
    .filter((airport) => {
      if (!/^[A-Z]{3}$/.test(String(airport.attributes.iataCode ?? '')))
        return false;
      if (airport.attributes.cityId === cityId) return true;
      if (!countryId) return false;
      const airportCountry =
        airport.attributes.countryId ??
        cities.find((city) => city.id === airport.attributes.cityId)?.attributes
          .countryId;
      return airportCountry === countryId;
    })
    .sort(
      (a, b) =>
        Number(b.attributes.cityId === cityId) -
          Number(a.attributes.cityId === cityId) ||
        a.name.localeCompare(b.name),
    );
}

export function defaultTourAirport(
  cityId: string,
  airports: MasterDataRecord[],
) {
  return airports.find(
    (airport) =>
      airport.attributes.cityId === cityId &&
      /^[A-Z]{3}$/.test(String(airport.attributes.iataCode ?? '')),
  )?.attributes.iataCode as string | undefined;
}
