'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  CustomerSummary,
  SalesContractAmendmentV1,
  SalesPassengerAgeCategory,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Input } from '@/components/ui/form-controls';
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
import { changeAmendmentMembership } from './amendment-membership';
import { salesApi, SalesApiError } from '@/modules/sales/api/client';
const accommodation = {
  ADT: 'DBL',
  CHD: 'CHILD_WITH_BED',
  INF: 'INFANT',
} as const;

type MembershipProps = {
  requestedCount?: number | undefined;
  contractId: string;
  draft: SalesContractAmendmentV1;
  disabled: boolean;
  onChange: (draft: SalesContractAmendmentV1) => void;
  onPending: (pending: boolean) => void;
  onRegistered: (person: PeopleRow) => void;
};
export function AmendmentPassengerMembership(props: MembershipProps) {
  const { requestedCount, onPending } = props;
  const registeredCount = props.draft.passengers.length;
  const sequence = useRef(200);
  const [slots, setSlots] = useState<number[]>(() =>
    Array.from(
      {
        length: Math.max(
          0,
          Math.min(200, props.requestedCount ?? props.draft.passengers.length) -
            props.draft.passengers.length,
        ),
      },
      (_, index) => index + 1,
    ),
  );
  const [busy, setBusy] = useState(false);
  const count = props.draft.passengers.length + slots.length;
  useEffect(() => {
    onPending(busy || slots.length > 0);
  }, [busy, slots.length, onPending]);
  const previousRequested = useRef(requestedCount);
  useEffect(() => {
    if (previousRequested.current === requestedCount) return;
    previousRequested.current = requestedCount;
    const wanted = Math.max(
      registeredCount,
      Math.min(200, requestedCount ?? registeredCount),
    );
    setSlots((old) => {
      const length = wanted - registeredCount;
      return length <= old.length
        ? old.slice(0, length)
        : [
            ...old,
            ...Array.from(
              { length: length - old.length },
              () => ++sequence.current,
            ),
          ];
    });
  }, [requestedCount, registeredCount]);
  return (
    <section className="grid min-w-0 gap-3">
      <label>
        تعداد مسافران قرارداد
        <Input
          type="number"
          min={1}
          max={200}
          value={count}
          disabled={props.disabled || busy}
          onChange={(e) => {
            const wanted = Number(e.target.value);
            if (!Number.isInteger(wanted) || wanted < 1 || wanted > 200) return;
            if (wanted < props.draft.passengers.length) return;
            setSlots((old) =>
              wanted <= count
                ? old.slice(0, wanted - props.draft.passengers.length)
                : [
                    ...old,
                    ...Array.from(
                      { length: wanted - count },
                      () => ++sequence.current,
                    ),
                  ],
            );
          }}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={props.disabled || busy || count >= 200}
        onClick={() => setSlots((old) => [...old, ++sequence.current])}
      >
        افزودن مسافر
      </Button>
      <p className="text-sm text-muted-foreground">
        برای حذف، دکمهٔ همان مسافر در جدول را بزنید. حداقل یک مسافر باقی
        می‌ماند؛ مبلغ کل قرارداد تغییر نمی‌کند.
      </p>
      {slots.map((slot, index) => (
        <div key={slot} className="grid min-w-0 gap-2 rounded-xl border p-3">
          <b>مسافر جدید {index + 1}</b>
          <NewAmendmentPassenger
            {...props}
            disabled={props.disabled || busy}
            onPending={setBusy}
            onChange={(next) => {
              props.onChange(next);
              setSlots((old) => old.filter((id) => id !== slot));
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={props.disabled || busy}
            onClick={() => setSlots((old) => old.filter((id) => id !== slot))}
          >
            حذف ردیف جدید
          </Button>
        </div>
      ))}
    </section>
  );
}
function NewAmendmentPassenger({
  contractId,
  draft,
  disabled,
  onChange,
  onPending,
  onRegistered,
}: MembershipProps) {
  const [search, setSearch] = useState(false);
  const [person, setPerson] = useState<PeopleRow>({
    values: emptyPeopleValues(),
  });
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('gregorian');
  const [category, setCategory] = useState<SalesPassengerAgeCategory>('ADT');
  const [services, setServices] = useState<string[]>(() =>
    draft.services
      .filter((s) => !s.metadata?.insuranceAgeSurcharge)
      .map((s) => s.clientKey),
  );
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
      if (!services.length)
        throw Error('حداقل یک خدمت برای مسافر انتخاب کنید.');
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
        selected = completionSelectedPerson(data);
        setPerson(selected);
      }
      onRegistered(selected);
      onChange(
        changeAmendmentMembership(
          draft,
          {
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
          },
          true,
        ),
      );
      setPerson({ values: emptyPeopleValues() });
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
    <section className="grid min-w-0 gap-3">
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
        <Button
          type="button"
          disabled={busy || registrationUncertain}
          onClick={() => void add()}
        >
          {busy ? 'در حال ثبت…' : 'افزودن به فهرست مسافران'}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
