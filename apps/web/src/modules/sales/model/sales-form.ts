import { enforceSalesHotelCapacity } from '@nora/contracts';
import { withCompositeGuests } from './composite-guests';
import {
  salesHotelGuestAges,
  type SalesPassengerAgeCategory,
} from '@nora/contracts';
import {
  usesRoomDrivenGuests,
  passengerHotelStay,
  passengerHotelStayError,
} from './contract-guest-stays';
import { defaultSalesRoomCategory } from '@nora/contracts';
import {
  PASSENGER_DEDUCTIONS,
  readPassengerDeductions,
  passengerNetPrices,
  type PassengerDeductions,
} from '@nora/contracts';
import { syncHotelChildSelections } from './hotel-child-selection';
import {
  readAgencyCommission,
  AGENCY_COMMISSION,
  type AgencyCommissionV1,
} from '@nora/contracts';
import { flightRoomTotals } from '@nora/contracts';
import { PASSENGER_FLIGHT_PRICES } from '@nora/contracts';
import { salesHotelRoomSummary } from '@nora/contracts';
import { salesRoomPartyError, roomAgreedTotals } from './sales-room-prices';
import type { SalesHotelRoomV1 } from '@nora/contracts';
import { validSalesHotelRooms } from '@nora/contracts';
import { passengerSaleTotals } from './passenger-sale-totals';
import { passengerTotalEntries } from './passenger-total-entry';
import {
  PASSENGER_TOTAL_PRICES,
  readPassengerTotalPrices,
} from '@nora/contracts';
import { salesChequeComponents } from '@nora/contracts';
import type { SalesPaymentTerms } from '@nora/contracts';
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
  moneyDecimal,
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
  'مسیر، خدمات و مسافران',
  'قیمت و پرداخت',
  'بازبینی',
] as const;

export const salesAdditionalServices = {
  CITY_TOUR: 'گشت شهری',
  TOUR_GUIDE: 'راهنما',
} as const;

export interface SalesFormState {
  legacyContract?: boolean;
  legacyDeductions?: { discount?: SalesMoney; commission?: SalesMoney };
  additionalServices?: (keyof typeof salesAdditionalServices)[];
  roomDrivenGuests?: boolean;
  flightOnlyPassengers?: { key: string; age: number }[];
  passengerHotelStays?: Record<
    string,
    { different: boolean; checkIn: string; checkOut: string }
  >;

  passengerDeductions?: PassengerDeductions;
  passengerFlightDirections?: Record<string, SalesTicketDirection[]>;
  passengerTransferDirections?: Record<string, SalesTicketDirection[]>;
  passengerHotelPrices?: Record<string, SalesMoney[]>;
  hotelArrivesNextDay?: boolean;
  visaComposition?: { adults: number; children: number };
  visaChildAges?: (number | null)[];
  visaApplicantIds?: string[];
  childAges?: (number | null)[];
  infantAges?: (number | null)[];
  priceEntryMode?: 'PASSENGER_TOTAL' | 'CONTRACT_TOTAL';
  contractPrices?: SalesMoney[];
  insuranceExtraToman?: Record<string, string>;
  publishedPackageHotelIds?: string[] | undefined;
  packageSaleAvailable?: boolean | undefined;
  packageSaleQuote?:
    | {
        tourDepartureId: string;
        selectionKey: string;
        items: {
          publicationId: string;
          roomCode: string;
          prices?: SalesMoney[];
        }[];
        prices: SalesMoney[];
      }
    | undefined;
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
  flightCalendarSystems?: Partial<
    Record<'OUTBOUND' | 'RETURN', 'persian' | 'gregorian'>
  >;
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
  hotelChildAssignments?: Record<string, (string | null)[]> | undefined;
  hotel: {
    multiHotel?: boolean;
    cityId?: string;
    additionalStays?: Array<{
      rooms?: Array<
        Omit<
          Pick<
            SalesHotelRoomV1,
            | 'ordinal'
            | 'roomTypeId'
            | 'roomTypeNameSnapshot'
            | 'adults'
            | 'childAges'
            | 'roomCategory'
          >,
          'childAges'
        > & { childAges: (number | null)[] }
      >;
      hotelId: string;
      hotelNameSnapshot: string;
      cityId: string;
      checkInDate: string;
      checkOutDate: string;
    }>;
    rooms?: Array<
      Omit<SalesHotelRoomV1, 'childAges'> & { childAges: (number | null)[] }
    >;
    /** Presentation only; actual dates remain ISO. */
    calendarSystem?: 'persian' | 'gregorian';
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
    guestCustomerIds?: string[] | undefined;
  };
  visaReferenceId: string;
  passengers: Array<{
    customerId: string;
    displayName: string;
    birthDate: string;
    ageCategory?: SalesPassengerAgeCategory;
  }>;
  priceComponents: SalesPriceComponentInput[];
  payments: SalesPaymentInput[];
  pricingNotes: string;
  paymentTerms?: SalesPaymentTerms | null;
  reservationNote?: string;
  contractNotice?: string;
  passengerPrices?: Record<string, SalesMoney[]>;
  passengerTotalPricing?: boolean;
  agencyCommission?: AgencyCommissionV1;
  passengerFlightPrices?: Record<string, SalesMoney[]>;
  automaticComponentPricing?: boolean;
  passengerAccommodations?: Record<string, SalesAccommodationKind>;
}

export interface ContractFlightDraft {
  confirmation?: 'saved' | 'invalid' | undefined;
  departureAt: string;
  arrivalAt: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: 'ECONOMY' | 'BUSINESS' | 'FIRST';
}

