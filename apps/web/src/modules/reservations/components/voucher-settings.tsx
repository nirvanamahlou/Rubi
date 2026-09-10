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
function VoucherSettingsForm({
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
  const [draft, setDraft] = useState(() =>
    defaultVoucherSettings(intake, refs),
  );
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
          action: 'VOUCHER_SETTINGS',
          expectedVersion: intake.workflow.version,
          note: 'ثبت تنظیمات واچر',
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
  return (
    <section className="grid gap-4 rounded-xl border border-border p-4">
      <h3 className="font-bold">تنظیمات واچر</h3>
      <p className="text-sm">
        تغییرات را پیش از صدور ذخیره کنید. اصلاح واچر صادرشده به‌عنوان نسخهٔ
        جدید نگهداری می‌شود.
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
        <div className="flex flex-wrap gap-4">
          {voucherFlagKeys.map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={draft.flags[k]}
                onChange={(e) =>
                  update({
                    ...draft,
                    flags: { ...draft.flags, [k]: e.target.checked },
                  })
                }
              />{' '}
              {voucherFlagLabels[k]}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {voucherTextKeys.map((k) => (
            <label key={k}>
              {voucherTextLabels[k]}
              {['checkIn', 'checkOut', 'arrivalDate', 'departureDate'].includes(
                k,
              ) ? (
                <DatePicker
                  defaultCalendarSystem="gregorian"
                  gregorianEnglish
                  value={draft.text[k]}
                  onChange={(value) =>
                    update({ ...draft, text: { ...draft.text, [k]: value } })
                  }
                />
              ) : (
                <Input
                  value={draft.text[k]}
                  maxLength={
                    [
                      'stayNotes',
                      'remarks',
                      'excursionDescription',
                      'extraServices',
                    ].includes(k)
                      ? 500
                      : 200
                  }
                  placeholder={k === 'website' ? 'https://' : undefined}
                  type={
                    [
                      'checkIn',
                      'checkOut',
                      'arrivalDate',
                      'departureDate',
                    ].includes(k)
                      ? 'date'
                      : ['arrivalTime', 'departureTime'].includes(k)
                        ? 'time'
                        : 'text'
                  }
                  onChange={(e) =>
                    update({
                      ...draft,
                      text: { ...draft.text, [k]: e.target.value },
                    })
                  }
                />
              )}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {voucherNumberKeys.map((k) => (
            <label key={k}>
              {voucherNumberLabels[k]}
              <Input
                type="number"
                min={0}
                max={1000}
                value={draft.numbers[k]}
                onChange={(e) =>
                  update({
                    ...draft,
                    numbers: { ...draft.numbers, [k]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
        </div>
        <p>
          مسافران انتخاب‌شده: {selected.length} · ADL{' '}
          {selected.filter((p) => p.age === 'ADL').length} · CHD{' '}
          {selected.filter((p) => p.age === 'CHD').length} · INF{' '}
          {selected.filter((p) => p.age === 'INF').length}
        </p>
        <p className="text-sm">
          اطلاعات تکمیلی مسافران مخصوص این واچر است؛ پروندهٔ اصلی مسافر تغییر
          نمی‌کند.
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
        <Button onClick={() => void save()} disabled={busy || !selected.length}>
          {busy ? 'در حال ذخیره…' : 'ذخیره تنظیمات واچر'}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <details onToggle={(event) => setShowFiles(event.currentTarget.open)}>
        <summary>پیوست درخواست و واچر</summary>
        {showFiles && <ReservationFiles id={intake.id} />}
      </details>
      <details>
        <summary>سابقهٔ درخواست و واچر (۱۰۰ نسخهٔ اخیر)</summary>
        <div className="grid gap-2">
          {history.map((h) => (
            <div
              key={h.version}
              className="flex justify-between gap-3 border-b border-border p-2"
            >
              <span>
                نسخه {h.version} ·{' '}
                {new Date(h.createdAt).toLocaleString('fa-IR')} ·{' '}
                {h.state.voucherIssued
                  ? 'واچر صادرشده'
                  : h.state.supplierStatus === 'REQUESTED'
                    ? 'ارسال به کارگزار'
                    : 'درخواست'}
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
          <TravelDocument
            intake={{ ...intake, workflow: past }}
            voucher={past.voucherIssued}
            historical
          />
        </div>
      )}
    </section>
  );
}

export function VoucherSettings(props: {
  intake: ReservationFormIntake;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
}) {
  const refs = useReservationFormReferences(props.intake, true);
  return refs.ready ? (
    <VoucherSettingsForm {...props} refs={refs.references} />
  ) : (
    <p>در حال دریافت تنظیمات…</p>
  );
}
