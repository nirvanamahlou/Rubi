import type {
  CustomerSummary,
  MasterDataRecord,
  SalesContractCreateRequest,
  SalesPaymentInput,
  SalesPriceComponentInput,
  SalesServiceKind,
  SalesServiceInput,
  SalesTicketDirection,
  TicketOfferV1,
} from '@rubi/contracts';

export function selectSalesPerson(
  state: SalesFormState,
  person: Pick<CustomerSummary, 'id' | 'displayName' | 'roles'>,
  asCustomer: boolean,
  birthDate = '',
): Partial<SalesFormState> {
  return {
    ...(asCustomer
      ? { customerId: person.id, customerName: person.displayName }
      : {}),
    passengers:
      person.roles.includes('passenger') &&
      !state.passengers.some((item) => item.customerId === person.id)
        ? [
            ...state.passengers,
            {
              customerId: person.id,
              displayName: person.displayName,
              birthDate,
            },
          ]
        : state.passengers,
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
  businessOutput?: boolean;
  outboundOffer?: TicketOfferV1 | undefined;
  returnOffer?: TicketOfferV1 | undefined;
  customerId: string;
  customerName: string;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  originCountryId: string;
  destinationCountryId: string;
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
    hotelId: string;
    name: string;
    checkIn: string;
    checkOut: string;
    roomTypeId: string;
    roomCount: number;
    occupancy: number;
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
}

export const emptySalesForm: SalesFormState = {
  customerId: '',
  customerName: '',
  tripType: 'ONE_WAY',
  originCountryId: '',
  destinationCountryId: '',
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
    occupancy: 1,
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
    return { countryId: country?.id ?? countryId, cityId: city?.id ?? cityId };
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
    originId: origin.cityId,
    destinationCountryId: destination.countryId,
    destinationId: destination.cityId,
  };
}

export function salesDetailSteps(state: SalesFormState): string[] {
  return state.serviceKinds.flatMap((kind) =>
    kind === 'FLIGHT' ? ['FLIGHT'] : kind === 'TRANSFER' ? [] : [kind],
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
          ticket: { ...state.ticket, outboundOfferId: '', returnOfferId: '' },
        }
      : {}),
  };
}

export function salesReturnSearchFrom(state: SalesFormState): string {
  return state.outboundOffer?.departureAt.slice(0, 10) || state.departureDate;
}

export function salesTravelDate(state: SalesFormState): string {
  return (
    state.outboundOffer?.departureAt.slice(0, 10) ||
    state.returnOffer?.departureAt.slice(0, 10) ||
    (state.serviceKinds.includes('HOTEL') ? state.hotel.checkIn : '') ||
    state.departureDate
  );
}

export function salesPayload(
  state: SalesFormState,
): SalesContractCreateRequest {
  const utc = (value: string) => new Date(value).toISOString();
  const services: SalesServiceInput[] = state.serviceKinds.flatMap(
    (kind): SalesServiceInput[] =>
      kind === 'FLIGHT' || kind === 'TRANSFER'
        ? salesDirections(state, kind).map((direction) => ({
            clientKey: `${kind.toLowerCase()}-${direction.toLowerCase()}`,
            kind,
            titleSnapshot: `${kind === 'FLIGHT' ? 'بلیت' : 'ترانسفر'} ${direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}`,
            metadata: {
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
        : [
            {
              clientKey: kind.toLowerCase(),
              kind,
              metadata: { ...state.serviceDetails?.[kind] },
              titleSnapshot:
                (
                  {
                    FLIGHT: 'بلیت پرواز',
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
  const ticketSelections = state.serviceKinds.includes('FLIGHT')
    ? [
        ...(salesDirections(state, 'FLIGHT').includes('OUTBOUND') &&
        state.ticket.outboundOfferId
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
                ...(state.ticket.amount
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
        state.ticket.returnOfferId
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
                ...(state.ticket.amount
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
    tripType: state.tripType,
    originId: state.originId,
    destinationId: state.destinationId,
    departureDate: salesTravelDate(state),
    returnNotBefore:
      state.tripType === 'ROUND_TRIP' ? salesTravelDate(state) : null,
    services,
    passengers: state.passengers.map((item) => ({
      customerId: item.customerId,
      displayNameSnapshot: item.displayName,
      birthDate: item.birthDate,
      serviceClientKeys: services.map(({ clientKey }) => clientKey),
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
            roomTypeId: state.hotel.roomTypeId,
            occupancy: state.hotel.occupancy,
            inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
          }
        : null,
    priceComponents: state.priceComponents,
    payments: state.payments.map((payment) => ({
      ...payment,
      dueAt: utc(payment.dueAt),
    })),
    pricingNotes: state.pricingNotes || null,
  };
}
