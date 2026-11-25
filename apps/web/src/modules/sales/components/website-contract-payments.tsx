'use client';

import { useState, type FormEvent } from 'react';
import { salesApi, type WebsiteContractPayment } from '../api/client';

const dateFormat = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});
const numberFormat = new Intl.NumberFormat('fa-IR');
const digits = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';

export function WebsiteContractPayments() {
  const [rows, setRows] = useState<WebsiteContractPayment[]>();
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(number: string) {
    setLoading(true);
    setError('');
    try {
      const normalized = number
        .trim()
        .replace(/[۰-۹٠-٩]/g, (digit) => String(digits.indexOf(digit) % 10));
      setRows((await salesApi.websiteContractPayments(normalized)).data);
    } catch {
      setError('دریافت پرداخت‌های سایت ناموفق بود. دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(reference);
  }

  return (
    <details
      className="rounded-2xl border border-border bg-surface p-4"
      onToggle={(event) => {
        if (event.currentTarget.open && !rows && !loading && !error)
          void load('');
      }}
    >
      <summary className="cursor-pointer font-bold">
        پرداخت‌های آنلاین سایت نیایش
      </summary>
      <form
        className="my-4 flex flex-wrap items-center gap-2 text-sm"
        onSubmit={search}
      >
        <label htmlFor="website-payment-reference">شماره قرارداد مشتری</label>
        <input
          id="website-payment-reference"
          className="rounded-lg border border-border bg-background px-3 py-2"
          maxLength={40}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <button
          className="rounded-lg border border-border px-3 py-2 disabled:opacity-50"
          disabled={loading}
        >
          جستجو
        </button>
      </form>
      {loading && (
        <p role="status" className="text-sm">
          در حال دریافت…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!loading && !error && rows?.length === 0 && (
        <p className="text-sm">پرداختی پیدا نشد.</p>
      )}
      {!loading && !error && !!rows?.length && (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-start text-sm">
            <thead className="bg-muted/60">
              <tr>
                {[
                  'شماره ثبت',
                  'شماره قرارداد مشتری',
                  'مشتری',
                  'مبلغ',
                  'شماره پیگیری بانک',
                  'فروشنده',
                  'زمان پرداخت',
                ].map((label) => (
                  <th className="px-3 py-2 text-start" key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2">
                    <bdi>{row.receiptNumber}</bdi>
                  </td>
                  <td className="px-3 py-2">
                    <bdi>{row.contractNumber}</bdi>
                  </td>
                  <td className="px-3 py-2">{row.customerName}</td>
                  <td className="px-3 py-2">
                    {numberFormat.format(BigInt(row.amountRial) / 10n)} تومان
                  </td>
                  <td className="px-3 py-2">
                    <bdi>{row.trackingNumber}</bdi>
                  </td>
                  <td className="px-3 py-2">{row.seller}</td>
                  <td className="px-3 py-2">
                    {dateFormat.format(new Date(row.verifiedAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
