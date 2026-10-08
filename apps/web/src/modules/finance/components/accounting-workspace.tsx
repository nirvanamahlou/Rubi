'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
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
import { AccountingLedgerEditor } from './accounting-ledger-editor';
import { AccountingBaseList } from './accounting-base-list';
import { AccountingDefinitionToolbar } from './accounting-definition-toolbar';
import type { AccountingListKind } from '../accounting-list-filters';
import { AccountingAdvancedWorkspace } from './accounting-advanced-workspace';
import { AccountingSourceWorkspace } from './accounting-source-workspace';
import { AccountingYearEndWorkspace } from './accounting-year-end-workspace';
import {
  AccountingAutomationWorkspace,
  AccountingMappingWorkspace,
} from './accounting-automation-workspace';
import {
  accountingParityByRoute,
  accountingParityDefinitions,
} from './accounting-parity-definitions';
import {
  AccountingParityWorkspace,
  AccountingUnknownRoute,
} from './accounting-parity-workspace';
import {
  AccountingChartEditor,
  AccountingAnalyticalReport,
  AccountingGroupingEditor,
  AccountingMoveDrafts,
  AccountingTemplateEditor,
} from './accounting-parity-editors';

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
const writableJournalLines = (lines: AccountingLineV1[]) =>
  lines.map((line) => ({
    ...line,
    attributes: {
      ...(line.attributes.descriptionEn !== undefined
        ? { descriptionEn: line.attributes.descriptionEn }
        : {}),
      ...(line.attributes.trackingNumber !== undefined
        ? { trackingNumber: line.attributes.trackingNumber }
        : {}),
      ...(line.attributes.trackingDate !== undefined
        ? { trackingDate: line.attributes.trackingDate }
        : {}),
    },
  }));
