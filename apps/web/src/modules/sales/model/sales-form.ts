import { passengerSaleTotals } from './passenger-sale-totals';
import {
  addInsuranceExtra,
  insuranceExtraRials,
  passengerOverSixty,
} from '@nora/contracts';
import {
  servicePriceComponents,
  SALES_ACCOMMODATION_LABELS,
  salesAccommodationValid,
  contractFlightMetadata,
  salesContractOnlyFlights,
  type SalesFlightSnapshotV1,
  type SalesServicePricingV1,
  quoteHotelOccupancy,
  hotelAgeOn,
  moneyUnits,
} from '@nora/contracts';
import type {
  CustomerSummary,
  SalesMoney,
  SalesAccommodationKind,
  MasterDataRecord,
  HotelRoomRateV1,
  SalesContractCreateRequest,
  SalesPaymentInput,
  SalesPriceComponentInput,
  SalesServiceKind,
  SalesServiceInput,
  SalesTicketDirection,
  TicketOfferV1,
  TourDepartureV1,
} from '@nora/contracts';

import {
  salesInsuranceService,
  type SalesInsuranceSelection,
} from './sales-insurance';
import { roundTripPerLegFares } from './standalone-ticket-pricing';

export function selectSalesPerson(
  state: SalesFormState,
  person: Pick<CustomerSummary, 'id' | 'displayName' | 'roles'> &
    Partial<Pick<CustomerSummary, 'kind' | 'organizationId'>>,
  asCustomer: boolean,
  birthDate = '',
): Partial<SalesFormState> {
  const isNewPassenger =
    person.kind !== 'organization' &&
    person.roles.includes('passenger') &&
    !state.passengers.some((item) => item.customerId === person.id);
  return {
    ...(asCustomer
      ? {
          customerId: person.id,
          customerName: person.displayName,
          customerKind: person.kind ?? 'person',
          customerOrganizationId: person.organizationId ?? '',
          firstPassengerIsCustomer: false,
        }
      : {}),
    passengers: isNewPassenger
      ? [
          ...state.passengers,
          {
            customerId: person.id,
            displayName: person.displayName,
            birthDate,
          },
        ]
      : state.passengers,
    ...(isNewPassenger && state.serviceKinds.includes('HOTEL')
      ? {
          hotel: {
            ...state.hotel,
            guestCustomerIds: [
              ...new Set([...(state.hotel.guestCustomerIds ?? []), person.id]),
            ],
          },
        }
      : {}),
  };
}

export const salesSteps = [
  'مسیر و خدمات',
  'جزئیات سفر',
  'مشتری و مسافران',
  'قیمت و پرداخت',
  'بازبینی',
] as const;

export interface SalesFormState {
  childAges?: (number | null)[];
  infantAges?: (number | null)[];
  priceEntryMode?: 'PASSENGER_TOTAL';
  insuranceExtraToman?: Record<string, string>;
  tour?: TourDepartureV1 | undefined;
  insurancePlan?: SalesInsuranceSelection | undefined;
  contractFlights?: Partial<Record<SalesTicketDirection, ContractFlightDraft>>;
  servicePricing?: Record<string, SalesServicePricingV1[]>;
  catalogSalePricing?: Record<string, SalesServicePricingV1[]>;
  customerKind?: 'person' | 'organization';
  customerOrganizationId?: string;
  firstPassengerIsCustomer?: boolean;
  businessOutput?: boolean;
  passengerComposition: { adults: number; children: number; infants: number };
  outboundOffer?: TicketOfferV1 | undefined;
  returnOffer?: TicketOfferV1 | undefined;
  customerId: string;
  customerName: string;
  buyerContact?: SalesContractCreateRequest['buyerContact'];
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  originCountryId: string;
  destinationCountryId: string;
  /** ISO country codes are kept with the draft so identity fields remain correct for UUID-backed countries. */
  originCountryCode?: string;
  destinationCountryCode?: string;
  serviceDirections?: Partial<
    Record<'FLIGHT' | 'TRANSFER', SalesTicketDirection[]>
  >;
  serviceDetails?: Record<
    string,
    { date?: string; pickup?: string; dropoff?: string; notes?: string }
  >;
  originId: string;
  destinationId: string;
  departureDate: string;
  returnDate: string;
  serviceKinds: SalesServiceKind[];
  ticket: {
    outboundOfferId: string;
    outboundDepartureAt: string;
    outboundArrivalAt: string;
    returnOfferId: string;
    returnDepartureAt: string;
    returnArrivalAt: string;
    carrier: string;
    outboundNumber: string;
    returnNumber: string;
    cabinClassCode: string;
    amount: string;
    currencyCode: string;
  };
  hotel: {
    checkInManual?: boolean;
    checkOutManual?: boolean;
    hotelId: string;
    name: string;
    checkIn: string;
    checkOut: string;
    roomTypeId: string;
    roomCount: number;
    singleRoomCount: number;
    doubleRoomCount: number;
    extraBedCount: number;
    occupancy: number;
    guestCustomerIds?: string[];
  };
  visaReferenceId: string;
  passengers: Array<{
    customerId: string;
    displayName: string;
    birthDate: string;
  }>;
  priceComponents: SalesPriceComponentInput[];
  payments: SalesPaymentInput[];
  pricingNotes: string;
  reservationNote?: string;
  passengerPrices?: Record<string, SalesMoney[]>;
  passengerAccommodations?: Record<string, SalesAccommodationKind>;
}

