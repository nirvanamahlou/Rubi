'use client';
import { useRef, useState } from 'react';
import type {
  CustomerSummary,
  SalesContractAmendmentV1,
  SalesPassengerAgeCategory,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { MoneyInput } from '@/components/ui/money-input';
import {
  CustomerEntrySheet,
  salesPeopleApi,
  type CustomerCalendarMode,
} from '@/modules/customers/public/entry';
import {
  emptyPeopleValues,
  type PeopleRow,
} from '@/modules/sales/model/sales-people-sheet';
import { SalesPersonSearch } from '@/modules/sales/components/sales-person-search';
import {
  completionPersonInput,
  completionRegistrationLookup,
  completionSelectedPerson,
  validateCompletionRow,
} from '@/modules/sales/components/passenger-completion';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from '@/modules/sales/components/sales-currency-select';
import { salesApi, SalesApiError } from '@/modules/sales/api/client';
import {
  changeAmendmentMembership,
  assertAmendmentMembershipPricing,
} from './amendment-membership';
const accommodation = {
  ADT: 'DBL',
  CHD: 'CHILD_WITH_BED',
  INF: 'INFANT',
} as const;

export function AmendmentPassengerMembership({
  contractId,
  draft,
  disabled,
  currencies,
  onChange,
  onPending,
}: {
  contractId: string;
  draft: SalesContractAmendmentV1;
  disabled: boolean;
  currencies: readonly SalesCurrency[];
  onChange: (draft: SalesContractAmendmentV1) => void;
  onPending: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [person, setPerson] = useState<PeopleRow>({
    values: emptyPeopleValues(),
  });
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('gregorian');
  const [category, setCategory] = useState<SalesPassengerAgeCategory>('ADT');
  const [services, setServices] = useState<string[]>([]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [registrationUncertain, setRegistrationUncertain] = useState(false);
  const lock = useRef(false);
  async function choose(summary: CustomerSummary) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onPending(true);
    setError('');
    try {
      const { data } = await salesPeopleApi.detail(
        summary.id,
        'customer-verification',
      );
      setPerson(completionSelectedPerson(data));
      setRegistrationUncertain(false);
      setSearch(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت مسافر ناموفق بود.');
    } finally {
      lock.current = false;
      setBusy(false);
      onPending(false);
    }
  }
  async function add() {
    if (lock.current || registrationUncertain) return;
    lock.current = true;
    setBusy(true);
    onPending(true);
    setError('');
    try {
      assertAmendmentMembershipPricing(draft);
      if (!services.length)
        throw Error('حداقل یک خدمت برای مسافر انتخاب کنید.');
      if (
        !/^\d+(?:\.\d{1,4})?$/.test(amount) ||
        !currencies.some((c) => c.code === currency && c.status === 'active')
      )
        throw Error(
          'قیمت و ارز مسافر جدید را وارد کنید؛ برای مسافر رایگان صفر وارد کنید.',
        );
      validateCompletionRow(
        {
          key: 'new',
          category:
            category === 'ADT'
              ? 'adults'
              : category === 'CHD'
                ? 'children'
                : 'infants',
          person,
          services,
          different: false,
          checkInDate: '',
          checkOutDate: '',
        },
        draft.departureDate,
      );
      let selected = person;
      if (!selected.person) {
        const input = completionPersonInput(selected);
        const found = await completionRegistrationLookup(input);
        if (found) {
          setPerson(
            completionSelectedPerson(
              (await salesPeopleApi.detail(found.id, 'customer-verification'))
                .data,
            ),
          );
          throw Error(
            'پرونده موجود پیدا شد؛ اطلاعات نمایش‌داده‌شده را بررسی و دوباره ثبت کنید.',
          );
        }
        const { data } = await salesApi
          .createCompletionPerson(contractId, input)
          .catch((cause: unknown) => {
            if (!(
              cause instanceof SalesApiError &&
              [400, 401, 403, 404, 409, 422, 429].includes(cause.status)
            )) {
              setRegistrationUncertain(true);
              throw Error(
                'نتیجه ثبت قبلی نیازمند بررسی است؛ پرونده موجود را انتخاب کنید.',
              );
            }
            throw cause;
          });
        selected = {
          ...selected,
          person: { id: data.id, displayName: data.displayName },
          profile: data,
        };
        setPerson(selected);
      }
      onChange(
        changeAmendmentMembership(draft, {
          add: {
            customerId: selected.person!.id,
            displayNameSnapshot: selected.person!.displayName,
            birthDate: selected.values.birthDate,
            ageCategory: category,
            serviceClientKeys: services,
            ...(draft.hotelSelection &&
            services.includes(draft.hotelSelection.serviceClientKey)
              ? {
                  accommodationKind: accommodation[category],
                }
              : {}),
          },
          category,
          prices: [{ amount, currencyCode: currency }],
        }),
      );
      setOpen(false);
      setPerson({ values: emptyPeopleValues() });
      setAmount('');
      setServices([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت مسافران ناموفق بود.');
    } finally {
      lock.current = false;
      setBusy(false);
      onPending(false);
    }
  }
  return (
    <section className="grid min-w-0 gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => {
            setOpen(!open);
            setServices(
              draft.services
                .filter((s) => !s.metadata?.insuranceAgeSurcharge)
                .map((s) => s.clientKey),
            );
          }}
        >
          افزودن مسافر
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        افزودن و حذف با ثبت اصلاح قرارداد نهایی می‌شود؛ پرونده اصلی مسافر و
        مدارک قبلی حفظ می‌شوند.
      </p>
      {draft.passengers.map((p) => (
        <div
          key={p.customerId}
          className="flex items-center justify-between gap-2 rounded-lg border p-2"
        >
          <span>{p.displayNameSnapshot}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || busy || draft.passengers.length < 2}
            onClick={() => {
              try {
                onChange(
                  changeAmendmentMembership(draft, { remove: p.customerId }),
                );
                setError('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
              }
            }}
          >
            حذف مسافر
          </Button>
        </div>
      ))}
      {open && (
        <fieldset disabled={disabled || busy} className="grid min-w-0 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSearch(!search)}
          >
            انتخاب موجود
          </Button>
          {search && (
            <SalesPersonSearch
              purpose="passenger"
              selectedIds={draft.passengers.map((p) => p.customerId)}
              onSelect={(p) => void choose(p)}
              onCancel={() => setSearch(false)}
            />
          )}
          <CustomerEntrySheet
            rows={[
              {
                key: 'new',
                label: 'مسافر جدید',
                role: 'مسافر',
                values: person.values,
                readOnly: !!person.person,
                onChange: (field, value) =>
                  setPerson({
                    ...person,
                    values: { ...person.values, [field]: value },
                  }),
              },
            ]}
            calendarMode={calendar}
            onCalendarModeChange={setCalendar}
            disabled={busy || registrationUncertain}
            visibleFields={[
              'passportFirstName',
              'passportLastName',
              'nationalId',
              'birthDate',
              'passportNumber',
              'passportExpiryDate',
              'gender',
              'nationalityCode',
              'passportIssuingCountryCode',
              'birthCountryCode',
            ]}
            optionalFields={[
              'nationalId',
              'birthDate',
              'passportNumber',
              'passportExpiryDate',
              'gender',
              'nationalityCode',
              'passportIssuingCountryCode',
              'birthCountryCode',
            ]}
            columnLabels={{
              nationalId: 'کد ملی',
              birthDate: 'تاریخ تولد مسافر',
            }}
            showPassportExpiry
            topScrollbar
          />
          <label>
            رده سنی
            <NativeSearchSelect
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as SalesPassengerAgeCategory)
              }
            >
              <option value="ADT">بزرگسال</option>
              <option value="CHD">کودک</option>
              <option value="INF">نوزاد</option>
            </NativeSearchSelect>
          </label>
          <div className="flex flex-wrap gap-3">
            {draft.services
              .filter((s) => !s.metadata?.insuranceAgeSurcharge)
              .map((s) => (
                <label key={s.clientKey} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={services.includes(s.clientKey)}
                    onChange={(e) =>
                      setServices(
                        e.target.checked
                          ? [...services, s.clientKey]
                          : services.filter((k) => k !== s.clientKey),
                      )
                    }
                  />
                  {s.titleSnapshot}
                </label>
              ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              قیمت کل مسافر
              <MoneyInput value={amount} onValueChange={setAmount} />
            </label>
            <SalesCurrencySelect
              label="ارز"
              currencies={currencies}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          <Button
            type="button"
            disabled={busy || registrationUncertain}
            onClick={() => void add()}
          >
            {busy ? 'در حال ثبت…' : 'افزودن به فهرست مسافران'}
          </Button>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
