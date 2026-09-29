'use client';

import { useEffect, useRef, useState } from 'react';
import { requestManifestDownload } from './manifest-download';
import type {
  ReservationManifestTicketCardV1,
  ReservationManifestTicketListV1,
} from '@nora/contracts';
import { ArrowLeft, Plane, Bus, TrainFront } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { filterManifestTickets } from '../model/manifest-ticket-filters';

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

function dateTime(value: string, timeKnown = true) {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeKnown ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
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
  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const downloadKeys = useRef(new Map<string, string>());
  const downloading = useRef(false);
  const [errorOfferId, setErrorOfferId] = useState('');
  const [downloadLink, setDownloadLink] = useState<{
    offerId: string;
    url: string;
    fileName: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (downloadLink) URL.revokeObjectURL(downloadLink.url);
    },
    [downloadLink],
  );

  function validate() {
    if (!fromDate || !toDate) return 'بازه تاریخ را کامل کنید.';
    if (fromDate > toDate) return 'تاریخ شروع باید قبل از تاریخ پایان باشد.';
    return '';
  }

  async function loadTickets() {
    setErrorOfferId('');
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
      setOriginFilter('');
      setDestinationFilter('');
      setLoaded(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'بلیط‌ها دریافت نشدند.',
      );
    } finally {
      setBusy('');
    }
  }

  const visibleTickets = filterManifestTickets(tickets, {
    originName: originFilter,
    destinationName: destinationFilter,
  });
  const origins = Array.from(
    new Set(tickets.map((ticket) => ticket.originName)),
  )
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'fa'));
  const destinations = Array.from(
    new Set(tickets.map((ticket) => ticket.destinationName)),
  )
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'fa'));

  async function download(ticket: ReservationManifestTicketCardV1) {
    if (!ticket.template || busy || downloading.current) return;
    setErrorOfferId(ticket.offerId);
    const base = getPublicApiBaseUrl();
    if (!base) {
      setError('نشانی سرور تنظیم نشده است.');
      return;
    }
    downloading.current = true;
    setErrorOfferId(ticket.offerId);
    setBusy(ticket.offerId);
    setError('');
    setResult('');
    try {
      const { file, contracts, passengers, skippedFinance, retriedWithAll } =
        await requestManifestDownload(
          {
            offerId: ticket.offerId,
            fromDate,
            toDate,
            includePreviouslyExported,
          },
          (path, init) => authenticatedFetch(base, path, init),
          downloadKeys.current,
        );
      const fileName =
        'manifest-' +
        (ticket.serviceNumber || ticket.transportType || 'FLIGHT').replace(
          /[^A-Za-z0-9_-]/g,
          '_',
        ) +
        '-' +
        fromDate +
        '.xlsx';
      const url = URL.createObjectURL(file);
      setDownloadLink({ offerId: ticket.offerId, url, fileName });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setResult(
        contracts +
          ' قرارداد و ' +
          passengers +
          ' مسافر در قالب «' +
          ticket.template.name +
          '» آماده شد' +
          (retriedWithAll ? '؛ خروجی قبلی نیز بازیابی شد.' : '.') +
          (Number(skippedFinance) > 0
            ? ' قراردادهای بدون تأیید مالی از فایل حذف شدند.'
            : ''),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'MANIFEST آماده نشد.',
      );
    } finally {
      downloading.current = false;
      setBusy('');
    }
  }

  return (
    <div className="grid gap-4 rounded-xl border border-border p-4">
      <div>
        <strong>MANIFEST بلیط‌ها</strong>
        <p className="mt-1 text-sm text-muted-foreground">
          بازه را انتخاب کنید، سپس روی بلیط هوایی، اتوبوس یا قطار موردنظر بزنید.
          خروجی با قالب انتخاب‌شدهٔ بلیط ساخته می‌شود؛ بلیط‌های بدون قالب از
          «پیش‌فرض» استفاده می‌کنند.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          از تاریخ حرکت
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          تا تاریخ حرکت
          <DatePicker
            value={toDate}
            onChange={setToDate}
            defaultCalendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
      </div>
      <Button
        type="button"
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
          <div className="grid gap-3 sm:grid-cols-2" aria-label="فیلتر مسیر">
            <label className="grid gap-2 text-sm font-medium">
              فیلتر مبدا
              <select
                aria-label="فیلتر مبدا"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value)}
              >
                <option value="">همه مبداها</option>
                {origins.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              فیلتر مقصد
              <select
                aria-label="فیلتر مقصد"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={destinationFilter}
                onChange={(event) => setDestinationFilter(event.target.value)}
              >
                <option value="">همه مقصدها</option>
                {destinations.map((destination) => (
                  <option key={destination} value={destination}>
                    {destination}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visibleTickets.length === 0 && (
            <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              بلیطی با این مبدا و مقصد پیدا نشد.
            </p>
          )}
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleTickets.map((ticket) => (
              <article
                key={ticket.offerId}
                className="overflow-hidden rounded-xl border border-s-4 border-s-cyan-500 bg-card shadow-sm"
              >
                <header className="flex items-start justify-between gap-2 border-b bg-muted/35 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-lg bg-cyan-100 p-1.5 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                      {ticket.transportType === 'BUS' ? (
                        <Bus className="size-4" />
                      ) : ticket.transportType === 'TRAIN' ? (
                        <TrainFront className="size-4" />
                      ) : (
                        <Plane className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">
                        {ticket.carrierName}
                      </h3>
                      <p
                        dir="ltr"
                        className="text-sm font-semibold text-muted-foreground"
                      >
                        {ticket.serviceNumber ||
                          (ticket.transportType === 'BUS'
                            ? 'اتوبوس'
                            : ticket.transportType === 'TRAIN'
                              ? 'قطار'
                              : '')}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {ticket.direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}
                  </span>
                </header>
                <div className="grid gap-2 p-3">
                  <div
                    className="flex items-center justify-between gap-3"
                    dir="ltr"
                  >
                    <strong>{ticket.originName}</strong>
                    <ArrowLeft className="size-4 text-muted-foreground" />
                    <strong>{ticket.destinationName}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <span className="block text-xs text-muted-foreground">
                        حرکت
                      </span>
                      {dateTime(
                        ticket.departureAt,
                        ticket.departureTimeKnown !== false,
                      )}
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                      <span className="block text-xs text-muted-foreground">
                        رسیدن
                      </span>
                      {ticket.transportType &&
                      ticket.transportType !== 'FLIGHT' &&
                      ticket.arrivalAt === ticket.departureAt
                        ? 'ثبت نشده'
                        : dateTime(ticket.arrivalAt)}
                    </div>
                  </div>
                  <p className="text-xs">
                    {ticket.contractCount} قرارداد با تأیید مالی ·{' '}
                    {ticket.passengerCount} مسافر
                  </p>
                  {ticket.template ? (
                    <p className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      قالب فعال: {ticket.template.name} · نسخه{' '}
                      {ticket.template.versionNumber}
                    </p>
                  ) : (
                    <p
                      role="status"
                      className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
                    >
                      {ticket.unavailableReason}
                    </p>
                  )}
                  <Button
                    type="button"
                    disabled={!ticket.template || Boolean(busy)}
                    onClick={() => void download(ticket)}
                  >
                    {busy === ticket.offerId
                      ? 'در حال ساخت…'
                      : ticket.template
                        ? 'دانلود MANIFEST این بلیط'
                        : 'خروجی ممکن نیست'}
                  </Button>
                  {error && errorOfferId === ticket.offerId && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  {downloadLink?.offerId === ticket.offerId && (
                    <a
                      href={downloadLink.url}
                      download={downloadLink.fileName}
                      className="text-sm font-semibold text-primary underline"
                    >
                      اگر دانلود خودکار شروع نشد، فایل منیفست را دریافت کنید
                    </a>
                  )}
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
      {error && !errorOfferId && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
