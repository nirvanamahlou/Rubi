'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { Download, Eye } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Alert, Badge, Skeleton } from '@/components/ui/surfaces';
import {
  connectedFinanceRows,
  connectedOutstanding,
  filterConnectedFinanceRows,
  type ConnectedFinanceRow,
  type ConnectedFinanceTab,
} from '../model/organization-crm-connections';
import { downloadOrganizationXlsx } from '../model/organization-xlsx';
import { moneyLabel } from '../model/presentation';
import { OrganizationDocumentsPanel } from './organization-documents-panel';
import { useOrganizationCrmConnections } from './use-organization-crm-connections';

const titles: Record<ConnectedFinanceTab, string> = {
  statement: 'گردش و مانده قراردادهای فروش',
  invoice: 'تعهدهای ثبت‌شده در قرارداد فروش',
  payments: 'دریافت‌های ثبت‌شده در فروش',
  checks: 'چک‌های ثبت‌شده در فروش',
  settlement: 'وضعیت تسویه قراردادهای فروش',
  disputes: 'مغایرت‌های مالی',
};

const tabs: readonly ConnectedFinanceTab[] = [
  'statement',
  'invoice',
  'payments',
  'checks',
  'settlement',
  'disputes',
];

function isFinanceTab(value: string): value is ConnectedFinanceTab {
  return tabs.includes(value as ConnectedFinanceTab);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('fa-IR', {
    timeZone: 'UTC',
  });
}

