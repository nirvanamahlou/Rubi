'use client';
import { ContractHotelPicker } from './contract-hotel-picker';
import serviceStyles from './contract-service-cards.module.css';
import { withAutomaticReturn } from '../model/automatic-return';
import { LegacyContractPrices } from './legacy-contract-prices';
import {
  Plane,
  Building2,
  CarFront,
  UsersRound,
  ShieldCheck,
  MapPinned,
  Armchair,
  BusFront,
  TrainFront,
  Ellipsis,
  BookOpen,
} from 'lucide-react';
import { restoreContractDraft } from '../model/restore-contract-draft';
import { useAccessActor } from '@/modules/iam/access-context';
import { contractDraftScope } from '../model/contract-draft-scope';
import { documentsApi } from '@/modules/documents/api/client';
import { createdPaymentIds } from '../model/creation-payment-receipts';
import {
  paymentEvidenceForm,
  validatePaymentEvidenceFile,
} from '../model/payment-evidence';
import { PaymentDocuments } from './payment-documents';
import type { SalesContractDetail } from '@nora/contracts';
import type { TicketOfferV1 } from '@nora/contracts';
import { PublishedPackageSale } from './published-package-sale';
import { readPassengerHotelPrices } from '@nora/contracts';
import { syncHotelChildSelections } from '../model/hotel-child-selection';

import { PassengerServicePrices } from './passenger-service-prices';
import { validatePassengerFlightPrices } from '@nora/contracts';
import {
  salesRoomPartyError,
  withRoomPriceTotals,
} from '../model/sales-room-prices';
import {
  usesRoomDrivenGuests,
  withRoomDrivenGuests,
} from '../model/contract-guest-stays';
import { ServiceParties } from './service-parties';
import { HotelStayDates } from './hotel-stay-dates';
import { AdditionalHotelStays } from './additional-hotel-stays';
import { salesPassengerStepError } from '../model/sales-passenger-step';

import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { currencySymbol } from '@/lib/currency-symbol';
import { HotelRoomCapacity } from './hotel-room-capacity';
import { salesHotelRoomOptions } from '../model/sales-hotel-room-options';
import {
  isTicketOnlyContract,
  ticketOnlySaleDefaults,
} from '../model/ticket-only-sale-defaults';
import { FlightTripDates } from './flight-trip-dates';
import {
  pairedReturnOffer,
  flightDay,
  exactFlightQuery,
} from '../model/exact-flight-dates';
import {
  salesFlightRangeReady,
  salesFlightToday,
  resetSalesTicketRange,
} from '../model/sales-flight-range';
import { moneyDecimal, moneyUnits, passengerOverSixty } from '@nora/contracts';
import { PassengerCountField } from './passenger-count-field';
import { PassengerAgeField } from './passenger-age-field';
import { ContractOutputButton } from './contract-output';
import { ContractReviewPreview } from './contract-review-preview';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from '@/i18n/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { HotelRoomRateV1, SalesServiceKind } from '@nora/contracts';

import { validateSalesCurrencySelection } from './sales-currency-select';
import {
  SALES_CHEQUE_FEE,
  validatePassengerPackagePrices,
  validateSalesChequePayments,
} from '@nora/contracts';
import { SalesChequeCalculator } from './sales-cheque-calculator';
import { ContractTotalPrices } from './contract-total-prices';
import { ContractServiceSummary } from './contract-service-summary';
import { SalesDatePicker } from './sales-date-picker';
import { salesFlightCalendarSystem } from '../model/sales-form';
import { SalesPaymentPlan } from './sales-payment-plan';
import { Button, buttonVariants } from '@/components/ui/button';

import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import {
  loadSalesReferences,
  type SalesReferences,
} from '../api/reference-refresh';
import { salesApi } from '../api/client';
import {
  prepareTicketSearch,
  type PreparedTicketSearch,
} from '../api/ticket-search';
import { TicketOfferPicker } from './ticket-offer-picker';
import { ContractFlightEditor } from './contract-flight-editor';
import {
  salesReferenceDisplayName,
  SearchableReference,
} from './searchable-reference';
import { SalesInsurancePicker } from './sales-insurance-picker';
import { SalesTourPicker } from './sales-tour-picker';
import {
  repriceStandaloneTicketSelections,
  roundTripTicketPricing,
  standaloneTicketPricing,
} from '../model/standalone-ticket-pricing';

import { SalesPeopleSheet } from './sales-people-sheet';
import {
  passengerSlotKeys,
  type SalesPeopleDraft,
} from '../model/sales-people-sheet';
import { type FlightDateRange } from './flight-date-range';
import {
  emptySalesForm,
  salesInternationalTravel,
  salesFlightSelection,
  salesReturnRequiresInventory,
  salesFlightsValid,
  salesSelectedFlightsReady,
  patchContractFlight,
  salesPayload,
  salesAdditionalServices,
  salesSteps,
  salesFlightSeats,
  salesPassengerAgeLabel,
  salesPassengerCounts,
  salesHotelGuestIds,
  salesHotelCapacityError,
  salesHotelOccupancyQuote,
  hotelOccupancySaleDefaults,
  salesOfferHasCapacity,
  salesDirections,
  salesTravelDate,
  salesStandaloneDateServiceKeys,
  salesStandaloneServiceDatesValid,
  withSalesHotelDates,
  withFirstPassengerCustomer,
  salesHotelValid,
  salesDetailSteps,
  withSalesRouteDefaults,
  toggleSalesDirectionalService,
  type SalesFormState,
} from '../model/sales-form';

const serviceOptions: readonly [SalesServiceKind, string][] = [
  ['FLIGHT', 'بلیط پرواز'],
  ['HOTEL', 'هتل'],
  ['VISA', 'ویزا'],
  ['INSURANCE', 'بیمه'],
  ['TRANSFER', 'ترانسفر'],
  ['TOUR', 'تور'],
  ['BUS', 'اتوبوس'],
  ['TRAIN', 'قطار'],
  ['CIP', 'CIP'],
  ['OTHER', 'سایر'],
];
const ReferenceSelect = SearchableReference;

