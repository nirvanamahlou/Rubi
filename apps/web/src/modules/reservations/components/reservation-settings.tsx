'use client';
import { useEffect, useState } from 'react';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type TravelWorkflowStateV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
import {
  defaultVoucherSettings,
  voucherTextLabels,
  voucherNumberLabels,
  voucherFlagLabels,
  type VoucherTextFieldKey,
} from '../model/voucher-settings';
import { travelRequest } from './travel-workflow-form';
import { useReservationFormReferences } from './reservation-form-sheet';
import { DatePicker } from '@/components/ui/date-picker';
import { ReservationFiles } from '../passenger-files/files';
import { TravelDocument } from './travel-document';
import styles from './reservation-settings.module.css';

export type ReservationSettingsSection =
  'ALL' | 'PARTY' | 'FLIGHT' | 'HOTEL' | 'OTHER' | 'PASSENGERS';

const sectionLabels: Record<ReservationSettingsSection, string> = {
  ALL: 'تنظیمات کامل فرم رزواسیون',
  PARTY: 'ویرایش طرف قرارداد',
  FLIGHT: 'ویرایش اطلاعات پرواز',
  HOTEL: 'ویرایش اطلاعات هتل',
  OTHER: 'ویرایش سایر خدمات',
  PASSENGERS: 'ویرایش مسافران فرم رزواسیون',
};

const emptySelectValue = '__UNSELECTED__';

type ReservationSelectOption = { value: string; label: string };

