'use client';
import { useState, type ReactNode } from 'react';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { ArrowLeft, ArrowRight, X, ListOrdered, FilterX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { filterNumberingRows } from '../accounting-numbering-filter';
import { accountingApi } from '../api/accounting-api';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/overlays';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
export function AccountingDocumentNumbering({
  book,
  busy,
  run,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriods = book.periods.filter(
    (period) =>
      period.status === 'OPEN' &&
      period.startDate <= today &&
      period.endDate >= today,
  );
  const periodId = currentPeriods.length === 1 ? currentPeriods[0]!.id : '';
  const [step, setStep] = useState<'description' | 'list' | 'end'>(
    'description',
  );
  const [rows, setRows] = useState<AccountingJournalV1[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<
    { id: string; oldNumber: number | null; newNumber: number }[]
  >([]);
  const fetchPreview = async () => {
    setLoading(true);
    setError('');
    try {
      if (!periodId)
        throw new Error('دوره مالی جاری و باز این دفتر تعریف نشده است.');
      const filter = {
        type: 'rule',
        field: 'status',
        operator: 'in',
        values: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'],
      };
      const first = await accountingApi.journals(book.book.id, {
        periodId,
        page: '1',
        pageSize: '50',
        filter: JSON.stringify(filter),
      });
      if (first.total > 500)
        throw new Error('در هر اجرا حداکثر ۵۰۰ سند مجاز است.');
      const all = [...first.items];
      for (let page = 2; all.length < first.total; page++) {
        const next = await accountingApi.journals(book.book.id, {
          periodId,
          page: String(page),
          pageSize: '50',
          filter: JSON.stringify(filter),
        });
        if (next.total !== first.total || !next.items.length)
          throw new Error('فهرست اسناد تغییر کرده است؛ دوباره ادامه را بزنید.');
        all.push(...next.items);
      }
      if (new Set(all.map((row) => row.id)).size !== all.length)
        throw new Error('فهرست اسناد تغییر کرده است؛ دوباره ادامه را بزنید.');
      setRows(all);
      setFilters([]);
      setStep('list');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'خواندن اسناد انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  };
  const number = async () => {
    if (!visibleRows.length || busy || loading) return;
    const response = await run<{ rows: typeof result }>(
      'number-journal-preview',
      {
        periodId,
        selectedOnly: filters.some((value) => value.trim()),
        items: visibleRows.map((row) => ({
          id: row.id,
          expectedVersion: row.version,
        })),
      },
    );
    if (response) {
      setResult(response.rows);
      setStep('end');
    }
  };
  const cancel = () => {
    setRows([]);
    setFilters([]);
    setResult([]);
    setStep('description');
    setError('');
  };
  const action = (
    label: string,
    shortcut: string,
    onClick: () => void,
    icon: ReactNode,
    disabled = false,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          disabled={disabled || loading || busy}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span dir="ltr">({shortcut})</span>
      </TooltipContent>
    </Tooltip>
  );
  const statuses: Record<string, string> = {
    DRAFT: 'موقت',
    PENDING_APPROVAL: 'موقت',
    APPROVED: 'بررسی شده',
    POSTED: 'قطعی',
    CANCELLED: 'حذف شده',
  };
  const columns = [
    'شماره سند',
    'تاریخ',
    'وضعیت',
    'نوع سند',
    'شرح',
    'شماره عطف',
    'شماره فرعی',
    'شماره روزانه',
    'صادر کننده',
  ];
  const cells = (row: AccountingJournalV1) => [
    row.number ?? '',
    row.documentDate ?? '',
    statuses[row.status] ?? row.status,
    book.configurations.find((item) => item.id === row.typeId)?.title ?? '',
    row.description,
    row.reference ?? '',
    String(row.attributes.auxiliaryNumber ?? ''),
    String(row.attributes.dailyNumber ?? ''),
    row.makerName ?? '',
  ];
  const visibleRows = filterNumberingRows(rows, filters, cells);
  return (
    <section
      className="space-y-4"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (
          !event.altKey ||
          busy ||
          loading ||
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLSelectElement
        )
          return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (step === 'description') void fetchPreview();
          else if (step === 'list' && visibleRows.length && !busy && !loading)
            void number();
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          setStep('description');
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
        if (step === 'list' && event.code === 'KeyF' && event.shiftKey) {
          event.preventDefault();
          setFilters([]);
        }
      }}
    >
      <h2 className="text-lg font-bold">شماره گذاری اسناد</h2>
      <ol className="flex flex-wrap gap-3 border-b pb-3 text-sm">
        {['شرح راهبر', 'فیلتر', 'فهرست اسناد', 'پایان عملیات شماره گذاری'].map(
          (title, index) => (
            <li
              key={title}
              aria-current={
                (step === 'description' ? 0 : step === 'list' ? 2 : 3) === index
                  ? 'step'
                  : undefined
              }
              className={
                (step === 'description' ? 0 : step === 'list' ? 2 : 3) === index
                  ? 'font-bold text-primary'
                  : 'text-muted-foreground'
              }
            >
              {index + 1}. {title}
            </li>
          ),
        )}
      </ol>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {step === 'description'
          ? action(
              'ادامه',
              'Alt+ArrowLeft',
              () => void fetchPreview(),
              <ArrowLeft className="size-4" />,
            )
          : null}
        {step === 'list' ? (
          <>
            {action(
              'بازگشت',
              'Alt+ArrowRight',
              () => setStep('description'),
              <ArrowRight className="size-4" />,
            )}
            {action(
              'شماره‌گذاری',
              'Alt+ArrowLeft',
              () => void number(),
              <ListOrdered className="size-4" />,
              !visibleRows.length,
            )}
            {action(
              'حذف فیلتر',
              'Alt+Shift+F',
              () => setFilters([]),
              <FilterX className="size-4" />,
            )}
            {action('انصراف', 'Alt+Escape', cancel, <X className="size-4" />)}
          </>
        ) : null}
        {step === 'end'
          ? action('بستن', 'Alt+Escape', cancel, <X className="size-4" />)
          : null}
      </div>
      {step === 'description' ? (
        <p>
          این راهبر به منظور شماره گذاری اسناد حسابداری در یک دوره زمانی مشخص
          طراحی شده است و شامل نمایش فهرست اسناد قابل شماره گذاری شدن و پایان
          عملیات شماره گذاری می‌باشد.
        </p>
      ) : null}
      {step === 'list' ? (
        <div className="overflow-auto rounded border">
          <table className="w-full min-w-[70rem] text-xs">
            <thead className="bg-muted">
              <tr>
                {columns.map((title) => (
                  <th key={title} className="border p-2 text-right">
                    {title}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((title, index) => (
                  <th key={title} className="border p-1">
                    {index === 2 ? (
                      <select
                        aria-label={`فیلتر ${title}`}
                        className="h-9 w-full rounded border bg-background text-xs"
                        value={filters[index] ?? ''}
                        disabled={busy || loading}
                        onChange={(event) =>
                          setFilters((current) =>
                            columns.map((_, n) =>
                              n === index
                                ? event.target.value
                                : (current[n] ?? ''),
                            ),
                          )
                        }
                      >
                        <option value="">همه</option>
                        <option value="موقت">موقت</option>
                        <option value="بررسی شده">بررسی شده</option>
                      </select>
                    ) : (
                      <Input
                        aria-label={`فیلتر ${title}`}
                        value={filters[index] ?? ''}
                        disabled={busy || loading}
                        onChange={(event) =>
                          setFilters((current) =>
                            columns.map((_, n) =>
                              n === index
                                ? event.target.value
                                : (current[n] ?? ''),
                            ),
                          )
                        }
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {cells(row).map((value, index) => (
                    <td key={index} className="border p-2">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length ? (
            <p className="p-4">سندی برای شماره گذاری وجود ندارد.</p>
          ) : null}
        </div>
      ) : null}
      {step === 'end' ? (
        <p role="status">شماره گذاری {result.length} سند انجام شد.</p>
      ) : null}
    </section>
  );
}
