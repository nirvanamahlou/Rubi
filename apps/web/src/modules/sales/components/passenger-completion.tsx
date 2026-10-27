'use client';
import { useEffect, useRef, useState } from 'react';
import type {
  CustomerSummary,
  CustomerMutationRequest,
  CustomerDetail,
  SalesPassengerCompletionFormV1,
  SalesPassengerCompletionCommandV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  CustomerEntrySheet,
  salesPeopleApi,
  type CustomerCalendarMode,
} from '@/modules/customers/public/entry';
import {
  emptyPeopleValues,
  peopleCreateInput,
  selectedPeopleRow,
  type PeopleRow,
} from '../model/sales-people-sheet';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { salesApi, SalesApiError } from '../api/client';
import { SalesPersonSearch } from './sales-person-search';

type Row = {
  key: string;
  category: 'adults' | 'children' | 'infants';
  person: PeopleRow;
  services: string[];
  different: boolean;
  checkInDate: string;
  checkOutDate: string;
  createdHere?: boolean;
};
const labels = { adults: 'بزرگسال', children: 'کودک', infants: 'نوزاد' };
export function completionSelectedPerson(person: CustomerDetail) {
  const row = selectedPeopleRow(person);
  row.values.passportFirstName ||= person.firstName ?? '';
  row.values.passportLastName ||= person.lastName ?? '';
  return row;
}
export function completionPersonInput(row: PeopleRow): CustomerMutationRequest {
  const v = row.values;
  if (
    !row.person &&
    (!/^[A-Za-z][A-Za-z '-]*$/.test(v.passportFirstName.trim()) ||
      !/^[A-Za-z][A-Za-z '-]*$/.test(v.passportLastName.trim()))
  )
    throw Error('نام و نام خانوادگی لاتین پاسپورت را کامل کنید.');
  if (
    (v.gender && !['M', 'F'].includes(v.gender)) ||
    [v.nationalityCode, v.passportIssuingCountryCode, v.birthCountryCode].some(
      (code) => code && !/^[A-Z]{3}$/.test(code),
    )
  )
    throw Error('جنسیت و کد کشورها را کامل کنید.');
  const input = peopleCreateInput(
    {
      ...row,
      values: {
        ...v,
        firstName: v.passportFirstName,
        lastName: v.passportLastName,
      },
    },
    false,
    false,
  );
  return {
    ...input,
    roles: ['passenger'],
    passportFirstName: v.passportFirstName.trim().toUpperCase(),
    passportLastName: v.passportLastName.trim().toUpperCase(),
    ...(v.gender ? { gender: v.gender as 'M' | 'F' } : {}),
    ...(v.nationalityCode ? { nationalityCode: v.nationalityCode } : {}),
    ...(v.passportIssuingCountryCode
      ? { passportIssuingCountryCode: v.passportIssuingCountryCode }
      : {}),
    ...(v.birthCountryCode ? { birthCountryCode: v.birthCountryCode } : {}),
  };
}

/** National-ID matching is available only when an optional ID was supplied. */
export async function completionRegistrationLookup(
  input: CustomerMutationRequest,
  lookup = salesPeopleApi.registrationLookup,
) {
  if (!input.nationalId?.trim()) return null;
  return (
    await lookup({
      nationalId: input.nationalId,
      firstName: input.firstName!,
      lastName: input.lastName!,
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
    })
  ).data;
}

export function validateCompletionRow(row: Row, departureDate: string) {
  completionPersonInput(row.person);
  const v = row.person.values;
  if (v.birthDate) {
    const born = new Date(v.birthDate);
    const travel = new Date(departureDate);
    const age =
      travel.getUTCFullYear() -
      born.getUTCFullYear() -
      (travel.toISOString().slice(5, 10) < born.toISOString().slice(5, 10)
        ? 1
        : 0);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate) ||
      Number.isNaN(born.getTime()) ||
      born.toISOString().slice(0, 10) !== v.birthDate ||
      v.birthDate > new Date().toISOString().slice(0, 10) ||
      (age < 2 ? 'infants' : age < 12 ? 'children' : 'adults') !==
        row.category ||
      born > travel
    )
      throw Error(
        `تاریخ تولد ${labels[row.category]} با رده سنی قرارداد هم‌خوان نیست.`,
      );
  }
  if (
    row.different &&
    (!row.checkInDate || row.checkOutDate <= row.checkInDate)
  )
    throw Error('تاریخ ورود و خروج هتل مسافر معتبر نیست.');
}
export function completionRows(form: SalesPassengerCompletionFormV1): Row[] {
  return (['adults', 'children', 'infants'] as const).flatMap((category) =>
    Array.from(
      { length: Math.max(0, ...form.services.map((s) => s.party[category])) },
      (_, i) => ({
        key: `${category}-${i}`,
        category,
        person: { values: emptyPeopleValues() },
        services: form.services
          .filter((s) => s.party[category] > i)
          .map((s) => s.key),
        different: false,
        checkInDate: form.hotel?.checkInDate ?? '',
        checkOutDate: form.hotel?.checkOutDate ?? '',
      }),
    ),
  );
}

export function PassengerCompletion({
  contractId,
  onSaved,
  onPending,
}: {
  contractId: string;
  onSaved: () => void;
  onPending: (pending: boolean) => void;
}) {
  const [form, setForm] = useState<SalesPassengerCompletionFormV1 | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('gregorian');
  const [lookup, setLookup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<SalesPassengerCompletionCommandV1 | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void salesApi
      .passengerCompletionForm(contractId)
      .then((value) => {
        if (active) {
          setForm(value);
          setRows(completionRows(value));
          setError('');
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'دریافت اطلاعات مسافران ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [contractId, retry]);
  const change = (key: string, patch: Partial<Row>) =>
    setRows((old) => old.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  async function choose(person: CustomerSummary) {
    if (!lookup || lock.current) return;
    setBusy(true);
    lock.current = true;
    setError('');
    try {
      const { data } = await salesPeopleApi.detail(
        person.id,
        'customer-verification',
      );
      change(lookup, {
        person: completionSelectedPerson(data),
        createdHere: false,
      });
      setLookup(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت مسافر ناموفق بود.');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function save() {
    if (!form || lock.current) return;
    lock.current = true;
    setBusy(true);
    onPending(true);
    setError('');
    let current = rows;
    try {
      if (!attempt.current) {
        // Validate all rows before creating the first identity.
        for (const row of current)
          validateCompletionRow(row, form.departureDate);
        for (const service of form.services)
          for (const category of ['adults', 'children', 'infants'] as const) {
            if (
              current.filter(
                (r) =>
                  r.category === category && r.services.includes(service.key),
              ).length !== service.party[category]
            )
              throw Error(
                `تعداد ${labels[category]} برای ${service.title} باید ${service.party[category]} نفر باشد.`,
              );
          }
        const passports = current
          .map((r) => r.person.values.passportNumber.trim().toUpperCase())
          .filter(Boolean);
        if (new Set(passports).size !== passports.length)
          throw Error('پاسپورت مسافران نباید تکراری باشد.');
        for (let i = 0; i < current.length; i++) {
          let row = current[i]!;
          if (!row.person.person) {
            const input = completionPersonInput(row.person);
            const found = await completionRegistrationLookup(input);
            const data =
              found ??
              (await salesApi.createCompletionPerson(contractId, input)).data;
            row = {
              ...row,
              person: {
                ...row.person,
                person: { id: data.id, displayName: data.displayName },
                profile: data,
              },
              createdHere: !found,
            };
            current = current.map((r, j) => (j === i ? row : r));
            setRows(current);
            if (found) {
              // Existing identities require explicit review; never silently overwrite a matching person.
              const revealed = (
                await salesPeopleApi.detail(found.id, 'customer-verification')
              ).data;
              current = current.map((r, j) =>
                j === i
                  ? { ...row, person: completionSelectedPerson(revealed) }
                  : r,
              );
              setRows(current);
              throw Error(
                'پرونده موجود پیدا شد؛ اطلاعات نمایش‌داده‌شده را بررسی و دوباره ثبت کنید.',
              );
            }
          }
          if (
            row.createdHere &&
            (row.person.values.phone.trim() || row.person.values.email.trim())
          ) {
            let data = (
              await salesPeopleApi.detail(
                row.person.person!.id,
                'customer-verification',
              )
            ).data;
            for (const field of ['phone', 'email'] as const) {
              const value = row.person.values[field].trim();
              if (
                value &&
                !data.contacts?.some(
                  (c) =>
                    c.type === field &&
                    c.value?.toLowerCase() === value.toLowerCase(),
                )
              )
                data = (
                  await salesPeopleApi.addContact(data.id, {
                    type: field,
                    value,
                    label: 'اصلی',
                    isPrimary: field === 'phone' || !row.person.values.phone,
                    version: data.version,
                  })
                ).data;
            }
          }
        }
        attempt.current = {
          operationId: browserRandomUuid(),
          expectedVersion: form.version,
          passengers: current.map((r) => ({
            customerId: r.person.person!.id,
            serviceClientKeys: r.services,
            ageCategory:
              r.category === 'adults'
                ? 'ADT'
                : r.category === 'children'
                  ? 'CHD'
                  : 'INF',
            ...(form.hotel && r.services.includes(form.hotel.serviceKey)
              ? {
                  hotelStay: {
                    different: r.different,
                    checkInDate: r.different
                      ? r.checkInDate
                      : form.hotel.checkInDate,
                    checkOutDate: r.different
                      ? r.checkOutDate
                      : form.hotel.checkOutDate,
                  },
                }
              : {}),
          })),
        };
      }
      setUncertain(true);
      await salesApi.completePassengers(contractId, attempt.current);
      attempt.current = null;
      setUncertain(false);
      onPending(false);
      setOpen(false);
      setForm({ ...form, available: false });
      onSaved();
    } catch (e) {
      if (
        !attempt.current ||
        (e instanceof SalesApiError && [400, 403, 404, 409].includes(e.status))
      ) {
        attempt.current = null;
        setUncertain(false);
        onPending(false);
      }
      setError(e instanceof Error ? e.message : 'ثبت مسافران ناموفق بود.');
      if (e instanceof SalesApiError && e.status === 409) {
        try {
          const latest = await salesApi.passengerCompletionForm(contractId);
          setForm(latest);
          if (!latest.available) onSaved();
        } catch {
          /* Keep the original error and entered identities for retry. */
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (form && !form.available) return null;
  return (
    <section className="grid min-w-0 gap-3 rounded-xl border p-3">
      <Button
        type="button"
        variant="outline"
        disabled={!form || busy}
        onClick={() => setOpen(!open)}
      >
        افزودن مسافر
      </Button>
      {error && (!open || !form) && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!form && error && (
        <Button variant="outline" onClick={() => setRetry((r) => r + 1)}>
          دریافت دوباره
        </Button>
      )}
      {open && form && (
        <>
          <p className="text-sm text-muted-foreground">
            مشخصات {rows.length} مسافر را مطابق تعداد و ردهٔ سنی قرارداد تکمیل
            کنید.
          </p>
          <fieldset disabled={busy || uncertain} className="min-w-0">
            <CustomerEntrySheet
              rows={rows.map((r) => ({
                key: r.key,
                label: `مسافر ${rows.indexOf(r) + 1}`,
                role: labels[r.category],
                values: r.person.values,
                readOnly: !!r.person.person,
                onChange: (field, value) =>
                  change(r.key, {
                    person: {
                      ...r.person,
                      values: { ...r.person.values, [field]: value },
                    },
                  }),
                actions: (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLookup(r.key)}
                  >
                    انتخاب موجود
                  </Button>
                ),
              }))}
              calendarMode={calendar}
              onCalendarModeChange={setCalendar}
              disabled={busy || uncertain}
              showPassportExpiry
              topScrollbar
              calendarSwitchInBirthDateHeader
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
                'phone',
                'email',
              ]}
              columnOrder={[
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
                'phone',
                'email',
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
                'phone',
                'email',
              ]}
              columnLabels={{
                nationalId: 'کد ملی',
                passportFirstName: 'نام انگلیسی مطابق پاسپورت *',
                passportLastName: 'نام خانوادگی انگلیسی مطابق پاسپورت *',
                passportNumber: 'شماره پاسپورت',
                passportExpiryDate: 'انقضای پاسپورت',
                birthDate: 'تاریخ تولد مسافر',
                gender: 'جنسیت',
                nationalityCode: 'ملیت',
                passportIssuingCountryCode: 'کشور صادرکننده پاسپورت',
                birthCountryCode: 'کشور محل تولد',
              }}
              extraColumns={[
                ...form.services.map((s) => ({
                  key: s.key,
                  position: 'start' as const,
                  title:
                    s.direction === 'OUTBOUND'
                      ? 'بلیط رفت'
                      : s.direction === 'RETURN'
                        ? 'بلیط برگشت'
                        : s.title,
                  render: (entry: { key: string }) => {
                    const r = rows.find((p) => p.key === entry.key)!;
                    return (
                      <input
                        type="checkbox"
                        aria-label={`${s.title} ${labels[r.category]}`}
                        checked={r.services.includes(s.key)}
                        onChange={(e) =>
                          change(r.key, {
                            services: e.target.checked
                              ? [...r.services, s.key]
                              : r.services.filter((key) => key !== s.key),
                          })
                        }
                      />
                    );
                  },
                })),
                ...(['checkInDate', 'checkOutDate'] as const).map((field) => ({
                  key: field,
                  position: 'end' as const,
                  title: field === 'checkInDate' ? 'چک‌این هتل' : 'چک‌اوت هتل',
                  render: (entry: { key: string }) => {
                    const r = rows.find((p) => p.key === entry.key)!;
                    return form.hotel &&
                      r.services.includes(form.hotel.serviceKey) ? (
                      <div className="min-w-40">
                        <DatePicker
                          value={r[field]}
                          disabled={!r.different || busy || uncertain}
                          onChange={(value) =>
                            change(r.key, { [field]: value.slice(0, 10) })
                          }
                        />
                      </div>
                    ) : (
                      '—'
                    );
                  },
                })),
                {
                  key: 'different',
                  position: 'end',
                  title: 'اقامت متفاوت',
                  render: (entry: { key: string }) => {
                    const r = rows.find((p) => p.key === entry.key)!;
                    return form.hotel &&
                      r.services.includes(form.hotel.serviceKey) ? (
                      <input
                        type="checkbox"
                        aria-label="اقامت متفاوت"
                        checked={r.different}
                        onChange={(e) =>
                          change(r.key, {
                            different: e.target.checked,
                            ...(e.target.checked
                              ? {}
                              : {
                                  checkInDate: form.hotel!.checkInDate,
                                  checkOutDate: form.hotel!.checkOutDate,
                                }),
                          })
                        }
                      />
                    ) : (
                      '—'
                    );
                  },
                },
              ]}
            />
          </fieldset>
          {lookup && (
            <SalesPersonSearch
              purpose="passenger"
              selectedIds={rows.flatMap((r) =>
                r.person.person ? [r.person.person.id] : [],
              )}
              onSelect={(p) => void choose(p)}
              onCancel={() => setLookup(null)}
            />
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy
              ? 'در حال ثبت…'
              : uncertain
                ? 'بررسی و ارسال دوباره همان ثبت'
                : 'ثبت مسافران و به‌روزرسانی رزرواسیون'}
          </Button>
        </>
      )}
    </section>
  );
}
