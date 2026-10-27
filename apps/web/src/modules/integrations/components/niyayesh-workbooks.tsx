'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Alert, Card } from '@/components/ui/surfaces';
import { integrationsApi } from '../api/client';
import { ExternalFields } from './niyayesh-data';

const workflows: Record<string, { title: string; help: string }> = {
  hotels: {
    title: 'ورود اطلاعات هتل‌ها با Excel',
    help: 'مشخصات، امکانات، قوانین، تصاویر و گالری مطابق قالب سایت ثبت می‌شوند. شناسه خارجی ثابت، همان هتل را در بارگذاری بعدی به‌روز می‌کند.',
  },
  'tour-prices': {
    title: 'ورود تاریخ و قیمت یک تور با Excel',
    help: 'ابتدا تور را از اطلاعات خود سایت انتخاب کنید. تاریخ شمسی یا میلادی، هتل و قیمت طبق قالب نیایش خوانده می‌شود؛ وضعیت حرکت و ظرفیت با فایل قیمت تغییر نمی‌کند. ترکیب هتل‌ها از تنظیمات همان تور خوانده می‌شود.',
  },
  tickets: {
    title: 'ثبت و به‌روزرسانی بلیت‌ها با Excel',
    help: 'هر ردیف یک بلیت مستقل یک‌طرفه است. شناسه خارجی را ثابت نگه دارید. رفت و برگشت دو بلیت مستقل‌اند؛ بلیت دستی یا بلیت غایب از فایل حذف یا غیرفعال نمی‌شود.',
  },
};

export function NiyayeshWorkbooks({
  branchId,
  available,
  onApplied,
}: {
  branchId: string;
  available: { kind: string; canApply: boolean }[];
  onApplied: () => void;
}) {
  return (
    <div className="grid gap-5">
      {available.map((w) => (
        <Workbook
          key={`${branchId}:${w.kind}`}
          branchId={branchId}
          kind={w.kind}
          canApply={w.canApply}
          onApplied={onApplied}
        />
      ))}
    </div>
  );
}

function Workbook({
  branchId,
  kind,
  canApply,
  onApplied,
}: {
  branchId: string;
  kind: string;
  canApply: boolean;
  onApplied: () => void;
}) {
  const info = workflows[kind];
  const [file, setFile] = useState<File | null>(null);
  const [tourId, setTourId] = useState('');
  const [city, setCity] = useState('');
  const [tours, setTours] = useState<{ id: string; title: string }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof integrationsApi.niyayeshWorkbook>
  > | null>(null);
  const [command, setCommand] = useState('');
  useEffect(() => {
    if (kind !== 'tour-prices') return;
    const control = new AbortController();
    void integrationsApi
      .niyayeshResources(branchId, 'tours', cursor, control.signal)
      .then((page) => {
        setTours((old) => [
          ...(cursor ? old : []),
          ...page.items
            .filter((i) => !i.archived)
            .map((i) => ({
              id: i.externalId,
              title: String(i.data?.title ?? i.externalId),
            })),
        ]);
        setMore(page.hasMore);
      })
      .catch((e) => {
        if (!control.signal.aborted)
          setError(e instanceof Error ? e.message : 'دریافت تور انجام نشد.');
      });
    return () => control.abort();
  }, [branchId, kind, cursor]);
  if (!info) return null;
  function reset() {
    setResult(null);
    setCommand('');
    setError('');
  }
  async function run(apply: boolean) {
    if (!file) return;
    setBusy(true);
    setError('');
    const key = apply ? command : crypto.randomUUID();
    try {
      const data = await integrationsApi.niyayeshWorkbook(
        branchId,
        kind,
        file,
        key,
        apply,
        tourId || undefined,
        apply ? (result?.proof ?? undefined) : undefined,
      );
      setResult(data);
      if (!apply) setCommand(crypto.randomUUID());
      if (data.result.applied) onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function download(exportCity = false) {
    setBusy(true);
    setError('');
    try {
      const data = exportCity
        ? await integrationsApi.niyayeshHotelExport(branchId, city)
        : await integrationsApi.niyayeshTemplate(branchId, kind);
      const blob = new Blob(
        [Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0))],
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دانلود انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-4 p-5">
      <h3 className="text-lg font-bold">{info.title}</h3>
      <p className="text-sm leading-7 text-muted-foreground">{info.help}</p>
      <div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void download()}
        >
          دانلود قالب استاندارد سایت
        </Button>
      </div>
      {kind === 'hotels' ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-4">
          <label className="grid gap-2 text-sm">
            شهر هتل برای خروجی Excel
            <input
              className="rounded-lg border border-border bg-surface p-2"
              value={city}
              disabled={busy}
              onChange={(e) => setCity(e.target.value)}
              maxLength={120}
            />
          </label>
          <Button
            variant="outline"
            disabled={busy || !city.trim()}
            onClick={() => void download(true)}
          >
            دانلود اطلاعات هتل‌های شهر
          </Button>
        </div>
      ) : null}
      {kind === 'tour-prices' ? (
        <label className="grid gap-2 text-sm">
          تور سایت
          <NativeSearchSelect
            value={tourId}
            disabled={busy}
            onChange={(e) => {
              setTourId(e.target.value);
              reset();
            }}
          >
            <option value="">انتخاب تور</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.id}
              </option>
            ))}
          </NativeSearchSelect>
          {more ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCursor(Number(tours.at(-1)?.id ?? 0))}
            >
              دریافت تورهای بیشتر
            </Button>
          ) : null}
        </label>
      ) : null}
      <label className="grid gap-2 text-sm">
        فایل Excel (حداکثر ۴ مگابایت)
        <input
          className="rounded-xl border border-border bg-surface p-3"
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            reset();
            if (next && next.size > 4 * 1024 * 1024) {
              setFile(null);
              setError('حداکثر اندازه فایل ۴ مگابایت است.');
            } else setFile(next);
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        ثبت روی سایت انتخاب‌شده انجام می‌شود. رکوردهای غایب از فایل حذف
        نمی‌شوند. تغییر سایت یا فایل پس از پیش‌نمایش، بررسی دوباره می‌خواهد.
      </p>
      {error ? (
        <Alert tone="error" title="عملیات کامل نشد" description={error} />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy || !file || (kind === 'tour-prices' && !tourId)}
          onClick={() => void run(false)}
        >
          پیش‌نمایش و اعتبارسنجی فایل
        </Button>
        <Button
          disabled={
            busy ||
            !canApply ||
            !result?.proof ||
            !result.result.valid ||
            result.result.applied
          }
          onClick={() => void run(true)}
        >
          {busy ? 'در حال بررسی…' : 'تأیید و ثبت در سایت نیایش'}
        </Button>
      </div>
      {!canApply ? (
        <p className="text-sm text-muted-foreground">
          مجوز ثبت این فایل در سایت فعال نیست؛ فقط پیش‌نمایش مجاز است.
        </p>
      ) : null}
      {result ? (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 font-bold">
            {result.result.applied
              ? 'ثبت روی سایت انجام شد'
              : result.result.valid
                ? 'پیش‌نمایش معتبر است؛ هنوز ثبت نشده'
                : 'فایل نیاز به اصلاح دارد'}
          </p>
          <ExternalFields value={result.result} />
        </div>
      ) : null}
    </Card>
  );
}
