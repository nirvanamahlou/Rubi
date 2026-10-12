'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Download, Upload } from 'lucide-react';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { DocumentIconAction } from './accounting-document-filter';
import {
  accountingDocumentImportHeaders,
  accountingBranchDocumentImportHeaders,
  prepareAccountingDocumentImport,
  readAccountingDocumentWorkbook,
  type ImportedAccountingDocument,
} from '../accounting-document-import';
import { createAccountingXlsx } from '../accounting-view-xlsx';
import { accountingApi } from '../api/accounting-api';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
export function AccountingDocumentImportDialog({
  book,
  busy,
  canCreate,
  run,
  onOpen,
  typeId: initialTypeId,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  canCreate: boolean;
  run: Run;
  onOpen: (journal: AccountingJournalV1) => void;
  typeId: string;
}) {
  const [opened, setOpened] = useState(false),
    [reading, setReading] = useState(false);
  const [rows, setRows] = useState<string[][]>([]),
    [documents, setDocuments] = useState<ImportedAccountingDocument[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]),
    [failure, setFailure] = useState('');
  const [stop, setStop] = useState(false),
    [status, setStatus] = useState('TEMP'),
    [typeId, setTypeId] = useState(initialTypeId);
  const [method, setMethod] = useState('journal');
  const branch = useQuery({
    queryKey: ['accounting-import-branch', book.book.id],
    enabled: opened && method === 'branch',
    queryFn: () =>
      accountingApi.analytical<{ branches: { value: string; code: string }[] }>(
        book.book.id,
        'document-filter-options',
        {},
      ),
  });
  const branchCode =
    branch.data?.branches.find((item) => item.value === book.book.branchId)
      ?.code ?? '';
  const sample = () => {
    const bytes = createAccountingXlsx([
      method === 'branch'
        ? accountingBranchDocumentImportHeaders
        : accountingDocumentImportHeaders,
    ]);
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'سند حسابداری.xlsx';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const prepare = (input: string[][], first: boolean, mode = status) => {
    const result = prepareAccountingDocumentImport(
      input,
      book,
      first,
      mode === 'MEMORANDUM',
      method === 'branch' ? branchCode : undefined,
    );
    setDocuments(result.documents);
    setErrors(result.errors);
  };
  const receive = async () => {
    if (!canCreate || busy || reading || !typeId || !documents.length) return;
    const result = await run<{ items: AccountingJournalV1[]; total: number }>(
      'document-import-run',
      { typeId, saveMode: status, documents },
    );
    if (result?.items.length) {
      onOpen(result.items[0]!);
      setOpened(false);
      setRows([]);
      setDocuments([]);
    }
  };
  return (
    <>
      <DocumentIconAction
        label="دریافت از Excel"
        shortcut="Alt+I"
        disabled={busy || !canCreate}
        onClick={() => {
          setTypeId(initialTypeId);
          setFailure('');
          setOpened(true);
        }}
      >
        <FileSpreadsheet className="size-4" />
      </DocumentIconAction>
      <Dialog open={opened} onOpenChange={setOpened}>
        <DialogContent
          className="max-h-[85vh] overflow-auto max-w-3xl"
          data-document-shortcut-scope
        >
          <DialogTitle>دریافت از Excel</DialogTitle>
          <fieldset
            disabled={busy || reading}
            className="space-y-4 rounded border p-4"
          >
            <legend>تعریف تبادل</legend>
            <label className="grid gap-2">
              روش تبادل داده *
              <select
                className="border rounded p-2"
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value);
                  setRows([]);
                  setDocuments([]);
                  setErrors([]);
                  setFailure('');
                }}
              >
                <option value="branch">
                  سند حسابداری به همراه اقلام سندحسابداری با انتخاب شعبه در فایل
                  اکسل ورودی
                </option>
                <option value="journal">
                  سند حسابداری به همراه اقلام سندحسابداری
                </option>
              </select>
            </label>
            <DocumentIconAction
              label="دریافت اکسل نمونه"
              shortcut="Alt+T"
              onClick={sample}
            >
              <Download className="size-4" />
            </DocumentIconAction>
            <label className="grid gap-2">
              فایل داده‌ها *
              <input
                type="file"
                accept=".xlsx"
                disabled={method === 'branch' && !branchCode}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  setRows([]);
                  setDocuments([]);
                  setErrors([]);
                  setFailure('');
                  if (!file) return;
                  setReading(true);
                  try {
                    const data = await readAccountingDocumentWorkbook(
                      file,
                      method === 'branch',
                    );
                    setRows(data);
                    prepare(data, stop);
                  } catch (error) {
                    setFailure(
                      error instanceof Error
                        ? error.message
                        : 'فایل خوانده نشد.',
                    );
                  } finally {
                    setReading(false);
                  }
                }}
              />
            </label>
            {method === 'branch' ? (
              <p className="text-sm text-muted-foreground">
                فایل فقط می‌تواند شامل شعبه دفتر جاری باشد.
              </p>
            ) : null}
            {branch.isError && method === 'branch' ? (
              <p role="alert" className="text-destructive">
                خواندن کد شعبه انجام نشد.
              </p>
            ) : null}
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={stop}
                onChange={(event) => {
                  setStop(event.target.checked);
                  prepare(rows, event.target.checked);
                }}
              />
              دریافت داده با اولین خطا متوقف شود.
            </label>
          </fieldset>
          <fieldset
            disabled={busy || reading}
            className="space-y-4 rounded border p-4"
          >
            <legend>تنظیمات تبادل</legend>
            <label className="grid gap-2">
              وضعیت سند *
              <select
                className="border rounded p-2"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  prepare(rows, stop, event.target.value);
                }}
              >
                <option value="TEMP">موقت</option>
                <option value="MEMORANDUM">یادداشت</option>
              </select>
            </label>
            <label className="grid gap-2">
              نوع سند *
              <select
                className="border rounded p-2"
                value={typeId}
                onChange={(event) => setTypeId(event.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {book.configurations
                  .filter(
                    (type) => type.kind === 'voucher-types' && type.active,
                  )
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.title}
                    </option>
                  ))}
              </select>
            </label>
          </fieldset>
          {failure ? (
            <p role="alert" className="text-destructive">
              {failure}
            </p>
          ) : null}
          {errors.length ? (
            <ul role="alert" className="space-y-1 text-sm text-destructive">
              {errors.map((error) => (
                <li key={error.row}>
                  ردیف {error.row}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
          {rows.length ? (
            <p className="text-sm">
              {documents.length} سند معتبر،{' '}
              {documents.reduce((sum, doc) => sum + doc.lines.length, 0)} قلم
            </p>
          ) : null}
          <DocumentIconAction
            label="دریافت داده"
            shortcut="Alt+S"
            disabled={
              busy || reading || !canCreate || !typeId || !documents.length
            }
            onClick={() => void receive()}
          >
            <Upload className="size-4" />
          </DocumentIconAction>
        </DialogContent>
      </Dialog>
    </>
  );
}