/** Foreign room shares are a presentation of the hotel price, never a second flight charge. */
export function passengerFlightSalePrices(
  state: SalesFormState,
): Record<string, SalesMoney[]> {
  return Object.fromEntries(
    state.passengers
      .filter((p) => salesPassengerFlightDirections(state, p.customerId).length)
      .map((p) => [
        p.customerId,
        (state.passengerFlightPrices?.[p.customerId] ?? []).filter(
          (price) =>
            state.passengerHotelPrices !== undefined ||
            !state.serviceKinds.includes('HOTEL') ||
            price.currencyCode === 'IRR',
        ),
      ]),
  );
}

export function salesPassengerDeductions(
  state: SalesFormState,
): PassengerDeductions {
  const values = Object.fromEntries(
    state.passengers.flatMap((p) => {
      if (
        !state.passengerTotalPricing &&
        !salesPassengerFlightDirections(state, p.customerId).length &&
        !(
          state.serviceKinds.includes('HOTEL') &&
          salesHotelGuestIds(state).includes(p.customerId)
        )
      )
        return [];
      const rows = Object.fromEntries(
        Object.entries(state.passengerDeductions?.[p.customerId] ?? {}).filter(
          ([, price]) => price?.amount.trim(),
        ),
      );
      return Object.keys(rows).length ? [[p.customerId, rows]] : [];
    }),
  );
  return readPassengerDeductions(
    [{ metadata: { [PASSENGER_DEDUCTIONS]: JSON.stringify(values) } }],
    state.passengers,
  );
}

export function salesNetServicePrices(state: SalesFormState) {
  if (state.passengerTotalPricing)
    return passengerNetPrices(
      passengerTotalEntries(state),
      salesPassengerDeductions(state),
    );
  const flight = passengerFlightSalePrices(state);
  const guests = new Set(salesHotelGuestIds(state));
  return passengerNetPrices(
    Object.fromEntries(
      state.passengers.map((p) => [
        p.customerId,
        [
          ...(flight[p.customerId] ?? []),
          ...(state.serviceKinds.includes('HOTEL') && guests.has(p.customerId)
            ? (state.passengerHotelPrices?.[p.customerId] ?? [])
            : []),
        ],
      ]),
    ),
    salesPassengerDeductions(state),
  );
}