export interface ContractFlightDraft {
  departureAt: string;
  arrivalAt: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: 'ECONOMY' | 'BUSINESS' | 'FIRST';
}

export function salesFlightSelection(
  state: SalesFormState,
  direction: SalesTicketDirection,
): SalesFlightSnapshotV1 | undefined {
  if (!salesDirections(state, 'FLIGHT').includes(direction)) return undefined;
  const manual = state.contractFlights?.[direction];
  const serviceClientKey = 'flight-' + direction.toLowerCase();
  if (manual) {
    try {
      const utc = (value: string) =>
        new Date(
          /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + '+03:30',
        ).toISOString();
      return salesContractOnlyFlights([
        {
          kind: 'FLIGHT',
          clientKey: serviceClientKey,
          titleSnapshot: 'بلیط شناور',
          status: 'NEEDS_RESERVATION_CONFIRMATION',
          metadata: contractFlightMetadata({
            version: 1,
            direction,
            originId:
              direction === 'OUTBOUND' ? state.originId : state.destinationId,
            destinationId:
              direction === 'OUTBOUND' ? state.destinationId : state.originId,
            departureAt: utc(manual.departureAt),
            arrivalAt: utc(manual.arrivalAt),
            carrierNameSnapshot: manual.carrierName.trim(),
            serviceNumberSnapshot: manual.serviceNumber.trim(),
            cabinClassCode: manual.cabinClassCode,
          }),
        },
      ])[0];
    } catch {
      return undefined;
    }
  }
  const offer =
    direction === 'OUTBOUND' ? state.outboundOffer : state.returnOffer;
  return offer
    ? {
        source: 'CATALOG',
        offerId: offer.id,
        serviceClientKey,
        direction,
        originId: offer.originId,
        destinationId: offer.destinationId,
        departureAt: offer.departureAt,
        arrivalAt: offer.arrivalAt,
        carrierNameSnapshot: offer.carrierName,
        serviceNumberSnapshot: offer.serviceNumber,
        cabinClassCode: offer.cabinClassCode,
      }
    : undefined;
}

export function salesFlightsValid(state: SalesFormState): boolean {
  const directions = salesDirections(state, 'FLIGHT');
  if (
    directions.some((direction) => {
      const flight = salesFlightSelection(state, direction);
      if (!flight) return true;
      return (
        flight.source === 'CATALOG' &&
        !salesOfferHasCapacity(
          direction === 'OUTBOUND' ? state.outboundOffer : state.returnOffer,
          salesPassengerCounts(state).seated,
        )
      );
    })
  )
    return false;
  const out = salesFlightSelection(state, 'OUTBOUND'),
    back = salesFlightSelection(state, 'RETURN');
  return (
    !out || !back || Date.parse(back.departureAt) >= Date.parse(out.arrivalAt)
  );
}

export function patchContractFlight(
  state: SalesFormState,
  direction: SalesTicketDirection,
  flight: ContractFlightDraft | undefined,
): Partial<SalesFormState> {
  const contractFlights = { ...state.contractFlights };
  if (flight) contractFlights[direction] = flight;
  else delete contractFlights[direction];
  return {
    contractFlights,
    servicePricing:
      Boolean(state.contractFlights?.[direction]) === Boolean(flight)
        ? (state.servicePricing ?? {})
        : Object.fromEntries(
            Object.entries(state.servicePricing ?? {}).filter(
              ([key]) =>
                key !==
                (direction === 'OUTBOUND'
                  ? 'flight-outbound'
                  : 'flight-return'),
            ),
          ),
    ...(direction === 'OUTBOUND'
      ? { outboundOffer: undefined }
      : { returnOffer: undefined }),
    ticket: {
      ...state.ticket,
      ...(direction === 'OUTBOUND'
        ? { outboundOfferId: '' }
        : { returnOfferId: '' }),
    },
  };
}

export const emptySalesForm: SalesFormState = {
  customerId: '',
  customerName: '',
  tripType: 'ONE_WAY',
  passengerComposition: { adults: 1, children: 0, infants: 0 },
  originCountryId: '',
  destinationCountryId: '',
  originCountryCode: '',
  destinationCountryCode: '',
  originId: '',
  destinationId: '',
  departureDate: '',
  returnDate: '',
  serviceKinds: [],
  ticket: {
    outboundOfferId: '',
    outboundDepartureAt: '',
    outboundArrivalAt: '',
    returnOfferId: '',
    returnDepartureAt: '',
    returnArrivalAt: '',
    carrier: '',
    outboundNumber: '',
    returnNumber: '',
    cabinClassCode: 'ECONOMY',
    amount: '',
    currencyCode: 'IRR',
  },
  hotel: {
    hotelId: '',
    name: '',
    checkIn: '',
    checkOut: '',
    roomTypeId: '',
    roomCount: 1,
    singleRoomCount: 0,
    doubleRoomCount: 1,
    extraBedCount: 0,
    occupancy: 1,
    guestCustomerIds: [],
  },
  visaReferenceId: '',
  passengers: [],
  priceComponents: [
    {
      type: 'BASE',
      title: 'مبلغ پایه قرارداد',
      amount: '',
      currencyCode: 'IRR',
    },
  ],
  payments: [],
  pricingNotes: '',
};

