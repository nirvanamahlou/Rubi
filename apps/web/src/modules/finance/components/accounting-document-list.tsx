'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ListChecks,
  Calculator,
  List,
  Columns3,
  FilterX,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Check,
  Undo2,
  Plus,
  Trash2,
  Filter,
} from 'lucide-react';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Input, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { AccountingButton } from './accounting-operations';
import { accountingApi } from '../api/accounting-api';
import { journalDisplayTotals } from '../accounting-money';
import { exportAccountingRows } from '../accounting-view-export';
import {
  AccountingDocumentFilter,
  DocumentIconAction,
  emptyDocumentFilter,
  type DocumentGroup,
  type DocumentRule,
} from './accounting-document-filter';
type Mode = 'list' | 'review' | 'deleted' | 'revaluation';
type Column = {
  key: string;
  label: string;
  value: (row: AccountingJournalV1) => string;
  kind?: 'number' | 'date' | 'choice';
  sortable?: boolean;
};
const statuses: Record<string, string> = {
  MEMORANDUM: 'ثبت یادداشت',
  DRAFT: 'ثبت موقت',
  PENDING_APPROVAL: 'ثبت موقت',
  APPROVED: 'بررسی شده',
  POSTED: 'قطعی',
  CANCELLED: 'حذف شده',
};
export function AccountingDocumentList({
  book,
  mode = 'list',
  busy,
  run,
  can,
  onOpen,
}: {
  book: AccountingSnapshotV1;
  mode?: Mode;
  busy: boolean;
  run: <T = unknown>(
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<T | undefined>;
  can: (permission: string) => boolean;
  onOpen?: (row: AccountingJournalV1) => void;
}) {
  const router = useRouter();
  const [draftFilter, setDraftFilter] =
    useState<DocumentGroup>(emptyDocumentFilter);
  const [filter, setFilter] = useState<DocumentGroup>(emptyDocumentFilter);
  const [columnDrafts, setColumnDrafts] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<DocumentRule[]>([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState('');
  const [reviewStatus, setReviewStatus] = useState('DRAFT');
  const [reviewIntent, setReviewIntent] = useState<boolean | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [reviewAll, setReviewAll] = useState<{
    checksum: string;
    total: number;
  } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const currentPeriods = book.periods.filter(
    (period) =>
      period.status === 'OPEN' &&
      period.startDate <= today &&
      period.endDate >= today,
  );
  const currentPeriod =
    currentPeriods.length === 1 ? currentPeriods[0] : undefined;
  const [countVisible, setCountVisible] = useState(false);
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
  const [listVisible, setListVisible] = useState(false);
  const condition: DocumentGroup = {
    type: 'group',
    mode: 'all',
    children: [
      filter,
      ...columnFilters,
      ...(mode === 'review' && reviewStatus === 'DRAFT'
        ? [
            {
              type: 'group' as const,
              mode: 'any' as const,
              children: [
                {
                  type: 'rule' as const,
                  field: 'status',
                  operator: 'equals' as const,
                  value: 'DRAFT',
                },
                {
                  type: 'rule' as const,
                  field: 'status',
                  operator: 'equals' as const,
                  value: 'PENDING_APPROVAL',
                },
              ],
            },
          ]
        : []),
      ...(mode === 'review' && currentPeriod
        ? [
            {
              type: 'rule' as const,
              field: 'periodId',
              operator: 'equals' as const,
              value: currentPeriod.id,
            },
          ]
        : []),
    ],
  };
  const status =
    mode === 'deleted'
      ? 'CANCELLED'
      : mode === 'review' && reviewStatus === 'APPROVED'
        ? 'APPROVED'
        : '';
  const query = useQuery({
    enabled: mode !== 'review' || !!currentPeriod,
    queryKey: [
      'accounting',
      'document-list',
      book.book.id,
      mode,
      status,
      page,
      JSON.stringify(condition),
      sort,
      direction,
      groupBy,
    ],
    queryFn: () => {
      if (mode === 'review' && !currentPeriod)
        throw new Error('دوره جاری باز و یکتا پیدا نشد.');
      return accountingApi.journals(book.book.id, {
        page: String(page),
        pageSize: '50',
        filter: JSON.stringify(condition),
        status,
        excludeCancelled: status ? '' : 'true',
        ...(mode === 'revaluation' ? { sourceKind: 'revaluation' } : {}),
        ...(sort ? { sort, direction } : {}),
        ...(groupBy ? { group: groupBy } : {}),
      });
    },
  });
  const items = query.data?.items ?? [];
  const currencies = useQuery({
    queryKey: ['accounting-revaluation-currencies', book.book.id],
    enabled: mode === 'revaluation',
    queryFn: () =>
      accountingApi.analytical<{ value: string; label: string }[]>(
        book.book.id,
        'document-revaluation-currencies',
        {},
      ),
  });
  const total = query.data?.total ?? 0;
  const loading = busy || query.isFetching || exporting;
  const open = (row: AccountingJournalV1) =>
    mode === 'revaluation'
      ? router.push(
          `/finance/accounting/general-ledger/documents/revaluation?bookId=${book.book.id}&journalId=${row.id}`,
        )
      : onOpen
        ? onOpen(row)
        : router.push(
            `/finance/accounting/general-ledger/documents/journals?journalId=${row.id}`,
          );
  const attr = (row: AccountingJournalV1, key: string) =>
    String(row.attributes[key] ?? '');
  const columns: Column[] =
    mode === 'revaluation'
      ? [
          {
            key: 'auxiliaryNumber',
            label: 'شماره فرعی',
            value: (r) => attr(r, 'auxiliaryNumber'),
            kind: 'number',
            sortable: true,
          },
          {
            key: 'documentDate',
            label: 'تاریخ',
            value: (r) => r.documentDate ?? '',
            kind: 'date',
            sortable: true,
          },
          {
            key: 'number',
            label: 'شماره سند',
            value: (r) => String(r.number ?? ''),
            kind: 'number',
            sortable: true,
          },
          {
            key: 'reference',
            label: 'شماره عطف',
            value: (r) => r.reference ?? '',
            kind: 'number',
            sortable: true,
          },
          {
            key: 'revaluationCurrency',
            label: 'عنوان ارز',
            value: (r) =>
              currencies.data?.find(
                (c) => c.value === attr(r, 'revaluationCurrency'),
              )?.label ?? attr(r, 'revaluationCurrency'),
            kind: 'choice',
            sortable: true,
          },
          {
            key: 'revaluationRate',
            label: 'نرخ ارز',
            value: (r) =>
              book.fxRates.find(
                (rate) => rate.id === attr(r, 'revaluationRateId'),
              )?.rate ?? '',
            kind: 'number',
            sortable: true,
          },
        ]
      : mode === 'deleted'
        ? [
            {
              key: 'deletedAt',
              label: 'تاریخ حذف سند',
              value: (r) => r.deletedAt ?? '',
              kind: 'date',
              sortable: true,
            },
            {
              key: 'deletedById',
              label: 'حذف کننده سند',
              value: (r) => r.deletedByName ?? '',
              kind: 'choice',
            },
            {
              key: 'number',
              label: 'شماره سند',
              value: (r) => String(r.number ?? ''),
              kind: 'number',
              sortable: true,
            },
            {
              key: 'reference',
              label: 'شماره عطف',
              value: (r) => r.reference ?? '',
              kind: 'number',
              sortable: true,
            },
            {
              key: 'dailyNumber',
              label: 'شماره روزانه',
              value: (r) => attr(r, 'dailyNumber'),
              kind: 'number',
              sortable: true,
            },
            {
              key: 'documentDate',
              label: 'تاریخ سند',
              value: (r) => r.documentDate ?? '',
              kind: 'date',
              sortable: true,
            },
            {
              key: 'makerId',
              label: 'صادر کننده سند',
              value: (r) => r.makerName ?? '',
              kind: 'choice',
            },
            {
              key: 'referenceNumber',
              label: 'شماره ارجاع',
              value: (r) => attr(r, 'referenceNumber'),
              sortable: true,
            },
          ]
        : [
            ...(mode === 'list'
              ? [
                  {
                    key: 'isCurrency',
                    label: 'سند ارزی',
                    sortable: true,
                    value: (r: AccountingJournalV1) =>
                      r.lines.some(
                        (line) =>
                          book.accounts.find(
                            (account) => account.id === line.accountId,
                          )?.attributes.multiCurrency === true,
                      )
                        ? 'بله'
                        : 'خیر',
                    kind: 'choice' as const,
                  },
                ]
              : []),
            {
              key: 'number',
              label: 'شماره سند',
              value: (r) => String(r.number ?? ''),
              kind: 'number',
              sortable: true,
            },
            {
              key: 'documentDate',
              label: 'تاریخ',
              value: (r) => r.documentDate ?? '',
              kind: 'date',
              sortable: true,
            },
            {
              key: 'status',
              label: 'وضعیت',
              value: (r) => statuses[r.status] ?? r.status,
              kind: 'choice',
              sortable: true,
            },
            {
              key: 'typeId',
              label: 'نوع سند',
              sortable: true,
              value: (r) =>
                book.configurations.find((c) => c.id === r.typeId)?.title ?? '',
              kind: 'choice',
            },
            {
              key: 'description',
              label: 'شرح',
              value: (r) => r.description,
              sortable: true,
            },
            {
              key: 'reference',
              label: 'شماره عطف',
              value: (r) => r.reference ?? '',
              kind: 'number',
              sortable: true,
            },
            {
              key: 'auxiliaryNumber',
              label: 'شماره فرعی',
              sortable: true,
              value: (r) => attr(r, 'auxiliaryNumber'),
              kind: 'number',
            },
            {
              key: 'dailyNumber',
              label: 'شماره روزانه',
              value: (r) => attr(r, 'dailyNumber'),
              kind: 'number',
              sortable: true,
            },
            {
              key: 'amount',
              label: 'مبلغ سند',
              sortable: true,
              value: (r) =>
                journalDisplayTotals(r.lines).valid
                  ? journalDisplayTotals(r.lines).debit
                  : '',
              kind: 'number',
            },
            {
              key: 'makerId',
              label: 'صادر کننده',
              sortable: true,
              value: (r) => r.makerName ?? '',
              kind: 'choice',
            },
            ...(mode === 'list'
              ? [
                  {
                    key: 'lastModifierId',
                    label: 'آخرین تغییر دهنده',
                    sortable: true,
                    value: (r: AccountingJournalV1) => r.lastModifierName ?? '',
                    kind: 'choice' as const,
                  },
                  {
                    key: 'approverId',
                    label: 'آخرین بررسی کننده',
                    sortable: true,
                    value: (r: AccountingJournalV1) => r.approverName ?? '',
                    kind: 'choice' as const,
                  },
                ]
              : []),
            {
              key: 'notes',
              label: 'یادداشت/پیوست',
              value: (r) => {
                try {
                  return JSON.parse(String(r.attributes.notes ?? '[]')).length
                    ? 'یادداشت'
                    : '';
                } catch {
                  return '';
                }
              },
            },
          ];
  const visible = columns.filter((column) => !hidden.includes(column.key));
  const reset = () => {
    const empty = emptyDocumentFilter();
    setDraftFilter(empty);
    setFilter(empty);
    setColumnDrafts({});
    setColumnFilters([]);
    setPage(1);
    setSelected([]);
  };
  const applyColumns = () => {
    setColumnFilters(
      columns
        .filter(
          (column) =>
            columnDrafts[column.key]?.trim() && column.key !== 'notes',
        )
        .map((column) => ({
          type: 'rule',
          field: column.key,
          operator: column.kind ? 'equals' : 'contains',
          value: columnDrafts[column.key]!.trim(),
        })),
    );
    setPage(1);
    setSelected([]);
  };
  const choices = (key: string) =>
    key === 'revaluationCurrency'
      ? (currencies.data ?? []).map((currency) => ({
          value: currency.label,
          label: currency.label,
        }))
      : key === 'status'
        ? Object.entries(statuses).map(([value, label]) => ({ value, label }))
        : key === 'isCurrency'
          ? [
              { value: 'true', label: 'بله' },
              { value: 'false', label: 'خیر' },
            ]
          : key === 'typeId'
            ? book.configurations
                .filter((c) => c.kind === 'voucher-types')
                .map((c) => ({ value: c.id, label: c.title }))
            : key === 'makerId'
              ? Array.from(
                  new Map(
                    items.map((r) => [
                      r.makerId,
                      { value: r.makerId, label: r.makerName ?? r.makerId },
                    ]),
                  ).values(),
                )
              : [];
  const selectedRows = items.filter((row) => selected.includes(row.id));
  const deleteSelected = async () => {
    if (loading || !can('finance.journal.create') || !selectedRows.length)
      return;
    const result = await run('journal-delete-documents', {
      items: selectedRows.map((row) => ({
        id: row.id,
        expectedVersion: row.version,
      })),
    });
    if (result) {
      setDeleting(false);
      setSelected([]);
      await query.refetch();
    }
  };
  const review = (undo: boolean) => {
    if (
      !currentPeriod ||
      loading ||
      !can('finance.journal.approve') ||
      !selectedRows.length ||
      (undo ? reviewStatus !== 'APPROVED' : reviewStatus === 'APPROVED')
    )
      return;
    setReviewReason('');
    setReviewAll(null);
    setReviewIntent(undo);
  };
  const all = async (undo: boolean) => {
    if (!currentPeriod || loading || !can('finance.journal.approve')) return;
    const preview = await run<{ checksum: string; total: number }>(
      'review-all-preview',
      { periodId: currentPeriod.id, undo, filter: condition },
    );
    if (preview?.total) {
      setReviewAll(preview);
      setReviewReason('');
      setReviewIntent(undo);
    } else if (preview) setExportError('سندی برای عملیات انتخاب نشده است.');
  };
  const commitReview = async () => {
    if (
      reviewIntent === null ||
      loading ||
      !can('finance.journal.approve') ||
      (!reviewAll && !selectedRows.length)
    )
      return;
    const result = reviewAll
      ? await run('review-all-documents', {
          periodId: currentPeriod?.id,
          undo: reviewIntent,
          filter: condition,
          checksum: reviewAll.checksum,
          reason: reviewReason,
        })
      : await run(reviewIntent ? 'unreview-documents' : 'review-documents', {
          items: selectedRows.map((row) => ({
            id: row.id,
            expectedVersion: row.version,
          })),
          reason: reviewReason,
        });
    if (!result) return;
    setReviewIntent(null);
    setReviewAll(null);
    setSelected([]);
    await query.refetch();
  };
  const exportList = async (format: 'xlsx' | 'pdf') => {
    if (
      loading ||
      !can('finance.export') ||
      (mode === 'review' && !currentPeriod)
    )
      return;
    setExporting(true);
    setExportError('');
    try {
      const result = await accountingApi.journals(book.book.id, {
        export: 'true',
        ...(mode === 'revaluation' ? { sourceKind: 'revaluation' } : {}),
        filter: JSON.stringify(condition),
        status,
        excludeCancelled: status ? '' : 'true',
        ...(sort ? { sort, direction } : {}),
        ...(groupBy ? { group: groupBy } : {}),
      });
      const output = await exportAccountingRows(
        [
          [
            mode === 'review'
              ? 'بررسی اسناد'
              : mode === 'deleted'
                ? 'اسناد حذف‌شده'
                : mode === 'revaluation'
                  ? 'فهرست تسعیر ارز'
                  : 'فهرست اسناد حسابداری',
          ],
          visible.map((column) => column.label),
          ...result.items.map((row) =>
            visible.map((column) => column.value(row)),
          ),
        ],
        format,
      );
      setExportFile(output);
    } catch (cause) {
      setExportError(
        cause instanceof Error ? cause.message : 'خروجی ساخته نشد.',
      );
    } finally {
      setExporting(false);
    }
  };
  const toolbar = () => (
    <div
      role="toolbar"
      aria-label="عملیات فهرست اسناد"
      className="flex flex-wrap justify-end gap-1 border-y bg-muted/20 p-2"
    >
      {mode === 'list' || mode === 'revaluation' ? (
        <>
          <DocumentIconAction
            label="جدید"
            shortcut="Alt+N"
            disabled={loading || !can('finance.journal.create')}
            onClick={() =>
              router.push(
                `/finance/accounting/general-ledger/documents/${mode === 'revaluation' ? 'revaluation' : 'journals'}?bookId=${book.book.id}`,
              )
            }
          >
            <Plus className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="حذف"
            shortcut="Alt+D"
            disabled={
              loading ||
              !can('finance.journal.create') ||
              !selectedRows.length ||
              selectedRows.some(
                (row) => row.status === 'POSTED' || row.status === 'CANCELLED',
              )
            }
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-4" />
          </DocumentIconAction>
        </>
      ) : null}
      <AccountingButton
        type="button"
        permission="finance.export"
        disabled={loading || (mode === 'review' && !currentPeriod)}
        onClick={() => void exportList('xlsx')}
      >
        خروجی اکسل
      </AccountingButton>
      <AccountingButton
        type="button"
        permission="finance.export"
        disabled={loading || (mode === 'review' && !currentPeriod)}
        onClick={() => void exportList('pdf')}
      >
        خروجی پی دی اف
      </AccountingButton>
      <DocumentIconAction
        label="نمایش سند"
        shortcut="Enter"
        disabled={selectedRows.length !== 1}
        onClick={() => {
          if (selectedRows[0]) open(selectedRows[0]);
        }}
      >
        <ExternalLink className="size-4" />
      </DocumentIconAction>
      {mode === 'review' ? (
        <>
          <DocumentIconAction
            label="بررسی همه"
            shortcut="Alt+Shift+V"
            disabled={
              loading ||
              !can('finance.journal.approve') ||
              !currentPeriod ||
              reviewStatus === 'APPROVED'
            }
            onClick={() => void all(false)}
          >
            <ListChecks className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="لغو بررسی همه"
            shortcut="Alt+Shift+U"
            disabled={
              loading ||
              !can('finance.journal.approve') ||
              !currentPeriod ||
              reviewStatus !== 'APPROVED'
            }
            onClick={() => void all(true)}
          >
            <Undo2 className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="بررسی"
            shortcut="Alt+V"
            disabled={
              loading ||
              !can('finance.journal.approve') ||
              !selectedRows.length ||
              !currentPeriod ||
              reviewStatus === 'APPROVED'
            }
            onClick={() => void review(false)}
          >
            <Check className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="لغو بررسی"
            shortcut="Alt+U"
            disabled={
              loading ||
              !can('finance.journal.approve') ||
              !selectedRows.length ||
              !currentPeriod ||
              reviewStatus !== 'APPROVED'
            }
            onClick={() => void review(true)}
          >
            <Undo2 className="size-4" />
          </DocumentIconAction>
        </>
      ) : null}
      <DocumentIconAction
        label="انتخاب چند رکورد"
        shortcut="Alt+L"
        onClick={() => {
          setMultiple((v) => !v);
          setSelected([]);
        }}
      >
        <ListChecks className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction
        label="محاسبه تعداد رکوردها"
        shortcut="Alt+I"
        onClick={() => {
          setCountVisible(true);
          void query.refetch();
        }}
      >
        <Calculator className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction
        label="فهرست ها"
        shortcut="Alt+M"
        onClick={() => setListVisible((v) => !v)}
      >
        <List className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction
        label="ستون ها"
        shortcut="Alt+C"
        onClick={() => setShowColumns((v) => !v)}
      >
        <Columns3 className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction label="حذف فیلتر" shortcut="Alt+X" onClick={reset}>
        <FilterX className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction
        label={showFilters ? 'عدم نمایش فیلتر' : 'نمایش فیلتر'}
        shortcut="Alt+Shift+F"
        onClick={() => setShowFilters((value) => !value)}
      >
        <Filter className="size-4" />
      </DocumentIconAction>
      <DocumentIconAction
        label="بارگذاری مجدد"
        shortcut="Ctrl+R"
        disabled={mode === 'review' && !currentPeriod}
        onClick={() => void query.refetch()}
      >
        <RefreshCw className="size-4" />
      </DocumentIconAction>
    </div>
  );
  return (
    <section className="space-y-2" data-document-shortcut-scope>
      <h2 className="font-bold">
        {mode === 'review'
          ? 'بررسی'
          : mode === 'deleted'
            ? 'اسناد حذف شده'
            : mode === 'revaluation'
              ? 'فهرست تسعیر ارز'
              : 'فهرست سند حسابداری'}
      </h2>
      {mode === 'review' && !currentPeriod ? (
        <p role="alert" className="text-destructive">
          دوره جاری باز و یکتا پیدا نشد.
        </p>
      ) : null}
      {mode === 'review' ? (
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              checked={reviewStatus === 'DRAFT'}
              onChange={() => {
                setReviewStatus('DRAFT');
                setPage(1);
                setSelected([]);
              }}
            />{' '}
            اسناد ثبت موقت
          </label>
          <label>
            <input
              type="radio"
              checked={reviewStatus === 'APPROVED'}
              onChange={() => {
                setReviewStatus('APPROVED');
                setPage(1);
                setSelected([]);
              }}
            />{' '}
            اسناد بررسی شده
          </label>
        </div>
      ) : null}
      <div hidden={!showFilters}>
        <AccountingDocumentFilter
          book={book}
          domain={mode === 'revaluation' ? 'revaluation' : 'journal'}
          value={draftFilter}
          onChange={setDraftFilter}
          onApply={(value) => {
            setFilter(value);
            setPage(1);
            setSelected([]);
          }}
          busy={loading}
        />
      </div>
      {toolbar()}
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent data-document-shortcut-scope>
          <DialogTitle>حذف اسناد انتخاب‌شده</DialogTitle>
          <p>
            {selectedRows.length} سند حذف شود؟ اسناد در فهرست اسناد حذف‌شده قابل
            بازیابی‌اند.
          </p>
          <DocumentIconAction
            label="حذف"
            shortcut="Alt+D"
            disabled={loading || !can('finance.journal.create')}
            onClick={() => void deleteSelected()}
          >
            <Trash2 className="size-4" />
          </DocumentIconAction>
        </DialogContent>
      </Dialog>
      {listVisible ? (
        <nav className="flex flex-wrap gap-3 rounded border p-2">
          {[
            ['journals', 'سند حسابداری'],
            ['gl-vouchers', 'سند کل'],
            ['automatic-templates', 'الگوی سند اتوماتیک'],
            ['revaluation-templates', 'الگوی تسعیر ارز'],
            ['revaluations', 'تسعیر ارز'],
          ].map(([route, label]) => (
            <button
              type="button"
              key={route}
              onClick={() =>
                router.push(
                  `/finance/accounting/general-ledger/documents/lists/${route}`,
                )
              }
            >
              {label}
            </button>
          ))}
        </nav>
      ) : null}
      {showColumns ? (
        <div className="flex flex-wrap gap-3 rounded border p-2">
          {columns.map((column) => (
            <label key={column.key}>
              <input
                type="checkbox"
                checked={!hidden.includes(column.key)}
                disabled={!hidden.includes(column.key) && visible.length === 1}
                onChange={(e) =>
                  setHidden((current) =>
                    e.target.checked
                      ? current.filter((key) => key !== column.key)
                      : [...current, column.key],
                  )
                }
              />{' '}
              {column.label}
            </label>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2 bg-muted/10 px-2 py-1">
        <label htmlFor="document-group-column" className="text-xs">
          گروه بندی
        </label>
        <select
          id="document-group-column"
          className="rounded border p-1 text-xs"
          value={groupBy}
          onChange={(e) => {
            setGroupBy(e.target.value);
            setPage(1);
            setSelected([]);
          }}
        >
          <option value="">—</option>
          {columns
            .filter((c) => c.sortable)
            .map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
        </select>
      </div>
      {query.error ? (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {exportError ? (
        <p role="alert" className="text-destructive">
          {exportError}
        </p>
      ) : null}
      {exportFile ? (
        <a
          href={exportFile.url}
          download={exportFile.name}
          className="text-sm underline"
        >
          دریافت {exportFile.name}
        </a>
      ) : null}
      <Dialog
        open={reviewIntent !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setReviewIntent(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {reviewAll
              ? reviewIntent
                ? 'لغو بررسی همه'
                : 'بررسی همه'
              : reviewIntent
                ? 'لغو بررسی اسناد انتخابی'
                : 'بررسی اسناد انتخابی'}
          </DialogTitle>
          <Textarea
            aria-label="توضیحات تغییر وضعیت"
            placeholder="توضیحات"
            maxLength={2000}
            value={reviewReason}
            onChange={(event) => setReviewReason(event.target.value)}
          />
          <DocumentIconAction
            label="تایید تغییر وضعیت"
            shortcut="Alt+Enter"
            disabled={loading}
            onClick={() => void commitReview()}
          >
            <Check className="size-4" />
          </DocumentIconAction>
        </DialogContent>
      </Dialog>
      <div
        className="min-h-96 overflow-auto rounded border"
        aria-busy={loading}
      >
        <table className="w-full min-w-[70rem] text-xs">
          <thead className="bg-muted/40">
            <tr>
              {multiple ? (
                <th className="border p-1">
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه رکوردهای صفحه"
                    checked={
                      items.length > 0 &&
                      items.every((row) => selected.includes(row.id))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? items.map((row) => row.id) : [],
                      )
                    }
                  />
                </th>
              ) : null}
              {visible.map((column) => (
                <th key={column.key} className="border px-2 py-2 text-right">
                  <button
                    type="button"
                    disabled={!column.sortable}
                    onClick={() => {
                      setSort(column.key);
                      setDirection(
                        sort === column.key && direction === 'asc'
                          ? 'desc'
                          : 'asc',
                      );
                      setPage(1);
                    }}
                  >
                    {column.label}
                    {sort === column.key
                      ? direction === 'asc'
                        ? ' ↑'
                        : ' ↓'
                      : ''}
                  </button>
                </th>
              ))}
            </tr>
            <tr hidden={!showFilters}>
              {multiple ? <th /> : null}
              {visible.map((column) => (
                <th key={column.key} className="border p-1">
                  {column.key === 'notes' ? null : choices(column.key)
                      .length ? (
                    <select
                      className="w-full rounded border p-1"
                      aria-label={`فیلتر ${column.label}`}
                      value={columnDrafts[column.key] ?? ''}
                      onChange={(e) =>
                        setColumnDrafts((current) => ({
                          ...current,
                          [column.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">همه</option>
                      {choices(column.key).map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      className="h-8 min-w-24 text-xs"
                      type={column.kind === 'date' ? 'date' : 'text'}
                      inputMode={
                        column.kind === 'number' ? 'decimal' : undefined
                      }
                      aria-label={`فیلتر ${column.label}`}
                      value={columnDrafts[column.key] ?? ''}
                      onChange={(e) =>
                        setColumnDrafts((current) => ({
                          ...current,
                          [column.key]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyColumns();
                        }
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => {
              const groupColumn = columns.find((c) => c.key === groupBy);
              const currentGroup = groupColumn?.value(row);
              const previous = items[index - 1];
              return (
                <DocumentListRow
                  key={row.id}
                  row={row}
                  columns={visible}
                  multiple={multiple}
                  selected={selected.includes(row.id)}
                  onSelect={() =>
                    setSelected((current) =>
                      multiple
                        ? current.includes(row.id)
                          ? current.filter((id) => id !== row.id)
                          : [...current, row.id]
                        : [row.id],
                    )
                  }
                  onOpen={() => open(row)}
                  group={
                    groupColumn &&
                    (!previous || groupColumn.value(previous) !== currentGroup)
                      ? currentGroup
                      : undefined
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <DocumentIconAction
          label="اجرای فیلتر ستون‌ها"
          shortcut="Enter"
          onClick={applyColumns}
        >
          <Check className="size-4" />
        </DocumentIconAction>
      </div>
      {toolbar()}
      <div className="flex items-center justify-end gap-2 border bg-muted/20 p-2 text-xs">
        <DocumentIconAction
          label="صفحه اول"
          shortcut="Alt+Home"
          disabled={page === 1}
          onClick={() => {
            setPage(1);
            setSelected([]);
          }}
        >
          <ChevronsRight className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه قبل"
          shortcut="Alt+Right"
          disabled={page === 1}
          onClick={() => {
            setPage((p) => p - 1);
            setSelected([]);
          }}
        >
          <ChevronRight className="size-4" />
        </DocumentIconAction>
        <span>
          صفحه {page} ·{' '}
          {total
            ? `${(page - 1) * 50 + 1} تا ${Math.min(page * 50, total)}`
            : '۰'}{' '}
          از {total}
          {countVisible ? ` · تعداد رکوردها: ${total}` : ''}
        </span>
        <DocumentIconAction
          label="صفحه بعد"
          shortcut="Alt+Left"
          disabled={page * 50 >= total}
          onClick={() => {
            setPage((p) => p + 1);
            setSelected([]);
          }}
        >
          <ChevronLeft className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="صفحه آخر"
          shortcut="Alt+End"
          disabled={page * 50 >= total}
          onClick={() => {
            setPage(Math.max(1, Math.ceil(total / 50)));
            setSelected([]);
          }}
        >
          <ChevronsLeft className="size-4" />
        </DocumentIconAction>
      </div>
    </section>
  );
}
function DocumentListRow({
  row,
  columns,
  multiple,
  selected,
  onSelect,
  onOpen,
  group,
}: {
  row: AccountingJournalV1;
  columns: Column[];
  multiple: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  group?: string | undefined;
}) {
  return (
    <>
      {group !== undefined ? (
        <tr className="bg-muted">
          <td
            className="p-2 font-bold"
            colSpan={columns.length + (multiple ? 1 : 0)}
          >
            {group}
          </td>
        </tr>
      ) : null}
      <tr
        tabIndex={0}
        aria-selected={selected}
        className={
          selected ? 'bg-primary/10' : 'even:bg-muted/10 hover:bg-muted/20'
        }
        onClick={onSelect}
        onDoubleClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onOpen();
          }
          if (e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {multiple ? (
          <td className="border p-1">
            <input
              type="checkbox"
              aria-label={`انتخاب سند ${row.number ?? row.reference ?? ''}`}
              checked={selected}
              onChange={onSelect}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        ) : null}
        {columns.map((column) => (
          <td key={column.key} className="border px-2 py-2 text-right">
            {column.value(row)}
          </td>
        ))}
      </tr>
    </>
  );
}
