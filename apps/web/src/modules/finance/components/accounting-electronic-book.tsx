'use client';
import { useState } from 'react';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { apiRequest } from '../api/finance-inbox-api';
import type { CompletionLineReport } from '../accounting-completion-routes';
import { electronicBookRows } from '../accounting-electronic-book';
import { exportAccountingRows } from '../accounting-view-export';
import { AccountingButton as Button } from './accounting-operations';

export function AccountingElectronicBook({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const permissions = useAccessPermissions();
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [flags, setFlags] = useState({
    code: true,
    title: true,
    description: true,
  });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const exporting = async () => {
    if (busy || !permissions?.includes('finance.export') || !periodId) return;
    setBusy(true);
    setMessage('');
    try {
      const report = await apiRequest<CompletionLineReport>(
        `/finance/accounting/books/${book.book.id}/completion/journal-lines?${new URLSearchParams({ periodId, from, to, export: 'true' })}`,
      );
      await exportAccountingRows(electronicBookRows(report, flags), format);
      setMessage('فایل گزارش ساخته شد.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'دریافت خروجی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section dir="rtl" className="space-y-4">
      <h2 className="text-lg font-black">دفاتر تجاری الکترونیکی</h2>
      <p role="status">
        خروجی داخلی بر مبنای اسناد قطعی است؛ قالب رسمی ارسال دفاتر قانونی در این
        نسخه فعال نیست.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void exporting();
        }}
      >
        <fieldset
          disabled={busy}
          className="grid gap-4 border bg-background p-4 sm:grid-cols-2"
        >
          <FormField label="دوره مالی">
            <SearchCombobox
              label="دوره مالی"
              value={periodId}
              disabled={busy}
              onValueChange={setPeriod}
              options={book.periods.map((period) => ({
                value: period.id,
                label:
                  book.configurations.find(
                    (row) => row.id === period.fiscalYearId,
                  )?.title ?? period.startDate,
              }))}
            />
          </FormField>
          <FormField label="از تاریخ">
            <DatePicker
              aria-label="از تاریخ"
              value={from}
              disabled={busy}
              onChange={setFrom}
            />
          </FormField>
          <FormField label="تا تاریخ">
            <DatePicker
              aria-label="تا تاریخ"
              value={to}
              disabled={busy}
              onChange={setTo}
            />
          </FormField>
          <FormField label="نوع فایل خروجی">
            <SearchCombobox
              label="نوع فایل خروجی"
              value={format}
              disabled={busy}
              onValueChange={(value) =>
                setFormat(value === 'pdf' ? 'pdf' : 'xlsx')
              }
              options={[
                { value: 'xlsx', label: 'Excel' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </FormField>
          {(
            [
              ['code', 'همراه با کد حساب معین'],
              ['title', 'همراه با عنوان حساب معین'],
              ['description', 'همراه با شرح سند حسابداری'],
            ] as const
          ).map(([key, title]) => (
            <label className="flex items-center gap-2" key={key}>
              <input
                type="checkbox"
                checked={flags[key]}
                onChange={(event) =>
                  setFlags((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {title}
            </label>
          ))}
          <Button
            type="submit"
            permission="finance.export"
            disabled={busy || !periodId}
          >
            {busy ? 'در حال دریافت اطلاعات…' : 'ارسال به فایل'}
          </Button>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