export function OrganizationFinancePreview({
  organizationName,
  tab,
  organization,
}: {
  organizationName: string;
  tab: string;
  organization?: MasterDataRecord;
}) {
  const current = isFinanceTab(tab) ? tab : 'statement';
  const { data, loading, error, refresh } = useOrganizationCrmConnections(
    organization?.id ?? '',
  );
  const [filter, setFilter] = useState({
    currency: '',
    status: '',
    from: '',
    to: '',
  });
  const [detail, setDetail] = useState<ConnectedFinanceRow | null>(null);
  const rows = data ? connectedFinanceRows(data, current) : [];
  const statuses = [...new Set(rows.map((row) => row.status))];
  const currencies = [...new Set(rows.map((row) => row.currency))];
  const effectiveFilter = {
    ...filter,
    status: statuses.includes(filter.status) ? filter.status : '',
    currency: currencies.includes(filter.currency) ? filter.currency : '',
  };
  const shown = filterConnectedFinanceRows(rows, effectiveFilter);
  const outstanding = data ? connectedOutstanding(data.contracts) : [];
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">{titles[current]}</h2>
          <p className="panel-note">
            داده‌های این جدول از قراردادها و پرداخت‌های فروش مرتبط با شناسه همین
            سازمان دریافت می‌شوند.
          </p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800">
          منبع زنده فروش
        </Badge>
      </header>
      <div className="panel-body space-y-4">
        {organization ? (
          <OrganizationDocumentsPanel
            key={`${organization.id}:${current}`}
            organization={organization}
            folderLabel={`اسناد مالی ${titles[current]}`}
            toolbar={
              <Button
                size="sm"
                variant="outline"
                aria-label="خروجی Excel ردیف‌های مالی فیلترشده"
                title="خروجی Excel ردیف‌های مالی فیلترشده"
                disabled={loading || invalidRange || !shown.length}
                onClick={() =>
                  downloadOrganizationXlsx(`sales-finance-${current}.xlsx`, [
                    [
                      'سازمان',
                      'منبع',
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
                      'Sales',
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
                <Download aria-hidden="true" className="size-4" /> Excel ردیف‌ها
              </Button>
            }
          />
        ) : null}

        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? (
          <Alert
            title="دریافت داده‌های فروش ناموفق بود"
            description={error}
            tone="warning"
          />
        ) : null}
        {data?.unavailableSources.SALES ? (
          <Alert
            title="داده فروش در دسترس نیست"
            description={data.unavailableSources.SALES}
            tone="warning"
          />
        ) : null}
        {data?.unavailableSources.SALES_PAYMENTS &&
        (current === 'payments' || current === 'checks') ? (
          <Alert
            title="جزئیات پرداخت فروش در دسترس نیست"
            description={data.unavailableSources.SALES_PAYMENTS}
            tone="warning"
          />
        ) : null}

        {!loading && !error && !data?.unavailableSources.SALES ? (
          <>
            {outstanding.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {outstanding.map((item) => (
                  <article
                    key={item.currencyCode}
                    className="rounded-xl border p-4"
                  >
                    <small>مانده قراردادهای فروش</small>
                    <strong className="mt-2 block text-lg">
                      {moneyLabel(item.amount, item.currencyCode)}
                    </strong>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="dossier-filter-grid">
              <label className="field">
                <span>ارز</span>
                <select
                  className="input"
                  value={effectiveFilter.currency}
                  onChange={(event) =>
                    setFilter({ ...filter, currency: event.target.value })
                  }
                >
                  <option value="">همه ارزها</option>
                  {currencies.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>وضعیت</span>
                <select
                  className="input"
                  value={effectiveFilter.status}
                  onChange={(event) =>
                    setFilter({ ...filter, status: event.target.value })
                  }
                >
                  <option value="">همه وضعیت‌ها</option>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>از تاریخ</span>
                <DatePicker
                  aria-label="از تاریخ داده مالی فروش"
                  value={filter.from}
                  onChange={(from) => setFilter({ ...filter, from })}
                />
              </div>
              <div className="field">
                <span>تا تاریخ</span>
                <DatePicker
                  aria-label="تا تاریخ داده مالی فروش"
                  value={filter.to}
                  onChange={(to) => setFilter({ ...filter, to })}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFilter({ currency: '', status: '', from: '', to: '' });
                  refresh();
                }}
              >
                تازه‌سازی و پاک‌کردن فیلترها
              </Button>
            </div>

            {invalidRange ? (
              <p role="alert" className="form-error">
                تاریخ پایان نباید قبل از تاریخ شروع باشد.
              </p>
            ) : null}
            <div className="agreement-table-wrap">
              <table>
                <caption>{titles[current]}</caption>
                <thead>
                  <tr>
                    <th>شناسه</th>
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
                      <td>{formatDate(row.date)}</td>
                      <td>{row.title}</td>
                      <td>{moneyLabel(row.amount, row.currency)}</td>
                      <td>{row.currency}</td>
                      <td>{row.status}</td>
                      <td>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`مشاهده ${row.id}`}
                          title="مشاهده جزئیات"
                          onClick={() => setDetail(row)}
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!shown.length && !invalidRange ? (
              <p role="status" className="empty">
                {data?.unavailableSources.SALES_PAYMENTS &&
                (current === 'payments' || current === 'checks')
                  ? 'به‌دلیل نبود مجوز یا خطای دریافت، نتیجه صفر قابل تأیید نیست.'
                  : 'داده‌ای از ماژول فروش برای این بخش و فیلترها ثبت نشده است.'}
              </p>
            ) : null}
            <p className="panel-note">
              دفترکل، فاکتور رسمی و مغایرت مالی پس از انتشار API عمومی ماژول
              Finance نمایش داده می‌شود؛ این جدول جایگزین ثبت حسابداری نیست.
            </p>
          </>
        ) : null}
      </div>

      {detail ? (
        <Dialog open onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent>
            <DialogTitle>{detail.title}</DialogTitle>
            <DialogDescription>
              داده ثبت‌شده در قرارداد فروش <bdi>{detail.reference}</bdi>
            </DialogDescription>
            <div className="summary-list">
              <p>
                <bdi>{detail.id}</bdi>
              </p>
              <p>مبلغ: {moneyLabel(detail.amount, detail.currency)}</p>
              <p>وضعیت: {detail.status}</p>
              <p>{detail.note}</p>
            </div>
            <Button onClick={() => setDetail(null)}>بستن</Button>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
