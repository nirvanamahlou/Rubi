'use client';
import peopleStyles from './sales-people-sheet.module.css';
import { useEffect, useRef, useState } from 'react';
import { transferDirectionColumns } from './transfer-direction-columns';
import { guestStayColumns } from './guest-stay-columns';
import { usesRoomDrivenGuests } from '../model/contract-guest-stays';
import { agencyBuyerContact } from '../model/agency-buyer-contact';
import { Plus, Check, Search } from 'lucide-react';
import type { CustomerSummary, MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, FormField } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import {
  CustomerEntrySheet,
  salesPeopleApi as customersApi,
  type CustomerCalendarMode,
  type CustomerEntryRow,
  type EntryField,
} from '@/modules/customers/public/entry';
import { SalesOrganizationCustomer } from './sales-organization-customer';
import { SalesPersonSearch } from './sales-person-search';
import { SalesThemedSelect } from './sales-themed-select';
import { loadSalesAcquaintanceMethods } from '../api/acquaintance-methods';
import {
  salesPassengerFlightDirections,
  salesDirections,
  salesPassengerAgeLabel,
  salesPassengerCounts,
  salesRequiresPassportIdentity,
  salesTravelDate,
  type SalesFormState,
} from '../model/sales-form';
import {
  initialSalesPeopleDraft,
  bookedSlotCategory,
  passengerSlotKeys,
  peopleRow,
  emptyPeopleValues,
  selectedPeopleRow,
  refreshPeopleRow,
  saveSalesPeopleDraft,
  normalizeSalesPeopleDraft,
  editPeopleRow,
  setSalesPeopleAcquaintanceMethod,
  type SalesPeopleDraft,
} from '../model/sales-people-sheet';