export function salesPassengerCounts(state: SalesFormState) {
  const composition = state.passengerComposition ?? {
    adults: 1,
    children: 0,
    infants: 0,
  };
  const adults = Number.isInteger(composition.adults)
    ? Math.max(0, composition.adults)
    : 0;
  const children = Number.isInteger(composition.children)
    ? Math.max(0, composition.children)
    : 0;
  const infants = Number.isInteger(composition.infants)
    ? Math.max(0, composition.infants)
    : 0;
  return {
    adults,
    children,
    infants,
    seated: adults + children,
    total: adults + children + infants,
  };
}

export function salesHotelCapacityError(
  state: SalesFormState,
  roomRates: readonly HotelRoomRateV1[],
): string | null {
  if (!state.hotel.roomTypeId) return null;
  const roomRate = roomRates.find(
    ({ roomTypeId }) => roomTypeId === state.hotel.roomTypeId,
  );
  if (!roomRate) return null;
  if (roomRate.occupancyRates)
    return salesHotelOccupancyQuote(state, roomRate)
      ? null
      : 'برای تعداد اتاق، ترکیب مهمانان، سن کودک و تمام شب‌های انتخاب‌شده نرخ معتبری وجود ندارد؛ سن‌ها، تاریخ یا نوع اتاق را اصلاح کنید.';
  const rooms = Math.max(1, state.hotel.roomCount);
  const counts = salesPassengerCounts(state);
  const maxAdults = roomRate.maxAdults * rooms;
  const maxChildren2To6 =
    (roomRate.maxChildren2To6 ?? roomRate.maxChildren) * rooms;
  const maxChildren6To12 = (roomRate.maxChildren6To12 ?? 0) * rooms;
  const maxInfants = (roomRate.maxInfants ?? 0) * rooms;
  const maxChildren = maxChildren2To6 + maxChildren6To12;
  if (
    counts.adults <= maxAdults &&
    counts.children <= maxChildren &&
    counts.infants <= maxInfants
  )
    return null;
  return `ظرفیت ${roomRate.roomTypeName} برای ${rooms.toLocaleString('fa-IR')} اتاق، حداکثر ${maxAdults.toLocaleString('fa-IR')} بزرگسال، ${maxChildren2To6.toLocaleString('fa-IR')} کودک ۲–۶، ${maxChildren6To12.toLocaleString('fa-IR')} کودک ۶–۱۲ و ${maxInfants.toLocaleString('fa-IR')} نوزاد است؛ تعداد اتاق یا نوع اتاق را تغییر دهید.`;
}

export function salesHotelOccupancyQuote(
  state: SalesFormState,
  room: HotelRoomRateV1,
) {
  if (!room.occupancyRates) return null;
  const counts = salesPassengerCounts(state);
  const guestIds = new Set(salesHotelGuestIds(state));
  const guests = state.passengers.filter((p) => guestIds.has(p.customerId));
  let adults = counts.adults;
  let ages: (number | null)[] = [
    ...(state.childAges ?? []),
    ...(state.infantAges ?? []),
  ];
  if (guests.length) {
    const actual = guests.map((p) =>
      hotelAgeOn(p.birthDate, state.hotel.checkIn),
    );
    if (actual.some((age) => age === null)) return null;
    adults = actual.filter((age) => age !== null && age >= 15).length;
    ages = actual.filter((age) => age !== null && age < 15);
  } else if (
    (state.childAges?.length ?? 0) !== counts.children ||
    (state.infantAges?.length ?? 0) !== counts.infants
  )
    return null;
  if (ages.some((age) => age === null || age >= 15)) return null;
  return quoteHotelOccupancy(room.occupancyRates, {
    adults,
    childAges: ages as number[],
    rooms: state.hotel.roomCount,
    checkIn: state.hotel.checkIn,
    checkOut: state.hotel.checkOut,
  });
}

/** Only new-contract imported hotel quotes; a negotiated agreement remains independent. */
export function hotelOccupancySaleDefaults(
  state: SalesFormState,
  room?: HotelRoomRateV1,
): SalesFormState {
  if (
    !state.serviceKinds.includes('HOTEL') ||
    !room?.occupancyRates ||
    state.tour
  )
    return state;
  const quote = salesHotelOccupancyQuote(state, room);
  if (!quote) return state;
  const previous = state.servicePricing?.hotel?.find(
    (p) => p.currencyCode === quote.currencyCode,
  );
  const followed =
    previous?.agreed.basis === 'TOTAL' &&
    previous.daySale.basis === 'TOTAL' &&
    /^\d{1,18}(\.\d{1,4})?$/.test(previous.agreed.amount) &&
    /^\d{1,18}(\.\d{1,4})?$/.test(previous.daySale.amount) &&
    moneyUnits(previous.agreed.amount) === moneyUnits(previous.daySale.amount);
  const price: SalesServicePricingV1 = {
    version: 1,
    currencyCode: quote.currencyCode,
    daySale: { basis: 'TOTAL', amount: quote.amount },
    agreed:
      previous && !followed
        ? previous.agreed
        : { basis: 'TOTAL', amount: quote.amount },
  };
  return {
    ...state,
    servicePricing: { ...state.servicePricing, hotel: [price] },
  };
}

