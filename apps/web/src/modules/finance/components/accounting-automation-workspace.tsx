'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingCommandV1,
  AccountingJournalV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';

type Run = <T = unknown>(
  action: string,
  payload: AccountingCommandV1['payload'],
  version?: number,
) => Promise<T | undefined>;
export function AccountingAutomationWorkspace({
  book,
  mode,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  mode: 'templates' | 'numbering';
  run: Run;
  busy: boolean;
}) {
  const [id, setId] = useState(''),
    [title, setTitle] = useState(''),
    [code, setCode] = useState(''),
    [source, setSource] = useState(''),
    [targets, setTargets] = useState([{ accountId: '', percentage: '100' }]);
  const [templateId, setTemplateId] = useState(''),
    [amount, setAmount] = useState(''),
    [basis, setBasis] = useState(''),
    [period, setPeriod] = useState(''),
    [type, setType] = useState(''),
    [date, setDate] = useState(''),
    [startingNumber, setStartingNumber] = useState('1');
  const [preview, setPreview] = useState<
      { accountId: string; debit: string; credit: string }[] | null
    >(null),
    [result, setResult] = useState('');
  const templates = book.configurations.filter(
      (c) => c.kind === 'allocation-templates',
    ),
    selected = templates.find((t) => t.id === id),
    template = templates.find((t) => t.id === templateId);
  const accountOptions = book.accounts
    .filter((a) => a.active && a.level === 'SUBSIDIARY')
    .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }));
  const periodOptions = book.periods
    .filter((p) => p.status === 'OPEN')
    .map((p) => ({
      value: p.id,
      label:
        book.configurations.find((c) => c.id === p.fiscalYearId)?.title ??
        p.startDate,
    }));
  const save = async () => {
    const r = await run(
      'save-configuration',
      {
        kind: 'allocation-templates',
        code,
        title,
        ...(id ? { id } : {}),
        attributes: {
          sourceAccountId: source,
          targets: JSON.stringify(targets),
        },
        active: true,
      },
      selected?.version,
    );
    if (r) {
      setId('');
      setTitle('');
      setCode('');
      setSource('');
      setTargets([{ accountId: '', percentage: '100' }]);
    }
  };
  const payload = () => ({
    templateId,
    templateVersion: template?.version,
    amount,
    basisReference: basis,
    periodId: period,
    typeId: type,
    documentDate: date,
  });
  const generate = async () => {
    const journal = await run<AccountingJournalV1>('allocation-run', payload());
    if (journal) {
      setResult(
        'پیش‌نویس سند ایجاد شد؛ در فهرست اسناد قابل مشاهده و تأیید است.',
      );
      setPreview(null);
    }
  };
  return (
    <section className="space-y-6">
      <h2 className="text-lg font-black">
        {mode === 'templates' ? 'الگو و صدور سند تخصیص' : 'شماره‌گذاری اسناد'}
      </h2>
      {mode === 'templates' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                onClick={() => {
                  setId(t.id);
                  setTitle(t.title);
                  setCode(t.code);
                  setSource(String(t.attributes.sourceAccountId ?? ''));
                  try {
                    setTargets(JSON.parse(String(t.attributes.targets)));
                  } catch {
                    setTargets([{ accountId: '', percentage: '100' }]);
                  }
                }}
              >
                {t.code} — {t.title} · نسخه {t.version}
              </Button>
            ))}
          </div>
          <form
            className="space-y-4 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="کد الگو">
                <Input
                  aria-label="کد الگو"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </FormField>
              <FormField label="عنوان الگو">
                <Input
                  aria-label="عنوان الگو"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormField>
              <FormField label="حساب مبدأ (بستانکار)">
                <SearchCombobox
                  label="حساب مبدأ"
                  value={source}
                  onValueChange={setSource}
                  options={accountOptions}
                />
              </FormField>
            </div>
            <h3 className="font-bold">مقصدها · مجموع درصدها باید ۱۰۰ باشد</h3>
            {targets.map((target, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="min-w-60 flex-1">
                  <FormField label={`حساب مقصد ${i + 1}`}>
                    <SearchCombobox
                      label={`حساب مقصد ${i + 1}`}
                      value={target.accountId}
                      onValueChange={(accountId) =>
                        setTargets((rows) =>
                          rows.map((r, n) =>
                            n === i ? { ...r, accountId } : r,
                          ),
                        )
                      }
                      options={accountOptions}
                    />
                  </FormField>
                </div>
                <FormField label="درصد">
                  <Input
                    aria-label="درصد"
                    dir="ltr"
                    inputMode="decimal"
                    value={target.percentage}
                    onChange={(e) =>
                      setTargets((rows) =>
                        rows.map((r, n) =>
                          n === i ? { ...r, percentage: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </FormField>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={targets.length === 1}
                  onClick={() =>
                    setTargets((rows) => rows.filter((_, n) => n !== i))
                  }
                >
                  حذف مقصد
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setTargets((rows) => [
                    ...rows,
                    { accountId: '', percentage: '0' },
                  ])
                }
              >
                افزودن مقصد
              </Button>
              <Button
                disabled={busy}
                permission="finance.account.manage"
                type="submit"
              >
                ذخیره الگو
              </Button>
              {id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setId('');
                    setCode('');
                    setTitle('');
                    setSource('');
                    setTargets([{ accountId: '', percentage: '100' }]);
                  }}
                >
                  الگوی جدید
                </Button>
              ) : null}
            </div>
          </form>
          <form
            className="space-y-4 rounded-xl border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run<{
                lines: { accountId: string; debit: string; credit: string }[];
              }>('allocation-preview', payload()).then((r) => {
                if (r) setPreview(r.lines);
              });
            }}
          >
            <h3 className="font-bold">پیش‌نمایش و صدور از الگو</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="الگو">
                <SearchCombobox
                  label="الگو"
                  value={templateId}
                  onValueChange={(v) => {
                    setTemplateId(v);
                    setPreview(null);
                  }}
                  options={templates.map((t) => ({
                    value: t.id,
                    label: `${t.title} · نسخه ${t.version}`,
                  }))}
                />
              </FormField>
              <FormField label="مبلغ پایه">
                <Input
                  aria-label="مبلغ پایه"
                  value={amount}
                  dir="ltr"
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPreview(null);
                  }}
                />
              </FormField>
              <FormField label="مرجع مبنا (برای جلوگیری از صدور دوباره)">
                <Input
                  aria-label="مرجع مبنا (برای جلوگیری از صدور دوباره)"
                  value={basis}
                  onChange={(e) => setBasis(e.target.value)}
                />
              </FormField>
              <FormField label="دوره">
                <SearchCombobox
                  label="دوره"
                  value={period}
                  onValueChange={setPeriod}
                  options={periodOptions}
                />
              </FormField>
              <FormField label="نوع سند">
                <SearchCombobox
                  label="نوع سند"
                  value={type}
                  onValueChange={setType}
                  options={book.configurations
                    .filter((c) => c.kind === 'voucher-types')
                    .map((c) => ({ value: c.id, label: c.title }))}
                />
              </FormField>
              <FormField label="تاریخ سند">
                <DatePicker
                  aria-label="تاریخ سند"
                  value={date}
                  onChange={setDate}
                />
              </FormField>
            </div>
            <Button disabled={busy} type="submit" variant="outline">
              پیش‌نمایش تخصیص
            </Button>
            {preview ? (
              <div className="space-y-3">
                {preview.map((r, i) => (
                  <p key={i}>
                    {book.accounts.find((a) => a.id === r.accountId)?.title} ·
                    بدهکار {r.debit} · بستانکار {r.credit}
                  </p>
                ))}
                <Button
                  disabled={busy}
                  permission="finance.journal.create"
                  type="button"
                  onClick={() => void generate()}
                >
                  ایجاد پیش‌نویس از الگو
                </Button>
              </div>
            ) : null}
          </form>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              window.confirm('شماره‌گذاری اسناد نهایی‌نشده این دوره اجرا شود؟')
            )
              void run<{ rows: unknown[] }>('number-drafts', {
                periodId: period,
                startingNumber,
              }).then((r) => {
                if (r) setResult(`${r.rows.length} سند شماره‌گذاری شد.`);
              });
          }}
        >
          <p className="text-sm text-muted-foreground">
            فقط اسناد نهایی‌نشده به ترتیب تاریخ شماره‌گذاری می‌شوند. شماره سند
            قطعی ثابت می‌ماند.
          </p>
          <FormField label="دوره">
            <SearchCombobox
              label="دوره"
              value={period}
              onValueChange={setPeriod}
              options={periodOptions}
            />
          </FormField>
          <FormField label="شروع شماره">
            <Input
              aria-label="شروع شماره"
              value={startingNumber}
              inputMode="numeric"
              onChange={(e) => setStartingNumber(e.target.value)}
            />
          </FormField>
          <Button
            type="submit"
            permission="finance.journal.create"
            disabled={busy}
          >
            اجرای شماره‌گذاری
          </Button>
        </form>
      )}
      {result ? <p role="status">{result}</p> : null}
    </section>
  );
}

