import type { MasterDataRecord, TicketOfferV1 } from '@nora/contracts';

export function rialFirst<T>(
  rows: readonly T[],
  code: (row: T) => string,
): T[] {
  return [...rows].sort(
    (a, b) => Number(code(b) === 'IRR') - Number(code(a) === 'IRR'),
  );
}

export function pricingCityCountries(
  cities: readonly Pick<MasterDataRecord, 'id' | 'attributes'>[],
  countries: readonly Pick<MasterDataRecord, 'id' | 'code' | 'attributes'>[],
): Record<string, string> {
  const codes = new Map(
    countries.map((c) => [
      c.id,
      String(c.attributes.iso2Code || c.code)
        .trim()
        .toUpperCase(),
    ]),
  );
  return Object.fromEntries(
    cities.flatMap((c) => {
      const code = codes.get(String(c.attributes.countryId ?? ''));
      return code ? [[c.id, code]] : [];
    }),
  );
}

const formats = {
  domestic: new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }),
  foreign: new Intl.DateTimeFormat('en-GB', {
    calendar: 'gregory',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }),
  domesticTime: new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'Asia/Tehran',
  }),
  foreignTime: new Intl.DateTimeFormat('en-GB', {
    calendar: 'gregory',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: 'Asia/Tehran',
  }),
};
export function pricingFlightDate(
  offer: Pick<TicketOfferV1, 'originId' | 'destinationId' | 'departureAt'>,
  cityCountries: Record<string, string>,
  withTime = false,
) {
  const foreign = [offer.originId, offer.destinationId].some((id) => {
    const code = cityCountries[id];
    return Boolean(code) && !['IR', 'IRN', 'IRAN'].includes(code!);
  });
  return formats[
    foreign
      ? withTime
        ? 'foreignTime'
        : 'foreign'
      : withTime
        ? 'domesticTime'
        : 'domestic'
  ].format(new Date(offer.departureAt));
}
