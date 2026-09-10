'use client';
import { useEffect, useState } from 'react';
import type {
  ReservationIntakeV1,
  TravelDeliveryAuthorizationV1,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { agencyClient } from '@/modules/organizations/api/agency-client';
import type { MasterDataRecord } from '@rubi/contracts';
import { TravelDocument } from './travel-document';
import { VoucherSettings } from './voucher-settings';
import { ReservationTickets } from './reservation-tickets';

export async function travelRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const send = () =>
    fetch(`${base}/${path}`, {
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
  let response = await send();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await send();
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof result?.error?.message === 'string'
        ? result.error.message
        : typeof result?.message === 'string'
          ? result.message
          : 'عملیات انجام نشد؛ مجوز و اتصال را بررسی کنید.',
    );
  return result as T;
}
type WorkflowIntake = ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
export function workflowOperationNote(
  operation: TravelWorkflowCommandV1['action'],
  note: string,
) {
  if (operation === 'BRANDING') return 'انتخاب سربرگ خروجی';
  return (
    note.trim() ||
    (operation === 'REQUEST_SUPPLIER'
      ? 'ثبت ارسال فرم رزرواسیون به کارگزار'
      : '')
  );
}
const labels = {
  NEW: 'درخواست جدید',
  REQUESTED: 'در انتظار کارگزار',
  CONFIRMED: 'آماده صدور واچر هتل',
  CANCELLED: 'ابطال‌شده',
};

export function TravelWorkflowForm({
  id,
  action,
}: {
  id: string;
  action: string;
}) {
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [intake, setIntake] = useState<WorkflowIntake>();
  const [delivery, setDelivery] = useState<TravelDeliveryAuthorizationV1>();
  const [brandKind, setBrandKind] = useState<'OWN' | 'AGENCY'>('OWN');
  const [agencyId, setAgencyId] = useState('');
  const [search, setSearch] = useState('');
  const [agencies, setAgencies] = useState<MasterDataRecord[]>([]);
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [ages, setAges] = useState<TravelWorkflowStateV1['ageOverrides']>({});
  useEffect(() => {
    let active = true;
    void travelRequest<{
      data: WorkflowIntake;
      delivery: TravelDeliveryAuthorizationV1;
    }>(`reservations/requests/${id}/workflow`)
      .then((result) => {
        if (!active) return;
        setIntake(result.data);
        setDelivery(result.delivery);
        setOrder(
          result.data.workflow.roomOrder.length
            ? result.data.workflow.roomOrder
            : [...result.data.snapshot.passengerIds],
        );
        setAges(result.data.workflow.ageOverrides);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function run(operation: TravelWorkflowCommandV1['action']) {
    if (!intake || busy) return;
    const operationNote = workflowOperationNote(operation, note);
    if (!operationNote) {
      setError('توضیح / دلیل عملیات را وارد کنید.');
      return;
    }
    if (operation === 'CONFIRM_SUPPLIER' && !reference.trim()) {
      setError('مرجع تأیید کارگزار را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${id}/workflow`,
        {
          action: operation,
          expectedVersion: intake.workflow.version,
          note: operationNote,
          branding: { kind: brandKind, referenceId: agencyId },
          supplierReference: reference,
          insuranceReference: reference,
          acknowledgeMissingInsurance: acknowledge,
          roomOrder: order,
          ageOverrides: ages,
        },
      );
      setIntake({ ...intake, workflow: data });
      setNote('');
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  if (!intake) return <p role="status">{error || 'در حال دریافت اطلاعات…'}</p>;
  const state = intake.workflow;
  const closed = state.voucherIssued || state.supplierStatus === 'CANCELLED';
  return (
    <div className="grid gap-4" dir="rtl">
      <p role="status">
        {state.voucherIssued
          ? 'واچر صادر شد؛ عملیات رزرواسیون پایان یافت.'
          : labels[state.supplierStatus]}{' '}
        · نسخه {state.version}
      </p>
      <p className="text-sm">
        تحویل مدارک به فروش:{' '}
        {delivery?.approved
          ? 'تأیید مالی ثبت شده'
          : 'قفل؛ در انتظار تأیید مالی'}
      </p>
      {action === 'رزرواسیون' && (
        <p className="text-sm text-muted-foreground">
          قفل مالی فقط مربوط به تحویل مدارک به فروش است؛ دریافت فرم رزرواسیون
          برای کارگزار نیاز به تأیید مالی ندارد.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!closed && ['بلیط', 'رزرواسیون', 'واچر'].includes(action) && (
        <section className="grid gap-2 rounded border border-border p-3">
          <p>خروجی با سربرگ خودمان باشد؟</p>
          <label>
            <input
              type="radio"
              checked={brandKind === 'OWN'}
              onChange={() => setBrandKind('OWN')}
            />{' '}
            بله، شرکت فعال
          </label>
          <label>
            <input
              type="radio"
              checked={brandKind === 'AGENCY'}
              onChange={() => setBrandKind('AGENCY')}
            />{' '}
            خیر، آژانس دیگر
          </label>
          {brandKind === 'AGENCY' && (
            <>
              <Input
                aria-label="جست‌وجوی آژانس"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                onClick={() => {
                  void agencyClient
                    .list({
                      search,
                      status: 'active',
                      page: 1,
                      pageSize: 30,
                      role: 'AGENCY',
                    })
                    .then((r) => setAgencies([...r.data]))
                    .catch(() => setError('جست‌وجوی آژانس انجام نشد.'));
                }}
              >
                جست‌وجوی آژانس
              </Button>
              <select
                aria-label="انتخاب آژانس"
                className="bg-surface border border-border p-2"
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
              >
                <option value="">انتخاب آژانس</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <Button
            disabled={busy || (brandKind === 'AGENCY' && !agencyId)}
            onClick={() => void run('BRANDING')}
          >
            ثبت سربرگ
          </Button>
          <p>{state.branding?.name ?? 'سربرگ انتخاب نشده'}</p>
        </section>
      )}
      {action === 'بلیط' &&
        state.branding &&
        state.supplierStatus !== 'CANCELLED' && (
          <Button onClick={() => setTicket(true)}>مشاهده بلیط مسافران</Button>
        )}
      {ticket && (
        <ReservationTickets
          request={intake}
          branding={state.branding}
          onClose={() => setTicket(false)}
        />
      )}
      {(action === 'رزرواسیون' ||
        action === 'واچر' ||
        (action === 'Confirmation' && state.voucherIssued)) && (
        <TravelDocument
          intake={intake}
          voucher={action === 'واچر' || action === 'Confirmation'}
        />
      )}
      {action === 'واچر' && (
        <VoucherSettings
          key={`${id}:${state.version}`}
          intake={intake}
          onDirty={() => setSettingsDirty(true)}
          onSaved={(workflow) => {
            setIntake({ ...intake, workflow });
            setSettingsDirty(false);
          }}
        />
      )}
      {settingsDirty && (
        <p role="status">تنظیمات تغییر کرده؛ قبل از صدور ذخیره کنید.</p>
      )}
      {action === 'واچر' && state.supplierStatus === 'NEW' && (
        <p role="status">
          ابتدا فرم رزرواسیون را آماده و ارسال درخواست به کارگزار را ثبت کنید؛
          سپس صدور واچر فعال می‌شود.
        </p>
      )}
      {action === 'ویرایش' && (
        <div className="grid gap-2">
          <p>
            ترتیب اسکان و رده سنی عملیاتی؛ تاریخ تولد پرونده مشتری تغییر
            نمی‌کند.
          </p>
          {order.map((id, index) => (
            <div key={id} className="flex items-center gap-2">
              <span>
                {intake.snapshot.passengerAssignments?.find(
                  (p) => p.customerId === id,
                )?.displayNameSnapshot ?? id}
              </span>
              <Button
                disabled={closed || !index}
                onClick={() =>
                  setOrder((list) => {
                    const next = [...list];
                    [next[index - 1], next[index]] = [
                      next[index]!,
                      next[index - 1]!,
                    ];
                    return next;
                  })
                }
              >
                بالا
              </Button>
              <select
                aria-label="رده سنی عملیاتی"
                className="rounded border border-border bg-surface p-2"
                disabled={closed}
                value={ages[id] ?? ''}
                onChange={(e) =>
                  setAges((current) => {
                    const next = { ...current };
                    if (e.target.value)
                      next[id] = e.target.value as 'ADULT' | 'CHILD' | 'INFANT';
                    else delete next[id];
                    return next;
                  })
                }
              >
                <option value="">طبق قرارداد</option>
                <option value="ADULT">بزرگسال</option>
                <option value="CHILD">کودک</option>
                <option value="INFANT">نوزاد</option>
              </select>
            </div>
          ))}
        </div>
      )}
      {!closed && action !== 'بلیط' && (
        <>
          {(action === 'Confirmation' ||
            action === 'واچر' ||
            action === 'بیمه‌نامه') && (
            <label>
              {action === 'بیمه‌نامه'
                ? 'شماره بیمه‌نامه صادرشده'
                : 'مرجع تأیید کارگزار'}
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={200}
              />
            </label>
          )}
          <label>
            {action === 'رزرواسیون'
              ? 'توضیحات ارسال (اختیاری)'
              : 'توضیح / دلیل عملیات'}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </label>
          {(action === 'واچر' || action === 'Confirmation') &&
            !state.insuranceIssued && (
              <label className="rounded border border-amber-500 p-3">
                <p>
                  بیمه هنوز صادر نشده است. در صورت عدم تمایل مسافر می‌توانید
                  ادامه دهید.
                </p>
                <input
                  type="checkbox"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                />{' '}
                ادامه بدون بیمه
              </label>
            )}
          <div className="flex flex-wrap gap-2">
            {action === 'رزرواسیون' && (
              <Button
                disabled={busy || state.supplierStatus !== 'NEW'}
                onClick={() => void run('REQUEST_SUPPLIER')}
              >
                {busy
                  ? 'در حال ثبت…'
                  : state.supplierStatus === 'REQUESTED'
                    ? 'ارسال به کارگزار ثبت شده'
                    : 'ثبت ارسال درخواست به کارگزار'}
              </Button>
            )}
            {action === 'Confirmation' && (
              <>
                <Button
                  disabled={
                    busy ||
                    state.supplierStatus !== 'REQUESTED' ||
                    (!state.insuranceIssued && !acknowledge)
                  }
                  onClick={() => void run('CONFIRM_SUPPLIER')}
                >
                  تأیید کارگزار و صدور واچر هتل برای فروش
                </Button>
                <Button disabled={busy} onClick={() => void run('CANCEL')}>
                  ابطال درخواست با دلیل
                </Button>
              </>
            )}
            {action === 'بیمه‌نامه' && (
              <Button disabled={busy} onClick={() => void run('INSURANCE')}>
                ثبت بیمه‌نامه صادرشده
              </Button>
            )}
            {action === 'واچر' && (
              <Button
                disabled={
                  busy ||
                  settingsDirty ||
                  !['REQUESTED', 'CONFIRMED'].includes(state.supplierStatus) ||
                  (!state.insuranceIssued && !acknowledge)
                }
                onClick={() =>
                  void run(
                    state.supplierStatus === 'REQUESTED'
                      ? 'CONFIRM_SUPPLIER'
                      : 'ISSUE_VOUCHER',
                  )
                }
              >
                تأیید کارگزار و صدور واچر
              </Button>
            )}
            {action === 'واچر' && (
              <Button disabled={busy} onClick={() => void run('CANCEL')}>
                ابطال درخواست با دلیل
              </Button>
            )}
            {action === 'ویرایش' && (
              <Button disabled={busy} onClick={() => void run('ARRANGEMENT')}>
                ثبت ترتیب و رده سنی
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {action === 'رزرواسیون' && state.supplierStatus === 'REQUESTED' && (
            <p role="status">ارسال درخواست ثبت شد؛ در انتظار تأیید کارگزار.</p>
          )}
        </>
      )}
      {state.updatedAt && (
        <p className="text-xs text-muted-foreground">
          آخرین ثبت: {new Date(state.updatedAt).toLocaleString('fa-IR')} ·{' '}
          {state.note}
        </p>
      )}
    </div>
  );
}
