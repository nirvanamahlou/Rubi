'use client';
import { Fragment, useEffect, useState } from 'react';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import {
  Filter,
  Send,
  SendToBack,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  FilterX,
  Layers,
} from 'lucide-react';
import Link from '@/i18n/link';
import { Input, FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import {
  DocumentIconAction,
  type DocumentRule,
} from './accounting-document-filter';
import { journalDisplayTotals } from '../accounting-money';
import { exportAccountingRows } from '../accounting-view-export';
import { compareDocumentText } from '../accounting-document-sort';
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Preview = {
  items: (AccountingJournalV1 & { typeTitle: string })[];
  checksum: string;
};
const columns = [
  ['isCurrency', 'سند ارزی'],
  ['number', 'شماره سند'],
  ['documentDate', 'تاریخ'],
  ['status', 'وضعیت'],
  ['typeId', 'نوع سند'],
  ['description', 'شرح'],
  ['reference', 'شماره عطف'],
  ['auxiliaryNumber', 'شماره فرعی'],
  ['amount', 'مبلغ سند'],
] as const;
type ColumnKey = (typeof columns)[number][0];
export function AccountingDocumentTransfer({
  book,
  busy,
  run,
  canCreate,
  canExport,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
  canCreate: boolean;
  canExport: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriods = book.periods.filter(
    (period) =>
      period.status === 'OPEN' &&
      period.startDate <= today &&
      period.endDate >= today,
  );
  const period = currentPeriods.length === 1 ? currentPeriods[0] : undefined;
  const [head, setHead] = useState({
    filterMode: 'date',
    fromDate: period?.startDate ?? '',
    toDate: today,
    fromNumber: '',
    toNumber: '',
    aggregate: false,
    dateMode: 'source',
    documentDate: '',
  });
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<ColumnKey[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showGroups, setShowGroups] = useState(false);
  const [groupBy, setGroupBy] = useState<ColumnKey | ''>('');
  const [sort, setSort] = useState<ColumnKey>('number');
  const [descending, setDescending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportFile, setExportFile] = useState<{
    url: string;
    name: string;
  } | null>(null);
  useEffect(
    () => () => {
      if (exportFile) URL.revokeObjectURL(exportFile.url);
    },
    [exportFile],
  );
  const [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [multi, setMulti] = useState(true),
    [count, setCount] = useState(false);
  const [result, setResult] = useState<{
    items: { bookId: string; journal: AccountingJournalV1 }[];
  } | null>(null);
  const payload = () => ({
    periodId: period?.id,
    ...head,
    filter: {
      type: 'group',
      mode: 'all',
      children: Object.entries(filters)
        .filter(([, value]) => value)
        .map(([field, value]): DocumentRule => ({
          type: 'rule',
          field,
          operator: field === 'description' ? 'contains' : 'equals',
          value,
        })),
    },
  });
  const load = async () => {
    const read = await run<Preview>('document-transfer-preview', payload());
    if (read) {
      setPreview(read);
      setPage(1);
      setSelected([]);
    }
  };
  const send = async (all: boolean) => {
    if (!preview) return;
    const input = { ...payload(), ...(all ? {} : { ids: selected }) };
    const fresh = await run<Preview>('document-transfer-preview', input);
    if (!fresh) return;
    const received = await run<{
      items: { bookId: string; journal: AccountingJournalV1 }[];
    }>('document-transfer-run', {
      ...input,
      checksum: fresh.checksum,
      basisChecksum: preview.checksum,
    });
    if (received) {
      setResult(received);
      await load();
    }
  };
  const items = preview?.items ?? [];
  const cell = (row: Preview['items'][number], key: string) =>
    key === 'isCurrency'
      ? row.lines.some(
          (line) =>
            book.accounts.find((account) => account.id === line.accountId)
              ?.attributes.multiCurrency === true,
        )
        ? 'بله'
        : 'خیر'
      : key === 'status'
        ? row.status === 'POSTED'
          ? 'قطعی'
          : 'بررسی شده'
        : key === 'amount'
          ? journalDisplayTotals(row.lines).debit
          : key === 'typeId'
            ? row.typeTitle
            : key === 'auxiliaryNumber'
              ? String(row.attributes.auxiliaryNumber ?? '')
              : String(row[key as keyof AccountingJournalV1] ?? '');
  const ordered = [...items].sort((a, b) => {
    const order = (key: ColumnKey) =>
      compareDocumentText(
        cell(a, key),
        cell(b, key),
        ['number', 'reference', 'auxiliaryNumber', 'amount'].includes(key),
      );
    return (
      (groupBy ? order(groupBy) : 0) ||
      order(sort) * (descending ? -1 : 1) ||
      a.id.localeCompare(b.id)
    );
  });
  const rows = ordered.slice((page - 1) * 50, page * 50);
  const visible = columns.filter(([key]) => !hidden.includes(key));
  const choose = (id: string) =>
    setSelected((current) =>
      multi
        ? current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        : [id],
    );
  const output = async (format: 'xlsx' | 'pdf') => {
    if (busy || exporting || !canExport || !items.length) return;
    setExporting(true);
    setExportError('');
    try {
      setExportFile(
        await exportAccountingRows(
          [
            ['ارسال سند به دفترکل فرعی'],
            visible.map(([, label]) => label),
            ...ordered.map((row) => visible.map(([key]) => cell(row, key))),
          ],
          format,
        ),
      );
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : 'خروجی ساخته نشد.',
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="space-y-4" data-document-shortcut-scope>
      <div className="flex justify-end gap-2">
        <DocumentIconAction
          label="فیلتر"
          shortcut="Alt+F"
          disabled={busy || !period}
          onClick={() => void load()}
        >
          <Filter size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ارسال"
          shortcut="Alt+S"
          disabled={busy || !canCreate || !selected.length}
          onClick={() => void send(false)}
        >
          <Send size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ارسال همه"
          shortcut="Alt+Shift+S"
          disabled={busy || !canCreate || !items.length}
          onClick={() => void send(true)}
        >
          <SendToBack size={16} />
        </DocumentIconAction>
      </div>
      <fieldset className="rounded border p-4">
        <legend>انتخاب اسناد</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="فیلتر">
            <select
              className="w-full rounded border p-2"
              value={head.filterMode}
              onChange={(event) =>
                setHead((current) => ({
                  ...current,
                  filterMode: event.target.value,
                }))
              }
            >
              <option value="date">تاریخ</option>
              <option value="number">شماره سند</option>
            </select>
          </FormField>
          {head.filterMode === 'date' ? (
            <>
              <FormField label="از تاریخ *">
                <DatePicker
                  value={head.fromDate}
                  onChange={(value) =>
                    setHead((current) => ({ ...current, fromDate: value }))
                  }
                />
              </FormField>
              <FormField label="تا تاریخ *">
                <DatePicker
                  value={head.toDate}
                  onChange={(value) =>
                    setHead((current) => ({ ...current, toDate: value }))
                  }
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="از شماره سند *">
                <Input
                  value={head.fromNumber}
                  inputMode="numeric"
                  onChange={(event) =>
                    setHead((current) => ({
                      ...current,
                      fromNumber: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="تا شماره سند *">
                <Input
                  value={head.toNumber}
                  inputMode="numeric"
                  onChange={(event) =>
                    setHead((current) => ({
                      ...current,
                      toNumber: event.target.value,
                    }))
                  }
                />
              </FormField>
            </>
          )}
        </div>
      </fieldset>
      <fieldset className="rounded border p-4">
        <legend>تنظیمات اسناد ارسالی</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={head.aggregate}
              onChange={(event) =>
                setHead((current) => ({
                  ...current,
                  aggregate: event.target.checked,
                }))
              }
            />
            ارسال تجمیعی
          </label>
          <FormField label="تاریخ اسناد ارسالی *">
            <select
              className="w-full rounded border p-2"
              value={head.dateMode}
              onChange={(event) =>
                setHead((current) => ({
                  ...current,
                  dateMode: event.target.value,
                }))
              }
            >
              <option value="source">تاریخ اسناد مبدا</option>
              <option value="custom">تاریخ مورد نظر</option>
            </select>
          </FormField>
          <FormField label="تاریخ *">
            <DatePicker
              value={head.documentDate}
              disabled={head.dateMode !== 'custom'}
              onChange={(value) =>
                setHead((current) => ({ ...current, documentDate: value }))
              }
            />
          </FormField>
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <DocumentIconAction
          label="بارگذاری مجدد"
          shortcut="Alt+R"
          disabled={busy || !period}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="انتخاب چند رکوردی"
          shortcut="Alt+M"
          disabled={busy}
          onClick={() => {
            setMulti((value) => !value);
            setSelected([]);
          }}
        >
          <ListChecks size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="محاسبه تعداد رکوردها و صفحات فهرست"
          shortcut="Alt+K"
          onClick={() => setCount((value) => !value)}
        >
          <Calculator size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی اکسل"
          shortcut="Alt+E"
          disabled={busy || exporting || !items.length || !canExport}
          onClick={() => void output('xlsx')}
        >
          <FileSpreadsheet size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی پی دی اف"
          shortcut="Alt+P"
          disabled={busy || exporting || !items.length || !canExport}
          onClick={() => void output('pdf')}
        >
          <FileText size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ستون ها"
          shortcut="Alt+C"
          onClick={() => setShowColumns((value) => !value)}
        >
          <Columns3 size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="گروه بندی"
          shortcut="Alt+G"
          onClick={() => setShowGroups((value) => !value)}
        >
          <Layers size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label={showFilters ? 'عدم نمایش فیلتر' : 'نمایش فیلتر'}
          shortcut="Alt+Shift+F"
          onClick={() => setShowFilters((value) => !value)}
        >
          <Filter size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="حذف فیلتر"
          shortcut="Alt+X"
          disabled={busy}
          onClick={() => {
            setFilters({});
            setPreview(null);
            setSelected([]);
            setPage(1);
          }}
        >
          <FilterX size={16} />
        </DocumentIconAction>
      </div>
      {showColumns ? (
        <div className="flex flex-wrap gap-3 rounded border p-2">
          {columns.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={!hidden.includes(key)}
                disabled={!hidden.includes(key) && visible.length === 1}
                onChange={(event) =>
                  setHidden((current) =>
                    event.target.checked
                      ? current.filter((value) => value !== key)
                      : [...current, key],
                  )
                }
              />{' '}
              {label}
            </label>
          ))}
        </div>
      ) : null}
      {showGroups ? (
        <label className="flex items-center gap-2 text-sm">
          گروه بندی
          <select
            className="rounded border p-2"
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value as ColumnKey | '');
              setPage(1);
            }}
          >
            <option value="">—</option>
            {columns.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {exportError ? (
        <p role="alert" className="text-destructive">
          {exportError}
        </p>
      ) : null}
      {exportFile ? (
        <a
          className="text-primary underline"
          href={exportFile.url}
          download={exportFile.name}
        >
          دریافت {exportFile.name}
        </a>
      ) : null}
      <div className="overflow-auto min-h-80 border rounded">
        <table className="w-full text-xs" dir="rtl">
          <thead>
            <tr className="bg-primary/10">
              <th>
                {multi ? (
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه رکوردهای صفحه"
                    checked={
                      !!rows.length &&
                      rows.every((row) => selected.includes(row.id))
                    }
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [
                              ...new Set([
                                ...current,
                                ...rows.map((row) => row.id),
                              ]),
                            ]
                          : current.filter(
                              (id) => !rows.some((row) => row.id === id),
                            ),
                      )
                    }
                  />
                ) : null}
              </th>
              {visible.map(([key, label]) => (
                <th key={key} className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setDescending(sort === key ? !descending : false);
                      setSort(key);
                      setPage(1);
                    }}
                  >
                    {label}
                    {sort === key ? (descending ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
            <tr hidden={!showFilters}>
              <th />
              {visible.map(([key, label]) => (
                <th key={key} className="p-1">
                  {['status', 'isCurrency', 'typeId'].includes(key) ? (
                    <select
                      aria-label={`فیلتر ${label}`}
                      className="w-full border rounded p-2"
                      value={filters[key] ?? ''}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">همه</option>
                      {(key === 'isCurrency'
                        ? [
                            { value: 'true', label: 'بله' },
                            { value: 'false', label: 'خیر' },
                          ]
                        : key === 'status'
                          ? [
                              { value: 'APPROVED', label: 'بررسی شده' },
                              { value: 'POSTED', label: 'قطعی' },
                            ]
                          : book.configurations
                              .filter(
                                (item) =>
                                  item.kind === 'voucher-types' && item.active,
                              )
                              .map((item) => ({
                                value: item.id,
                                label: item.title,
                              }))
                      ).map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  ) : key === 'documentDate' ? (
                    <DatePicker
                      value={filters[key] ?? ''}
                      onChange={(value) =>
                        setFilters((current) => ({ ...current, [key]: value }))
                      }
                    />
                  ) : (
                    <Input
                      aria-label={`فیلتر ${label}`}
                      value={filters[key] ?? ''}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                {groupBy &&
                (index === 0 ||
                  cell(rows[index - 1]!, groupBy) !== cell(row, groupBy)) ? (
                  <tr className="bg-muted/50">
                    <th colSpan={visible.length + 1} className="p-2 text-right">
                      {columns.find(([key]) => key === groupBy)?.[1]}:{' '}
                      {cell(row, groupBy) || '—'} ·{' '}
                      {
                        items.filter(
                          (item) => cell(item, groupBy) === cell(row, groupBy),
                        ).length
                      }{' '}
                      رکورد
                    </th>
                  </tr>
                ) : null}
                <tr
                  key={row.id}
                  tabIndex={0}
                  aria-selected={selected.includes(row.id)}
                  className={`border-t cursor-pointer ${selected.includes(row.id) ? 'bg-primary/10' : ''}`}
                  onClick={() => choose(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === ' ') {
                      event.preventDefault();
                      choose(row.id);
                    }
                  }}
                >
                  <td className="p-2">
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name="transfer-row"
                      aria-label={`انتخاب سند ${row.number}`}
                      checked={selected.includes(row.id)}
                      onChange={() => choose(row.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  {visible.map(([key]) => (
                    <td key={key} className="p-2">
                      {cell(row, key)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={visible.length + 1}
                  className="p-6 text-center text-muted-foreground"
                >
                  سطری برای نمایش وجود ندارد.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <DocumentIconAction
          label="صفحه اول"
          shortcut="Alt+Home"
          disabled={page <= 1}
          onClick={() => setPage(1)}
        >
          <ChevronsRight size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه قبلی"
          shortcut="Alt+Left"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          <ChevronRight size={16} />
        </DocumentIconAction>
        <span>صفحه {page}</span>
        <DocumentIconAction
          label="صفحه بعدی"
          shortcut="Alt+Right"
          disabled={page * 50 >= items.length}
          onClick={() => setPage((value) => value + 1)}
        >
          <ChevronLeft size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه آخر"
          shortcut="Alt+End"
          disabled={page * 50 >= items.length}
          onClick={() => setPage(Math.max(1, Math.ceil(items.length / 50)))}
        >
          <ChevronsLeft size={16} />
        </DocumentIconAction>
        {count ? (
          <span>
            {items.length} رکورد، {Math.ceil(items.length / 50)} صفحه
          </span>
        ) : null}
      </div>
      {result?.items.map((item) => (
        <Link
          key={item.journal.id}
          className="block text-primary underline"
          href={`/finance/accounting/general-ledger/documents/journals?bookId=${item.bookId}&journalId=${item.journal.id}`}
        >
          سند ارسالی {item.journal.number}
        </Link>
      ))}
    </section>
  );
}