export function SalesPeopleSheet({
  state,
  refreshRevision = 0,
  draft: savedDraft,
  onDraftChange,
  onConfirmed,
  onBusyChange,
  onAddInfant,
  onGuestStateChange,
  onFlightDirectionsChange,
  busy = false,
}: {
  onFlightDirectionsChange?: (
    directions: NonNullable<SalesFormState['passengerFlightDirections']>,
  ) => void;
  refreshRevision?: number;
  state: SalesFormState;
  draft: SalesPeopleDraft | null;
  onDraftChange: (draft: SalesPeopleDraft) => void;
  onConfirmed: (patch: Partial<SalesFormState>) => void;
  onBusyChange: (busy: boolean) => void;
  onAddInfant: () => void;
  onGuestStateChange?: (patch: Partial<SalesFormState>) => void;
  busy?: boolean;
}) {
  const draft = normalizeSalesPeopleDraft(
    savedDraft ?? initialSalesPeopleDraft(state),
  );
  const showAcquaintance = draft.mode !== 'organization';
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('gregorian');
  const [lookup, setLookup] = useState<string | null>(null);
  const [lookupInRow, setLookupInRow] = useState(false);
  const [clearKey, setClearKey] = useState<string | null>(null);
  const [acquaintanceMethods, setAcquaintanceMethods] = useState<
    MasterDataRecord[]
  >([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState('');
  const [methodsRetry, setMethodsRetry] = useState(0);
  useEffect(() => {
    if (!showAcquaintance) return;
    let active = true;
    loadSalesAcquaintanceMethods()
      .then((items) => {
        if (active) {
          setAcquaintanceMethods(items);
          setMethodsError('');
        }
      })
      .catch(() => {
        if (active) setMethodsError('دریافت فهرست نحوه آشنایی ناموفق بود.');
      })
      .finally(() => {
        if (active) setMethodsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [methodsRetry, refreshRevision, showAcquaintance]);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const inFlight = useRef(false);
  const slots = passengerSlotKeys(state);
  const counts = salesPassengerCounts(state);
  const passportIdentity = salesRequiresPassportIdentity(state);
  const visibleEntryFields: readonly EntryField[] = passportIdentity
    ? [
        'nationalId',
        'passportFirstName',
        'passportLastName',
        'birthDate',
        'passportNumber',
        'passportExpiryDate',
        'gender',
        'nationalityCode',
        'passportIssuingCountryCode',
        'birthCountryCode',
        'phone',
        'email',
      ]
    : [
        'firstName',
        'lastName',
        'gender',
        'birthDate',
        'nationalId',
        'phone',
        'email',
      ];
  const change = (next: SalesPeopleDraft) => {
    setConfirmed(false);
    setError('');
    onDraftChange(next);
  };
  const reveal = async (key: string) => {
    const row = peopleRow(draft, key);
    if (!row.person || busy) return;
    onBusyChange(true);
    setError('');
    try {
      const detail = (
        await customersApi.detail(row.person.id, 'customer-verification')
      ).data;
      change(editPeopleRow(draft, key, refreshPeopleRow(row, detail)));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'نمایش اطلاعات مجاز نیست.',
      );
    } finally {
      onBusyChange(false);
    }
  };
  const choose = async (person: CustomerSummary) => {
    if (!lookup || inFlight.current) return;
    setClearKey(null);
    const key = lookup;
    inFlight.current = true;
    onBusyChange(true);
    setError('');
    try {
      let detail;
      try {
        detail = (await customersApi.detail(person.id, 'customer-verification'))
          .data;
      } catch (reason) {
        if (!(
          reason &&
          typeof reason === 'object' &&
          'status' in reason &&
          reason.status === 403
        ))
          throw reason;
        detail = (await customersApi.detail(person.id)).data;
      }
      let next = editPeopleRow(draft, key, selectedPeopleRow(detail));
      if (
        (draft.mode === 'person' && key === 'primary') ||
        (draft.mode === 'first-passenger' && key === 'p0')
      ) {
        const phone = selectedPeopleRow(detail).values.phone;
        next = {
          ...next,
          buyerContact: {
            name: detail.displayName,
            phone: phone.includes('*') ? '' : phone,
            address:
              detail.addresses?.find((address) => address.isPrimary)?.label ??
              '',
            postalCode: '',
            landline:
              detail.contacts?.find(
                (contact) =>
                  contact.type === 'phone' &&
                  contact.value &&
                  !contact.value.includes('*') &&
                  !/^(\+98|0)?9/.test(contact.value),
              )?.value ?? '',
          },
        };
      }
      change(next);
      setLookup(null);
      requestAnimationFrame(() => {
        document.getElementById('sales-entry-' + key + '-first-name')?.focus();
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'پرونده در دسترس نیست.',
      );
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  };
  const chooseOrganization = async (person: CustomerSummary) => {
    if (inFlight.current) return;
    inFlight.current = true;
    onBusyChange(true);
    setError('');
    try {
      let detail;
      try {
        detail = (await customersApi.detail(person.id, 'customer-verification'))
          .data;
      } catch (reason) {
        if (!(
          reason &&
          typeof reason === 'object' &&
          'status' in reason &&
          reason.status === 403
        ))
          throw reason;
        try {
          detail = (await customersApi.detail(person.id)).data;
        } catch (error) {
          if (!(
            error &&
            typeof error === 'object' &&
            'status' in error &&
            error.status === 403
          ))
            throw error;
          detail = { contacts: [], addresses: [] };
        }
      }
      const phones = detail.contacts.filter(
        (c) => c.type === 'phone' && c.value && !c.value.includes('*'),
      );
      const mobile = phones.find((c) => /^(\+98|0)?9/.test(c.value!));
      const office = phones.find((c) => c !== mobile);
      const organizationBuyer = {
        name: person.displayName,
        phone: mobile?.value ?? office?.value ?? '',
        landline: office?.value ?? '',
        address:
          detail.addresses.find((a) => a.isPrimary)?.label ??
          detail.addresses[0]?.label ??
          '',
        postalCode: '',
      };
      const completedBuyer = person.organizationId
        ? await agencyBuyerContact(person.organizationId, organizationBuyer)
        : organizationBuyer;
      change({
        ...draft,
        organization: {
          id: person.id,
          displayName: person.displayName,
          organizationId: person.organizationId,
        },
        buyerContact: completedBuyer,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت اطلاعات آژانس انجام نشد.',
      );
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  };
  const save = async () => {
    if (inFlight.current) return;
    setClearKey(null);
    setLookup(null);
    inFlight.current = true;
    onBusyChange(true);
    setError('');
    try {
      const result = await saveSalesPeopleDraft(
        state,
        { ...draft, buyerContact },
        onDraftChange,
      );
      onDraftChange(result.draft);
      onConfirmed(result.patch);
      setConfirmed(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت افراد کامل نشد.',
      );
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  };
  const buyerKey = draft.mode === 'person' ? 'primary' : 'p0';
  const buyerRow = peopleRow(draft, buyerKey);
  const buyerContact = {
    landline: '',
    ...(draft.buyerContact ?? {
      name:
        draft.mode === 'organization'
          ? (draft.organization?.displayName ?? '')
          : (buyerRow.person?.displayName ??
            [buyerRow.values.firstName, buyerRow.values.lastName]
              .filter(Boolean)
              .join(' ')),
      phone: buyerRow.values.phone.includes('*') ? '' : buyerRow.values.phone,
      address:
        buyerRow.profile?.addresses?.find((address) => address.isPrimary)
          ?.label ?? '',
      postalCode: '',
    }),
  };
  const changeBuyer = (field: keyof typeof buyerContact, value: string) => {
    const normalized =
      field === 'phone' || field === 'postalCode' || field === 'landline'
        ? value.replace(/[۰-۹٠-٩]/g, (digit) =>
            String(
              '۰۱۲۳۴۵۶۷۸۹'.includes(digit)
                ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)
                : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit),
            ),
          )
        : value;
    let next: SalesPeopleDraft = {
      ...draft,
      buyerContact: { ...buyerContact, [field]: normalized },
    };
    if (draft.mode === 'person' && !buyerRow.person && field === 'name') {
      const [firstName = '', ...last] = normalized.trim().split(/\s+/);
      next = editPeopleRow(next, 'primary', {
        ...buyerRow,
        values: { ...buyerRow.values, firstName, lastName: last.join(' ') },
      });
    }
    if (draft.mode === 'person' && field === 'phone')
      next = editPeopleRow(next, 'primary', {
        ...peopleRow(next, 'primary'),
        values: { ...peopleRow(next, 'primary').values, phone: normalized },
      });
    change(next);
  };
  const keys = draft.mode === 'person' ? ['primary', ...slots] : slots;
  const rows: CustomerEntryRow[] = keys.map((key) => {
    const row = peopleRow(draft, key);
    const label =
      key === 'primary'
        ? 'مشتری اصلی'
        : `مسافر ${(slots.indexOf(key) + 1).toLocaleString('fa-IR')}`;
    return {
      key: 'sales-entry-' + key,
      label,
      values: row.values,
      readOnly: Boolean(row.person),
      editableFields: [
        'firstName',
        'lastName',
        'nationalId',
        'birthDate',
        'passportNumber',
        'passportExpiryDate',
        'passportFirstName',
        'passportLastName',
        'gender',
        'nationalityCode',
        'passportIssuingCountryCode',
        'birthCountryCode',
        'phone',
        'email',
      ],
      role: (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            {key === 'primary'
              ? 'طرف قرارداد'
              : key === 'p0' && draft.mode === 'first-passenger'
                ? 'مشتری و مسافر اول'
                : 'مسافر سفر'}
          </p>
          {key !== 'primary' ? (
            <p className="text-primary">
              {row.values.birthDate && !salesTravelDate(state)
                ? '—'
                : salesPassengerAgeLabel(
                    row.values.birthDate,
                    salesTravelDate(state),
                    bookedSlotCategory(state, key),
                  )}
            </p>
          ) : null}
          {row.person ? (
            <p className="flex items-center gap-1 text-emerald-700">
              <Check className="size-3" />
              پرونده موجود
            </p>
          ) : null}
          {row.profile ? (
            <p>اطلاعات قابل ویرایش؛ ذخیره با «ثبت و تأیید افراد»</p>
          ) : null}
          {row.reviewRequired ? (
            <p className="text-amber-700">
              با تأیید دوباره، ثبت قبلی خودکار بررسی می‌شود
            </p>
          ) : null}
          {row.previousRegistrationRetained ? (
            <p className="text-amber-700">
              پرونده کد ملی قبلی بدون تغییر در مشتریان باقی ماند؛ این ردیف با کد
              ملی فعلی ادامه می‌یابد.
            </p>
          ) : null}
        </div>
      ),
      onChange: (field, value) =>
        change(
          editPeopleRow(draft, key, {
            ...row,
            savedValues: row.savedValues ?? { ...row.values },
            values: { ...row.values, [field]: value },
          }),
        ),
      actions: (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setLookupInRow(true);
              setLookup(key);
            }}
          >
            <Search className="size-3" />
            انتخاب موجود
          </Button>
          {lookupInRow && lookup === key ? (
            <div
              className="min-w-72 max-w-md"
              aria-label="انتخاب پرونده در ردیف مسافر"
            >
              <SalesPersonSearch
                purpose="passenger"
                selectedIds={keys
                  .filter((other) => other !== key)
                  .flatMap((other) =>
                    peopleRow(draft, other).person?.id
                      ? [peopleRow(draft, other).person!.id]
                      : [],
                  )}
                onCancel={() => setLookup(null)}
                onSelect={(person) => void choose(person)}
              />
            </div>
          ) : null}
          {row.person && (!row.profile || row.profile.birthDateMasked) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void reveal(key)}
            >
              خواندن اطلاعات برای قرارداد
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setClearKey(key)}
          >
            پاک‌کردن ردیف
          </Button>
        </div>
      ),
    };
  });
  return (
    <section
      className={peopleStyles.workspace}
      aria-label="ورود یکجای مشتری و مسافران"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">
            {state.legacyContract
              ? 'مشتری قرارداد قدیمی'
              : 'مشتری و مسافران همراه'}
          </h2>
        </div>
      </div>
      {!state.legacyContract && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {counts.total.toLocaleString('fa-IR')} ردیف مسافر ·{' '}
            {counts.adults.toLocaleString('fa-IR')} بزرگسال،{' '}
            {counts.children.toLocaleString('fa-IR')} کودک،{' '}
            {counts.infants.toLocaleString('fa-IR')} نوزاد
          </p>
          {usesRoomDrivenGuests(state) && onGuestStateChange ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                const taken = new Set(
                  (state.flightOnlyPassengers ?? []).map((p) => p.key),
                );
                let n = 0;
                while (taken.has('flight-only-' + n)) n++;
                onDraftChange(draft);
                setConfirmed(false);
                onGuestStateChange({
                  flightOnlyPassengers: [
                    ...(state.flightOnlyPassengers ?? []),
                    { key: 'flight-only-' + n, age: 18 },
                  ],
                });
              }}
            >
              افزودن مسافر (فقط پرواز)
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || counts.adults === 0}
              onClick={() => {
                onDraftChange(draft);
                setConfirmed(false);
                onAddInfant();
              }}
            >
              <Plus className="size-4" />
              افزودن نوزاد
            </Button>
          )}
        </div>
      )}

      {error ? (
        <Alert tone="error" title="ثبت افراد کامل نشد" description={error} />
      ) : null}
      {showAcquaintance && methodsLoading ? (
        <p role="status" className="text-xs text-muted-foreground">
          در حال دریافت نحوه‌های آشنایی…
        </p>
      ) : showAcquaintance && (methodsError || !acquaintanceMethods.length) ? (
        <div className="flex items-center gap-2 text-sm">
          <p role={methodsError ? 'alert' : 'status'}>
            {methodsError ||
              'نحوه آشنایی فعالی ثبت نشده است؛ فهرست را در اطلاعات پایه تکمیل کنید.'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMethodsLoading(true);
              setMethodsError('');
              setMethodsRetry((n) => n + 1);
            }}
          >
            دریافت دوباره نحوه آشنایی
          </Button>
        </div>
      ) : null}
      {clearKey ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
        >
          <span>اطلاعات این ردیف پاک شود؟ پرونده ثبت‌شده حذف نمی‌شود.</span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setClearKey(null)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                change(
                  editPeopleRow(draft, clearKey, {
                    values: emptyPeopleValues(),
                  }),
                );
                setClearKey(null);
              }}
            >
              تأیید پاک‌کردن
            </Button>
          </div>
        </div>
      ) : null}
      <section
        className={peopleStyles.buyer}
        aria-label="مشخصات مشتری طرف حساب"
      >
        <h3 className="font-bold sm:col-span-2">مشتری و طرف حساب قرارداد</h3>
        <div className={peopleStyles.modes}>
          <Button
            type="button"
            size="sm"
            variant={draft.mode !== 'organization' ? 'primary' : 'outline'}
            disabled={busy}
            onClick={() =>
              draft.mode === 'organization' &&
              change(
                normalizeSalesPeopleDraft({
                  ...draft,
                  mode: state.legacyContract ? 'person' : 'first-passenger',
                  separateCustomer: state.legacyContract || false,
                  buyerContact: {
                    name: peopleRow(draft, 'p0').person?.displayName ?? '',
                    phone: '',
                    address: '',
                    postalCode: '',
                  },
                  ...(draft.rows.primary
                    ? { previousSeparateCustomer: draft.rows.primary }
                    : {}),
                  rows: { ...draft.rows, primary: peopleRow(draft, 'p0') },
                }),
              )
            }
          >
            مشتری حقیقی
          </Button>
          <Button
            type="button"
            size="sm"
            variant={draft.mode === 'organization' ? 'primary' : 'outline'}
            disabled={busy}
            onClick={() =>
              change({
                ...draft,
                mode: 'organization',
                buyerContact: {
                  name: draft.organization?.displayName ?? '',
                  phone: '',
                  address: '',
                  postalCode: '',
                },
              })
            }
          >
            حقوقی / آژانس
          </Button>
        </div>
        {draft.mode === 'organization' ? (
          draft.organization ? (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <strong>{draft.organization.displayName}</strong>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => change({ ...draft, organization: null })}
              >
                تغییر آژانس
              </Button>
            </div>
          ) : (
            <SalesOrganizationCustomer
              refreshRevision={refreshRevision}
              disabled={busy}
              selectedOrganizationId=""
              onClear={() => change({ ...draft, organization: null })}
              onBusyChange={onBusyChange}
              onSelected={(person) => chooseOrganization(person)}
            />
          )
        ) : null}

        {!state.legacyContract && draft.mode !== 'organization' ? (
          <label className={peopleStyles.samePerson}>
            <input
              type="checkbox"
              checked={draft.mode === 'first-passenger'}
              disabled={busy}
              onChange={(event) =>
                change({
                  ...draft,
                  mode: event.target.checked ? 'first-passenger' : 'person',
                  separateCustomer: !event.target.checked,
                  buyerContact: {
                    name: '',
                    phone: '',
                    address: '',
                    postalCode: '',
                  },
                  rows: {
                    ...draft.rows,
                    primary: event.target.checked
                      ? peopleRow(draft, 'p0')
                      : (draft.previousSeparateCustomer ?? {
                          values: emptyPeopleValues(),
                        }),
                  },
                })
              }
            />
            مشتری طرف حساب همان مسافر اول است
          </label>
        ) : null}
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            label="نام مشتری"
            id="sales-buyer-name"
            required={draft.mode === 'person' && !buyerRow.person}
          >
            <div className="relative">
              <Input
                id="sales-buyer-name"
                value={buyerContact.name}
                maxLength={200}
                disabled={busy}
                onChange={(event) => changeBuyer('name', event.target.value)}
              />
              {draft.mode !== 'organization' ? (
                <button
                  type="button"
                  aria-label="جست‌وجوی نام مشتری"
                  className="absolute left-2 top-2 text-primary"
                  disabled={busy}
                  onClick={() => {
                    setLookupInRow(false);
                    setLookup(buyerKey);
                  }}
                >
                  <Search className="size-5" />
                </button>
              ) : null}
            </div>
          </FormField>
          {lookup && !lookupInRow ? (
            <SalesPersonSearch
              {...(lookup === buyerKey ? { query: buyerContact.name } : {})}
              purpose={
                lookup === buyerKey && draft.mode !== 'organization'
                  ? 'customer'
                  : 'passenger'
              }
              selectedIds={keys
                .filter((key) => key !== lookup)
                .flatMap((key) =>
                  peopleRow(draft, key).person?.id
                    ? [peopleRow(draft, key).person!.id]
                    : [],
                )}
              onCancel={() => setLookup(null)}
              onSelect={(person) => void choose(person)}
            />
          ) : null}

          <FormField label="شماره مشتری" id="sales-buyer-phone">
            <Input
              id="sales-buyer-phone"
              type="tel"
              dir="ltr"
              value={buyerContact.phone}
              maxLength={16}
              disabled={busy}
              onChange={(event) => changeBuyer('phone', event.target.value)}
            />
          </FormField>
          <FormField label="آدرس مشتری" id="sales-buyer-address">
            <Input
              id="sales-buyer-address"
              value={buyerContact.address}
              maxLength={1000}
              disabled={busy}
              onChange={(event) => changeBuyer('address', event.target.value)}
            />
          </FormField>
          {showAcquaintance ? (
            <FormField label="نحوه آشنایی با ما" required>
              <SalesThemedSelect
                label="نحوه آشنایی برای کل قرارداد"
                value={
                  draft.acquaintanceMethodId ??
                  peopleRow(draft, 'p0').values.acquaintanceMethodId ??
                  ''
                }
                disabled={
                  busy ||
                  methodsLoading ||
                  Boolean(methodsError) ||
                  !acquaintanceMethods.length
                }
                options={[
                  { value: '', label: 'انتخاب نحوه آشنایی' },
                  ...acquaintanceMethods.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ]}
                onValueChange={(acquaintanceMethodId) =>
                  change(
                    setSalesPeopleAcquaintanceMethod(
                      draft,
                      acquaintanceMethodId,
                    ),
                  )
                }
              />
            </FormField>
          ) : null}
          <FormField label="تلفن ثابت مشتری" id="sales-buyer-landline">
            <Input
              id="sales-buyer-landline"
              type="tel"
              dir="ltr"
              value={buyerContact.landline}
              maxLength={16}
              disabled={busy}
              onChange={(event) => changeBuyer('landline', event.target.value)}
            />
          </FormField>
          <FormField label="کد پستی مشتری" id="sales-buyer-postal">
            <Input
              id="sales-buyer-postal"
              inputMode="numeric"
              dir="ltr"
              value={buyerContact.postalCode}
              maxLength={10}
              disabled={busy}
              onChange={(event) =>
                changeBuyer('postalCode', event.target.value)
              }
            />
          </FormField>
        </div>
      </section>

      {!state.legacyContract && (
        <CustomerEntrySheet
          optionalFields={[
            'nationalId',
            'birthDate',
            'passportNumber',
            'passportExpiryDate',
            ...(!passportIdentity ? (['gender'] as const) : []),
          ]}
          topScrollbar
          extraColumns={[
            ...(state.serviceKinds.includes('FLIGHT')
              ? (['OUTBOUND', 'RETURN'] as const)
                  .filter((d) => salesDirections(state, 'FLIGHT').includes(d))
                  .map((direction) => ({
                    key: direction,
                    title: direction === 'OUTBOUND' ? 'بلیط رفت' : 'بلیط برگشت',
                    render: (row: CustomerEntryRow) => {
                      const key = row.key.replace('sales-entry-', '');
                      const person = peopleRow(draft, key).person;
                      const id = person?.id ?? key;
                      const selected = salesPassengerFlightDirections(
                        state,
                        id,
                      );
                      return (
                        <input
                          type="checkbox"
                          aria-label={
                            (direction === 'OUTBOUND'
                              ? 'بلیط رفت '
                              : 'بلیط برگشت ') + row.label
                          }
                          disabled={busy}
                          checked={selected.includes(direction)}
                          onChange={() =>
                            onFlightDirectionsChange?.({
                              ...state.passengerFlightDirections,
                              [id]: selected.includes(direction)
                                ? selected.filter((d) => d !== direction)
                                : [...selected, direction],
                            })
                          }
                        />
                      );
                    },
                  }))
              : []),
            ...(usesRoomDrivenGuests(state) && onGuestStateChange
              ? guestStayColumns(
                  state,
                  onGuestStateChange,
                  (key) => peopleRow(draft, key).person?.id ?? key,
                  busy,
                )
              : []),
            ...transferDirectionColumns(
              state,
              (patch) => onGuestStateChange?.(patch),
              (key) => peopleRow(draft, key).person?.id ?? key,
              busy,
            ),
          ]}
          rows={rows.filter((row) => row.key !== 'sales-entry-primary')}
          showPassportExpiry={passportIdentity}
          visibleFields={visibleEntryFields}
          columnOrder={
            passportIdentity
              ? [
                  'passportFirstName',
                  'passportLastName',
                  'gender',
                  'birthDate',
                  'passportNumber',
                  'passportExpiryDate',
                  'nationalId',
                ]
              : ['firstName', 'lastName', 'gender', 'birthDate', 'nationalId']
          }
          columnLabels={
            passportIdentity
              ? {
                  nationalId: 'کد ملی',
                  passportFirstName: 'نام انگلیسی مطابق پاسپورت *',
                  passportLastName: 'نام خانوادگی انگلیسی مطابق پاسپورت *',
                  birthDate: 'تاریخ تولد',
                  passportNumber: 'شماره پاسپورت',
                  passportExpiryDate: 'انقضای پاسپورت',
                }
              : { nationalId: 'کد ملی', birthDate: 'تاریخ تولد' }
          }
          salesDatePolicy
          calendarSwitchInBirthDateHeader
          calendarMode={calendar}
          onCalendarModeChange={setCalendar}
          disabled={busy}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          disabled={busy}
          loading={busy}
          onClick={() => void save()}
        >
          <Check className="size-4" />
          {Object.values(draft.rows).some((row) => row.reviewRequired)
            ? 'بررسی و ادامه ثبت افراد'
            : 'ثبت و تأیید افراد'}
        </Button>
      </div>
      {confirmed ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700"
        >
          همه مسافران تأیید شدند؛ می‌توانید به مرحله بعد بروید.
        </p>
      ) : null}
    </section>
  );
}
