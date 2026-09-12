'use client';
import { useEffect, useState } from 'react';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type TravelWorkflowStateV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
import {
  defaultVoucherSettings,
  voucherTextLabels,
  voucherNumberLabels,
  voucherFlagLabels,
} from '../model/voucher-settings';
import { travelRequest } from './travel-workflow-form';
import { useReservationFormReferences } from './reservation-form-sheet';
import { DatePicker } from '@/components/ui/date-picker';
import { ReservationFiles } from '../passenger-files/files';
import { TravelDocument } from './travel-document';
function ReservationSettingsForm({
  intake,
  refs,
  onSaved,
  onDirty,
}: {
  intake: ReservationFormIntake;
  refs: ReservationFormReferences;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
}) {
  const [draft, setDraft] = useState(() => {
    const source = structuredClone(intake);
    delete source.workflow.voucherSettings;
    if (source.workflow.supplierFormSettings)
      source.workflow.voucherSettings = source.workflow.supplierFormSettings;
    return defaultVoucherSettings(source, refs);
  });
  const [applyToContractAndVoucher, setApplyToContractAndVoucher] =
    useState(false);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
    { version: number; state: TravelWorkflowStateV1; createdAt: string }[]
  >([]);
  const [past, setPast] = useState<TravelWorkflowStateV1>();
  const [showFiles, setShowFiles] = useState(false);
  useEffect(() => {
    let live = true;
    void travelRequest<{ data: typeof history }>(
      `reservations/requests/${intake.id}/workflow/history`,
    )
      .then((r) => {
        if (live) setHistory(r.data);
      })
      .catch(() => {
        if (live) setError('دریافت سابقه انجام نشد.');
      });
    return () => {
      live = false;
    };
  }, [intake.id, intake.workflow.version]);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${intake.id}/workflow`,
        {
          action: 'SUPPLIER_FORM_SETTINGS',
          applyToContractAndVoucher,
          expectedContractVersion: intake.contractEditVersion,
          expectedVersion: intake.workflow.version,
          note: applyToContractAndVoucher
            ? 'ویرایش فرم رزواسیون و اعمال در قرارداد و واچر'
            : 'ویرایش فرم رزواسیون و مبنای خرید',
          voucherSettings: draft,
        },
      );
      onSaved(r.data);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const update = (next: typeof draft) => {
    setDraft(next);
    onDirty();
  };
  const selected = draft.passengers.filter((p) => p.selected);
  const primaryTextKeys = ['checkIn', 'checkOut', 'roomType'] as const;
  const secondaryTextKeys = voucherTextKeys.filter(
    (key) => !primaryTextKeys.includes(key as (typeof primaryTextKeys)[number]),
  );
  const textField = (key: (typeof voucherTextKeys)[number]) => (
    <label key={key}>
      {voucherTextLabels[key]}
      {['checkIn', 'checkOut', 'arrivalDate', 'departureDate'].includes(key) ? (
        <DatePicker
          defaultCalendarSystem="gregorian"
          gregorianEnglish
          value={draft.text[key]}
          onChange={(value) =>
            update({ ...draft, text: { ...draft.text, [key]: value } })
          }
        />
      ) : (
        <Input
          value={draft.text[key]}
          maxLength={
            [
              'stayNotes',
              'remarks',
              'excursionDescription',
              'extraServices',
            ].includes(key)
              ? 500
              : 200
          }
          placeholder={key === 'website' ? 'https://' : undefined}
          type={
            ['arrivalTime', 'departureTime'].includes(key) ? 'time' : 'text'
          }
          onChange={(event) =>
            update({
              ...draft,
              text: { ...draft.text, [key]: event.target.value },
            })
          }
        />
      )}
    </label>
  );
  return (
    <section className="grid gap-4 rounded-xl border border-border p-4">
      <h3 className="font-bold">تنظیمات فرم رزواسیون</h3>
      <p className="text-sm">
        تاریخ هتل، تعداد و نوع اتاق و ردهٔ سنی مسافران را اصلاح کنید. هر ذخیره
        یک نسخهٔ مستقل در سابقهٔ فرم رزواسیون می‌سازد.
      </p>
      <p>
        تعداد اتاق:{' '}
        {draft.numbers.singleRooms +
          draft.numbers.doubleRooms +
          draft.numbers.customRooms}{' '}
        · تعداد شب:{' '}
        {draft.text.checkIn && draft.text.checkOut
          ? Math.max(
              0,
              Math.round(
                (Date.parse(draft.text.checkOut) -
                  Date.parse(draft.text.checkIn)) /
                  86400000,
              ),
            )
          : '—'}
      </p>
      <fieldset
        disabled={busy || intake.workflow.supplierStatus === 'CANCELLED'}
        className="grid gap-4"
      >
        <div className="grid gap-3 rounded-xl border border-border p-3">
          <h4 className="font-bold">تاریخ هتل و نوع اتاق</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {primaryTextKeys.map(textField)}
          </div>
        </div>
        <div className="grid gap-3 rounded-xl border border-border p-3">
          <h4 className="font-bold">تعداد اتاق‌ها</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {voucherNumberKeys.map((key) => (
              <label key={key}>
                {voucherNumberLabels[key]}
                <Input
                  type="number"
                  min={0}
                  max={1000}
                  value={draft.numbers[key]}
                  onChange={(event) =>
                    update({
                      ...draft,
                      numbers: {
                        ...draft.numbers,
                        [key]: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>
        <p>
          مسافران انتخاب‌شده: {selected.length} · ADL{' '}
          {selected.filter((p) => p.age === 'ADL').length} · CHD{' '}
          {selected.filter((p) => p.age === 'CHD').length} · INF{' '}
          {selected.filter((p) => p.age === 'INF').length}
        </p>
        <p className="text-sm">
          نوع اتاق و ردهٔ سنی در نسخهٔ عملیاتی فرم ذخیره می‌شود؛ پروندهٔ اصلی
          مسافر تغییر نمی‌کند.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>انتخاب</th>
                <th>مسافر</th>
                <th>نوع اتاق</th>
                <th>رده سنی</th>
                <th>جنسیت</th>
                <th>تولد</th>
                <th>شماره مدرک</th>
              </tr>
            </thead>
            <tbody>
              {draft.passengers.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <input
                      aria-label={`انتخاب مسافر ${i + 1}`}
                      type="checkbox"
                      checked={p.selected}
                      onChange={(e) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i ? { ...v, selected: e.target.checked } : v,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    {intake.snapshot.passengerAssignments?.find(
                      (a) => a.customerId === p.id,
                    )?.displayNameSnapshot ?? 'نام دریافت نشده'}
                  </td>
                  <td>
                    <Input
                      aria-label={`نوع اتاق مسافر ${i + 1}`}
                      value={p.roomType}
                      maxLength={100}
                      onChange={(e) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i ? { ...v, roomType: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`رده سنی مسافر ${i + 1}`}
                      className="bg-surface"
                      value={p.age}
                      onChange={(e) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i
                              ? { ...v, age: e.target.value as typeof p.age }
                              : v,
                          ),
                        })
                      }
                    >
                      <option>ADL</option>
                      <option>CHD</option>
                      <option>INF</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="bg-surface"
                      aria-label={`جنسیت مسافر ${i + 1}`}
                      value={p.sex ?? ''}
                      onChange={(e) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  sex: e.target.value as 'MALE' | 'FEMALE' | '',
                                }
                              : v,
                          ),
                        })
                      }
                    >
                      <option value="">نامشخص</option>
                      <option value="MALE">مرد</option>
                      <option value="FEMALE">زن</option>
                    </select>
                  </td>
                  <td>
                    <DatePicker
                      defaultCalendarSystem="gregorian"
                      gregorianEnglish
                      value={p.birthDate ?? ''}
                      onChange={(value) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i ? { ...v, birthDate: value } : v,
                          ),
                        })
                      }
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`شماره مدرک مسافر ${i + 1}`}
                      maxLength={100}
                      value={p.documentNumber ?? ''}
                      onChange={(e) =>
                        update({
                          ...draft,
                          passengers: draft.passengers.map((v, j) =>
                            j === i
                              ? { ...v, documentNumber: e.target.value }
                              : v,
                          ),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer font-bold">
            سایر اطلاعات فرم رزواسیون
          </summary>
          <div className="mt-3 flex flex-wrap gap-4">
            {voucherFlagKeys
              .filter((key) => key !== 'withLetterhead')
              .map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={draft.flags[key]}
                    onChange={(event) =>
                      update({
                        ...draft,
                        flags: {
                          ...draft.flags,
                          [key]: event.target.checked,
                        },
                      })
                    }
                  />{' '}
                  {voucherFlagLabels[key]}
                </label>
              ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {secondaryTextKeys.map(textField)}
          </div>
        </details>
        <label className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <input
            type="checkbox"
            checked={applyToContractAndVoucher}
            onChange={(event) =>
              setApplyToContractAndVoucher(event.target.checked)
            }
          />{' '}
          همین تغییرات در خروجی قرارداد و واچر هتل هم اعمال شود
          <span className="mt-1 block text-xs text-muted-foreground">
            اگر تیک نزنید، تغییر فقط در فرم رزواسیون و مبنای خرید ثبت می‌شود.
          </span>
        </label>
        <Button onClick={() => void save()} disabled={busy || !selected.length}>
          {busy ? 'در حال ذخیره…' : 'ثبت نسخهٔ جدید فرم رزواسیون'}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <details onToggle={(event) => setShowFiles(event.currentTarget.open)}>
        <summary>پیوست فرم رزواسیون و واچر</summary>
        {showFiles && <ReservationFiles id={intake.id} />}
      </details>
      <details>
        <summary>سابقهٔ فرم رزواسیون (۱۰۰ نسخهٔ اخیر)</summary>
        <div className="grid gap-2">
          {history
            .filter((item) => item.state.supplierFormSettings)
            .map((h) => (
              <div
                key={h.version}
                className="flex justify-between gap-3 border-b border-border p-2"
              >
                <span>
                  نسخه {h.version} ·{' '}
                  {new Date(h.createdAt).toLocaleString('fa-IR')} ·{' '}
                  {h.state.note ||
                    (h.state.supplierStatus === 'REQUESTED'
                      ? 'ارسال به کارگزار'
                      : 'فرم رزواسیون')}
                </span>
                {h.state.branding && (
                  <Button variant="outline" onClick={() => setPast(h.state)}>
                    مشاهده / چاپ
                  </Button>
                )}
              </div>
            ))}
        </div>
      </details>
      {past && (
        <div>
          <Button variant="outline" onClick={() => setPast(undefined)}>
            بستن نسخهٔ قبلی
          </Button>
          <TravelDocument intake={{ ...intake, workflow: past }} historical />
        </div>
      )}
    </section>
  );
}

export function ReservationSettings(props: {
  intake: ReservationFormIntake;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
}) {
  const refs = useReservationFormReferences(props.intake, true);
  return refs.ready ? (
    <ReservationSettingsForm {...props} refs={refs.references} />
  ) : (
    <p>در حال دریافت تنظیمات…</p>
  );
}
