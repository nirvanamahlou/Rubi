'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingCommandV1,
  AccountingWorkflowPageV1,
  AccountingWorkflowSourcesV1,
  AccountingWorkflowV1,
  FinanceSettlementAccountV1,
} from '@nora/contracts';
import { accountingWorkflowLabels as labels } from '@nora/contracts';
import { Input, Textarea } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { apiRequest, FinanceInboxApiError } from '../api/finance-inbox-api';
import { AccountingButton as Button } from './accounting-operations';
import Link from '@/i18n/link';

type Props = {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
};
const roles: Record<string, string> = {
  receivable: 'مطالبات یا پیش‌دریافت قرارداد',
  income: 'درآمد یا کارمزد',
  tax: 'مالیات درج‌شده در قرارداد',
  expense: 'هزینه',
  payable: 'حقوق پرداختنی',
  deductions: 'کسورات پرداختنی',
  cash: 'حساب دریافت واقعی',
  gain: 'سود تسعیر',
  loss: 'زیان تسعیر',
  rounding: 'اختلاف گرد کردن',
};
export function AccountingWorkflowsPanel({ book, busy, run }: Props) {
  const permissions = useAccessPermissions(),
    canCreate = !!permissions?.includes('finance.journal.create');
  const [kind, setKind] = useState('REVENUE'),
    [fields, setFields] = useState<Record<string, string>>({
      mode: 'PRINCIPAL',
      state: 'INQUIRY',
    }),
    [confirmed, setConfirmed] = useState(false),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<AccountingWorkflowV1 | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [message, setMessage] = useState('');
  const path = `/finance/accounting/books/${book.book.id}`;
  const list = useQuery({
    queryKey: ['accounting', 'workflows', book.book.id],
    queryFn: () => apiRequest<AccountingWorkflowPageV1>(`${path}/workflows`),
    refetchInterval: 30000,
  });
  const sources = useQuery({
    queryKey: ['accounting', 'workflow-sources', book.book.id, search],
    queryFn: () =>
      apiRequest<AccountingWorkflowSourcesV1>(
        `${path}/workflow-sources?${new URLSearchParams({ search })}`,
      ),
    enabled: canCreate,
  });
  const accounts = useQuery({
    queryKey: ['finance', 'workflow-receipt-accounts', book.book.branchId],
    queryFn: () =>
      apiRequest<{ data: FinanceSettlementAccountV1[] }>(
        '/finance/settlement-accounts',
      ),
    enabled: canCreate && kind === 'SUPPLIER_REFUND',
  });
  const denied = [list.error, sources.error, accounts.error].some(
    (e) =>
      e instanceof FinanceInboxApiError && [401, 403, 404].includes(e.status),
  );
  if (denied)
    return (
      <p role="alert">
        دسترسی به اطلاعات این دفتر در دسترس نیست؛ صفحه را دوباره بارگذاری کنید.
      </p>
    );
  const set = (key: string, value: string) =>
    setFields((p) => ({ ...p, [key]: value }));
  const sourceOptions =
    kind === 'REVENUE'
      ? sources.data?.contracts
      : kind === 'PAYROLL'
        ? sources.data?.payroll.net
        : sources.data?.payments;
  const capture = async () => {
    const source = sourceOptions?.find((s) => s.id === fields.sourceId);
    const result = await run('workflow-create', {
      ...fields,
      kind,
      sourceVersion: source && 'version' in source ? source.version : undefined,
      fulfilled: confirmed,
      periodConfirmed: confirmed,
    });
    if (result) {
      setMessage(
        'مبنای عملیات ثبت شد؛ ایجاد پیش‌نویس و تأیید سند را جداگانه انجام دهید.',
      );
      setFields({ mode: 'PRINCIPAL', state: 'INQUIRY' });
      setConfirmed(false);
      await list.refetch();
    }
  };
  const draft = async () => {
    if (!selected) return;
    const result = await run<{ noJournal?: boolean }>('workflow-journal', {
      ...mapping,
      id: selected.id,
    });
    if (result) {
      setMessage(
        result.noJournal
          ? 'این عملیات اختلاف قابل ثبت ندارد.'
          : 'پیش‌نویس ایجاد شد؛ تأیید و ثبت نهایی از فهرست اسناد انجام می‌شود.',
      );
      setSelected(null);
      await list.refetch();
    }
  };
  const cancel = async () => {
    if (!selected) return;
    const result = await run('workflow-cancel', {
      id: selected.id,
      reason: mapping.reason,
    });
    if (result) {
      setMessage('مبنای عملیات با حفظ سوابق لغو شد.');
      setSelected(null);
      await list.refetch();
    }
  };
  const field = (key: string, label: string) => (
    <label key={key} className="space-y-1">
      <span>{label}</span>
      <Input
        value={fields[key] ?? ''}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const rowRoles =
    selected?.kind === 'REVENUE'
      ? ['receivable', 'income', 'tax', 'rounding']
      : selected?.kind === 'PAYROLL'
        ? ['expense', 'payable', 'deductions', 'rounding']
        : selected?.kind === 'FX_SETTLEMENT' ||
            selected?.kind === 'PURCHASE_OUTCOME'
          ? ['gain', 'loss']
          : selected?.kind === 'SUPPLIER_REFUND'
            ? ['cash', 'gain', 'loss', 'rounding']
            : selected?.kind === 'PURCHASE_WRITE_OFF'
              ? ['expense']
              : [];
  const options = (rows: { id: string; title: string; code?: string }[]) =>
    rows.map((x) => ({ value: x.id, label: `${x.code ?? ''} ${x.title}` }));
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-label="تکمیل فرایندهای مالی"
    >
      <h3 className="font-bold">تکمیل فرایندهای مالی</h3>
      <p className="text-sm text-muted-foreground">
        مبنای واقعی عملیات را ثبت کنید؛ سند ابتدا پیش‌نویس است و به تأیید مستقل
        نیاز دارد. استرداد وجه فقط با تأیید دستی وصول ثبت می‌شود.
      </p>
      {message && <p role="status">{message}</p>}
      {[list.error, sources.error, accounts.error]
        .filter(Boolean)
        .map((e, i) => (
          <p role="alert" key={i}>
            {e?.message}
          </p>
        ))}
      {canCreate && (
        <details className="rounded-xl border p-4">
          <summary>ثبت مبنای عملیات</summary>
          <div className="grid gap-4 py-4 md:grid-cols-3">
            <SearchCombobox
              label="نوع فرایند"
              value={kind}
              options={Object.entries(labels).map(([value, label]) => ({
                value,
                label,
              }))}
              onValueChange={(value) => {
                setKind(value);
                setFields({ mode: 'PRINCIPAL', state: 'INQUIRY' });
                setConfirmed(false);
              }}
            />
            <label>
              جست‌وجوی منبع
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <SearchCombobox
              label="منبع عملیات"
              value={fields.sourceId ?? ''}
              options={(sourceOptions ?? []).map((s) => ({
                value: s.id,
                label: s.label,
              }))}
              onValueChange={(value) => set('sourceId', value)}
            />
            <label>
              تاریخ عملیات
              <DatePicker
                value={fields.date ?? ''}
                onChange={(value) => set('date', value)}
              />
            </label>
            {field('reference', 'شماره مستند یا مرجع وصول')}
            {kind === 'REVENUE' && (
              <>
                <SearchCombobox
                  label="نقش شرکت در قرارداد"
                  value={fields.mode ?? 'PRINCIPAL'}
                  options={[
                    { value: 'PRINCIPAL', label: 'اصیل؛ درآمد ناخالص' },
                    { value: 'AGENT', label: 'نماینده؛ فقط درآمد کارمزدی' },
                  ]}
                  onValueChange={(value) => set('mode', value)}
                />
                {field('currency', 'کد ارز قرارداد')}
                {fields.mode === 'AGENT' &&
                  field('amount', 'کارمزد مستند شرکت')}
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />{' '}
                  ایفای تعهد طبق مستند تأیید می‌شود
                </label>
              </>
            )}
            {kind === 'PAYROLL' && (
              <>
                <SearchCombobox
                  label="فیش ناخالص واردشده"
                  value={fields.grossRecordId ?? ''}
                  options={(sources.data?.payroll.gross ?? []).map((s) => ({
                    value: s.id,
                    label: s.label,
                  }))}
                  onValueChange={(value) => set('grossRecordId', value)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />{' '}
                  دوره فیش واردشده و درخواست حقوق یکسان است
                </label>
                <p>
                  فیش باید ستون یکتای ناخالص، کسورات، خالص و کد ارز داشته باشد؛
                  نرخ قانونی حدس زده نمی‌شود.
                </p>
              </>
            )}
            {kind === 'PURCHASE_OUTCOME' && (
              <SearchCombobox
                label="نتیجه مستند خرید"
                value={fields.state ?? 'INQUIRY'}
                options={[
                  { value: 'INQUIRY', label: 'در حال استعلام' },
                  { value: 'FAILED', label: 'ناموفق قطعی' },
                  { value: 'SUCCESS', label: 'موفق' },
                ]}
                onValueChange={(value) => set('state', value)}
              />
            )}
            {['SUPPLIER_REFUND', 'PURCHASE_WRITE_OFF'].includes(kind) &&
              field('amount', 'مبلغ در ارز پرداخت اصلی')}
            {kind === 'SUPPLIER_REFUND' && (
              <SearchCombobox
                label="حساب واقعی وصول وجه"
                value={fields.receiptAccountId ?? ''}
                options={(accounts.data?.data ?? [])
                  .filter((a) => a.branchId === book.book.branchId)
                  .map((a) => ({
                    value: a.id,
                    label: `${a.title} · ${a.currencyCode}`,
                  }))}
                onValueChange={(value) => set('receiptAccountId', value)}
              />
            )}
            <label className="md:col-span-3">
              شرح مبنا و مستند تصمیم
              <Textarea
                value={fields.reason ?? ''}
                onChange={(e) => set('reason', e.target.value)}
              />
            </label>
          </div>
          <Button
            disabled={busy || sources.isPending}
            onClick={() => void capture()}
          >
            ثبت مبنا
          </Button>
          {sources.data?.truncated && (
            <p>فهرست منبع محدود است؛ جست‌وجو را دقیق‌تر کنید.</p>
          )}
        </details>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['فرایند', 'مرجع', 'تاریخ', 'مبلغ', 'وضعیت', 'عملیات'].map(
                (t) => (
                  <th key={t} className="p-2 text-start">
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((r) => (
              <tr key={r.id}>
                <td className="p-2">{labels[r.kind]}</td>
                <td>{r.reference}</td>
                <td>{r.occurredAt.slice(0, 10)}</td>
                <td dir="ltr">
                  {r.amount} {r.currency}
                </td>
                <td>
                  {r.cancelled
                    ? 'لغوشده'
                    : (r.journal?.status ??
                      (r.facts.state === 'INQUIRY'
                        ? 'در حال استعلام'
                        : 'مبنای ثبت‌شده'))}
                </td>
                <td>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(r);
                      setMapping({});
                    }}
                  >
                    بررسی و ثبت سند
                  </Button>
                  {r.journal && (
                    <Link
                      href={`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${r.journal.id}`}
                    >
                      مشاهده سند
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.isPending && <p role="status">در حال بارگذاری…</p>}
      {list.data?.truncated && <p>صد مبنای آخر نمایش داده می‌شود.</p>}
      {selected && (
        <section
          className="space-y-4 rounded-xl bg-muted/30 p-4"
          aria-label="ثبت سند مبنای انتخاب‌شده"
        >
          <h4>
            {labels[selected.kind]} · {selected.reference}
          </h4>
          <dl className="grid gap-2 md:grid-cols-3">
            {[
              'gross',
              'deductions',
              'net',
              'netAlreadyAccrued',
              'earned',
              'tax',
              'passThrough',
              'carrying',
              'actual',
              'difference',
              'state',
            ]
              .filter((k) => selected.facts[k] !== undefined)
              .map((k) => (
                <div key={k}>
                  <dt>
                    {
                      {
                        gross: 'ناخالص',
                        deductions: 'کسورات',
                        net: 'خالص',
                        netAlreadyAccrued: 'تعهد خالص قبلی',
                        earned: 'درآمد شرکت',
                        tax: 'مالیات قرارداد',
                        passThrough: 'سهم سایر طرف‌ها',
                        carrying: 'مبلغ دفتری',
                        actual: 'مبلغ واقعی پرداخت',
                        difference: 'اختلاف تسویه',
                        state: 'نتیجه خرید',
                      }[k]
                    }
                  </dt>
                  <dd>{String(selected.facts[k])}</dd>
                </div>
              ))}
          </dl>
          {canCreate && !selected.cancelled && !selected.journal && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <label>
                  تاریخ سند
                  <DatePicker
                    value={
                      mapping.documentDate ?? selected.occurredAt.slice(0, 10)
                    }
                    onChange={(value) =>
                      setMapping((p) => ({ ...p, documentDate: value }))
                    }
                  />
                </label>
                <SearchCombobox
                  label="دوره باز"
                  value={mapping.periodId ?? ''}
                  options={book.periods
                    .filter((p) => p.status === 'OPEN')
                    .map((p) => ({
                      value: p.id,
                      label: `${p.startDate} — ${p.endDate}`,
                    }))}
                  onValueChange={(value) =>
                    setMapping((p) => ({ ...p, periodId: value }))
                  }
                />
                <SearchCombobox
                  label="نوع سند"
                  value={mapping.typeId ?? ''}
                  options={options(
                    book.configurations.filter(
                      (c) => c.active && c.kind === 'voucher-types',
                    ),
                  )}
                  onValueChange={(value) =>
                    setMapping((p) => ({ ...p, typeId: value }))
                  }
                />
                <SearchCombobox
                  label="نرخ مصوب عملیات"
                  value={mapping.fxSnapshotId ?? ''}
                  options={book.fxRates
                    .filter((x) => x.status === 'APPROVED')
                    .map((x) => ({
                      value: x.id,
                      label: `${x.currency} · ${x.rate}`,
                    }))}
                  onValueChange={(value) =>
                    setMapping((p) => ({ ...p, fxSnapshotId: value }))
                  }
                />
                <label className="md:col-span-2">
                  علت ثبت در تاریخ دیگر
                  <Textarea
                    value={mapping.latePostingReason ?? ''}
                    onChange={(e) =>
                      setMapping((p) => ({
                        ...p,
                        latePostingReason: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {rowRoles.map((role) => (
                <div key={role} className="grid gap-3 md:grid-cols-4">
                  <SearchCombobox
                    label={roles[role]!}
                    value={mapping[`${role}AccountId`] ?? ''}
                    options={options(
                      book.accounts.filter(
                        (a) => a.active && a.level === 'SUBSIDIARY',
                      ),
                    )}
                    onValueChange={(value) =>
                      setMapping((p) => ({ ...p, [`${role}AccountId`]: value }))
                    }
                  />
                  {[4, 5, 6].map((n) => (
                    <SearchCombobox
                      key={n}
                      label={`تفصیلی ${n}`}
                      value={mapping[`${role}Detail${n}Id`] ?? ''}
                      options={options(book.details.filter((d) => d.active))}
                      onValueChange={(value) =>
                        setMapping((p) => ({
                          ...p,
                          [`${role}Detail${n}Id`]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              ))}
              <Button disabled={busy} onClick={() => void draft()}>
                ایجاد پیش‌نویس سند
              </Button>
            </>
          )}
          {permissions?.includes('finance.journal.approve') &&
            !selected.cancelled && (
              <>
                <label>
                  علت لغو مبنا
                  <Textarea
                    value={mapping.reason ?? ''}
                    onChange={(e) =>
                      setMapping((p) => ({ ...p, reason: e.target.value }))
                    }
                  />
                </label>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void cancel()}
                >
                  لغو مبنا با حفظ سابقه
                </Button>
              </>
            )}
          <Button variant="outline" onClick={() => setSelected(null)}>
            بستن بررسی
          </Button>
        </section>
      )}
    </section>
  );
}
