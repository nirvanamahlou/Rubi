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
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type {
  CustomerSummary,
  MasterDataRecord,
  SalesPaymentMethod,
  SalesPriceComponentInput,
  SalesServiceKind,
} from '@rubi/contracts';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/surfaces';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '../api/client';
import {
  emptySalesForm,
  salesPayload,
  salesSteps,
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
  const [state, setState] = useState<SalesFormState>(emptySalesForm);
  const [customers, setCustomers] = useState<readonly CustomerSummary[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [references, setReferences] = useState<{
    cities: readonly MasterDataRecord[];
    hotels: readonly MasterDataRecord[];
    roomTypes: readonly MasterDataRecord[];
    visaServices: readonly MasterDataRecord[];
    banks: readonly MasterDataRecord[];
  }>({ cities: [], hotels: [], roomTypes: [], visaServices: [], banks: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedNumber, setSavedNumber] = useState('');
  const patchState = (patch: Partial<SalesFormState>) =>
    setState((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem(
      'rubi.sales.contract.draft.v1',
    );
    const restoreTimer = saved
      ? globalThis.setTimeout(() => {
          try {
            setState(JSON.parse(saved) as SalesFormState);
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
    void Promise.all([
      masterDataApi.list('cities', query),
      masterDataApi.list('hotels', query),
      masterDataApi.list('room-types', query),
      masterDataApi.list('visa-services', query),
      masterDataApi.list('banks', query),
    ])
      .then(([cities, hotels, roomTypes, visaServices, banks]) =>
        setReferences({
          cities: cities.data,
          hotels: hotels.data,
          roomTypes: roomTypes.data,
          visaServices: visaServices.data,
          banks: banks.data,
        }),
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
    patchState({
      customerId: customer.id,
      customerName: customer.displayName,
      passengers: customer.roles.includes('passenger')
        ? [
            {
              customerId: customer.id,
              displayName: customer.displayName,
              birthDate: '',
            },
          ]
        : state.passengers,
    });
  };
  const addPassenger = (customer: CustomerSummary) => {
    if (
      !customer.roles.includes('passenger') ||
      state.passengers.some(({ customerId }) => customerId === customer.id)
    )
      return;
    patchState({
      passengers: [
        ...state.passengers,
        {
          customerId: customer.id,
          displayName: customer.displayName,
          birthDate: '',
        },
      ],
    });
  };
  const toggleService = (kind: SalesServiceKind) =>
    patchState({
      serviceKinds: state.serviceKinds.includes(kind)
        ? state.serviceKinds.filter((item) => item !== kind)
        : [...state.serviceKinds, kind],
    });
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
    if (step === 0) return Boolean(state.customerId);
    if (step === 1)
      return Boolean(
        state.originId &&
        state.destinationId &&
        state.departureDate &&
        (state.tripType === 'ONE_WAY' || state.returnDate),
      );
    if (step === 2) return state.serviceKinds.length > 0;
    if (step === 4)
      return (
        state.passengers.length > 0 &&
        state.passengers.every((item) => item.birthDate)
      );
    if (step === 5)
      return state.priceComponents.every(
        (item) => item.amount && item.currencyCode,
      );
    return true;
  }, [state, step]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await salesApi.create(salesPayload(state));
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

  if (savedNumber)
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-700">
          <Check className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-black">قرارداد ثبت شد</h1>
        <p className="mt-2 text-muted-foreground">
          شماره قرارداد: <strong dir="ltr">{savedNumber}</strong>
        </p>
        <Button className="mt-6" onClick={() => router.push('/sales')}>
          بازگشت به فروش
        </Button>
      </Card>
    );

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <PageHeader
        eyebrow="Sales Contract · v1"
        title="قرارداد جدید"
        description="فرم تمام‌صفحه با ذخیره خودکار پیش‌نویس محلی؛ ثبت نهایی فقط در API واقعی انجام می‌شود."
      />
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-7">
        {salesSteps.map((label, index) => (
          <li
            className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${index === step ? 'border-primary bg-primary/10 text-primary' : index < step ? 'border-emerald-500/30 text-emerald-700' : 'border-border text-muted-foreground'}`}
            key={label}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? (
        <Alert tone="error" title="عملیات کامل نشد" description={error} />
      ) : null}
      <Card className="min-h-[420px] p-5 md:p-7">
        {step === 0 ? (
          <div className="grid gap-5">
            <h2 className="text-xl font-black">انتخاب مشتری و مسافران</h2>
            <div className="flex gap-2">
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="نام یا شناسه مشتری"
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
                      مشتری قرارداد
                    </Button>
                    {customer.roles.includes('passenger') ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => addPassenger(customer)}
                      >
                        افزودن مسافر
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="grid gap-5">
            <h2 className="text-xl font-black">مسیر و تاریخ سفر</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <ReferenceSelect
                label="مبدأ"
                value={state.originId}
                options={references.cities}
                onChange={(originId) => patchState({ originId })}
              />
              <ReferenceSelect
                label="مقصد"
                value={state.destinationId}
                options={references.cities}
                onChange={(destinationId) => patchState({ destinationId })}
              />
              <FormField label="نوع سفر" required>
                <select
                  className={fieldClass}
                  value={state.tripType}
                  onChange={(event) =>
                    patchState({
                      tripType: event.target
                        .value as SalesFormState['tripType'],
                    })
                  }
                >
                  <option value="ONE_WAY">یک‌طرفه</option>
                  <option value="ROUND_TRIP">رفت‌وبرگشت</option>
                </select>
              </FormField>
              <FormField label="تاریخ رفت" required>
                <DatePicker
                  value={state.departureDate}
                  onChange={(departureDate) => patchState({ departureDate })}
                />
              </FormField>
              {state.tripType === 'ROUND_TRIP' ? (
                <FormField label="تاریخ بازگشت" required>
                  <DatePicker
                    value={state.returnDate}
                    onChange={(returnDate) => patchState({ returnDate })}
                  />
                </FormField>
              ) : null}
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="grid gap-5">
            <h2 className="text-xl font-black">خدمات قرارداد</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serviceOptions.map(([kind, label]) => (
                <button
                  className={`flex items-center justify-between rounded-xl border p-4 text-start ${state.serviceKinds.includes(kind) ? 'border-primary bg-primary/5' : 'border-border'}`}
                  key={kind}
                  onClick={() => toggleService(kind)}
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
        {step === 3 ? (
          <div className="grid gap-6">
            <h2 className="text-xl font-black">جزئیات خدمات</h2>
            {state.serviceKinds.includes('FLIGHT') ? (
              <section className="grid gap-4 rounded-xl border p-4">
                <div>
                  <h3 className="font-bold">بلیت رفت‌وبرگشت</h3>
                  <p className="text-xs text-amber-700">
                    شناسه پیشنهاد از Public Contract Ticket Management است؛
                    هنگام تأیید دوباره بررسی می‌شود.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Offer رفت">
                    <Input
                      value={state.ticket.outboundOfferId}
                      onChange={(event) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            outboundOfferId: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="حرکت رفت">
                    <DatePicker
                      includeTime
                      value={state.ticket.outboundDepartureAt}
                      onChange={(outboundDepartureAt) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            outboundDepartureAt,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="رسیدن رفت">
                    <DatePicker
                      includeTime
                      value={state.ticket.outboundArrivalAt}
                      onChange={(outboundArrivalAt) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            outboundArrivalAt,
                          },
                        })
                      }
                    />
                  </FormField>
                  {state.tripType === 'ROUND_TRIP' ? (
                    <>
                      <FormField label="Offer برگشت">
                        <Input
                          value={state.ticket.returnOfferId}
                          onChange={(event) =>
                            patchState({
                              ticket: {
                                ...state.ticket,
                                returnOfferId: event.target.value,
                              },
                            })
                          }
                        />
                      </FormField>
                      <FormField label="حرکت برگشت">
                        <DatePicker
                          includeTime
                          value={state.ticket.returnDepartureAt}
                          onChange={(returnDepartureAt) =>
                            patchState({
                              ticket: {
                                ...state.ticket,
                                returnDepartureAt,
                              },
                            })
                          }
                        />
                      </FormField>
                      <FormField label="رسیدن برگشت">
                        <DatePicker
                          includeTime
                          value={state.ticket.returnArrivalAt}
                          onChange={(returnArrivalAt) =>
                            patchState({
                              ticket: {
                                ...state.ticket,
                                returnArrivalAt,
                              },
                            })
                          }
                        />
                      </FormField>
                    </>
                  ) : null}
                  <FormField label="شرکت حمل‌کننده">
                    <Input
                      value={state.ticket.carrier}
                      onChange={(event) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            carrier: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="شماره رفت">
                    <Input
                      value={state.ticket.outboundNumber}
                      onChange={(event) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            outboundNumber: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="مبلغ هر مسیر">
                    <Input
                      dir="ltr"
                      value={state.ticket.amount}
                      onChange={(event) =>
                        patchState({
                          ticket: {
                            ...state.ticket,
                            amount: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                </div>
              </section>
            ) : null}
            {state.serviceKinds.includes('HOTEL') ? (
              <section className="grid gap-4 rounded-xl border p-4">
                <h3 className="font-bold">هتل مقصد</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <ReferenceSelect
                    label="هتل"
                    value={state.hotel.hotelId}
                    options={references.hotels}
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
            {state.serviceKinds.includes('VISA') ? (
              <ReferenceSelect
                label="خدمت ویزا"
                value={state.visaReferenceId}
                options={references.visaServices}
                onChange={(visaReferenceId) => patchState({ visaReferenceId })}
              />
            ) : null}
          </div>
        ) : null}
        {step === 4 ? (
          <div className="grid gap-5">
            <div>
              <h2 className="text-xl font-black">مسافران و تخصیص خدمات</h2>
              <p className="text-sm text-muted-foreground">
                در این نسخه همه خدمات انتخاب‌شده به هر مسافر تخصیص می‌یابد.
              </p>
            </div>
            <div className="grid gap-3">
              {state.passengers.map((passenger, index) => (
                <div
                  className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_220px_auto]"
                  key={`${passenger.customerId}-${index}`}
                >
                  <div>
                    <strong>{passenger.displayName}</strong>
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
              description="در گام مشتری جستجو کنید و رکوردهای دارای نقش مسافر را انتخاب کنید؛ مشتری اصلی در صورت داشتن نقش مسافر خودکار افزوده می‌شود."
            />
          </div>
        ) : null}
        {step === 5 ? (
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
                    placeholder="Decimal"
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
                  قسط
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
        {step === 6 ? (
          <div className="grid gap-5">
            <h2 className="text-xl font-black">بازبینی و ثبت</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">مشتری</p>
                <p className="mt-1 font-bold">{state.customerName}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">نوع و مسیر</p>
                <p className="mt-1 font-bold">
                  {state.tripType} · {state.originId} ← {state.destinationId}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">خدمات</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.serviceKinds.map((kind) => (
                    <Badge key={kind}>{kind}</Badge>
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
                description="ثبت پیش‌نویس ممکن است؛ تأیید و ارسال رزرو تا پاسخ مثبت Public API بلیت fail-closed است."
              />
            ) : null}
          </div>
        ) : null}
      </Card>
      <div className="flex items-center justify-between">
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
            type="button"
            disabled={!canContinue || busy}
            onClick={() => setStep((value) => value + 1)}
          >
            بعدی
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button type="submit" loading={busy} disabled={!canContinue}>
            ثبت قرارداد
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
