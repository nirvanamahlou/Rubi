'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type ReactNode } from 'react';
import Link from '@/i18n/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type {
  AccountingAttributes,
  AccountingJournalV1,
  AccountingLineV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { journalDisplayTotals } from '../accounting-money';
import { accountingApi } from '../api/accounting-api';
import { AccountingReportWorkspace } from './accounting-report-workspace';
import { AccountingAttachments } from './accounting-attachments';
import { AccountingBookSettings } from './accounting-book-settings';
import { AccountingAdvancedWorkspace } from './accounting-advanced-workspace';
import { AccountingSourceWorkspace } from './accounting-source-workspace';
import { AccountingYearEndWorkspace } from './accounting-year-end-workspace';
import {
  AccountingAutomationWorkspace,
  AccountingMappingWorkspace,
} from './accounting-automation-workspace';

type Field = {
  key: string;
  label: string;
  kind?: 'date' | 'datetime' | 'check' | 'area' | 'select';
  options?: { value: string; label: string }[];
};
type Draft = Record<string, string | boolean>;
const blankLine = (): AccountingLineV1 => ({
  accountId: null,
  detail4Id: null,
  detail5Id: null,
  detail6Id: null,
  description: '',
  debit: '0',
  credit: '0',
  currency: null,
  foreignAmount: null,
  rate: null,
  attributes: {},
});
const statuses: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'منتظر تأیید',
  APPROVED: 'تأییدشده',
  POSTED: 'قطعی',
  CANCELLED: 'لغوشده',
};
const sections = [
  ['general-ledger/base-information/approval-policies', 'قواعد تأیید اسناد'],
  ['general-ledger/documents/numbering', 'شماره‌گذاری اسناد'],
  ['general-ledger/documents/automatic-runs', 'صدور از عملیات ERP'],
  ['general-ledger/base-information/fx-rates', 'نرخ‌های ارز مصوب'],
  ['general-ledger/base-information/fiscal-years', 'دوره‌های مالی'],
  ['general-ledger/base-information/ledgers', 'دفاتر و تخصیص سال'],
  ['general-ledger/base-information/voucher-types', 'انواع سند'],
  ['general-ledger/accounts/chart', 'درخت حساب‌ها'],
  ['general-ledger/accounts/detail-types', 'انواع تفصیلی'],
  ['general-ledger/accounts/details', 'حساب‌های تفصیلی'],
  ['general-ledger/accounts/mappings', 'نگاشت حساب‌ها'],
  ['general-ledger/documents/journals', 'سند حسابداری'],
  ['general-ledger/documents/list', 'فهرست اسناد'],
  ['general-ledger/documents/posting', 'تأیید و ثبت قطعی'],
  ['general-ledger/documents/automatic-templates', 'الگوهای تخصیص'],
  ['general-ledger/documents/revaluation', 'تسعیر ارز'],
  ['general-ledger/documents/transfer-batches', 'بسته انتقال حسابداری'],
  ['taxpayer-system/settings', 'تنظیمات مودیان'],
  ['taxpayer-system/invoices', 'صورتحساب مالیاتی'],
  ['tax-accounting/returns', 'گزارش مالیاتی'],
  ['general-ledger/reports/catalog', 'فهرست گزارش‌ها'],
  ['general-ledger/year-end', 'بستن دوره'],
  ['general-ledger/reports/trial-balance', 'تراز حساب‌ها'],
  ['general-ledger/reports/account-browser', 'گردش حساب'],
] as const;
function FieldControl({
  field,
  value,
  onChange,
  disabled = false,
}: {
  field: Field;
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  disabled?: boolean;
}) {
  const fieldId = useId();
  const id = `accounting-${field.key}-${fieldId}`;
  return (
    <FormField id={id} label={field.label}>
      {field.kind === 'check' ? (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled ?? false}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 accent-primary"
        />
      ) : field.kind === 'date' || field.kind === 'datetime' ? (
        <DatePicker
          id={id}
          includeTime={field.kind === 'datetime'}
          value={String(value || '')}
          disabled={disabled ?? false}
          onChange={onChange}
        />
      ) : field.kind === 'select' ? (
        <SearchCombobox
          id={id}
          label={field.label}
          value={String(value || '')}
          disabled={disabled ?? false}
          options={field.options ?? []}
          onValueChange={onChange}
        />
      ) : field.kind === 'area' ? (
        <Textarea
          id={id}
          value={String(value || '')}
          disabled={disabled ?? false}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={String(value || '')}
          disabled={disabled ?? false}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}
function Fields({
  fields,
  draft,
  set,
  disabled,
}: {
  fields: Field[];
  draft: Draft;
  set: (key: string, value: string | boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => (
        <FieldControl
          key={f.key}
          field={f}
          value={draft[f.key] ?? ''}
          disabled={disabled ?? false}
          onChange={(value) => set(f.key, value)}
        />
      ))}
    </div>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-start text-sm">
        <thead className="bg-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 text-start">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const cell = 'border-t border-border px-3 py-3';

export function AccountingWorkspace({ pathname }: { pathname: string }) {
  const permissions = useAccessPermissions();
  const can = (p: string) => !!permissions?.includes(p);
  const queryClient = useQueryClient();
  const booksQuery = useQuery({
    queryKey: ['accounting', 'books'],
    queryFn: accountingApi.books,
  });
  const books = booksQuery.data?.books ?? [],
    branches = booksQuery.data?.branches ?? [];
  const [selectedBookId, setBookId] = useState('');
  const urlParams = useSearchParams(),
    router = useRouter();
  const requestedBookId = urlParams.get('bookId');
  const bookId =
    selectedBookId ||
    books.find((b) => b.id === requestedBookId)?.id ||
    books[0]?.id ||
    '';
  const snapshotQuery = useQuery({
    queryKey: ['accounting', 'snapshot', bookId],
    queryFn: () => accountingApi.snapshot(bookId),
    enabled: !!bookId,
  });
  const snapshot = snapshotQuery.data ?? null;
  const loading = booksQuery.isPending || (!!bookId && snapshotQuery.isPending);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Draft>({
    active: true,
    permanent: true,
    allowsPosting: true,
  });
  const [editing, setEditing] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const pending = useRef<{ signature: string; key: string } | null>(null);
  const section = pathname.replace(/^\/finance\/accounting\/?/, '');
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };

  const set = (key: string, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const run = async <T,>(
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ): Promise<T | undefined> => {
    setBusy(true);
    setError('');
    setNotice('');
    const signature = JSON.stringify({ bookId, action, payload, version });
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await accountingApi.command<T>(bookId, action, {
        key: pending.current.key,
        payload,
        ...(version !== undefined ? { expectedVersion: version } : {}),
      });
      pending.current = null;
      setNotice('عملیات ثبت شد.');
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const createBook = async () => {
    setBusy(true);
    setError('');
    const id = String(draft.id || crypto.randomUUID());
    set('id', id);
    try {
      const book = await accountingApi.createBook({ ...draft, id });
      setBookId(book.id);
      setDraft({ active: true });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  const home =
    pathname === '/finance' ||
    section === '' ||
    section === 'general-ledger' ||
    (!sections.some(([route]) => section === route) &&
      [
        'general-ledger/base-information',
        'general-ledger/accounts',
        'general-ledger/documents',
        'general-ledger/reports',
      ].includes(section));
  const title = sections.find(([r]) => r === section)?.[1] ?? 'حسابداری';
  const fields: Field[] = [
    { key: 'code', label: 'کد' },
    { key: 'title', label: 'عنوان' },
    { key: 'titleEn', label: 'عنوان زبان دوم' },
    { key: 'description', label: 'توضیحات', kind: 'area' },
    { key: 'active', label: 'فعال', kind: 'check' },
  ];
  const options = (rows: { id: string; title: string; code?: string }[]) =>
    rows.map((r) => ({
      value: r.id,
      label: `${r.code ? `${r.code} — ` : ''}${r.title}`,
    }));
  let content: ReactNode = null;
  if (!books.length || section === 'general-ledger/base-information/ledgers')
    content = (
      <Panel title="دفتر کل">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createBook();
          }}
          className="space-y-4"
        >
          <Fields
            fields={[
              {
                key: 'branchId',
                label: 'شعبه',
                kind: 'select',
                options: branches.map((b) => ({ value: b.id, label: b.name })),
              },
              { key: 'code', label: 'کد دفتر' },
              { key: 'title', label: 'عنوان دفتر' },
              { key: 'baseCurrency', label: 'ارز پایه (کد سه حرفی)' },
              {
                key: 'approvalPolicy',
                label: 'قاعده تأیید',
                kind: 'select',
                options: [
                  {
                    value: 'DUAL_CONTROL',
                    label: 'تأیید مستقل پیش از ثبت قطعی',
                  },
                ],
              },
              { key: 'isMain', label: 'دفتر اصلی', kind: 'check' },
            ]}
            draft={draft}
            set={set}
          />
          <Button
            permission="finance.account.manage"
            type="submit"
            disabled={busy}
          >
            ایجاد دفتر
          </Button>
        </form>
        {snapshot ? (
          <>
            <AccountingBookSettings
              key={snapshot.book.id + snapshot.book.version}
              book={snapshot.book}
              run={run}
              busy={busy}
            />
            <h3 className="font-bold">تخصیص سال مالی به دفتر انتخاب‌شده</h3>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run('save-period', draft, editing?.version).then(
                  (result) => {
                    if (result) setEditing(null);
                  },
                );
              }}
            >
              <Fields
                fields={[
                  {
                    key: 'fiscalYearId',
                    label: 'سال مالی',
                    kind: 'select',
                    options: options(
                      snapshot.configurations.filter(
                        (c) => c.kind === 'fiscal-years',
                      ),
                    ),
                  },
                  { key: 'startDate', label: 'تاریخ شروع', kind: 'date' },
                  { key: 'endDate', label: 'تاریخ پایان', kind: 'date' },
                ]}
                draft={draft}
                set={set}
              />
              <Button
                permission="finance.account.manage"
                type="submit"
                disabled={busy}
              >
                تخصیص دوره
              </Button>
            </form>
            <Table headers={['سال مالی', 'شروع', 'پایان', 'وضعیت']}>
              {snapshot.periods.map((p) => (
                <tr key={p.id}>
                  <td className={cell}>
                    {
                      snapshot.configurations.find(
                        (c) => c.id === p.fiscalYearId,
                      )?.title
                    }
                  </td>
                  <td className={cell}>{p.startDate}</td>
                  <td className={cell}>{p.endDate}</td>
                  <td className={cell}>
                    {p.status === 'OPEN' ? 'باز' : 'بسته'}
                  </td>
                </tr>
              ))}
            </Table>
          </>
        ) : null}
      </Panel>
    );
  else if (snapshot && section === 'general-ledger/base-information/fx-rates') {
    content = (
      <Panel title="نرخ‌های ارز مصوب">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const from = new Date(String(draft.validFrom)),
              to = new Date(String(draft.validTo));
            if (
              !Number.isFinite(from.getTime()) ||
              !Number.isFinite(to.getTime())
            ) {
              setError('بازه اعتبار نرخ را انتخاب کنید.');
              return;
            }
            void run('save-fx', {
              ...draft,
              validFrom: from.toISOString(),
              validTo: to.toISOString(),
            });
          }}
        >
          <Fields
            fields={[
              { key: 'currency', label: 'کد ارز معامله' },
              { key: 'rate', label: 'نرخ تبدیل به ارز پایه' },
              { key: 'source', label: 'منبع نرخ' },
              { key: 'validFrom', label: 'شروع اعتبار', kind: 'datetime' },
              { key: 'validTo', label: 'پایان اعتبار', kind: 'datetime' },
            ]}
            draft={draft}
            set={set}
          />
          <Button
            type="submit"
            disabled={busy}
            permission="finance.account.manage"
          >
            ثبت نرخ برای تأیید
          </Button>
        </form>
        <Table
          headers={['ارز', 'نرخ', 'منبع', 'شروع', 'پایان', 'وضعیت', 'عملیات']}
        >
          {snapshot.fxRates.map((r) => (
            <tr key={r.id}>
              {[
                r.currency,
                r.rate,
                r.source,
                r.validFrom,
                r.validTo,
                r.status === 'APPROVED' ? 'مصوب' : 'پیش‌نویس',
              ].map((value, i) => (
                <td className={cell} key={i}>
                  {value}
                </td>
              ))}
              <td className={cell}>
                {r.status === 'DRAFT' ? (
                  <Button
                    permission="finance.journal.approve"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run('approve-fx', { id: r.id }, r.version)
                    }
                  >
                    تأیید نرخ
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    );
  } else if (
    snapshot &&
    (section === 'receipts-payments/reports' ||
      section === 'general-ledger/documents/automatic-runs')
  )
    content = (
      <AccountingSourceWorkspace book={snapshot} run={run} busy={busy} />
    );
  else if (
    snapshot &&
    (section.endsWith('/automatic-templates') || section.endsWith('/numbering'))
  )
    content = (
      <AccountingAutomationWorkspace
        book={snapshot}
        run={run}
        busy={busy}
        mode={section.endsWith('/numbering') ? 'numbering' : 'templates'}
      />
    );
  else if (snapshot && section.endsWith('/mappings'))
    content = (
      <AccountingMappingWorkspace book={snapshot} run={run} busy={busy} />
    );
  else if (home)
    content = (
      <Panel title={title}>
        <div className="grid gap-3 sm:grid-cols-2">
          {sections
            .filter(([r]) => pathname === '/finance' || r.startsWith(section))
            .map(([route, label]) => (
              <Link
                key={route}
                href={`/finance/accounting/${route}?bookId=${bookId}`}
                className="rounded-2xl border border-border bg-muted/30 p-5 font-bold transition hover:border-primary"
              >
                {label}
              </Link>
            ))}
        </div>
      </Panel>
    );
  else if (
    snapshot &&
    (section.includes('/documents/journals') ||
      section.includes('/documents/list') ||
      section.endsWith('/documents/posting'))
  )
    content = (
      <JournalWorkspace
        key={bookId + section}
        book={snapshot}
        mode={section.endsWith('journals') ? 'edit' : 'list'}
        busy={busy}
        run={run}
        can={can}
      />
    );
  else if (
    snapshot &&
    (section.endsWith('/revaluation') ||
      section.endsWith('/transfer-batches') ||
      section.startsWith('taxpayer-system/') ||
      section.startsWith('tax-accounting/'))
  )
    content = (
      <AccountingAdvancedWorkspace
        key={bookId + section}
        book={snapshot}
        section={section}
        run={run}
        busy={busy}
      />
    );
  else if (snapshot && section.endsWith('/catalog'))
    content = (
      <Panel title="فهرست گزارش‌ها">
        <div className="grid gap-3 sm:grid-cols-2">
          {sections
            .filter(
              ([route]) =>
                route.startsWith('general-ledger/reports/') &&
                !route.endsWith('/catalog'),
            )
            .map(([route, label]) => (
              <Link
                key={route}
                className="rounded-xl border p-4 text-primary"
                href={`/finance/accounting/${route}?bookId=${bookId}`}
              >
                {label}
              </Link>
            ))}
        </div>
        <p>
          گزارش‌های عملیاتی بر مبنای اسناد قطعی هستند. صورت‌های قانونی به قالب
          مصوب مرجع بیرونی نیاز دارند.
        </p>
      </Panel>
    );
  else if (snapshot && section.includes('/reports'))
    content = (
      <AccountingReportWorkspace
        key={bookId + section}
        book={snapshot}
        turnoverMode={section.endsWith('/account-browser')}
      />
    );
  else if (snapshot && section === 'general-ledger/year-end')
    content = (
      <AccountingYearEndWorkspace book={snapshot} run={run} busy={busy} />
    );
  else if (snapshot) {
    const chart = section.endsWith('/chart'),
      details = section.endsWith('/details');
    const kind = section.endsWith('approval-policies')
      ? 'approval-policies'
      : section.endsWith('fiscal-years')
        ? 'fiscal-years'
        : section.endsWith('voucher-types')
          ? 'voucher-types'
          : section.endsWith('detail-types')
            ? 'detail-types'
            : section.endsWith('mappings')
              ? 'account-mappings'
              : section.endsWith('automatic-templates')
                ? 'allocation-templates'
                : null;
    if (kind || chart || details) {
      const rows = chart
        ? snapshot.accounts
        : details
          ? snapshot.details
          : snapshot.configurations.filter((c) => c.kind === kind);
      const attrFields: Field[] =
        kind === 'fiscal-years'
          ? [
              { key: 'startDate', label: 'شروع سال مالی', kind: 'date' },
              { key: 'endDate', label: 'پایان سال مالی', kind: 'date' },
            ]
          : kind === 'approval-policies'
            ? [
                { key: 'currency', label: 'ارز پایه دفتر' },
                { key: 'minAmount', label: 'حداقل مبلغ' },
                { key: 'maxAmount', label: 'حداکثر مبلغ (خالی برای بدون سقف)' },
                {
                  key: 'permission',
                  label: 'مجوز تأیید',
                  kind: 'select',
                  options: [
                    {
                      value: 'finance.journal.approve',
                      label: 'تأیید سند حسابداری',
                    },
                  ],
                },
              ]
            : chart
              ? [
                  {
                    key: 'natureControl',
                    label: 'کنترل ماهیت',
                    kind: 'select',
                    options: [
                      { value: 'NONE', label: 'بدون کنترل' },
                      { value: 'WARN', label: 'هشدار' },
                      { value: 'BLOCK', label: 'منع ثبت' },
                    ],
                  },
                  { key: 'traceable', label: 'دارای پیگیری', kind: 'check' },
                  { key: 'multiCurrency', label: 'ارزی', kind: 'check' },
                  { key: 'revaluable', label: 'تسعیرپذیر', kind: 'check' },
                  {
                    key: 'zeroBalanceAtClose',
                    label: 'مانده صفر در پایان دوره',
                    kind: 'check',
                  },
                  ...[4, 5, 6].flatMap((n) => [
                    {
                      key: `detail${n}Required`,
                      label: `تفصیلی سطح ${n} اجباری`,
                      kind: 'check' as const,
                    },
                    {
                      key: `detail${n}TypeId`,
                      label: `نوع تفصیلی سطح ${n}`,
                      kind: 'select' as const,
                      options: options(
                        snapshot.configurations.filter(
                          (c) => c.kind === 'detail-types',
                        ),
                      ),
                    },
                  ]),
                ]
              : kind === 'detail-types'
                ? [
                    { key: 'defaultFirstCode', label: 'اولین کد پیش‌فرض' },
                    {
                      key: 'parentTypeId',
                      label: 'نوع تفصیلی پدر',
                      kind: 'select',
                      options: options(
                        snapshot.configurations.filter(
                          (c) => c.kind === 'detail-types',
                        ),
                      ),
                    },
                    {
                      key: 'classificationNumberLength',
                      label: 'طول شماره طبقه‌بندی',
                    },
                    {
                      key: 'enforceParent',
                      label: 'کنترل والد',
                      kind: 'check',
                    },
                  ]
                : details
                  ? [
                      { key: 'classificationNumber', label: 'شماره طبقه‌بندی' },
                      { key: 'ownerReference', label: 'مرجع مشتری یا سازمان' },
                    ]
                  : [];
      const specific: Field[] = chart
        ? [
            {
              key: 'level',
              label: 'سطح حساب',
              kind: 'select',
              options: [
                { value: 'GROUP', label: 'گروه' },
                { value: 'GENERAL', label: 'کل' },
                { value: 'SUBSIDIARY', label: 'معین' },
              ],
            },
            {
              key: 'parentId',
              label: 'حساب والد',
              kind: 'select',
              options: options(
                snapshot.accounts.filter((a) => a.level !== 'SUBSIDIARY'),
              ),
            },
            {
              key: 'nature',
              label: 'ماهیت',
              kind: 'select',
              options: [
                { value: 'DEBIT', label: 'بدهکار' },
                { value: 'CREDIT', label: 'بستانکار' },
              ],
            },
            { key: 'permanent', label: 'دائمی', kind: 'check' },
          ]
        : details
          ? [
              {
                key: 'typeId',
                label: 'نوع تفصیلی',
                kind: 'select',
                options: options(
                  snapshot.configurations.filter(
                    (c) => c.kind === 'detail-types',
                  ),
                ),
              },
              {
                key: 'parentId',
                label: 'تفصیلی پدر',
                kind: 'select',
                options: options(snapshot.details),
              },
              { key: 'currency', label: 'ارز پیش‌فرض' },
            ]
          : [];
      const save = () => {
        const attrs: AccountingAttributes = {};
        for (const f of attrFields) attrs[f.key] = draft[f.key] ?? '';
        return run(
          chart
            ? 'save-account'
            : details
              ? 'save-detail'
              : 'save-configuration',
          {
            ...draft,
            kind,
            attributes: attrs,
            ...(editing ? { id: editing.id } : {}),
          },
          editing?.version,
        ).then((result) => {
          if (result) {
            setDraft({ active: true, permanent: true });
            setEditing(null);
          }
        });
      };
      content = (
        <Panel title={title}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Fields fields={[...fields, ...specific]} draft={draft} set={set} />
            {attrFields.length ? (
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer font-bold">
                  قواعد و اطلاعات تکمیلی
                </summary>
                <div className="pt-4">
                  <Fields fields={attrFields} draft={draft} set={set} />
                </div>
              </details>
            ) : null}
            <div className="flex gap-2">
              <Button
                permission="finance.account.manage"
                disabled={busy}
                type="submit"
              >
                {editing ? 'ذخیره تغییرات' : 'ثبت جدید'}
              </Button>
              {editing ? (
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDraft({ active: true, permanent: true });
                  }}
                >
                  لغو ویرایش
                </Button>
              ) : null}
            </div>
          </form>
          <Table headers={['کد', 'عنوان', 'وضعیت', 'عملیات']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{r.code}</td>
                <td className={cell}>{r.title}</td>
                <td className={cell}>{r.active ? 'فعال' : 'غیرفعال'}</td>
                <td className={cell}>
                  <Button
                    permission="finance.account.manage"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const base: Draft = {};
                      for (const [k, value] of Object.entries(r))
                        if (
                          typeof value === 'string' ||
                          typeof value === 'boolean'
                        )
                          base[k] = value;
                      for (const [k, value] of Object.entries(r.attributes))
                        if (
                          typeof value === 'string' ||
                          typeof value === 'boolean'
                        )
                          base[k] = value;
                      setDraft(base);
                      setEditing({ id: r.id, version: r.version });
                    }}
                  >
                    ویرایش
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      );
    } else
      content = (
        <Panel title={title}>
          <p>
            این عملیات برای اتصال تأییدشده و قواعد نسخه‌دار آماده‌سازی می‌شود.
          </p>
        </Panel>
      );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <FormField label="دفتر حسابداری" id="accounting-book">
            <SearchCombobox
              id="accounting-book"
              value={bookId}
              onValueChange={(id) => {
                setBookId(id);
                const params = new URLSearchParams(urlParams.toString());
                params.set('bookId', id);
                router.replace(`${pathname}?${params}`, { scroll: false });
                setDraft({
                  active: true,
                  permanent: true,
                  allowsPosting: true,
                });
                setEditing(null);
                pending.current = null;
              }}
              options={books.map((b) => ({
                value: b.id,
                label: `${b.code} — ${b.title}`,
              }))}
            />
          </FormField>
        </div>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          به‌روزرسانی
        </Button>
      </div>
      {error || booksQuery.error || snapshotQuery.error ? (
        <div
          role="alert"
          className="rounded-xl bg-destructive/10 p-4 text-destructive"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-emerald-700"
        >
          {notice}
        </p>
      ) : null}
      {loading && !snapshot ? <p role="status">در حال بارگذاری…</p> : content}
    </div>
  );
}

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
function JournalWorkspace({
  book,
  mode,
  busy,
  run,
  can,
}: {
  book: AccountingSnapshotV1;
  mode: 'edit' | 'list';
  busy: boolean;
  run: Run;
  can: (p: string) => boolean;
}) {
  const [journal, setJournal] = useState<AccountingJournalV1 | null>(null),
    [head, setHead] = useState<Draft>({}),
    [reverseHead, setReverseHead] = useState<Draft>({}),
    [lines, setLines] = useState<AccountingLineV1[]>([
      blankLine(),
      blankLine(),
    ]);
  const linkedId = useSearchParams().get('journalId') ?? '';
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('');
  const journalQuery = useQuery({
    queryKey: [
      'accounting',
      'journals',
      book.book.id,
      page,
      search,
      status,
      linkedId,
    ],
    queryFn: () =>
      accountingApi.journals(book.book.id, {
        page: String(page),
        id: linkedId,
        search,
        status,
      }),
  });
  const items = journalQuery.data?.items ?? [],
    total = journalQuery.data?.total ?? 0,
    failure = journalQuery.error?.message ?? '';
  const load = () => journalQuery.refetch();
  const open = (j: AccountingJournalV1) => {
    setJournal(j);
    setHead({
      periodId: j.periodId ?? '',
      typeId: j.typeId ?? '',
      documentDate: j.documentDate ?? '',
      description: j.description,
      reference: j.reference ?? '',
    });
    setLines(j.lines);
  };
  const displayTotals = journalDisplayTotals(lines);
  const readonly = journal !== null && journal.status !== 'DRAFT';
  const action = async (name: string) => {
    if (!journal) return;
    let current = journal;
    if (name === 'submit') {
      const saved = await run<AccountingJournalV1>(
        'journal-save',
        { ...head, lines, id: journal.id },
        journal.version,
      );
      if (!saved) return;
      current = saved;
      open(saved);
    }
    const result = await run<AccountingJournalV1>(
      name,
      { id: current.id },
      current.version,
    );
    if (result) {
      open(result);
      await load();
    }
  };
  const save = async () => {
    const result = await run<AccountingJournalV1>(
      'journal-save',
      { ...head, lines, ...(journal ? { id: journal.id } : {}) },
      journal?.version,
    );
    if (result) {
      open(result);
      await load();
    }
  };
  const selection = (
    label: string,
    value: string | null,
    options: { id: string; title: string; code?: string }[],
    onChange: (value: string) => void,
  ) => (
    <SearchCombobox
      label={label}
      value={value ?? ''}
      disabled={readonly}
      onValueChange={onChange}
      options={options.map((o) => ({
        value: o.id,
        label: `${o.code ?? ''} ${o.title}`,
      }))}
    />
  );
  return (
    <Panel title="اسناد حسابداری">
      {failure ? (
        <p role="alert" className="text-destructive">
          {failure}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Input
          aria-label="جست‌وجوی اسناد"
          placeholder="شرح یا شماره عطف"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <SearchCombobox
          label="وضعیت سند"
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={Object.entries(statuses).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <Button
          permission="finance.journal.create"
          variant="outline"
          onClick={() => {
            setJournal(null);
            setHead({});
            setLines([blankLine(), blankLine()]);
          }}
        >
          سند جدید
        </Button>
      </div>
      <Table headers={['شماره', 'تاریخ', 'شرح', 'وضعیت', 'عملیات']}>
        {items.map((j) => (
          <tr key={j.id}>
            <td className={cell}>{j.number ?? '—'}</td>
            <td className={cell}>{j.documentDate ?? '—'}</td>
            <td className={cell}>{j.description || 'بدون شرح'}</td>
            <td className={cell}>{statuses[j.status]}</td>
            <td className={cell}>
              <Button size="sm" variant="outline" onClick={() => open(j)}>
                مشاهده
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          قبلی
        </Button>
        <span>
          صفحه {page} · {total} سند
        </span>
        <Button
          variant="outline"
          disabled={page * 30 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </Button>
      </div>
      {mode === 'edit' || journal ? (
        <form
          className="space-y-5 rounded-2xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex justify-between">
            <h3 className="font-bold">
              {journal
                ? `سند ${journal.number ?? 'بدون شماره'} — ${statuses[journal.status]}`
                : 'پیش‌نویس جدید'}
            </h3>
            {journal?.reversalOfId ? <span>سند برگشتی</span> : null}
          </div>
          <Fields
            fields={[
              {
                key: 'periodId',
                label: 'دوره مالی',
                kind: 'select',
                options: book.periods.map((p) => ({
                  value: p.id,
                  label: `${book.configurations.find((c) => c.id === p.fiscalYearId)?.title ?? ''} ${p.startDate} — ${p.endDate}`,
                })),
              },
              {
                key: 'typeId',
                label: 'نوع سند',
                kind: 'select',
                options: book.configurations
                  .filter((c) => c.kind === 'voucher-types')
                  .map((c) => ({ value: c.id, label: c.title })),
              },
              { key: 'documentDate', label: 'تاریخ سند', kind: 'date' },
              { key: 'reference', label: 'شماره عطف' },
              { key: 'description', label: 'شرح سند', kind: 'area' },
            ]}
            draft={head}
            disabled={readonly}
            set={(key, value) => setHead((h) => ({ ...h, [key]: value }))}
          />
          <div className="space-y-4">
            {lines.map((row, index) => {
              const update = (data: Partial<AccountingLineV1>) =>
                setLines((rows) =>
                  rows.map((r, i) => (i === index ? { ...r, ...data } : r)),
                );
              return (
                <div
                  key={index}
                  className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">ردیف {index + 1}</span>
                    {!readonly ? (
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setLines((rows) => rows.filter((_, i) => i !== index))
                        }
                        aria-label={`حذف ردیف ${index + 1}`}
                      >
                        حذف ردیف
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FormField label="حساب معین">
                      {selection(
                        'حساب معین',
                        row.accountId,
                        book.accounts.filter(
                          (a) => a.level === 'SUBSIDIARY' && a.active,
                        ),
                        (accountId) => update({ accountId: accountId || null }),
                      )}
                    </FormField>
                    {([4, 5, 6] as const).map((n) => (
                      <FormField label={`تفصیلی ${n}`} key={n}>
                        {selection(
                          `تفصیلی ${n}`,
                          row[`detail${n}Id`],
                          book.details.filter((d) => d.active),
                          (value) =>
                            update({ [`detail${n}Id`]: value || null }),
                        )}
                      </FormField>
                    ))}
                    <FormField label="بدهکار">
                      <Input
                        aria-label={`بدهکار ردیف ${index + 1}`}
                        disabled={readonly}
                        dir="ltr"
                        inputMode="decimal"
                        value={row.debit}
                        onChange={(e) => update({ debit: e.target.value })}
                      />
                    </FormField>
                    <FormField label="بستانکار">
                      <Input
                        aria-label={`بستانکار ردیف ${index + 1}`}
                        disabled={readonly}
                        dir="ltr"
                        inputMode="decimal"
                        value={row.credit}
                        onChange={(e) => update({ credit: e.target.value })}
                      />
                    </FormField>
                    <FormField label="شرح ردیف">
                      <Input
                        aria-label={`شرح ردیف ${index + 1}`}
                        disabled={readonly}
                        value={row.description}
                        onChange={(e) =>
                          update({ description: e.target.value })
                        }
                      />
                    </FormField>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold">
                      ارز و پیگیری
                    </summary>
                    <div className="grid gap-3 pt-3 sm:grid-cols-3">
                      <FormField label="نرخ مصوب">
                        <SearchCombobox
                          disabled={readonly}
                          label="نرخ مصوب"
                          value={row.fxSnapshotId ?? ''}
                          options={book.fxRates
                            .filter((r) => r.status === 'APPROVED')
                            .map((r) => ({
                              value: r.id,
                              label: `${r.currency} — ${r.rate} · ${r.source}`,
                            }))}
                          onValueChange={(id) => {
                            const fx = book.fxRates.find((r) => r.id === id);
                            update({
                              fxSnapshotId: id || null,
                              rate: fx?.rate ?? null,
                              currency: fx?.currency ?? null,
                            });
                          }}
                        />
                      </FormField>
                      {(['currency', 'foreignAmount', 'rate'] as const).map(
                        (key) => (
                          <FormField
                            key={key}
                            label={
                              key === 'currency'
                                ? 'کد ارز'
                                : key === 'rate'
                                  ? 'نرخ ارز'
                                  : 'مبلغ ارزی'
                            }
                          >
                            <Input
                              disabled={readonly}
                              dir="ltr"
                              aria-label={`${key} ${index + 1}`}
                              value={row[key] ?? ''}
                              onChange={(e) =>
                                update({ [key]: e.target.value || null })
                              }
                            />
                          </FormField>
                        ),
                      )}
                      <FormField label="شماره پیگیری">
                        <Input
                          aria-label="شماره پیگیری"
                          disabled={readonly}
                          value={String(row.attributes.trackingNumber ?? '')}
                          onChange={(e) =>
                            update({
                              attributes: {
                                ...row.attributes,
                                trackingNumber: e.target.value,
                              },
                            })
                          }
                        />
                      </FormField>
                      <FormField label="تاریخ پیگیری">
                        <DatePicker
                          aria-label="تاریخ پیگیری"
                          disabled={readonly}
                          value={String(row.attributes.trackingDate ?? '')}
                          onChange={(value) =>
                            update({
                              attributes: {
                                ...row.attributes,
                                trackingDate: value,
                              },
                            })
                          }
                        />
                      </FormField>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
          <div role="status" className="rounded-xl border p-3 text-sm">
            {displayTotals.valid ? (
              <>
                جمع بدهکار: {displayTotals.debit} · جمع بستانکار:{' '}
                {displayTotals.credit} · اختلاف: {displayTotals.difference}
              </>
            ) : (
              <>مبالغ ردیف‌ها را بررسی کنید.</>
            )}
          </div>
          {Array.isArray(journal?.attributes.warnings) ? (
            <div role="status" className="rounded-xl border p-3">
              {journal.attributes.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {journal &&
            ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(
              journal.status,
            ) ? (
              <Button
                permission="finance.journal.create"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('این سند لغو شود؟')) void action('cancel');
                }}
              >
                لغو سند
              </Button>
            ) : null}
            {journal?.status === 'CANCELLED' ? (
              <Button
                permission="finance.journal.create"
                type="button"
                disabled={busy}
                onClick={() => void action('restore')}
              >
                بازیابی پیش‌نویس
              </Button>
            ) : null}
            {!readonly ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLines((rows) => [...rows, blankLine()])}
                >
                  افزودن ردیف
                </Button>
                <Button
                  permission="finance.journal.create"
                  type="submit"
                  disabled={busy}
                >
                  ذخیره پیش‌نویس
                </Button>
              </>
            ) : null}
            {journal?.status === 'DRAFT' ? (
              <Button
                type="button"
                permission="finance.journal.create"
                disabled={busy}
                onClick={() => void action('submit')}
              >
                ارسال برای تأیید
              </Button>
            ) : null}
            {journal?.status === 'PENDING_APPROVAL' ? (
              <Button
                type="button"
                permission="finance.journal.approve"
                disabled={busy}
                onClick={() => void action('approve')}
              >
                تأیید سند
              </Button>
            ) : null}
            {journal?.status === 'APPROVED' ? (
              <Button
                type="button"
                permission="finance.journal.post"
                disabled={busy}
                onClick={() => void action('post')}
              >
                ثبت قطعی
              </Button>
            ) : null}
            {journal &&
            ['PENDING_APPROVAL', 'APPROVED'].includes(journal.status) &&
            can('finance.journal.create') ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void action('return')}
              >
                بازگشت به پیش‌نویس
              </Button>
            ) : null}
          </div>
          {journal ? (
            <AccountingAttachments
              key={journal.id}
              book={book}
              journal={journal}
            />
          ) : null}
          {journal?.status === 'POSTED' ? (
            <section className="space-y-3 rounded-xl border p-4">
              <h4 className="font-bold">برگشت سند قطعی</h4>
              <Fields
                fields={[
                  {
                    key: 'periodId',
                    label: 'دوره برگشت',
                    kind: 'select',
                    options: book.periods
                      .filter((p) => p.status === 'OPEN')
                      .map((p) => ({
                        value: p.id,
                        label: p.startDate + ' — ' + p.endDate,
                      })),
                  },
                  { key: 'documentDate', label: 'تاریخ برگشت', kind: 'date' },
                  { key: 'reason', label: 'دلیل برگشت', kind: 'area' },
                ]}
                draft={reverseHead}
                set={(key, value) =>
                  setReverseHead((h) => ({ ...h, [key]: value }))
                }
              />
              <Button
                permission="finance.journal.reverse"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('سند برگشتی مستقل ایجاد شود؟')) return;
                  const r = await run<AccountingJournalV1>(
                    'reverse',
                    { id: journal.id, ...reverseHead },
                    journal.version,
                  );
                  if (r) {
                    open(r);
                    await load();
                  }
                }}
              >
                ایجاد پیش‌نویس برگشتی
              </Button>
            </section>
          ) : null}
        </form>
      ) : null}
    </Panel>
  );
}
