'use client';
import { PassengerCountField } from './passenger-count-field';
import { ContractOutputButton } from './contract-output';

import { AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  MasterDataRecord,
  MasterDataResource,
  SalesServiceKind,
  SalesAccommodationKind,
} from '@rubi/contracts';

import { hotelNights } from '@rubi/contracts';
import { SalesPricingPanel, SalesPricingSummary } from './sales-pricing-panel';
import { validateSalesCurrencySelection } from './sales-currency-select';
import { validatePassengerPackagePrices } from '@rubi/contracts';
import { PassengerPackagePrices } from './passenger-package-prices';
import { SalesPaymentPlan } from './sales-payment-plan';
import { Button, buttonVariants } from '@/components/ui/button';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '../api/client';
import { TicketOfferPicker } from './ticket-offer-picker';
import { ContractFlightEditor } from './contract-flight-editor';
import { SearchableReference } from './searchable-reference';
import { SalesInsurancePicker } from './sales-insurance-picker';
import { FlightTicketPreview } from './flight-ticket-preview';
import { SalesPeopleSheet } from './sales-people-sheet';
import type { SalesPeopleDraft } from '../model/sales-people-sheet';
import {
  FlightDateRangeFilter,
  type FlightDateRange,
} from './flight-date-range';
import {
  emptySalesForm,
  salesFlightSelection,
  salesFlightsValid,
  patchContractFlight,
  salesPayload,
  salesSteps,
  salesPassengerAgeLabel,
  salesAccommodationOptions,
  salesAccommodationsComplete,
  salesPassengerCompositionMatches,
  salesPassengerCounts,
  salesHotelGuestIds,
  salesOfferHasCapacity,
  salesDirections,
  salesTravelDate,
  withSalesHotelDates,
  withFirstPassengerCustomer,
  salesHotelValid,
  salesDetailSteps,
  salesReturnSearchFrom,
  withSalesRouteDefaults,
  toggleSalesDirectionalService,
  type SalesFormState,
} from '../model/sales-form';

