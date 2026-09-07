'use client';
import { useState } from 'react';
import type { HrPreviewDataset } from './hr-preview-data';
import { persianDateToIso } from './contextual-hr-form';

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
  const read = (row: HrPreviewDataset['rows'][number], label: string) => {
    const cell = row[shifts.columns.indexOf(label)];
    return typeof cell === 'string' ? cell : (cell?.label ?? '');
  };
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <button type="button" onClick={() => setMonth(shiftMonth(-1))}>
          ماه قبل
        </button>
        <strong>
          {first.toLocaleDateString('fa-IR-u-ca-persian', {
            month: 'long',
            year: 'numeric',
          })}
        </strong>
        <button type="button" onClick={() => setMonth(shiftMonth(1))}>
          ماه بعد
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 4,
        }}
      >
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
          const date = persianDateToIso(
            `${month.year}/${month.month}/${index + 1}`,
          );
          const records = shifts.rows.filter(
            (row) =>
              persianDateToIso(read(row, 'از تاریخ')) <= date &&
              persianDateToIso(read(row, 'تا تاریخ')) >= date &&
              read(row, 'وضعیت') !== 'غیرفعال',
          );
          return (
            <div
              key={date}
              style={{
                minHeight: 100,
                border: '1px solid #d6e4f6',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <time dateTime={date}>{(index + 1).toLocaleString('fa-IR')}</time>
              {records.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    background: '#eef6ff',
                    marginTop: 4,
                    padding: 4,
                    borderRadius: 4,
                  }}
                >
                  {read(row, 'کارمند')}
                  <br />
                  {read(row, 'عنوان شیفت')} · {read(row, 'ساعت شروع')}–
                  {read(row, 'ساعت پایان')}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
