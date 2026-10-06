'use client';
import {
  isTicketOnlyContract,
  ticketOnlySaleDefaults,
} from '../model/ticket-only-sale-defaults';
import { FlightTripDates } from './flight-trip-dates';
import { exactFlightQuery } from '../model/exact-flight-dates';
import {
  salesFlightRangeReady,
  salesFlightToday,
  resetSalesTicketRange,
} from '../model/sales-flight-range';
import { moneyDecimal, moneyUnits, passengerOverSixty } from '@nora/contracts';
import { PassengerCountField } from './passenger-count-field';
import { ContractOutputButton } from './contract-output';

import { AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  HotelRoomRateV1,
  MasterDataRecord,
  MasterDataResource,
  SalesServiceKind,
} from '@nora/contracts';

import { validateSalesCurrencySelection } from './sales-currency-select';
import { validatePassengerPackagePrices } from '@nora/contracts';
import { PassengerPackagePrices } from './passenger-package-prices';
import { SalesPaymentPlan } from './sales-payment-plan';
import { Button, buttonVariants } from '@/components/ui/button';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
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
import type { SalesPeopleDraft } from '../model/sales-people-sheet';
import { type FlightDateRange } from './flight-date-range';
import {
  emptySalesForm,
  salesFlightSelection,
  salesFlightsValid,
  patchContractFlight,
  salesPayload,
  salesSteps,
  salesPassengerAgeLabel,
  salesPassengerCompositionMatches,
  salesPassengerCounts,
  salesHotelGuestIds,
  salesHotelCapacityError,
  salesHotelRoomTypes,
  salesOfferHasCapacity,
  salesDirections,
  salesTravelDate,
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
export function SalesContractForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [detailStep, setDetailStep] = useState(0);
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
  const [draftState, setState] = useState<SalesFormState>({
    ...emptySalesForm,
    servicePricing: {},
    priceEntryMode: 'PASSENGER_TOTAL',
  });
  const state = useMemo<SalesFormState>(() => {
    if (isTicketOnlyContract(draftState))
      return ticketOnlySaleDefaults({
        ...draftState,
        priceEntryMode: 'PASSENGER_TOTAL',
      });
    return {
      ...draftState,
      priceEntryMode: 'PASSENGER_TOTAL',
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
    };
  }, [draftState]);
  const [peopleDraft, setPeopleDraft] = useState<SalesPeopleDraft | null>(null);
  const [peopleDirty, setPeopleDirty] = useState(false);
  const [insuranceReady, setInsuranceReady] = useState(false);
  const [hotelRoomRates, setHotelRoomRates] = useState<
    readonly HotelRoomRateV1[]
  >([]);
  const [references, setReferences] = useState<{
    airlines: readonly MasterDataRecord[];
    countries: readonly MasterDataRecord[];
    cities: readonly MasterDataRecord[];
    hotels: readonly MasterDataRecord[];
    roomTypes: readonly MasterDataRecord[];
    visaServices: readonly MasterDataRecord[];
    banks: readonly MasterDataRecord[];
    currencies: readonly MasterDataRecord[];
  }>({
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
    flightRangeRoute === flightRouteKey &&
    salesFlightRangeReady(flightRange, salesFlightToday());
  const canPrefetchTickets = Boolean(
    state.originId &&
    state.destinationId &&
    state.originId !== state.destinationId &&
    state.serviceKinds.includes('FLIGHT') &&
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
  const submission = useRef({ fingerprint: '', key: '' });
  const selectableHotelRoomTypes = useMemo(
    () =>
      salesHotelRoomTypes(
        state.hotel.hotelId,
        references.hotels,
        references.roomTypes,
        hotelRoomRates.map((rate) => rate.roomTypeId),
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
        (!state.tour || state.tour.package.hotelIds.includes(hotel.id)),
    );
    return [...hotelsAtDestination].sort((left, right) =>
      salesReferenceDisplayName(left, true).localeCompare(
        salesReferenceDisplayName(right, true),
        'en',
      ),
    );
  }, [references.hotels, state.destinationId, state.tour]);
  const patchState = (
    update:
      | Partial<SalesFormState>
      | ((current: SalesFormState) => Partial<SalesFormState>),
  ) =>
    setState((current) => {
      const patch = typeof update === 'function' ? update(current) : update;
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
      return ticketOnlySaleDefaults(
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
                  hotel: {
                    ...current.hotel,
                    hotelId: '',
                    name: '',
                    roomTypeId: '',
                  },
                  visaReferenceId: '',
                }
              : {}),
          }),
        ),
      );
    });

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem(
      'nora.sales.contract.draft.v1',
    );
    const restoreTimer = saved
      ? globalThis.setTimeout(() => {
          try {
            const parsed = JSON.parse(saved) as Partial<SalesFormState>;
            const restored = {
              ...emptySalesForm,
              ...parsed,
              passengerComposition: {
                ...emptySalesForm.passengerComposition,
                ...parsed.passengerComposition,
              },
              hotel: { ...emptySalesForm.hotel, ...parsed.hotel },
            } as SalesFormState;
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
            globalThis.localStorage.removeItem('nora.sales.contract.draft.v1');
          }
        }, 0)
      : undefined;
    const query = {
      search: '',
      status: 'active' as const,
      sortBy: 'name' as const,
      sortDirection: 'asc' as const,
      page: 1,
      pageSize: 100,
    };
    const loadReferences = async (resource: MasterDataResource) => {
      const data: MasterDataRecord[] = [];
      for (let page = 1; ; page++) {
        const response = await masterDataApi.list(resource, { ...query, page });
        data.push(...response.data);
        if (!response.data.length || data.length >= response.meta.total)
          return { data };
      }
    };
    void Promise.allSettled([
      loadReferences('countries'),
      loadReferences('cities'),
      loadReferences('hotels'),
      loadReferences('room-types'),
      loadReferences('visa-services'),
      loadReferences('banks'),
      loadReferences('currencies'),
      loadReferences('airlines'),
    ]).then((results) => {
      const dataAt = (index: number): readonly MasterDataRecord[] => {
        const result = results[index];
        if (result?.status === 'fulfilled') return result.value.data ?? [];
        return [];
      };
      const [
        countries = [],
        cities = [],
        hotels = [],
        roomTypes = [],
        visaServices = [],
        banks = [],
        currencies = [],
        airlines = [],
      ] = [0, 1, 2, 3, 4, 5, 6, 7].map(dataAt);
      setReferences({
        airlines,
        countries,
        cities,
        hotels,
        roomTypes,
        visaServices,
        banks,
        currencies,
      });
      setState((current) => withSalesRouteDefaults(current, countries, cities));
      if (results.some((result) => result.status === 'rejected'))
        setError(
          'بخشی از اطلاعات پایه دریافت نشد؛ گزینه‌های دریافت‌شده، از جمله هتل‌های فعال، همچنان قابل استفاده‌اند.',
        );
    });
    return () => {
      if (restoreTimer !== undefined) globalThis.clearTimeout(restoreTimer);
    };
  }, []);
  useEffect(() => {
    globalThis.localStorage?.setItem(
      'nora.sales.contract.draft.v1',
      JSON.stringify(state),
    );
  }, [state]);

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
        setHotelRoomRates(data);
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
  ]);
  const toggleService = (kind: SalesServiceKind) => {
    setDetailStep(0);
    patchState({
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
      : salesDetailSteps(state);
  const activeDetail = detailSteps[detailStep];
  const serviceDetail = activeDetail
    ? (state.serviceDetails?.[activeDetail] ?? {})
    : {};
  const patchServiceDetail = (patch: {
    date?: string;
    pickup?: string;
    dropoff?: string;
    notes?: string;
  }) => {
    if (activeDetail)
      patchState({
        serviceDetails: {
          ...state.serviceDetails,
          [activeDetail]: { ...serviceDetail, ...patch },
        },
      });
  };
  const flightDirections = salesDirections(state, 'FLIGHT');
  const detailLabel = (key: string) =>
    key === 'FLIGHT' && state.serviceKinds.includes('HOTEL')
      ? 'بلیط و هتل'
      : key.startsWith('FLIGHT-')
        ? `بلیط ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
        : key.startsWith('TRANSFER-')
          ? `ترانسفر ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
          : (serviceOptions.find(([kind]) => kind === key)?.[1] ?? key);
  const passengerCounts = salesPassengerCounts(state);
  const hotelCapacityError = salesHotelCapacityError(state, hotelRoomRates);
  const hotelGuestIds = salesHotelGuestIds(state);
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
  const canContinue = (() => {
    if (step === 0)
      return Boolean(
        state.originId &&
        state.originCountryId &&
        state.destinationCountryId &&
        state.destinationId &&
        state.originId !== state.destinationId &&
        state.serviceKinds.length &&
        passengerCounts.total > 0 &&
        (!state.serviceKinds.includes('FLIGHT') ||
          (passengerCounts.seated > 0 && flightDatesReady)) &&
        (passengerCounts.infants === 0 || passengerCounts.adults > 0),
      );
    if (step === 1) {
      if (activeDetail === 'TOUR') return false;
      if (activeDetail === 'FLIGHT')
        return (
          flightDatesReady &&
          salesFlightsValid(state) &&
          (!state.serviceKinds.includes('HOTEL') ||
            (salesHotelValid(state) && !hotelCapacityError))
        );
      if (activeDetail === 'HOTEL')
        return salesHotelValid(state) && !hotelCapacityError;
      if (activeDetail === 'VISA') return Boolean(state.visaReferenceId);
      if (activeDetail === 'INSURANCE')
        return Boolean(state.insurancePlan) && insuranceReady;
      return true;
    }
    if (step === 2)
      return (
        Boolean(state.customerId) &&
        !peopleDirty &&
        Boolean(salesTravelDate(state)) &&
        state.passengers.length > 0 &&
        state.passengers.every((item) => item.birthDate) &&
        salesPassengerCompositionMatches(state) &&
        (!state.serviceKinds.includes('HOTEL') || hotelGuestIds.length > 0) &&
        state.passengers.every(
          ({ customerId }) =>
            state.serviceKinds.some((kind) => kind !== 'HOTEL') ||
            hotelGuestIds.includes(customerId),
        )
      );
    if (step === 3) {
      try {
        const payload = salesPayload({
          ...state,
          servicePricing: state.servicePricing ?? {},
        });
        validateSalesCurrencySelection(payload, references.currencies);
        validatePassengerPackagePrices(
          payload.passengers,
          payload.priceComponents,
          true,
        );
        return (
          payload.priceComponents.length > 0 ||
          (payload.services.length > 0 &&
            payload.services.every((service) => service.kind === 'TRANSFER') &&
            !payload.payments?.length)
        );
      } catch {
        return false;
      }
    }
    return true;
  })();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step !== salesSteps.length - 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = salesPayload(state);
      validateSalesCurrencySelection(payload, references.currencies);
      validatePassengerPackagePrices(
        payload.passengers,
        payload.priceComponents,
        true,
      );
      const fingerprint = JSON.stringify(payload);
      if (submission.current.fingerprint !== fingerprint)
        submission.current = { fingerprint, key: crypto.randomUUID() };
      const response = await salesApi.create(payload, submission.current.key);
      if (response.data.status !== 'SENT_TO_RESERVATIONS')
        await salesApi.confirm(response.data.id, response.data.version);
      globalThis.localStorage?.removeItem('nora.sales.contract.draft.v1');
      setSavedNumber(response.data.contractNumber);
      setSavedId(response.data.id);
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
      className="mx-auto grid w-full min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] gap-4"
      onSubmit={submit}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">قرارداد جدید</h1>
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
        className="flex gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1"
        aria-label="مراحل ثبت قرارداد"
      >
        {salesSteps.map((label, index) => (
          <li
            aria-current={index === step ? 'step' : undefined}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-bold ${index === step ? 'bg-primary/10 text-primary' : index < step ? 'text-emerald-700' : 'text-muted-foreground'}`}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? (
        <Alert tone="error" title="عملیات کامل نشد" description={error} />
      ) : null}
      <Card className="min-w-0 p-4 sm:p-5">
        {step === 2 ? (
          <SalesPeopleSheet
            state={state}
            draft={peopleDraft}
            busy={busy}
            onBusyChange={setBusy}
            onDraftChange={(draft) => {
              setPeopleDraft(draft);
              setPeopleDirty(true);
            }}
            onConfirmed={(patch) => {
              patchState(patch);
              setPeopleDirty(false);
            }}
            onAddInfant={() =>
              updatePassengerCount('infants', passengerCounts.infants + 1)
            }
            onTravelDateChange={(departureDate) => {
              patchState({ departureDate });
              setPeopleDirty(true);
            }}
          />
        ) : null}
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
          <div className="mt-5 grid gap-3 border-t border-border pt-4">
            <h2 className="text-sm font-bold">خدمات قرارداد</h2>
            {state.tour ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                خدمات این قرارداد از پکیج تور انتخاب‌شده می‌آیند و بلیط، هتل،
                ترانسفر یا خدمت اضافه به‌صورت جداگانه قابل تغییر نیست.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  با انتخاب پرواز، قطار و اتوبوس قابل انتخاب نیستند. ترانسفر فقط
                  روی خروجی بلیط درج می‌شود.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['FLIGHT', 'TRANSFER'] as const).map((kind) => (
                    <fieldset
                      key={kind}
                      className="rounded-xl border border-border p-3 text-sm"
                    >
                      <label className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                        <span>
                          {kind === 'FLIGHT' ? 'بلیط پرواز' : 'ترانسفر'}
                        </span>
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={state.serviceKinds.includes(kind)}
                          aria-controls={`sales-directions-${kind}`}
                          aria-expanded={state.serviceKinds.includes(kind)}
                          onChange={() =>
                            patchState(
                              toggleSalesDirectionalService(state, kind),
                            )
                          }
                        />
                      </label>
                      {state.serviceKinds.includes(kind) ? (
                        <div
                          id={`sales-directions-${kind}`}
                          className="mt-2 flex gap-2 border-t border-border pt-2"
                        >
                          {(['OUTBOUND', 'RETURN'] as const).map(
                            (direction) => (
                              <label
                                key={direction}
                                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 ${salesDirections(state, kind).includes(direction) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {serviceOptions
                    .filter(
                      ([kind]) => kind !== 'FLIGHT' && kind !== 'TRANSFER',
                    )
                    .map(([kind, label]) => (
                      <button
                        className={`flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-sm disabled:cursor-not-allowed disabled:opacity-40 ${state.serviceKinds.includes(kind) ? 'border-primary bg-primary/5' : 'border-border'}`}
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
                        <span>{label}</span>
                        {state.serviceKinds.includes(kind) ? (
                          <Check className="size-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        ) : null}
        {step === 0 ? (
          <section className="mt-5 grid gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">تعداد مسافران</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  این تعداد پیش از انتخاب بلیط کنترل می‌شود تا بیشتر از ظرفیت
                  باقی‌مانده فروخته نشود.
                </p>
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
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              نوزاد لازم نیست در تعداد صندلی بلیط شمرده شود؛ فقط بزرگسال و کودک
              از ظرفیت بلیط کم می‌شوند. هر نوزاد باید همراه حداقل یک بزرگسال
              باشد.
            </p>
          </section>
        ) : null}
        {step === 0 && state.serviceKinds.includes('FLIGHT') ? (
          <section
            aria-label="انتخاب تاریخ بلیط رفت و برگشت"
            className="mt-5 border-t border-border pt-4"
          >
            <FlightTripDates
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
              seats={salesPassengerCounts(state).seated}
              requireFare={
                !state.tour &&
                !state.serviceKinds.includes('HOTEL') &&
                !state.serviceKinds.includes('TOUR')
              }
              value={
                flightRangeRoute === flightRouteKey
                  ? flightRange
                  : { from: '', to: '' }
              }
              onChange={(range, outboundIds) => {
                setFlightDateOutboundIds(outboundIds);
                setFlightRangeRoute(flightRouteKey);
                setFlightRange(range);
                setFutureFrom(new Date().toISOString());
                patchState(resetSalesTicketRange(state));
              }}
            />
          </section>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-6">
            <h2 className="text-xl font-black">جزئیات خدمات</h2>
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
                state={state}
                countries={references.countries}
                cities={references.cities}
                hotels={references.hotels}
                onChange={(next) => {
                  setState(next);
                  setDetailStep(0);
                }}
              />
            )}
            <ol className="flex flex-wrap gap-2">
              {detailSteps.map((key, index) => (
                <li
                  key={key}
                  aria-current={index === detailStep ? 'step' : undefined}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${index === detailStep ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                >
                  {index < detailStep ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                  {detailLabel(key)}
                </li>
              ))}
            </ol>
            {activeDetail === 'FLIGHT' ? (
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
                  {flightDirections.includes('OUTBOUND') ? (
                    <section className="grid gap-3 min-w-0">
                      <h3 className="font-bold">بلیط رفت</h3>
                      <ContractFlightEditor
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
                            prepared={preparedTickets}
                            enabled={flightDatesReady}
                            originLabel={
                              references.cities.find(
                                (city) => city.id === state.originId,
                              )?.name ?? 'مبدأ'
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
                            requiredSeats={passengerCounts.seated}
                            requireStandaloneFare={
                              !state.tour &&
                              !state.serviceKinds.includes('HOTEL') &&
                              !state.serviceKinds.includes('TOUR')
                            }
                            acceptAnyRoundTripFare={flightDirections.includes(
                              'RETURN',
                            )}
                            selectedId={state.ticket.outboundOfferId}
                            onSelect={(offer) =>
                              patchState({
                                outboundOffer: offer,
                                returnOffer: undefined,
                                contractFlights: {},
                                servicePricing: standaloneTicketPricing(
                                  state,
                                  offer,
                                  'OUTBOUND',
                                  passengerCounts.seated,
                                ),
                                ticket: {
                                  ...state.ticket,
                                  outboundOfferId: offer.id,
                                  outboundDepartureAt: offer.departureAt,
                                  outboundArrivalAt: offer.arrivalAt,
                                  outboundNumber: offer.serviceNumber,
                                  carrier: offer.carrierName,
                                  returnOfferId: '',
                                },
                              })
                            }
                          />
                        </>
                      ) : null}
                    </section>
                  ) : null}
                  {flightDirections.includes('RETURN') ? (
                    <section className="grid gap-3 min-w-0">
                      <h3 className="font-bold">انتخاب بلیط برگشت</h3>
                      <ContractFlightEditor
                        airlines={references.airlines}
                        value={state.contractFlights?.RETURN}
                        onChange={(value) =>
                          patchState((current) =>
                            patchContractFlight(current, 'RETURN', value),
                          )
                        }
                      />
                      {!state.contractFlights?.RETURN ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            بلیط‌های برگشت در بازه انتخابی و پس از رسیدن بلیط
                            رفت نمایش داده می‌شوند.
                          </p>
                          {!flightDirections.includes('OUTBOUND') ||
                          salesFlightSelection(state, 'OUTBOUND') ? (
                            <TicketOfferPicker
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
                              key={`return-${salesFlightSelection(state, 'OUTBOUND')?.departureAt ?? futureFrom}-${flightRange.from + '-' + flightRange.to}`}
                              query={{
                                originId: state.destinationId,
                                destinationId: state.originId,
                                ...exactFlightQuery(flightRange.to),
                              }}
                              exactDay={flightRange.to}
                              requiredSeats={passengerCounts.seated}
                              requireStandaloneFare={
                                !state.tour &&
                                !state.serviceKinds.includes('HOTEL') &&
                                !state.serviceKinds.includes('TOUR')
                              }
                              {...(state.outboundOffer
                                ? { roundTripOutbound: state.outboundOffer }
                                : {})}
                              selectedId={state.ticket.returnOfferId}
                              onSelect={(offer) => {
                                if (
                                  salesFlightSelection(state, 'OUTBOUND') &&
                                  Date.parse(offer.departureAt) <
                                    Date.parse(
                                      salesFlightSelection(state, 'OUTBOUND')!
                                        .arrivalAt,
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
                                  servicePricing: state.outboundOffer
                                    ? roundTripTicketPricing(
                                        state,
                                        state.outboundOffer,
                                        offer,
                                        passengerCounts.seated,
                                      )
                                    : (state.servicePricing ?? {}),
                                  contractFlights: Object.fromEntries(
                                    Object.entries(
                                      state.contractFlights ?? {},
                                    ).filter(([key]) => key !== 'RETURN'),
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
                {(state.contractFlights?.OUTBOUND ||
                  state.contractFlights?.RETURN) &&
                !salesFlightsValid(state) ? (
                  <p role="status" className="text-sm text-amber-700">
                    اطلاعات هر بلیط را کامل کنید؛ رسیدن باید بعد از حرکت و پرواز
                    برگشت بعد از رسیدن پرواز رفت باشد.
                  </p>
                ) : null}
              </section>
            ) : null}
            {activeDetail === 'INSURANCE' ? (
              <SalesInsurancePicker
                value={state.insurancePlan}
                onChange={(insurancePlan) => patchState({ insurancePlan })}
                onReady={setInsuranceReady}
              />
            ) : null}
            {activeDetail &&
            activeDetail !== 'FLIGHT' &&
            !activeDetail.startsWith('TRANSFER-') &&
            !['HOTEL', 'VISA', 'INSURANCE', 'TOUR'].includes(activeDetail) ? (
              <section className="grid gap-4 rounded-2xl border border-border p-4">
                <h3 className="font-bold">{detailLabel(activeDetail)}</h3>
                <p className="text-sm text-muted-foreground">
                  این خدمت برای مسافران قرارداد به رزرواسیون ارسال می‌شود.
                </p>
                <FormField label="توضیحات و نیازهای مشتری">
                  <Textarea
                    value={serviceDetail.notes ?? ''}
                    onChange={(event) =>
                      patchServiceDetail({ notes: event.target.value })
                    }
                  />
                </FormField>
              </section>
            ) : null}
            {activeDetail === 'HOTEL' ||
            (activeDetail === 'FLIGHT' &&
              state.serviceKinds.includes('HOTEL')) ? (
              <section className="grid gap-4 rounded-xl border p-4">
                <h3 className="font-bold">هتل مقصد</h3>
                <p className="text-xs text-muted-foreground">
                  فقط هتل‌های فعالِ ثبت‌شده برای شهر{' '}
                  {references.cities.find(
                    (city) => city.id === state.destinationId,
                  )?.name ?? 'مقصد'}{' '}
                  قابل جست‌وجو هستند. نام هتل را جست‌وجو کنید. ورود پیشنهادی روز
                  بعد از پرواز رفت و خروج روز قبل از پرواز برگشت است؛ هر دو
                  تاریخ قابل تغییرند.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <SearchableReference
                    label="هتل"
                    value={state.hotel.hotelId}
                    options={selectableHotels}
                    showAllOptionsOnOpen
                    preferEnglishName
                    onChange={(hotelId) =>
                      patchState({
                        hotel: {
                          ...state.hotel,
                          hotelId,
                          roomTypeId: '',
                          name:
                            references.hotels.find(({ id }) => id === hotelId)
                              ?.name ?? '',
                        },
                      })
                    }
                  />
                  <ReferenceSelect
                    label="نوع اتاق"
                    value={state.hotel.roomTypeId}
                    options={selectableHotelRoomTypes}
                    onChange={(roomTypeId) =>
                      patchState({ hotel: { ...state.hotel, roomTypeId } })
                    }
                  />
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-3">
                    {hotelRoomRates.length
                      ? hotelRoomRates
                          .map(
                            (room) =>
                              `${room.roomTypeName}: ${room.maxAdults} بزرگسال + ${room.maxChildren2To6 ?? room.maxChildren} کودک ۲–۶ + ${room.maxChildren6To12 ?? 0} کودک ۶–۱۲ + ${room.maxInfants ?? 0} نوزاد`,
                          )
                          .join(' | ')
                      : selectableHotelRoomTypes.length
                        ? 'نوع اتاق‌های متصل به هتل قابل انتخاب‌اند؛ نبود ضریب فعال مانع ثبت قرارداد نیست.'
                        : 'نوع اتاقی در اطلاعات پایه به این هتل متصل نشده است.'}
                  </div>{' '}
                  {hotelCapacityError ? (
                    <div className="md:col-span-3">
                      <Alert tone="error" title={hotelCapacityError} />
                    </div>
                  ) : null}
                  <FormField label="ورود (چک‌این)" required>
                    <DatePicker
                      value={state.hotel.checkIn}
                      onChange={(checkIn) =>
                        patchState({
                          hotel: {
                            ...state.hotel,
                            checkIn,
                            checkInManual: true,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="خروج (چک‌اوت)" required>
                    <DatePicker
                      value={state.hotel.checkOut}
                      onChange={(checkOut) =>
                        patchState({
                          hotel: {
                            ...state.hotel,
                            checkOut,
                            checkOutManual: true,
                          },
                        })
                      }
                    />
                  </FormField>
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
                  <div className="rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">ترکیب مسافران</p>
                      <Badge>
                        مجموع {passengerCounts.total.toLocaleString('fa-IR')}{' '}
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
                          {passengerCounts.children.toLocaleString('fa-IR')}
                        </strong>
                      </span>
                      <span className="rounded-lg bg-surface px-2 py-2">
                        نوزاد:{' '}
                        <strong>
                          {passengerCounts.infants.toLocaleString('fa-IR')}
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
                onChange={(visaReferenceId) => patchState({ visaReferenceId })}
              />
            ) : null}
          </div>
        ) : null}
        {step === 2 ? (
          <section className="mt-5 grid gap-4" aria-label="تخصیص خدمات مسافران">
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
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {state.passengers
              .filter((p) =>
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
            <p className="text-xs text-muted-foreground">
              حذف مسافر فقط از همین قرارداد است؛ پرونده او در مشتریان باقی
              می‌ماند.
            </p>
            {!canContinue ? (
              <p
                role="status"
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                {!state.customerId
                  ? 'مشتری قرارداد را مشخص کنید.'
                  : !state.passengers.length
                    ? 'حداقل یک مسافر اضافه کنید.'
                    : peopleDirty
                      ? 'اطلاعات جدول را با دکمه «ثبت و تأیید افراد» تأیید کنید.'
                      : !state.passengers.every((item) => item.birthDate) ||
                          !salesTravelDate(state)
                        ? 'تاریخ تولد مسافران و تاریخ سفر را کامل کنید.'
                        : !salesPassengerCompositionMatches(state)
                          ? 'تعداد و رده سنی مسافران باید با ترکیب ثبت‌شده در مرحله اول یکسان باشد.'
                          : state.serviceKinds.includes('HOTEL') &&
                              hotelGuestIds.length === 0
                            ? 'حداقل یک مهمان برای هتل انتخاب کنید.'
                            : 'هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.'}
              </p>
            ) : null}
          </section>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-4 grid-cols-1">
            <div className="grid content-start gap-3">
              {state.serviceKinds.includes('TRANSFER') ? (
                <p className="rounded-xl bg-primary/5 p-3 text-sm text-primary">
                  ترانسفر{' '}
                  {salesDirections(state, 'TRANSFER')
                    .map((direction) =>
                      direction === 'OUTBOUND' ? 'رفت' : 'برگشت',
                    )
                    .join(' و ')}{' '}
                  در قیمت کل خدمات هر مسافر لحاظ می‌شود.
                </p>
              ) : null}
            </div>
            <div className="grid content-start gap-3">
              <PassengerPackagePrices
                state={state}
                currencies={references.currencies}
                onChange={(passengerPrices) => patchState({ passengerPrices })}
              />
              <InsuranceExtraSummary state={state} />
              <SalesPaymentPlan
                payments={state.payments}
                currencies={references.currencies}
                banks={references.banks}
                disabled={!state.passengers.length}
                onChange={(payments) => patchState({ payments })}
              />
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
                <p className="text-sm text-muted-foreground">
                  در توضیحات درخواست رزرواسیون نمایش داده می‌شود.
                </p>
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
        {step === 4 ? (
          <div className="grid gap-5">
            {state.serviceKinds.includes('FLIGHT') ? (
              <p className="text-sm text-muted-foreground">
                بلیط مسافر پس از ثبت قرارداد در رزرواسیون آماده است؛ دسترسی فروش
                پس از تأیید تحویل مدارک توسط مالی باز می‌شود.
              </p>
            ) : null}
            <h2 className="text-xl font-black">بازبینی و ثبت</h2>
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
            <PassengerPackagePrices
              state={state}
              currencies={references.currencies}
              onChange={(passengerPrices) => patchState({ passengerPrices })}
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
      <div className="sticky bottom-3 z-20 flex items-center justify-between rounded-xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || busy}
          onClick={() => {
            if (step === 1 && detailStep > 0)
              setDetailStep((value) => value - 1);
            else {
              if (step === 2)
                setDetailStep(Math.max(0, detailSteps.length - 1));
              setStep((value) =>
                value === 2 && !detailSteps.length ? 0 : value - 1,
              );
            }
          }}
        >
          <ChevronRight className="size-4" />
          قبلی
        </Button>
        {step < salesSteps.length - 1 ? (
          <Button
            type="button"
            disabled={!canContinue || busy}
            onClick={() => {
              if (step === 1 && detailStep < detailSteps.length - 1)
                setDetailStep((value) => value + 1);
              else {
                if (step === 0) {
                  setDetailStep(0);
                }
                setStep((value) =>
                  value === 0 && !detailSteps.length ? 2 : value + 1,
                );
              }
            }}
          >
            {step === 0 ? 'تأیید مسیر و خدمات' : 'بعدی'}
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button type="submit" loading={busy} disabled={!canContinue}>
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
          جمع نهایی قرارداد: {moneyDecimal(amount)} {code}
        </p>
      ))}
    </section>
  );
}