const statuses: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_APPROVAL: 'منتظر تأیید',
  APPROVED: 'تأییدشده',
  POSTED: 'قطعی',
  CANCELLED: 'لغوشده',
};
const internalSections: readonly (readonly [string, string])[] = [
  ['general-ledger/documents/allocation-templates', 'الگوهای تخصیص داخلی'],
  ['general-ledger/documents/list', 'فهرست اسناد'],
  ['general-ledger/documents/transfer-batches', 'بسته انتقال حسابداری'],
  ['general-ledger/reports/catalog', 'فهرست گزارش‌ها'],
  ['receipts-payments/reports', 'گزارش پرداخت و دریافت'],
] as const;
const sections: readonly (readonly [string, string])[] = [
  ...accountingParityDefinitions.map(
    (definition) => [definition.route, definition.title] as const,
  ),
  ...internalSections,
];
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
  const home =
    pathname === '/finance' ||
    section === '' ||
    section === 'general-ledger' ||
    (!sections.some(([route]) => section === route) &&
      [
        'general-ledger/base-information',
        'general-ledger/accounts',
        'general-ledger/documents',
        'general-ledger/year-end',
        'general-ledger/reports',
        'receipts-payments',
        'receipts-payments/base-information',
        'taxpayer-system',
        'taxpayer-system/lists',
        'tax-accounting',
        'tax-accounting/base-information',
        'tax-accounting/vat',
      ].includes(section));
  const title = sections.find(([r]) => r === section)?.[1] ?? 'حسابداری';
  const fields: Field[] = [
    { key: 'code', label: 'کد' },
    { key: 'title', label: 'عنوان' },
    { key: 'titleEn', label: 'عنوان به زبان دوم' },
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
      <AccountingLedgerEditor
        key={`${bookId || 'new-ledger'}:${snapshot?.book.version ?? 0}`}
        snapshot={snapshot}
        branches={branches}
        busy={busy}
        run={run}
        refresh={refresh}
        onCreated={async (book) => {
          setBookId(book.id);
          const params = new URLSearchParams(urlParams.toString());
          params.set('bookId', book.id);
          router.replace(`${pathname}?${params}`, { scroll: false });
          await refresh();
        }}
      />
    );
  else if (snapshot && section === 'receipts-payments/reports')
    content = (
      <AccountingSourceWorkspace book={snapshot} run={run} busy={busy} />
    );
  else if (
    snapshot &&
    (section.endsWith('/allocation-templates') ||
      section.endsWith('/numbering'))
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
  else if (snapshot && section === 'general-ledger/accounts/chart')
    content = <AccountingChartEditor book={snapshot} run={run} busy={busy} />;
  else if (
    snapshot &&
    [
      'general-ledger/accounts/account-groups',
      'general-ledger/accounts/detail-groups',
    ].includes(section)
  )
    content = (
      <AccountingGroupingEditor
        book={snapshot}
        run={run}
        busy={busy}
        kind={section.endsWith('/detail-groups') ? 'detail' : 'account'}
      />
    );
  else if (
    snapshot &&
    accountingParityByRoute.get(section)?.implementation === 'template-list'
  ) {
    const templateKind = section.includes('revaluation')
      ? 'REVALUATION'
      : section.includes('closing')
        ? 'CLOSING'
        : 'AUTOMATIC';
    content = (
      <AccountingTemplateEditor
        book={snapshot}
        run={run}
        busy={busy}
        kind={templateKind}
        readOnly={section.includes('/lists/')}
      />
    );
  } else if (
    snapshot &&
    accountingParityByRoute.get(section)?.implementation === 'move-drafts'
  ) {
    content = <AccountingMoveDrafts book={snapshot} run={run} busy={busy} />;
  } else if (
    snapshot &&
    ['fiscal-years', 'ledgers', 'voucher-types'].some(
      (kind) => section === `general-ledger/base-information/lists/${kind}`,
    )
  ) {
    const kind = section.split('/').at(-1) as AccountingListKind;
    content = (
      <AccountingBaseList
        key={`${bookId}:${kind}`}
        kind={kind}
        snapshot={snapshot}
        books={books}
        busy={busy || loading}
        refresh={refresh}
      />
    );
  } else if (home)
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
      accountingParityByRoute.get(section)?.implementation === 'journal-list' ||
      section.endsWith('/documents/review') ||
      section.endsWith('/documents/posting') ||
      section.endsWith('/documents/deleted'))
  )
    content = (
      <JournalWorkspace
        key={bookId + section}
        book={snapshot}
        mode={
          section.endsWith('/journals')
            ? 'edit'
            : section.endsWith('/review')
              ? 'review'
              : section.endsWith('/posting')
                ? 'posting'
                : section.endsWith('/deleted')
                  ? 'deleted'
                  : 'list'
        }
        busy={busy}
        run={run}
        can={can}
      />
    );
  else if (
    snapshot &&
    (section.endsWith('/revaluation') ||
      section.endsWith('/transfer-batches') ||
      section === 'taxpayer-system/settings')
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
  else if (
    snapshot &&
    accountingParityByRoute.get(section)?.implementation === 'analytical-report'
  )
    content = (
      <AccountingAnalyticalReport
        book={snapshot}
        kind={
          section.endsWith('/dormant-accounts')
            ? 'dormant'
            : section.endsWith('/nature-conflict-period')
              ? 'nature-conflict-period'
              : section.endsWith('/nature-conflict-range')
                ? 'nature-conflict-running'
                : 'comparative'
        }
      />
    );
  else if (
    snapshot &&
    (section === 'general-ledger/reports/trial-balance' ||
      section === 'general-ledger/reports/account-browser')
  )
    content = (
      <AccountingReportWorkspace
        key={bookId + section}
        book={snapshot}
        turnoverMode={section.endsWith('/account-browser')}
      />
    );
  else if (
    snapshot &&
    [
      'general-ledger/year-end/closing',
      'general-ledger/year-end/opening',
    ].includes(section)
  )
    content = (
      <AccountingYearEndWorkspace
        book={snapshot}
        run={run}
        busy={busy}
        mode={section.endsWith('/opening') ? 'opening' : 'closing'}
      />
    );
  else if (snapshot) {
    const chart = false,
      details = section.endsWith('/details');
    const kind = section.endsWith('fiscal-years')
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
      const listOnly =
        accountingParityByRoute.get(section)?.implementation ===
        'configuration-list';
      const rows = chart
        ? snapshot.accounts
        : details
          ? snapshot.details
          : snapshot.configurations.filter((c) => c.kind === kind);
      const recordFields =
        kind === 'fiscal-years' ||
        kind === 'voucher-types' ||
        kind === 'detail-types'
          ? fields.filter(
              (field) =>
                field.key !== 'code' &&
                field.key !== 'active' &&
                field.key !== 'description',
            )
          : fields.filter((field) => field.key !== 'description');
      const attrFields: Field[] =
        kind === 'fiscal-years'
          ? []
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
      const listRoute = accountingParityDefinitions.find(
        (definition) =>
          definition.implementation === 'configuration-list' &&
          definition.route.replace('/lists/', '/') === section,
      )?.route;
      const save = (after: 'stay' | 'new' | 'close' = 'stay') => {
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
            if (after === 'stay') {
              const saved = result as { id: string; version: number };
              setEditing({ id: saved.id, version: saved.version });
            } else {
              setDraft({ active: true, permanent: true });
              setEditing(null);
              if (after === 'close' && listRoute)
                router.push(
                  `/finance/accounting/${listRoute}?bookId=${bookId}`,
                );
            }
          }
        });
      };
      content = (
        <Panel title={title}>
          {!listOnly ? (
            <form
              id={
                kind === 'fiscal-years' ? 'fiscal-year-definition' : undefined
              }
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save('stay');
              }}
            >
              {kind === 'fiscal-years' ? (
                <AccountingDefinitionToolbar
                  busy={busy}
                  canClose={!!listRoute}
                  save={(after) => {
                    const form = document.getElementById(
                      'fiscal-year-definition',
                    ) as HTMLFormElement | null;
                    if (form?.reportValidity()) void save(after);
                  }}
                  reset={() => {
                    setEditing(null);
                    setDraft({ active: true, permanent: true });
                  }}
                  refresh={() => void refresh()}
                  close={() => {
                    if (listRoute)
                      router.push(
                        `/finance/accounting/${listRoute}?bookId=${bookId}`,
                      );
                  }}
                />
              ) : null}
              <Fields
                fields={[...recordFields, ...specific]}
                draft={draft}
                set={set}
              />
              <details className="rounded-xl border p-4">
                <summary className="cursor-pointer font-bold">
                  یادداشت‌ها
                </summary>
                <div className="pt-4">
                  <FieldControl
                    field={{
                      key: 'description',
                      label: 'یادداشت',
                      kind: 'area',
                    }}
                    value={draft.description ?? ''}
                    onChange={(value) => set('description', value)}
                  />
                </div>
              </details>
              {attrFields.length ? (
                <details className="rounded-xl border p-4">
                  <summary className="cursor-pointer font-bold">
                    تنظیمات عملیاتی روبی
                  </summary>
                  <div className="pt-4">
                    <Fields fields={attrFields} draft={draft} set={set} />
                  </div>
                </details>
              ) : null}
              {kind !== 'fiscal-years' ? (
                <div className="flex gap-2">
                  <Button
                    permission="finance.account.manage"
                    disabled={busy}
                    type="submit"
                  >
                    ذخیره
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => void save('new')}
                  >
                    ذخیره و جدید
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy || !listRoute}
                    onClick={() => void save('close')}
                  >
                    ذخیره و بستن
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setDraft({ active: true, permanent: true });
                    }}
                  >
                    جدید
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => void refresh()}
                  >
                    بارگذاری مجدد
                  </Button>
                </div>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              این مسیر فهرست مستقل منبع است؛ برای ثبت یا تغییر، فرم تعریف همان
              قلم را باز کنید.
            </p>
          )}
          <Table headers={['کد', 'عنوان', 'وضعیت', 'عملیات']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cell}>{r.code}</td>
                <td className={cell}>{r.title}</td>
                <td className={cell}>{r.active ? 'فعال' : 'غیرفعال'}</td>
                <td className={cell}>
                  {listOnly ? (
                    <Link
                      className="inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-bold text-primary"
                      href={`/finance/accounting/${section.replace('/lists/', '/')}?bookId=${bookId}`}
                    >
                      بازکردن فرم
                    </Link>
                  ) : (
                    <Button
                      permission="finance.account.manage"
                      size="sm"
                      variant="outline"
                      {...(kind === 'fiscal-years'
                        ? {
                            'aria-label': 'ویرایش دوره مالی',
                            'aria-keyshortcuts': 'Enter',
                            title:
                              'ویرایش دوره مالی · Enter هنگام تمرکز روی دکمه',
                          }
                        : {})}
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
                      {kind === 'fiscal-years' ? (
                        <Pencil className="size-4" />
                      ) : (
                        'ویرایش'
                      )}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>
      );
    } else {
      const definition = accountingParityByRoute.get(section);
      content = definition ? (
        <AccountingParityWorkspace definition={definition} />
      ) : (
        <AccountingUnknownRoute route={section} />
      );
    }
  }
  return (
    <div className="space-y-5">
      <div
        className={
          section === 'general-ledger/base-information/ledgers'
            ? 'hidden'
            : 'flex flex-wrap items-end gap-3'
        }
      >
        {![
          'general-ledger/base-information/fiscal-years',
          'general-ledger/base-information/ledgers',
          'general-ledger/base-information/voucher-types',
        ].includes(section) && (
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
        )}
        {!section.startsWith('general-ledger/base-information/lists/') &&
          section !== 'general-ledger/base-information/fiscal-years' && (
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading || busy}
            >
              به‌روزرسانی
            </Button>
          )}
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
type JournalMode = 'edit' | 'list' | 'review' | 'posting' | 'deleted';
function JournalWorkspace({
  book,
  mode,
  busy,
  run,
  can,
}: {
  book: AccountingSnapshotV1;
  mode: JournalMode;
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
  const fixedStatus =
    mode === 'review'
      ? 'PENDING_APPROVAL'
      : mode === 'posting'
        ? 'APPROVED'
        : mode === 'deleted'
          ? 'CANCELLED'
          : '';
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(fixedStatus);
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
  const eventQuery = useQuery({
    queryKey: ['accounting', 'journal-events', book.book.id, journal?.id],
    queryFn: () => accountingApi.journalEvents(book.book.id, journal!.id),
    enabled: mode === 'deleted' && Boolean(journal),
  });
  const load = () => journalQuery.refetch();
  const open = (j: AccountingJournalV1) => {
    setJournal(j);
    setHead({
      periodId: j.periodId ?? '',
      typeId: j.typeId ?? '',
      documentDate: j.documentDate ?? '',
      description: j.description,
      reference: j.reference ?? '',
      auxiliaryNumber: String(j.attributes.auxiliaryNumber ?? ''),
      descriptionEn: String(j.attributes.descriptionEn ?? ''),
    });
    setLines(j.lines);
  };
  const displayTotals = journalDisplayTotals(lines);
  const readonly = journal !== null && journal.status !== 'DRAFT';
  const action = async (name: string) => {
    if (!journal) return;
    let current = journal;
    if (name === 'submit') {
      const { auxiliaryNumber, descriptionEn, ...header } = head;
      const saved = await run<AccountingJournalV1>(
        'journal-save',
        {
          ...header,
          attributes: { auxiliaryNumber, descriptionEn },
          lines: writableJournalLines(lines),
          id: journal.id,
        },
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
    const { auxiliaryNumber, descriptionEn, ...header } = head;
    const result = await run<AccountingJournalV1>(
      'journal-save',
      {
        ...header,
        attributes: { auxiliaryNumber, descriptionEn },
        lines: writableJournalLines(lines),
        ...(journal ? { id: journal.id } : {}),
      },
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
    <Panel
      title={
        mode === 'review'
          ? 'بررسی اسناد'
          : mode === 'posting'
            ? 'قطعی کردن اسناد'
            : mode === 'deleted'
              ? 'اسناد حذف‌شده'
              : mode === 'edit'
                ? 'صدور سند حسابداری'
                : 'فهرست اسناد حسابداری'
      }
    >
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
        {fixedStatus ? (
          <p className="rounded-xl border bg-muted/30 px-4 py-2 text-sm">
            وضعیت فهرست: {statuses[fixedStatus]}
          </p>
        ) : (
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
        )}
        {mode === 'edit' || mode === 'list' ? (
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
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        شماره روزانه در روبی هنوز قرارداد مستقل ندارد و با خط تیره نمایش داده
        می‌شود. پیوست‌ها پس از بازکردن سند از مخزن اسناد خوانده می‌شوند.
      </p>
      <Table
        headers={[
          'شماره سند',
          'تاریخ',
          'وضعیت',
          'نوع سند',
          'شرح',
          'شماره عطف',
          'شماره فرعی',
          'شماره روزانه',
          'مبلغ سند',
          'صادرکننده',
          'پیوست',
          'عملیات',
        ]}
      >
        {items.map((j) => (
          <tr key={j.id}>
            <td className={cell}>{j.number ?? '—'}</td>
            <td className={cell}>{j.documentDate ?? '—'}</td>
            <td className={cell}>{statuses[j.status]}</td>
            <td className={cell}>
              {book.configurations.find((item) => item.id === j.typeId)
                ?.title ?? '—'}
            </td>
            <td className={cell}>{j.description || 'بدون شرح'}</td>
            <td className={cell}>{j.reference ?? '—'}</td>
            <td className={cell}>
              {String(j.attributes.auxiliaryNumber ?? '—')}
            </td>
            <td className={cell}>—</td>
            <td className={cell} dir="ltr">
              {journalDisplayTotals(j.lines).valid
                ? journalDisplayTotals(j.lines).debit
                : '—'}{' '}
              {book.book.baseCurrency}
            </td>
            <td className={cell}>{j.makerName || 'نام در دسترس نیست'}</td>
            <td className={cell}>پس از مشاهده</td>
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
      {mode === 'deleted' && journal ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h3 className="font-bold">سابقه لغو و بازیابی</h3>
          {eventQuery.data?.historicalGap ? (
            <p className="text-sm text-muted-foreground">
              این سند پیش از فعال‌شدن ثبت رویداد لغو شده است؛ عامل و زمان لغو
              تاریخی در دسترس نیست.
            </p>
          ) : null}
          {eventQuery.data?.events.map((event) => (
            <p className="text-sm" key={event.id}>
              {event.fromStatus ?? 'ایجاد'} ← {event.toStatus ?? '—'} ·{' '}
              {event.actorName ?? 'نام در دسترس نیست'} · {event.occurredAt}
              {event.reason ? ` · ${event.reason}` : ''}
            </p>
          ))}
        </section>
      ) : null}
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
              { key: 'auxiliaryNumber', label: 'شماره فرعی' },
              { key: 'description', label: 'شرح سند', kind: 'area' },
              { key: 'descriptionEn', label: 'شرح به زبان دوم' },
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
                      <FormField label="شرح ردیف به زبان دوم">
                        <Input
                          aria-label="شرح ردیف به زبان دوم"
                          disabled={readonly}
                          value={String(row.attributes.descriptionEn ?? '')}
                          onChange={(event) =>
                            update({
                              attributes: {
                                ...row.attributes,
                                descriptionEn: event.target.value,
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
            ) &&
            (mode === 'edit' || mode === 'list') ? (
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
            {journal?.status === 'CANCELLED' &&
            (mode === 'deleted' || mode === 'list') ? (
              <Button
                permission="finance.journal.create"
                type="button"
                disabled={busy}
                onClick={() => void action('restore')}
              >
                بازیابی پیش‌نویس
              </Button>
            ) : null}
            {!readonly && (mode === 'edit' || mode === 'list') ? (
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
            {journal?.status === 'DRAFT' &&
            (mode === 'edit' || mode === 'list') ? (
              <Button
                type="button"
                permission="finance.journal.create"
                disabled={busy}
                onClick={() => void action('submit')}
              >
                ارسال برای تأیید
              </Button>
            ) : null}
            {journal?.status === 'PENDING_APPROVAL' &&
            (mode === 'review' || mode === 'list') ? (
              <Button
                type="button"
                permission="finance.journal.approve"
                disabled={busy}
                onClick={() => void action('approve')}
              >
                تأیید سند
              </Button>
            ) : null}
            {journal?.status === 'APPROVED' &&
            (mode === 'posting' || mode === 'list') ? (
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
            (mode === 'review' || mode === 'posting' || mode === 'list') &&
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
