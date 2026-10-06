'use client';

import { useMemo, useState } from 'react';
import type { ImportedOccupancy } from './occupancy-import';

export function OccupancyImportPreview({
  rows,
  issues,
  excluded,
}: {
  rows: readonly ImportedOccupancy[];
  issues: readonly string[];
  excluded: number;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const summary = useMemo(() => {
    const hotels = new Set<string>(),
      rooms = new Set<string>(),
      currencies = new Map<string, number>();
    for (const row of rows) {
      hotels.add(row.hotel);
      rooms.add(JSON.stringify([row.hotel, row.room]));
      currencies.set(
        row.currencyCode,
        (currencies.get(row.currencyCode) ?? 0) + 1,
      );
    }
    return {
      hotels: hotels.size,
      rooms: rooms.size,
      currencies: [...currencies],
    };
  }, [rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query
      ? rows.filter((row) =>
          [
            row.sourceRow,
            row.hotel,
            row.room,
            row.board,
            row.composition,
            row.startsOn,
            row.endsOnExclusive,
            row.currencyCode,
            row.amount,
          ]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query),
        )
      : rows;
  }, [rows, search]);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 30) - 1),
  );
  const count = (n: number) => n.toLocaleString('fa-IR');
  return (
    <section
      className="space-y-3 rounded-lg border bg-muted/20 p-3"
      aria-label="پیش‌نمایش فایل نرخ هتل"
    >
      <h3 className="font-bold">پیش‌نمایش شیت خروجی نورا</h3>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          ['کل ردیف‌های داده', rows.length + issues.length + excluded],
          ['نرخ سالم خوانده‌شده', rows.length],
          ['ردیف نیازمند اصلاح', issues.length],
          ['ردیف کنارگذاشته‌شده IN DBL PP', excluded],
          ['هتل با نرخ سالم', summary.hotels],
          ['اتاق هتل با نرخ سالم', summary.rooms],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="font-bold">{count(Number(value))}</dd>
          </div>
        ))}
      </dl>
      <p>
        تعداد قیمت‌های سالم به تفکیک ارز:{' '}
        {summary.currencies
          .map(([currency, n]) => `${currency}: ${count(n)}`)
          .join(' / ') || '—'}
      </p>
      <p>
        هر ردیف سالم، یک قیمت کل اتاق در هر شب برای ترکیب و بازهٔ خودش است. این
        پیش‌نمایش ثبت نیست؛ ردیف‌های نامعتبر وارد پیش‌نویس نمی‌شوند.
      </p>
      {issues.length > 0 && (
        <details>
          <summary>
            {count(issues.length)} ردیف نیازمند اصلاح (ثبت نمی‌شوند)
          </summary>
          <ul>
            {issues.slice(0, 50).map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          {issues.length > 50 && <p>۵۰ خطای اول نمایش داده شده است.</p>}
        </details>
      )}
      <label className="block">
        جست‌وجو در ردیف‌های سالم
        <input
          className="mt-1 w-full rounded border p-2"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="شماره ردیف، هتل، اتاق، ترکیب، تاریخ، ارز یا قیمت"
        />
      </label>
      <p role="status">
        {count(filtered.length)} نرخ مطابق جست‌وجو؛ صفحه{' '}
        {count(currentPage + 1)} از{' '}
        {count(Math.max(1, Math.ceil(filtered.length / 30)))}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr>
              {[
                'ردیف اکسل',
                'هتل',
                'اتاق / بورد',
                'ترکیب / سن کودک',
                'از تاریخ',
                'تا تاریخ (شامل)',
                'قیمت کل اتاق/شب',
                'ارز',
              ].map((label) => (
                <th className="p-2" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 30, (currentPage + 1) * 30)
              .map((row) => (
                <tr key={row.sourceRow} className="border-t">
                  <td className="p-2">{count(row.sourceRow)}</td>
                  <td className="p-2">{row.hotel}</td>
                  <td className="p-2">
                    {row.room} / {row.board || '—'}
                  </td>
                  <td className="p-2">
                    {row.composition}
                    <div>
                      {row.childAges
                        .map(
                          (age) =>
                            `${age.min} تا کمتر از ${age.maxExclusive} سال`,
                        )
                        .join(' / ') || 'بدون کودک'}
                    </div>
                  </td>
                  <td className="p-2" dir="ltr">
                    {row.startsOn}
                  </td>
                  <td className="p-2" dir="ltr">
                    {new Date(
                      Date.parse(`${row.endsOnExclusive}T00:00:00Z`) - 86400000,
                    )
                      .toISOString()
                      .slice(0, 10)}
                  </td>
                  <td className="p-2" dir="ltr">
                    {row.amount}
                  </td>
                  <td className="p-2">{row.currencyCode}</td>
                </tr>
              ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="p-3">
                  نرخ سالمی مطابق جست‌وجو پیدا نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          صفحه قبلی
        </button>
        <button
          type="button"
          disabled={(currentPage + 1) * 30 >= filtered.length}
          onClick={() => setPage(currentPage + 1)}
        >
          صفحه بعدی
        </button>
      </div>
    </section>
  );
}
