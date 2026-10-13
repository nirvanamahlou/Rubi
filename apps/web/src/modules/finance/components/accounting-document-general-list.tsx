'use client';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import {
  Plus,
  Pencil,
  Save,
  FilterX,
  ListChecks,
  Calculator,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ChevronsLeft,
  ChevronsRight,
  Group,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import {
  DocumentIconAction,
  AccountingDocumentFilter,
  emptyDocumentFilter,
} from './accounting-document-filter';
import { accountingApi } from '../api/accounting-api';
import { exportAccountingRows } from '../accounting-view-export';

type Row = {
  id: string;
  number: number;
  documentDate: string;
  amount: string;
  makerName: string;
  makerId: string;
  version: number;
};
type Result = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  groups: { key: string; count: number; amount: string }[];
};
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
const columns = [
  ['number', 'شماره'],
  ['documentDate', 'تاریخ'],
  ['amount', 'مبلغ'],
  ['makerId', 'صادر کننده'],
] as const;
export function AccountingDocumentGeneralList({
  book,
  busy,
  run,
  canPost,
  canExport,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
  canPost: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1),
    [sort, setSort] = useState('number'),
    [direction, setDirection] = useState('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showColumns, setShowColumns] = useState(false),
    [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [showGrouping, setShowGrouping] = useState(false),
    [groupBy, setGroupBy] = useState('');
  const visibleColumns = columns.filter(
    ([key]) => !hiddenColumns.includes(key),
  );
  const [advanced, setAdvanced] = useState(emptyDocumentFilter),
    [applied, setApplied] = useState(emptyDocumentFilter);
  const [multi, setMulti] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [count, setCount] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null),
    [date, setDate] = useState('');
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState('');
  const filter = JSON.stringify({
    type: 'group',
    mode: 'all',
    children: [
      applied,
      ...Object.entries(filters)
        .filter(([, value]) => value)
        .map(([field, value]) => ({
          type: 'rule',
          field,
          operator: 'equals',
          value,
        })),
    ],
  });
  const result = useQuery({
    queryKey: [
      'accounting-general-list',
      book.book.id,
      page,
      sort,
      direction,
      filter,
      groupBy,
    ],
    queryFn: () =>
      accountingApi.analytical<Result>(book.book.id, 'general-document-list', {
        page: String(page),
        sort,
        direction,
        filter,
        groupBy,
      }),
  });
  const actors = useQuery({
    queryKey: ['accounting-filter-options', book.book.id],
    queryFn: () =>
      accountingApi.analytical<{ actors: { value: string; label: string }[] }>(
        book.book.id,
        'document-filter-options',
        {},
      ),
  });
  const rows = result.data?.rows ?? [];
  const choose = (row: Row) =>
    setSelected((current) =>
      multi
        ? current.includes(row.id)
          ? current.filter((id) => id !== row.id)
          : [...current, row.id]
        : [row.id],
    );
  const open = (row: Row) => {
    setEditing(row);
    setDate(row.documentDate);
  };
  const save = async () => {
    if (!editing) return;
    const updated = await run<{ id: string }>(
      'general-document-date',
      { id: editing.id, documentDate: date },
      editing.version,
    );
    if (updated) {
      setEditing(null);
      await result.refetch();
    }
  };
  const exportRows = async (format: 'xlsx' | 'pdf') => {
    if (!canExport || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const exported = await accountingApi.analytical<Result>(
        book.book.id,
        'general-document-list',
        { export: 'true', sort, direction, filter, groupBy },
      );
      await exportAccountingRows(
        [
          visibleColumns.map(([, label]) => label),
          ...exported.rows.map((row) =>
            visibleColumns.map(([key]) =>
              key === 'makerId' ? row.makerName : String(row[key]),
            ),
          ),
        ],
        format,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'خروجی انجام نشد.',
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="space-y-3" data-document-shortcut-scope>
      {exportError ? (
        <p role="alert" className="text-destructive">
          {exportError}
        </p>
      ) : null}
      <AccountingDocumentFilter
        domain="general"
        book={book}
        value={advanced}
        onChange={setAdvanced}
        onApply={(value) => {
          setApplied(value);
          setPage(1);
          setSelected([]);
        }}
        busy={busy}
      />
      {result.isError ? (
        <p role="alert" className="text-destructive">
          خواندن فهرست سند کل انجام نشد.
        </p>
      ) : null}
      <div
        role="toolbar"
        aria-label="عملیات فهرست سند کل"
        className="flex justify-end gap-2"
      >
        <DocumentIconAction
          label="جدید"
          shortcut="Alt+N"
          disabled={busy || !canPost}
          onClick={() =>
            router.push(
              `/finance/accounting/general-ledger/documents/issue-gl-voucher?bookId=${book.book.id}`,
            )
          }
        >
          <Plus size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ویرایش"
          shortcut="Alt+L"
          disabled={busy || !canPost || selected.length !== 1}
          onClick={() => {
            const row = rows.find((row) => row.id === selected[0]);
            if (row) open(row);
          }}
        >
          <Pencil size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="بارگذاری مجدد"
          shortcut="Alt+R"
          disabled={busy || result.isFetching}
          onClick={() => void result.refetch()}
        >
          <RefreshCw size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="حذف فیلتر"
          shortcut="Alt+F"
          disabled={busy}
          onClick={() => {
            setFilters({});
            setAdvanced(emptyDocumentFilter());
            setApplied(emptyDocumentFilter());
            setPage(1);
            setSelected([]);
          }}
        >
          <FilterX size={16} />
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
          disabled={result.isFetching}
          onClick={() => setCount((value) => !value)}
        >
          <Calculator size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ستون‌ها"
          shortcut="Alt+C"
          onClick={() => setShowColumns((value) => !value)}
        >
          <Columns3 size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="گروه‌بندی"
          shortcut="Alt+G"
          onClick={() => setShowGrouping((value) => !value)}
        >
          <Group size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی اکسل"
          shortcut="Alt+E"
          disabled={!canExport || !rows.length || exporting}
          onClick={() => exportRows('xlsx')}
        >
          <FileSpreadsheet size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی پی دی اف"
          shortcut="Alt+P"
          disabled={!canExport || !rows.length || exporting}
          onClick={() => exportRows('pdf')}
        >
          <FileText size={16} />
        </DocumentIconAction>
      </div>
      {showGrouping ? (
        <label className="flex items-center gap-3 rounded border p-3">
          گروه‌بندی
          <select
            className="rounded border p-2"
            value={groupBy}
            onChange={(event) => {
              setGroupBy(event.target.value);
              setPage(1);
              setSelected([]);
            }}
          >
            <option value="">بدون گروه‌بندی</option>
            {columns.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showColumns ? (
        <div className="flex flex-wrap gap-4 rounded border p-3">
          {columns.map(([key, label]) => (
            <label key={key} className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={!hiddenColumns.includes(key)}
                disabled={
                  visibleColumns.length === 1 && !hiddenColumns.includes(key)
                }
                onChange={(event) =>
                  setHiddenColumns((current) =>
                    event.target.checked
                      ? current.filter((value) => value !== key)
                      : [...current, key],
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
      ) : null}
      <div className="min-h-[480px] overflow-auto border rounded">
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr className="bg-primary/10">
              {multi ? (
                <th className="p-2">
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه رکوردهای صفحه"
                    checked={
                      !!rows.length &&
                      rows.every((row) => selected.includes(row.id))
                    }
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? rows.map((row) => row.id) : [],
                      )
                    }
                  />
                </th>
              ) : null}
              {visibleColumns.map(([key, label]) => (
                <th key={key} className="p-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setSort(key);
                      setDirection((current) =>
                        sort === key && current === 'asc' ? 'desc' : 'asc',
                      );
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              {multi ? <th /> : null}
              {visibleColumns.map(([key, label]) => (
                <th key={key} className="p-1">
                  {key === 'documentDate' ? (
                    <DatePicker
                      value={filters[key] ?? ''}
                      onChange={(value) => {
                        setFilters((current) => ({ ...current, [key]: value }));
                        setPage(1);
                      }}
                    />
                  ) : key === 'makerId' ? (
                    <select
                      aria-label={`فیلتر ${label}`}
                      className="w-full border rounded p-2"
                      value={filters[key] ?? ''}
                      onChange={(event) => {
                        setFilters((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }));
                        setPage(1);
                      }}
                    >
                      <option value="">همه</option>
                      {actors.data?.actors.map((actor) => (
                        <option key={actor.value} value={actor.value}>
                          {actor.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      aria-label={`فیلتر ${label}`}
                      inputMode="decimal"
                      value={filters[key] ?? ''}
                      onChange={(event) => {
                        setFilters((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }));
                        setPage(1);
                      }}
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
                (!index ||
                  String(rows[index - 1]?.[groupBy as keyof Row]) !==
                    String(row[groupBy as keyof Row])) ? (
                  <tr className="bg-primary/5">
                    <th
                      colSpan={visibleColumns.length + (multi ? 1 : 0)}
                      className="p-2 text-right"
                    >
                      {columns.find(([key]) => key === groupBy)?.[1]}:{' '}
                      {groupBy === 'makerId'
                        ? row.makerName
                        : String(row[groupBy as keyof Row])}
                      {' — '}
                      {result.data?.groups.find(
                        (group) =>
                          group.key === String(row[groupBy as keyof Row]),
                      )?.count ?? 0}{' '}
                      رکورد
                    </th>
                  </tr>
                ) : null}
                <tr
                  key={row.id}
                  className={`border-t cursor-pointer ${selected.includes(row.id) ? 'bg-primary/10' : ''}`}
                  onClick={() => choose(row)}
                  onDoubleClick={() => canPost && open(row)}
                >
                  {multi ? (
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`انتخاب سند کل ${row.number}`}
                        checked={selected.includes(row.id)}
                        onChange={() => choose(row)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map(([key]) => (
                    <td key={key} className="p-2">
                      {key === 'makerId' ? row.makerName : row[key]}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (multi ? 1 : 0)}
                  className="p-6 text-center text-muted-foreground"
                >
                  {result.isLoading
                    ? 'در حال بارگذاری'
                    : 'سطری برای نمایش وجود ندارد.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <DocumentIconAction
          label="صفحه ابتدا"
          shortcut="Alt+Home"
          disabled={page <= 1 || result.isFetching}
          onClick={() => {
            setPage(1);
            setSelected([]);
          }}
        >
          <ChevronsRight size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه قبلی"
          shortcut="Alt+Left"
          disabled={page <= 1 || result.isFetching}
          onClick={() => {
            setPage((value) => value - 1);
            setSelected([]);
          }}
        >
          <ChevronRight size={16} />
        </DocumentIconAction>
        <span>صفحه {page}</span>
        <DocumentIconAction
          label="صفحه بعدی"
          shortcut="Alt+Right"
          disabled={page * 50 >= (result.data?.total ?? 0) || result.isFetching}
          onClick={() => {
            setPage((value) => value + 1);
            setSelected([]);
          }}
        >
          <ChevronLeft size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه انتها"
          shortcut="Alt+End"
          disabled={page * 50 >= (result.data?.total ?? 0) || result.isFetching}
          onClick={() => {
            setPage(Math.max(1, Math.ceil((result.data?.total ?? 0) / 50)));
            setSelected([]);
          }}
        >
          <ChevronsLeft size={16} />
        </DocumentIconAction>
        {count ? (
          <span>
            {result.data?.total ?? 0} رکورد،{' '}
            {Math.ceil((result.data?.total ?? 0) / 50)} صفحه
          </span>
        ) : null}
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent data-document-shortcut-scope>
          <DialogTitle>سند کل {editing?.number}</DialogTitle>
          <DatePicker value={date} onChange={setDate} disabled={busy} />
          <DocumentIconAction
            label="ذخیره تاریخ سند کل"
            shortcut="Alt+S"
            disabled={busy || !canPost}
            onClick={() => void save()}
          >
            <Save size={16} />
          </DocumentIconAction>
        </DialogContent>
      </Dialog>
    </section>
  );
}
