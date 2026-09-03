import type {
  SalesContractCreateRequest,
  SalesPaymentInput,
  SalesPriceComponentInput,
  SalesServiceKind,
} from '@rubi/contracts';

export const salesSteps = [
  'مشتری',
  'مسیر',
  'خدمات',
  'جزئیات سفر',
  'مسافران',
  'قیمت و پرداخت',
  'بازبینی',
] as const;

export interface SalesFormState {
  customerId: string;
  customerName: string;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
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

export function salesPayload(
  state: SalesFormState,
): SalesContractCreateRequest {
  const utc = (value: string) => new Date(value).toISOString();
  const services = state.serviceKinds.map((kind) => ({
    clientKey: kind.toLowerCase(),
    kind,
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
    ...(kind === 'FLIGHT' ? { status: 'AWAITING_PUBLIC_API' as const } : {}),
  }));
  const ticketSelections =
    state.serviceKinds.includes('FLIGHT') && state.ticket.outboundOfferId
      ? [
          {
            serviceClientKey: 'flight',
            direction: 'OUTBOUND' as const,
            offerId: state.ticket.outboundOfferId,
            originId: state.originId,
            destinationId: state.destinationId,
            departureAt: utc(state.ticket.outboundDepartureAt),
            arrivalAt: utc(state.ticket.outboundArrivalAt),
            carrierNameSnapshot: state.ticket.carrier,
            serviceNumberSnapshot: state.ticket.outboundNumber,
            cabinClassCode: state.ticket.cabinClassCode,
            quotedPrice: {
              amount: state.ticket.amount,
              currencyCode: state.ticket.currencyCode,
            },
          },
          ...(state.tripType === 'ROUND_TRIP'
            ? [
                {
                  serviceClientKey: 'flight',
                  direction: 'RETURN' as const,
                  offerId: state.ticket.returnOfferId,
                  originId: state.destinationId,
                  destinationId: state.originId,
                  departureAt: utc(state.ticket.returnDepartureAt),
                  arrivalAt: utc(state.ticket.returnArrivalAt),
                  carrierNameSnapshot: state.ticket.carrier,
                  serviceNumberSnapshot: state.ticket.returnNumber,
                  cabinClassCode: state.ticket.cabinClassCode,
                  quotedPrice: {
                    amount: state.ticket.amount,
                    currencyCode: state.ticket.currencyCode,
                  },
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
    departureDate: state.departureDate,
    returnNotBefore: state.tripType === 'ROUND_TRIP' ? state.returnDate : null,
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
