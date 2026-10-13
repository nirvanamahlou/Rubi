'use client';
import { useState } from 'react';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { ArrowLeft, ArrowRight, X, Save } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { DocumentIconAction } from './accounting-document-filter';
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Preview = {
  branchName?: string;
  branchCode?: string;
  checksum: string;
  items: {
    id: string;
    number: number | null;
    documentDate: string;
    description: string;
    reference: string | null;
    attributes: Record<string, unknown>;
    typeId: string | null;
    makerName?: string;
  }[];
};
type Issued = {
  documents: {
    id: string;
    number: number;
    documentDate: string;
    version: number;
    lines: { accountId: string; debit: string; credit: string }[];
  }[];
};
const steps = [
  'شرح راهبر',
  'تعیین وضعیت فیلترها',
  'فهرست اسناد',
  'سند کل',
  'پایان عملیات صدور سند کل',
];
export function AccountingDocumentGeneral({
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
  const period = book.periods.find(
    (row) =>
      row.status === 'OPEN' && row.startDate <= today && row.endDate >= today,
  );
  const [step, setStep] = useState(0);
  const [fromDate, setFromDate] = useState(period?.startDate ?? '');
  const [toDate, setToDate] = useState(period ? today : '');
  const [filter, setFilter] = useState('date');
  const [method, setMethod] = useState('NONE');
  const [separateYearEnd, setSeparateYearEnd] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const input = () => ({
    periodId: period?.id,
    fromDate,
    toDate,
    filter,
    method,
    separateYearEnd,
  });
  const reset = () => {
    setStep(0);
    setPreview(null);
    setIssued(null);
    setDates({});
    setError('');
  };
  const saveDate = async (document: Issued['documents'][number]) => {
    const documentDate = dates[document.id];
    if (
      busy ||
      !canPost ||
      !documentDate ||
      documentDate === document.documentDate
    )
      return;
    const result = await run<Issued['documents'][number]>(
      'general-document-date',
      { id: document.id, documentDate },
      document.version,
    );
    if (result)
      setIssued((current) =>
        current
          ? {
              documents: current.documents.map((item) =>
                item.id === result.id ? result : item,
              ),
            }
          : current,
      );
  };
  const next = async () => {
    if (busy || !canPost) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!period || !fromDate || !toDate) {
        setError('دوره مالی جاری و بازه تاریخ معتبر لازم است.');
        return;
      }
      const result = await run<Preview>('general-document-preview', input());
      if (result) {
        setError('');
        setPreview(result);
        setStep(result.items.length ? 2 : 4);
      }
    } else if (step === 2) {
      if (!preview) return;
      const result = await run<Issued>('general-document-issue', {
        ...input(),
        checksum: preview.checksum,
      });
      if (result) {
        setIssued(result);
        setStep(3);
      }
    } else if (step === 3) setStep(4);
  };
  return (
    <section
      dir="rtl"
      className="space-y-4"
      onKeyDown={(event) => {
        if (event.altKey && event.key === 'Enter') {
          event.preventDefault();
          void next();
        } else if (
          event.altKey &&
          event.key === 'ArrowRight' &&
          step > 0 &&
          step < 3
        ) {
          event.preventDefault();
          setStep(step - 1);
        } else if (event.altKey && event.key === 'Escape') {
          event.preventDefault();
          reset();
        }
      }}
    >
      <nav aria-label="مراحل صدور سند کل" className="flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <span
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`rounded border px-3 py-2 text-sm ${step === index ? 'bg-primary text-primary-foreground' : 'bg-muted/30'}`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </nav>
      <div
        role="toolbar"
        aria-label="عملیات راهبر سند کل"
        className="flex justify-end gap-1 border-y bg-muted/20 p-2"
      >
        <DocumentIconAction
          label="ادامه"
          shortcut="Alt+Enter"
          disabled={busy || !canPost || step === 4}
          onClick={() => void next()}
        >
          <ArrowLeft className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="بازگشت"
          shortcut="Alt+ArrowRight"
          disabled={busy || step === 0 || step >= 3}
          onClick={() => setStep(step - 1)}
        >
          <ArrowRight className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="انصراف"
          shortcut="Alt+Escape"
          disabled={busy}
          onClick={reset}
        >
          <X className="size-4" />
        </DocumentIconAction>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {step === 0 ? (
        <p className="text-sm">
          سند کل حاصل تجمیع گردش اسناد قطعی بر مبنای حساب کل است.
        </p>
      ) : null}
      {step === 1 ? (
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            فیلتر
            <select
              aria-label="فیلتر سند کل"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="block h-10 w-full rounded border bg-background"
            >
              <option value="date">تاریخ</option>
              <option value="number" disabled>
                شماره سند
              </option>
            </select>
          </label>
          <div />
          <label className="space-y-1 text-sm">
            از تاریخ
            <DatePicker value={fromDate} onChange={setFromDate} />
          </label>
          <label className="space-y-1 text-sm">
            تا تاریخ
            <DatePicker value={toDate} onChange={setToDate} />
          </label>
        </div>
      ) : null}
      {step === 2 && preview ? (
        <>
          <div className="overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {[
                    'کد شعبه',
                    'عنوان شعبه',
                    'شماره سند',
                    'تاریخ',
                    'وضعیت',
                    'نوع سند',
                    'شرح',
                    'شماره عطف',
                    'شماره فرعی',
                    'شماره روزانه',
                    'صادر کننده',
                  ].map((label) => (
                    <th key={label} className="p-2 text-right">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.items.map((row) => (
                  <tr key={row.id} className="border-t even:bg-muted/20">
                    <td className="p-2">{preview.branchCode ?? ''}</td>
                    <td className="p-2">{preview.branchName ?? ''}</td>
                    <td>{row.number}</td>
                    <td dir="ltr">{row.documentDate}</td>
                    <td>قطعی شده</td>
                    <td>
                      {
                        book.configurations.find(
                          (item) => item.id === row.typeId,
                        )?.title
                      }
                    </td>
                    <td>{row.description}</td>
                    <td>{row.reference}</td>
                    <td>{String(row.attributes.auxiliaryNumber ?? '')}</td>
                    <td>{String(row.attributes.dailyNumber ?? '')}</td>
                    <td>{row.makerName ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="block max-w-md space-y-1 text-sm">
            روش صدور سند
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              aria-label="روش صدور سند کل"
              className="block h-10 w-full rounded border bg-background"
            >
              <option value="NONE"></option>
              <option value="MONTHLY">صدور سند ماهانه</option>
              <option value="DAILY">صدور سند روزانه</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={separateYearEnd}
              onChange={(event) => setSeparateYearEnd(event.target.checked)}
            />
            صدور سند کل مجزا برای اسناد پایان سال
          </label>
        </>
      ) : null}
      {step === 3 && issued ? (
        <div className="space-y-4">
          {issued.documents.map((document) => (
            <section
              key={document.id}
              className="rounded border p-3"
              onKeyDown={(event) => {
                if (
                  event.altKey &&
                  event.shiftKey &&
                  event.key.toLowerCase() === 's'
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  void saveDate(document);
                }
              }}
            >
              <p className="mb-2 text-sm">
                شماره: {document.number} — تاریخ:{' '}
                <span dir="ltr">{document.documentDate}</span>
              </p>
              <div className="mb-3 flex items-center gap-2">
                <label className="text-sm">
                  تاریخ سند کل
                  <DatePicker
                    value={dates[document.id] ?? document.documentDate}
                    onChange={(value) =>
                      setDates((current) => ({
                        ...current,
                        [document.id]: value,
                      }))
                    }
                  />
                </label>
                <DocumentIconAction
                  label="ذخیره تاریخ سند کل"
                  shortcut="Alt+Shift+S"
                  disabled={
                    busy ||
                    !canPost ||
                    !dates[document.id] ||
                    dates[document.id] === document.documentDate
                  }
                  onClick={() => void saveDate(document)}
                >
                  <Save className="size-4" />
                </DocumentIconAction>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-right">حساب کل</th>
                    <th>بدهکار</th>
                    <th>بستانکار</th>
                  </tr>
                </thead>
                <tbody>
                  {document.lines.map((line) => (
                    <tr key={line.accountId}>
                      <td>
                        {
                          book.accounts.find(
                            (account) => account.id === line.accountId,
                          )?.title
                        }
                      </td>
                      <td dir="ltr">{line.debit}</td>
                      <td dir="ltr">{line.credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      ) : null}
      {step === 4 ? (
        <p role="status" className="text-sm">
          {issued
            ? `${issued.documents.length} سند کل صادر شد.`
            : 'سند قطعی که برای آن سند کل صادر نشده باشد وجود ندارد.'}
        </p>
      ) : null}
    </section>
  );
}
