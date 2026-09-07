'use client';
import { useRef, useState } from 'react';
import { Plus, Check, Search } from 'lucide-react';
import type { CustomerSummary } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/surfaces';
import {
  CustomerEntrySheet,
  CustomerCalendarSwitch,
  customersApi,
  type CustomerCalendarMode,
  type CustomerEntryRow,
} from '@/modules/customers/public/entry';
import { SalesOrganizationCustomer } from './sales-organization-customer';
import { SalesPersonSearch } from './sales-person-search';
import { SalesDatePicker } from './sales-date-picker';
import {
  salesPassengerAgeLabel,
  salesPassengerCounts,
  salesTravelDate,
  type SalesFormState,
} from '../model/sales-form';
import {
  initialSalesPeopleDraft,
  passengerSlotKeys,
  peopleRow,
  emptyPeopleValues,
  selectedPeopleRow,
  refreshPeopleRow,
  saveSalesPeopleDraft,
  linkCustomerAsFirst,
  editPeopleRow,
  type SalesPeopleDraft,
} from '../model/sales-people-sheet';

export function SalesPeopleSheet({
  state,
  draft: savedDraft,
  onDraftChange,
  onConfirmed,
  onBusyChange,
  onAddInfant,
  onTravelDateChange,
  busy = false,
}: {
  state: SalesFormState;
  draft: SalesPeopleDraft | null;
  onDraftChange: (draft: SalesPeopleDraft) => void;
  onConfirmed: (patch: Partial<SalesFormState>) => void;
  onBusyChange: (busy: boolean) => void;
  onAddInfant: () => void;
  onTravelDateChange: (value: string) => void;
  busy?: boolean;
}) {
  const draft = savedDraft ?? initialSalesPeopleDraft(state);
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('persian');
  const [lookup, setLookup] = useState<string | null>(null);
  const [clearKey, setClearKey] = useState<string | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const inFlight = useRef(false);
  const slots = passengerSlotKeys(state);
  const counts = salesPassengerCounts(state);
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
      change(editPeopleRow(draft, key, selectedPeopleRow(detail)));
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
  const save = async () => {
    if (inFlight.current) return;
    setClearKey(null);
    setLookup(null);
    setLinkPending(false);
    inFlight.current = true;
    onBusyChange(true);
    setError('');
    try {
      const result = await saveSalesPeopleDraft(state, draft, onDraftChange);
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
  const keys = [
    ...(draft.mode !== 'organization' ? ['primary'] : []),
    ...slots,
  ];
  const rows: CustomerEntryRow[] = keys.map((key) => {
    const row = peopleRow(draft, key);
    const label =
      key === 'primary'
        ? 'مشتری اصلی'
        : `مسافر ${(Number(key.slice(1)) + 1).toLocaleString('fa-IR')}`;
    return {
      key: 'sales-entry-' + key,
      label,
      values: row.values,
      readOnly:
        Boolean(row.person) ||
        (key === 'p0' && draft.mode === 'first-passenger'),
      editableFields:
        key === 'p0' && draft.mode === 'first-passenger'
          ? []
          : row.person && !row.profile
            ? ['birthDate']
            : [
                'firstName',
                'lastName',
                'nationalId',
                'birthDate',
                'passportNumber',
                'passportExpiryDate',
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
              {salesPassengerAgeLabel(
                row.values.birthDate,
                salesTravelDate(state),
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
        </div>
      ),
      onChange: (field, value) =>
        change(
          editPeopleRow(draft, key, {
            ...row,
            values: { ...row.values, [field]: value },
          }),
        ),
      actions:
        key === 'p0' && draft.mode === 'first-passenger' ? (
          <span className="text-xs text-primary">از اطلاعات مشتری</span>
        ) : (
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setLookup(key)}
            >
              <Search className="size-3" />
              انتخاب موجود
            </Button>
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
    <section className="space-y-4" aria-label="ورود یکجای مشتری و مسافران">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">مشتری و مسافران همراه</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            هر نفر یک ردیف؛ اطلاعات همه را وارد کنید و در پایان یک‌جا تأیید
            کنید.
          </p>
        </div>
        <CustomerCalendarSwitch mode={calendar} onChange={setCalendar} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 p-3">
        <Button
          type="button"
          size="sm"
          variant={draft.mode !== 'organization' ? 'primary' : 'outline'}
          disabled={busy}
          onClick={() =>
            draft.mode === 'organization' &&
            change({ ...draft, mode: 'person' })
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
              ...(draft.mode === 'first-passenger'
                ? linkCustomerAsFirst(draft, false)
                : draft),
              mode: 'organization',
            })
          }
        >
          حقوقی / آژانس
        </Button>
        {draft.mode !== 'organization' ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.mode === 'first-passenger'}
              disabled={busy}
              onChange={(event) => {
                if (!event.target.checked)
                  return change(linkCustomerAsFirst(draft, false));
                const first = peopleRow(draft, 'p0');
                if (first.person || Object.values(first.values).some(Boolean))
                  setLinkPending(true);
                else change(linkCustomerAsFirst(draft, true));
              }}
            />
            این مشتری مسافر اول هم هست
          </label>
        ) : null}
      </div>
      {linkPending ? (
        <div role="alert" className="rounded-xl border p-3 text-sm">
          اطلاعات مشتری جایگزین ردیف اول شود؟ اطلاعات فعلی با برداشتن تیک
          برمی‌گردد.
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              change(linkCustomerAsFirst(draft, true));
              setLinkPending(false);
            }}
          >
            تأیید جایگزینی
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLinkPending(false)}
          >
            انصراف
          </Button>
        </div>
      ) : null}
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
            disabled={busy}
            selectedOrganizationId=""
            onClear={() => change({ ...draft, organization: null })}
            onBusyChange={onBusyChange}
            onSelected={(person) =>
              change({
                ...draft,
                organization: {
                  id: person.id,
                  displayName: person.displayName,
                  organizationId: person.organizationId,
                },
              })
            }
          />
        )
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {counts.total.toLocaleString('fa-IR')} ردیف مسافر ·{' '}
          {counts.adults.toLocaleString('fa-IR')} بزرگسال،{' '}
          {counts.children.toLocaleString('fa-IR')} کودک،{' '}
          {counts.infants.toLocaleString('fa-IR')} نوزاد
        </p>
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
      </div>
      <p className="text-xs text-muted-foreground">
        ردیف‌ها به تعداد مرحله اول باز شده‌اند. برای تغییر تعداد بزرگسال یا کودک
        به مرحله اول برگردید؛ نوزاد صندلی بلیت کم نمی‌کند.
      </p>
      {!salesTravelDate(state) ||
      (!state.serviceKinds.includes('FLIGHT') &&
        !(state.serviceKinds.includes('HOTEL') && state.hotel.checkIn)) ? (
        <FormField label="تاریخ شروع سفر" required>
          <SalesDatePicker
            value={state.departureDate}
            onChange={onTravelDateChange}
            disabled={busy}
          />
        </FormField>
      ) : null}
      {error ? (
        <Alert tone="error" title="ثبت افراد کامل نشد" description={error} />
      ) : null}
      {lookup ? (
        <SalesPersonSearch
          purpose={lookup === 'primary' ? 'customer' : 'passenger'}
          selectedIds={keys
            .filter(
              (key) =>
                key !== lookup &&
                !(draft.mode === 'first-passenger' && key === 'p0'),
            )
            .flatMap((key) =>
              peopleRow(draft, key).person?.id
                ? [peopleRow(draft, key).person!.id]
                : [],
            )}
          onCancel={() => setLookup(null)}
          onSelect={(person) => void choose(person)}
        />
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
      <CustomerEntrySheet
        rows={rows}
        showPassportExpiry
        calendarMode={calendar}
        onCalendarModeChange={setCalendar}
        disabled={busy}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs leading-6 text-muted-foreground">
          ثبت افراد از همین‌جا در بخش مشتریان انجام می‌شود؛ قرارداد در مرحله
          نهایی ثبت خواهد شد. اصلاح اطلاعات پرونده موجود با «ثبت و تأیید افراد»
          در مشتریان ذخیره می‌شود و نیازمند مجوز ویرایش است. اطلاعات حساس فقط با
          مجوز خوانده می‌شوند؛ تماس جدید جای تماس اصلی قرار می‌گیرد و سابقه قبلی
          حذف نمی‌شود.
        </p>
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