export function contractSaleComponents(
  state: SalesFormState,
  extras: readonly { customerId: string }[] = [],
): SalesPriceComponentInput[] {
  if (state.passengerTotalPricing) {
    const gross = passengerTotalEntries(state);
    passengerSaleTotals(state.passengers, gross);
    const net = salesNetServicePrices(state);
    return passengerSaleTotals(
      state.passengers,
      Object.fromEntries(
        state.passengers.map((p) => [
          p.customerId,
          extras.some((e) => e.customerId === p.customerId)
            ? addInsuranceExtra(
                net[p.customerId] ?? [],
                state.insuranceExtraToman![p.customerId]!,
              )
            : (net[p.customerId] ?? []),
        ]),
      ),
    ).components;
  }
  if (state.tour && state.packageSaleAvailable && !state.packageSaleQuote)
    throw Error('برای ترکیب انتخاب‌شده قیمت منتشرشده موجود نیست.');
  const automatic =
    (!state.packageSaleQuote || state.passengerHotelPrices !== undefined) &&
    state.automaticComponentPricing &&
    state.serviceKinds.some((k) => k === 'FLIGHT' || k === 'HOTEL');
  if (
    automatic &&
    state.passengerHotelPrices === undefined &&
    state.serviceKinds.includes('HOTEL') &&
    state.hotel.rooms?.some((r) => !r.agreedPrice?.amount.trim())
  )
    throw Error('قیمت هر اتاق را وارد کنید.');
  const prices = automatic
    ? flightRoomTotals(
        {
          ...passengerFlightSalePrices(state),
          ...Object.fromEntries(
            Object.entries(
              state.serviceKinds.includes('HOTEL')
                ? (state.passengerHotelPrices ?? {})
                : {},
            )
              .filter(([id]) => salesHotelGuestIds(state).includes(id))
              .map(([id, p]) => ['hotel-' + id, p]),
          ),
        },
        state.passengerHotelPrices === undefined &&
          state.serviceKinds.includes('HOTEL')
          ? (state.hotel.rooms ?? [])
          : [],
      )
    : (state.contractPrices ?? []);
  if (!prices.length) throw new Error('مبلغ کل قرارداد را وارد کنید.');
  const totals = new Map<string, bigint>();
  for (const price of prices) {
    if (
      !/^[A-Z]{3}$/.test(price.currencyCode) ||
      totals.has(price.currencyCode)
    )
      throw new Error('ارز مبلغ قرارداد باید معتبر و یکتا باشد.');
    totals.set(price.currencyCode, moneyUnits(price.amount));
  }
  if (
    state.passengerHotelPrices === undefined &&
    state.serviceKinds.includes('HOTEL')
  )
    for (const price of roomAgreedTotals(state.hotel.rooms))
      if (moneyUnits(price.amount) > (totals.get(price.currencyCode) ?? 0n))
        throw new Error(
          'جمع مبالغ اتاق‌ها نباید از مبلغ کل قرارداد در همان ارز بیشتر باشد.',
        );
  for (const person of extras)
    totals.set(
      'IRR',
      (totals.get('IRR') ?? 0n) +
        moneyUnits(
          insuranceExtraRials(state.insuranceExtraToman![person.customerId]!),
        ),
    );
  const reference = new Map(
    (state.packageSaleQuote?.prices ?? []).map((p) => [
      p.currencyCode,
      moneyUnits(p.amount),
    ]),
  );
  for (const person of extras)
    reference.set(
      'IRR',
      (reference.get('IRR') ?? 0n) +
        moneyUnits(
          insuranceExtraRials(state.insuranceExtraToman![person.customerId]!),
        ),
    );
  const components = [...totals]
    .filter(([, value]) => value > 0n)
    .flatMap(([currencyCode, value]): SalesPriceComponentInput[] => {
      const base = reference.get(currencyCode) ?? value;
      if (base <= value)
        return [
          {
            type: 'BASE',
            title: 'مبلغ کل قرارداد',
            currencyCode,
            amount: moneyDecimal(value),
          },
        ];
      return [
        {
          type: 'BASE',
          title: 'قیمت منتشرشده پکیج',
          currencyCode,
          amount: moneyDecimal(base),
        },
        {
          type: 'DISCOUNT',
          title: 'تخفیف فروشنده',
          currencyCode,
          amount: moneyDecimal(base - value),
        },
      ];
    });
  const deductions = salesPassengerDeductions(state);
  if (Object.keys(deductions).length) salesNetServicePrices(state);
  return [
    ...components,
    ...Object.values(deductions).flatMap((row) =>
      Object.entries(row)
        .filter(([, p]) => moneyUnits(p!.amount) > 0n)
        .map(([kind, p]) => ({
          type: 'DISCOUNT' as const,
          title: kind === 'discount' ? 'تخفیف مسافر' : 'کمیسیون مسافر',
          currencyCode: p!.currencyCode,
          amount: p!.amount,
        })),
    ),
  ];
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

/** Readiness is derived from selected snapshots, not transient search UI state. */
export function salesSelectedFlightsReady(state: SalesFormState): boolean {
  return salesFlightsValid(state);
}

export function salesReturnRequiresInventory(state: SalesFormState): boolean {
  return (
    state.tripType === 'ROUND_TRIP' &&
    salesFlightSelection(state, 'OUTBOUND')?.source === 'CATALOG'
  );
}

export function salesFlightsValid(state: SalesFormState): boolean {
  if (salesReturnRequiresInventory(state) && state.contractFlights?.RETURN)
    return false;
  const directions = salesDirections(state, 'FLIGHT').filter(
    (d) =>
      !state.passengers.length ||
      state.passengers.some((p) =>
        salesPassengerFlightDirections(state, p.customerId).includes(d),
      ),
  );
  if (
    directions.some((direction) => {
      const flight = salesFlightSelection(state, direction);
      if (!flight) return true;
      return (
        flight.source === 'CATALOG' &&
        !salesOfferHasCapacity(
          direction === 'OUTBOUND' ? state.outboundOffer : state.returnOffer,
          salesFlightSeats(state, direction),
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
  paymentTerms: { version: 1, mode: 'CASH', plans: [] },
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
  if (!enforceSalesHotelCapacity()) return null;
  state = syncHotelChildSelections(state, salesTravelDate(state));
  if (!state.serviceKinds.includes('HOTEL')) return null;
  if (state.hotel.rooms?.length) {
    for (const r of state.hotel.rooms) {
      const rate = roomRates.find((v) => v.roomTypeId === r.roomTypeId);
      if (r.childAges.some((a) => a === null))
        return 'سن کودکان هر اتاق را تکمیل کنید.';
      // A dated tariff is optional for a manually negotiated room price.
      if (!rate) continue;
      if (
        rate.occupancyRates
          ? !quoteHotelOccupancy(rate.occupancyRates, {
              adults: r.adults,
              childAges: r.childAges as number[],
              rooms: 1,
              checkIn: state.hotel.checkIn,
              checkOut: state.hotel.checkOut,
            })
          : r.adults > rate.maxAdults ||
            r.childAges.filter((a) => a !== null && a < 2).length >
              (rate.maxInfants ?? 0) ||
            r.childAges.filter((a) => a !== null && a >= 2 && a < 6).length >
              (rate.maxChildren2To6 ?? rate.maxChildren) ||
            r.childAges.filter((a) => a !== null && a >= 6).length >
              (rate.maxChildren6To12 ?? 0)
      )
        return 'ظرفیت یا نرخ یکی از اتاق‌ها با ترکیب مهمانان هماهنگ نیست.';
    }
    if (state.passengers.length) {
      const ids = new Set(salesHotelGuestIds(state));

      const expected = state.hotel.rooms
        .flatMap((r) => [...Array(r.adults).fill(15), ...r.childAges])
        .sort((a, b) => (a ?? -1) - (b ?? -1));
      const actual = salesHotelGuestAges(
        state.passengers.filter((p) => ids.has(p.customerId)),
        state.hotel.checkIn,
        expected,
      )?.sort((a, b) => a - b);
      if (
        !actual ||
        actual.length !== expected.length ||
        actual.some((a, i) => a !== expected[i])
      )
        return 'تعداد و سن مهمانان انتخاب‌شده را با ترکیب اتاق‌ها هماهنگ کنید.';
    }
    return null;
  }
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
  rates: readonly HotelRoomRateV1[] = [room],
) {
  if (state.hotel.rooms?.length) {
    const quotes = state.hotel.rooms.map((r) => {
      const rate = rates.find((v) => v.roomTypeId === r.roomTypeId);
      return rate?.occupancyRates && r.childAges.every((a) => a !== null)
        ? quoteHotelOccupancy(rate.occupancyRates, {
            priceBasis: 'SALE',
            adults: r.adults,
            childAges: r.childAges as number[],
            rooms: 1,
            checkIn: state.hotel.checkIn,
            checkOut: state.hotel.checkOut,
          })
        : null;
    });
    const first = quotes[0];
    return first &&
      quotes.every((q) => q && q.currencyCode === first.currencyCode)
      ? {
          currencyCode: first.currencyCode,
          amount: moneyDecimal(
            quotes.reduce((n, q) => n + moneyUnits(q!.amount), 0n),
          ),
        }
      : null;
  }
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
    priceBasis: 'SALE',
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
  rates: readonly HotelRoomRateV1[] = room ? [room] : [],
): SalesFormState {
  if (
    !state.serviceKinds.includes('HOTEL') ||
    !room?.occupancyRates ||
    state.tour
  )
    return state;
  const quote = salesHotelOccupancyQuote(state, room, rates);
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
      passenger.ageCategory,
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
  bookedCategory?: SalesPassengerAgeCategory,
): string {
  if (!birthDate && bookedCategory)
    return { ADT: 'بزرگسال', CHD: 'کودک', INF: 'نوزاد' }[bookedCategory];
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
  bookedCategory?: SalesPassengerAgeCategory,
) {
  const label = salesPassengerAgeLabel(
    birthDate,
    departureDate,
    bookedCategory,
  );
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
          passenger.ageCategory,
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
 * International hotel and flight guests share the same identity fields.
 * Passport document number/expiry remain optional at contract entry.
 */
export function salesRequiresPassportIdentity(state: SalesFormState): boolean {
  if (!state.serviceKinds.some((kind) => kind === 'FLIGHT' || kind === 'HOTEL'))
    return false;
  if (
    !state.originCountryId &&
    !state.destinationCountryId &&
    !state.originCountryCode &&
    !state.destinationCountryCode
  )
    return false;
  return !salesDomesticIranRoute(state);
}

export function salesHotelCalendarSystem(
  state: SalesFormState,
): 'persian' | 'gregorian' {
  return (
    state.hotel.calendarSystem ??
    (salesInternationalTravel(state) ? 'gregorian' : 'persian')
  );
}

export function salesFlightCalendarSystem(
  state: SalesFormState,
  direction: 'OUTBOUND' | 'RETURN',
): 'persian' | 'gregorian' {
  return (
    state.flightCalendarSystems?.[direction] ??
    (salesInternationalTravel(state) ? 'gregorian' : 'persian')
  );
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

export function salesOutboundHotelCheckIn(state: SalesFormState): string {
  if (!salesDirections(state, 'FLIGHT').includes('OUTBOUND')) return '';
  const departureAt = salesFlightSelection(state, 'OUTBOUND')?.departureAt;
  return salesHotelDate(
    departureAt ||
      (state.departureDate
        ? `${state.departureDate}T00:00:00+03:30`
        : undefined),
    0,
  );
}

export function withSalesHotelDates(
  previous: SalesFormState,
  next: SalesFormState,
): SalesFormState {
  const suggestion = (state: SalesFormState, field: 'checkIn' | 'checkOut') => {
    // Flight-linked automatic check-in follows the outbound day, including
    // overnight flights. A package start or a legacy next-day draft flag
    // must not silently add a night; explicit manual dates remain below.
    const flightCheckIn = salesOutboundHotelCheckIn(state);
    if (field === 'checkIn' && flightCheckIn) return flightCheckIn;
    return state.tour && state.packageSaleAvailable
      ? field === 'checkIn'
        ? salesHotelDate(
            state.tour.startsOn + 'T00:00:00+03:30',
            state.hotelArrivesNextDay ? 1 : 0,
          )
        : state.tour.endsOn
      : salesHotelDate(
          salesDirections(state, 'FLIGHT').includes(
            field === 'checkIn' ? 'OUTBOUND' : 'RETURN',
          )
            ? salesFlightSelection(
                state,
                field === 'checkIn' ? 'OUTBOUND' : 'RETURN',
              )?.departureAt ||
                ((field === 'checkIn' ? state.departureDate : state.returnDate)
                  ? `${field === 'checkIn' ? state.departureDate : state.returnDate}T00:00:00+03:30`
                  : undefined)
            : undefined,
          field === 'checkIn' ? (state.hotelArrivesNextDay ? 1 : 0) : -1,
        );
  };
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
  state = withCompositeGuests(state);
  if (state.hotel.multiHotel && !state.hotel.additionalStays?.length)
    return false;
  let previousOut = state.hotel.checkOut;
  const stayIds = new Set([state.hotel.hotelId]);
  for (const stay of state.hotel.additionalStays ?? []) {
    if (
      !stay.hotelId ||
      !stay.cityId ||
      stayIds.has(stay.hotelId) ||
      !stay.checkInDate ||
      !stay.checkOutDate ||
      stay.checkOutDate <= stay.checkInDate ||
      stay.checkInDate < previousOut
    )
      return false;
    if (
      stay.rooms !== undefined &&
      (!stay.rooms.length ||
        stay.rooms.length > 50 ||
        stay.rooms.some(
          (room, index) =>
            room.ordinal !== index + 1 ||
            !room.roomTypeId ||
            !room.roomTypeNameSnapshot ||
            !Number.isInteger(room.adults) ||
            room.adults < 1 ||
            room.adults > 20 ||
            room.childAges.length > 20 ||
            room.childAges.some(
              (age) =>
                age === null || !Number.isInteger(age) || age < 0 || age > 14,
            ),
        ) ||
        stay.rooms.reduce(
          (n, room) => n + room.adults + room.childAges.length,
          0,
        ) > state.hotel.occupancy)
    )
      return false;
    previousOut = stay.checkOutDate;
    stayIds.add(stay.hotelId);
  }
  if ((state.hotel.additionalStays?.length ?? 0) > 49) return false;
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
          passengerFlightDirections: {},
          passengerFlightPrices: {},
          ticket: { ...state.ticket, outboundOfferId: '', returnOfferId: '' },
        }
      : { passengerTransferDirections: {} }),
  };
}

export function salesReturnSearchFrom(state: SalesFormState): string {
  return (
    salesFlightSelection(state, 'OUTBOUND')?.departureAt.slice(0, 10) ||
    state.departureDate
  );
}

/** These services have no flight/hotel/tour date editor of their own. */
export function salesStandaloneDateServiceKeys(
  state: SalesFormState,
): string[] {
  if (state.serviceKinds.some((k) => ['FLIGHT', 'HOTEL', 'TOUR'].includes(k)))
    return [];
  return state.serviceKinds.flatMap((kind) =>
    kind === 'TRANSFER'
      ? salesDirections(state, kind).map((direction) => `${kind}-${direction}`)
      : [kind],
  );
}
export function salesStandaloneServiceDatesValid(
  state: SalesFormState,
): boolean {
  return salesStandaloneDateServiceKeys(state).every((key) => {
    const date = state.serviceDetails?.[key]?.date ?? '';
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date
    );
  });
}

export function salesTravelDate(state: SalesFormState): string {
  return (
    salesFlightSelection(state, 'OUTBOUND')?.departureAt.slice(0, 10) ||
    salesFlightSelection(state, 'RETURN')?.departureAt.slice(0, 10) ||
    (state.serviceKinds.includes('HOTEL') ? state.hotel.checkIn : '') ||
    state.tour?.startsOn ||
    salesStandaloneDateServiceKeys(state)
      .map((key) => state.serviceDetails?.[key]?.date ?? '')
      .filter(Boolean)
      .sort()[0] ||
    state.departureDate
  );
}

export function legacySalesPricingServices(
  state: SalesFormState,
): SalesServiceInput[] {
  return [
    ...state.serviceKinds.flatMap((kind): SalesServiceInput[] =>
      kind === 'FLIGHT' || kind === 'TRANSFER'
        ? salesDirections(state, kind).map((direction) => ({
            clientKey: `${kind.toLowerCase()}-${direction.toLowerCase()}`,
            kind,
            titleSnapshot: `${kind === 'FLIGHT' ? 'بلیط' : 'ترانسفر'} ${direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}`,
          }))
        : [{ clientKey: kind.toLowerCase(), kind, titleSnapshot: kind }],
    ),
    ...(state.additionalServices ?? []).map((role): SalesServiceInput => ({
      clientKey: role === 'CITY_TOUR' ? 'city-tour' : 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: salesAdditionalServices[role],
    })),
  ];
}

/** Historical prices belong to the customer contract, never to individual services. */
export function legacyContractPriceComponents(
  state: SalesFormState,
): SalesPriceComponentInput[] {
  const totals = new Map<string, bigint>();
  const components: SalesPriceComponentInput[] = [];
  for (const price of state.contractPrices ?? []) {
    if (!price.amount.trim()) continue;
    if (
      !/^[A-Z]{3}$/.test(price.currencyCode) ||
      totals.has(price.currencyCode)
    )
      throw Error('ارز مبلغ قرارداد باید معتبر و یکتا باشد.');
    const amount = moneyUnits(price.amount);
    totals.set(price.currencyCode, amount);
    if (amount > 0n)
      components.push({ ...price, type: 'BASE', title: 'مبلغ کل قرارداد' });
  }
  if (!components.length) throw Error('مبلغ کل قرارداد را وارد کنید.');
  for (const kind of ['discount', 'commission'] as const) {
    const price = state.legacyDeductions?.[kind];
    if (!price?.amount.trim()) continue;
    const amount = moneyUnits(price.amount);
    if (
      !/^[A-Z]{3}$/.test(price.currencyCode) ||
      amount > (totals.get(price.currencyCode) ?? 0n)
    )
      throw Error(
        'تخفیف و کمیسیون نباید از مبلغ قرارداد در همان ارز بیشتر باشد.',
      );
    totals.set(
      price.currencyCode,
      (totals.get(price.currencyCode) ?? 0n) - amount,
    );
    if (amount > 0n)
      components.push({
        ...price,
        type: 'DISCOUNT',
        title: kind === 'discount' ? 'تخفیف قرارداد' : 'کمیسیون قرارداد',
      });
  }
  return components;
}

export function salesPayload(
  state: SalesFormState,
  aggregateLegacy = false,
): SalesContractCreateRequest {
  state = withCompositeGuests(state);
  if (state.legacyContract) {
    const plain = {
      ...state,
      legacyContract: false,
      priceEntryMode: 'CONTRACT_TOTAL' as const,
      contractPrices: (state.contractPrices ?? []).filter((p) =>
        p.amount.trim(),
      ),
      servicePricing: {},
      passengers: [],
      passengerTotalPricing: false,
      automaticComponentPricing: false,
      packageSaleQuote: undefined,
      packageSaleAvailable: false,
      passengerDeductions: {},
      passengerPrices: {},
      passengerHotelPrices: {},
      passengerHotelStays: {},
      firstPassengerIsCustomer: false,
    };
    const payload = salesPayload(plain, true);
    const counts = salesPassengerCounts(state);
    const parties = Object.fromEntries(
      payload.services.map((service) => {
        const roomAges = state.hotel.rooms?.flatMap((r) => r.childAges) ?? [];
        const party =
          service.kind === 'HOTEL' && state.hotel.rooms?.length
            ? {
                adults: state.hotel.rooms.reduce((n, r) => n + r.adults, 0),
                children: roomAges.filter((a) => a !== null && a >= 2).length,
                infants: roomAges.filter((a) => a !== null && a < 2).length,
              }
            : service.kind === 'VISA' && state.visaComposition
              ? { ...state.visaComposition, infants: 0 }
              : {
                  adults: counts.adults,
                  children: counts.children,
                  infants: counts.infants,
                };
        return [service.clientKey, party];
      }),
    );
    const services = payload.services.map((s) => ({ ...s }));
    if (services[0])
      services[0] = {
        ...services[0],
        metadata: {
          ...services[0].metadata,
          legacyServicePartiesV2: JSON.stringify(parties),
        },
      };
    if (payload.hotelSelection) {
      const party = parties[payload.hotelSelection.serviceClientKey]!;
      payload.hotelSelection = {
        ...payload.hotelSelection,
        occupancy: party.adults + party.children + party.infants,
      };
    }
    payload.priceComponents = salesChequeComponents(
      legacyContractPriceComponents(state),
      state.paymentTerms,
    );
    return { ...payload, services };
  }
  state = syncHotelChildSelections(state, salesTravelDate(state));
  if (!aggregateLegacy) state = withFirstPassengerCustomer(state);
  const roomPartyError = salesRoomPartyError(state);
  if (roomPartyError) throw new Error(roomPartyError);
  if (
    state.serviceKinds.includes('HOTEL') &&
    !state.passengerTotalPricing &&
    state.priceEntryMode === 'CONTRACT_TOTAL' &&
    state.passengerHotelPrices === undefined &&
    !state.packageSaleQuote &&
    state.hotel.rooms?.some((r) => !r.agreedPrice)
  )
    throw new Error('مبلغ توافق‌شدهٔ همهٔ اتاق‌ها را وارد کنید.');
  if (
    state.serviceKinds.includes('HOTEL') &&
    state.hotel.rooms &&
    !validSalesHotelRooms(
      state.hotel.rooms as SalesHotelRoomV1[],
      state.hotel.rooms.length,
    )
  )
    throw new Error('مشخصات و سن کودکان همهٔ اتاق‌ها را تکمیل کنید.');
  if (
    !aggregateLegacy &&
    state.serviceKinds.includes('VISA') &&
    state.visaComposition
  ) {
    const selected = state.passengers.filter((p) =>
      state.visaApplicantIds?.includes(p.customerId),
    );
    const adults = selected.filter(
      (p) =>
        salesPassengerAgeLabel(
          p.birthDate,
          salesTravelDate(state),
          p.ageCategory,
        ) === 'بزرگسال',
    ).length;
    const children = selected.filter(
      (p) =>
        salesPassengerAgeLabel(
          p.birthDate,
          salesTravelDate(state),
          p.ageCategory,
        ) === 'کودک',
    ).length;
    const wantedAges = [...(state.visaChildAges ?? [])].sort(
      (a, b) => (a ?? -1) - (b ?? -1),
    );
    const actualAges = salesHotelGuestAges(
      selected.filter(
        (p) =>
          salesPassengerAgeLabel(
            p.birthDate,
            salesTravelDate(state),
            p.ageCategory,
          ) === 'کودک',
      ),
      salesTravelDate(state),
      wantedAges,
    )?.sort((a, b) => a - b);
    if (
      wantedAges.length !== children ||
      !actualAges ||
      actualAges.some((a, i) => a !== wantedAges[i])
    )
      throw new Error('سن متقاضیان کودک ویزا با سن‌های واردشده هماهنگ نیست.');
    if (
      adults !== state.visaComposition.adults ||
      children !== state.visaComposition.children ||
      selected.length !== adults + children
    )
      throw new Error(
        'افراد متقاضی ویزا را مطابق تعداد بزرگسال و کودک انتخاب کنید.',
      );
  }
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
                ? {
                    businessOutput: state.businessOutput === true,
                    dateCalendarSystem: salesFlightCalendarSystem(
                      state,
                      direction,
                    ),
                  }
                : {}),
              ...(kind === 'FLIGHT'
                ? state.serviceDetails?.[`${kind}-${direction}`]
                : {}),
              ...(kind === 'TRANSFER'
                ? { passengerCount: salesTransferCount(state, direction) }
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
                metadata: {
                  ...state.serviceDetails?.[kind],
                  ...(kind === 'HOTEL'
                    ? { dateCalendarSystem: salesHotelCalendarSystem(state) }
                    : {}),
                  ...(kind === 'VISA' && state.visaComposition
                    ? {
                        applicantAdults: state.visaComposition.adults,
                        applicantChildren: state.visaComposition.children,
                        applicantChildAges: (state.visaChildAges ?? []).join(
                          ',',
                        ),
                      }
                    : {}),
                },
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
  for (const role of new Set(state.additionalServices ?? [])) {
    services.push({
      clientKey: role === 'CITY_TOUR' ? 'city-tour' : 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: salesAdditionalServices[role],
      metadata: { additionalServiceRole: role },
    });
  }
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
  for (let i = services.length - 1; i >= 0; i--) {
    const service = services[i]!;
    if (
      state.passengers.length > 0 &&
      (service.kind === 'FLIGHT' || service.kind === 'TRANSFER') &&
      !state.passengers.some((p) =>
        (service.kind === 'FLIGHT'
          ? salesPassengerFlightDirections(state, p.customerId)
          : salesPassengerTransferDirections(state, p.customerId)
        ).includes(service.metadata?.direction as SalesTicketDirection),
      )
    )
      services.splice(i, 1);
  }
  const hotelPriceService = services.find((s) => s.kind === 'HOTEL');
  if (hotelPriceService && usesRoomDrivenGuests(state)) {
    const stays = Object.fromEntries(
      salesHotelGuestIds(state).map((id) => {
        const stay = passengerHotelStay(
          true,
          state.hotel,
          state.passengerHotelStays?.[id],
        )!;
        const error = passengerHotelStayError(stay);
        if (error) throw Error(error);
        return [
          id,
          {
            different: stay.different,
            checkInDate: stay.checkIn,
            checkOutDate: stay.checkOut,
          },
        ];
      }),
    );
    hotelPriceService.metadata = {
      ...hotelPriceService.metadata,
      passengerHotelStaysV1: JSON.stringify(stays),
    };
  }
  if (
    hotelPriceService &&
    !state.passengerTotalPricing &&
    state.passengerHotelPrices !== undefined
  )
    hotelPriceService.metadata = {
      ...hotelPriceService.metadata,
      passengerHotelPricesV1: JSON.stringify(
        Object.fromEntries(
          salesHotelGuestIds(state).map((id) => [
            id,
            state.passengerHotelPrices?.[id] ?? [],
          ]),
        ),
      ),
    };
  if (state.packageSaleQuote && services[0])
    services[0].metadata = {
      ...services[0].metadata,
      packagePublishedSale: JSON.stringify(state.packageSaleQuote),
    };
  if (state.servicePricing && !state.priceEntryMode)
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
  if (
    state.customerKind === 'organization' &&
    state.agencyCommission &&
    (state.agencyCommission.adult.trim() ||
      state.agencyCommission.child.trim()) &&
    services[0]
  ) {
    services[0].metadata = {
      ...services[0].metadata,
      [AGENCY_COMMISSION]: JSON.stringify({
        adult: state.agencyCommission.adult.trim() || '0',
        child: state.agencyCommission.child.trim() || '0',
      }),
    };
  }
  readAgencyCommission(services);
  const deductions = salesPassengerDeductions(state);
  if (Object.keys(deductions).length && services[0])
    services[0].metadata = {
      ...services[0].metadata,
      [PASSENGER_DEDUCTIONS]: JSON.stringify(deductions),
    };
  const flightPrices = passengerFlightSalePrices(state);
  const flightPriceService = services.find((s) => s.kind === 'FLIGHT');
  if (
    flightPriceService &&
    !state.passengerTotalPricing &&
    state.passengerFlightPrices !== undefined
  )
    flightPriceService.metadata = {
      ...flightPriceService.metadata,
      [PASSENGER_FLIGHT_PRICES]: JSON.stringify(
        Object.fromEntries(
          state.passengers
            .filter(
              (p) => salesPassengerFlightDirections(state, p.customerId).length,
            )
            .map((p) => [
              p.customerId,
              (flightPrices[p.customerId] ?? []).filter(
                (price) => price.amount.trim() !== '',
              ),
            ]),
        ),
      ),
    };
  if (
    !state.passengerTotalPricing &&
    (!state.packageSaleQuote || state.passengerHotelPrices !== undefined) &&
    state.automaticComponentPricing &&
    services.some((s) => s.kind === 'FLIGHT' || s.kind === 'HOTEL')
  )
    services[0]!.metadata = {
      ...services[0]!.metadata,
      automaticFlightRoomTotalV1: true,
    };
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
  const grossTotalPrices = state.passengerTotalPricing
    ? passengerTotalEntries(state)
    : (state.passengerPrices ?? {});
  if (state.passengerTotalPricing || state.priceEntryMode === 'PASSENGER_TOTAL')
    passengerSaleTotals(state.passengers, grossTotalPrices);
  const totalPrices = state.passengerTotalPricing
    ? salesNetServicePrices(state)
    : grossTotalPrices;
  const packagePrices =
    state.passengerTotalPricing || state.priceEntryMode === 'PASSENGER_TOTAL'
      ? passengerSaleTotals(
          state.passengers,
          Object.fromEntries(
            state.passengers.map((p) => [
              p.customerId,
              extras.some((e) => e.customerId === p.customerId)
                ? addInsuranceExtra(
                    totalPrices[p.customerId] ?? [],
                    state.insuranceExtraToman![p.customerId]!,
                  )
                : (totalPrices[p.customerId] ?? []),
            ]),
          ),
        )
      : undefined;
  if (packagePrices)
    for (const service of services) {
      if (service.metadata?.insuranceAgeSurcharge !== true)
        delete service.pricing;
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
  if (state.passengerTotalPricing && services[0]) {
    services[0].metadata = {
      ...services[0].metadata,
      [PASSENGER_TOTAL_PRICES]: JSON.stringify(grossTotalPrices),
    };
    readPassengerTotalPrices(services, state.passengers);
  }
  if (!state.passengerTotalPricing && state.priceEntryMode === 'CONTRACT_TOTAL')
    for (const service of services) {
      if (service.metadata?.insuranceAgeSurcharge !== true)
        delete service.pricing;
      service.metadata = {
        ...Object.fromEntries(
          Object.entries(service.metadata ?? {}).filter(
            ([key]) =>
              ![
                'passengerPackagePricingVersion',
                'includedWithoutCharge',
              ].includes(key),
          ),
        ),
        contractPackagePricingVersion: 1,
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
      index === 0 &&
      (state.reservationNote?.trim() || state.contractNotice?.trim())
        ? {
            ...service,
            metadata: {
              ...service.metadata,
              ...(state.reservationNote?.trim()
                ? { reservationNote: state.reservationNote.trim() }
                : {}),
              ...(state.contractNotice?.trim()
                ? { contractNotice: state.contractNotice.trim() }
                : {}),
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
      ...((state.passengerTotalPricing || state.passengerPrices) &&
      (state.passengerTotalPricing || state.priceEntryMode !== 'CONTRACT_TOTAL')
        ? {
            agreedPrices: packagePrices
              ? packagePrices.prices[item.customerId]
              : extras.some((p) => p.customerId === item.customerId)
                ? addInsuranceExtra(
                    state.passengerPrices?.[item.customerId] ?? [],
                    state.insuranceExtraToman![item.customerId]!,
                  )
                : (state.passengerPrices?.[item.customerId] ?? []),
          }
        : {}),
      birthDate: item.birthDate,
      ...(!item.birthDate && item.ageCategory
        ? { ageCategory: item.ageCategory }
        : {}),
      serviceClientKeys: services
        .filter(({ clientKey, metadata }) =>
          metadata?.insuranceAgeSurcharge === true
            ? metadata.passengerId === item.customerId
            : clientKey === 'visa' && state.visaComposition
              ? Boolean(state.visaApplicantIds?.includes(item.customerId))
              : clientKey === 'flight-outbound' || clientKey === 'flight-return'
                ? salesPassengerFlightDirections(
                    state,
                    item.customerId,
                  ).includes(
                    clientKey === 'flight-outbound' ? 'OUTBOUND' : 'RETURN',
                  )
                : clientKey === 'transfer-outbound' ||
                    clientKey === 'transfer-return'
                  ? salesPassengerTransferDirections(
                      state,
                      item.customerId,
                    ).includes(
                      clientKey === 'transfer-outbound' ? 'OUTBOUND' : 'RETURN',
                    )
                  : clientKey !== 'hotel' ||
                    salesHotelGuestIds(state).includes(item.customerId),
        )
        .map(({ clientKey }) => clientKey),
    })),
    ticketSelections: ticketSelections.filter((t) =>
      services.some((s) => s.clientKey === t.serviceClientKey),
    ),
    hotelSelection:
      state.serviceKinds.includes('HOTEL') && state.hotel.hotelId
        ? {
            serviceClientKey: 'hotel',
            hotelId: state.hotel.hotelId,
            hotelNameSnapshot: state.hotel.name,
            cityId: state.hotel.cityId || state.destinationId,
            ...(state.hotel.additionalStays?.length
              ? {
                  additionalStays: state.hotel.additionalStays.map((stay) => {
                    const { rooms, ...details } = stay;
                    return {
                      ...details,
                      ...(rooms
                        ? {
                            rooms: rooms.map((room) => ({
                              ...room,
                              roomCategory: defaultSalesRoomCategory(room),
                              childAges: room.childAges as number[],
                            })),
                          }
                        : {}),
                    };
                  }),
                }
              : {}),
            checkInDate: state.hotel.checkIn,
            checkOutDate: state.hotel.checkOut,
            roomCount: state.hotel.rooms?.length ?? state.hotel.roomCount,
            ...(state.hotel.rooms
              ? {
                  rooms: state.hotel.rooms.map((room) => {
                    const { agreedPrice, ...rest } = room;
                    return {
                      ...rest,
                      roomCategory: defaultSalesRoomCategory(room),
                      ...(!state.passengerTotalPricing &&
                      state.passengerHotelPrices === undefined &&
                      agreedPrice
                        ? { agreedPrice }
                        : {}),
                    };
                  }) as SalesHotelRoomV1[],
                }
              : {}),
            singleRoomCount: state.hotel.singleRoomCount,
            doubleRoomCount: state.hotel.doubleRoomCount,
            extraBedCount: state.hotel.extraBedCount,
            ...(state.hotel.rooms?.length
              ? salesHotelRoomSummary(
                  state.hotel.rooms.map((room) => ({
                    ...room,
                    roomCategory: defaultSalesRoomCategory(room),
                  })),
                )
              : {}),
            roomTypeId:
              state.hotel.rooms?.[0]?.roomTypeId || state.hotel.roomTypeId,
            occupancy: salesHotelGuestIds(state).length,
            inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
          }
        : null,
    ...(state.paymentTerms !== undefined
      ? { paymentTerms: state.paymentTerms }
      : {}),
    priceComponents: salesChequeComponents(
      (state.priceEntryMode === 'CONTRACT_TOTAL'
        ? contractSaleComponents(state, extras)
        : packagePrices?.components) ??
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
      state.paymentTerms,
    ),
    payments: state.payments.map((payment) => ({
      ...payment,
      dueAt: utc(payment.dueAt),
    })),
    pricingNotes: state.pricingNotes || null,
  };
}

/** Transfer legs are independent of flight membership and hotel date overrides. */
export function salesPassengerTransferDirections(
  state: SalesFormState,
  id: string,
): SalesTicketDirection[] {
  if (!state.serviceKinds.includes('TRANSFER')) return [];
  const enabled = salesDirections(state, 'TRANSFER');
  return enabled.filter((direction) =>
    (state.passengerTransferDirections?.[id] ?? enabled).includes(direction),
  );
}

export function salesTransferCount(
  state: SalesFormState,
  direction?: SalesTicketDirection,
) {
  if (!state.serviceKinds.includes('TRANSFER')) return 0;
  if (!state.passengers.length) {
    const counts = salesPassengerCounts(state);
    return counts.adults + counts.children;
  }
  return state.passengers.filter((p) => {
    const directions = salesPassengerTransferDirections(state, p.customerId);
    return (
      (direction ? directions.includes(direction) : directions.length > 0) &&
      salesPassengerAgeLabel(
        p.birthDate,
        salesTravelDate(state),
        p.ageCategory,
      ) !== 'نوزاد'
    );
  }).length;
}

/** Missing direction choices retain legacy all-selected behavior. */
export function salesPassengerFlightDirections(
  state: SalesFormState,
  id: string,
): SalesTicketDirection[] {
  if (!state.serviceKinds.includes('FLIGHT')) return [];
  const enabled = salesDirections(state, 'FLIGHT');
  return (state.passengerFlightDirections?.[id] ?? enabled).filter((d) =>
    enabled.includes(d),
  );
}

export function salesFlightSeats(
  state: SalesFormState,
  direction: SalesTicketDirection,
): number {
  if (!state.passengers.length) return salesPassengerCounts(state).seated;
  return state.passengers.filter(
    (p) =>
      salesPassengerFlightDirections(state, p.customerId).includes(direction) &&
      salesPassengerAgeLabel(
        p.birthDate,
        salesTravelDate(state),
        p.ageCategory,
      ) !== 'نوزاد',
  ).length;
}
