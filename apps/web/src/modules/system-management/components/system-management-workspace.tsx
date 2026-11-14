'use client';

import Link from '@/i18n/link';
import { activityActionLabel } from './activity-action-label';
import { History, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  useAccessPermissions,
  useRouteAccess,
} from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
import { systemManagementApi, type SystemActivityPage } from '../api/client';

const sectionLabels: Record<string, string> = {
  iam: 'مدیریت کاربران',
  'system-management': 'مدیریت سیستم',
  workbench: 'میزکار',
  hr: 'منابع انسانی',
  finance: 'مالی',
  sales: 'فروش',
  reservations: 'رزرواسیون',
  procurement: 'خرید و تأمین',
  documents: 'اسناد و فایل‌ها',
  customers: 'مشتریان',
  'customer-affairs': 'امور مشتریان',
  'master-data': 'اطلاعات پایه',
  reporting: 'گزارش‌ها',
  messaging: 'پیام‌رسان',
  notifications: 'اعلان‌ها',
  marketing: 'بازاریابی',
  integrations: 'یکپارچه‌سازی‌ها',
  'legal-entities': 'شرکت‌ها',
  'package-pricing': 'قیمت‌گذاری پکیج',
  b2b: 'مشتریان سازمانی',
  tasks: 'کارها',
};

const dateFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

const cardClass =
  'flex min-w-0 items-center gap-3 rounded-2xl border p-5 text-start font-semibold shadow-sm transition-colors';

export function SystemManagementWorkspace() {
  const routeAllowed = useRouteAccess();
  const permissions = useAccessPermissions();
  const canReadHistory = permissions?.includes('system.audit.read') ?? false;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState<SystemActivityPage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !canReadHistory) return;
    const controller = new AbortController();
    void systemManagementApi.activity(cursor, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setPage(result);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [open, canReadHistory, cursor, revision]);

  function loadPage(nextCursor?: string) {
    setPage(null);
    setFailed(false);
    setCursor(nextCursor);
    setRevision((value) => value + 1);
  }

  return (
    <section className="space-y-5" dir="rtl">
      <h1 className="text-2xl font-bold">مدیریت سیستم</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {routeAllowed('/system/users') && (
          <Link
            className={`${cardClass} border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:hover:bg-blue-900/50`}
            href="/system/users"
          >
            <Users aria-hidden="true" className="size-5 text-primary" />
            مدیریت کاربران
          </Link>
        )}
        {canReadHistory && (
          <button
            type="button"
            className={`${cardClass} border-violet-200 bg-violet-50 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:hover:bg-violet-900/50`}
            aria-expanded={open}
            aria-controls="system-activity"
            onClick={() => {
              if (!open) loadPage();
              setOpen(!open);
            }}
          >
            <History aria-hidden="true" className="size-5 text-primary" />
            تاریخچه
          </button>
        )}
      </div>
      {open && canReadHistory && (
        <section
          id="system-activity"
          className="min-w-0 rounded-2xl border bg-card p-4"
          aria-labelledby="system-activity-title"
        >
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 id="system-activity-title" className="font-semibold">
              تاریخچه
            </h2>
            <Button variant="outline" size="sm" onClick={() => loadPage()}>
              به‌روزرسانی
            </Button>
          </header>
          {failed ? (
            <p role="alert">دریافت تاریخچه انجام نشد. دوباره تلاش کنید.</p>
          ) : !page ? (
            <p role="status">در حال دریافت تاریخچه…</p>
          ) : page.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-muted">
                  <tr>
                    {['کاربر', 'بخش', 'اقدام', 'تاریخ'].map((label) => (
                      <th key={label} scope="col" className="p-3 text-start">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">{item.user}</td>
                      <td className="p-3">
                        {sectionLabels[item.section] ?? item.section}
                      </td>
                      <td className="p-3">
                        {activityActionLabel(item.action)}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        <time dateTime={item.createdAt}>
                          {dateFormat.format(new Date(item.createdAt))}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>فعالیتی برای نمایش وجود ندارد.</p>
          )}
          {page?.nextCursor && (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() => loadPage(page.nextCursor ?? undefined)}
            >
              سوابق قدیمی‌تر
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
