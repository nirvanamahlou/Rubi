'use client';
import { useEffect, useState } from 'react';
import type { WorkbenchMissionV1 } from '@nora/contracts';
import { Button, Input } from '@/components/ui';
import { DatePicker } from '@/components/ui/date-picker';
import { hrRequest } from '@/modules/hr/hr-api';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { localizedFetch } from '@/i18n/localized-fetch';

export const emptyMission = (): WorkbenchMissionV1 => ({
  destination: '',
  purpose: '',
  from: '',
  to: '',
  startTime: '',
  endTime: '',
});
const emptyFinance = () => ({
  amount: '0',
  referToPetty: false,
  title: '',
  costCenter: '',
  fee: '0',
  description: '',
  attachmentIds: [] as string[],
});
export function MissionFields({
  value,
  onChange,
  financial = false,
  disabled = false,
  branchId,
  onBusy,
}: {
  value: WorkbenchMissionV1;
  onChange: (v: WorkbenchMissionV1) => void;
  financial?: boolean;
  disabled?: boolean;
  branchId?: string;
  onBusy?: (value: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const finance = value.finance ?? emptyFinance();
  const update = (key: string, text: string) =>
    onChange({ ...value, [key]: text });
  const updateFinance = (key: string, v: string | boolean | string[]) =>
    onChange({ ...value, finance: { ...finance, [key]: v } });
  return (
    <fieldset
      disabled={disabled || uploading}
      className="grid gap-4 rounded-xl border p-4 sm:col-span-2 sm:grid-cols-2"
    >
      <legend>مأموریت</legend>
      {(['destination', 'purpose'] as const).map((key, i) => (
        <label className="grid gap-2 text-sm" key={key}>
          {['مقصد', 'هدف مأموریت'][i]}
          <Input
            required
            disabled={financial}
            value={value[key]}
            onChange={(e) => update(key, e.target.value)}
            maxLength={key === 'purpose' ? 500 : 200}
          />
        </label>
      ))}
      {(['from', 'to'] as const).map((key, i) => (
        <label className="grid gap-2 text-sm" key={key}>
          {['تاریخ رفت', 'تاریخ برگشت'][i]}
          <DatePicker
            disabled={financial}
            value={value[key]}
            onChange={(v) => update(key, v ?? '')}
          />
        </label>
      ))}
      {(['startTime', 'endTime'] as const).map((key, i) => (
        <label className="grid gap-2 text-sm" key={key}>
          {['ساعت رفت', 'ساعت برگشت'][i]}
          <Input
            required
            type="time"
            disabled={financial}
            value={value[key]}
            onChange={(e) => update(key, e.target.value)}
          />
        </label>
      ))}
      <fieldset
        disabled={!financial}
        className="grid gap-4 sm:col-span-2 sm:grid-cols-2"
      >
        <legend>اطلاعات هزینه</legend>
        {(['amount', 'title', 'costCenter', 'fee', 'description'] as const).map(
          (key, i) => (
            <label className="grid gap-2 text-sm" key={key}>
              {
                [
                  'هزینه (ریال)',
                  'عنوان هزینه',
                  'مرکز هزینه',
                  'کارمزد (ریال)',
                  'شرح',
                ][i]
              }
              <Input
                type={key === 'amount' || key === 'fee' ? 'number' : 'text'}
                min="0"
                step="1"
                value={finance[key]}
                onChange={(e) => updateFinance(key, e.target.value)}
              />
            </label>
          ),
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={finance.referToPetty}
            onChange={(e) => updateFinance('referToPetty', e.target.checked)}
          />
          ارجاع به تنخواه
        </label>
        <label className="grid gap-2 text-sm sm:col-span-2">
          فیش و مدارک
          <Input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            disabled={
              uploading || !branchId || finance.attachmentIds.length >= 5
            }
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !branchId) return;
              setUploading(true);
              onBusy?.(true);
              setError('');
              try {
                const form = new FormData();
                form.set('file', file);
                form.set('branchId', branchId);
                const doc = await hrRequest<{ id: string; name: string }>(
                  '/mission-evidence',
                  { method: 'POST', body: form },
                );
                updateFinance('attachmentIds', [
                  ...finance.attachmentIds,
                  doc.id,
                ]);
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'بارگذاری انجام نشد.',
                );
              } finally {
                setUploading(false);
                onBusy?.(false);
              }
            }}
          />
          <span>
            {finance.attachmentIds.length.toLocaleString('fa-IR')} مدرک
            بارگذاری‌شده
          </span>
        </label>
      </fieldset>
      {!financial && (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          ثبت هزینه پس از پایان مأموریت فعال می‌شود.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {uploading && <p role="status">در حال بارگذاری…</p>}
    </fieldset>
  );
}
export function MissionDetails({
  mission,
  id,
}: {
  mission: WorkbenchMissionV1;
  id: string;
}) {
  const [documents, setDocuments] = useState<{ url: string; type: string }[]>(
    [],
  );
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      documents.forEach((doc) => URL.revokeObjectURL(doc.url));
    },
    [documents],
  );
  return (
    <section className="space-y-4 rounded-2xl border bg-muted/20 p-4">
      <h3 className="font-bold">مشخصات مأموریت</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {Object.entries({
          مقصد: mission.destination,
          هدف: mission.purpose,
          رفت:
            new Date(mission.from + 'T12:00:00+03:30').toLocaleDateString(
              'fa-IR',
            ) +
            ' ' +
            mission.startTime,
          برگشت:
            new Date(mission.to + 'T12:00:00+03:30').toLocaleDateString(
              'fa-IR',
            ) +
            ' ' +
            mission.endTime,
          ...(mission.finance
            ? {
                'هزینه (ریال)': mission.finance.amount,
                'عنوان هزینه': mission.finance.title,
                'مرکز هزینه': mission.finance.costCenter,
                کارمزد: mission.finance.fee,
                شرح: mission.finance.description,
                'ارجاع به تنخواه': mission.finance.referToPetty ? 'بله' : 'خیر',
              }
            : {}),
        }).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-background p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words">
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
      {!!mission.finance?.attachmentIds.length && (
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              const docs = await Promise.all(
                mission.finance!.attachmentIds.map(async (doc) => {
                  const response = await localizedFetch(
                    getPublicApiBaseUrl() +
                      '/customer-affairs/workbench/requests/' +
                      encodeURIComponent(id) +
                      '/mission-evidence/' +
                      encodeURIComponent(doc),
                    { credentials: 'include', cache: 'no-store' },
                  );
                  if (!response.ok) throw new Error('دریافت مدرک انجام نشد.');
                  const blob = await response.blob();
                  return { url: URL.createObjectURL(blob), type: blob.type };
                }),
              );
              setDocuments(docs);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'خطا');
            }
          }}
        >
          نمایش فیش و مدارک
        </Button>
      )}
      {documents.map((doc, i) =>
        doc.type.startsWith('image/') ? (
          <img
            key={i}
            src={doc.url}
            alt={'مدرک مأموریت ' + (i + 1)}
            className="max-h-96 w-full rounded-xl object-contain"
          />
        ) : (
          <iframe
            key={i}
            src={doc.url}
            title={'مدرک مأموریت ' + (i + 1)}
            className="h-96 w-full"
          />
        ),
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function MissionFinanceEditor({
  mission,
  id,
  version,
  branchId,
  onSaved,
}: {
  mission: WorkbenchMissionV1;
  id: string;
  version: number;
  branchId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(mission),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (
    mission.finance ||
    Date.now() <= Date.parse(mission.to + 'T' + mission.endTime + ':00+03:30')
  )
    return null;
  return (
    <section className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => setEditing(!editing)}
      >
        ویرایش اطلاعات مالی مأموریت
      </Button>
      {editing && (
        <>
          <MissionFields
            value={value}
            onChange={setValue}
            financial
            onBusy={setBusy}
            branchId={branchId}
            disabled={busy}
          />
          <Button
            disabled={busy || !value.finance}
            onClick={async () => {
              setBusy(true);
              try {
                await customerAffairsApi.updateMissionFinance(
                  id,
                  version,
                  value.finance!,
                );
                onSaved();
                setEditing(false);
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'ذخیره انجام نشد.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            ثبت هزینه و ارسال به منابع انسانی
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