const serviceOptions: readonly [SalesServiceKind, string][] = [
  ['FLIGHT', 'بلیت پرواز'],
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
  const [futureFrom, setFutureFrom] = useState(() => new Date().toISOString());
  const [state, setState] = useState<SalesFormState>({
    ...emptySalesForm,
    servicePricing: {},
  });
  const [peopleDraft, setPeopleDraft] = useState<SalesPeopleDraft | null>(null);
  const [peopleDirty, setPeopleDirty] = useState(false);
  const [insuranceReady, setInsuranceReady] = useState(false);
  const [references, setReferences] = useState<{
    countries: readonly MasterDataRecord[];
    cities: readonly MasterDataRecord[];
    hotels: readonly MasterDataRecord[];
    roomTypes: readonly MasterDataRecord[];
    visaServices: readonly MasterDataRecord[];
    banks: readonly MasterDataRecord[];
    currencies: readonly MasterDataRecord[];
  }>({
    countries: [],
    cities: [],
    hotels: [],
    roomTypes: [],
    visaServices: [],
    banks: [],
    currencies: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNumber, setSavedNumber] = useState('');
  const [savedId, setSavedId] = useState('');
  const submission = useRef({ fingerprint: '', key: '' });
  const patchState = (patch: Partial<SalesFormState>) =>
    setState((current) => {
      const changedRoute = [
        'originId',
        'originCountryId',
        'destinationCountryId',
        'destinationId',
        'departureDate',
        'tripType',
      ].some(
        (key) =>
          key in patch &&
          patch[key as keyof SalesFormState] !==
            current[key as keyof SalesFormState],
      );
      return withFirstPassengerCustomer(
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
                hotel: { ...current.hotel, hotelId: '', name: '' },
                visaReferenceId: '',
              }
            : {}),
        }),
      );
    });

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem(
      'rubi.sales.contract.draft.v1',
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
            setState({
              ...restored,
              servicePricing: restored.servicePricing ?? {},
            } as SalesFormState);
          } catch {
            globalThis.localStorage.removeItem('rubi.sales.contract.draft.v1');
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
    void Promise.all([
      loadReferences('countries'),
      loadReferences('cities'),
      loadReferences('hotels'),
      loadReferences('room-types'),
      loadReferences('visa-services'),
      loadReferences('banks'),
      loadReferences('currencies'),
    ])
      .then(
        ([
          countries,
          cities,
          hotels,
          roomTypes,
          visaServices,
          banks,
          currencies,
        ]) => {
          setReferences({
            countries: countries.data,
            cities: cities.data,
            hotels: hotels.data,
            roomTypes: roomTypes.data,
            visaServices: visaServices.data,
            banks: banks.data,
            currencies: currencies.data,
          });
          setState((current) =>
            withSalesRouteDefaults(current, countries.data, cities.data),
          );
        },
      )
      .catch(() =>
        setError('بخشی از Public Contract اطلاعات پایه در دسترس نیست.'),
      );
    return () => {
      if (restoreTimer !== undefined) globalThis.clearTimeout(restoreTimer);
    };
  }, []);
  useEffect(() => {
    globalThis.localStorage?.setItem(
      'rubi.sales.contract.draft.v1',
      JSON.stringify(state),
    );
  }, [state]);

  const toggleService = (kind: SalesServiceKind) =>
    patchState({
      serviceKinds: state.serviceKinds.includes(kind)
        ? state.serviceKinds.filter((item) => item !== kind)
        : [...state.serviceKinds, kind],
    });
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
  const detailSteps = salesDetailSteps(state);
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
      ? 'بلیت و هتل'
      : key.startsWith('FLIGHT-')
        ? `بلیت ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
        : key.startsWith('TRANSFER-')
          ? `ترانسفر ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
          : (serviceOptions.find(([kind]) => kind === key)?.[1] ?? key);
  const pricingServices = state.serviceKinds
    .filter((kind) => kind !== 'TRANSFER')
    .flatMap((kind) =>
      kind === 'FLIGHT'
        ? salesDirections(state, kind).map((direction) => ({
            key: `${kind.toLowerCase()}-${direction.toLowerCase()}`,
            title: `${kind === 'FLIGHT' ? 'بلیت' : 'ترانسفر'} ${direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}`,
            hotel: false,
          }))
        : [
            {
              key: kind.toLowerCase(),
              title: serviceOptions.find(([key]) => key === kind)?.[1] ?? kind,
              hotel: kind === 'HOTEL',
            },
          ],
    );
  let pricingNights = 0;
  try {
    pricingNights = hotelNights(state.hotel.checkIn, state.hotel.checkOut);
  } catch {
    /* No valid stay selected yet. */
  }
  const passengerCounts = salesPassengerCounts(state);
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
  const canContinue = useMemo(() => {
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
          passengerCounts.seated > 0) &&
        (passengerCounts.infants === 0 || passengerCounts.adults > 0),
      );
    if (step === 1) {
      if (activeDetail === 'FLIGHT')
        return (
          salesFlightsValid(state) &&
          (!state.serviceKinds.includes('HOTEL') || salesHotelValid(state))
        );
      if (activeDetail === 'HOTEL') return salesHotelValid(state);
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
        salesAccommodationsComplete(state) &&
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
  }, [
    state,
    step,
    activeDetail,
    insuranceReady,
    peopleDirty,
    references.currencies,
    passengerCounts,
    hotelGuestIds,
  ]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step !== salesSteps.length - 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = salesPayload(state);
      if (!salesAccommodationsComplete(state))
        throw new Error('نوع اقامت هر مسافر هتل را مشخص کنید.');
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
      globalThis.localStorage?.removeItem('rubi.sales.contract.draft.v1');
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
            <FlightTicketPreview state={state} cities={references.cities} />
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
                    patchState({ originCountryId, originId: '' })
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
                    patchState({ destinationCountryId, destinationId: '' })
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
            <p className="text-xs text-muted-foreground">
              با انتخاب پرواز، قطار و اتوبوس قابل انتخاب نیستند. ترانسفر فقط روی
              خروجی بلیت درج می‌شود.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['FLIGHT', 'TRANSFER'] as const).map((kind) => (
                <fieldset
                  key={kind}
                  className="rounded-xl border border-border p-3 text-sm"
                >
                  <label className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                    <span>{kind === 'FLIGHT' ? 'بلیت پرواز' : 'ترانسفر'}</span>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={state.serviceKinds.includes(kind)}
                      aria-controls={`sales-directions-${kind}`}
                      aria-expanded={state.serviceKinds.includes(kind)}
                      onChange={() =>
                        patchState(toggleSalesDirectionalService(state, kind))
                      }
                    />
                  </label>
                  {state.serviceKinds.includes(kind) ? (
                    <div
                      id={`sales-directions-${kind}`}
                      className="mt-2 flex gap-2 border-t border-border pt-2"
                    >
                      {(['OUTBOUND', 'RETURN'] as const).map((direction) => (
                        <label
                          key={direction}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 ${salesDirections(state, kind).includes(direction) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={salesDirections(state, kind).includes(
                              direction,
                            )}
                            onChange={() => toggleDirection(kind, direction)}
                          />
                          {direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </fieldset>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {serviceOptions
                .filter(([kind]) => kind !== 'FLIGHT' && kind !== 'TRANSFER')
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
          </div>
        ) : null}
        {step === 0 ? (
          <section className="mt-5 grid gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">تعداد مسافران</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  این تعداد پیش از انتخاب بلیت کنترل می‌شود تا بیشتر از ظرفیت
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
              نوزاد لازم نیست در تعداد صندلی بلیت شمرده شود؛ فقط بزرگسال و کودک
              از ظرفیت بلیت کم می‌شوند. هر نوزاد باید همراه حداقل یک بزرگسال
              باشد.
            </p>
          </section>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-6">
            <h2 className="text-xl font-black">جزئیات خدمات</h2>
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
                <h3 className="font-bold">انتخاب بلیت پرواز</h3>
                <label className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={state.businessOutput === true}
                    onChange={(event) =>
                      patchState({ businessOutput: event.target.checked })
                    }
                  />
                  این بلیت بیزینس است — درج در خروجی
                </label>
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  {flightDirections.includes('OUTBOUND') ? (
                    <section className="grid gap-3 min-w-0">
                      <h3 className="font-bold">بلیت رفت</h3>
                      <ContractFlightEditor
                        value={state.contractFlights?.OUTBOUND}
                        onChange={(value) =>
                          patchState(
                            patchContractFlight(state, 'OUTBOUND', value),
                          )
                        }
                      />
                      {!state.contractFlights?.OUTBOUND ? (
                        <>
                          <FlightDateRangeFilter
                            value={flightRange}
                            onChange={setFlightRange}
                          />
                          <TicketOfferPicker
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
                              departureFrom:
                                flightRange.from &&
                                flightRange.from > futureFrom.slice(0, 10)
                                  ? flightRange.from
                                  : futureFrom,
                              ...(flightRange.to
                                ? { departureTo: flightRange.to }
                                : {}),
                            }}
                            requiredSeats={passengerCounts.seated}
                            selectedId={state.ticket.outboundOfferId}
                            onSelect={(offer) =>
                              patchState({
                                outboundOffer: offer,
                                returnOffer: undefined,
                                contractFlights: {},
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
                      <h3 className="font-bold">انتخاب بلیت برگشت</h3>
                      <ContractFlightEditor
                        value={state.contractFlights?.RETURN}
                        onChange={(value) =>
                          patchState(
                            patchContractFlight(state, 'RETURN', value),
                          )
                        }
                      />
                      {!state.contractFlights?.RETURN ? (
                        <>
                          {!flightDirections.includes('OUTBOUND') ? (
                            <FlightDateRangeFilter
                              value={flightRange}
                              onChange={setFlightRange}
                            />
                          ) : null}
                          <p className="text-sm text-muted-foreground">
                            همه بلیت‌های مقصد به مبدأ از تاریخ بلیت رفت به بعد
                            نمایش داده می‌شوند؛ سقف تاریخ ندارند.
                          </p>
                          {!flightDirections.includes('OUTBOUND') ||
                          salesFlightSelection(state, 'OUTBOUND') ? (
                            <TicketOfferPicker
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
                              key={`return-${salesFlightSelection(state, 'OUTBOUND')?.departureAt ?? futureFrom}-${!flightDirections.includes('OUTBOUND') ? flightRange.from + '-' + flightRange.to : ''}`}
                              query={{
                                originId: state.destinationId,
                                destinationId: state.originId,
                                departureFrom: flightDirections.includes(
                                  'OUTBOUND',
                                )
                                  ? salesReturnSearchFrom(state) >
                                    futureFrom.slice(0, 10)
                                    ? salesReturnSearchFrom(state)
                                    : futureFrom
                                  : flightRange.from &&
                                      flightRange.from > futureFrom.slice(0, 10)
                                    ? flightRange.from
                                    : futureFrom,
                                ...(!flightDirections.includes('OUTBOUND') &&
                                flightRange.to
                                  ? { departureTo: flightRange.to }
                                  : {}),
                              }}
                              requiredSeats={passengerCounts.seated}
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
                                    'زمان حرکت برگشت باید پس از رسیدن بلیت رفت باشد.',
                                  );
                                  return;
                                }
                                setError('');
                                patchState({
                                  returnOffer: offer,
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
                              ابتدا بلیت رفت را در همین صفحه انتخاب کنید.
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
                    اطلاعات هر بلیت را کامل کنید؛ رسیدن باید بعد از حرکت و پرواز
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
            !['HOTEL', 'VISA', 'INSURANCE'].includes(activeDetail) ? (
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
                  هتل‌های شهر{' '}
                  {references.cities.find(
                    (city) => city.id === state.destinationId,
                  )?.name ?? 'مقصد'}
                  ؛ نام هتل را جست‌وجو کنید. ورود پیشنهادی روز بعد از پرواز رفت
                  و خروج روز قبل از پرواز برگشت است؛ هر دو تاریخ قابل تغییرند.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <SearchableReference
                    label="هتل"
                    value={state.hotel.hotelId}
                    options={references.hotels.filter(
                      (hotel) =>
                        hotel.attributes.cityId === state.destinationId,
                    )}
                    onChange={(hotelId) =>
                      patchState({
                        hotel: {
                          ...state.hotel,
                          hotelId,
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
                    options={references.roomTypes}
                    onChange={(roomTypeId) =>
                      patchState({ hotel: { ...state.hotel, roomTypeId } })
                    }
                  />
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
                      نوزاد در ظرفیت صندلی بلیت شمرده نمی‌شود.
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
                    تنظیم دوباره تاریخ‌ها از بلیت
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
                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  {state.passengers
                    .filter((p) => hotelGuestIds.includes(p.customerId))
                    .map((passenger) => (
                      <SearchableReference
                        key={passenger.customerId}
                        label={'نوع اقامت · ' + passenger.displayName}
                        value={
                          state.passengerAccommodations?.[
                            passenger.customerId
                          ] ?? ''
                        }
                        options={salesAccommodationOptions(
                          passenger.birthDate,
                          salesTravelDate(state),
                        )}
                        onChange={(value) =>
                          patchState({
                            passengerAccommodations: {
                              ...state.passengerAccommodations,
                              [passenger.customerId]:
                                value as SalesAccommodationKind,
                            },
                          })
                        }
                      />
                    ))}
                </div>
              </fieldset>
            ) : null}
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
                            : !salesAccommodationsComplete(state)
                              ? 'نوع اقامت هر مسافر هتل را مشخص کنید.'
                              : 'هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.'}
              </p>
            ) : null}
          </section>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-6">
            {state.serviceKinds.includes('TRANSFER') ? (
              <p className="rounded-xl bg-primary/5 p-3 text-sm text-primary">
                ترانسفر{' '}
                {salesDirections(state, 'TRANSFER')
                  .map((direction) =>
                    direction === 'OUTBOUND' ? 'رفت' : 'برگشت',
                  )
                  .join(' و ')}{' '}
                همراه خدمات است؛ هزینهٔ اضافه ندارد و در خروجی بلیت درج می‌شود.
              </p>
            ) : null}
            <SalesPricingPanel
              currencies={references.currencies}
              services={pricingServices}
              nights={pricingNights}
              values={state.servicePricing ?? {}}
              onChange={(key, prices) =>
                patchState({
                  servicePricing: { ...state.servicePricing, [key]: prices },
                })
              }
            />
            <PassengerPackagePrices
              state={state}
              onChange={(passengerPrices) => patchState({ passengerPrices })}
            />
            <SalesPaymentPlan
              payments={state.payments}
              currencies={references.currencies}
              banks={references.banks}
              disabled={!pricingServices.length}
              onChange={(payments) => patchState({ payments })}
            />
            <FormField label="یادداشت قیمت‌گذاری">
              <Textarea
                value={state.pricingNotes}
                onChange={(event) =>
                  patchState({ pricingNotes: event.target.value })
                }
              />
            </FormField>
          </div>
        ) : null}
        {step === 4 ? (
          <div className="grid gap-5">
            {state.serviceKinds.includes('FLIGHT') ? (
              <FlightTicketPreview state={state} cities={references.cities} />
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
            <SalesPricingSummary
              services={pricingServices}
              nights={pricingNights}
              values={state.servicePricing ?? {}}
            />
            {state.serviceKinds.includes('FLIGHT') ? (
              <Alert
                tone="warning"
                title="کنترل موجودی بلیت در تأیید نهایی"
                description="پیش از ارسال، بلیت انتخاب‌شده دوباره بررسی می‌شود. ظرفیت و اجرای خدمات در رزرواسیون پیگیری می‌شود."
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
                  setFutureFrom(new Date().toISOString());
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
