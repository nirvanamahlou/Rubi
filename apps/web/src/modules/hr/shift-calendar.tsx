'use client';
import { useMemo, useState } from 'react';
import type { HrPreviewDataset } from './hr-preview-data';
import { persianDateToIso } from './hr-dates';
import { toIsoDate } from '@/components/ui/date-picker.utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HrButton } from './hr-controls';
import ui from './hr-unified.module.css';

export function ShiftCalendar({ shifts }: { shifts: HrPreviewDataset }) {
  const [month, setMonth] = useState(() => {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    return {
      year: Number(parts.find((part) => part.type === 'year')?.value),
      month: Number(parts.find((part) => part.type === 'month')?.value),
    };
  });
  const shiftMonth = (delta: number) => {
    const index = month.year * 12 + month.month - 1 + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  };
  const iso = (year: number, number: number) =>
    persianDateToIso(`${year}/${number}/1`);
  const first = new Date(`${iso(month.year, month.month)}T12:00:00`);
  const next = shiftMonth(1);
  const count = Math.round(
    (Date.parse(iso(next.year, next.month)) -
      Date.parse(iso(month.year, month.month))) /
      86400000,
  );
  const offset = (first.getDay() + 1) % 7;
  const shiftsByDate = useMemo(
    () =>
      shifts.rows.map((row) => {
        const read = (label: string) => {
          const cell = row[shifts.columns.indexOf(label)];
          return typeof cell === 'string' ? cell : (cell?.label ?? '');
        };
        return {
          from: persianDateToIso(read('از تاریخ')),
          to: persianDateToIso(read('تا تاریخ')),
          status: read('وضعیت'),
          employee: read('کارمند'),
          title: read('عنوان شیفت'),
          start: read('ساعت شروع'),
          end: read('ساعت پایان'),
        };
      }),
    [shifts],
  );
  return (
    <div className={ui.spaced}>
      <div className={ui.calendarHeader}>
        <HrButton size="sm" onClick={() => setMonth(shiftMonth(-1))}>
          <ChevronRight size={16} aria-hidden="true" /> ماه قبل
        </HrButton>
        <strong aria-live="polite">
          {first.toLocaleDateString('fa-IR-u-ca-persian', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <HrButton size="sm" onClick={() => setMonth(shiftMonth(1))}>
          ماه بعد <ChevronLeft size={16} aria-hidden="true" />
        </HrButton>
      </div>
      <div
        className={ui.calendarScroll}
        tabIndex={0}
        role="region"
        aria-label="تقویم شیفت کارکنان"
      >
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
          {Array.from({ length: offset }, (_, index) => (
            <div key={`empty-${index}`} />
          ))}
          {Array.from({ length: count }, (_, index) => {
            const currentDate = new Date(first);
            currentDate.setDate(first.getDate() + index);
            const date = toIsoDate(currentDate);
            const records = shiftsByDate.filter(
              (row) =>
                row.from <= date && row.to >= date && row.status !== 'غیرفعال',
            );
            return (
              <div key={date} className={ui.shiftDay}>
                <time dateTime={date}>
                  {(index + 1).toLocaleString('fa-IR')}
                </time>
                {records.map((row, rowIndex) => (
                  <div key={rowIndex} className={ui.shiftEntry}>
                    {row.employee}
                    <br />
                    {row.title} · {row.start}–{row.end}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
