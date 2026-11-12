'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import Link from '@/i18n/link';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { apiRequest } from '../api/finance-inbox-api';
import { completionJournalHref } from '../accounting-completion-routes';
import { exportAccountingRows } from '../accounting-view-export';
import { AccountingButton as Button } from './accounting-operations';

const axes = [
  ['user', 'کاربر'],
  ['type', 'نوع سند'],
  ['status', 'وضعیت'],
  ['daily', 'روزانه'],
  ['monthly', 'ماهیانه'],
] as const;
const statuses: Record<string, string> = {
  MEMORANDUM: 'ثبت یادداشت',
  DRAFT: 'ثبت موقت',
  PENDING_APPROVAL: 'منتظر تأیید',
  APPROVED: 'بررسی شده',
  POSTED: 'قطعی',
  CANCELLED: 'حذف شده',
};
type Report = {
  historicalGap: boolean;
  rows: {
    key: string;
    title: string | null;
    issued: number;
    issuedLines: number;
    changed: number;
    changedLines: number;
    reviewed: number;
  }[];
  documents: {
    id: string;
    number: number | null;
    documentDate: string | null;
    description: string;
    status: string;
  }[];
  totalDocuments: number;
  page: number;
  pageSize: number;
};
export function AccountingJournalBrowser({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const permissions = useAccessPermissions();
  const can = (permission: string) => !!permissions?.includes(permission);
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [calendar, setCalendar] = useState('PERSIAN');
  const [axis, setAxis] = useState<(typeof axes)[number][0]>('user');
  const [request, setRequest] = useState<{
    filter: string;
    key?: string;
    page: number;
  } | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const [exportError, setExportError] = useState('');
  const filter = new URLSearchParams({
    periodId,
    from,
    to,
    axis,
    calendar,
  }).toString();
  const current = request?.filter === filter;
  const query = useQuery({
    queryKey: ['accounting-journal-browser', book.book.id, request],
    enabled: !!request && current,
    retry: false,
    queryFn: () =>
      apiRequest<Report>(
        `/finance/accounting/books/${book.book.id}/completion/journal-browser?${request!.filter}&${new URLSearchParams({ page: String(request!.page), ...(request!.key !== undefined ? { selectedKey: request!.key } : {}) })}`,
      ),
  });
  const report =
    current && !query.isFetching && !query.isError ? query.data : undefined;
  const load = () => {
    setGroupPage(1);
    setExportError('');
    if (current && request?.key === undefined) void query.refetch();
    else setRequest({ filter, page: 1 });
  };
  const exportReport = async (format: 'xlsx' | 'pdf') => {
    if (!can('finance.export') || !report) return;
    try {
      await exportAccountingRows(
        [
          ['مرور اسناد', book.book.title],
          ...(report.historicalGap
            ? [
                [
                  'تاریخچهٔ کامل برخی اسناد قدیمی موجود نیست؛ شمارش تغییرات و بررسی‌ها فقط بر اساس سوابق ثبت‌شده است.',
                ],
              ]
            : []),
          [
            'از تاریخ',
            from ||
              book.periods.find((p) => p.id === periodId)?.startDate ||
              '',
            'تا تاریخ',
            to || book.periods.find((p) => p.id === periodId)?.endDate || '',
          ],
          [
            'عنوان',
            'تعداد اسناد صادر شده',
            'تعداد ردیف های اسناد صادر شده',
            'تعداد اسناد تغییر یافته',
            'تعداد ردیف های اسناد تغییر یافته',
            'تعداد اسناد بررسی شده',
          ],
          ...report.rows.map((row) => [
            label(row),
            ...[
              row.issued,
              row.issuedLines,
              row.changed,
              row.changedLines,
              row.reviewed,
            ].map(String),
          ]),
        ],
        format,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'دریافت خروجی ناموفق بود.',
      );
    }
  };
  const label = (row: Report['rows'][number]) =>
    axis === 'status' ? (statuses[row.key] ?? row.key) : row.title || 'نامشخص';
  return (
    <section dir="rtl" className="space-y-4">
      <h2 className="text-lg font-black">مرور اسناد</h2>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          load();
        }}
      >
        <FormField label="دوره مالی">
          <SearchCombobox
            label="دوره مالی"
            value={periodId}
            onValueChange={setPeriod}
            options={book.periods.map((period) => ({
              value: period.id,
              label:
                book.configurations.find(
                  (row) => row.id === period.fiscalYearId,
                )?.title ?? period.startDate,
            }))}
          />
        </FormField>
        <FormField label="تقویم">
          <SearchCombobox
            label="تقویم"
            value={calendar}
            onValueChange={setCalendar}
            options={[
              { value: 'PERSIAN', label: 'شمسی' },
              { value: 'GREGORIAN', label: 'میلادی' },
            ]}
          />
        </FormField>
        <FormField label="از تاریخ">
          <DatePicker aria-label="از تاریخ" value={from} onChange={setFrom} />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker aria-label="تا تاریخ" value={to} onChange={setTo} />
        </FormField>
        <Button type="submit" disabled={!periodId || query.isFetching}>
          فیلتر مجدد
        </Button>
      </form>
      <div
        role="tablist"
        aria-label="مرور اسناد"
        className="flex flex-wrap border-b"
      >
        {axes.map(([value, title]) => (
          <button
            type="button"
            role="tab"
            aria-selected={axis === value}
            key={value}
            className="px-4 py-2 aria-selected:border-b-2 aria-selected:border-primary"
            onClick={() => {
              setAxis(value);
              setGroupPage(1);
              if (request)
                setRequest({
                  filter: new URLSearchParams({
                    periodId,
                    from,
                    to,
                    axis: value,
                    calendar,
                  }).toString(),
                  page: 1,
                });
            }}
          >
            {title}
          </button>
        ))}
      </div>
      {query.isFetching && <p role="status">در حال دریافت اطلاعات…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {exportError && <p role="alert">{exportError}</p>}
      {report && (
        <>
          <p className="text-sm text-muted-foreground">
            تعداد اسناد به‌صورت یکتا و تعداد ردیف‌ها بر مبنای آخرین نسخهٔ
            ذخیره‌شده است.
          </p>
          {report.historicalGap && (
            <p role="status">
              تاریخچهٔ کامل برخی اسناد قدیمی موجود نیست؛ شمارش تغییرات و
              بررسی‌ها فقط بر اساس سوابق ثبت‌شده است.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!can('finance.export')}
              onClick={() => void exportReport('pdf')}
            >
              چاپ
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!can('finance.export')}
              onClick={() => void exportReport('xlsx')}
            >
              خروجی اکسل
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[
                    axes.find(([value]) => value === axis)![1],
                    'تعداد اسناد صادر شده',
                    'تعداد ردیف های اسناد صادر شده',
                    'تعداد اسناد تغییر یافته',
                    'تعداد ردیف های اسناد تغییر یافته',
                    'تعداد اسناد بررسی شده',
                    'مشاهده اسناد',
                  ].map((title) => (
                    <th className="border p-2" key={title}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows
                  .slice((groupPage - 1) * 50, groupPage * 50)
                  .map((row) => (
                    <tr key={row.key} aria-selected={request?.key === row.key}>
                      <td className="border p-2">{label(row)}</td>
                      {[
                        row.issued,
                        row.issuedLines,
                        row.changed,
                        row.changedLines,
                        row.reviewed,
                      ].map((count, index) => (
                        <td className="border p-2" key={index}>
                          {count}
                        </td>
                      ))}
                      <td className="border p-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setRequest({ filter, key: row.key, page: 1 })
                          }
                        >
                          مشاهده اسناد
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!report.rows.length && (
              <p role="status">سطری برای نمایش وجود ندارد.</p>
            )}
          </div>
          {report.rows.length > 50 && (
            <nav className="flex gap-2">
              <Button
                disabled={groupPage === 1}
                onClick={() => setGroupPage((page) => page - 1)}
              >
                قبلی
              </Button>
              <span>{groupPage}</span>
              <Button
                disabled={groupPage * 50 >= report.rows.length}
                onClick={() => setGroupPage((page) => page + 1)}
              >
                بعدی
              </Button>
            </nav>
          )}
          {request?.key !== undefined && (
            <section className="space-y-2" aria-label="اسناد انتخاب‌شده">
              <h3 className="font-bold">اسناد انتخاب‌شده</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['شماره سند', 'تاریخ', 'وضعیت', 'شرح'].map((title) => (
                      <th key={title} className="border p-2">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.documents.map((document) => (
                    <tr key={document.id}>
                      <td className="border p-2">
                        <Link
                          href={completionJournalHref(
                            book.book.id,
                            document.id,
                          )}
                        >
                          {document.number ?? 'مشاهده سند'}
                        </Link>
                      </td>
                      <td className="border p-2">{document.documentDate}</td>
                      <td className="border p-2">
                        {statuses[document.status] ?? document.status}
                      </td>
                      <td className="border p-2">{document.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <nav className="flex gap-2">
                <Button
                  disabled={report.page === 1}
                  onClick={() =>
                    setRequest({ ...request, page: report.page - 1 })
                  }
                >
                  قبلی
                </Button>
                <span>{report.totalDocuments}</span>
                <Button
                  disabled={
                    report.page * report.pageSize >= report.totalDocuments
                  }
                  onClick={() =>
                    setRequest({ ...request, page: report.page + 1 })
                  }
                >
                  بعدی
                </Button>
              </nav>
            </section>
          )}
        </>
      )}
    </section>
  );
}
