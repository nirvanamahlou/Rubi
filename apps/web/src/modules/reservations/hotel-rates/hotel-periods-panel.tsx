'use client';

import { useEffect, useRef, useState } from 'react';
import {
  sharedHotelCandidates,
  validHotelStay,
  type HotelRatePeriodV1,
} from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import Link from '@/i18n/link';
import { rateRequest } from './controls';
import styles from './rates.module.css';

export function HotelPeriodsPanel({
  branchId,
  cityId,
  hotelId,
  revision,
  disabled,
  canWrite,
  onEdit,
  onSaved,
}: {
  branchId: string;
  cityId: string;
  hotelId: string;
  revision: number;
  disabled: boolean;
  canWrite: boolean;
  onEdit: (id: string, hotelId: string) => void;
  onSaved: () => void;
}) {
  const [periods, setPeriods] = useState<HotelRatePeriodV1[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{
    batchId: string;
    from: string;
    to: string;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const pending = useRef<{ body: string; key: string } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      setSelected([]);
      try {
        const result = await rateRequest<HotelRatePeriodV1[]>(
          `/periods?branchId=${encodeURIComponent(branchId)}&cityId=${encodeURIComponent(cityId)}`,
        );
        if (active) setPeriods(result);
      } catch (cause) {
        if (active) {
          setPeriods([]);
          setError(
            cause instanceof Error
              ? cause.message
              : 'دریافت دوره‌ها ناموفق بود.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [branchId, cityId, revision, refresh]);
  const valid = validHotelStay(from, to);
  const candidates = sharedHotelCandidates(periods, from, to);
  const available = candidates.filter((row) => row.available);
  const visiblePeriods = periods.filter(
    (period) =>
      (!hotelId || period.rows.some((row) => row.hotelId === hotelId)) &&
      (!from || period.checkOut > from) &&
      (!to || period.checkIn < to),
  );
  function changeDate(value: string, start: boolean) {
    if (start) setFrom(value);
    else setTo(value);
    setSelected([]);
    setSaved(null);
    setError('');
    pending.current = null;
  }
  async function save() {
    if (
      inFlight.current ||
      disabled ||
      !canWrite ||
      loading ||
      !valid ||
      !selected.length
    )
      return;
    const rows = available.filter((row) => selected.includes(row.key));
    if (rows.length !== selected.length) return;
    const body = JSON.stringify({
      branchId,
      cityId,
      checkIn: from,
      checkOut: to,
      selections: rows.map((row) => ({
        key: row.key,
        sourceBatchIds: row.sourceBatchIds,
      })),
    });
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await rateRequest<{ batchId: string }>('/shared-periods', {
        method: 'POST',
        body,
        headers: { 'idempotency-key': pending.current.key },
      });
      setSaved({ batchId: result.batchId, from, to });
      pending.current = null;
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ثبت بازهٔ مشترک ناموفق بود.',
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <section
      className={styles.periodPanel}
      aria-label="دوره‌های نرخ و بازهٔ مشترک"
    >
      <div className={styles.periodHeading}>
        <strong>دوره‌های ثبت‌شده</strong>
        <button
          type="button"
          disabled={disabled || saving || loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          تازه‌سازی دوره‌ها
        </button>
      </div>
      <div className={styles.periodList} aria-label="بازه‌های ثبت‌شدهٔ هتل">
        {loading ? (
          <span role="status">در حال دریافت دوره‌ها…</span>
        ) : visiblePeriods.length ? (
          visiblePeriods.map((period) => (
            <div key={period.id} className={styles.periodItem}>
              <span dir="ltr">
                {period.checkIn} → {period.checkOut}
              </span>
              <small>
                {period.rows
                  .filter((row) => !hotelId || row.hotelId === hotelId)
                  .map((row) => row.hotelName)
                  .join('، ')}
              </small>
              <button
                type="button"
                disabled={disabled || saving || !canWrite}
                onClick={() => onEdit(period.id, hotelId)}
              >
                ویرایش
              </button>
            </div>
          ))
        ) : (
          <span>دوره‌ای در این فیلتر ثبت نشده است.</span>
        )}
      </div>
      <fieldset disabled={disabled || saving}>
        <div className={styles.periodFilters}>
          <label>
            از تاریخ
            <DatePicker
              value={from}
              onChange={(value) => changeDate(value, true)}
              defaultCalendarSystem="gregorian"
              aria-label="شروع بازهٔ مشترک"
            />
          </label>
          <label>
            تا تاریخ (خروج)
            <DatePicker
              value={to}
              onChange={(value) => changeDate(value, false)}
              defaultCalendarSystem="gregorian"
              aria-label="پایان بازهٔ مشترک"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              changeDate('', true);
              setTo('');
            }}
          >
            پاک‌کردن بازه
          </button>
        </div>
        {from && to && !valid && <p role="alert">بازهٔ اقامت معتبر نیست.</p>}
      </fieldset>
      <details className={styles.sharedPeriod}>
        <summary>بازهٔ مشترک برای پکیج</summary>
        <fieldset disabled={disabled || saving}>
          {valid && !loading && (
            <>
              <label className={styles.periodCheck}>
                <input
                  type="checkbox"
                  disabled={!canWrite || !available.length}
                  checked={
                    available.length > 0 &&
                    available.every((row) =>
                      selected.some(
                        (key) =>
                          candidates.find((item) => item.key === key)
                            ?.hotelId === row.hotelId,
                      ),
                    )
                  }
                  onChange={(event) => {
                    setSaved(null);
                    setSelected(
                      event.target.checked
                        ? [
                            ...new Map(
                              available.map((row) => [row.hotelId, row.key]),
                            ).values(),
                          ]
                        : [],
                    );
                  }}
                />
                انتخاب همهٔ هتل‌های دارای نرخ
              </label>
              <div className={styles.sharedHotels}>
                {candidates.map((row) => (
                  <label key={row.key} className={styles.periodCheck}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.key)}
                      disabled={!canWrite || !row.available}
                      onChange={(event) => {
                        setSaved(null);
                        setSelected((old) =>
                          event.target.checked
                            ? [
                                ...old.filter(
                                  (key) =>
                                    candidates.find((item) => item.key === key)
                                      ?.hotelId !== row.hotelId,
                                ),
                                row.key,
                              ]
                            : old.filter((key) => key !== row.key),
                        );
                      }}
                    />
                    <span>
                      {row.hotelName}{' '}
                      <small>
                        · {row.brokerName} · {row.currency}
                      </small>
                    </span>
                    <small>
                      {row.available
                        ? 'پوشش کامل شب‌ها'
                        : 'نرخ ناقص یا هم‌پوشان'}
                    </small>
                  </label>
                ))}
                {!candidates.length && <p>هتلی در این بازه نرخ ندارد.</p>}
              </div>
              <div className={styles.periodHeading}>
                <small>{selected.length} هتل منتخب</small>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={!canWrite || !selected.length || saving || !!saved}
                  onClick={() => void save()}
                >
                  {saving ? 'در حال ثبت…' : 'ثبت بازهٔ مشترک'}
                </button>
              </div>
            </>
          )}
        </fieldset>
        {saved && (
          <p role="status">
            <Link
              href={`/sales/pricing/management?batch=${encodeURIComponent(saved.batchId)}&city=${encodeURIComponent(cityId)}&branch=${encodeURIComponent(branchId)}&from=${saved.from}&to=${saved.to}`}
            >
              بستن پکیج با هتل‌های این بازه
            </Link>
          </p>
        )}
      </details>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