function HotelCountField({
  label,
  hint,
  unit,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  hint: string;
  unit: 'باب' | 'نفر';
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 rounded-xl border border-border bg-surface p-3">
      <span className="font-bold">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="flex items-center overflow-hidden rounded-xl border border-input bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
        <Input
          className="h-11 flex-1 border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
          type="number"
          inputMode="numeric"
          min={min}
          max={999}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(
              Number.isFinite(parsed)
                ? Math.min(999, Math.max(min, Math.trunc(parsed)))
                : min,
            );
          }}
        />
        <span className="border-r border-border px-3 text-sm font-bold text-muted-foreground">
          {unit}
        </span>
      </span>
    </label>
  );
}
function freshSalesDraft(): SalesFormState {
  return {
    ...emptySalesForm,
    automaticComponentPricing: true,
    roomDrivenGuests: true,
    passengerHotelPrices: {},
    servicePricing: {},
    priceEntryMode: 'CONTRACT_TOTAL',
  };
}
export function SalesContractForm() {
  const router = useRouter();
  const actor = useAccessActor();
  const [draftScope, setDraftScope] = useState(() =>
    contractDraftScope(null, actor),
  );
  if (draftScope?.userId !== actor?.userId) {
    setDraftScope(contractDraftScope(draftScope, actor));
  }
  const draftStorageKey =
    actor && draftScope?.userId === actor.userId ? draftScope.storageKey : null;
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [flightRange, setFlightRange] = useState<FlightDateRange>({
    from: '',
    to: '',
  });
  const [flightRangeRoute, setFlightRangeRoute] = useState('');
  const [flightDateOutboundIds, setFlightDateOutboundIds] =
    useState<string[]>();
  const [preparedTickets, setPreparedTickets] =
    useState<PreparedTicketSearch>();
  const [futureFrom, setFutureFrom] = useState(() => new Date().toISOString());
  const [draftState, setState] = useState<SalesFormState>(freshSalesDraft);
  const state = useMemo<SalesFormState>(() => {
    if (draftState.legacyContract)
      return withRoomDrivenGuests({
        ...draftState,
        passengerTotalPricing: false,
        automaticComponentPricing: false,
        priceEntryMode: 'CONTRACT_TOTAL',
        passengers: [],
      });
    if (isTicketOnlyContract(draftState))
      return ticketOnlySaleDefaults({
        ...draftState,
        passengerTotalPricing: true,
        automaticComponentPricing: true,
        priceEntryMode: 'CONTRACT_TOTAL',
      });
    return syncHotelChildSelections(
      withRoomDrivenGuests({
        ...draftState,
        passengerTotalPricing: draftState.serviceKinds.some(
          (k) => k === 'FLIGHT' || k === 'HOTEL',
        ),
        automaticComponentPricing: true,
        priceEntryMode: 'CONTRACT_TOTAL',
        servicePricing: draftState.servicePricing ?? {},
        catalogSalePricing:
          !draftState.tour &&
          !draftState.serviceKinds.includes('HOTEL') &&
          !draftState.serviceKinds.includes('TOUR')
            ? repriceStandaloneTicketSelections(
                { ...draftState, servicePricing: {} },
                salesPassengerCounts(draftState).seated,
              )
            : {},
      }),
      salesTravelDate(draftState),
    );
  }, [draftState]);
  const [peopleDraft, setPeopleDraft] = useState<SalesPeopleDraft | null>(null);
  const [peopleDirty, setPeopleDirty] = useState(false);
  const [insuranceReady, setInsuranceReady] = useState(false);
  const [hotelRateSnapshot, setHotelRateSnapshot] = useState<{
    key: string;
    data: readonly HotelRoomRateV1[];
  }>({ key: '', data: [] });
  const hotelRateKey = JSON.stringify([
    state.hotel.hotelId,
    state.hotel.checkIn,
    state.hotel.checkOut,
  ]);
  const hotelRoomRates = useMemo(
    () =>
      hotelRateSnapshot.key === hotelRateKey ? hotelRateSnapshot.data : [],
    [hotelRateSnapshot, hotelRateKey],
  );
  const [referenceRefresh, setReferenceRefresh] = useState({
    revision: 0,
    busy: true,
    message: '',
  });
  const [references, setReferences] = useState<SalesReferences>({
    airlines: [],
    countries: [],
    cities: [],
    hotels: [],
    roomTypes: [],
    visaServices: [],
    banks: [],
    currencies: [],
  });
  const prefetchKey = JSON.stringify({
    originId: state.originId,
    destinationId: state.destinationId,
    ...exactFlightQuery(flightRange.from),
    page: 1,
  });
  const flightRouteKey = JSON.stringify([
    state.originId,
    state.destinationId,
    salesDirections(state, 'FLIGHT'),
  ]);
  const flightDatesReady =
    flightRangeRoute === flightRouteKey && salesFlightRangeReady(flightRange);
  const canPrefetchTickets = Boolean(
    state.originId &&
    state.destinationId &&
    state.originId !== state.destinationId &&
    state.serviceKinds.includes('FLIGHT') &&
    salesDirections(state, 'FLIGHT').includes('OUTBOUND') &&
    !state.contractFlights?.OUTBOUND &&
    flightDatesReady,
  );
  useEffect(() => {
    if (!canPrefetchTickets) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        setPreparedTickets(
          prepareTicketSearch(JSON.parse(prefetchKey), controller.signal),
        ),
      0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [prefetchKey, canPrefetchTickets]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNumber, setSavedNumber] = useState('');
  const [savedId, setSavedId] = useState('');
  const [receiptFiles, setReceiptFiles] = useState<(File | null)[]>([]);
  const [savedContract, setSavedContract] =
    useState<SalesContractDetail | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [returnCalendar, setReturnCalendar] = useState<{
    route: string;
    offers: TicketOfferV1[];
  }>({ route: '', offers: [] });
  const selectedReturnDay = state.returnOffer
    ? flightDay(state.returnOffer)
    : flightRange.to;
  const calendarRoute = state.originId + ':' + state.destinationId;
  const onReturningOffers = useCallback(
    (offers: TicketOfferV1[]) => {
      setReturnCalendar({ route: calendarRoute, offers });
      // Calendar reads may finish after the outbound picker. Resolve from current
      // state so stale responses and an already chosen manual return cannot win.
      setState((current) =>
        withAutomaticReturn(current, calendarRoute, offers),
      );
    },
    [calendarRoute],
  );
  const submission = useRef({ fingerprint: '', key: '' });
  const selectableHotelRoomTypes = useMemo(
    () =>
      salesHotelRoomOptions(
        state.hotel.hotelId,
        references.hotels,
        references.roomTypes,
        hotelRoomRates,
      ),
    [
      hotelRoomRates,
      references.hotels,
      references.roomTypes,
      state.hotel.hotelId,
    ],
  );
  const selectableHotels = useMemo(() => {
    const hotelsAtDestination = references.hotels.filter(
      (hotel) =>
        hotel.attributes.cityId === state.destinationId &&
        (!state.tour ||
          (
            state.publishedPackageHotelIds ?? state.tour.package.hotelIds
          ).includes(hotel.id)),
    );
    return [...hotelsAtDestination].sort((left, right) =>
      salesReferenceDisplayName(left, true).localeCompare(
        salesReferenceDisplayName(right, true),
        'en',
      ),
    );
  }, [
    references.hotels,
    state.destinationId,
    state.tour,
    state.publishedPackageHotelIds,
  ]);
  const patchState = (
    update:
      | Partial<SalesFormState>
      | ((current: SalesFormState) => Partial<SalesFormState>),
  ) =>
    setState((current) => {
      const patch = typeof update === 'function' ? update(current) : update;
      if (patch.serviceKinds && !patch.serviceKinds.includes('INSURANCE'))
        patch.insuranceExtraToman = {};
      else if (patch.passengers) {
        const eligible = new Set(
          patch.passengers
            .filter((person) =>
              passengerOverSixty(
                person.birthDate,
                salesTravelDate({ ...current, ...patch }),
              ),
            )
            .map((person) => person.customerId),
        );
        patch.insuranceExtraToman = Object.fromEntries(
          Object.entries(current.insuranceExtraToman ?? {}).filter(([id]) =>
            eligible.has(id),
          ),
        );
      }
      if (
        patch.hotel?.rooms &&
        current.priceEntryMode === 'CONTRACT_TOTAL' &&
        !current.passengerTotalPricing &&
        (current.hotel.rooms?.some((r) => r.agreedPrice) ||
          patch.hotel.rooms.some((r) => r.agreedPrice))
      )
        patch.contractPrices = withRoomPriceTotals(current, patch.hotel.rooms);
      const changedRoute = [
        'originId',
        'originCountryId',
        'originCountryCode',
        'destinationCountryId',
        'destinationCountryCode',
        'destinationId',
        'departureDate',
        'tripType',
      ].some(
        (key) =>
          key in patch &&
          patch[key as keyof SalesFormState] !==
            current[key as keyof SalesFormState],
      );
      const changedDestination = ['destinationId', 'destinationCountryId'].some(
        (key) =>
          key in patch &&
          patch[key as keyof SalesFormState] !==
            current[key as keyof SalesFormState],
      );
      return hotelOccupancySaleDefaults(
        ticketOnlySaleDefaults(
          withFirstPassengerCustomer(
            withSalesHotelDates(current, {
              ...current,
              ...patch,
              ...(changedRoute
                ? {
                    outboundOffer: undefined,
                    returnOffer: undefined,
                    contractFlights: {},
                    ticket: {
                      ...current.ticket,
                      outboundOfferId: '',
                      returnOfferId: '',
                    },
                    hotel: changedDestination
                      ? {
                          ...current.hotel,
                          hotelId: '',
                          cityId: '',
                          additionalStays: [],
                          name: '',
                          roomTypeId: '',
                          rooms: [],
                          guestCustomerIds: undefined,
                        }
                      : (patch.hotel ?? current.hotel),
                    visaReferenceId: changedDestination
                      ? ''
                      : current.visaReferenceId,
                  }
                : {}),
            }),
          ),
        ),
        hotelRoomRates.find(
          (room) =>
            room.roomTypeId === (patch.hotel ?? current.hotel).roomTypeId,
        ),
        hotelRoomRates,
      );
    });

  useEffect(() => {
    if (!draftStorageKey) return;
    // Unowned legacy drafts must never be attributed to the next signed-in user.
    globalThis.localStorage?.removeItem('nora.sales.contract.draft.v1');
    const saved = globalThis.sessionStorage?.getItem(draftStorageKey);
    const restoreTimer = globalThis.setTimeout(() => {
      try {
        const parsed = saved
          ? (JSON.parse(saved) as Partial<SalesFormState>)
          : freshSalesDraft();
        const restored = restoreContractDraft(parsed);
        if (restored.serviceKinds.includes('FLIGHT'))
          restored.serviceKinds = restored.serviceKinds.filter(
            (kind) => kind !== 'BUS' && kind !== 'TRAIN',
          );
        setState(
          ticketOnlySaleDefaults({
            ...restored,
            servicePricing: restored.servicePricing ?? {},
          } as SalesFormState),
        );
      } catch {
        globalThis.sessionStorage?.removeItem(draftStorageKey);
        setState(freshSalesDraft());
      } finally {
        setPeopleDraft(null);
        setPeopleDirty(false);
        setRestoredDraftKey(draftStorageKey);
      }
    }, 0);
    return () => {
      if (restoreTimer !== undefined) globalThis.clearTimeout(restoreTimer);
    };
  }, [draftStorageKey]);
  useEffect(() => {
    const controller = new AbortController();
    void loadSalesReferences(undefined, controller.signal)
      .then(({ references: loaded, failed }) => {
        if (controller.signal.aborted) return;
        setReferences((current) => ({ ...current, ...loaded }));
        if (referenceRefresh.revision === 0)
          setState((current) =>
            withSalesRouteDefaults(
              current,
              loaded.countries ?? [],
              loaded.cities ?? [],
            ),
          );
        setReferenceRefresh((current) => ({
          ...current,
          busy: false,
          message: failed.length
            ? 'بخشی از اطلاعات دریافت نشد؛ برای تلاش مجدد، دریافت اطلاعات را بزنید.'
            : referenceRefresh.revision
              ? 'اطلاعات موردنیاز فرم به‌روز شد.'
              : '',
        }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setReferenceRefresh((current) => ({
            ...current,
            busy: false,
            message: 'دریافت اطلاعات ناموفق بود؛ دوباره تلاش کنید.',
          }));
      });
    return () => controller.abort();
  }, [referenceRefresh.revision]);
  useEffect(() => {
    if (!draftStorageKey || restoredDraftKey !== draftStorageKey) return;
    globalThis.sessionStorage?.setItem(draftStorageKey, JSON.stringify(state));
  }, [state, draftStorageKey, restoredDraftKey]);

  useEffect(() => {
    if (
      !state.serviceKinds.includes('HOTEL') ||
      !state.hotel.hotelId ||
      !state.hotel.checkIn ||
      !state.hotel.checkOut
    )
      return;
    let cancelled = false;
    salesApi
      .availableHotelRoomRates({
        hotelId: state.hotel.hotelId,
        checkIn: state.hotel.checkIn,
        checkOut: state.hotel.checkOut,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setHotelRateSnapshot({ key: hotelRateKey, data });
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : 'نرخ نوع اتاق‌های هتل دریافت نشد.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [
    state.serviceKinds,
    state.hotel.hotelId,
    state.hotel.checkIn,
    state.hotel.checkOut,
    hotelRateKey,
    referenceRefresh.revision,
  ]);
  const toggleService = (kind: SalesServiceKind) => {
    patchState({
      ...(kind === 'HOTEL'
        ? {
            hotel: {
              ...state.hotel,
              rooms: [],
              roomTypeId: '',
              guestCustomerIds: undefined,
            },
          }
        : {}),
      ...(kind === 'VISA'
        ? {
            visaComposition: state.visaComposition ?? {
              adults: passengerCounts.adults,
              children: passengerCounts.children,
            },
            visaApplicantIds: [],
          }
        : {}),
      serviceKinds: state.serviceKinds.includes(kind)
        ? state.serviceKinds.filter((item) => item !== kind)
        : [...state.serviceKinds, kind],
    });
  };
  const toggleDirection = (
    kind: 'FLIGHT' | 'TRANSFER',
    direction: 'OUTBOUND' | 'RETURN',
  ) => {
    const previous = salesDirections(state, kind);
    const next = previous.includes(direction)
      ? previous.filter((item) => item !== direction)
      : [...previous, direction];
    patchState({
      serviceKinds: next.length
        ? [...new Set([...state.serviceKinds, kind])]
        : state.serviceKinds.filter((item) => item !== kind),
      tripType:
        next.includes('RETURN') ||
        salesDirections(
          state,
          kind === 'FLIGHT' ? 'TRANSFER' : 'FLIGHT',
        ).includes('RETURN')
          ? 'ROUND_TRIP'
          : 'ONE_WAY',
      serviceDirections: { ...state.serviceDirections, [kind]: next },
      ...(kind === 'FLIGHT'
        ? {
            outboundOffer: undefined,
            returnOffer: undefined,
            contractFlights: {},
            ticket: { ...state.ticket, outboundOfferId: '', returnOfferId: '' },
          }
        : {}),
    });
  };
  const detailSteps =
    state.tour || state.serviceKinds.includes('TOUR')
      ? ['TOUR']
      : salesDetailSteps(state).filter(
          (key) =>
            !usesRoomDrivenGuests(state) || !['FLIGHT', 'HOTEL'].includes(key),
        );
  const flightDirections = salesDirections(state, 'FLIGHT');
  const detailLabel = (key: string) =>
    key === 'FLIGHT' && state.serviceKinds.includes('HOTEL')
      ? 'بلیط و هتل'
      : key.startsWith('FLIGHT-')
        ? `بلیط ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
        : key.startsWith('TRANSFER-')
          ? `ترانسفر ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
          : (serviceOptions.find(([kind]) => kind === key)?.[1] ?? key);
  const occupancyRoom = hotelRoomRates.find(
    (room) => room.roomTypeId === state.hotel.roomTypeId,
  );
  const pricedState = state.legacyContract
    ? state
    : hotelOccupancySaleDefaults(state, occupancyRoom, hotelRoomRates);
  const passengerCounts = salesPassengerCounts(state);
  const hotelCapacityError = salesHotelCapacityError(state, hotelRoomRates);
  const hotelGuestIds = salesHotelGuestIds(state);
  const passengerStepError = salesPassengerStepError(
    state,
    peopleDirty,
    step === 0 ? null : hotelCapacityError,
  );
  const updatePassengerCount = (
    kind: keyof SalesFormState['passengerComposition'],
    value: number,
  ) => {
    const passengerComposition = {
      ...state.passengerComposition,
      [kind]: value,
    };
    const nextCounts = salesPassengerCounts({ ...state, passengerComposition });
    const outboundAvailable = salesOfferHasCapacity(
      state.outboundOffer,
      nextCounts.seated,
    );
    const returnAvailable = salesOfferHasCapacity(
      state.returnOffer,
      nextCounts.seated,
    );
    patchState({
      passengerComposition,
      ...(kind === 'children'
        ? {
            childAges: Array.from(
              { length: value },
              (_, i) => state.childAges?.[i] ?? null,
            ),
          }
        : {}),
      ...(kind === 'infants'
        ? {
            infantAges: Array.from(
              { length: value },
              (_, i) => state.infantAges?.[i] ?? null,
            ),
          }
        : {}),
      hotel: { ...state.hotel, occupancy: nextCounts.total },
      ...(!state.tour &&
      !state.serviceKinds.includes('HOTEL') &&
      !state.serviceKinds.includes('TOUR')
        ? {
            servicePricing: isTicketOnlyContract(state)
              ? state.servicePricing
              : repriceStandaloneTicketSelections(state, nextCounts.seated),
          }
        : {}),
      ...(!outboundAvailable && state.outboundOffer
        ? {
            outboundOffer: undefined,
            returnOffer: undefined,
            ticket: {
              ...state.ticket,
              outboundOfferId: '',
              returnOfferId: '',
            },
          }
        : !returnAvailable && state.returnOffer
          ? {
              returnOffer: undefined,
              ticket: { ...state.ticket, returnOfferId: '' },
            }
          : {}),
    });
  };
  const finalStepError = (() => {
    if (step !== 1) return '';
    if (hotelCapacityError) return hotelCapacityError;
    try {
      const payload = salesPayload({
        ...(state.legacyContract ? state : pricedState),
        servicePricing: pricedState.servicePricing ?? {},
      });
      validateSalesCurrencySelection(payload, references.currencies);
      readPassengerHotelPrices(payload.services, payload.passengers);
      if (
        !state.legacyContract &&
        payload.services.some((s) => s.kind === 'FLIGHT') &&
        !state.passengerTotalPricing &&
        state.passengerFlightPrices === undefined
      )
        throw Error('قیمت پرواز هر مسافر را وارد کنید.');
      validatePassengerFlightPrices(
        payload.services,
        payload.passengers,
        payload.priceComponents,
      );
      validateSalesChequePayments(
        payload.priceComponents,
        payload.payments ?? [],
        payload.paymentTerms,
      );
      validatePassengerPackagePrices(
        payload.passengers,
        payload.paymentTerms
          ? payload.priceComponents.filter((p) => p.title !== SALES_CHEQUE_FEE)
          : payload.priceComponents,
        !state.legacyContract &&
          (state.passengerTotalPricing ||
            state.priceEntryMode === 'PASSENGER_TOTAL'),
      );
      return payload.priceComponents.length > 0 ||
        (payload.services.length > 0 &&
          payload.services.every((service) => service.kind === 'TRANSFER') &&
          !payload.payments?.length)
        ? ''
        : 'قیمت خدمات قرارداد را تکمیل کنید.';
    } catch (reason) {
      return reason instanceof Error
        ? reason.message
        : 'قیمت و پرداخت‌های قرارداد را بررسی کنید.';
    }
  })();
  const canContinue = (() => {
    if (step === 0)
      return Boolean(
        passengerStepError === null &&
        state.originId &&
        state.originCountryId &&
        state.destinationCountryId &&
        state.destinationId &&
        state.originId !== state.destinationId &&
        state.serviceKinds.length &&
        salesStandaloneServiceDatesValid(state) &&
        passengerCounts.total > 0 &&
        !salesRoomPartyError(state) &&
        (!state.serviceKinds.includes('VISA') ||
          Boolean(
            state.visaComposition &&
            state.visaComposition.adults + state.visaComposition.children > 0 &&
            (state.visaChildAges?.length ?? 0) ===
              state.visaComposition.children &&
            state.visaChildAges?.every(
              (a) => a !== null && a >= 2 && a < 12,
            ) !== false,
          )) &&
        (!state.serviceKinds.includes('HOTEL') ||
          Boolean(
            state.hotel.rooms?.length &&
            state.hotel.rooms.every(
              (r) => r.roomTypeId && r.childAges.every((a) => a !== null),
            ),
          )) &&
        (!state.serviceKinds.includes('HOTEL') ||
          state.hotel.rooms?.length ||
          ((state.childAges?.length ?? 0) === passengerCounts.children &&
            (state.infantAges?.length ?? 0) === passengerCounts.infants &&
            [...(state.childAges ?? []), ...(state.infantAges ?? [])].every(
              (age) => age !== null,
            ))) &&
        (!state.serviceKinds.includes('FLIGHT') ||
          (passengerCounts.seated > 0 &&
            (state.tour || salesSelectedFlightsReady(state)))) &&
        (passengerCounts.infants === 0 || passengerCounts.adults > 0) &&
        (!state.serviceKinds.includes('FLIGHT') || salesFlightsValid(state)) &&
        (!state.serviceKinds.includes('HOTEL') ||
          (salesHotelValid(state) && !hotelCapacityError)) &&
        (!state.serviceKinds.includes('VISA') ||
          Boolean(state.visaReferenceId)) &&
        (!state.serviceKinds.includes('INSURANCE') ||
          (Boolean(state.insurancePlan) && insuranceReady)) &&
        (!(state.tour || state.serviceKinds.includes('TOUR')) ||
          Boolean(
            state.tour &&
            (state.legacyContract ||
              state.tour.startsOn >= salesFlightToday()) &&
            (state.legacyContract ||
              !state.packageSaleAvailable ||
              state.packageSaleQuote),
          )),
      );
    if (step === 1) return !finalStepError;
    return true;
  })();
  const submit = async () => {
    if (step !== salesSteps.length - 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      if (hotelCapacityError) throw new Error(hotelCapacityError);
      const payload = salesPayload(pricedState);
      validateSalesCurrencySelection(payload, references.currencies);
      validatePassengerPackagePrices(
        payload.passengers,
        payload.paymentTerms
          ? payload.priceComponents.filter((p) => p.title !== SALES_CHEQUE_FEE)
          : payload.priceComponents,
        state.priceEntryMode === 'PASSENGER_TOTAL',
      );
      const fingerprint = JSON.stringify(payload);
      validateSalesChequePayments(
        payload.priceComponents,
        payload.payments ?? [],
        payload.paymentTerms,
      );
      if (submission.current.fingerprint !== fingerprint)
        submission.current = { fingerprint, key: browserRandomUuid() };
      const options = receiptFiles.some(Boolean)
        ? (await documentsApi.options()).data
        : null;
      if (options)
        for (const file of receiptFiles)
          if (file) validatePaymentEvidenceFile(options, file);
      const response = await salesApi.create(payload, submission.current.key);
      if (response.data.status !== 'SENT_TO_RESERVATIONS')
        await salesApi.confirm(response.data.id, response.data.version);
      if (draftStorageKey)
        globalThis.sessionStorage?.removeItem(draftStorageKey);
      setSavedNumber(response.data.contractNumber);
      setSavedId(response.data.id);
      setSavedContract(response.data);
      if (options) {
        let ids: string[];
        try {
          ids = createdPaymentIds(
            payload.payments ?? [],
            response.data.payments,
          );
        } catch (reason) {
          setReceiptError(
            reason instanceof Error
              ? reason.message
              : 'ثبت مدرک پرداخت ناموفق بود.',
          );
          return;
        }
        for (let i = 0; i < receiptFiles.length; i++) {
          const file = receiptFiles[i];
          if (!file) continue;
          try {
            if (!ids[i]) throw Error('پرداخت متعلق به این قرارداد نیست.');
            await documentsApi.upload(
              paymentEvidenceForm(response.data, ids[i]!, options, file),
            );
          } catch (reason) {
            setReceiptError(
              reason instanceof Error
                ? reason.message
                : 'ثبت مدرک پرداخت ناموفق بود.',
            );
            break;
          }
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت قرارداد ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };

  const destinationCountryId = references.cities.find(
    ({ id }) => id === state.destinationId,
  )?.attributes.countryId;
  const destinationVisas = references.visaServices.filter(
    (item) =>
      item.attributes.countryId === destinationCountryId &&
      Boolean(destinationCountryId),
  );
  const autoVisaId =
    destinationVisas.length === 1 ? destinationVisas[0]?.id : undefined;
  useEffect(() => {
    if (!state.serviceKinds.includes('VISA') || !autoVisaId) return;
    const timer = setTimeout(
      () =>
        setState((current) => ({ ...current, visaReferenceId: autoVisaId })),
      0,
    );
    return () => clearTimeout(timer);
  }, [autoVisaId, state.serviceKinds]);

  const flightDetails = (
    <section className="grid gap-4 rounded-xl border p-4">
      <h3 className="font-bold">انتخاب بلیط پرواز</h3>
      <label className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={state.businessOutput === true}
          onChange={(event) =>
            patchState({ businessOutput: event.target.checked })
          }
        />
        این بلیط بیزینس است — درج در خروجی
      </label>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {flightDirections.includes('OUTBOUND') &&
        salesFlightSeats(state, 'OUTBOUND') > 0 ? (
          <section className="grid gap-3 min-w-0">
            <h3 className="font-bold">بلیط رفت</h3>
            <ContractFlightEditor
              flightDate={flightRange.from}
              international={salesInternationalTravel(state)}
              airlines={references.airlines}
              value={state.contractFlights?.OUTBOUND}
              onChange={(value) =>
                patchState((current) =>
                  patchContractFlight(current, 'OUTBOUND', value),
                )
              }
            />
            {!state.contractFlights?.OUTBOUND ? (
              <>
                <TicketOfferPicker
                  refreshRevision={referenceRefresh.revision}
                  calendarSystem={salesFlightCalendarSystem(state, 'OUTBOUND')}
                  prepared={preparedTickets}
                  enabled={flightDatesReady}
                  originLabel={
                    references.cities.find((city) => city.id === state.originId)
                      ?.name ?? 'مبدأ'
                  }
                  destinationLabel={
                    references.cities.find(
                      (city) => city.id === state.destinationId,
                    )?.name ?? 'مقصد'
                  }
                  key={`out-${state.originId}-${state.destinationId}-${flightRange.from}-${flightRange.to}`}
                  query={{
                    originId: state.originId,
                    destinationId: state.destinationId,
                    ...exactFlightQuery(flightRange.from),
                  }}
                  exactDay={flightRange.from}
                  allowedOfferIds={flightDateOutboundIds}
                  requiredSeats={salesFlightSeats(state, 'OUTBOUND')}
                  requireStandaloneFare={false}
                  acceptAnyRoundTripFare={flightDirections.includes('RETURN')}
                  selectedId={state.ticket.outboundOfferId}
                  onSelect={(offer) => {
                    const paired =
                      salesDirections(state, 'FLIGHT').includes('RETURN') &&
                      returnCalendar.route === calendarRoute
                        ? pairedReturnOffer(
                            offer,
                            returnCalendar.offers,
                            salesFlightSeats(state, 'RETURN'),
                            false,
                          )
                        : undefined;
                    if (paired) {
                      const range = { ...flightRange, to: flightDay(paired) };
                      setFlightRange(range);
                    }
                    const pricingState = {
                      ...state,
                      servicePricing:
                        resetSalesTicketRange(state).servicePricing ?? {},
                    };
                    patchState({
                      ...(paired ? { returnDate: flightDay(paired) } : {}),
                      outboundOffer: offer,
                      returnOffer: paired,
                      hotel:
                        offer.id !== state.outboundOffer?.id
                          ? {
                              ...state.hotel,
                              checkInManual: false,
                              checkOutManual: false,
                            }
                          : state.hotel,
                      contractFlights: {},
                      servicePricing: paired
                        ? roundTripTicketPricing(
                            pricingState,
                            offer,
                            paired,
                            salesFlightSeats(state, 'RETURN'),
                          )
                        : standaloneTicketPricing(
                            pricingState,
                            offer,
                            'OUTBOUND',
                            salesFlightSeats(state, 'OUTBOUND'),
                          ),
                      ticket: {
                        ...state.ticket,
                        outboundOfferId: offer.id,
                        outboundDepartureAt: offer.departureAt,
                        outboundArrivalAt: offer.arrivalAt,
                        outboundNumber: offer.serviceNumber,
                        carrier: offer.carrierName,
                        returnOfferId: paired?.id ?? '',
                        returnDepartureAt: paired?.departureAt ?? '',
                        returnArrivalAt: paired?.arrivalAt ?? '',
                        returnNumber: paired?.serviceNumber ?? '',
                      },
                    });
                  }}
                />
              </>
            ) : null}
          </section>
        ) : null}
        {flightDirections.includes('RETURN') &&
        salesFlightSeats(state, 'RETURN') > 0 ? (
          <section className="grid gap-3 min-w-0">
            <h3 className="font-bold">بلیط برگشت</h3>
            {!salesReturnRequiresInventory(state) && (
              <ContractFlightEditor
                flightDate={selectedReturnDay}
                international={salesInternationalTravel(state)}
                airlines={references.airlines}
                value={state.contractFlights?.RETURN}
                onChange={(value) =>
                  patchState((current) =>
                    patchContractFlight(current, 'RETURN', value),
                  )
                }
              />
            )}
            {!state.contractFlights?.RETURN ||
            salesReturnRequiresInventory(state) ? (
              <>
                {!flightDirections.includes('OUTBOUND') ||
                salesFlightSelection(state, 'OUTBOUND') ? (
                  <TicketOfferPicker
                    refreshRevision={referenceRefresh.revision}
                    calendarSystem={salesFlightCalendarSystem(state, 'RETURN')}
                    enabled={flightDatesReady}
                    originLabel={
                      references.cities.find(
                        (city) => city.id === state.destinationId,
                      )?.name ?? 'مقصد'
                    }
                    destinationLabel={
                      references.cities.find(
                        (city) => city.id === state.originId,
                      )?.name ?? 'مبدأ'
                    }
                    key={`return-${salesFlightSelection(state, 'OUTBOUND')?.departureAt ?? futureFrom}-${flightRange.from + '-' + selectedReturnDay}`}
                    query={{
                      originId: state.destinationId,
                      destinationId: state.originId,
                      ...exactFlightQuery(selectedReturnDay),
                    }}
                    exactDay={selectedReturnDay}
                    requiredSeats={salesFlightSeats(state, 'RETURN')}
                    requireStandaloneFare={false}
                    {...(state.outboundOffer
                      ? { roundTripOutbound: state.outboundOffer }
                      : {})}
                    selectedId={state.ticket.returnOfferId}
                    onSelect={(offer) => {
                      if (
                        salesFlightSelection(state, 'OUTBOUND') &&
                        Date.parse(offer.departureAt) <
                          Date.parse(
                            salesFlightSelection(state, 'OUTBOUND')!.arrivalAt,
                          )
                      ) {
                        setError(
                          'زمان حرکت برگشت باید پس از رسیدن بلیط رفت باشد.',
                        );
                        return;
                      }
                      setError('');
                      patchState({
                        returnOffer: offer,
                        hotel:
                          offer.id !== state.returnOffer?.id
                            ? { ...state.hotel, checkOutManual: false }
                            : state.hotel,
                        servicePricing: state.outboundOffer
                          ? roundTripTicketPricing(
                              state,
                              state.outboundOffer,
                              offer,
                              salesFlightSeats(state, 'RETURN'),
                            )
                          : (state.servicePricing ?? {}),
                        contractFlights: Object.fromEntries(
                          Object.entries(state.contractFlights ?? {}).filter(
                            ([key]) => key !== 'RETURN',
                          ),
                        ),
                        ticket: {
                          ...state.ticket,
                          returnOfferId: offer.id,
                          returnDepartureAt: offer.departureAt,
                          returnArrivalAt: offer.arrivalAt,
                          returnNumber: offer.serviceNumber,
                        },
                      });
                    }}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed p-5 text-muted-foreground">
                    ابتدا بلیط رفت را در همین صفحه انتخاب کنید.
                  </p>
                )}
              </>
            ) : null}
          </section>
        ) : null}
      </div>
      {(state.contractFlights?.OUTBOUND || state.contractFlights?.RETURN) &&
      !salesFlightsValid(state) ? (
        <p role="status" className="text-sm text-amber-700">
          اطلاعات هر بلیط را کامل کنید؛ رسیدن باید بعد از حرکت و پرواز برگشت بعد
          از رسیدن پرواز رفت باشد.
        </p>
      ) : null}
    </section>
  );
  if (savedNumber)
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-700">
          <Check className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-black">
          قرارداد ثبت و برای رزرواسیون صف‌بندی شد
        </h1>
        <p className="mt-2 text-muted-foreground">
          شماره قرارداد: <strong dir="ltr">{savedNumber}</strong>
        </p>
        <Button className="mt-6" onClick={() => router.push('/sales')}>
          بازگشت به فروش
        </Button>
        {receiptError && (
          <Alert
            tone="warning"
            title="قرارداد ثبت شد؛ رسیدهای پرداخت را بررسی کنید."
            description={receiptError}
          />
        )}
        {receiptError &&
          savedContract &&
          savedContract.payments.map((p) => (
            <PaymentDocuments
              key={p.id}
              contract={savedContract}
              paymentId={p.id}
              expanded
            />
          ))}
        {savedId && (
          <div className="mt-4">
            <ContractOutputButton contractId={savedId} />
          </div>
        )}
        {state.serviceKinds.includes('FLIGHT') ? (
          <div className="mt-5">
            <p className="text-sm text-muted-foreground">
              بلیط مسافر پس از ثبت قرارداد در رزرواسیون آماده است؛ دسترسی فروش
              پس از تأیید تحویل مدارک توسط مالی باز می‌شود.
            </p>
          </div>
        ) : null}
      </Card>
    );

  return (
    <form
      className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 pb-6"
      onSubmit={(event) => event.preventDefault()}
    >
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-gradient-to-l from-primary/10 via-surface to-surface p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">قرارداد جدید</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={referenceRefresh.busy || busy}
              onClick={() =>
                setReferenceRefresh((current) => ({
                  revision: current.revision + 1,
                  busy: true,
                  message: '',
                }))
              }
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  referenceRefresh.busy ? 'size-4 animate-spin' : 'size-4'
                }
              />
              {referenceRefresh.busy
                ? 'در حال دریافت اطلاعات…'
                : 'دریافت اطلاعات'}
            </Button>
          </div>
          {referenceRefresh.message && (
            <p role="status" className="mt-1 text-xs text-muted-foreground">
              {referenceRefresh.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            مرحله {step + 1} از {salesSteps.length} · {salesSteps[step]}
          </p>
        </div>
        <Link
          href="/sales"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ChevronRight className="size-4" />
          داشبورد قراردادها
        </Link>
      </header>
      <ol
        className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:grid-cols-3"
        aria-label="مراحل ثبت قرارداد"
      >
        {salesSteps.map((label, index) => (
          <li
            aria-current={index === step ? 'step' : undefined}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-bold transition-colors ${index === step ? 'border-primary bg-primary text-primary-foreground shadow-sm' : index < step ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-transparent bg-muted/40 text-muted-foreground'}`}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? (
        <Alert tone="error" title="عملیات کامل نشد" description={error} />
      ) : null}
      <Card className="min-w-0 rounded-2xl border-border/80 p-4 shadow-sm sm:p-6 lg:p-8">
        {step === 0 && (
          <label className="mb-4 flex items-center gap-2 rounded-xl border p-3">
            <input
              type="checkbox"
              checked={state.legacyContract === true}
              disabled={busy}
              onChange={(e) => {
                const legacyContract = e.target.checked;
                setPeopleDraft(null);
                setPeopleDirty(true);
                patchState({
                  legacyContract,
                  servicePricing: {},
                  contractPrices: [],
                  legacyDeductions: {},
                  ...(legacyContract
                    ? {
                        passengers: [],
                        firstPassengerIsCustomer: false,
                        passengerTotalPricing: false,
                        automaticComponentPricing: false,
                        tour: undefined,
                        packageSaleQuote: undefined,
                      }
                    : {}),
                });
              }}
            />
            قرارداد قدیمی
          </label>
        )}
        {<PublishedPackageSale state={state} onChange={setState} />}
        {step === 0 ? (
          <div className="grid gap-5">
            <h2 className="text-sm font-bold">مسیر سفر</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-3" role="group" aria-label="مبدأ سفر">
                <SearchableReference
                  label="کشور مبدأ"
                  value={state.originCountryId}
                  options={references.countries}
                  onChange={(originCountryId) =>
                    patchState({
                      originCountryId,
                      originCountryCode: String(
                        references.countries.find(
                          (country) => country.id === originCountryId,
                        )?.attributes.iso2Code ??
                          references.countries.find(
                            (country) => country.id === originCountryId,
                          )?.code ??
                          '',
                      ),
                      originId: '',
                    })
                  }
                />
                <SearchableReference
                  label="شهر مبدأ"
                  value={state.originId}
                  disabled={!state.originCountryId}
                  options={references.cities.filter(
                    (item) =>
                      item.attributes.countryId === state.originCountryId,
                  )}
                  onChange={(originId) => patchState({ originId })}
                />
              </div>
              <div className="grid gap-3" role="group" aria-label="مقصد سفر">
                <SearchableReference
                  label="کشور مقصد"
                  value={state.destinationCountryId}
                  options={references.countries}
                  onChange={(destinationCountryId) =>
                    patchState({
                      destinationCountryId,
                      destinationCountryCode: String(
                        references.countries.find(
                          (country) => country.id === destinationCountryId,
                        )?.attributes.iso2Code ??
                          references.countries.find(
                            (country) => country.id === destinationCountryId,
                          )?.code ??
                          '',
                      ),
                      destinationId: '',
                    })
                  }
                />
                <SearchableReference
                  label="شهر مقصد"
                  value={state.destinationId}
                  disabled={!state.destinationCountryId}
                  options={references.cities.filter(
                    (item) =>
                      item.attributes.countryId === state.destinationCountryId,
                  )}
                  onChange={(destinationId) => patchState({ destinationId })}
                />
              </div>
            </div>
          </div>
        ) : null}
        {step === 0 ? (
          <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="text-sm font-bold">خدمات قرارداد</h2>
            {state.tour ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                خدمات این قرارداد از پکیج تور انتخاب‌شده می‌آیند و بلیط، هتل،
                ترانسفر یا خدمت اضافه به‌صورت جداگانه قابل تغییر نیست.
              </p>
            ) : (
              <div className={serviceStyles.services}>
                <div className="contents">
                  {(['FLIGHT', 'TRANSFER'] as const).map((kind) => (
                    <fieldset
                      key={kind}
                      className={`${serviceStyles.card} ${serviceStyles.primary} ${serviceStyles.directional} ${serviceStyles[kind.toLowerCase()]} ${state.serviceKinds.includes(kind) ? serviceStyles.selected : ''}`}
                    >
                      <label className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                        <span className={serviceStyles.label}>
                          {kind === 'FLIGHT' ? (
                            <Plane
                              className={serviceStyles.icon}
                              aria-hidden="true"
                            />
                          ) : (
                            <CarFront
                              className={serviceStyles.icon}
                              aria-hidden="true"
                            />
                          )}
                          {kind === 'FLIGHT' ? 'بلیط پرواز' : 'ترانسفر'}
                        </span>
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 cursor-pointer accent-primary"
                          checked={state.serviceKinds.includes(kind)}
                          aria-controls={
                            kind === 'FLIGHT'
                              ? `sales-directions-${kind}`
                              : undefined
                          }
                          aria-expanded={
                            kind === 'FLIGHT'
                              ? state.serviceKinds.includes(kind)
                              : undefined
                          }
                          onChange={() =>
                            patchState(
                              toggleSalesDirectionalService(state, kind),
                            )
                          }
                        />
                      </label>
                      {kind === 'FLIGHT' &&
                      state.serviceKinds.includes(kind) ? (
                        <div
                          id={`sales-directions-${kind}`}
                          className="mt-4 flex flex-wrap gap-2"
                        >
                          {(['OUTBOUND', 'RETURN'] as const).map(
                            (direction) => (
                              <label
                                key={direction}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 ${salesDirections(state, kind).includes(direction) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                              >
                                <input
                                  type="checkbox"
                                  className="size-5 shrink-0 cursor-pointer accent-primary"
                                  checked={salesDirections(
                                    state,
                                    kind,
                                  ).includes(direction)}
                                  onChange={() =>
                                    toggleDirection(kind, direction)
                                  }
                                />
                                {direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}
                              </label>
                            ),
                          )}
                        </div>
                      ) : null}
                    </fieldset>
                  ))}
                </div>
                <div className="contents">
                  {serviceOptions
                    .filter(
                      ([kind]) =>
                        kind !== 'FLIGHT' &&
                        kind !== 'TRANSFER' &&
                        kind !== 'CIP',
                    )
                    .map(([kind, label]) => (
                      <button
                        className={`${serviceStyles.card} ${serviceStyles[kind.toLowerCase()]} ${kind === 'HOTEL' ? serviceStyles.primary : ''} ${state.serviceKinds.includes(kind) ? serviceStyles.selected : ''}`}
                        key={kind}
                        role="checkbox"
                        aria-checked={state.serviceKinds.includes(kind)}
                        onClick={() => toggleService(kind)}
                        disabled={
                          state.serviceKinds.includes('FLIGHT') &&
                          (kind === 'BUS' || kind === 'TRAIN')
                        }
                        type="button"
                      >
                        <span className={serviceStyles.label}>
                          {(() => {
                            const Icon = {
                              HOTEL: Building2,
                              VISA: BookOpen,
                              INSURANCE: ShieldCheck,
                              TOUR: MapPinned,
                              CIP: Armchair,
                              BUS: BusFront,
                              TRAIN: TrainFront,
                              OTHER: Ellipsis,
                              FLIGHT: Plane,
                              TRANSFER: CarFront,
                            }[kind];
                            return (
                              <Icon
                                className={serviceStyles.icon}
                                aria-hidden="true"
                              />
                            );
                          })()}
                          {label}
                        </span>
                        <span
                          className={serviceStyles.check}
                          aria-hidden="true"
                        >
                          {state.serviceKinds.includes(kind) ? (
                            <Check className="size-4" />
                          ) : null}
                        </span>
                      </button>
                    ))}
                </div>
                {!state.legacyContract &&
                  (
                    Object.entries(salesAdditionalServices) as [
                      keyof typeof salesAdditionalServices,
                      string,
                    ][]
                  ).map(([role, label]) => {
                    const selected =
                      state.additionalServices?.includes(role) ?? false;
                    const Icon = role === 'CITY_TOUR' ? MapPinned : UsersRound;
                    return (
                      <button
                        key={role}
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        className={`${serviceStyles.card} ${role === 'CITY_TOUR' ? serviceStyles.cityTour : serviceStyles.tourGuide} ${selected ? serviceStyles.selected : ''}`}
                        onClick={() =>
                          patchState((current) => ({
                            additionalServices:
                              current.additionalServices?.includes(role)
                                ? current.additionalServices.filter(
                                    (item) => item !== role,
                                  )
                                : [...(current.additionalServices ?? []), role],
                          }))
                        }
                      >
                        <span className={serviceStyles.label}>
                          <Icon
                            className={serviceStyles.icon}
                            aria-hidden="true"
                          />
                          {label}
                        </span>
                        <span
                          className={serviceStyles.check}
                          aria-hidden="true"
                        >
                          {selected ? <Check className="size-4" /> : null}
                        </span>
                      </button>
                    );
                  })}
                <div className={serviceStyles.summary} aria-live="polite">
                  <Check
                    className="size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="font-bold">
                    {state.serviceKinds.length +
                      (state.additionalServices?.length ?? 0)}
                  </span>
                  <span>
                    {serviceOptions
                      .filter(([kind]) => state.serviceKinds.includes(kind))
                      .map(([, label]) => label)
                      .concat(
                        (state.additionalServices ?? []).map(
                          (role) => salesAdditionalServices[role],
                        ),
                      )
                      .join(' · ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}
        {step === 0 &&
        !usesRoomDrivenGuests(state) &&
        state.serviceKinds.some((k) => k !== 'HOTEL' && k !== 'VISA') ? (
          <section className="mt-5 grid gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">تعداد مسافران</h2>
              </div>
              <Badge>
                {passengerCounts.seated.toLocaleString('fa-IR')} صندلی ·{' '}
                {passengerCounts.total.toLocaleString('fa-IR')} مسافر
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <PassengerCountField
                label="بزرگسال"
                hint="۱۲ سال و بیشتر"
                value={passengerCounts.adults}
                onChange={(value) => updatePassengerCount('adults', value)}
              />
              <PassengerCountField
                label="کودک"
                hint="۲ تا ۱۲ سال"
                value={passengerCounts.children}
                onChange={(value) => updatePassengerCount('children', value)}
              />
              <PassengerCountField
                label="نوزاد"
                hint="کمتر از ۲ سال"
                value={passengerCounts.infants}
                onChange={(value) => updatePassengerCount('infants', value)}
              />
            </div>
            <div className="space-y-3 rounded-xl bg-sky-50 p-4 dark:bg-sky-950/40">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from(
                  { length: passengerCounts.children },
                  (_, index) => (
                    <PassengerAgeField
                      key={`child-${index}`}
                      label={`سن کودک ${index + 1}`}
                      allowedAges={
                        state.serviceKinds.includes('FLIGHT')
                          ? Array.from({ length: 10 }, (_, i) => i + 2)
                          : undefined
                      }
                      value={state.childAges?.[index] ?? null}
                      onChange={(age) =>
                        patchState({
                          childAges: Array.from(
                            { length: passengerCounts.children },
                            (_, i) =>
                              i === index
                                ? age
                                : (state.childAges?.[i] ?? null),
                          ),
                        })
                      }
                    />
                  ),
                )}
                {state.serviceKinds.includes('HOTEL') &&
                  Array.from(
                    { length: passengerCounts.infants },
                    (_, index) => (
                      <PassengerAgeField
                        key={`infant-${index}`}
                        infant
                        label={`سن نوزاد ${index + 1}`}
                        value={state.infantAges?.[index] ?? null}
                        onChange={(age) =>
                          patchState({
                            infantAges: Array.from(
                              { length: passengerCounts.infants },
                              (_, i) =>
                                i === index
                                  ? age
                                  : (state.infantAges?.[i] ?? null),
                            ),
                          })
                        }
                      />
                    ),
                  )}
              </div>
              <p className="text-xs text-sky-900 dark:text-sky-200">
                نوزاد لازم نیست در تعداد صندلی بلیط شمرده شود؛ فقط بزرگسال و
                کودک از ظرفیت بلیط کم می‌شوند. هر نوزاد باید همراه حداقل یک
                بزرگسال باشد.
              </p>
            </div>
          </section>
        ) : null}
        {step === 0 && (
          <ServiceParties
            refreshRevision={referenceRefresh.revision}
            state={state}
            patch={patchState}
            hotels={selectableHotels}
            roomTypes={selectableHotelRoomTypes}
            rates={hotelRoomRates}
          />
        )}
        {step === 0 && !state.tour && state.serviceKinds.includes('FLIGHT') ? (
          <section
            aria-label="انتخاب تاریخ بلیط رفت و برگشت"
            className="mt-5 border-t border-border pt-4"
          >
            <FlightTripDates
              calendarSystems={{
                OUTBOUND: salesFlightCalendarSystem(state, 'OUTBOUND'),
                RETURN: salesFlightCalendarSystem(state, 'RETURN'),
              }}
              onCalendarSystemChange={(direction, calendar) =>
                patchState((current) => ({
                  ...current,
                  flightCalendarSystems: {
                    ...current.flightCalendarSystems,
                    [direction]: calendar,
                  },
                }))
              }
              primaryDirection={
                salesDirections(state, 'FLIGHT').includes('OUTBOUND')
                  ? 'OUTBOUND'
                  : 'RETURN'
              }
              onReturningOffers={onReturningOffers}
              international={salesInternationalTravel(state)}
              originId={
                salesDirections(state, 'FLIGHT').includes('OUTBOUND')
                  ? state.originId
                  : state.destinationId
              }
              destinationId={
                salesDirections(state, 'FLIGHT').includes('OUTBOUND')
                  ? state.destinationId
                  : state.originId
              }
              roundTrip={
                salesDirections(state, 'FLIGHT').includes('OUTBOUND') &&
                salesDirections(state, 'FLIGHT').includes('RETURN')
              }
              seats={Math.max(
                1,
                ...salesDirections(state, 'FLIGHT').map((d) =>
                  salesFlightSeats(state, d),
                ),
              )}
              requireFare={false}
              value={
                flightRangeRoute === flightRouteKey
                  ? { ...flightRange, to: selectedReturnDay }
                  : { from: '', to: '' }
              }
              onChange={(range, outboundIds) => {
                setFlightDateOutboundIds(outboundIds);
                setFlightRangeRoute(flightRouteKey);
                setFlightRange(range);
                setFutureFrom(new Date().toISOString());
                const keepOutbound =
                  flightRangeRoute === flightRouteKey &&
                  range.from === flightRange.from;
                const reset = resetSalesTicketRange(state);
                patchState({
                  ...reset,
                  departureDate: range.from,
                  returnDate: range.to,
                  hotel: {
                    ...state.hotel,
                    ...(range.from !== flightRange.from
                      ? { checkInManual: false }
                      : {}),
                    ...(range.to !== selectedReturnDay
                      ? { checkOutManual: false }
                      : {}),
                  },
                  contractFlights:
                    keepOutbound && state.contractFlights?.OUTBOUND
                      ? { OUTBOUND: state.contractFlights.OUTBOUND }
                      : {},
                  ...(keepOutbound
                    ? {
                        outboundOffer: state.outboundOffer,
                        ticket: {
                          ...reset.ticket!,
                          outboundOfferId: state.ticket.outboundOfferId,
                          outboundDepartureAt: state.ticket.outboundDepartureAt,
                          outboundArrivalAt: state.ticket.outboundArrivalAt,
                          outboundNumber: state.ticket.outboundNumber,
                        },
                      }
                    : {}),
                });
              }}
            />
            {flightDatesReady ||
            state.contractFlights?.OUTBOUND ||
            state.contractFlights?.RETURN ? (
              <div className="mt-4">{flightDetails}</div>
            ) : null}
          </section>
        ) : null}
        {step === 0 && salesStandaloneDateServiceKeys(state).length > 0 && (
          <section className="mt-4 grid gap-3 sm:grid-cols-2">
            {salesStandaloneDateServiceKeys(state).map((key) => (
              <div key={key} className="rounded-xl border p-3">
                <h3 className="mb-2 text-sm font-bold">{detailLabel(key)}</h3>
                <FormField label="تاریخ" required>
                  <SalesDatePicker
                    value={state.serviceDetails?.[key]?.date ?? ''}
                    onChange={(date) =>
                      patchState({
                        serviceDetails: {
                          ...state.serviceDetails,
                          [key]: { ...state.serviceDetails?.[key], date },
                        },
                      })
                    }
                  />
                </FormField>
              </div>
            ))}
          </section>
        )}
        {step === 0 && state.serviceKinds.includes('HOTEL') && (
          <>
            <HotelStayDates state={state} patchState={patchState} />
            <AdditionalHotelStays
              state={state}
              patch={patchState}
              hotels={references.hotels}
              cities={references.cities}
              roomTypes={references.roomTypes}
            />
          </>
        )}
        {step === 0
          ? detailSteps
              .filter((key) => key !== 'FLIGHT')
              .map((activeDetail) => (
                <div key={activeDetail} className="grid gap-6">
                  {state.tour && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 p-3">
                      <span>
                        تور انتخاب‌شده: {state.tour.package.name} ·{' '}
                        {state.tour.startsOn} تا {state.tour.endsOn}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          patchState({
                            tour: undefined,
                            serviceKinds: [],
                            serviceDirections: {},
                            outboundOffer: undefined,
                            returnOffer: undefined,
                            contractFlights: {},
                            ticket: {
                              ...state.ticket,
                              outboundOfferId: '',
                              returnOfferId: '',
                            },
                          })
                        }
                      >
                        حذف تور
                      </Button>
                    </div>
                  )}
                  {activeDetail === 'TOUR' && (
                    <SalesTourPicker
                      refreshRevision={referenceRefresh.revision}
                      state={state}
                      countries={references.countries}
                      cities={references.cities}
                      hotels={references.hotels}
                      onChange={(next) => {
                        setState(next);
                      }}
                    />
                  )}
                  {activeDetail === 'INSURANCE' ? (
                    <SalesInsurancePicker
                      refreshRevision={referenceRefresh.revision}
                      value={state.insurancePlan}
                      onChange={(insurancePlan) =>
                        patchState({ insurancePlan })
                      }
                      onReady={setInsuranceReady}
                    />
                  ) : null}
                  {activeDetail &&
                  activeDetail !== 'FLIGHT' &&
                  !activeDetail.startsWith('TRANSFER-') &&
                  !['HOTEL', 'VISA', 'INSURANCE', 'TOUR'].includes(
                    activeDetail,
                  ) ? (
                    <section className="grid gap-4 rounded-2xl border border-border p-4">
                      <h3 className="font-bold">{detailLabel(activeDetail)}</h3>
                      <p className="text-sm text-muted-foreground">
                        این خدمت برای مسافران قرارداد به رزرواسیون ارسال می‌شود.
                      </p>
                      <FormField label="توضیحات و نیازهای مشتری">
                        <Textarea
                          value={
                            state.serviceDetails?.[activeDetail]?.notes ?? ''
                          }
                          onChange={(event) =>
                            patchState({
                              serviceDetails: {
                                ...state.serviceDetails,
                                [activeDetail]: {
                                  ...state.serviceDetails?.[activeDetail],
                                  notes: event.target.value,
                                },
                              },
                            })
                          }
                        />
                      </FormField>
                    </section>
                  ) : null}
                  {activeDetail === 'HOTEL' ||
                  (activeDetail === 'TOUR' &&
                    state.serviceKinds.includes('HOTEL')) ||
                  (activeDetail === 'FLIGHT' &&
                    state.serviceKinds.includes('HOTEL')) ? (
                    <section className="grid gap-4 rounded-xl border p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        {!state.hotel.rooms ? (
                          <>
                            <ContractHotelPicker
                              refreshRevision={referenceRefresh.revision}
                              state={state}
                              patch={patchState}
                              hotels={selectableHotels}
                              onHotelChange={(hotelId) =>
                                patchState({
                                  hotel: {
                                    ...state.hotel,
                                    hotelId,
                                    roomTypeId: '',
                                    name:
                                      references.hotels.find(
                                        ({ id }) => id === hotelId,
                                      )?.name ?? '',
                                  },
                                })
                              }
                            />
                            <ReferenceSelect
                              label="نوع اتاق"
                              value={state.hotel.roomTypeId}
                              options={selectableHotelRoomTypes}
                              onChange={(roomTypeId) =>
                                patchState({
                                  hotel: { ...state.hotel, roomTypeId },
                                })
                              }
                            />
                          </>
                        ) : (
                          <div className="md:col-span-3">
                            <b>{state.hotel.name}</b>
                            <p className="text-sm">
                              {state.hotel.rooms
                                .map(
                                  (r) =>
                                    `اتاق ${r.ordinal}: ${r.roomTypeNameSnapshot} · ${r.adults} بزرگسال · ${r.childAges.length} کودک`,
                                )
                                .join(' | ')}
                            </p>
                          </div>
                        )}
                        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {hotelRoomRates.map((room) => (
                              <HotelRoomCapacity
                                key={room.roomTypeId}
                                room={room}
                              />
                            ))}
                          </div>
                          {hotelRoomRates
                            .filter((room) => room.occupancyRates)
                            .map((room) => {
                              const quote = salesHotelOccupancyQuote(
                                state,
                                room,
                                hotelRoomRates,
                              );
                              return (
                                <p key={room.roomTypeId}>
                                  {room.roomTypeName}:{' '}
                                  {quote
                                    ? `قیمت پایهٔ کل ${state.hotel.roomCount} اتاق برای تمام شب‌ها: ${quote.amount} ${currencySymbol(quote.currencyCode)}`
                                    : 'برای ترکیب/سن/تاریخ فعلی نرخ ندارد'}
                                </p>
                              );
                            })}
                          {(() => {
                            const room = hotelRoomRates.find(
                              (rate) =>
                                rate.roomTypeId === state.hotel.roomTypeId,
                            );
                            const quote = room
                              ? salesHotelOccupancyQuote(state, room)
                              : null;
                            return quote ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  patchState({
                                    servicePricing: {
                                      ...state.servicePricing,
                                      hotel: [
                                        {
                                          version: 1,
                                          currencyCode: quote.currencyCode,
                                          daySale: {
                                            basis: 'TOTAL',
                                            amount: quote.amount,
                                          },
                                          agreed: {
                                            basis: 'TOTAL',
                                            amount: quote.amount,
                                          },
                                        },
                                      ],
                                    },
                                  })
                                }
                              >
                                اعمال قیمت پایهٔ هتل به توافق اولیه
                              </Button>
                            ) : null;
                          })()}
                          {!hotelRoomRates.length &&
                            (selectableHotelRoomTypes.length
                              ? 'نوع اتاق‌های متصل به هتل قابل انتخاب‌اند؛ نبود ضریب فعال مانع ثبت قرارداد نیست.'
                              : 'نوع اتاقی در اطلاعات پایه به این هتل متصل نشده است.')}
                        </div>{' '}
                        {hotelCapacityError ? (
                          <div className="md:col-span-3">
                            <Alert tone="error" title={hotelCapacityError} />
                          </div>
                        ) : null}
                        {!state.hotel.rooms ? (
                          <>
                            <HotelCountField
                              label="تعداد اتاق"
                              hint="کل اتاق‌های درخواستی"
                              unit="باب"
                              min={1}
                              value={state.hotel.roomCount}
                              onChange={(roomCount) =>
                                patchState({
                                  hotel: {
                                    ...state.hotel,
                                    roomCount: Math.max(1, roomCount),
                                    singleRoomCount: Math.min(
                                      state.hotel.singleRoomCount,
                                      Math.max(1, roomCount),
                                    ),
                                    doubleRoomCount: Math.min(
                                      state.hotel.doubleRoomCount,
                                      Math.max(
                                        0,
                                        Math.max(1, roomCount) -
                                          state.hotel.singleRoomCount,
                                      ),
                                    ),
                                  },
                                })
                              }
                            />
                            <HotelCountField
                              label="یک‌تخته"
                              hint="تعداد اتاق یک‌نفره"
                              unit="باب"
                              value={state.hotel.singleRoomCount}
                              onChange={(singleRoomCount) =>
                                patchState({
                                  hotel: {
                                    ...state.hotel,
                                    singleRoomCount: Math.min(
                                      singleRoomCount,
                                      state.hotel.roomCount,
                                    ),
                                    doubleRoomCount: Math.min(
                                      state.hotel.doubleRoomCount,
                                      Math.max(
                                        0,
                                        state.hotel.roomCount - singleRoomCount,
                                      ),
                                    ),
                                  },
                                })
                              }
                            />
                            <HotelCountField
                              label="دوتخته"
                              hint="تعداد اتاق دونفره"
                              unit="باب"
                              value={state.hotel.doubleRoomCount}
                              onChange={(doubleRoomCount) =>
                                patchState({
                                  hotel: {
                                    ...state.hotel,
                                    doubleRoomCount: Math.min(
                                      doubleRoomCount,
                                      Math.max(
                                        0,
                                        state.hotel.roomCount -
                                          state.hotel.singleRoomCount,
                                      ),
                                    ),
                                  },
                                })
                              }
                            />
                            <HotelCountField
                              label="تخت اضافه"
                              hint="نفر اضافه هتل"
                              unit="نفر"
                              value={state.hotel.extraBedCount}
                              onChange={(extraBedCount) =>
                                patchState({
                                  hotel: { ...state.hotel, extraBedCount },
                                })
                              }
                            />
                          </>
                        ) : null}
                        <div className="rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold">ترکیب مسافران</p>
                            <Badge>
                              مجموع{' '}
                              {passengerCounts.total.toLocaleString('fa-IR')}{' '}
                              نفر
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                            <span className="rounded-lg bg-surface px-2 py-2">
                              بزرگسال:{' '}
                              <strong>
                                {passengerCounts.adults.toLocaleString('fa-IR')}
                              </strong>
                            </span>
                            <span className="rounded-lg bg-surface px-2 py-2">
                              کودک:{' '}
                              <strong>
                                {passengerCounts.children.toLocaleString(
                                  'fa-IR',
                                )}
                              </strong>
                            </span>
                            <span className="rounded-lg bg-surface px-2 py-2">
                              نوزاد:{' '}
                              <strong>
                                {passengerCounts.infants.toLocaleString(
                                  'fa-IR',
                                )}
                              </strong>
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            نوزاد در ظرفیت صندلی بلیط شمرده نمی‌شود.
                          </p>
                        </div>
                      </div>
                      {state.hotel.checkIn &&
                      state.hotel.checkOut &&
                      state.hotel.checkOut <= state.hotel.checkIn ? (
                        <Alert
                          tone="warning"
                          title="تاریخ خروج باید بعد از ورود باشد؛ تاریخ‌های اقامت را اصلاح کنید."
                        />
                      ) : null}
                      {state.serviceKinds.includes('FLIGHT') ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-self-start"
                          onClick={() =>
                            patchState({
                              hotel: {
                                ...state.hotel,
                                checkInManual: false,
                                checkOutManual: false,
                              },
                            })
                          }
                        >
                          تنظیم دوباره تاریخ‌ها از بلیط
                        </Button>
                      ) : null}
                    </section>
                  ) : null}
                  {activeDetail === 'VISA' ? (
                    <ReferenceSelect
                      label="خدمت ویزا"
                      value={state.visaReferenceId}
                      options={destinationVisas}
                      onChange={(visaReferenceId) =>
                        patchState({ visaReferenceId })
                      }
                    />
                  ) : null}
                </div>
              ))
          : null}
        {step === 0 ? (
          <SalesPeopleSheet
            refreshRevision={referenceRefresh.revision}
            onGuestStateChange={(patch) => {
              if (patch.flightOnlyPassengers) setPeopleDirty(true);
              patchState(patch);
            }}
            state={state}
            draft={peopleDraft}
            busy={busy}
            onBusyChange={setBusy}
            onDraftChange={(draft) => {
              setPeopleDraft(draft);
              setPeopleDirty(true);
            }}
            onFlightDirectionsChange={(passengerFlightDirections) => {
              const prices = { ...state.passengerFlightPrices };
              for (const [id, dirs] of Object.entries(
                passengerFlightDirections,
              ))
                if (
                  JSON.stringify(dirs) !==
                  JSON.stringify(
                    state.passengerFlightDirections?.[id] ??
                      salesDirections(state, 'FLIGHT'),
                  )
                )
                  delete prices[id];
              patchState({
                passengerFlightDirections,
                passengerFlightPrices: prices,
              });
            }}
            onConfirmed={(patch) => {
              if (patch.passengers)
                patch.passengerFlightDirections = Object.fromEntries(
                  patch.passengers.map((p, i) => [
                    p.customerId,
                    state.passengerFlightDirections?.[p.customerId] ??
                      state.passengerFlightDirections?.[
                        passengerSlotKeys(state)[i]!
                      ] ??
                      salesDirections(state, 'FLIGHT'),
                  ]),
                );
              patchState(patch);
              setPeopleDirty(false);
            }}
            onAddInfant={() =>
              updatePassengerCount('infants', passengerCounts.infants + 1)
            }
          />
        ) : null}
        {step === 0 ? (
          <section className="mt-5 grid gap-4" aria-label="تخصیص خدمات مسافران">
            {state.serviceKinds.includes('VISA') ? (
              <fieldset className="grid gap-2 rounded-xl border p-4">
                <legend>انتخاب متقاضیان ویزا</legend>
                <p className="text-sm">
                  تعداد انتخاب‌شده: {state.visaApplicantIds?.length ?? 0} /{' '}
                  {(state.visaComposition?.adults ?? 0) +
                    (state.visaComposition?.children ?? 0)}
                </p>
                {state.passengers.map((p) => (
                  <label className="flex items-center gap-2" key={p.customerId}>
                    <input
                      type="checkbox"
                      checked={
                        state.visaApplicantIds?.includes(p.customerId) ?? false
                      }
                      onChange={() =>
                        patchState({
                          visaApplicantIds: state.visaApplicantIds?.includes(
                            p.customerId,
                          )
                            ? state.visaApplicantIds.filter(
                                (id) => id !== p.customerId,
                              )
                            : [...(state.visaApplicantIds ?? []), p.customerId],
                        })
                      }
                    />
                    {p.displayName} ·{' '}
                    {salesPassengerAgeLabel(
                      p.birthDate,
                      salesTravelDate(state),
                      p.ageCategory,
                    )}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {state.serviceKinds.includes('HOTEL') && state.passengers.length ? (
              <fieldset className="grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                <legend className="px-2 font-bold">اعضای اقامت هتل</legend>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {hotelGuestIds.length.toLocaleString('fa-IR')} مهمان در{' '}
                    {state.hotel.roomCount.toLocaleString('fa-IR')} اتاق
                  </span>
                  <span className="text-xs text-muted-foreground">
                    فقط افراد انتخاب‌شده برای هتل به رزرواسیون ارسال می‌شوند.
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {state.passengers.map((passenger) => (
                    <label
                      key={passenger.customerId}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                        hotelGuestIds.includes(passenger.customerId)
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-surface'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={hotelGuestIds.includes(passenger.customerId)}
                        onChange={() =>
                          patchState({
                            hotel: {
                              ...state.hotel,
                              guestCustomerIds: hotelGuestIds.includes(
                                passenger.customerId,
                              )
                                ? hotelGuestIds.filter(
                                    (id) => id !== passenger.customerId,
                                  )
                                : [...hotelGuestIds, passenger.customerId],
                            },
                          })
                        }
                      />
                      <span>
                        <strong>{passenger.displayName}</strong>
                        <span className="block text-xs text-muted-foreground">
                          {salesPassengerAgeLabel(
                            passenger.birthDate,
                            salesTravelDate(state),
                            passenger.ageCategory,
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {state.passengers
              .filter(
                (p) =>
                  state.serviceKinds.includes('INSURANCE') &&
                  !peopleDirty &&
                  passengerOverSixty(p.birthDate, salesTravelDate(state)),
              )
              .map((person) => (
                <section
                  key={person.customerId}
                  className="my-3 rounded-lg border border-amber-500 p-3"
                >
                  <p role="status">
                    {person.displayName}: سن مسافر در شروع سفر بالای ۶۰ سال است؛
                    هزینه بیمه ممکن است بیشتر باشد.
                  </p>
                  {state.serviceKinds.includes('INSURANCE') ? (
                    <FormField label="هزینه اضافه بیمه همین مسافر (تومان)">
                      <Input
                        inputMode="numeric"
                        value={
                          state.insuranceExtraToman?.[person.customerId] ?? ''
                        }
                        onChange={(event) => {
                          if (/^\d{0,15}$/.test(event.target.value))
                            patchState({
                              insuranceExtraToman: {
                                ...state.insuranceExtraToman,
                                [person.customerId]: event.target.value,
                              },
                            });
                        }}
                      />
                      <p className="text-xs">
                        این مبلغ یک بار به جمع مسافر و قرارداد اضافه می‌شود.
                      </p>
                    </FormField>
                  ) : (
                    <p className="text-sm">
                      در صورت انتخاب بیمه، فیلد هزینه اضافه فعال می‌شود.
                    </p>
                  )}
                </section>
              ))}

            {!canContinue ? (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                {passengerStepError ??
                  (!salesFlightsValid(state)
                    ? 'اطلاعات و ترتیب تاریخ بلیط‌های انتخاب‌شده را بررسی کنید.'
                    : 'اطلاعات مسیر و خدمات انتخاب‌شده را کامل کنید.')}
              </p>
            ) : null}
          </section>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-4 grid-cols-1">
            <div className="grid content-start gap-3">
              <ContractServiceSummary
                state={state}
                roomType={
                  references.roomTypes.find(
                    (r) => r.id === state.hotel.roomTypeId,
                  )?.name
                }
                origin={
                  references.cities.find((c) => c.id === state.originId)?.name
                }
                destination={
                  references.cities.find((c) => c.id === state.destinationId)
                    ?.name
                }
              />
            </div>
            <div className="grid content-start gap-3">
              {state.legacyContract ? (
                <LegacyContractPrices
                  state={state}
                  currencies={references.currencies}
                  onChange={patchState}
                />
              ) : (
                <ContractTotalPrices
                  state={state}
                  currencies={references.currencies}
                  onChange={(contractPrices) => patchState({ contractPrices })}
                />
              )}
              {!state.legacyContract && (
                <PassengerServicePrices
                  state={state}
                  currencies={references.currencies}
                  onChange={patchState}
                />
              )}
              <InsuranceExtraSummary state={state} />
              <SalesChequeCalculator
                state={pricedState}
                onChange={patchState}
              />
              <SalesPaymentPlan
                allowChecks={state.paymentTerms?.mode === 'CHECK'}
                payments={state.payments}
                currencies={references.currencies}
                banks={references.banks}
                disabled={
                  busy || (!state.legacyContract && !state.passengers.length)
                }
                onChange={(payments) => patchState({ payments })}
                receiptFiles={receiptFiles}
                onReceiptChange={(index, file) =>
                  setReceiptFiles((files) => {
                    const next = [...files];
                    next[index] = file;
                    return next;
                  })
                }
                onRemove={(index) =>
                  setReceiptFiles((files) =>
                    files.filter((_, i) => i !== index),
                  )
                }
              />
              <FormField label="یادداشت قرارداد / Notice (اختیاری)">
                <Textarea
                  maxLength={1000}
                  rows={4}
                  value={state.contractNotice ?? ''}
                  onChange={(event) =>
                    patchState({ contractNotice: event.target.value })
                  }
                  placeholder="یادداشتی که در پایین قرارداد چاپ می‌شود"
                />
              </FormField>
              <FormField label="یادداشت کارشناس برای رزرواسیون (اختیاری)">
                <Textarea
                  maxLength={500}
                  rows={3}
                  value={state.reservationNote ?? ''}
                  onChange={(event) =>
                    patchState({ reservationNote: event.target.value })
                  }
                  placeholder="توضیحات لازم برای اجرای خدمات سفر"
                />
              </FormField>
              <details className="rounded-xl border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  یادداشت قیمت‌گذاری
                </summary>
                <FormField label="یادداشت قیمت‌گذاری">
                  <Textarea
                    value={state.pricingNotes}
                    onChange={(event) =>
                      patchState({ pricingNotes: event.target.value })
                    }
                  />
                </FormField>
              </details>
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-5">
            {state.serviceKinds.includes('FLIGHT') ? (
              <p className="text-sm text-muted-foreground">
                بلیط مسافر پس از ثبت قرارداد در رزرواسیون آماده است؛ دسترسی فروش
                پس از تأیید تحویل مدارک توسط مالی باز می‌شود.
              </p>
            ) : null}
            <h2 className="text-xl font-black">بازبینی و ثبت</h2>
            <p className="font-bold">
              نوع فروش:{' '}
              {state.paymentTerms?.mode === 'CHECK'
                ? 'چکی · سود ماهیانه ۵٪'
                : 'نقدی'}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">مشتری</p>
                <p className="mt-1 font-bold">{state.customerName}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">نوع و مسیر</p>
                <p className="mt-1 font-bold">
                  {
                    references.countries.find(
                      (item) => item.id === state.originCountryId,
                    )?.name
                  }{' '}
                  /{' '}
                  {
                    references.cities.find((item) => item.id === state.originId)
                      ?.name
                  }{' '}
                  ←{' '}
                  {
                    references.countries.find(
                      (item) => item.id === state.destinationCountryId,
                    )?.name
                  }{' '}
                  /{' '}
                  {
                    references.cities.find(
                      (item) => item.id === state.destinationId,
                    )?.name
                  }
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">خدمات</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ...detailSteps,
                    ...salesDirections(state, 'TRANSFER').map(
                      (direction) => 'TRANSFER-' + direction,
                    ),
                  ].map((key) => (
                    <Badge key={key}>{detailLabel(key)}</Badge>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">
                  مسافران / پرداخت‌ها
                </p>
                <p className="mt-1 font-bold">
                  {state.passengers.length} مسافر · {state.payments.length}{' '}
                  پرداخت
                </p>
              </Card>
            </div>
            <InsuranceExtraSummary state={state} />
            <ContractReviewPreview
              state={pricedState}
              references={references}
            />
            <ContractTotalPrices
              state={state}
              currencies={references.currencies}
              onChange={(contractPrices) => patchState({ contractPrices })}
            />
            {state.serviceKinds.includes('FLIGHT') ? (
              <Alert
                tone="warning"
                title="کنترل موجودی بلیط در تأیید نهایی"
                description="پیش از ارسال، بلیط انتخاب‌شده دوباره بررسی می‌شود. ظرفیت و اجرای خدمات در رزرواسیون پیگیری می‌شود."
              />
            ) : null}
          </div>
        ) : null}
      </Card>
      {finalStepError ? (
        <Alert
          tone="warning"
          title="نیازمند اصلاح قبل از ثبت"
          description={finalStepError}
        />
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-surface/95 p-3 shadow-lg backdrop-blur sm:p-4">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => setStep((value) => value - 1)}
        >
          <ChevronRight className="size-4" />
          قبلی
        </Button>
        {step < salesSteps.length - 1 ? (
          <Button
            key="advance-step"
            type="button"
            disabled={!canContinue || busy}
            onClick={() => setStep((value) => value + 1)}
          >
            {step === 0 ? 'تأیید مسیر و خدمات' : 'بعدی'}
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button
            key="commit-contract"
            type="button"
            onClick={() => void submit()}
            loading={busy}
            disabled={!canContinue}
          >
            ثبت و ارسال به رزرواسیون
          </Button>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="size-4" />
        Secret، CVV و تصویر چک در این فرم پذیرفته نمی‌شود.
      </p>
    </form>
  );
}

function InsuranceExtraSummary({ state }: { state: SalesFormState }) {
  let payload: ReturnType<typeof salesPayload>;
  try {
    payload = salesPayload(state);
  } catch {
    return null;
  }
  const extras = payload.services.filter(
    (service) => service.metadata?.insuranceAgeSurcharge === true,
  );
  if (!extras.length) return null;
  const totals = new Map<string, bigint>();
  for (const part of payload.priceComponents)
    totals.set(
      part.currencyCode,
      (totals.get(part.currencyCode) ?? 0n) +
        moneyUnits(part.amount) * (part.type === 'DISCOUNT' ? -1n : 1n),
    );
  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="font-bold">اضافه بیمه و جمع نهایی</h3>
      {extras.map((service) => (
        <p key={service.clientKey}>
          {service.titleSnapshot}: {String(service.metadata?.extraToman)} تومان
        </p>
      ))}
      {[...totals].map(([code, amount]) => (
        <p key={code}>
          جمع نهایی قرارداد: {moneyDecimal(amount)} {currencySymbol(code)}
        </p>
      ))}
    </section>
  );
}
