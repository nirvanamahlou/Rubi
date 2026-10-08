'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingJournalV1,
  AccountingConfigurationV1,
} from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Preview = {
  basisChecksum: string;
  rows: {
    accountId: string;
    currency: string;
    quantity: string;
    base: string;
    rate: string;
    newValue: string;
    difference: string;
  }[];
};
export function AccountingAdvancedWorkspace({
  book,
  section,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  section: string;
  run: Run;
  busy: boolean;
}) {
  const [periodId, setPeriod] = useState(''),
    [date, setDate] = useState(''),
    [typeId, setType] = useState(''),
    [gainAccountId, setGain] = useState(''),
    [lossAccountId, setLoss] = useState(''),
    [reason, setReason] = useState(''),
    [rates, setRates] = useState<Record<string, string>>({}),
    [mappingId, setMapping] = useState(''),
    [preview, setPreview] = useState<Preview | null>(null),
    [journal, setJournal] = useState<AccountingJournalV1 | null>(null),
    [batch, setBatch] = useState<AccountingConfigurationV1 | null>(null);
  const choose = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <FormField label={label}>
      <SearchCombobox
        label={label}
        value={value}
        onValueChange={(v) => {
          setPreview(null);
          onChange(v);
        }}
        options={options}
      />
    </FormField>
  );
  const periods = book.periods.map((p) => ({
    value: p.id,
    label: `${book.configurations.find((c) => c.id === p.fiscalYearId)?.title ?? p.startDate} · ${p.status === 'OPEN' ? 'باز' : 'بسته'}`,
  }));
  const accounts = book.accounts
    .filter((a) => a.active && a.level === 'SUBSIDIARY')
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }));
  const payload = () => ({
    periodId,
    asOfDate: date,
    typeId,
    gainAccountId,
    lossAccountId,
    rates,
    reason,
    basisChecksum: preview?.basisChecksum,
  });
  const download = async (record: AccountingConfigurationV1) => {
    const r = await run<{ filename: string; content: string }>(
      'export-batch',
      { id: record.id },
      record.version,
    );
    if (!r) return;
    const url = URL.createObjectURL(
        new Blob([r.content], { type: 'application/json;charset=utf-8' }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = r.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (section.endsWith('/revaluation'))
    return (
      <section className="space-y-5">
        <h2 className="text-lg font-black">تسعیر ارز</h2>
        <p>
          مانده ارزی اسناد قطعی با نرخ مصوب انتخاب‌شده محاسبه می‌شود. نتیجه پس
          از کنترل، سند پیش‌نویس می‌سازد.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {choose('دوره مالی', periodId, setPeriod, periods)}
          <FormField label="تاریخ تسعیر">
            <DatePicker
              aria-label="تاریخ تسعیر"
              value={date}
              onChange={(v) => {
                setDate(v);
                setPreview(null);
              }}
            />
          </FormField>
          {choose(
            'نوع سند',
            typeId,
            setType,
            book.configurations
              .filter((c) => c.kind === 'voucher-types' && c.active)
              .map((c) => ({ value: c.id, label: c.title })),
          )}
          {choose('حساب سود تسعیر', gainAccountId, setGain, accounts)}
          {choose('حساب زیان تسعیر', lossAccountId, setLoss, accounts)}
          <FormField label="دلیل عملیات">
            <Textarea
              aria-label="دلیل عملیات"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          {[
            ...new Set(
              book.fxRates
                .filter((r) => r.status === 'APPROVED')
                .map((r) => r.currency),
            ),
          ].map((currency) => (
            <div key={currency}>
              {choose(
                `نرخ ${currency}`,
                rates[currency] ?? '',
                (v) => setRates((s) => ({ ...s, [currency]: v })),
                book.fxRates
                  .filter(
                    (r) => r.currency === currency && r.status === 'APPROVED',
                  )
                  .map((r) => ({
                    value: r.id,
                    label: `${r.rate} · ${r.source}`,
                  })),
              )}
            </div>
          ))}
        </div>
        <Button
          permission="finance.journal.create"
          disabled={busy}
          onClick={async () => {
            const r = await run<Preview>('revaluation-preview', payload());
            if (r) setPreview(r);
          }}
        >
          پیش‌نمایش تسعیر
        </Button>
        {preview ? (
          <>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'حساب',
                      'ارز',
                      'مانده ارزی',
                      'ارزش فعلی',
                      'نرخ',
                      'ارزش جدید',
                      'اختلاف',
                    ].map((h) => (
                      <th className="p-3 text-start" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      {[
                        book.accounts.find((a) => a.id === r.accountId)
                          ?.title ?? '',
                        r.currency,
                        r.quantity,
                        r.base,
                        r.rate,
                        r.newValue,
                        r.difference,
                      ].map((v, n) => (
                        <td key={n} className="p-3">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              permission="finance.journal.create"
              disabled={busy}
              onClick={async () => {
                const r = await run<AccountingJournalV1>(
                  'revaluation-run',
                  payload(),
                );
                if (r) {
                  setJournal(r);
                  setPreview(null);
                }
              }}
            >
              ایجاد سند تسعیر
            </Button>
          </>
        ) : null}
        {journal ? (
          <Link
            className="text-primary"
            href={`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${journal.id}`}
          >
            مشاهده سند تسعیر
          </Link>
        ) : null}
      </section>
    );
  if (section.endsWith('/transfer-batches'))
    return (
      <section className="space-y-5">
        <h2 className="text-lg font-black">بسته انتقال حسابداری</h2>
        <p>
          بسته، نسخه ثابت اسناد قطعی و نگاشت حساب‌ها را نگه می‌دارد. ارسال به
          مرجع بیرونی پس از تعیین قرارداد اتصال فعال می‌شود.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {choose('دوره مالی', periodId, setPeriod, periods)}
          {choose(
            'نسخه نگاشت',
            mappingId,
            setMapping,
            book.configurations
              .filter((c) => c.kind === 'account-mappings' && c.active)
              .map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` })),
          )}
        </div>
        <Button
          permission="finance.account.manage"
          disabled={busy}
          onClick={async () => {
            const mapping = book.configurations.find((c) => c.id === mappingId);
            const r = await run<AccountingConfigurationV1>('create-batch', {
              periodId,
              mappingId,
              mappingVersion: mapping?.version,
            });
            if (r) setBatch(r);
          }}
        >
          ساخت و کنترل بسته
        </Button>
        {batch ? (
          <p role="status">بسته {batch.title} آماده دریافت است.</p>
        ) : null}
        <div className="space-y-3">
          {book.configurations
            .filter((c) => c.kind === 'posting-batches')
            .map((c) => (
              <article className="rounded-xl border p-4 space-y-2" key={c.id}>
                <p className="font-bold">{c.title}</p>
                <p>
                  {c.attributes.state === 'EXPORTED'
                    ? 'خروجی دریافت‌شده'
                    : 'کنترل‌شده'}{' '}
                  · نسخه نگاشت {String(c.attributes.mappingVersion)}
                </p>
                <p className="break-all text-xs" dir="ltr">
                  SHA-256: {String(c.attributes.checksum)}
                </p>
                <Button
                  permission="finance.export"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void download(c)}
                >
                  دریافت بسته JSON
                </Button>
              </article>
            ))}
        </div>
      </section>
    );
  return (
    <AccountingTaxGate book={book} section={section} run={run} busy={busy} />
  );
}
function AccountingTaxGate({
  book,
  section,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  section: string;
  run: Run;
  busy: boolean;
}) {
  const [code, setCode] = useState(''),
    [title, setTitle] = useState(''),
    [sellerProfileRef, setSeller] = useState(''),
    [connectorRef, setConnector] = useState(''),
    [schemaVersion, setSchema] = useState(''),
    [environment, setEnvironment] = useState('SANDBOX');
  const settings = section.endsWith('/settings');
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">
        {settings
          ? 'تنظیمات مودیان'
          : section.endsWith('/invoices')
            ? 'صورتحساب مالیاتی'
            : 'گزارش مالیاتی'}
      </h2>
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="font-bold">نیازمند قرارداد معتبر سامانه مالیاتی</p>
        <p>
          نسخه قالب، هویت فروشنده و اتصال تأییدشده هنوز پیکربندی نشده‌اند. تولید
          شناسه مالیاتی، محاسبه نرخ قانونی، ارسال، استعلام و گزارش قانونی پس از
          تکمیل این پیش‌نیازها فعال می‌شوند.
        </p>
      </div>
      {settings ? (
        <>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await run('save-configuration', {
                kind: 'tax-settings',
                code,
                title,
                attributes: {
                  sellerProfileRef,
                  connectorRef,
                  schemaVersion,
                  environment,
                },
                active: false,
              });
              if (r) {
                setCode('');
                setTitle('');
              }
            }}
          >
            {[
              { label: 'کد پیکربندی', value: code, set: setCode },
              { label: 'عنوان', value: title, set: setTitle },
              {
                label: 'مرجع هویت فروشنده',
                value: sellerProfileRef,
                set: setSeller,
              },
              { label: 'مرجع اتصال', value: connectorRef, set: setConnector },
              {
                label: 'نسخه قرارداد مقصد',
                value: schemaVersion,
                set: setSchema,
              },
            ].map((f) => (
              <FormField key={f.label} label={f.label}>
                <Input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                />
              </FormField>
            ))}
            <FormField label="محیط">
              <SearchCombobox
                label="محیط"
                value={environment}
                onValueChange={setEnvironment}
                options={[
                  { value: 'SANDBOX', label: 'آزمایشی' },
                  { value: 'PRODUCTION', label: 'عملیاتی' },
                ]}
              />
            </FormField>
            <div>
              <Button
                permission="finance.account.manage"
                type="submit"
                disabled={busy}
              >
                ذخیره درخواست پیکربندی
              </Button>
            </div>
          </form>
          <p className="text-sm">
            کلید اتصال در بخش یکپارچه‌سازی مدیریت می‌شود. ذخیره درخواست، اتصال
            را فعال نمی‌کند.
          </p>
          {book.configurations
            .filter((c) => c.kind === 'tax-settings')
            .map((c) => (
              <article key={c.id} className="rounded-xl border p-4">
                <p className="font-bold">
                  {c.code} — {c.title}
                </p>
                <p>
                  {String(c.attributes.environment)} · نسخه{' '}
                  {String(c.attributes.schemaVersion)} · منتظر اعتبارسنجی اتصال
                </p>
              </article>
            ))}
        </>
      ) : (
        <>
          <p>
            پس از آماده‌شدن اتصال، فهرست و جزئیات قابل ردیابی از منابع ERP در
            این صفحه ارائه می‌شود.
          </p>
          <Link
            className="text-primary"
            href="/finance/accounting/taxpayer-system/settings"
          >
            تنظیمات مودیان
          </Link>
        </>
      )}
    </section>
  );
}