export function AccountingMappingWorkspace({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const [title, setTitle] = useState(''),
    [code, setCode] = useState(''),
    [effectiveFrom, setEffectiveFrom] = useState(''),
    [reason, setReason] = useState(''),
    [rows, setRows] = useState([{ accountId: '', targetCode: '' }]);
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">نگاشت حساب داخلی به حساب بیرونی</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run('save-configuration', {
            kind: 'account-mappings',
            code,
            title,
            attributes: { effectiveFrom, reason, rows: JSON.stringify(rows) },
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="کد نگاشت">
            <Input
              aria-label="کد نگاشت"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </FormField>
          <FormField label="عنوان">
            <Input
              aria-label="عنوان"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="تاریخ اثر">
            <DatePicker
              aria-label="تاریخ اثر"
              value={effectiveFrom}
              onChange={setEffectiveFrom}
            />
          </FormField>
          <FormField label="دلیل">
            <Textarea
              aria-label="دلیل"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-2">
            <FormField label="حساب داخلی">
              <SearchCombobox
                label="حساب داخلی"
                value={row.accountId}
                onValueChange={(accountId) =>
                  setRows((all) =>
                    all.map((r, n) => (n === i ? { ...r, accountId } : r)),
                  )
                }
                options={book.accounts
                  .filter((a) => a.level === 'SUBSIDIARY')
                  .map((a) => ({
                    value: a.id,
                    label: `${a.code} — ${a.title}`,
                  }))}
              />
            </FormField>
            <FormField label="کد حساب بیرونی">
              <Input
                aria-label="کد حساب بیرونی"
                value={row.targetCode}
                onChange={(e) =>
                  setRows((all) =>
                    all.map((r, n) =>
                      n === i ? { ...r, targetCode: e.target.value } : r,
                    ),
                  )
                }
              />
            </FormField>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setRows((all) => [...all, { accountId: '', targetCode: '' }])
            }
          >
            افزودن نگاشت
          </Button>
          <Button
            permission="finance.account.manage"
            type="submit"
            disabled={busy}
          >
            ثبت نسخه نگاشت
          </Button>
        </div>
      </form>
      <div className="space-y-3">
        {book.configurations
          .filter((c) => c.kind === 'account-mappings')
          .map((c) => (
            <details key={c.id} className="rounded-xl border p-3">
              <summary>
                {c.code} — {c.title} · نسخه {c.version}
              </summary>
              <pre className="overflow-auto p-3 text-start text-sm" dir="ltr">
                {JSON.stringify(
                  JSON.parse(String(c.attributes.rows || '[]')),
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
      </div>
    </section>
  );
}