function ReservationSelect({
  ariaLabel,
  value,
  options,
  onValueChange,
}: {
  ariaLabel: string;
  value?: string;
  options: readonly ReservationSelectOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || emptySelectValue}
      onValueChange={(next) =>
        onValueChange(next === emptySelectValue ? '' : next)
      }
    >
      <SelectTrigger aria-label={ariaLabel} className={styles.selectTrigger}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReservationSettingsForm({
  intake,
  refs,
  onSaved,
  onDirty,
  section = 'ALL',
  partyName,
}: {
  intake: ReservationFormIntake;
  refs: ReservationFormReferences;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
  section?: ReservationSettingsSection;
  partyName?: string;
}) {
  const [draft, setDraft] = useState(() => {
    const source = structuredClone(intake);
    delete source.workflow.voucherSettings;
    if (source.workflow.supplierFormSettings)
      source.workflow.voucherSettings = source.workflow.supplierFormSettings;
    const settings = defaultVoucherSettings(source, refs);
    if (!settings.text.contractPartyName && partyName)
      settings.text.contractPartyName = partyName;
    return settings;
  });
  const [applyToContractAndVoucher, setApplyToContractAndVoucher] =
    useState(false);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
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
    const childWithoutHotelBand = draft.passengers.some(
      (passenger) =>
        passenger.selected &&
        passenger.age === 'CHD' &&
        !passenger.hotelChildAgeBand,
    );
    if (childWithoutHotelBand) {
      setError(
        'برای همهٔ مسافران کودک، ردهٔ هتل ۲ تا ۶ یا ۶ تا ۱۲ سال را انتخاب کنید.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${intake.id}/workflow`,
        {
          action: 'SUPPLIER_FORM_SETTINGS',
          applyToContractAndVoucher,
          expectedContractVersion: intake.contractEditVersion,
          expectedVersion: intake.workflow.version,
          note: applyToContractAndVoucher
            ? sectionLabels[section] + ' و اعمال در قرارداد و واچر'
            : sectionLabels[section] + ' در فرم رزواسیون و مبنای خرید',
          voucherSettings: draft,
        },
      );
      onSaved(r.data);
      setMessage('نسخهٔ جدید با موفقیت ثبت شد.');
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
  const textKeysBySection: Record<
    ReservationSettingsSection,
    readonly VoucherTextFieldKey[]
  > = {
    ALL: voucherTextKeys.filter(
      (key) =>
        !primaryTextKeys.includes(key as (typeof primaryTextKeys)[number]),
    ),
    PARTY: ['contractPartyName'],
    FLIGHT: [
      'arrivalAirline',
      'arrivalFlight',
      'arrivalDate',
      'arrivalTime',
      'departureAirline',
      'departureFlight',
      'departureDate',
      'departureTime',
    ],
    HOTEL: [
      'country',
      'city',
      'hotel',
      'stars',
      'meal',
      'website',
      'stayNotes',
    ],
    OTHER: [
      'broker',
      'leaderLanguage',
      'leaderName',
      'leaderPhone',
      'transferBoard',
      'transferPhone',
      'transferKind',
      'excursionDescription',
      'extraServices',
      'remarks',
    ],
    PASSENGERS: [],
  };
  const sectionTextKeys = textKeysBySection[section];
  const textField = (key: VoucherTextFieldKey) => (
    <label key={key}>
      {voucherTextLabels[key]}
      {['checkIn', 'checkOut', 'arrivalDate', 'departureDate'].includes(key) ? (
        <DatePicker
          defaultCalendarSystem="gregorian"
          gregorianEnglish
          value={draft.text[key] ?? ''}
          onChange={(value) =>
            update({ ...draft, text: { ...draft.text, [key]: value } })
          }
        />
      ) : (
        <Input
          value={draft.text[key] ?? ''}
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
    <section className={styles.form}>
      <header className={styles.formHeader}>
        <span>ویرایش نسخهٔ رزواسیون</span>
        <h3>{sectionLabels[section]}</h3>
        <p>
          اطلاعات همین بخش را اصلاح کنید. هر ذخیره یک نسخهٔ مستقل در سابقهٔ فرم
          رزواسیون می‌سازد؛ ردهٔ کودک هتل در فرم ارسالی کارگزار چاپ می‌شود.
        </p>
      </header>
      <p
        className={`${styles.hotelSummary} ${
          section === 'ALL' || section === 'HOTEL' ? '' : 'hidden'
        }`}
      >
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
        <div
          className={
            section === 'ALL' || section === 'HOTEL' ? 'grid gap-4' : 'hidden'
          }
        >
          <div className={styles.sectionCard}>
            <h4>تاریخ هتل و نوع اتاق</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {primaryTextKeys.map(textField)}
            </div>
          </div>
          <div className={styles.sectionCard}>
            <h4>تعداد اتاق‌ها</h4>
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
        </div>
        <div
          className={
            section === 'ALL' || section === 'PASSENGERS'
              ? 'grid gap-4'
              : 'hidden'
          }
        >
          <p className={styles.passengerSummary}>
            مسافران انتخاب‌شده: {selected.length} · بلیط ADL{' '}
            {selected.filter((p) => p.age === 'ADL').length} · CHD{' '}
            {selected.filter((p) => p.age === 'CHD').length} · INF{' '}
            {selected.filter((p) => p.age === 'INF').length}
          </p>
          <p className={styles.passengerHint}>
            ردهٔ بلیط از نوع ADL / CHD / INF جداست. برای هر CHD، ردهٔ هتل را ۲
            تا ۶ یا ۶ تا ۱۲ سال تعیین کنید؛ پروندهٔ اصلی و بلیط تغییر نمی‌کنند.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.passengerTable}>
              <thead>
                <tr>
                  <th>انتخاب</th>
                  <th>مسافر</th>
                  <th>نوع اتاق</th>
                  <th>رده بلیط</th>
                  <th>رده کودک هتل</th>
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
                              j === i
                                ? { ...v, selected: e.target.checked }
                                : v,
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
                      <ReservationSelect
                        ariaLabel={`رده سنی مسافر ${i + 1}`}
                        value={p.age}
                        options={[
                          { value: 'ADL', label: 'بزرگسال (ADL)' },
                          { value: 'CHD', label: 'کودک (CHD)' },
                          { value: 'INF', label: 'نوزاد (INF)' },
                        ]}
                        onValueChange={(age) =>
                          update({
                            ...draft,
                            passengers: draft.passengers.map((v, j) =>
                              j === i ? { ...v, age: age as typeof p.age } : v,
                            ),
                          })
                        }
                      />
                    </td>
                    <td>
                      {p.age === 'CHD' ? (
                        <ReservationSelect
                          ariaLabel={`رده کودک هتل مسافر ${i + 1}`}
                          value={p.hotelChildAgeBand ?? ''}
                          options={[
                            {
                              value: emptySelectValue,
                              label: 'انتخاب ردهٔ هتل',
                            },
                            {
                              value: 'CHD_2_TO_6',
                              label: 'کودک ۲ تا ۶ سال',
                            },
                            {
                              value: 'CHD_6_TO_12',
                              label: 'کودک ۶ تا ۱۲ سال',
                            },
                          ]}
                          onValueChange={(hotelChildAgeBand) =>
                            update({
                              ...draft,
                              passengers: draft.passengers.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      hotelChildAgeBand: hotelChildAgeBand as
                                        'CHD_2_TO_6' | 'CHD_6_TO_12' | '',
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td>
                      <ReservationSelect
                        ariaLabel={`جنسیت مسافر ${i + 1}`}
                        value={p.sex ?? ''}
                        options={[
                          { value: emptySelectValue, label: 'نامشخص' },
                          { value: 'MALE', label: 'مرد' },
                          { value: 'FEMALE', label: 'زن' },
                        ]}
                        onValueChange={(sex) =>
                          update({
                            ...draft,
                            passengers: draft.passengers.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    sex: sex as 'MALE' | 'FEMALE' | '',
                                  }
                                : v,
                            ),
                          })
                        }
                      />
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
        </div>
        <details
          open={section !== 'ALL'}
          className={
            sectionTextKeys.length
              ? 'rounded-xl border border-border p-3'
              : 'hidden'
          }
        >
          <summary className="cursor-pointer font-bold">
            {sectionLabels[section]}
          </summary>
          <div
            className={
              section === 'ALL' || section === 'OTHER'
                ? 'mt-3 flex flex-wrap gap-4'
                : 'hidden'
            }
          >
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
            {sectionTextKeys.map(textField)}
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
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <details
        className={section === 'ALL' ? '' : 'hidden'}
        onToggle={(event) => setShowFiles(event.currentTarget.open)}
      >
        <summary>پیوست فرم رزواسیون و واچر</summary>
        {showFiles && <ReservationFiles id={intake.id} />}
      </details>
      <details className={section === 'ALL' ? '' : 'hidden'}>
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
      {past && section === 'ALL' && (
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
  section?: ReservationSettingsSection;
  partyName?: string;
}) {
  const refs = useReservationFormReferences(props.intake, true);
  return refs.ready ? (
    <ReservationSettingsForm {...props} refs={refs.references} />
  ) : (
    <p>در حال دریافت تنظیمات…</p>
  );
}
