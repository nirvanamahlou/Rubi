'use client';

import { useState } from 'react';
import type {
  ReservationManifestTicketCardV1,
  ReservationManifestTicketListV1,
} from '@nora/contracts';
import { ArrowLeft, Plane } from 'lucide-react';
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
  return part('year') + '-' + part('month') + '-' + part('day');
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function authenticatedFetch(
  base: string,
  input: string,
  init?: RequestInit,
) {
  let response = await fetch(base + input, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await fetch(base + input, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });
  return response;
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.message === 'string'
    ? payload.message
    : typeof payload?.error?.message === 'string'
      ? payload.error.message
      : fallback;
}

export function ManifestExport() {
  const today = todayInTehran();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [includePreviouslyExported, setIncludePreviouslyExported] =
    useState(false);
  const [tickets, setTickets] = useState<
    readonly ReservationManifestTicketCardV1[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  function validate() {
    if (!fromDate || !toDate) return 'بازه تاریخ را کامل کنید.';
    if (fromDate > toDate) return 'تاریخ شروع باید قبل از تاریخ پایان باشد.';
    return '';
  }

  async function loadTickets() {
    const validation = validate();
    const base = getPublicApiBaseUrl();
    if (validation || !base) {
      setError(validation || 'نشانی سرور تنظیم نشده است.');
      return;
    }
    setBusy('list');
    setError('');
    setResult('');
    try {
      const query = new URLSearchParams({ fromDate, toDate });
      const response = await authenticatedFetch(
        base,
        '/reservations/manifests/tickets?' + query.toString(),
      );
      if (!response.ok)
        throw new Error(await responseError(response, 'بلیط‌ها دریافت نشدند.'));
      const payload =
        (await response.json()) as ReservationManifestTicketListV1;
      setTickets(payload.data);
      setLoaded(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'بلیط‌ها دریافت نشدند.',
      );
    } finally {
      setBusy('');
    }
  }

  async function download(ticket: ReservationManifestTicketCardV1) {
    if (!ticket.template || busy) return;
    const base = getPublicApiBaseUrl();
    if (!base) {
      setError('نشانی سرور تنظیم نشده است.');
      return;
    }
    setBusy(ticket.offerId);
    setError('');
    setResult('');
    try {
      const response = await authenticatedFetch(
        base,
        '/reservations/manifests/tickets/' +
          encodeURIComponent(ticket.offerId) +
          '.xlsx',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({ fromDate, toDate, includePreviouslyExported }),
        },
      );
      if (!response.ok)
        throw new Error(await responseError(response, 'MANIFEST آماده نشد.'));
      const contracts =
        response.headers.get('X-Nora-Manifest-Contracts') ?? '—';
      const passengers =
        response.headers.get('X-Nora-Manifest-Passengers') ?? '—';
      const skipped =
        response.headers.get('X-Nora-Manifest-Skipped-Finance') ?? '0';
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download =
        'manifest-' +
        ticket.serviceNumber.replace(/[^A-Za-z0-9_-]/g, '_') +
        '-' +
        fromDate +
        '.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setResult(
        contracts +
          ' قرارداد و ' +
          passengers +
          ' مسافر در قالب «' +
          ticket.template.name +
          '» قرار گرفت' +
          (skipped === '0'
            ? '.'
            : '؛ ' + skipped + ' قرارداد در انتظار تأیید مالی کنار گذاشته شد.'),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'MANIFEST آماده نشد.',
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="grid gap-5 rounded-xl border border-border p-4">
      <div>
        <strong>MANIFEST بلیط‌ها</strong>
        <p className="mt-1 text-sm text-muted-foreground">
          بازه را انتخاب کنید، سپس روی بلیط موردنظر بزنید. خروجی با قالب فعال
          همان ایرلاین و مقصد ساخته می‌شود.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          از تاریخ پرواز
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          تا تاریخ پرواز
          <DatePicker
            value={toDate}
            onChange={setToDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
      </div>
      <Button
        disabled={!fromDate || !toDate || Boolean(busy)}
        onClick={() => void loadTickets()}
      >
        {busy === 'list' ? 'در حال دریافت بلیط‌ها…' : 'نمایش بلیط‌های بازه'}
      </Button>

      {loaded && tickets.length === 0 && (
        <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
          در این بازه بلیطی در قراردادهای رزواسیون پیدا نشد.
        </p>
      )}

      {tickets.length > 0 && (
        <>
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
                  قراردادهایی که هنوز در خروجی قبلی نبوده‌اند
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
                همه قراردادهای این بلیط
                <small className="block text-muted-foreground">
                  قراردادهای قبلی و تازه با هم وارد فایل می‌شوند
                </small>
              </span>
            </label>
          </fieldset>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tickets.map((ticket) => (
              <article
                key={ticket.offerId}
                className="overflow-hidden rounded-xl border border-s-4 border-s-cyan-500 bg-card shadow-sm"
              >
                <header className="flex items-start justify-between gap-3 border-b bg-muted/35 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-cyan-100 p-2 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                      <Plane className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {ticket.carrierName}
                      </h3>
                      <p
                        dir="ltr"
                        className="text-sm font-semibold text-muted-foreground"
                      >
                        {ticket.serviceNumber}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {ticket.direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}
                  </span>
                </header>
                <div className="grid gap-4 p-4">
                  <div
                    className="flex items-center justify-between gap-3"
                    dir="ltr"
                  >
                    <strong>{ticket.originName}</strong>
                    <ArrowLeft className="size-4 text-muted-foreground" />
                    <strong>{ticket.destinationName}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <span className="block text-xs text-muted-foreground">
                        حرکت
                      </span>
                      {dateTime(ticket.departureAt)}
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <span className="block text-xs text-muted-foreground">
                        رسیدن
                      </span>
                      {dateTime(ticket.arrivalAt)}
                    </div>
                  </div>
                  <p className="text-sm">
                    {ticket.contractCount} قرارداد · {ticket.passengerCount}{' '}
                    مسافر
                  </p>
                  {ticket.template ? (
                    <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      قالب فعال: {ticket.template.name} · نسخه{' '}
                      {ticket.template.versionNumber}
                    </p>
                  ) : (
                    <p
                      role="status"
                      className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive"
                    >
                      {ticket.unavailableReason}
                    </p>
                  )}
                  <Button
                    disabled={!ticket.template || Boolean(busy)}
                    onClick={() => void download(ticket)}
                  >
                    {busy === ticket.offerId
                      ? 'در حال ساخت…'
                      : ticket.template
                        ? 'دانلود MANIFEST این بلیط'
                        : 'خروجی ممکن نیست'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
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