export function salesPassengerCompositionMatches(state: SalesFormState) {
  const expected = salesPassengerCounts(state);
  const actual = { adults: 0, children: 0, infants: 0 };
  for (const passenger of state.passengers) {
    const category = salesPassengerAgeLabel(
      passenger.birthDate,
      salesTravelDate(state),
    );
    if (category === 'بزرگسال') actual.adults += 1;
    else if (category === 'کودک') actual.children += 1;
    else if (category === 'نوزاد') actual.infants += 1;
    else return false;
  }
  return (
    actual.adults === expected.adults &&
    actual.children === expected.children &&
    actual.infants === expected.infants
  );
}

export function salesHotelGuestIds(state: SalesFormState): string[] {
  const configured = state.hotel.guestCustomerIds;
  return configured === undefined
    ? state.passengers.map(({ customerId }) => customerId)
    : configured.filter((id) =>
        state.passengers.some(({ customerId }) => customerId === id),
      );
}

export function salesOfferHasCapacity(
  offer: TicketOfferV1 | undefined,
  seatCount: number,
): boolean {
  return Boolean(offer && offer.remainingCapacity >= seatCount);
}

export function withFirstPassengerCustomer(
  state: SalesFormState,
): SalesFormState {
  if (state.customerKind === 'organization')
    return { ...state, firstPassengerIsCustomer: false };
  if (
    state.firstPassengerIsCustomer === false &&
    state.customerId &&
    state.buyerContact
  )
    return state;
  const first = state.passengers[0];
  return {
    ...state,
    firstPassengerIsCustomer: true,
    customerId: first?.customerId ?? '',
    customerName: first?.displayName ?? '',
  };
}

export function salesPassengerAgeLabel(
  birthDate: string,
  departureDate: string,
): string {
  if (!birthDate || !departureDate) return 'تاریخ تولد را وارد کنید';
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  const travel = new Date(`${departureDate.slice(0, 10)}T00:00:00Z`);
  if (
    !Number.isFinite(birth.getTime()) ||
    !Number.isFinite(travel.getTime()) ||
    birth > travel
  )
    return 'تاریخ نامعتبر';
  let age = travel.getUTCFullYear() - birth.getUTCFullYear();
  if (
    travel.getUTCMonth() < birth.getUTCMonth() ||
    (travel.getUTCMonth() === birth.getUTCMonth() &&
      travel.getUTCDate() < birth.getUTCDate())
  )
    age--;
  return age < 2 ? 'نوزاد' : age < 12 ? 'کودک' : 'بزرگسال';
}

export function salesAccommodationOptions(
  birthDate: string,
  departureDate: string,
) {
  const label = salesPassengerAgeLabel(birthDate, departureDate);
  const age =
    label === 'نوزاد'
      ? 'INF'
      : label === 'کودک'
        ? 'CHD'
        : label === 'بزرگسال'
          ? 'ADT'
          : null;
  return Object.entries(SALES_ACCOMMODATION_LABELS)
    .filter(([id]) => age && salesAccommodationValid(id, age))
    .map(([id, name]) => ({ id, name, code: id }));
}

export function salesAccommodationsComplete(state: SalesFormState) {
  return (
    !state.serviceKinds.includes('HOTEL') ||
    salesHotelGuestIds(state).every((id) => {
      const passenger = state.passengers.find((p) => p.customerId === id);
      return (
        passenger &&
        salesAccommodationOptions(
          passenger.birthDate,
          salesTravelDate(state),
        ).some((option) => option.id === state.passengerAccommodations?.[id])
      );
    })
  );
}

export function salesDirections(
  state: SalesFormState,
  kind: 'FLIGHT' | 'TRANSFER',
): SalesTicketDirection[] {
  if (!state.serviceKinds.includes(kind)) return [];
  const directions =
    state.serviceDirections?.[kind] ??
    (state.tripType === 'ROUND_TRIP' ? ['OUTBOUND', 'RETURN'] : ['OUTBOUND']);
  return (['OUTBOUND', 'RETURN'] as const).filter((direction) =>
    directions.includes(direction),
  );
}

export function normalizeRouteSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .trim()
    .toLocaleLowerCase();
}

