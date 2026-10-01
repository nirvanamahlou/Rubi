'use client';
import { useEffect, useState } from 'react';
import type { TravelWorkflowStateV1, VoucherSettingsV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { Button } from '@/components/ui/button';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '../model/reservation-form';
import { useReservationFormReferences } from './reservation-form-sheet';
import { travelRequest } from './travel-workflow-form';
type Option = { id: string; name: string };
function ReferenceChoice({
  requestId,
  brokerId,
  value,
  selectedLabel,
  label,
  onChange,
}: {
  requestId: string;
  brokerId?: string;
  value: string;
  selectedLabel?: string;
  label: string;
  onChange: (option: Option) => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{
    key: string;
    rows: Option[];
    error?: string;
  }>();
  const key = JSON.stringify([requestId, brokerId, query]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: query });
      if (brokerId) params.set('brokerId', brokerId);
      void travelRequest<{ data: Option[] }>(
        `reservations/requests/${requestId}/document-choices?${params}`,
      )
        .then((r) => {
          if (active) setResult({ key, rows: r.data });
        })
        .catch((e) => {
          if (active)
            setResult({
              key,
              rows: [],
              error: e instanceof Error ? e.message : 'دریافت فهرست انجام نشد.',
            });
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [requestId, brokerId, query, key]);
  const current = result?.key === key ? result : undefined;
  return (
    <SearchCombobox
      label={label}
      value={value}
      selectedLabel={selectedLabel}
      remote
      options={(current?.rows ?? []).map((row) => ({
        value: row.id,
        label: row.name,
      }))}
      loading={!current}
      error={current?.error}
      onSearchChange={setQuery}
      onValueChange={(id) => {
        const option = current?.rows.find((row) => row.id === id);
        if (option) onChange(option);
      }}
      footer={
        brokerId && current && !current.rows.length && !current.error ? (
          <p className="p-2 text-sm text-muted-foreground">
            تورلیدری به این کارگزار متصل نیست؛ ارتباط را در اطلاعات پایه ثبت
            کنید.
          </p>
        ) : undefined
      }
    />
  );
}
export function documentSetupSettings(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
  voucher: boolean,
): VoucherSettingsV1 {
  const source = structuredClone(intake);
  const settings = voucher
    ? (intake.workflow.voucherSettings ??
      intake.workflow.sentSupplierFormSettings ??
      intake.workflow.supplierFormSettings)
    : intake.workflow.supplierFormSettings;
  delete source.workflow.voucherSettings;
  if (settings) source.workflow.voucherSettings = settings;
  return defaultVoucherSettings(source, refs);
}
function SetupForm({
  intake,
  refs,
  voucher,
  onSaved,
  onDirty,
}: {
  intake: ReservationFormIntake;
  refs: ReservationFormReferences;
  voucher: boolean;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
}) {
  const [draft, setDraft] = useState(() =>
    documentSetupSettings(intake, refs, voucher),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const change = (next: VoucherSettingsV1) => {
    setDraft(next);
    onDirty();
  };
  const brokerId = draft.references?.brokerId ?? '';
  async function save() {
    if (busy) return;
    if (!brokerId) {
      setError('کارگزار را انتخاب کنید.');
      return;
    }
    if (voucher && draft.flags.tourLeader && !draft.references?.leaderId) {
      setError('تورلیدر این کارگزار را انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await travelRequest<{ data: TravelWorkflowStateV1 }>(
        `reservations/requests/${intake.id}/workflow`,
        {
          action: voucher ? 'VOUCHER_SETTINGS' : 'PREPARE_SUPPLIER_FORM',
          expectedVersion: intake.workflow.version,
          note: voucher
            ? 'انتخاب تورلیدر کارگزار برای واچر'
            : 'تأیید کارگزار و خدمات فرم رزواسیون',
          voucherSettings: draft,
        },
      );
      onSaved(r.data);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="grid gap-4 rounded-xl border border-border bg-surface p-4"
      aria-label={voucher ? 'انتخاب تورلیدر واچر' : 'آماده‌سازی فرم رزرواسیون'}
    >
      <h3 className="font-semibold">
        {voucher ? 'تورلیدر کارگزار برای واچر' : 'انتخاب کارگزار و خدمات'}
      </h3>
      <fieldset disabled={busy} className="grid gap-4">
        {voucher && brokerId ? (
          <p>
            کارگزار: <strong>{draft.text.broker || 'انتخاب نشده'}</strong>
          </p>
        ) : (
          <ReferenceChoice
            requestId={intake.id}
            value={brokerId}
            selectedLabel={draft.text.broker}
            label="کارگزار فرم رزرواسیون"
            onChange={(option) =>
              change({
                ...draft,
                references: { brokerId: option.id },
                text: {
                  ...draft.text,
                  broker: option.name,
                  leaderName: '',
                  leaderPhone: '',
                  leaderLanguage: '',
                  transferBoard: '',
                },
              })
            }
          />
        )}
        {!voucher && (
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['hotel', 'هتل'],
                ['transfer', 'ترانسفر'],
                ['tourLeader', 'راهنما'],
                ['excursion', 'گشت'],
              ] as const
            ).map(([flag, label]) => (
              <label
                key={flag}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={draft.flags[flag]}
                  onChange={(e) =>
                    change({
                      ...draft,
                      flags: { ...draft.flags, [flag]: e.target.checked },
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        )}
        {!voucher &&
          draft.passengers
            .filter((p) => p.selected && p.age === 'CHD')
            .map((p) => (
              <label key={p.id}>
                رده کودک{' '}
                {
                  intake.snapshot.passengerAssignments?.find(
                    (a) => a.customerId === p.id,
                  )?.displayNameSnapshot
                }
                <select
                  className="mx-2 rounded border border-border bg-surface p-2"
                  value={p.hotelChildAgeBand ?? ''}
                  onChange={(e) =>
                    change({
                      ...draft,
                      passengers: draft.passengers.map((item) =>
                        item.id === p.id
                          ? {
                              ...item,
                              hotelChildAgeBand: e.target.value as
                                'CHD_2_TO_6' | 'CHD_6_TO_12' | '',
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <option value="">انتخاب رده</option>
                  <option value="CHD_2_TO_6">۲ تا ۶ سال</option>
                  <option value="CHD_6_TO_12">۶ تا ۱۲ سال</option>
                </select>
              </label>
            ))}
        {voucher && draft.flags.tourLeader && brokerId && (
          <ReferenceChoice
            requestId={intake.id}
            brokerId={brokerId}
            value={draft.references?.leaderId ?? ''}
            selectedLabel={draft.text.leaderName}
            label="تورلیدر همین کارگزار"
            onChange={(option) =>
              change({
                ...draft,
                references: { brokerId, leaderId: option.id },
                text: {
                  ...draft.text,
                  leaderName: option.name,
                  leaderPhone: '',
                  leaderLanguage: '',
                  transferBoard: '',
                },
              })
            }
          />
        )}
        {voucher && draft.flags.tourLeader && (
          <p className="text-sm text-muted-foreground">
            نام، شماره تماس و تابلوی استقبال هنگام ثبت، از اطلاعات پایه خوانده
            می‌شوند.
          </p>
        )}
        {voucher && intake.workflow.voucherSettings?.references?.leaderId && (
          <dl className="grid gap-2 rounded-lg bg-primary/5 p-3">
            <div>
              تورلیدر: {intake.workflow.voucherSettings.text.leaderName || '—'}
            </div>
            <div>
              شماره تماس:{' '}
              <bdi>
                {intake.workflow.voucherSettings.text.leaderPhone || '—'}
              </bdi>
            </div>
            <div>
              تابلوی استقبال:{' '}
              {intake.workflow.voucherSettings.text.transferBoard || '—'}
            </div>
          </dl>
        )}
        <Button disabled={busy || !brokerId} onClick={() => void save()}>
          {busy
            ? 'در حال ثبت…'
            : voucher
              ? 'ثبت تورلیدر برای واچر'
              : 'تأیید و آماده‌سازی فرم رزرواسیون'}
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
export function ReservationDocumentSetup(props: {
  intake: ReservationFormIntake;
  voucher?: boolean;
  onSaved: (state: TravelWorkflowStateV1) => void;
  onDirty: () => void;
}) {
  const refs = useReservationFormReferences(props.intake, true);
  return refs.ready ? (
    <SetupForm
      {...props}
      refs={refs.references}
      voucher={props.voucher === true}
    />
  ) : (
    <p role="status">در حال دریافت اطلاعات فرم…</p>
  );
}
