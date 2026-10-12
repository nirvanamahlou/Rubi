'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import {
  Plus,
  Save,
  RotateCcw,
  FilePlus2,
  PanelLeftClose,
  Trash2,
  FileX2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from '@/i18n/link';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DocumentIconAction } from './accounting-document-filter';
import { accountingApi } from '../api/accounting-api';
import { exportAccountingRows } from '../accounting-view-export';
import {
  AccountingSetupNotes,
  parseSetupNotes,
  type SetupNote,
} from './accounting-setup-notes';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type RevaluationProps = {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
  canCreate: boolean;
  canExport: boolean;
};
export function AccountingDocumentRevaluation(props: RevaluationProps) {
  const id = useSearchParams().get('journalId') ?? '';
  const loaded = useQuery({
    queryKey: ['accounting', 'revaluation-open', props.book.book.id, id],
    enabled: !!id,
    queryFn: () =>
      accountingApi.journals(props.book.book.id, {
        id,
        sourceKind: 'revaluation',
        excludeCancelled: 'true',
      }),
  });
  if (id && loaded.isLoading) return <p>در حال بارگذاری</p>;
  if (id && (!loaded.data?.items[0] || loaded.isError))
    return (
      <p role="alert" className="text-destructive">
        سند تسعیر ارز پیدا نشد.
      </p>
    );
  return (
    <RevaluationForm
      key={id || 'new'}
      {...props}
      initialJournal={id ? loaded.data?.items[0] : undefined}
    />
  );
}
function RevaluationForm({
  book,
  busy,
  run,
  canCreate,
  canExport,
  initialJournal,
}: RevaluationProps & { initialJournal?: AccountingJournalV1 | undefined }) {
  const router = useRouter();
  const empty = () => ({
    currency: String(initialJournal?.attributes.revaluationCurrency ?? ''),
    rateId: String(initialJournal?.attributes.revaluationRateId ?? ''),
    asOf: initialJournal?.documentDate ?? new Date().toISOString().slice(0, 10),
    auxiliaryNumber: String(initialJournal?.attributes.auxiliaryNumber ?? ''),
    templateId: String(initialJournal?.attributes.revaluationTemplateId ?? ''),
    description: initialJournal?.description ?? '',
    descriptionEn: String(initialJournal?.attributes.descriptionEn ?? ''),
  });
  const [head, setHead] = useState(empty);
  const [journal, setJournal] = useState<AccountingJournalV1 | null>(
    initialJournal ?? null,
  );
  const [notes, setNotes] = useState<SetupNote[]>(() =>
    parseSetupNotes(initialJournal?.attributes.notes),
  );
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [exportError, setExportError] = useState('');
  const fresh = () => {
    if (initialJournal) {
      router.replace(
        `/finance/accounting/general-ledger/documents/revaluation?bookId=${book.book.id}`,
      );
      return;
    }
    setHead(empty());
    setJournal(null);
    setNotes([]);
    setTab('main');
  };
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/documents/lists/revaluations?bookId=${book.book.id}`,
    );
  const reload = async () => {
    if (!journal) {
      fresh();
      return;
    }
    try {
      const result = await accountingApi.journals(book.book.id, {
        id: journal.id,
        sourceKind: 'revaluation',
        excludeCancelled: 'true',
      });
      const loaded = result.items[0];
      if (!loaded) throw new Error('سند تسعیر ارز پیدا نشد.');
      setJournal(loaded);
      setNotes(parseSetupNotes(loaded.attributes.notes));
      setHead({
        currency: String(loaded.attributes.revaluationCurrency ?? ''),
        rateId: String(loaded.attributes.revaluationRateId ?? ''),
        asOf: loaded.documentDate ?? '',
        auxiliaryNumber: String(loaded.attributes.auxiliaryNumber ?? ''),
        templateId: String(loaded.attributes.revaluationTemplateId ?? ''),
        description: loaded.description,
        descriptionEn: String(loaded.attributes.descriptionEn ?? ''),
      });
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'بارگذاری انجام نشد.',
      );
    }
  };
  const remove = async (after: 'new' | 'close') => {
    if (!journal || !canCreate || busy) return;
    const removed = await run('cancel', { id: journal.id }, journal.version);
    if (removed) {
      if (after === 'close') close();
      else fresh();
    }
  };
  const exportForm = async (format: 'xlsx' | 'pdf') => {
    if (!canExport) return;
    setExportError('');
    try {
      await exportAccountingRows(
        [
          ['تسعیر ارز'],
          [
            'ارز',
            currencies.data?.find(
              (currency) => currency.value === head.currency,
            )?.label ?? head.currency,
          ],
          [
            'نرخ ارز',
            book.fxRates.find((rate) => rate.id === head.rateId)?.rate ?? '',
          ],
          ['تا تاریخ', head.asOf],
          ['شماره فرعی', head.auxiliaryNumber],
          [
            'الگوی تسعیر',
            book.templates.find((template) => template.id === head.templateId)
              ?.title ?? '',
          ],
          ['شرح', head.description],
          ['شرح به زبان دوم', head.descriptionEn],
          ['عنوان یادداشت', 'تاریخ یادداشت', 'متن یادداشت'],
          ...notes.map((note) => [note.title, note.date, note.text]),
        ],
        format,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'خروجی انجام نشد.',
      );
    }
  };
  const currencies = useQuery({
    queryKey: ['accounting-revaluation-currencies', book.book.id],
    queryFn: () =>
      accountingApi.analytical<{ value: string; label: string }[]>(
        book.book.id,
        'document-revaluation-currencies',
        {},
      ),
    staleTime: 30000,
  });
  const set = (key: keyof typeof head, value: string) => {
    setHead((current) => ({ ...current, [key]: value }));
    setJournal(null);
  };
  const rates = book.fxRates.filter(
    (rate) => rate.status === 'APPROVED' && rate.currency === head.currency,
  );
  const templates = book.templates.filter(
    (template) =>
      template.active &&
      template.kind === 'REVALUATION' &&
      template.attributes?.sourceForm === 'rahkaran-documents-v1',
  );
  const issue = async (after?: 'new' | 'close') => {
    if (journal) {
      const updated = await run<AccountingJournalV1>(
        'journal-notes-save',
        { id: journal.id, notes },
        journal.version,
      );
      if (updated) {
        setJournal(updated);
        setNotes(parseSetupNotes(updated.attributes.notes));
        if (after === 'new') fresh();
        if (after === 'close') close();
      }
      return;
    }
    const preview = await run<{ checksum: string }>(
      'document-revaluation-preview',
      head,
    );
    if (!preview) return;
    const created = await run<AccountingJournalV1>('document-revaluation-run', {
      ...head,
      checksum: preview.checksum,
      notes,
    });
    if (created) {
      setJournal(created);
      setNotes(parseSetupNotes(created.attributes.notes));
      setHead((current) => ({
        ...current,
        description: created.description,
        descriptionEn: String(created.attributes.descriptionEn ?? ''),
      }));
      if (after === 'new') fresh();
      if (after === 'close') close();
    }
  };
  return (
    <section className="space-y-4" data-document-shortcut-scope>
      {exportError ? (
        <p role="alert" className="text-destructive">
          {exportError}
        </p>
      ) : null}
      {currencies.isError ? (
        <p role="alert" className="text-destructive">
          خواندن ارزهای دارای گردش انجام نشد.
        </p>
      ) : null}
      <div className="flex justify-end gap-2" dir="rtl">
        <DocumentIconAction
          label="جدید"
          shortcut="Alt+N"
          disabled={busy}
          onClick={() => {
            fresh();
          }}
        >
          <Plus size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="باز کردن"
          shortcut="Alt+L"
          disabled={busy}
          onClick={close}
        >
          <FolderOpen size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ذخیره و جدید"
          shortcut="Alt+Shift+N"
          disabled={busy || !canCreate}
          onClick={() => void issue('new')}
        >
          <FilePlus2 size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ذخیره و بستن"
          shortcut="Alt+Shift+S"
          disabled={busy || !canCreate}
          onClick={() => void issue('close')}
        >
          <PanelLeftClose size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="حذف و بستن"
          shortcut="Alt+Shift+D"
          disabled={
            busy || !canCreate || !journal || journal.status !== 'DRAFT'
          }
          onClick={() => void remove('close')}
        >
          <Trash2 size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="حذف و جدید"
          shortcut="Alt+Shift+Delete"
          disabled={
            busy || !canCreate || !journal || journal.status !== 'DRAFT'
          }
          onClick={() => void remove('new')}
        >
          <FileX2 size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی اکسل"
          shortcut="Alt+E"
          disabled={busy || !canExport}
          onClick={() => void exportForm('xlsx')}
        >
          <FileSpreadsheet size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="خروجی پی دی اف"
          shortcut="Alt+P"
          disabled={busy || !canExport}
          onClick={() => void exportForm('pdf')}
        >
          <FileText size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="ذخیره"
          shortcut="Alt+S"
          disabled={busy || !canCreate}
          onClick={() => void issue()}
        >
          <Save size={16} />
        </DocumentIconAction>
        <DocumentIconAction
          label="بارگذاری مجدد"
          shortcut="Alt+R"
          disabled={busy}
          onClick={() => void reload()}
        >
          <RotateCcw size={16} />
        </DocumentIconAction>
      </div>
      <div
        role="tablist"
        aria-label="اطلاعات سند تسعیر"
        className="flex gap-4 border-b"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'main'}
          onClick={() => setTab('main')}
        >
          اطلاعات اصلی
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          onClick={() => setTab('notes')}
        >
          یادداشت
        </button>
      </div>
      {tab === 'notes' ? (
        <fieldset disabled={busy || !canCreate}>
          <AccountingSetupNotes
            notes={notes}
            onChange={setNotes}
            book={book}
            record={
              journal
                ? {
                    id: journal.id,
                    entityType: 'AccountingJournal',
                    title: journal.description,
                  }
                : undefined
            }
          />
        </fieldset>
      ) : null}
      {tab === 'main' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchCombobox
            label="ارز *"
            value={head.currency}
            disabled={busy || !!journal}
            options={currencies.data ?? []}
            onValueChange={(value) => {
              setHead((current) => ({
                ...current,
                currency: value,
                rateId: '',
              }));
              setJournal(null);
            }}
          />
          <FormField label="تا تاریخ *">
            <DatePicker
              value={head.asOf}
              onChange={(value) => set('asOf', value)}
              disabled={busy || !!journal}
            />
          </FormField>
          <SearchCombobox
            label="نرخ ارز *"
            value={head.rateId}
            disabled={busy || !!journal}
            options={rates.map((rate) => ({
              value: rate.id,
              label: rate.rate,
            }))}
            onValueChange={(value) => set('rateId', value)}
          />
          <FormField label="شماره فرعی">
            <Input
              value={head.auxiliaryNumber}
              onChange={(event) => set('auxiliaryNumber', event.target.value)}
              disabled={busy || !!journal}
            />
          </FormField>
          <FormField label="شرح">
            <Textarea
              value={head.description}
              onChange={(event) => set('description', event.target.value)}
              disabled={busy || !!journal}
            />
          </FormField>
          <SearchCombobox
            label="الگوی تسعیر *"
            value={head.templateId}
            disabled={busy || !!journal}
            options={templates.map((template) => ({
              value: template.id,
              label: template.title,
            }))}
            onValueChange={(value) => set('templateId', value)}
          />
          <FormField label="شرح به زبان دوم">
            <Textarea
              value={head.descriptionEn}
              onChange={(event) => set('descriptionEn', event.target.value)}
              disabled={busy || !!journal}
            />
          </FormField>
        </div>
      ) : null}
      {journal ? (
        <Link
          className="text-primary underline"
          href={`/finance/accounting/general-ledger/documents/journal?bookId=${book.book.id}&journalId=${journal.id}`}
        >
          سند تسعیر صادرشده {journal.number}
        </Link>
      ) : null}
    </section>
  );
}
