import type { SalesFlightAirportV1 } from './contract-flights';
import type { SalesHotelSelectionInput, SalesServiceInput } from './index';

export const HOTEL_JOURNEYS = 'hotelJourneysV1';
export const HOTEL_JOURNEY_MODES = {
  BUS: 'اتوبوس',
  CAR: 'خودرو',
  FLIGHT: 'هواپیما',
} as const;

export function retainHotelJourneyRoutes(
  legs: readonly HotelJourneyV1[],
  hotelIds: readonly string[],
): HotelJourneyV1[] {
  if (hotelIds.length < 2) return [];
  return legs.filter((leg) => {
    const i = hotelIds.indexOf(leg.fromHotelId);
    return (
      i >= 0 &&
      (leg.toHotelId === null
        ? i === hotelIds.length - 1
        : !!leg.toHotelId && hotelIds[i + 1] === leg.toHotelId)
    );
  });
}

/** Optional itinerary facts, stored with the hotel service, never flight inventory. */
export interface HotelJourneyV1 {
  fromHotelId: string;
  toHotelId: string | null;
  mode: keyof typeof HOTEL_JOURNEY_MODES;
  departureDate: string;
  departureTime: string;
  /** Legacy explicit date; new journeys derive the day from the travel clocks. */
  arrivalDate?: string;
  arrivalTime: string;
  airport?: SalesFlightAirportV1 | undefined;
  flight?: {
    airline: string;
    number: string;
    cabinClass: 'ECONOMY' | 'BUSINESS' | 'FIRST';
    originAirport?: SalesFlightAirportV1 | undefined;
    destinationAirport?: SalesFlightAirportV1 | undefined;
  };
}

const text = (value: unknown, max = 240): value is string =>
  typeof value === 'string' &&
  !!value.trim() &&
  value.length <= max &&
  ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const clock = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const airportValid = (a: SalesFlightAirportV1 | undefined) =>
  !!a &&
  uuid.test(a.id) &&
  uuid.test(a.cityId) &&
  uuid.test(a.countryId) &&
  /^[A-Z]{3}$/.test(a.code) &&
  text(a.name, 200);

export function hotelJourneyArrivalDate(leg: HotelJourneyV1): string {
  if (leg.arrivalDate) return leg.arrivalDate;
  if (!date(leg.departureDate)) return '';
  if (leg.arrivalTime >= leg.departureTime) return leg.departureDate;
  const next = new Date(leg.departureDate + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function hotelJourneyError(leg: HotelJourneyV1): string | undefined {
  if (!leg || !Object.hasOwn(HOTEL_JOURNEY_MODES, leg.mode))
    return 'روش جابه‌جایی را انتخاب کنید.';
  if (
    !date(leg.departureDate) ||
    (leg.arrivalDate && !date(leg.arrivalDate)) ||
    !clock(leg.departureTime) ||
    !clock(leg.arrivalTime)
  )
    return 'تاریخ حرکت و ساعت‌های حرکت و رسیدن جابه‌جایی را کامل کنید.';
  if (
    hotelJourneyArrivalDate(leg) + leg.arrivalTime <=
    leg.departureDate + leg.departureTime
  )
    return 'زمان رسیدن جابه‌جایی باید بعد از زمان حرکت باشد.';
  if (leg.toHotelId === null && !airportValid(leg.airport))
    return 'فرودگاه بلیت برگشت را انتخاب کنید.';
  if (
    leg.mode === 'FLIGHT' &&
    (!leg.flight ||
      !text(leg.flight.airline, 160) ||
      !text(leg.flight.number, 80) ||
      !['ECONOMY', 'BUSINESS', 'FIRST'].includes(leg.flight.cabinClass) ||
      !airportValid(leg.flight.originAirport) ||
      !airportValid(leg.flight.destinationAirport) ||
      leg.flight.originAirport?.id === leg.flight.destinationAirport?.id)
  )
    return 'ایرلاین، شماره، کلاس و فرودگاه‌های پرواز جابه‌جایی را کامل کنید.';
  if (leg.mode !== 'FLIGHT' && leg.flight)
    return 'اطلاعات پرواز با روش جابه‌جایی انتخاب‌شده سازگار نیست.';
  if (
    leg.mode === 'FLIGHT' &&
    leg.toHotelId === null &&
    leg.flight?.destinationAirport?.id !== leg.airport?.id
  )
    return 'مقصد پرواز جابه‌جایی باید فرودگاه بلیت برگشت باشد.';
  return undefined;
}

export function readHotelJourneys(
  services: readonly Pick<SalesServiceInput, 'kind' | 'metadata'>[],
): HotelJourneyV1[] {
  const sources = services.filter(
    (s) => s.metadata?.[HOTEL_JOURNEYS] !== undefined,
  );
  if (!sources.length) return [];
  const raw = sources[0]!.metadata![HOTEL_JOURNEYS];
  if (
    sources.length !== 1 ||
    sources[0]!.kind !== 'HOTEL' ||
    typeof raw !== 'string' ||
    raw.length > 100_000
  )
    throw Error('اطلاعات جابه‌جایی هتل‌ها معتبر نیست.');
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length > 50 ||
      value.some((v) => !v || typeof v !== 'object' || Array.isArray(v))
    )
      throw Error();
    return value as HotelJourneyV1[];
  } catch {
    throw Error('اطلاعات جابه‌جایی هتل‌ها معتبر نیست.');
  }
}

/** Routes are derived from the ordered hotel itinerary, including cross-country stays. */
export function validateHotelJourneys(
  legs: readonly HotelJourneyV1[],
  hotel: SalesHotelSelectionInput | null | undefined,
  returnDepartureAt?: string,
) {
  if (!legs.length) return;
  if (!hotel?.additionalStays?.length)
    throw Error('جابه‌جایی به هتل ترکیبی نیاز دارد.');
  const stays = [hotel, ...hotel.additionalStays];
  const used = new Set<string>();
  for (const leg of legs) {
    const error = hotelJourneyError(leg);
    if (error) throw Error(error);
    const index = stays.findIndex((s) => s.hotelId === leg.fromHotelId);
    const next = stays[index + 1];
    if (
      index < 0 ||
      used.has(leg.fromHotelId) ||
      (leg.toHotelId === null
        ? index !== stays.length - 1
        : !next || next.hotelId !== leg.toHotelId)
    )
      throw Error('مسیر جابه‌جایی با ترتیب هتل‌ها سازگار نیست.');
    used.add(leg.fromHotelId);
    if (
      leg.departureDate < stays[index]!.checkOutDate.slice(0, 10) ||
      (next && hotelJourneyArrivalDate(leg) > next.checkInDate.slice(0, 10))
    )
      throw Error(
        'تاریخ جابه‌جایی باید بین خروج از هتل قبلی و ورود به هتل بعدی باشد.',
      );
    if (
      leg.toHotelId === null &&
      returnDepartureAt &&
      Date.parse(
        hotelJourneyArrivalDate(leg) + 'T' + leg.arrivalTime + '+03:30',
      ) >= Date.parse(returnDepartureAt)
    )
      throw Error('رسیدن به فرودگاه باید قبل از حرکت بلیت برگشت باشد.');
  }
}
