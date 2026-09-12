'use client';
import { useState } from 'react';
import type { MasterDataRecord } from '@rubi/contracts';
import { OrganizationDocumentsPanel } from './organization-documents-panel';
import { downloadOrganizationXlsx } from '../model/organization-xlsx';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import {
  financePreviewRows,
  filterFinancePreview,
  previewTotals,
  type FinancePreviewRow,
  type FinancePreviewTab,
} from '../model/finance-preview';

const titles: Record<FinancePreviewTab, string> = {
  statement: 'صورتحساب دوره‌ای',
  invoice: 'فاکتورهای نمونه',
  payments: 'دریافت‌های نمونه',
  checks: 'چک‌های نمونه',
  settlement: 'تسویه‌های نمونه',
  disputes: 'مغایرت‌های نمونه',
};
const amount = (value: string | bigint) =>
  BigInt(value).toLocaleString('fa-IR');
export function OrganizationFinancePreview({
  organizationName,
  tab,
  organization,
}: {
  organizationName: string;
  tab: string;
  organization?: MasterDataRecord;
}) {
  const current: FinancePreviewTab = Object.hasOwn(financePreviewRows, tab)
    ? (tab as FinancePreviewTab)
    : 'statement';
  const [filter, setFilter] = useState({
    currency: '',
    status: '',
    from: '',
    to: '',
  });
  const [detail, setDetail] = useState<FinancePreviewRow | null>(null);
  const rows = financePreviewRows[current];
  const statuses = [...new Set(rows.map((r) => r.status))];
  const effectiveFilter = {
    ...filter,
    status: statuses.includes(filter.status) ? filter.status : '',
  };
  const shown = filterFinancePreview(rows, effectiveFilter);
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  return (
    <section className="panel">
      <header className="panel-head">
        <div className="panel-title">{titles[current]}</div>
        <span className="badge amber">داده آزمایشی</span>
      </header>
      <div className="panel-body space-y-4">
        {organization ? (
          <OrganizationDocumentsPanel
            key={organization.id + current}
            organization={organization}
            folderLabel={`اسناد مالی ${titles[current].replace('های نمونه', '').replace('نمونه', '')}`}
          />
        ) : null}
        <button
          className="btn"
          disabled={invalidRange || !shown.length}
          onClick={() =>
            downloadOrganizationXlsx(`finance-preview-${current}.xlsx`, [
              [
                'سازمان',
                'نوع داده',
                'بخش',
                'شناسه',
                'تاریخ',
                'شرح',
                'مبلغ',
                'ارز',
                'وضعیت',
                'مرجع',
                'یادداشت',
              ],
              ...shown.map((row) => [
                organizationName,
                'آزمایشی؛ فاقد ثبت حسابداری',
                titles[current],
                row.id,
                row.date,
                row.title,
                row.amount,
                row.currency,
                row.status,
                row.reference,
                row.note,
              ]),
            ])
          }
        >
          خروجی Excel ردیف‌های فیلترشده
        </button>
        <p className="boundary-note" role="note">
          این ردیف‌ها سناریوی نمونه برای بررسی بخش مالی پرونده «
          {organizationName}» هستند؛ سوابق واقعی این آژانس، سند حسابداری یا
          تأیید پرداخت نیستند و روی اعتبار قابل استفاده اثر ندارند.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['IRR', 'USD'] as const).map((currency) => {
            const totals = previewTotals(currency);
            return (
              <div key={currency} className="rounded-xl border p-4 space-y-2">
                <b>
                  جمع کل سناریوی نمونه — {currency === 'IRR' ? 'ریال' : 'دلار'}
                </b>
                <p>فاکتورها: {amount(totals.invoiced)}</p>
                <p>دریافت فرضی: {amount(totals.received)}</p>
                <p>
                  مانده نمونه: <strong>{amount(totals.outstanding)}</strong>
                </p>
              </div>
            );
          })}
        </div>
        <div className="dossier-filter-grid">
          <label className="field">
            <span>ارز</span>
            <select
              className="input"
              value={filter.currency}
              onChange={(e) =>
                setFilter({ ...filter, currency: e.target.value })
              }
            >
              <option value="">همه ارزها</option>
              <option value="IRR">ریال</option>
              <option value="USD">دلار</option>
            </select>
          </label>
          <label className="field">
            <span>وضعیت نمونه</span>
            <select
              className="input"
              value={effectiveFilter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">همه وضعیت‌ها</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>از تاریخ</span>
            <DatePicker
              withinDialog
              aria-label="از تاریخ نمونه مالی"
              value={filter.from}
              onChange={(from) => setFilter({ ...filter, from })}
            />
          </div>
          <div className="field">
            <span>تا تاریخ</span>
            <DatePicker
              withinDialog
              aria-label="تا تاریخ نمونه مالی"
              value={filter.to}
              onChange={(to) => setFilter({ ...filter, to })}
            />
          </div>
        </div>
        <button
          className="btn small"
          onClick={() =>
            setFilter({ currency: '', status: '', from: '', to: '' })
          }
        >
          پاک‌کردن فیلترها
        </button>
        {invalidRange ? (
          <p role="alert" className="form-error">
            تاریخ پایان نباید قبل از تاریخ شروع باشد.
          </p>
        ) : null}
        <p className="panel-note">
          {shown.length.toLocaleString('fa-IR')} ردیف نمونه
          {current === 'checks'
            ? '؛ فیلتر تاریخ بر اساس سررسید چک است.'
            : '.'}{' '}
          جمع‌های بالا مربوط به کل سناریو هستند.
        </p>
        <div className="agreement-table-wrap">
          <table>
            <caption className="sr-only">
              {titles[current]} — داده آزمایشی
            </caption>
            <thead>
              <tr>
                <th>شناسه نمونه</th>
                <th>{current === 'checks' ? 'سررسید' : 'تاریخ'}</th>
                <th>شرح</th>
                <th>مبلغ</th>
                <th>ارز</th>
                <th>وضعیت</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td>
                    <bdi>{row.id}</bdi>
                  </td>
                  <td>
                    {new Date(row.date + 'T00:00:00Z').toLocaleDateString(
                      'fa-IR',
                      { timeZone: 'UTC' },
                    )}
                  </td>
                  <td>
                    {row.title}
                    {current === 'statement' ? (
                      <small className="block">
                        {row.direction === 'debit' ? 'بدهکار' : 'بستانکار'}
                      </small>
                    ) : null}
                  </td>
                  <td>{amount(row.amount)}</td>
                  <td>{row.currency}</td>
                  <td>{row.status}</td>
                  <td>
                    <button
                      className="btn small"
                      aria-label={`مشاهده ${row.id}`}
                      onClick={() => setDetail(row)}
                    >
                      مشاهده
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!shown.length && !invalidRange ? (
          <p role="status" className="empty">
            نمونه‌ای با این فیلترها پیدا نشد.
          </p>
        ) : null}
      </div>
      {detail ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{detail.title}</DialogTitle>
            <DialogDescription>
              داده آزمایشی — فاقد اثر حسابداری
            </DialogDescription>
            <div className="summary-list">
              <p>
                <bdi>{detail.id}</bdi>
              </p>
              <p>
                مبلغ: {amount(detail.amount)} {detail.currency}
              </p>
              <p>
                مرجع نمونه: <bdi>{detail.reference}</bdi>
              </p>
              <p>{detail.note}</p>
            </div>
            <button className="btn" onClick={() => setDetail(null)}>
              بستن
            </button>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