export function withSalesRouteDefaults(
  state: SalesFormState,
  countries: readonly MasterDataRecord[],
  cities: readonly MasterDataRecord[],
): SalesFormState {
  const resolveSide = (
    countryId: string,
    cityId: string,
    iso: string,
    aliases: string[],
  ) => {
    const existingCity = cities.find((item) => item.id === cityId);
    const country =
      countries.find(
        (item) => item.id === (countryId || existingCity?.attributes.countryId),
      ) ??
      (!countryId && !cityId
        ? countries.find(
            (item) => item.attributes.iso2Code === iso || item.code === iso,
          )
        : undefined);
    const city =
      existingCity ??
      (!cityId && !countryId
        ? cities.find(
            (item) =>
              item.attributes.countryId === country?.id &&
              aliases.includes(normalizeRouteSearch(item.name)),
          )
        : undefined);
    return {
      countryId: country?.id ?? countryId,
      cityId: city?.id ?? cityId,
      countryCode: String(country?.attributes.iso2Code ?? country?.code ?? ''),
    };
  };
  const origin = resolveSide(state.originCountryId, state.originId, 'IR', [
    'تهران',
    'tehran',
  ]);
  const destination = resolveSide(
    state.destinationCountryId,
    state.destinationId,
    'TR',
    ['انتالیا', 'antalya'],
  );
  return {
    ...state,
    originCountryId: origin.countryId,
    originCountryCode: origin.countryCode,
    originId: origin.cityId,
    destinationCountryId: destination.countryId,
    destinationCountryCode: destination.countryCode,
    destinationId: destination.cityId,
  };
}

function salesIranCountry(
  countryId: string | undefined,
  countryCode: string | undefined,
): boolean {
  const value = `${countryCode ?? ''} ${countryId ?? ''}`.trim().toUpperCase();
  return /(^|\s)(IR|IRN|IRAN)(\s|$)/.test(value);
}

/** Use a Gregorian default once a selected endpoint is known to be outside Iran. */
export function salesInternationalTravel(state: SalesFormState): boolean {
  return (
    [
      [state.originCountryId, state.originCountryCode],
      [state.destinationCountryId, state.destinationCountryCode],
    ] as const
  ).some(([id, code]) => Boolean(id || code) && !salesIranCountry(id, code));
}

/** A route is domestic only when both endpoints are inside Iran. */
export function salesDomesticIranRoute(state: SalesFormState): boolean {
  return (
    salesIranCountry(state.originCountryId, state.originCountryCode) &&
    salesIranCountry(state.destinationCountryId, state.destinationCountryCode)
  );
}

/**
 * Passport data belongs to an international flight, not to the destination
 * itself. A foreign hotel-only contract must remain usable with the domestic
 * customer identity fields.
 */
export function salesRequiresPassportIdentity(state: SalesFormState): boolean {
  if (!state.serviceKinds.includes('FLIGHT')) return false;
  if (
    !state.originCountryId &&
    !state.destinationCountryId &&
    !state.originCountryCode &&
    !state.destinationCountryCode
  )
    return false;
  return !salesDomesticIranRoute(state);
}

export function salesDetailSteps(state: SalesFormState): string[] {
  return state.serviceKinds.flatMap((kind) =>
    kind === 'TRANSFER' ||
    (kind === 'HOTEL' && state.serviceKinds.includes('FLIGHT'))
      ? []
      : [kind],
  );
}

/** Match the Tehran calendar dates displayed on Sales ticket cards. */
export function salesHotelDate(
  departureAt: string | undefined,
  days: number,
): string {
  if (!departureAt || !Number.isFinite(Date.parse(departureAt))) return '';
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(departureAt));
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function withSalesHotelDates(
  previous: SalesFormState,
  next: SalesFormState,
): SalesFormState {
  const suggestion = (state: SalesFormState, field: 'checkIn' | 'checkOut') =>
    salesHotelDate(
      salesDirections(state, 'FLIGHT').includes(
        field === 'checkIn' ? 'OUTBOUND' : 'RETURN',
      )
        ? salesFlightSelection(
            state,
            field === 'checkIn' ? 'OUTBOUND' : 'RETURN',
          )?.departureAt
        : undefined,
      field === 'checkIn' ? 1 : -1,
    );
  const hotel = { ...next.hotel };
  for (const field of ['checkIn', 'checkOut'] as const) {
    const manualKey = field === 'checkIn' ? 'checkInManual' : 'checkOutManual';
    // Existing drafts without provenance keep user-entered dates intact.
    const manual =
      hotel[manualKey] ??
      Boolean(
        previous.hotel[field] &&
        previous.hotel[field] !== suggestion(previous, field),
      );
    hotel[manualKey] = manual;
    if (!manual) hotel[field] = suggestion(next, field);
  }
  return { ...next, hotel };
}

