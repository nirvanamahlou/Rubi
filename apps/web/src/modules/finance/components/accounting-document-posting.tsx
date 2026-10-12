'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, X } from 'lucide-react';
import Link from '@/i18n/link';
import { DatePicker } from '@/components/ui/date-picker';
import { DocumentIconAction } from './accounting-document-filter';
import { journalDisplayTotals } from '../accounting-money';
import { accountingApi } from '../api/accounting-api';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Preview = {
  fromDate: string;
  toDate: string;
  periodId: string;
  rows: AccountingJournalV1[];
  warnings: string[];
  checksum: string;
};
const steps = ['شرح', 'فیلتر', 'فهرست', 'اسناد خلاف ماهیت', 'پایان'];
export function AccountingDocumentPosting({
  book,
  busy,
  run,
  canPost,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
  canPost: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [toDate, setToDate] = useState(
    book.periods.some(
      (period) =>
        period.status === 'OPEN' &&
        period.startDate <= today &&
        period.endDate >= today,
    )
      ? today
      : '',
  );
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [count, setCount] = useState(0);
  const interval = useQuery({
    queryKey: ['accounting', 'document-posting-context', book.book.id, toDate],
    enabled: step === 1 && Boolean(toDate) && canPost,
    queryFn: () =>
      accountingApi.analytical<{ fromDate: string; toDate: string }>(
        book.book.id,
        'document-posting-context',
        { toDate },
      ),
    staleTime: 0,
  });
  const reset = () => {
    setStep(0);
    setPreview(null);
    setAcknowledged(false);
    setCount(0);
  };
  const next = async () => {
    if (busy || !canPost) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!toDate) return;
      const result = await run<Preview>('document-posting-preview', { toDate });
      if (result) {
        setPreview(result);
        setAcknowledged(false);
        setStep(2);
      }
      return;
    }
    if (step === 2 && preview?.warnings.length) {
      setStep(3);
      return;
    }
    if ((step === 2 || step === 3) && preview?.rows.length) {
      if (preview.warnings.length && !acknowledged) return;
      const result = await run<{ items: AccountingJournalV1[] }>(
        'post-documents',
        {
          toDate: preview.toDate,
          checksum: preview.checksum,
          acknowledgeWarnings: acknowledged,
        },
      );
      if (result) {
        setCount(result.items.length);
        setStep(4);
      }
    }
  };
  const noRows = step === 2 && preview?.rows.length === 0;
  const commit =
    step === 3 || (step === 2 && !preview?.warnings.length && !noRows);
  return (
    <section className="space-y-4" data-document-shortcut-scope>
      <ol
        className="flex flex-wrap gap-2 border-b pb-3 text-xs"
        aria-label="مراحل قطعی کردن اسناد"
      >
        {steps.map((title, index) => (
          <li
            key={title}
            aria-current={step === index ? 'step' : undefined}
            className={`rounded px-3 py-2 ${step === index ? 'bg-primary text-primary-foreground' : 'bg-muted/40'}`}
          >
            {title}
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <div className="space-y-2 text-sm">
          <p>قطعی کردن اسناد حسابداری</p>
          <p>
            اسناد قطعی‌شده قابل ویرایش و برگشت از قطعیت نیستند. در محدوده
            قطعی‌شده امکان صدور سند جدید وجود ندارد.
          </p>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>از تاریخ</span>
            <input
              aria-label="از تاریخ"
              readOnly
              className="w-full rounded border bg-muted/20 p-2"
              value={interval.data?.fromDate ?? ''}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>تا تاریخ</span>
            <DatePicker
              value={toDate}
              onChange={(value) => {
                setToDate(value);
                setPreview(null);
              }}
              disabled={busy}
            />
          </label>
        </div>
      ) : null}
      {step === 1 && interval.error ? (
        <p role="alert" className="text-sm text-destructive">
          {interval.error.message}
        </p>
      ) : null}
      {step === 2 ? (
        <div className="overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                {['شماره سند', 'شماره عطف', 'تاریخ سند', 'شرح', 'مبلغ سند'].map(
                  (label) => (
                    <th className="border p-2 text-right" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {preview?.rows.map((row) => (
                <tr key={row.id}>
                  <td className="border p-2">
                    <Link
                      href={`/finance/accounting/general-ledger/documents/journals?bookId=${book.book.id}&journalId=${row.id}`}
                    >
                      {row.number ?? 'مشاهده'}
                    </Link>
                  </td>
                  <td className="border p-2">{row.reference ?? ''}</td>
                  <td className="border p-2">{row.documentDate}</td>
                  <td className="border p-2">{row.description}</td>
                  <td className="border p-2">
                    {journalDisplayTotals(row.lines).debit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {noRows ? (
            <p role="status" className="p-4 text-sm">
              سند بررسی‌شده‌ای برای قطعی‌کردن وجود ندارد.
            </p>
          ) : null}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3">
          <ul className="space-y-2 text-sm">
            {preview?.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            با وجود اخطارهای نمایش‌داده‌شده اسناد قطعی شوند.
          </label>
        </div>
      ) : null}
      {step === 4 ? (
        <p role="status" className="text-sm">
          {count} سند قطعی شد.
        </p>
      ) : null}
      <footer className="flex justify-end gap-2 border-t pt-3">
        <DocumentIconAction
          label="انصراف"
          shortcut="Alt+Escape"
          disabled={busy}
          onClick={reset}
        >
          <X className="size-4" />
        </DocumentIconAction>
        {step > 0 && step < 4 ? (
          <DocumentIconAction
            label="برگشت"
            shortcut="Alt+ArrowRight"
            disabled={busy}
            onClick={() => {
              setStep(step - 1);
              setAcknowledged(false);
            }}
          >
            <ArrowRight className="size-4" />
          </DocumentIconAction>
        ) : null}
        <DocumentIconAction
          label={
            step === 4 || noRows ? 'پایان' : commit ? 'قطعی کردن' : 'ادامه'
          }
          shortcut="Alt+Enter"
          disabled={
            busy ||
            !canPost ||
            (step === 1 && !toDate) ||
            (step === 3 && !acknowledged)
          }
          onClick={() => {
            if (step === 4 || noRows) reset();
            else void next();
          }}
        >
          {step === 4 || noRows ? (
            <Check className="size-4" />
          ) : commit ? (
            <LockKeyhole className="size-4" />
          ) : (
            <ArrowLeft className="size-4" />
          )}
        </DocumentIconAction>
      </footer>
    </section>
  );
}
