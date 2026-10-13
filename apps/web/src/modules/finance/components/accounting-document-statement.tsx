'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Coins,
  Save,
  FolderOpen,
  RefreshCw,
  FileSpreadsheet,
  FileDown,
  X,
  Trash2,
  Search,
  Plus,
  CopyPlus,
  FileX,
  Eye,
} from 'lucide-react';
import type {
  AccountingStatementBasisV1,
  AccountingStatementV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { DocumentIconAction } from './accounting-document-filter';
import {
  AccountingSetupNotes,
  parseSetupNotes,
  type SetupNote,
} from './accounting-setup-notes';
import { accountingApi } from '../api/accounting-api';
import { exportAccountingView } from '../accounting-view-export';
import { journalDisplayTotals } from '../accounting-money';

const states = {
  CREATED: 'ایجاد شده',
  SENT: 'ارسال شده',
  CANCELLED: 'ابطال شده',
};
const types = { DEBIT: 'بدهکار', CREDIT: 'بستانکار', BOTH: 'بدهکار/بستانکار' };
type Preview = AccountingStatementBasisV1 & { makerName?: string };
export function AccountingDocumentStatement({
  book,
  journalId,
  lineIds,
  canWrite,
  canExport,
}: {
  book: AccountingSnapshotV1;
  journalId: string | undefined;
  lineIds: string[];
  canWrite: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const [choose, setChoose] = useState<boolean | null>(null);
  const [basis, setBasis] = useState<Preview | null>(null);
  const [record, setRecord] = useState<AccountingStatementV1 | null>(null);
  const [date, setDate] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] =
    useState<AccountingStatementV1['status']>('CREATED');
  const [notes, setNotes] = useState<SetupNote[]>([]);
  const [tab, setTab] = useState('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openPicker, setOpenPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const existing = useQuery({
    queryKey: ['accounting', 'statements', book.book.id, journalId],
    enabled: openPicker && !!journalId,
    queryFn: () =>
      accountingApi.analytical<{ items: AccountingStatementV1[] }>(
        book.book.id,
        'document-statements',
        { journalId: journalId! },
      ),
  });
  const request = <T,>(
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) =>
    accountingApi.command<T>(book.book.id, action, {
      key: crypto.randomUUID(),
      payload,
      ...(version === undefined ? {} : { expectedVersion: version }),
    });
  const loadRecord = (item: AccountingStatementV1) => {
    setRecord(item);
    setBasis(item.snapshot);
    setDate(item.documentDate);
    setPeriodId(item.periodId);
    setDescription(item.description);
    setStatus(item.status);
    setNotes(parseSetupNotes(item.notes));
    setOpenPicker(false);
    setSearch('');
    setCurrency(item.snapshot.rows[0]?.currency ?? '');
  };
  const preview = async (level: number, currencyMode: boolean) => {
    setChoose(null);
    setBusy(true);
    setError('');
    try {
      const value = await request<Preview>('journal-statement-preview', {
        journalId,
        lineIds,
        level,
        currencyMode,
      });
      setRecord(null);
      setBasis(value);
      setPeriodId(value.periodId);
      const period = book.periods.find((item) => item.id === value.periodId);
      const today = new Date().toISOString().slice(0, 10);
      setDate(
        period && today >= period.startDate && today <= period.endDate
          ? today
          : (value.rows[0]?.documentDate ?? ''),
      );
      setDescription('');
      setStatus('CREATED');
      setNotes([]);
      setTab('main');
      setSearch('');
      setCurrency(value.rows[0]?.currency ?? '');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'خواندن اعلامیه ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async (close = false, cancel = false, next = false) => {
    if (!basis || !canWrite || busy) return;
    setBusy(true);
    setError('');
    try {
      const value = await request<AccountingStatementV1>(
        cancel ? 'journal-statement-cancel' : 'journal-statement-save',
        {
          ...(record
            ? { id: record.id }
            : {
                journalId: basis.journalId,
                lineIds: basis.rows.map((row) => row.id),
                level: basis.level,
                currencyMode: basis.currencyMode,
                checksum: basis.checksum,
              }),
          periodId,
          documentDate: date,
          description,
          status,
          notes,
        },
        record?.version,
      );
      loadRecord(value);
      void existing.refetch();
      if (close) setBasis(null);
      if (next) await preview(basis.level, basis.currencyMode);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'ذخیره اعلامیه ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    if (!record || !journalId) return;
    setBusy(true);
    setError('');
    try {
      const result = await accountingApi.analytical<{
        items: AccountingStatementV1[];
      }>(book.book.id, 'document-statements', { journalId, id: record.id });
      const current = result.items[0];
      if (!current) throw new Error('اعلامیه یافت نشد.');
      loadRecord(current);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'بارگذاری ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const exportView = async (kind: 'xlsx' | 'pdf') => {
    if (!root.current || !canExport) return;
    try {
      await exportAccountingView(root.current, kind);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'خروجی ناموفق بود.',
      );
    }
  };
  const rows =
    basis?.rows.filter(
      (row) =>
        !search ||
        [row.number, row.reference, row.description, row.descriptionEn]
          .join(' ')
          .includes(search),
    ) ?? [];
  const sumRows =
    basis?.rows.filter(
      (row) => !basis.currencyMode || row.currency === currency,
    ) ?? [];
  const totals = journalDisplayTotals(sumRows);
  const foreignTotals = journalDisplayTotals(
    sumRows.map((row) => ({
      debit: row.foreignDebit,
      credit: row.foreignCredit,
    })),
  );
  return (
    <>
      <div className="relative flex gap-1">
        <DocumentIconAction
          label="صدور اعلامیه"
          shortcut="Alt+E"
          disabled={busy || !journalId || !lineIds.length || !canWrite}
          onClick={() => setChoose(false)}
        >
          <FileText className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="صدور اعلامیه ارزی"
          shortcut="Alt+Shift+E"
          disabled={busy || !journalId || !lineIds.length || !canWrite}
          onClick={() => setChoose(true)}
        >
          <Coins className="size-4" />
        </DocumentIconAction>
        {choose !== null ? (
          <div
            role="menu"
            aria-label="سطح اعلامیه"
            className="absolute bottom-full z-30 min-w-32 rounded border bg-surface p-1 shadow"
          >
            {[4, 5, 6].map((level) => (
              <button
                type="button"
                role="menuitem"
                key={level}
                className="block w-full p-2 text-right hover:bg-muted"
                onClick={() => void preview(level, choose)}
              >
                سطح {level}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error && !basis ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Dialog
        open={!!basis}
        onOpenChange={(open) => {
          if (!open && !busy) setBasis(null);
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-6xl overflow-auto">
          <DialogTitle>
            {basis?.currencyMode
              ? 'اعلامیه بدهکار/بستانکار ارزی'
              : 'اعلامیه بدهکار/بستانکار'}
          </DialogTitle>
          <div
            ref={root}
            dir="rtl"
            className="space-y-4"
            data-document-shortcut-scope
          >
            <div
              role="toolbar"
              aria-label="عملیات اعلامیه"
              className="flex flex-wrap justify-end gap-1"
            >
              <DocumentIconAction
                label="جدید"
                shortcut="Alt+N"
                disabled={busy || !canWrite || !journalId || !lineIds.length}
                onClick={() => {
                  if (basis) void preview(basis.level, basis.currencyMode);
                }}
              >
                <Plus className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="باز کردن"
                shortcut="Alt+L"
                disabled={busy || !journalId}
                onClick={() => setOpenPicker((value) => !value)}
              >
                <FolderOpen className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="ذخیره"
                shortcut="Alt+S"
                disabled={busy || !canWrite}
                onClick={() => void save()}
              >
                <Save className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="ذخیره و بستن"
                shortcut="Alt+Shift+S"
                disabled={busy || !canWrite}
                onClick={() => void save(true)}
              >
                <FileDown className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="ذخیره و جدید"
                shortcut="Alt+Shift+N"
                disabled={busy || !canWrite}
                onClick={() => void save(false, false, true)}
              >
                <CopyPlus className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="حذف و بستن"
                shortcut="Alt+D"
                disabled={
                  busy || !canWrite || !record || record.status === 'CANCELLED'
                }
                onClick={() => void save(true, true)}
              >
                <Trash2 className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="حذف و جدید"
                shortcut="Alt+Shift+D"
                disabled={
                  busy || !canWrite || !record || record.status === 'CANCELLED'
                }
                onClick={() => void save(false, true, true)}
              >
                <FileX className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="بارگذاری مجدد"
                shortcut="Alt+R"
                disabled={busy || !record}
                onClick={() => void reload()}
              >
                <RefreshCw className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="خروجی اکسل"
                shortcut="Alt+X"
                disabled={busy || !canExport}
                onClick={() => void exportView('xlsx')}
              >
                <FileSpreadsheet className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="خروجی پی دی اف"
                shortcut="Alt+P"
                disabled={busy || !canExport}
                onClick={() => void exportView('pdf')}
              >
                <FileText className="size-4" />
              </DocumentIconAction>
              <DocumentIconAction
                label="بستن"
                shortcut="Alt+Escape"
                disabled={busy}
                onClick={() => setBasis(null)}
              >
                <X className="size-4" />
              </DocumentIconAction>
            </div>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
            {openPicker ? (
              <div className="rounded border p-2">
                {existing.error ? (
                  <p role="alert">{existing.error.message}</p>
                ) : null}
                {existing.isFetching ? (
                  <p role="status">در حال بارگذاری…</p>
                ) : null}
                {existing.data?.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="block w-full border-b p-2 text-right"
                    onClick={() => loadRecord(item)}
                  >
                    {item.number} — {item.documentDate} — {states[item.status]}
                  </button>
                ))}
                {existing.data?.items.length === 0 ? (
                  <p>سطری برای نمایش وجود ندارد.</p>
                ) : null}
              </div>
            ) : null}
            <div
              role="tablist"
              aria-label="بخش‌های اعلامیه"
              className="flex gap-2"
            >
              {[
                ['main', 'اطلاعات اصلی'],
                ['notes', 'یادداشت'],
              ].map(([key, title]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  key={key}
                  onClick={() => setTab(key!)}
                  className="rounded border px-3 py-1"
                >
                  {title}
                </button>
              ))}
            </div>
            <div hidden={tab !== 'main'} className="space-y-4">
              <div className="grid gap-3 rounded border bg-muted/10 p-3 md:grid-cols-3">
                <label>
                  شماره
                  <Input
                    aria-label="شماره"
                    readOnly
                    value={record?.number ?? ''}
                  />
                </label>
                <label>
                  عنوان گیرنده
                  <Input
                    aria-label="عنوان گیرنده"
                    readOnly
                    value={basis?.recipientTitle ?? ''}
                  />
                </label>
                <label>
                  وضعیت
                  <select
                    aria-label="وضعیت"
                    className="h-9 w-full rounded border bg-background px-2"
                    disabled={busy || !canWrite}
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as AccountingStatementV1['status'],
                      )
                    }
                  >
                    {Object.entries(states).map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  شماره براساس گیرنده
                  <Input
                    aria-label="شماره براساس گیرنده"
                    readOnly
                    value={record?.recipientNumber ?? ''}
                  />
                </label>
                <label>
                  کد گیرنده
                  <Input
                    aria-label="کد گیرنده"
                    readOnly
                    value={basis?.recipientCode ?? ''}
                  />
                </label>
                <label>
                  تهیه کننده
                  <Input
                    aria-label="تهیه کننده"
                    readOnly
                    value={record?.makerName ?? basis?.makerName ?? ''}
                  />
                </label>
                <label>
                  تاریخ
                  <DatePicker
                    aria-label="تاریخ اعلامیه"
                    value={date}
                    onChange={setDate}
                    disabled={busy || !canWrite}
                  />
                </label>
                <label>
                  نوع اعلامیه
                  <Input
                    aria-label="نوع اعلامیه"
                    readOnly
                    value={basis ? types[basis.type] : ''}
                  />
                </label>
                <label>
                  آخرین تغییر دهنده
                  <Input
                    aria-label="آخرین تغییر دهنده"
                    readOnly
                    value={record?.lastModifierName ?? ''}
                  />
                </label>
                <label>
                  دوره مالی
                  <select
                    aria-label="دوره مالی اعلامیه"
                    className="h-9 w-full rounded border bg-background px-2"
                    value={periodId}
                    disabled={busy || !!record || !canWrite}
                    onChange={(event) => setPeriodId(event.target.value)}
                  >
                    {book.periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {book.configurations.find(
                          (item) => item.id === period.fiscalYearId,
                        )?.title ?? period.startDate}
                      </option>
                    ))}
                  </select>
                </label>
                {basis?.currencyMode ? (
                  <label>
                    مانده
                    <Input
                      aria-label="مانده"
                      dir="ltr"
                      readOnly
                      value={basis.balance}
                    />
                  </label>
                ) : null}
              </div>
              <label className="block">
                شرح
                <Textarea
                  aria-label="شرح اعلامیه"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={busy || !canWrite}
                />
              </label>
              <fieldset className="rounded border p-2">
                <legend>اقلام</legend>
                <div className="mb-2 flex items-center gap-2">
                  <Search className="size-4" />
                  <Input
                    aria-label="جستجوی اقلام اعلامیه"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <DocumentIconAction
                    label="مشاهده سند"
                    shortcut="Alt+V"
                    onClick={() => {
                      if (basis) {
                        router.push(
                          `/finance/accounting/general-ledger/documents/journals?journalId=${basis.journalId}&bookId=${book.book.id}`,
                        );
                        setBasis(null);
                      }
                    }}
                  >
                    <Eye className="size-4" />
                  </DocumentIconAction>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[60rem] text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {[
                          ...(basis?.currencyMode ? ['عنوان ارز'] : []),
                          'شماره سند',
                          'شماره ردیف',
                          'شماره عطف',
                          'تاریخ',
                          'شرح',
                          'شرح به زبان دوم',
                          'بدهکار',
                          'بستانکار',
                          ...(basis?.currencyMode
                            ? ['بدهکار ارزی', 'بستانکارارزی']
                            : []),
                        ].map((title) => (
                          <th key={title} className="border p-2 text-right">
                            {title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          {[
                            ...(basis?.currencyMode ? [row.currencyName] : []),
                            String(row.number ?? ''),
                            String(row.position),
                            row.reference ?? '',
                            row.documentDate,
                            row.description,
                            row.descriptionEn,
                            row.debit,
                            row.credit,
                            ...(basis?.currencyMode
                              ? [row.foreignDebit, row.foreignCredit]
                              : []),
                          ].map((value, index) => (
                            <td className="border p-2" key={index}>
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </fieldset>
              <fieldset className="grid gap-3 rounded border p-3 md:grid-cols-2">
                <legend>سرجمع</legend>
                {basis?.currencyMode ? (
                  <label>
                    ارز
                    <select
                      aria-label="ارز سرجمع"
                      className="h-9 w-full rounded border bg-background px-2"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                    >
                      {[
                        ...new Map(
                          basis.rows.map((row) => [
                            row.currency,
                            row.currencyName,
                          ]),
                        ).entries(),
                      ].map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  جمع بدهکار
                  <Input
                    aria-label="جمع بدهکار"
                    readOnly
                    value={totals.debit}
                  />
                </label>
                <label>
                  جمع بستانکار
                  <Input
                    aria-label="جمع بستانکار"
                    readOnly
                    value={totals.credit}
                  />
                </label>
                {basis?.currencyMode ? (
                  <>
                    <label>
                      جمع بدهکارارزی
                      <Input
                        aria-label="جمع بدهکارارزی"
                        readOnly
                        value={foreignTotals.debit}
                      />
                    </label>
                    <label>
                      جمع بستانکارارزی
                      <Input
                        aria-label="جمع بستانکارارزی"
                        readOnly
                        value={foreignTotals.credit}
                      />
                    </label>
                  </>
                ) : null}
              </fieldset>
            </div>
            <div hidden={tab !== 'notes'}>
              <AccountingSetupNotes
                book={book}
                notes={notes}
                onChange={setNotes}
                requireDate={false}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