export function salesHotelRoomTypes(
  hotelId: string,
  hotels: readonly MasterDataRecord[],
  roomTypes: readonly MasterDataRecord[],
  ratedRoomTypeIds: readonly string[] = [],
) {
  if (!hotelId) return [];
  const hotel = hotels.find((item) => item.id === hotelId);
  if (!hotel) return [];
  const linkedRoomTypeIds = String(hotel.attributes.roomTypeIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const availableIds = new Set([
    ...linkedRoomTypeIds,
    ...ratedRoomTypeIds.filter(Boolean),
  ]);
  return roomTypes.filter((roomType) => availableIds.has(roomType.id));
}

export function salesHotelValid(state: SalesFormState): boolean {
  return Boolean(
    state.hotel.hotelId &&
    state.hotel.checkIn &&
    state.hotel.checkOut &&
    state.hotel.checkOut > state.hotel.checkIn &&
    state.hotel.roomTypeId &&
    Number.isInteger(state.hotel.roomCount) &&
    state.hotel.roomCount > 0 &&
    Number.isInteger(state.hotel.singleRoomCount) &&
    state.hotel.singleRoomCount >= 0 &&
    Number.isInteger(state.hotel.doubleRoomCount) &&
    state.hotel.doubleRoomCount >= 0 &&
    state.hotel.singleRoomCount + state.hotel.doubleRoomCount <=
      state.hotel.roomCount &&
    Number.isInteger(state.hotel.extraBedCount) &&
    state.hotel.extraBedCount >= 0 &&
    Number.isInteger(state.hotel.occupancy) &&
    state.hotel.occupancy > 0,
  );
}

export function toggleSalesDirectionalService(
  state: SalesFormState,
  kind: 'FLIGHT' | 'TRANSFER',
): Partial<SalesFormState> {
  const next: SalesTicketDirection[] = state.serviceKinds.includes(kind)
    ? []
    : ['OUTBOUND', 'RETURN'];
  return {
    serviceKinds: next.length
      ? [
          ...new Set([
            ...state.serviceKinds.filter(
              (item) =>
                kind !== 'FLIGHT' || (item !== 'BUS' && item !== 'TRAIN'),
            ),
            kind,
          ]),
        ]
      : state.serviceKinds.filter((item) => item !== kind),
    serviceDirections: { ...state.serviceDirections, [kind]: next },
    tripType:
      next.includes('RETURN') ||
      salesDirections(
        state,
        kind === 'FLIGHT' ? 'TRANSFER' : 'FLIGHT',
      ).includes('RETURN')
        ? 'ROUND_TRIP'
        : 'ONE_WAY',
    ...(kind === 'FLIGHT'
      ? {
          outboundOffer: undefined,
          returnOffer: undefined,
          contractFlights: {},
          ticket: { ...state.ticket, outboundOfferId: '', returnOfferId: '' },
        }
      : {}),
  };
}

export function salesReturnSearchFrom(state: SalesFormState): string {
  return (
    salesFlightSelection(state, 'OUTBOUND')?.departureAt.slice(0, 10) ||
    state.departureDate
  );
}

export function salesTravelDate(state: SalesFormState): string {
  return (
    salesFlightSelection(state, 'OUTBOUND')?.departureAt.slice(0, 10) ||
    salesFlightSelection(state, 'RETURN')?.departureAt.slice(0, 10) ||
    (state.serviceKinds.includes('HOTEL') ? state.hotel.checkIn : '') ||
    state.departureDate
  );
}

export function salesPayload(
  state: SalesFormState,
): SalesContractCreateRequest {
  state = withFirstPassengerCustomer(state);
  const utc = (value: string) => new Date(value).toISOString();
  const services: SalesServiceInput[] = state.serviceKinds.flatMap(
    (kind): SalesServiceInput[] =>
      kind === 'FLIGHT' || kind === 'TRANSFER'
        ? salesDirections(state, kind).map((direction) => ({
            clientKey: `${kind.toLowerCase()}-${direction.toLowerCase()}`,
            kind,
            titleSnapshot: `${kind === 'FLIGHT' ? 'بلیط' : 'ترانسفر'} ${direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}`,
            metadata: {
              ...(kind === 'FLIGHT' && direction === 'OUTBOUND' && state.tour
                ? {
                    tourDepartureId: state.tour.id,
                    tourDepartureVersion: state.tour.version,
                    tourName: state.tour.package.name,
                  }
                : {}),
              ...(kind === 'FLIGHT'
                ? { businessOutput: state.businessOutput === true }
                : {}),
              ...(kind === 'FLIGHT'
                ? state.serviceDetails?.[`${kind}-${direction}`]
                : {}),
              direction,
              originId:
                direction === 'OUTBOUND' ? state.originId : state.destinationId,
              destinationId:
                direction === 'OUTBOUND' ? state.destinationId : state.originId,
            },
          }))
        : kind === 'INSURANCE'
          ? [salesInsuranceService(state.insurancePlan)]
          : [
              {
                clientKey: kind.toLowerCase(),
                kind,
                metadata: { ...state.serviceDetails?.[kind] },
                titleSnapshot:
                  (
                    {
                      FLIGHT: 'بلیط پرواز',
                      HOTEL: 'اقامت هتل',
                      VISA: 'خدمات ویزا',
                    } as Partial<Record<SalesServiceKind, string>>
                  )[kind] ?? kind,
                ...(kind === 'VISA' && state.visaReferenceId
                  ? { referenceId: state.visaReferenceId }
                  : {}),
              },
            ],
  );
  for (const direction of salesDirections(state, 'FLIGHT')) {
    if (!state.contractFlights?.[direction]) continue;
    const flight = salesFlightSelection(state, direction);
    if (!flight || flight.source !== 'CONTRACT_ONLY')
      throw new Error('اطلاعات بلیط شناور کامل نیست.');
    const service = services.find(
      (item) => item.clientKey === flight.serviceClientKey,
    )!;
    service.status = 'NEEDS_RESERVATION_CONFIRMATION';
    service.titleSnapshot += ' — شناور (فقط این قرارداد)';
    service.metadata = {
      ...service.metadata,
      ...contractFlightMetadata({ ...flight, version: 1 }),
    };
  }
  if (state.servicePricing && state.priceEntryMode !== 'PASSENGER_TOTAL')
    for (const service of services) {
      if (service.kind === 'TRANSFER') {
        service.metadata = { ...service.metadata, includedWithoutCharge: true };
        service.pricing = [];
      } else {
        service.pricing = state.servicePricing[service.clientKey] ?? [];
        const catalog = state.catalogSalePricing?.[service.clientKey]?.[0];
        if (service.kind === 'FLIGHT' && catalog)
          service.metadata = {
            ...service.metadata,
            catalogSaleQuoteVersion: 1,
            catalogSaleQuoteCurrency: catalog.currencyCode,
            catalogSaleQuoteAmount: catalog.daySale.amount,
          };
      }
    }
  const extras = state.serviceKinds.includes('INSURANCE')
    ? state.passengers.filter(
        (p) =>
          passengerOverSixty(p.birthDate, salesTravelDate(state)) &&
          BigInt(state.insuranceExtraToman?.[p.customerId] || '0') > 0n,
      )
    : [];
  for (const person of extras) {
    const toman = state.insuranceExtraToman![person.customerId]!;
    const amount = insuranceExtraRials(toman);
    services.push({
      clientKey: `insurance-extra-${person.customerId}`,
      kind: 'OTHER',
      titleSnapshot: `اضافه بیمه بالای ۶۰ سال · ${person.displayName}`,
      metadata: {
        insuranceAgeSurcharge: true,
        passengerId: person.customerId,
        extraToman: toman,
      },
      pricing: [
        {
          version: 1,
          currencyCode: 'IRR',
          daySale: { basis: 'TOTAL', amount },
          agreed: { basis: 'TOTAL', amount },
        },
      ],
    });
  }
  if (state.priceEntryMode === 'PASSENGER_TOTAL')
    passengerSaleTotals(state.passengers, state.passengerPrices ?? {});
  const packagePrices =
    state.priceEntryMode === 'PASSENGER_TOTAL'
      ? passengerSaleTotals(
          state.passengers,
          Object.fromEntries(
            state.passengers.map((p) => [
              p.customerId,
              extras.some((e) => e.customerId === p.customerId)
                ? addInsuranceExtra(
                    state.passengerPrices?.[p.customerId] ?? [],
                    state.insuranceExtraToman![p.customerId]!,
                  )
                : (state.passengerPrices?.[p.customerId] ?? []),
            ]),
          ),
        )
      : undefined;
  if (packagePrices)
    for (const service of services) {
      service.metadata = {
        ...service.metadata,
        passengerPackagePricingVersion: 1,
      };
      const catalog = state.catalogSalePricing?.[service.clientKey]?.[0];
      if (service.kind === 'FLIGHT' && catalog)
        service.metadata = {
          ...service.metadata,
          catalogSaleQuoteVersion: 1,
          catalogSaleQuoteCurrency: catalog.currencyCode,
          catalogSaleQuoteAmount: catalog.daySale.amount,
        };
    }
  const pairedTicketFares =
    state.outboundOffer && state.returnOffer
      ? roundTripPerLegFares(state.outboundOffer, state.returnOffer)
      : undefined;
  const hasTieredFare = Boolean(
    state.outboundOffer && state.returnOffer
      ? state.outboundOffer.roundTripSalePrices?.find(
          (fare) => fare.returnOfferId === state.returnOffer!.id,
        )?.tiers?.length
      : state.outboundOffer?.standaloneSalePrice?.tiers?.length ||
          state.returnOffer?.standaloneSalePrice?.tiers?.length,
  );
  const ticketSelections = state.serviceKinds.includes('FLIGHT')
    ? [
        ...(salesDirections(state, 'FLIGHT').includes('OUTBOUND') &&
        state.ticket.outboundOfferId &&
        !state.contractFlights?.OUTBOUND
          ? [
              {
                serviceClientKey: 'flight-outbound',
                direction: 'OUTBOUND' as const,
                offerId: state.ticket.outboundOfferId,
                originId: state.originId,
                destinationId: state.destinationId,
                departureAt: utc(state.ticket.outboundDepartureAt),
                arrivalAt: utc(state.ticket.outboundArrivalAt),
                carrierNameSnapshot: state.ticket.carrier,
                serviceNumberSnapshot: state.ticket.outboundNumber,
                cabinClassCode:
                  state.outboundOffer?.cabinClassCode ??
                  state.ticket.cabinClassCode,
                ...(!state.tour &&
                !state.serviceKinds.includes('HOTEL') &&
                !hasTieredFare &&
                (pairedTicketFares || state.outboundOffer?.standaloneSalePrice)
                  ? {
                      quotedPrice: {
                        amount: pairedTicketFares
                          ? pairedTicketFares.outboundAmount
                          : state.outboundOffer!.standaloneSalePrice!.amount,
                        currencyCode:
                          pairedTicketFares?.currencyCode ??
                          state.outboundOffer!.standaloneSalePrice!
                            .currencyCode,
                      },
                    }
                  : state.ticket.amount && !hasTieredFare
                    ? {
                        quotedPrice: {
                          amount: state.ticket.amount,
                          currencyCode: state.ticket.currencyCode,
                        },
                      }
                    : {}),
              },
            ]
          : []),
        ...(salesDirections(state, 'FLIGHT').includes('RETURN') &&
        state.ticket.returnOfferId &&
        !state.contractFlights?.RETURN
          ? [
              {
                serviceClientKey: 'flight-return',
                direction: 'RETURN' as const,
                offerId: state.ticket.returnOfferId,
                originId: state.destinationId,
                destinationId: state.originId,
                departureAt: utc(state.ticket.returnDepartureAt),
                arrivalAt: utc(state.ticket.returnArrivalAt),
                carrierNameSnapshot:
                  state.returnOffer?.carrierName ?? state.ticket.carrier,
                serviceNumberSnapshot: state.ticket.returnNumber,
                cabinClassCode:
                  state.returnOffer?.cabinClassCode ??
                  state.ticket.cabinClassCode,
                ...(!state.tour &&
                !state.serviceKinds.includes('HOTEL') &&
                !hasTieredFare &&
                (pairedTicketFares || state.returnOffer?.standaloneSalePrice)
                  ? {
                      quotedPrice: {
                        amount: pairedTicketFares
                          ? pairedTicketFares.returnAmount
                          : state.returnOffer!.standaloneSalePrice!.amount,
                        currencyCode:
                          pairedTicketFares?.currencyCode ??
                          state.returnOffer!.standaloneSalePrice!.currencyCode,
                      },
                    }
                  : state.ticket.amount && !hasTieredFare
                    ? {
                        quotedPrice: {
                          amount: state.ticket.amount,
                          currencyCode: state.ticket.currencyCode,
                        },
                      }
                    : {}),
              },
            ]
          : []),
      ]
    : [];
  return {
    customerId: state.customerId,
    payerCustomerId: state.customerId,
    ...(state.buyerContact ? { buyerContact: state.buyerContact } : {}),
    tripType: state.tripType,
    originId: state.originId,
    destinationId: state.destinationId,
    departureDate: salesTravelDate(state),
    returnNotBefore:
      state.tripType === 'ROUND_TRIP' ? salesTravelDate(state) : null,
    services: services.map((service, index) =>
      index === 0 && state.reservationNote?.trim()
        ? {
            ...service,
            metadata: {
              ...service.metadata,
              reservationNote: state.reservationNote.trim(),
            },
          }
        : service,
    ),
    passengers: state.passengers.map((item) => ({
      customerId: item.customerId,
      displayNameSnapshot: item.displayName,
      ...(state.serviceKinds.includes('HOTEL') &&
      salesHotelGuestIds(state).includes(item.customerId) &&
      state.passengerAccommodations?.[item.customerId]
        ? { accommodationKind: state.passengerAccommodations[item.customerId] }
        : {}),
      ...(state.passengerPrices
        ? {
            agreedPrices: packagePrices
              ? packagePrices.prices[item.customerId]
              : extras.some((p) => p.customerId === item.customerId)
                ? addInsuranceExtra(
                    state.passengerPrices[item.customerId] ?? [],
                    state.insuranceExtraToman![item.customerId]!,
                  )
                : (state.passengerPrices[item.customerId] ?? []),
          }
        : {}),
      birthDate: item.birthDate,
      serviceClientKeys: services
        .filter(({ clientKey, metadata }) =>
          metadata?.insuranceAgeSurcharge === true
            ? metadata.passengerId === item.customerId
            : clientKey !== 'hotel' ||
              salesHotelGuestIds(state).includes(item.customerId),
        )
        .map(({ clientKey }) => clientKey),
    })),
    ticketSelections,
    hotelSelection:
      state.serviceKinds.includes('HOTEL') && state.hotel.hotelId
        ? {
            serviceClientKey: 'hotel',
            hotelId: state.hotel.hotelId,
            hotelNameSnapshot: state.hotel.name,
            cityId: state.destinationId,
            checkInDate: state.hotel.checkIn,
            checkOutDate: state.hotel.checkOut,
            roomCount: state.hotel.roomCount,
            singleRoomCount: state.hotel.singleRoomCount,
            doubleRoomCount: state.hotel.doubleRoomCount,
            extraBedCount: state.hotel.extraBedCount,
            roomTypeId: state.hotel.roomTypeId,
            occupancy: salesHotelGuestIds(state).length,
            inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
          }
        : null,
    priceComponents:
      packagePrices?.components ??
      servicePriceComponents(
        services,
        state.serviceKinds.includes('HOTEL')
          ? {
              checkInDate: state.hotel.checkIn,
              checkOutDate: state.hotel.checkOut,
            }
          : null,
      ) ??
      state.priceComponents,
    payments: state.payments.map((payment) => ({
      ...payment,
      dueAt: utc(payment.dueAt),
    })),
    pricingNotes: state.pricingNotes || null,
  };
}
