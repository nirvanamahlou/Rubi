'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingCommandV1,
  AccountingJournalV1,
} from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import Link from '@/i18n/link';
import { AccountingObservedYearEnd } from './accounting-observed-year-end';
type Preflight = {
  unfinished: number;
  checksum: string;
  lines?: { accountId: string; debit: string; credit: string }[];
  balances: { accountId: string; balance: string; permanent: boolean }[];
};
export function AccountingYearEndWorkspace(
  props: Parameters<typeof YearEndWorkspace>[0],
) {
  if (props.mode === 'closing' || props.mode === 'nature-adjustment') {
    return <AccountingObservedYearEnd key={props.mode} mode={props.mode} />;
  }
  return <YearEndWorkspace {...props} />;
}

function YearEndWorkspace({
  book,
  run,
  busy,
  mode,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  mode: 'closing' | 'opening' | 'final' | 'nature-adjustment';
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const [periodId, setPeriodId] = useState(''),
    [nextPeriodId, setNextPeriodId] = useState(''),
    [retainedAccountId, setRetainedAccountId] = useState(''),
    [typeId, setTypeId] = useState(''),
    [date, setDate] = useState(''),
    [preflight, setPreflight] = useState<Preflight | null>(null),
    [result, setResult] = useState<AccountingJournalV1 | null>(null);
  const period = book.periods.find((p) => p.id === periodId);
  const [templateId, setTemplateId] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [previewBasis, setPreviewBasis] = useState('');
  const [auxiliaryNumber, setAuxiliaryNumber] = useState('');
  const template = book.templates.find((t) => t.id === templateId);
  const payload = {
    periodId,
    nextPeriodId,
    retainedAccountId,
    typeId,
    documentDate: date,
    auxiliaryNumber,
    fxCarryPolicy: 'HISTORICAL_LOTS',
    operation: `year-end-${mode}`,
    ...(templateId && mode === 'closing'
      ? { templateId, templateVersion: template?.version }
      : {}),
    ...(mode === 'nature-adjustment' ? { accountIds } : {}),
  };
  const basis = JSON.stringify(payload);
  const current = !!preflight && previewBasis === basis;
  const titles = {
    closing: 'صدور سند بستن حساب‌ها',
    opening: 'صدور سند افتتاحیه',
    final: 'صدور سند اختتامیه',
    'nature-adjustment': 'تعدیل ماهیت',
  };
  const preview = async () => {
    setPreflight(null);
    const r = await run<Preflight>('year-end-preview', payload);
    if (r) {
      setPreflight(r);
      setPreviewBasis(basis);
    }
  };
  const generate = async () => {
    if (!current) return;
    const r = await run<AccountingJournalV1>(`year-end-${mode}`, {
      ...payload,
      checksum: preflight!.checksum,
    });
    if (r) {
      setResult(r);
      setPreflight(null);
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">{titles[mode]}</h2>
      <p className="text-sm text-muted-foreground">
        افتتاحیه و بستن ارزی، مقادیر و ارزش تاریخی هر نرخ مصوب را از اسناد قطعی
        مبدأ حفظ می‌کند؛ تغییر نرخ با تسعیر جداگانه انجام می‌شود.
      </p>
      <ol className="grid gap-3 text-sm sm:grid-cols-4">
        {[
          '۱. کنترل اسناد و مانده‌ها',
          mode === 'opening'
            ? '۲. کنترل بسته‌بودن دوره مبدأ'
            : '۲. کنترل حساب‌های منتخب',
          mode === 'opening'
            ? '۳. انتقال مانده‌های دائمی'
            : '۳. ایجاد پیش‌نویس سند',
          mode === 'opening'
            ? '۴. ایجاد پیش‌نویس افتتاحیه'
            : '۴. تأیید و ثبت از فهرست اسناد',
        ].map((t) => (
          <li key={t} className="rounded-xl border bg-muted/30 p-3">
            {t}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'closing' && (
          <FormField label="الگوی بستن حساب">
            <SearchCombobox
              label="الگوی بستن حساب"
              value={templateId}
              onValueChange={(id) => {
                setTemplateId(id);
                const selected = book.templates.find((t) => t.id === id);
                if (selected) {
                  setTypeId(selected.voucherTypeId ?? '');
                  setRetainedAccountId(selected.retainedAccountId ?? '');
                }
              }}
              options={book.templates
                .filter((t) => t.kind === 'CLOSING' && t.active)
                .map((t) => ({ value: t.id, label: `${t.code} — ${t.title}` }))}
            />
          </FormField>
        )}
        <FormField label="دوره مبدأ">
          <SearchCombobox
            label="دوره مبدأ"
            value={periodId}
            onValueChange={(id) => {
              setPeriodId(id);
              setPreflight(null);
              setResult(null);
            }}
            options={book.periods.map((p) => ({
              value: p.id,
              label: `${book.configurations.find((c) => c.id === p.fiscalYearId)?.title ?? ''} · ${p.status === 'OPEN' ? 'باز' : 'بسته'}`,
            }))}
          />
        </FormField>
        <FormField label="دوره مقصد افتتاحیه">
          <SearchCombobox
            label="دوره مقصد"
            value={nextPeriodId}
            onValueChange={setNextPeriodId}
            options={book.periods
              .filter((p) => p.status === 'OPEN' && p.id !== periodId)
              .map((p) => ({
                value: p.id,
                label:
                  book.configurations.find((c) => c.id === p.fiscalYearId)
                    ?.title ?? p.startDate,
              }))}
          />
        </FormField>
        <FormField
          label={
            mode === 'final' || mode === 'nature-adjustment'
              ? 'حساب مقابل'
              : 'حساب دائمی سود و زیان'
          }
        >
          <SearchCombobox
            label="حساب سود و زیان"
            value={retainedAccountId}
            onValueChange={setRetainedAccountId}
            options={book.accounts
              .filter(
                (a) => a.active && a.permanent && a.level === 'SUBSIDIARY',
              )
              .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }))}
          />
        </FormField>
        {mode === 'nature-adjustment' && (
          <fieldset className="rounded-xl border p-3">
            <legend>حساب‌های مجاز تعدیل</legend>
            {book.accounts
              .filter(
                (a) =>
                  a.active && a.level === 'SUBSIDIARY' && a.nature !== 'ANY',
              )
              .map((a) => (
                <label key={a.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={accountIds.includes(a.id)}
                    onChange={(e) =>
                      setAccountIds((ids) =>
                        e.target.checked
                          ? [...ids, a.id]
                          : ids.filter((id) => id !== a.id),
                      )
                    }
                  />
                  {a.code} — {a.title}
                </label>
              ))}
          </fieldset>
        )}
        <FormField label="نوع سند">
          <SearchCombobox
            label="نوع سند"
            value={typeId}
            onValueChange={setTypeId}
            options={book.configurations
              .filter((c) => c.kind === 'voucher-types' && c.active)
              .map((c) => ({ value: c.id, label: c.title }))}
          />
        </FormField>
        <FormField label="تاریخ سند بستن یا افتتاحیه">
          <DatePicker
            aria-label="تاریخ سند بستن یا افتتاحیه"
            value={date}
            onChange={setDate}
          />
        </FormField>
        {(mode === 'final' || mode === 'opening') && (
          <FormField label="شماره فرعی">
            <Input
              aria-label="شماره فرعی"
              value={auxiliaryNumber}
              onChange={(e) => setAuxiliaryNumber(e.target.value)}
            />
          </FormField>
        )}
      </div>
      <Button
        permission="finance.period.close"
        variant="outline"
        disabled={busy || !periodId}
        onClick={() => void preview()}
      >
        کنترل پیش‌نیازها
      </Button>
      {current ? (
        <>
          <p role="status">اسناد نهایی‌نشده: {preflight!.unfinished}</p>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {['حساب', 'نوع', 'مانده'].map((t) => (
                    <th key={t} className="p-3 text-start">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preflight!.balances.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">
                      {book.accounts.find((a) => a.id === r.accountId)?.title}
                    </td>
                    <td className="p-3">{r.permanent ? 'دائمی' : 'موقت'}</td>
                    <td className="p-3">{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preflight!.lines && (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['حساب', 'بدهکار', 'بستانکار'].map((t) => (
                      <th key={t} className="p-3 text-start">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preflight!.lines.map((r, i) => (
                    <tr key={i}>
                      <td className="p-3">
                        {book.accounts.find((a) => a.id === r.accountId)?.title}
                      </td>
                      <td className="p-3">{r.debit}</td>
                      <td className="p-3">{r.credit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {mode === 'closing' ? (
              <>
                <Button
                  permission="finance.period.close"
                  disabled={
                    busy ||
                    preflight!.unfinished > 0 ||
                    period?.status !== 'OPEN'
                  }
                  onClick={() => void generate()}
                >
                  ایجاد سند بستن موقت‌ها
                </Button>
              </>
            ) : (
              <Button
                permission="finance.period.close"
                disabled={
                  busy ||
                  preflight!.unfinished > 0 ||
                  period?.status !== (mode === 'opening' ? 'CLOSED' : 'OPEN')
                }
                onClick={() => void generate()}
              >
                {titles[mode]}
              </Button>
            )}
          </div>
        </>
      ) : null}
      {(mode === 'closing' || mode === 'final') && (
        <Button
          permission="finance.period.close"
          variant="outline"
          disabled={busy || !period || period.status !== 'OPEN'}
          onClick={() => {
            if (
              period &&
              window.confirm(
                'دوره بسته شود؟ ثبت سند جدید در این دوره متوقف خواهد شد.',
              )
            )
              void run('close-period', { id: period.id }, period.version).then(
                (r) => {
                  if (r) setPreflight(null);
                },
              );
          }}
        >
          بستن دوره
        </Button>
      )}
      {result ? (
        <div role="status" className="rounded-xl bg-emerald-500/10 p-4">
          {result.status === 'POSTED'
            ? 'سند این عملیات قبلاً قطعی ثبت شده است؛ مشاهده در'
            : 'سند عملیات ذخیره شده است؛ تأیید مستقل و ثبت قطعی در'}{' '}
          <Link
            href={`/finance/accounting/general-ledger/documents/journals?bookId=${book.book.id}&journalId=${result.id}`}
            className="font-bold text-primary"
          >
            فهرست اسناد
          </Link>{' '}
          انجام می‌شود.
        </div>
      ) : null}
    </section>
  );
}
