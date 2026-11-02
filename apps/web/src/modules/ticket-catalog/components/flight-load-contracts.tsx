'use client';
import { useEffect, useRef, useState } from 'react';
import type { FlightLoadContractsV1, TicketOfferV1 } from '@nora/contracts';
import { ticketCalendarDate } from '@nora/contracts';
import { Button } from '@/components/ui';
import {
  loadFlightContracts,
  downloadFlightContracts,
} from '../api/flight-load';
import styles from './flight-load-grid.module.css';

const statuses: Record<string, string> = {
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};
const cabins: Record<string, string> = {
  ECONOMY: 'اکونومی',
  BUSINESS: 'بیزینس',
  FIRST: 'فرست',
};

export function FlightLoadContractsTable({
  report,
  cityName,
}: {
  report: FlightLoadContractsV1;
  cityName: (id: string) => string;
}) {
  const t = report.totals;
  return (
    <>
      <div className={styles.totals} aria-label="جمع قراردادهای پرواز">
        <strong>تعداد قرارداد: {t.contracts}</strong>
        <span>تعداد مسافر: {t.passengers}</span>
        <span>بزرگسال: {t.adults}</span>
        <span>کودک ۲ تا ۶: {t.children2To6}</span>
        <span>کودک ۶ تا ۱۲: {t.children6To12}</span>
        <span>کودک با سن نامشخص: {t.childrenUnknownAge}</span>
        <span>نوزاد: {t.infants}</span>
        <span>تعداد صندلی: {t.seats}</span>
      </div>
      <div className={styles.contractScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                'قرارداد',
                'مشتری',
                'وضعیت',
                'جهت',
                'مسیر',
                'تاریخ رفت',
                'تاریخ برگشت',
                'ایرلاین',
                'شماره پرواز',
                'کلاس',
                'بزرگسال',
                'کودک ۲ تا ۶',
                'کودک ۶ تا ۱۲',
                'کودک با سن نامشخص',
                'نوزاد',
                'تعداد مسافر',
                'تعداد صندلی',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.data.map((r) => (
              <tr key={r.id}>
                <td>
                  <a
                    href={`/sales/contracts/${encodeURIComponent(r.id)}/pdf`}
                    title="دانلود قرارداد"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {r.contractNumber}
                  </a>
                </td>
                <td>{r.customerName}</td>
                <td>{statuses[r.status] ?? r.status}</td>
                <td>{r.direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}</td>
                <td>
                  {r.originName || cityName(r.originId)} ←{' '}
                  {r.destinationName || cityName(r.destinationId)}
                </td>
                <td dir="ltr">
                  {r.outboundAt ? ticketCalendarDate(r.outboundAt) : '—'}
                </td>
                <td dir="ltr">
                  {r.returnAt ? ticketCalendarDate(r.returnAt) : '—'}
                </td>
                <td>{r.carrierName}</td>
                <td>{r.serviceNumber}</td>
                <td>{cabins[r.cabinClassCode] ?? r.cabinClassCode}</td>
                <td>{r.adults}</td>
                <td>{r.children2To6}</td>
                <td>{r.children6To12}</td>
                <td>{r.childrenUnknownAge}</td>
                <td>{r.infants}</td>
                <td>{r.passengers}</td>
                <td>{r.seats}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!report.data.length && (
        <p className={styles.empty}>
          قراردادی برای این بلیت و تاریخ وجود ندارد.
        </p>
      )}
    </>
  );
}

export function FlightLoadContracts({
  offer,
  cityName,
  onClose,
}: {
  offer: TicketOfferV1;
  cityName: (id: string) => string;
  onClose: () => void;
}) {
  const [cancelled, setCancelled] = useState(false),
    [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    cancelled: boolean;
    report?: FlightLoadContractsV1;
    error?: string;
  }>();
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState('');
  const download = useRef<AbortController | null>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadFlightContracts(offer.id, cancelled, controller.signal)
      .then((report) => {
        if (!controller.signal.aborted) setResult({ cancelled, report });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            cancelled,
            error:
              error instanceof Error
                ? error.message
                : 'دریافت گزارش انجام نشد؛ دسترسی و فیلترها را بررسی کنید.',
          });
      });
    return () => controller.abort();
  }, [offer.id, cancelled, retry]);
  useEffect(() => () => download.current?.abort(), []);
  const current = result?.cancelled === cancelled ? result : undefined;
  const exportFile = async () => {
    const controller = new AbortController();
    download.current = controller;
    setExporting(true);
    setExportError('');
    try {
      const blob = await downloadFlightContracts(
        offer.id,
        cancelled,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `flight-${offer.serviceNumber}-${ticketCalendarDate(offer.departureAt)}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(
          error instanceof Error
            ? error.message
            : 'دریافت گزارش انجام نشد؛ دسترسی و فیلترها را بررسی کنید.',
        );
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  return (
    <section
      ref={section}
      tabIndex={-1}
      className={styles.contracts}
      aria-label="قراردادهای پرواز"
    >
      <div className={styles.header}>
        <h2>
          قراردادهای پرواز — {offer.carrierName} · {offer.serviceNumber} ·{' '}
          <span dir="ltr">{ticketCalendarDate(offer.departureAt)}</span> ·{' '}
          {cabins[offer.cabinClassCode]}
        </h2>
        <Button variant="outline" onClick={onClose}>
          بستن
        </Button>
      </div>
      <div className={styles.totals}>
        <Button
          variant="outline"
          disabled={exporting || !current}
          onClick={() => {
            setResult(undefined);
            setExportError('');
            setRetry((v) => v + 1);
          }}
        >
          به‌روزرسانی
        </Button>
        <label>
          <input
            type="checkbox"
            checked={cancelled}
            disabled={exporting}
            onChange={(e) => {
              setResult(undefined);
              setCancelled(e.target.checked);
              setExportError('');
            }}
          />{' '}
          فقط قراردادهای لغوشده
        </label>
        <Button
          disabled={!current?.report || exporting}
          onClick={() => void exportFile()}
        >
          {exporting ? 'در حال دریافت…' : 'خروجی اکسل'}
        </Button>
      </div>
      {!current && (
        <p role="status" className={styles.empty}>
          در حال دریافت…
        </p>
      )}
      {current?.error && (
        <div role="alert" className={styles.empty}>
          {current.error}{' '}
          <Button
            variant="outline"
            onClick={() => {
              setResult(undefined);
              setRetry((v) => v + 1);
            }}
          >
            تلاش دوباره
          </Button>
        </div>
      )}
      {exportError && <p role="alert">{exportError}</p>}
      {current?.report && (
        <FlightLoadContractsTable report={current.report} cityName={cityName} />
      )}
    </section>
  );
}
