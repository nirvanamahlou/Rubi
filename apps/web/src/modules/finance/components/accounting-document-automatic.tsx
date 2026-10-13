'use client';
import { useState } from 'react';
import type {
  AccountingJournalV1,
  AccountingLineV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import Link from '@/i18n/link';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DocumentIconAction } from './accounting-document-filter';
import { AccountingJournalLines } from './accounting-journal-lines';
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Preview = {
  lines: AccountingLineV1[];
  periodId: string;
  checksum: string;
};
export function AccountingDocumentAutomatic({
  book,
  busy,
  run,
  canCreate,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: Run;
  canCreate: boolean;
}) {
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [head, setHead] = useState({
    templateId: '',
    asOf: '',
    documentDate: '',
    typeId: '',
    description: '',
    descriptionEn: '',
    auxiliaryNumber: '',
    trackingNumber: '',
    trackingDate: '',
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<AccountingJournalV1 | null>(null);
  const templates = book.templates.filter(
    (template) =>
      template.kind === 'AUTOMATIC' &&
      template.active &&
      template.attributes?.sourceForm === 'rahkaran-documents-v1',
  );
  const set = (key: keyof typeof head, value: string) => {
    setHead((current) => ({ ...current, [key]: value }));
    setPreview(null);
  };
  const issue = async (basis: Preview) => {
    const created = await run<AccountingJournalV1>('automatic-run', {
      ...head,
      checksum: basis.checksum,
    });
    if (created) {
      setResult(created);
      setStep(3);
    }
  };
  const next = async () => {
    if (busy || !canCreate) return;
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      const basis = await run<Preview>('automatic-preview', head);
      if (basis) {
        setPreview(basis);
        if (showPreview) setStep(2);
        else await issue(basis);
      }
    } else if (step === 2 && preview) await issue(preview);
  };
  const reset = () => {
    setStep(0);
    setPreview(null);
    setResult(null);
  };
  return (
    <section className="space-y-4" data-document-shortcut-scope>
      <ol
        className="flex flex-wrap gap-2 border-b pb-3 text-xs"
        aria-label="مراحل صدور سند اتوماتیک"
      >
        {['شرح', 'مشخصات سند', 'پیش نمایش سند', 'پایان'].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={`rounded px-3 py-2 ${step === index ? 'bg-primary text-primary-foreground' : 'bg-muted/40'}`}
          >
            {label}
          </li>
        ))}
      </ol>
      {step === 0 ? (
        <p className="text-sm">
          صدور سند اتوماتیک، بخشی از مانده حساب‌های مبدا را بر اساس درصد مقصدهای
          الگو منتقل می‌کند.
        </p>
      ) : null}
      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchCombobox
            label="الگو"
            value={head.templateId}
            disabled={busy}
            options={templates.map((template) => ({
              value: template.id,
              label: `${template.code} — ${template.title}`,
            }))}
            onValueChange={(value) => {
              const template = templates.find(
                (template) => template.id === value,
              );
              setHead((current) => ({
                ...current,
                templateId: value,
                description: template?.description ?? '',
                descriptionEn: template?.descriptionEn ?? '',
              }));
              setPreview(null);
            }}
          />
          <FormField label="تا تاریخ">
            <DatePicker
              value={head.asOf}
              onChange={(value) => set('asOf', value)}
              disabled={busy}
            />
          </FormField>
          <FormField label="شرح">
            <Textarea
              value={head.description}
              onChange={(event) => set('description', event.target.value)}
              disabled={busy}
            />
          </FormField>
          <FormField label="شماره پیگیری">
            <Input
              value={head.trackingNumber}
              onChange={(event) => set('trackingNumber', event.target.value)}
              disabled={busy}
            />
          </FormField>
          <SearchCombobox
            label="نوع سند"
            value={head.typeId}
            disabled={busy}
            options={book.configurations
              .filter((item) => item.kind === 'voucher-types' && item.active)
              .map((item) => ({ value: item.id, label: item.title }))}
            onValueChange={(value) => set('typeId', value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(event) => setShowPreview(event.target.checked)}
              disabled={busy}
            />
            پیش نمایش سند
          </label>
          <FormField label="شماره فرعی">
            <Input
              value={head.auxiliaryNumber}
              onChange={(event) => set('auxiliaryNumber', event.target.value)}
              disabled={busy}
            />
          </FormField>
          <FormField label="تاریخ سند">
            <DatePicker
              value={head.documentDate}
              onChange={(value) => set('documentDate', value)}
              disabled={busy}
            />
          </FormField>
          <FormField label="شرح به زبان دوم">
            <Input
              value={head.descriptionEn}
              onChange={(event) => set('descriptionEn', event.target.value)}
              disabled={busy}
            />
          </FormField>
          <FormField label="تاریخ پیگیری">
            <DatePicker
              value={head.trackingDate}
              onChange={(value) => set('trackingDate', value)}
              disabled={busy}
            />
          </FormField>
        </div>
      ) : null}
      {step === 2 && preview ? (
        <AccountingJournalLines
          book={book}
          rows={preview.lines}
          onChange={() => undefined}
          readonly
          periodId={preview.periodId}
        />
      ) : null}
      {step === 3 && result ? (
        <p role="status" className="text-sm">
          سند با وضعیت ثبت موقت ایجاد شد.{' '}
          <Link
            href={`/finance/accounting/general-ledger/documents/journals?bookId=${book.book.id}&journalId=${result.id}`}
          >
            مشاهده سند حسابداری
          </Link>
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
        {step > 0 && step < 3 ? (
          <DocumentIconAction
            label="برگشت"
            shortcut="Alt+ArrowRight"
            disabled={busy}
            onClick={() => setStep(step - 1)}
          >
            <ArrowRight className="size-4" />
          </DocumentIconAction>
        ) : null}
        <DocumentIconAction
          label={step === 3 ? 'پایان' : 'ادامه'}
          shortcut="Alt+Enter"
          disabled={
            busy ||
            !canCreate ||
            (step === 1 &&
              (!head.templateId ||
                !head.asOf ||
                !head.documentDate ||
                !head.typeId ||
                !head.description.trim()))
          }
          onClick={() => {
            if (step === 3) reset();
            else void next();
          }}
        >
          {step === 3 ? (
            <Check className="size-4" />
          ) : (
            <ArrowLeft className="size-4" />
          )}
        </DocumentIconAction>
      </footer>
    </section>
  );
}
