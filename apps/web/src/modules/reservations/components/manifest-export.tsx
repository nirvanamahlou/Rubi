'use client';

import { useEffect, useRef, useState } from 'react';
import { requestManifestDownload } from './manifest-download';
import type {
  MasterDataRecord,
  ReservationManifestTicketCardV1,
  ReservationManifestTicketListV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  filterManifestTickets,
  manifestDisplayDirection,
  type ManifestTicketRouteFilters,
} from '../model/manifest-ticket-filters';
import { ManifestReferenceFilter } from './manifest-reference-filter';

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

export function manifestDateTime(value: string, timeKnown = true) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeKnown ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(new Date(value));
}

export function ManifestRoute({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <span
      dir="ltr"
      className="inline-flex items-center gap-1 whitespace-nowrap"
    >
      <span dir="auto">{origin}</span>
      <span aria-hidden="true">→</span>
      <span dir="auto">{destination}</span>
    </span>
  );
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
  const [originCountry, setOriginCountry] = useState<MasterDataRecord>();
  const [destinationCountry, setDestinationCountry] =
    useState<MasterDataRecord>();
  const [originFilter, setOriginFilter] = useState<MasterDataRecord>();
  const [destinationFilter, setDestinationFilter] =
    useState<MasterDataRecord>();
  const [loaded, setLoaded] = useState(false);
  const [searchedDates, setSearchedDates] = useState({
    fromDate: today,
    toDate: today,
  });
  const [searchRoute, setSearchRoute] = useState<ManifestTicketRouteFilters>({
    originName: '',
    destinationName: '',
  });
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
      setSearchedDates({ fromDate, toDate });
      setSearchRoute({
        ...(originCountry ? { originCountryId: originCountry.id } : {}),
        ...(destinationCountry
          ? { destinationCountryId: destinationCountry.id }
          : {}),
        ...(originFilter ? { originId: originFilter.id } : {}),
        ...(destinationFilter ? { destinationId: destinationFilter.id } : {}),
      });
      setLoaded(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'بلیط‌ها دریافت نشدند.',
      );
    } finally {
      setBusy('');
    }
  }

  const visibleTickets = filterManifestTickets(tickets, searchRoute);
  const ticketsByDirection = {
    OUTBOUND: visibleTickets.filter(
      (ticket) => manifestDisplayDirection(ticket, searchRoute) === 'OUTBOUND',
    ),
    RETURN: visibleTickets.filter(
      (ticket) => manifestDisplayDirection(ticket, searchRoute) === 'RETURN',
    ),
  };

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
      const { file, contracts, passengers, retriedWithAll } =
        await requestManifestDownload(
          {
            offerId: ticket.offerId,
            ...searchedDates,
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
        searchedDates.fromDate +
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
          (retriedWithAll ? '؛ خروجی قبلی نیز بازیابی شد.' : '.'),
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          از تاریخ حرکت
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            calendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          تا تاریخ حرکت
          <DatePicker
            value={toDate}
            onChange={setToDate}
            calendarSystem="gregorian"
            gregorianEnglish
          />
        </label>
      </div>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="فیلتر مسیر"
      >
        <ManifestReferenceFilter
          id="manifest-origin-country"
          label="کشور مبدأ"
          resource="countries"
          value={originCountry}
          onSelect={(country) => {
            setOriginCountry(country);
            setOriginFilter(undefined);
          }}
        />
        <ManifestReferenceFilter
          id="manifest-origin-city"
          label="شهر مبدأ"
          resource="cities"
          value={originFilter}
          countryId={originCountry?.id}
          onSelect={setOriginFilter}
        />
        <ManifestReferenceFilter
          id="manifest-destination-country"
          label="کشور مقصد"
          resource="countries"
          value={destinationCountry}
          onSelect={(country) => {
            setDestinationCountry(country);
            setDestinationFilter(undefined);
          }}
        />
        <ManifestReferenceFilter
          id="manifest-destination-city"
          label="شهر مقصد"
          resource="cities"
          value={destinationFilter}
          countryId={destinationCountry?.id}
          onSelect={setDestinationFilter}
        />
      </div>
      <Button
        type="button"
        disabled={!fromDate || !toDate || Boolean(busy)}
        onClick={() => void loadTickets()}
      >
        {busy === 'list' ? 'در حال دریافت بلیط‌ها…' : 'جست‌وجوی بلیط‌ها'}
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
          {(['OUTBOUND', 'RETURN'] as const).map((direction) => (
            <section
              key={direction}
              className="overflow-hidden rounded-xl border border-border"
            >
              <h3 className="border-b bg-muted/40 p-3 font-bold">
                {direction === 'OUTBOUND'
                  ? 'لود و منیفست رفت'
                  : 'لود و منیفست برگشت'}
              </h3>
              <div className="overflow-auto">
                <table className="w-full min-w-[1050px] border-collapse text-center text-sm [&_th]:border [&_th]:p-3 [&_td]:border [&_td]:p-3">
                  <thead className="bg-muted/30">
                    <tr>
                      {[
                        'مسیر',
                        'ایرلاین / شماره',
                        'حرکت',
                        'رسیدن',
                        'ظرفیت',
                        'فروخته',
                        'رزرو موقت',
                        'مانده',
                        'قرارداد / مسافر',
                        'قالب خروجی',
                        'خروجی',
                      ].map((label) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsByDirection[direction].map((ticket) => (
                      <tr key={ticket.offerId}>
                        <td>
                          <ManifestRoute
                            origin={ticket.originName}
                            destination={ticket.destinationName}
                          />
                        </td>
                        <td>
                          {ticket.carrierName}
                          <br />
                          {ticket.serviceNumber}
                        </td>
                        <td>
                          {manifestDateTime(
                            ticket.departureAt,
                            ticket.departureTimeKnown !== false,
                          )}
                        </td>
                        <td>
                          {ticket.arrivalAt === ticket.departureAt &&
                          ticket.transportType !== 'FLIGHT'
                            ? 'ثبت نشده'
                            : manifestDateTime(ticket.arrivalAt)}
                        </td>
                        <td>{ticket.totalCapacity ?? '—'}</td>
                        <td>{ticket.allocatedCapacity ?? '—'}</td>
                        <td>{ticket.reservedCapacity ?? '—'}</td>
                        <td>{ticket.remainingCapacity ?? '—'}</td>
                        <td>
                          {ticket.contractCount} قرارداد ·{' '}
                          {ticket.passengerCount} مسافر
                        </td>
                        <td>
                          {ticket.template
                            ? ticket.template.name +
                              ' · نسخه ' +
                              ticket.template.versionNumber
                            : ticket.unavailableReason}
                        </td>
                        <td>
                          <Button
                            type="button"
                            disabled={!ticket.template || Boolean(busy)}
                            onClick={() => void download(ticket)}
                          >
                            {busy === ticket.offerId
                              ? 'در حال ساخت…'
                              : direction === 'OUTBOUND'
                                ? 'خروجی رفت'
                                : 'خروجی برگشت'}
                          </Button>
                          {error && errorOfferId === ticket.offerId && (
                            <p role="alert" className="text-destructive">
                              {error}
                            </p>
                          )}
                          {downloadLink?.offerId === ticket.offerId && (
                            <a
                              className="block text-primary underline"
                              href={downloadLink.url}
                              download={downloadLink.fileName}
                            >
                              دریافت فایل منیفست
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ticketsByDirection[direction].length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  بلیطی برای این مسیر و بازه پیدا نشد.
                </p>
              )}
            </section>
          ))}
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
