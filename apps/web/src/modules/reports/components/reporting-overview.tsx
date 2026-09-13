import {
  ArrowLeft,
  BarChart3,
  Download,
  History,
} from 'lucide-react';
import Link from 'next/link';

import { reportCatalog } from '../model/reporting';
import { reportingViewHref, type ReportingView } from '../model/navigation';

export function ReportingOverview() {
  const connected = reportCatalog.filter(
    (report) => report.availability === 'READY',
  ).length;
  const pending = reportCatalog.length - connected;
  const number = (value: number) => value.toLocaleString('fa-IR');
  const cards = [
    {
      view: 'catalog' as ReportingView,
      icon: BarChart3,
      label: 'گزارش‌های متصل',
      value: `${number(connected)} از ${number(reportCatalog.length)}`,
      detail: `${number(pending)} گزارش در انتظار اتصال`,
      action: 'مشاهده کاتالوگ',
      hint: 'براساس اتصال‌های ثبت‌شده در کاتالوگ؛ سلامت لحظه‌ای سرور و مجوز اجرای هر گزارش جداگانه بررسی می‌شوند.',
    },
    {
      view: 'recent' as ReportingView,
      icon: History,
      label: 'اجراهای امروز',
      value: 'مشاهده تاریخچه',
      detail: 'اجرای موفق، ناموفق و در حال اجرا',
      action: 'مشاهده اجراها',
      hint: 'تاریخچه واقعی اجراها، مدت و تعداد رکورد از پایگاه داده دریافت می‌شود.',
    },
    {
      view: 'downloads' as ReportingView,
      icon: Download,
      label: 'وضعیت خروجی‌ها',
      value: 'مرکز خروجی',
      detail: 'آماده، در حال تولید، ناموفق و منقضی',
      action: 'مشاهده خروجی‌ها',
      hint: 'فایل‌های واقعی تولیدشده و وضعیت دانلود یا تلاش مجدد نمایش داده می‌شوند.',
    },
  ];

  return (
    <section
      aria-label="خلاصه گزارش‌ها"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {cards.map(({ view, icon: Icon, label, value, detail, action, hint }) => (
        <Link
          key={view}
          href={reportingViewHref(view)}
          scroll={false}
          title={hint}
          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Icon
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-xs text-muted-foreground">{label}</h2>
            <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {detail}
            </p>
            <span className="sr-only">
              {action}. {hint}
            </span>
          </div>
          <ArrowLeft
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
          />
        </Link>
      ))}
    </section>
  );
}
