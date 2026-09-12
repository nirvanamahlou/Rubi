'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

function todayInTehran() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function ManifestExport() {
  const today = todayInTehran();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [includePreviouslyExported, setIncludePreviouslyExported] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function download() {
    if (!fromDate || !toDate || busy) return;
    const base = getPublicApiBaseUrl();
    if (!base) {
      setError('نشانی سرور تنظیم نشده است.');
      return;
    }
    if (fromDate > toDate) {
      setError('تاریخ شروع باید قبل از تاریخ پایان باشد.');
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    const send = () =>
      fetch(`${base}/reservations/manifests/iran-airtour-antalya.xlsx`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          fromDate,
          toDate,
          includePreviouslyExported,
        }),
      });
    setBusy(true);
    setError('');
    setResult('');
    try {
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.message === 'string'
            ? payload.message
            : typeof payload?.error?.message === 'string'
              ? payload.error.message
              : 'MANIFEST آماده نشد.',
        );
      }
      const contracts =
        response.headers.get('X-Rubi-Manifest-Contracts') ?? '—';
      const passengers =
        response.headers.get('X-Rubi-Manifest-Passengers') ?? '—';
      const skipped =
        response.headers.get('X-Rubi-Manifest-Skipped-Finance') ?? '0';
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `iran-airtour-antalya-${fromDate}-${toDate}-${includePreviouslyExported ? 'all' : 'new'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setResult(
        `${contracts} قرارداد و ${passengers} مسافر در فایل قرار گرفت${skipped === '0' ? '.' : `؛ ${skipped} قرارداد در انتظار تأیید مالی کنار گذاشته شد.`}`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'MANIFEST آماده نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 rounded-xl border border-border p-4">
      <div>
        <strong>MANIFEST ایران ایرتور برای پروازهای آنتالیا</strong>
        <p className="mt-1 text-sm text-muted-foreground">
          بازه براساس تاریخ پرواز رفت و با ساعت تهران محاسبه می‌شود. فقط
          قراردادهای دارای تأیید تحویل مدارک مالی وارد فایل می‌شوند.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          از تاریخ رفت
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          تا تاریخ رفت
          <DatePicker
            value={toDate}
            onChange={setToDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
      </div>
      <fieldset className="grid gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-semibold">محتوای خروجی</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="manifest-scope"
            checked={!includePreviouslyExported}
            onChange={() => setIncludePreviouslyExported(false)}
          />
          <span>
            فقط قراردادهای جدید
            <small className="block text-muted-foreground">
              قراردادهایی که در خروجی‌های قبلی این قالب نبوده‌اند
            </small>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name="manifest-scope"
            checked={includePreviouslyExported}
            onChange={() => setIncludePreviouslyExported(true)}
          />
          <span>
            همه قراردادهای بازه
            <small className="block text-muted-foreground">
              قراردادهای قبلی و تازه را با هم در یک فایل قرار می‌دهد
            </small>
          </span>
        </label>
      </fieldset>
      <Button
        disabled={!fromDate || !toDate || busy}
        onClick={() => void download()}
      >
        {busy ? 'در حال ساخت MANIFEST…' : 'دریافت MANIFEST بازه'}
      </Button>
      {result && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {result}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
