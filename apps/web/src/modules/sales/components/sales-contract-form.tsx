'use client';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  CustomerSummary,
  MasterDataRecord,
  MasterDataResource,
  SalesPaymentMethod,
  SalesServiceKind,
} from '@rubi/contracts';

import { hotelNights } from '@rubi/contracts';
import { SalesPricingPanel, SalesPricingSummary } from './sales-pricing-panel';
import { MoneyInput as SalesMoneyInput } from '@/components/ui/money-input';
import { Button, buttonVariants } from '@/components/ui/button';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '../api/client';
import { TicketOfferPicker } from './ticket-offer-picker';
import { SearchableReference } from './searchable-reference';
import { FlightTicketPreview } from './flight-ticket-preview';
import { SalesPersonCreate } from './sales-person-create';
import { SalesPersonSearch } from './sales-person-search';
import { SalesOrganizationCustomer } from './sales-organization-customer';
import {
  FlightDateRangeFilter,
  type FlightDateRange,
} from './flight-date-range';
import {
  emptySalesForm,
  selectSalesPerson,
  salesPayload,
  salesSteps,
  salesPassengerAgeLabel,
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
const fieldClass =
  'h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

function ReferenceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly MasterDataRecord[];
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} required>
      <select
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">انتخاب کنید</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} ({item.code})
          </option>
        ))}
      </select>
    </FormField>
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
  const [lookupPurpose, setLookupPurpose] = useState<
    'customer' | 'passenger' | null
  >(null);
  const [pendingPassengers, setPendingPassengers] = useState<number[]>([]);
  const nextPassengerKey = useRef(0);
  const addPassengerRow = () => {
    setCreatePersonMode(null);
    setLookupPurpose(null);
    const key = nextPassengerKey.current++;
    setPendingPassengers((current) => [...current, key]);
  };
  const [createPersonMode, setCreatePersonMode] = useState<
    'customer' | 'passenger' | null
  >(null);
  const [references, setReferences] = useState<{
    countries: readonly MasterDataRecord[];
    cities: readonly MasterDataRecord[];
    hotels: readonly MasterDataRecord[];
    roomTypes: readonly MasterDataRecord[];
    visaServices: readonly MasterDataRecord[];
    banks: readonly MasterDataRecord[];
  }>({
    countries: [],
    cities: [],
    hotels: [],
    roomTypes: [],
    visaServices: [],
    banks: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNumber, setSavedNumber] = useState('');
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
            const restored = {
              ...emptySalesForm,
              ...JSON.parse(saved),
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
    ])
      .then(([countries, cities, hotels, roomTypes, visaServices, banks]) => {
        setReferences({
          countries: countries.data,
          cities: cities.data,
          hotels: hotels.data,
          roomTypes: roomTypes.data,
          visaServices: visaServices.data,
          banks: banks.data,
        });
        setState((current) =>
          withSalesRouteDefaults(current, countries.data, cities.data),
        );
      })
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

  const selectCustomer = (customer: CustomerSummary) => {
    setLookupPurpose(null);
    setState((current) => ({
      ...current,
      ...selectSalesPerson(current, customer, true),
      passengers: current.passengers,
      firstPassengerIsCustomer: false,
    }));
  };
  const addPassenger = (customer: CustomerSummary) => {
    setLookupPurpose(null);
    if (
      !customer.roles.includes('passenger') ||
      state.passengers.some(({ customerId }) => customerId === customer.id)
    )
      return;
    setState((current) =>
      withFirstPassengerCustomer({
        ...current,
        ...selectSalesPerson(current, customer, false),
      }),
    );
  };
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
  const pricingServices = state.serviceKinds.flatMap((kind) =>
    kind === 'FLIGHT' || kind === 'TRANSFER'
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
  const canContinue = useMemo(() => {
    if (step === 0)
      return Boolean(
        state.originId &&
        state.originCountryId &&
        state.destinationCountryId &&
        state.destinationId &&
        state.originId !== state.destinationId &&
        state.serviceKinds.length,
      );
    if (step === 1) {
      if (activeDetail === 'FLIGHT')
        return (
          (!salesDirections(state, 'FLIGHT').includes('OUTBOUND') ||
            Boolean(state.outboundOffer)) &&
          (!salesDirections(state, 'FLIGHT').includes('RETURN') ||
            Boolean(state.returnOffer)) &&
          (!state.serviceKinds.includes('HOTEL') || salesHotelValid(state))
        );
      if (activeDetail === 'HOTEL') return salesHotelValid(state);
      if (activeDetail === 'VISA') return Boolean(state.visaReferenceId);
      return true;
    }
    if (step === 2)
      return (
        Boolean(state.customerId) &&
        !createPersonMode &&
        pendingPassengers.length === 0 &&
        Boolean(salesTravelDate(state)) &&
        state.passengers.length > 0 &&
        state.passengers.every((item) => item.birthDate)
      );
    if (step === 3) {
      try {
        return (
          salesPayload({ ...state, servicePricing: state.servicePricing ?? {} })
            .priceComponents.length > 0
        );
      } catch {
        return false;
      }
    }
    return true;
  }, [state, step, activeDetail, createPersonMode, pendingPassengers.length]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step !== salesSteps.length - 1 || busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = salesPayload(state);
      const fingerprint = JSON.stringify(payload);
      if (submission.current.fingerprint !== fingerprint)
        submission.current = { fingerprint, key: crypto.randomUUID() };
      const response = await salesApi.create(payload, submission.current.key);
      if (response.data.status !== 'SENT_TO_RESERVATIONS')
        await salesApi.confirm(response.data.id, response.data.version);
      globalThis.localStorage?.removeItem('rubi.sales.contract.draft.v1');
      setSavedNumber(response.data.contractNumber);
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
        {state.serviceKinds.includes('FLIGHT') ? (
          <div className="mt-5">
            <FlightTicketPreview state={state} cities={references.cities} />
          </div>
        ) : null}
      </Card>
    );

  return (
    <form className="mx-auto grid w-full max-w-6xl gap-4" onSubmit={submit}>
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
      <Card className="p-4 sm:p-5">
        {step === 2 ? (
          <section className="grid gap-4" aria-label="مشتری قرارداد">
            <div>
              <h2 className="text-lg font-black">۱. مشتری قرارداد</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                قرارداد به نام چه شخص یا سازمانی ثبت می‌شود؟
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="نوع مشتری قرارداد"
            >
              {(['person', 'organization', 'first-passenger'] as const).map(
                (kind) => {
                  const selected =
                    kind === 'first-passenger'
                      ? state.firstPassengerIsCustomer === true
                      : !state.firstPassengerIsCustomer &&
                        (state.customerKind ?? 'person') === kind;
                  return (
                    <Button
                      key={kind}
                      type="button"
                      disabled={busy}
                      variant={selected ? 'primary' : 'outline'}
                      aria-pressed={selected}
                      onClick={() => {
                        if (selected) return;
                        setCreatePersonMode(null);
                        setLookupPurpose(null);
                        patchState({
                          customerKind:
                            kind === 'organization' ? 'organization' : 'person',
                          customerId: '',
                          customerName: '',
                          customerOrganizationId: '',
                          firstPassengerIsCustomer: kind === 'first-passenger',
                        });
                      }}
                    >
                      {kind === 'person'
                        ? 'شخص حقیقی'
                        : kind === 'organization'
                          ? 'حقوقی / آژانس'
                          : 'همان مسافر اول'}
                    </Button>
                  );
                },
              )}
            </div>
            {state.customerId ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <div className="flex items-center gap-2">
                  <Check className="size-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      مشتری انتخاب‌شده
                    </p>
                    <strong>{state.customerName}</strong>
                  </div>
                </div>
                {!state.firstPassengerIsCustomer ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      patchState({ customerId: '', customerName: '' });
                      setLookupPurpose(null);
                    }}
                  >
                    تغییر مشتری
                  </Button>
                ) : null}
              </div>
            ) : state.firstPassengerIsCustomer ? (
              <p className="rounded-xl bg-primary/5 p-3 text-sm">
                اولین مسافر را در بخش پایین اضافه کنید؛ همان شخص مشتری قرارداد
                می‌شود.
              </p>
            ) : null}
            {!state.customerId && state.customerKind === 'organization' ? (
              <SalesOrganizationCustomer
                disabled={busy}
                selectedOrganizationId={state.customerOrganizationId ?? ''}
                onClear={() =>
                  patchState({
                    customerId: '',
                    customerName: '',
                    customerOrganizationId: '',
                  })
                }
                onBusyChange={setBusy}
                onSelected={(person) =>
                  patchState({
                    ...selectSalesPerson(state, person, true),
                    firstPassengerIsCustomer: false,
                  })
                }
              />
            ) : null}
            {!state.customerId &&
            state.customerKind !== 'organization' &&
            !state.firstPassengerIsCustomer ? (
              <>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || pendingPassengers.length > 0}
                    onClick={() => {
                      setCreatePersonMode(null);
                      setLookupPurpose('customer');
                    }}
                  >
                    انتخاب مشتری موجود
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || pendingPassengers.length > 0}
                    onClick={() => {
                      setLookupPurpose(null);
                      setCreatePersonMode('customer');
                    }}
                  >
                    <Plus className="size-4" /> ثبت مشتری جدید
                  </Button>
                </div>
                {lookupPurpose === 'customer' ? (
                  <SalesPersonSearch
                    purpose="customer"
                    selectedIds={[]}
                    onCancel={() => setLookupPurpose(null)}
                    onSelect={selectCustomer}
                  />
                ) : null}
                {createPersonMode === 'customer' ? (
                  <SalesPersonCreate
                    mode="customer"
                    saveDisabled={busy}
                    onBusyChange={setBusy}
                    onCancel={() => setCreatePersonMode(null)}
                    onCreated={(person, birthDate) => {
                      patchState({
                        ...selectSalesPerson(state, person, true, birthDate),
                        firstPassengerIsCustomer: false,
                      });
                      setCreatePersonMode(null);
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </section>
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
                        selectedId={state.ticket.outboundOfferId}
                        onSelect={(offer) =>
                          patchState({
                            outboundOffer: offer,
                            returnOffer: undefined,
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
                    </section>
                  ) : null}
                  {flightDirections.includes('RETURN') ? (
                    <section className="grid gap-3 min-w-0">
                      <h3 className="font-bold">انتخاب بلیت برگشت</h3>
                      {!flightDirections.includes('OUTBOUND') ? (
                        <FlightDateRangeFilter
                          value={flightRange}
                          onChange={setFlightRange}
                        />
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        همه بلیت‌های مقصد به مبدأ از تاریخ بلیت رفت به بعد نمایش
                        داده می‌شوند؛ سقف تاریخ ندارند.
                      </p>
                      {!flightDirections.includes('OUTBOUND') ||
                      state.outboundOffer ? (
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
                          key={`return-${state.outboundOffer?.id ?? futureFrom}-${!flightDirections.includes('OUTBOUND') ? flightRange.from + '-' + flightRange.to : ''}`}
                          query={{
                            originId: state.destinationId,
                            destinationId: state.originId,
                            departureFrom: flightDirections.includes('OUTBOUND')
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
                          selectedId={state.ticket.returnOfferId}
                          onSelect={(offer) => {
                            if (
                              state.outboundOffer &&
                              Date.parse(offer.departureAt) <
                                Date.parse(state.outboundOffer.arrivalAt)
                            ) {
                              setError(
                                'زمان حرکت برگشت باید پس از رسیدن بلیت رفت باشد.',
                              );
                              return;
                            }
                            setError('');
                            patchState({
                              returnOffer: offer,
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
                    </section>
                  ) : null}
                </div>
              </section>
            ) : null}
            {activeDetail &&
            activeDetail !== 'FLIGHT' &&
            !activeDetail.startsWith('TRANSFER-') &&
            !['HOTEL', 'VISA'].includes(activeDetail) ? (
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
                  <FormField label="تعداد اتاق">
                    <Input
                      min={1}
                      type="number"
                      value={state.hotel.roomCount}
                      onChange={(event) =>
                        patchState({
                          hotel: {
                            ...state.hotel,
                            roomCount: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="تعداد نفر">
                    <Input
                      min={1}
                      type="number"
                      value={state.hotel.occupancy}
                      onChange={(event) =>
                        patchState({
                          hotel: {
                            ...state.hotel,
                            occupancy: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </FormField>
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
          <section
            className="mt-6 grid gap-4 border-t border-border pt-5"
            aria-label="مسافران قرارداد"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">۲. مسافران سفر</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.passengers.length} مسافر اضافه‌شده
                  {pendingPassengers.length
                    ? ` · ${pendingPassengers.length} ردیف در انتظار ثبت`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    busy ||
                    pendingPassengers.length > 0 ||
                    createPersonMode !== null
                  }
                  onClick={() => {
                    setCreatePersonMode(null);
                    setLookupPurpose('passenger');
                  }}
                >
                  انتخاب مسافر موجود
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || createPersonMode !== null}
                  onClick={addPassengerRow}
                >
                  <Plus className="size-4" /> مسافر جدید
                </Button>
              </div>
            </div>
            {!state.serviceKinds.includes('FLIGHT') &&
            !(state.serviceKinds.includes('HOTEL') && state.hotel.checkIn) ? (
              <FormField label="تاریخ شروع سفر برای محاسبه سن" required>
                <DatePicker
                  value={state.departureDate}
                  onChange={(departureDate) => patchState({ departureDate })}
                />
              </FormField>
            ) : null}
            {lookupPurpose === 'passenger' ? (
              <SalesPersonSearch
                purpose="passenger"
                selectedIds={state.passengers.map(
                  (person) => person.customerId,
                )}
                onCancel={() => setLookupPurpose(null)}
                onSelect={addPassenger}
              />
            ) : null}
            {!state.passengers.length &&
            !pendingPassengers.length &&
            lookupPurpose !== 'passenger' ? (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                هنوز مسافری اضافه نشده است. از یکی از دو دکمه بالا استفاده کنید.
              </p>
            ) : null}
            <div className="grid gap-2">
              {state.passengers.map((passenger, index) => (
                <div
                  className="grid items-center gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_220px_auto]"
                  key={passenger.customerId}
                >
                  <div>
                    <p className="text-xs text-muted-foreground">
                      مسافر {index + 1}
                    </p>
                    <strong className="break-words">
                      {passenger.displayName}
                    </strong>
                    <p className="mt-1 text-sm text-primary">
                      {salesPassengerAgeLabel(
                        passenger.birthDate,
                        salesTravelDate(state),
                      )}
                    </p>
                    {state.customerId === passenger.customerId ? (
                      <Badge>مشتری قرارداد</Badge>
                    ) : null}
                  </div>
                  <FormField label="تاریخ تولد مسافر" required>
                    <DatePicker
                      value={passenger.birthDate}
                      disabled={busy}
                      onChange={(birthDate) =>
                        patchState({
                          passengers: state.passengers.map((item, position) =>
                            position === index ? { ...item, birthDate } : item,
                          ),
                        })
                      }
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`حذف مسافر ${index + 1}`}
                    onClick={() =>
                      patchState({
                        passengers: state.passengers.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4" /> حذف
                  </Button>
                </div>
              ))}
            </div>
            {pendingPassengers.map((key, index) =>
              index === 0 ? (
                <SalesPersonCreate
                  key={key}
                  title={`ثبت مسافر ${state.passengers.length + 1}`}
                  mode="passenger"
                  alsoCustomer={
                    state.firstPassengerIsCustomer === true &&
                    state.passengers.length === 0
                  }
                  saveDisabled={busy}
                  onBusyChange={setBusy}
                  onCancel={() =>
                    setPendingPassengers((current) =>
                      current.filter((item) => item !== key),
                    )
                  }
                  onCreated={(person, birthDate) => {
                    setState((current) =>
                      withFirstPassengerCustomer({
                        ...current,
                        ...selectSalesPerson(current, person, false, birthDate),
                      }),
                    );
                    setPendingPassengers((current) =>
                      current.filter((item) => item !== key),
                    );
                  }}
                />
              ) : (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-dashed px-3 py-2 text-sm"
                >
                  <span>
                    مسافر {state.passengers.length + index + 1} · بعد از ثبت
                    ردیف قبل
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setPendingPassengers((current) =>
                        current.filter((item) => item !== key),
                      )
                    }
                  >
                    حذف ردیف
                  </Button>
                </div>
              ),
            )}
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
                    : pendingPassengers.length || createPersonMode
                      ? 'ردیف باز را ثبت یا لغو کنید.'
                      : 'تاریخ تولد مسافران و تاریخ سفر را کامل کنید.'}
              </p>
            ) : null}
          </section>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-6">
            <SalesPricingPanel
              services={pricingServices}
              nights={pricingNights}
              values={state.servicePricing ?? {}}
              onChange={(key, prices) =>
                patchState({
                  servicePricing: { ...state.servicePricing, [key]: prices },
                })
              }
            />
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">برنامه چندپرداختی و چک</h3>
                  <p className="text-xs text-muted-foreground">
                    این برنامه مانده را کم نمی‌کند تا Finance پرداخت را تأیید
                    کند.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    patchState({
                      payments: [
                        ...state.payments,
                        {
                          amount: '',
                          currencyCode: 'IRR',
                          dueAt: '',
                          method: 'BANK_TRANSFER',
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  افزودن پرداخت
                </Button>
              </div>
              {state.payments.map((payment, index) => (
                <div
                  className="grid gap-3 rounded-xl border p-4 md:grid-cols-4"
                  key={index}
                >
                  <SalesMoneyInput
                    dir="ltr"
                    value={payment.amount}
                    onValueChange={(amount) =>
                      patchState({
                        payments: state.payments.map((item, position) =>
                          position === index ? { ...item, amount } : item,
                        ),
                      })
                    }
                    placeholder="مبلغ"
                  />
                  <Input
                    dir="ltr"
                    maxLength={3}
                    value={payment.currencyCode}
                    onChange={(event) =>
                      patchState({
                        payments: state.payments.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                currencyCode: event.target.value.toUpperCase(),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <DatePicker
                    includeTime
                    value={payment.dueAt}
                    onChange={(dueAt) =>
                      patchState({
                        payments: state.payments.map((item, position) =>
                          position === index ? { ...item, dueAt } : item,
                        ),
                      })
                    }
                  />
                  <select
                    className={fieldClass}
                    value={payment.method}
                    onChange={(event) =>
                      patchState({
                        payments: state.payments.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                method: event.target
                                  .value as SalesPaymentMethod,
                              }
                            : item,
                        ),
                      })
                    }
                  >
                    <option value="BANK_TRANSFER">حواله بانکی</option>
                    <option value="CASH">نقد</option>
                    <option value="POS">کارت‌خوان</option>
                    <option value="ONLINE_GATEWAY">درگاه</option>
                    <option value="CHECK">چک</option>
                  </select>
                  {payment.method === 'CHECK' ? (
                    <>
                      <Input
                        placeholder="شناسه امن چک"
                        onChange={(event) =>
                          patchState({
                            payments: state.payments.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    check: {
                                      bankId: item.check?.bankId ?? '',
                                      secureIdentifier: event.target.value,
                                      ownerName: item.check?.ownerName ?? '',
                                      dueDate: item.check?.dueDate ?? '',
                                    },
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                      <ReferenceSelect
                        label="بانک"
                        value={payment.check?.bankId ?? ''}
                        options={references.banks}
                        onChange={(bankId) =>
                          patchState({
                            payments: state.payments.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    check: {
                                      bankId,
                                      secureIdentifier:
                                        item.check?.secureIdentifier ?? '',
                                      ownerName: item.check?.ownerName ?? '',
                                      dueDate: item.check?.dueDate ?? '',
                                    },
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                      <Input
                        placeholder="نام صاحب چک"
                        onChange={(event) =>
                          patchState({
                            payments: state.payments.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    check: {
                                      bankId: item.check?.bankId ?? '',
                                      secureIdentifier:
                                        item.check?.secureIdentifier ?? '',
                                      ownerName: event.target.value,
                                      dueDate: item.check?.dueDate ?? '',
                                    },
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                      <DatePicker
                        value={payment.check?.dueDate ?? ''}
                        onChange={(dueDate) =>
                          patchState({
                            payments: state.payments.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    check: {
                                      bankId: item.check?.bankId ?? '',
                                      secureIdentifier:
                                        item.check?.secureIdentifier ?? '',
                                      ownerName: item.check?.ownerName ?? '',
                                      dueDate,
                                    },
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`حذف پرداخت ${index + 1}`}
                    onClick={() =>
                      patchState({
                        payments: state.payments.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    حذف پرداخت
                  </Button>
                </div>
              ))}
            </section>
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
