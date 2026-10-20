'use client';
import { useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import type { HrRecordDto } from '@nora/contracts';
import { persianDateToIso } from './hr-dates';
import { useHrReferenceData } from './hr-reference-data';
import type { HrStore } from './hr-store';
import { hrRequest } from './hr-api';
import { HrButton } from './hr-controls';
import { currentPersianYear } from './hr-radan-tools';
import ui from './hr-unified.module.css';

export function persianCalendarMonths(year: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const start = persianDateToIso(`${year}/${i + 1}/1`),
      next = persianDateToIso(
        `${i === 11 ? year + 1 : year}/${i === 11 ? 1 : i + 2}/1`,
      );
    const count = (Date.parse(next) - Date.parse(start)) / 86400000;
    return {
      month: i + 1,
      dates: Array.from({ length: count }, (_, j) =>
        new Date(Date.parse(start) + j * 86400000).toISOString().slice(0, 10),
      ),
    };
  });
}
export function HrTemplateCalendar({
  record,
  store,
}: {
  record: HrRecordDto;
  store: HrStore;
}) {
  const refs = useHrReferenceData(store);
  const [year, setYear] = useState(currentPersianYear()),
    [selected, setSelected] = useState<string[]>([]),
    [hours, setHours] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(crypto.randomUUID());
  const [positions, setPositions] = useState<string[]>([]),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const days = refs.data.records.filter(
    (r) => r.parentId === record.id && r.tab === 'templateDays' && !r.deletedAt,
  );
  const save = async (remove: boolean) => {
    setBusy(true);
    setError('');
    try {
      await hrRequest(`/shifts/${record.id}/calendar`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': key.current,
        },
        body: JSON.stringify({
          version: record.version,
          dates: selected,
          ...(remove ? { remove: true } : { workingHoursId: hours }),
        }),
      });
      key.current = crypto.randomUUID();
      setSelected([]);
      await store.mutated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تقویم ثبت نشد.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={ui.spaced}>
      <h3>تقویم سالانه شیفت</h3>
      <div className={ui.filters}>
        <HrButton
          disabled={busy}
          onClick={() => {
            setYear((y) => y - 1);
            setSelected([]);
          }}
        >
          سال قبل
        </HrButton>
        <label>
          سال
          <input
            type="number"
            min="1300"
            max="1600"
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (y >= 1300 && y <= 1600) {
                setYear(y);
                setSelected([]);
              }
            }}
          />
        </label>
        <HrButton
          disabled={busy}
          onClick={() => {
            setYear((y) => y + 1);
            setSelected([]);
          }}
        >
          سال بعد
        </HrButton>
        <HrButton
          onClick={() => {
            setYear(currentPersianYear());
            setSelected([]);
          }}
        >
          سال جاری
        </HrButton>
        {store.data!.capabilities.write ? (
          <>
            <label>
              ساعت کاری
              <NativeSearchSelect
                value={hours}
                onChange={(e) => {
                  setHours(e.target.value);
                  key.current = crypto.randomUUID();
                }}
              >
                <option value="">انتخاب ساعت کاری</option>
                {refs.data.records
                  .filter(
                    (r) =>
                      r.branchId === record.branchId &&
                      r.section === 'time' &&
                      r.tab === 'workingHours' &&
                      r.status === 'فعال',
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.values[0]}
                    </option>
                  ))}
              </NativeSearchSelect>
            </label>
            <HrButton
              disabled={
                busy ||
                !selected.length ||
                !hours ||
                refs.loading ||
                !!refs.error
              }
              onClick={() => void save(false)}
            >
              ثبت روزها
            </HrButton>
            <HrButton
              disabled={busy || !selected.length}
              onClick={() => void save(true)}
            >
              حذف روزها
            </HrButton>
            <HrButton onClick={() => setSelected([])}>پاک‌سازی انتخاب</HrButton>
          </>
        ) : null}
      </div>
      {error || refs.error ? <p role="alert">{error || refs.error}</p> : null}
      {store.data!.capabilities.write ? (
        <details>
          <summary>انتساب شیفت به جایگاه‌های سازمانی</summary>
          <div className={ui.filters}>
            <label>
              از تاریخ
              <DatePicker
                value={from}
                onChange={(value) => {
                  setFrom(value);
                  key.current = crypto.randomUUID();
                }}
              />
            </label>
            <label>
              تا تاریخ
              <DatePicker
                value={to}
                onChange={(value) => {
                  setTo(value);
                  key.current = crypto.randomUUID();
                }}
              />
            </label>
            <label>
              جایگاه‌های سازمانی
              <select
                multiple
                value={positions}
                onChange={(event) => {
                  setPositions(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  );
                  key.current = crypto.randomUUID();
                }}
              >
                {refs.data.records
                  .filter(
                    (r) =>
                      r.branchId === record.branchId &&
                      r.section === 'organization' &&
                      r.tab === 'positions' &&
                      r.status === 'فعال',
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.values[0]} — {r.values[2]}
                    </option>
                  ))}
              </select>
            </label>
            <HrButton
              disabled={busy || !from || !to || !positions.length}
              onClick={() => {
                setBusy(true);
                setError('');
                void hrRequest(`/shifts/${record.id}/assign`, {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'Idempotency-Key': key.current,
                  },
                  body: JSON.stringify({ positionIds: positions, from, to }),
                })
                  .then(async () => {
                    key.current = crypto.randomUUID();
                    setPositions([]);
                    await store.mutated();
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error ? e.message : 'انتساب انجام نشد.',
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              ثبت انتساب
            </HrButton>
          </div>
        </details>
      ) : null}
      {persianCalendarMonths(year).map((month) => (
        <div key={month.month} className={ui.spaced}>
          <strong>
            {month.month} / {year}
          </strong>
          <div className={ui.calendarScroll}>
            <div className={ui.shiftGrid}>
              {[
                'شنبه',
                'یکشنبه',
                'دوشنبه',
                'سه‌شنبه',
                'چهارشنبه',
                'پنجشنبه',
                'جمعه',
              ].map((day) => (
                <strong key={day}>{day}</strong>
              ))}
              {Array.from(
                {
                  length:
                    (new Date(month.dates[0]! + 'T12:00:00Z').getUTCDay() + 1) %
                    7,
                },
                (_, index) => (
                  <span key={`empty-${index}`} />
                ),
              )}
              {month.dates.map((date, index) => {
                const day = days.find((r) => r.values[0] === date);
                return (
                  <button
                    type="button"
                    className={`${ui.shiftDay} ${selected.includes(date) ? ui.activeTab : ''}`}
                    key={date}
                    disabled={busy || !store.data!.capabilities.write}
                    aria-pressed={selected.includes(date)}
                    title={
                      day
                        ? `${day.values[1]} تا ${day.values[2]}`
                        : 'بدون ساعت کاری'
                    }
                    onClick={() => {
                      setSelected((items) =>
                        items.includes(date)
                          ? items.filter((d) => d !== date)
                          : [...items, date],
                      );
                      key.current = crypto.randomUUID();
                    }}
                  >
                    {index + 1}
                    {day ? (
                      <small>
                        {day.values[1]} — {day.values[2]}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
