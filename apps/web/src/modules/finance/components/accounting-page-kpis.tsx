'use client';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { BarChart3, CheckCircle2, Clock3, Layers3 } from 'lucide-react';
import { accountingApi } from '../api/accounting-api';
import { accountingTaxApi } from '../api/accounting-tax-api';
import { accountingTaxpayerApi } from '../api/accounting-taxpayer-api';
import { accountingTaxRoute } from '../accounting-tax-model';
import {
  accountingSnapshotKpis,
  type AccountingPageKpi,
} from '../accounting-page-kpis';
import styles from './accounting-navigation-workspace.module.css';

const icons = [Layers3, CheckCircle2, BarChart3, Clock3];
const number = new Intl.NumberFormat('fa-IR');

/** Read-only summaries share the existing query cache and never submit a command. */
export function AccountingPageKpis({ pathname }: { pathname: string }) {
  const requestedBook = useSearchParams().get('bookId');
  const route = pathname.replace(/^\/finance\/accounting\/?/, '');
  const books = useQuery({
    queryKey: ['accounting', 'books'],
    queryFn: accountingApi.books,
  });
  const bookId =
    books.data?.books.find((b) => b.id === requestedBook)?.id ||
    books.data?.books[0]?.id ||
    '';
  const snapshot = useQuery({
    queryKey: ['accounting', 'snapshot', bookId],
    queryFn: () => accountingApi.snapshot(bookId),
    enabled: !!bookId,
  });
  const tax = accountingTaxRoute(route);
  const taxpayer = route.startsWith('taxpayer-system/');
  const sellerPage = route.endsWith('/seller-information');
  const documents =
    route.startsWith('general-ledger/') &&
    (route.includes('/documents') || route.includes('/reports')) &&
    !route.includes('templates') &&
    !route.endsWith('/chart-structure');
  const totals = useQueries({
    queries: ['', 'DRAFT', 'APPROVED', 'POSTED'].map((status) => ({
      queryKey: ['accounting', 'kpi-journals', bookId, status],
      queryFn: () =>
        accountingApi.journals(bookId, {
          page: '1',
          pageSize: '30',
          ...(status ? { status } : {}),
        }),
      enabled: !!snapshot.data && documents,
      retry: false,
    })),
  });
  const taxRecords = useQuery({
    queryKey: ['accounting-tax', bookId, tax?.form.key],
    queryFn: () => accountingTaxApi.list(bookId, tax!.form.key),
    enabled: !!snapshot.data && !!tax?.form.writable,
    retry: false,
  });
  const seller = useQuery({
    queryKey: ['accounting-taxpayer-seller', bookId],
    queryFn: () => accountingTaxpayerApi.seller(bookId),
    enabled: !!snapshot.data && sellerPage,
    retry: false,
  });
  let items: AccountingPageKpi[] = accountingSnapshotKpis(
    route,
    snapshot.data,
    books.data?.books,
  );
  let loading = books.isPending || (!!bookId && snapshot.isPending);
  let unavailable = books.isError || snapshot.isError;
  let note = bookId
    ? 'کل دفتر؛ مستقل از فیلترهای فرم'
    : 'دفتر حسابداری انتخاب نشده است';
  if (route.split('/').at(-1) === 'ledgers') note = 'دفاتر کل';
  if (documents) {
    items = ['کل اسناد', 'پیش‌نویس', 'تأییدشده', 'قطعی'].map((label, i) => ({
      label,
      value: totals[i]?.data?.total ?? null,
    }));
    loading = loading || totals.some((q) => q.isFetching && !q.data);
    unavailable = unavailable || totals.some((q) => q.isError);
  } else if (tax) {
    const rows = taxRecords.data?.items;
    const required = tax.form.fields.filter(
      (f) => f.required && !f.disabled && !f.readOnly,
    );
    const complete = rows?.filter((r) =>
      required.every((f) => {
        if (f.dependsOn && r.values[f.dependsOn] !== f.dependsValue)
          return true;
        const value = r.values[f.key];
        return (
          typeof value === 'boolean' ||
          (Array.isArray(value)
            ? value.length > 0
            : typeof value === 'string' && value.trim().length > 0)
        );
      }),
    ).length;
    const values = rows
      ? [
          rows.length,
          complete!,
          rows.length - complete!,
          rows.filter((r) => r.version > 1).length,
        ]
      : undefined;
    items = [
      'رکوردهای ثبت‌شده',
      'رکوردهای دارای فیلدهای الزامی',
      'نیازمند تکمیل',
      'رکوردهای ویرایش‌شده',
    ].map((label, i) => ({
      label,
      value: taxRecords.data?.truncated ? null : (values?.[i] ?? null),
    }));
    loading =
      loading ||
      (!!tax.form.writable && taxRecords.isPending && !!snapshot.data);
    unavailable = unavailable || taxRecords.isError || !tax.form.writable;
    if (taxRecords.data?.truncated)
      note = 'داده محدود شده است؛ جمع کل قابل محاسبه نیست';
  } else if (taxpayer) {
    const values = seller.data?.values;
    const labels = sellerPage
      ? [
          'اطلاعات فروشنده',
          'شناسه ملی / کد ملی',
          'شماره اقتصادی',
          'شناسه مشارکت مدنی',
        ]
      : route.includes('schedule')
        ? [
            'برنامه‌های ثبت‌شده',
            'برنامه‌های فعال',
            'اجرای موفق',
            'اجرای ناموفق',
          ]
        : route.includes('settings')
          ? [
              'درخواست‌های اتصال',
              'اتصال‌های فعال',
              'در انتظار اتصال',
              'اتصال ناموفق',
            ]
          : ['صورتحساب‌ها', 'ارسال‌شده', 'در انتظار ارسال', 'نیازمند بررسی'];
    items = labels.map((label, i) => ({
      label,
      value:
        sellerPage && seller.data !== undefined
          ? ([
              seller.data ? 1 : 0,
              values?.fvwMain_txtNationalID.trim() ? 1 : 0,
              values?.fvwMain_txtEconomicID.trim() ? 1 : 0,
              values?.fvwMain_txtCivilParticipationID.trim() ? 1 : 0,
            ][i] ?? null)
          : null,
    }));
    loading = loading || (sellerPage && seller.isPending && !!snapshot.data);
    unavailable = unavailable || seller.isError || !sellerPage;
    if (sellerPage)
      note = 'شناسه‌های ثبت‌شده فروشنده؛ به معنی تأیید سامانه مودیان نیست';
  }
  if (unavailable) note = 'داده این شاخص‌ها از سرویس فعلی قابل دریافت نیست';
  if (route.startsWith('receipts-payments/'))
    note = 'داده عملیاتی این بخش از سرویس فعلی قابل دریافت نیست';
  if (route.startsWith('tax-accounting/') && !tax)
    note = 'داده عملیاتی این بخش از سرویس فعلی قابل دریافت نیست';
  return (
    <section
      aria-label="شاخص‌های صفحه حسابداری"
      className={styles.kpiSection}
      data-accounting-page-kpis
      aria-busy={loading}
    >
      <div className={styles.kpiGrid}>
        {items.map((item, index) => {
          const Icon = icons[index]!;
          return (
            <article className={styles.kpiCard} key={item.label}>
              <div className={styles.kpiIcon}>
                <Icon aria-hidden="true" size={20} />
              </div>
              <div className={styles.kpiBody}>
                <h2>{item.label}</h2>
                <p>
                  {loading && item.value === null
                    ? '…'
                    : item.value === null
                      ? '—'
                      : number.format(item.value)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <p className={styles.kpiNote}>
        {loading ? 'در حال دریافت شاخص‌ها…' : note}
      </p>
    </section>
  );
}
