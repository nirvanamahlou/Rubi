'use client';

import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
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
  SalesPriceComponentInput,
  SalesServiceKind,
} from '@rubi/contracts';

import { Button, buttonVariants } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '../api/client';
import { TicketOfferPicker } from './ticket-offer-picker';
import { SearchableReference } from './searchable-reference';
import { FlightTicketPreview } from './flight-ticket-preview';
import { SalesPersonCreate } from './sales-person-create';
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
  const [state, setState] = useState<SalesFormState>(emptySalesForm);
  const [customers, setCustomers] = useState<readonly CustomerSummary[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
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
  const [hotelSearch, setHotelSearch] = useState('');
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
      return {
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
      };
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

  const lookupCustomers = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await customersApi.list({
        search: customerSearch,
        kind: 'all',
        status: 'active',
        role: 'all',
        branchId: 'all',
        createdFrom: null,
        createdTo: null,
        updatedFrom: null,
        updatedTo: null,
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: 1,
        pageSize: 20,
      });
      setCustomers(response.data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'جستجوی مشتری ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const selectCustomer = (customer: CustomerSummary) => {
    setState((current) => ({
      ...current,
      ...selectSalesPerson(current, customer, true),
    }));
  };
  const addPassenger = (customer: CustomerSummary) => {
    if (
      !customer.roles.includes('passenger') ||
      state.passengers.some(({ customerId }) => customerId === customer.id)
    )
      return;
    setState((current) => ({
      ...current,
      ...selectSalesPerson(current, customer, false),
    }));
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
    key.startsWith('FLIGHT-')
      ? `بلیت ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
      : key.startsWith('TRANSFER-')
        ? `ترانسفر ${key.endsWith('OUTBOUND') ? 'رفت' : 'برگشت'}`
        : (serviceOptions.find(([kind]) => kind === key)?.[1] ?? key);
  const updatePrice = (
    index: number,
    patch: Partial<SalesPriceComponentInput>,
  ) =>
    patchState({
      priceComponents: state.priceComponents.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    });
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
            Boolean(state.returnOffer))
        );
      if (activeDetail === 'HOTEL')
        return Boolean(
          state.hotel.hotelId &&
          state.hotel.checkIn &&
          state.hotel.checkOut &&
          state.hotel.checkOut > state.hotel.checkIn &&
          state.hotel.roomTypeId,
        );
      if (activeDetail === 'VISA') return Boolean(state.visaReferenceId);
      return true;
    }
    if (step === 2)
      return (
        Boolean(state.customerId) &&
        !createPersonMode &&
        Boolean(salesTravelDate(state)) &&
        state.passengers.length > 0 &&
        state.passengers.every((item) => item.birthDate)
      );
    if (step === 3)
      return (
        state.priceComponents.length > 0 &&
        state.priceComponents.every((item) => item.amount && item.currencyCode)
      );
    return true;
  }, [state, step, activeDetail, createPersonMode]);
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
          <div className="grid gap-5">
            <h2 className="text-xl font-black">انتخاب مشتری و مسافران</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setCreatePersonMode('customer')}
              >
                <Plus className="size-4" />
                مشتری جدید
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setCreatePersonMode('passenger')}
              >
                <Plus className="size-4" />
                مسافر جدید
              </Button>
            </div>
            {createPersonMode ? (
              <SalesPersonCreate
                key={createPersonMode}
                mode={createPersonMode}
                onBusyChange={setBusy}
                onCancel={() => setCreatePersonMode(null)}
                onCreated={(person, birthDate) => {
                  setState((current) => ({
                    ...current,
                    ...selectSalesPerson(
                      current,
                      person,
                      createPersonMode === 'customer',
                      birthDate,
                    ),
                  }));
                  setCustomers((current) => [
                    person,
                    ...current.filter((item) => item.id !== person.id),
                  ]);
                  setCreatePersonMode(null);
                }}
              />
            ) : null}
            <div className="flex gap-2">
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="جست‌وجوی مشتری یا مسافر موجود"
              />
              <Button
                type="button"
                loading={busy}
                onClick={() => void lookupCustomers()}
              >
                <Search className="size-4" />
                جستجو
              </Button>
            </div>
            {state.customerId ? (
              <Alert
                title={`مشتری انتخاب‌شده: ${state.customerName}`}
                description={`${state.customerId} · ${state.passengers.length} مسافر`}
              />
            ) : null}
            <div className="grid gap-2 md:grid-cols-2">
              {customers.map((customer) => (
                <div
                  className="rounded-xl border border-border p-4"
                  key={customer.id}
                >
                  <strong>{customer.displayName}</strong>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {customer.maskedPrimaryContact ?? 'بدون تماس قابل نمایش'} ·{' '}
                    {customer.roles.join('، ')}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => selectCustomer(customer)}
                    >
                      {state.customerId === customer.id
                        ? 'مشتری انتخاب‌شده'
                        : 'انتخاب مشتری قرارداد'}
                    </Button>
                    {customer.roles.includes('passenger') ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        disabled={state.passengers.some(
                          (item) => item.customerId === customer.id,
                        )}
                        onClick={() => addPassenger(customer)}
                      >
                        {state.passengers.some(
                          (item) => item.customerId === customer.id,
                        )
                          ? 'مسافر اضافه شده'
                          : 'افزودن مسافر'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {step === 0 ? (
          <div className="grid gap-5">
            <h2 className="text-sm font-bold">مسیر سفر</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  (item) => item.attributes.countryId === state.originCountryId,
                )}
                onChange={(originId) => patchState({ originId })}
              />
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
                <h3 className="font-bold">
                  انتخاب {detailLabel(activeDetail)}
                </h3>
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
            {activeDetail === 'HOTEL' ? (
              <section className="grid gap-4 rounded-xl border p-4">
                <h3 className="font-bold">هتل مقصد</h3>
                <Input
                  aria-label="جست‌وجوی هتل مقصد"
                  placeholder="جست‌وجوی نام هتل"
                  value={hotelSearch}
                  onChange={(event) => setHotelSearch(event.target.value)}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <ReferenceSelect
                    label="هتل"
                    value={state.hotel.hotelId}
                    options={references.hotels.filter(
                      (hotel) =>
                        hotel.attributes.cityId === state.destinationId &&
                        hotel.name.includes(hotelSearch),
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
                  <FormField label="ورود">
                    <DatePicker
                      value={state.hotel.checkIn}
                      onChange={(checkIn) =>
                        patchState({ hotel: { ...state.hotel, checkIn } })
                      }
                    />
                  </FormField>
                  <FormField label="خروج">
                    <DatePicker
                      value={state.hotel.checkOut}
                      onChange={(checkOut) =>
                        patchState({ hotel: { ...state.hotel, checkOut } })
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
          <div className="mt-5 grid gap-5 border-t border-border pt-4">
            <div>
              <h2 className="text-xl font-black">مسافران و تخصیص خدمات</h2>
              <p className="text-sm text-muted-foreground">
                در این نسخه همه خدمات انتخاب‌شده به هر مسافر تخصیص می‌یابد.
              </p>
            </div>
            {!state.serviceKinds.includes('FLIGHT') &&
            !(state.serviceKinds.includes('HOTEL') && state.hotel.checkIn) ? (
              <FormField label="تاریخ شروع خدمات (برای سن مسافر)" required>
                <DatePicker
                  value={state.departureDate}
                  onChange={(departureDate) => patchState({ departureDate })}
                />
              </FormField>
            ) : null}
            <div className="grid gap-3">
              {state.passengers.map((passenger, index) => (
                <div
                  className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_auto]"
                  key={`${passenger.customerId}-${index}`}
                >
                  <div>
                    <strong>{passenger.displayName}</strong>
                    <p className="text-sm text-primary">
                      {salesPassengerAgeLabel(
                        passenger.birthDate,
                        salesTravelDate(state),
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {passenger.customerId}
                    </p>
                  </div>
                  <FormField label="تاریخ تولد" required>
                    <DatePicker
                      value={passenger.birthDate}
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
                    aria-label="حذف مسافر"
                    size="icon"
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      patchState({
                        passengers: state.passengers.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Alert
              title="افزودن مسافر دیگر"
              description="از جست‌وجوی بالای همین بخش، مسافر موجود را انتخاب کنید یا دکمه مسافر جدید را بزنید."
            />
          </div>
        ) : null}
        {step === 3 ? (
          <div className="grid gap-6">
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">
                  قرارداد ریالی، ارزی یا ترکیبی
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    patchState({
                      priceComponents: [
                        ...state.priceComponents,
                        {
                          type: 'BASE',
                          title: 'جزء قیمت',
                          amount: '',
                          currencyCode: 'IRR',
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  جزء قیمت
                </Button>
              </div>
              {state.priceComponents.map((price, index) => (
                <div
                  className="grid gap-3 rounded-xl border p-4 md:grid-cols-4"
                  key={index}
                >
                  <select
                    className={fieldClass}
                    value={price.type}
                    onChange={(event) =>
                      updatePrice(index, {
                        type: event.target
                          .value as SalesPriceComponentInput['type'],
                      })
                    }
                  >
                    <option value="BASE">مبلغ پایه</option>
                    <option value="DISCOUNT">تخفیف</option>
                    <option value="TAX">مالیات</option>
                    <option value="SURCHARGE">افزوده</option>
                  </select>
                  <Input
                    value={price.title}
                    onChange={(event) =>
                      updatePrice(index, { title: event.target.value })
                    }
                    placeholder="عنوان"
                  />
                  <Input
                    dir="ltr"
                    value={price.amount}
                    onChange={(event) =>
                      updatePrice(index, { amount: event.target.value })
                    }
                    placeholder="مبلغ توافقی"
                  />
                  <Input
                    dir="ltr"
                    maxLength={3}
                    value={price.currencyCode}
                    onChange={(event) =>
                      updatePrice(index, {
                        currencyCode: event.target.value.toUpperCase(),
                      })
                    }
                    placeholder="IRR"
                  />
                </div>
              ))}
            </section>
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
                  <Input
                    dir="ltr"
                    value={payment.amount}
                    onChange={(event) =>
                      patchState({
                        payments: state.payments.map((item, position) =>
                          position === index
                            ? { ...item, amount: event.target.value }
                            : item,
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
