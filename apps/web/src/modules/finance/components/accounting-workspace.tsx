'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, FolderOpen, FileText } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import Link from '@/i18n/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type {
  AccountingAttributes,
  AccountingJournalV1,
  AccountingLineV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { journalDisplayTotals } from '../accounting-money';
import { accountingApi } from '../api/accounting-api';
import { AccountingReportWorkspace } from './accounting-report-workspace';
import {
  AccountingSetupNotes,
  parseSetupNotes,
  type SetupNote,
} from './accounting-setup-notes';
import { AccountingDetailEditor } from './accounting-detail-editor';
import { AccountingDetailConversion } from './accounting-detail-conversion';
import {
  AccountingAccountsList,
  type AccountsListKind,
} from './accounting-accounts-list';
import { AccountingAccountGroups } from './accounting-account-groups';
import { AccountingSubsidiaryMapping } from './accounting-subsidiary-mapping';
import { AccountingLedgerEditor } from './accounting-ledger-editor';
import { AccountingBaseList } from './accounting-base-list';
import { AccountingDefinitionToolbar } from './accounting-definition-toolbar';
import {
  AccountingOperations,
  AccountingSaveButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import { exportAccountingView } from '../accounting-view-export';
import type { AccountingListKind } from '../accounting-list-filters';
import { AccountingAdvancedWorkspace } from './accounting-advanced-workspace';
import { AccountingSourceWorkspace } from './accounting-source-workspace';
import { AccountingYearEndWorkspace } from './accounting-year-end-workspace';
import { AccountingAutomationWorkspace } from './accounting-automation-workspace';
import { AccountingDocumentNumbering } from './accounting-document-numbering';
import { AccountingDocumentPosting } from './accounting-document-posting';
import { AccountingDocumentGeneral } from './accounting-document-general';
import { AccountingDocumentAutomatic } from './accounting-document-automatic';
import { AccountingDocumentRevaluation } from './accounting-document-revaluation';
import { AccountingDocumentGeneralList } from './accounting-document-general-list';
import { AccountingDocumentTransfer } from './accounting-document-transfer';
import { AccountingDocumentTemplate } from './accounting-document-template';
import { AccountingDocumentReorder } from './accounting-document-reorder';
import { AccountingDocumentList } from './accounting-document-list';
import { DocumentIconAction } from './accounting-document-filter';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { AccountingJournalLines } from './accounting-journal-lines';
import { AccountingDocumentImportDialog } from './accounting-document-import-dialog';
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
  AccountingTemplateEditor,
} from './accounting-parity-editors';

type Field = {
  key: string;
  label: string;
  kind?: 'date' | 'datetime' | 'check' | 'area' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
};
type Draft = Record<string, string | boolean>;
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
  MEMORANDUM: 'ثبت یادداشت',
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
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 accent-primary"
        />
      ) : field.kind === 'date' || field.kind === 'datetime' ? (
        <DatePicker
          id={id}
          required={field.required ?? false}
          includeTime={field.kind === 'datetime'}
          value={String(value || '')}
          disabled={disabled ?? false}
          onChange={onChange}
        />
      ) : field.kind === 'select' ? (
        <SearchCombobox
          id={id}
          aria-required={field.required}
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
          required={field.required}
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
          disabled={(disabled ?? false) || f.disabled === true}
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
  const viewRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  return (
    <AccountingOperations
      key={`${pathname}:${params.get('bookId') ?? ''}:${params.get('new') ?? ''}`}
      exportView={async (format) => {
        if (viewRef.current)
          return await exportAccountingView(viewRef.current, format);
      }}
    >
      <div ref={viewRef}>
        <AccountingWorkspaceContent pathname={pathname} />
      </div>
    </AccountingOperations>
  );
}

function AccountingWorkspaceContent({ pathname }: { pathname: string }) {
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
      setNotice(
        action.endsWith('-preview') ? 'پیش‌نمایش آماده شد.' : 'عملیات ثبت شد.',
      );
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
        key={`${bookId || 'new-ledger'}:${urlParams.get('new') ?? ''}`}
        startNew={urlParams.get('new') === '1'}
        snapshot={snapshot}
        branches={branches}
        busy={busy}
        run={run}
        refresh={refresh}
        onCreated={async (book, after) => {
          setBookId(book.id);
          const params = new URLSearchParams(urlParams.toString());
          params.set('bookId', book.id);
          if (after === 'new') params.set('new', '1');
          else params.delete('new');
          if (after === 'close')
            router.push(
              `/finance/accounting/general-ledger/base-information/lists/ledgers?bookId=${book.id}`,
            );
          else router.replace(`${pathname}?${params}`, { scroll: false });
          await refresh();
        }}
      />
    );
  else if (snapshot && section === 'receipts-payments/reports')
    content = (
      <AccountingSourceWorkspace book={snapshot} run={run} busy={busy} />
    );
  else if (snapshot && section === 'general-ledger/documents/numbering')
    content = (
      <AccountingDocumentNumbering book={snapshot} run={run} busy={busy} />
    );
  else if (
    snapshot &&
    section === 'general-ledger/documents/subledger-transfer'
  )
    content = (
      <AccountingDocumentTransfer
        book={snapshot}
        run={run}
        busy={busy}
        canCreate={can('finance.journal.create')}
        canExport={can('finance.export')}
      />
    );
  else if (snapshot && section === 'general-ledger/documents/revaluation')
    content = (
      <AccountingDocumentRevaluation
        book={snapshot}
        run={run}
        busy={busy}
        canCreate={can('finance.journal.create')}
        canExport={can('finance.export')}
      />
    );
  else if (snapshot && section === 'general-ledger/documents/automatic-runs')
    content = (
      <AccountingDocumentAutomatic
        book={snapshot}
        run={run}
        busy={busy}
        canCreate={can('finance.journal.create')}
      />
    );
  else if (snapshot && section === 'general-ledger/documents/lists/gl-vouchers')
    content = (
      <AccountingDocumentGeneralList
        book={snapshot}
        run={run}
        busy={busy}
        canPost={can('finance.journal.post')}
        canExport={can('finance.export')}
      />
    );
  else if (snapshot && section === 'general-ledger/documents/issue-gl-voucher')
    content = (
      <AccountingDocumentGeneral
        book={snapshot}
        run={run}
        busy={busy}
        canPost={can('finance.journal.post')}
      />
    );
  else if (snapshot && section === 'general-ledger/documents/posting')
    content = (
      <AccountingDocumentPosting
        book={snapshot}
        run={run}
        busy={busy}
        canPost={can('finance.journal.post')}
      />
    );
  else if (
    snapshot &&
    section === 'general-ledger/documents/opening-deployment'
  )
    content = (
      <JournalWorkspace
        key={bookId + section}
        book={snapshot}
        mode="edit"
        setupOpening
        busy={busy}
        run={run}
        can={can}
      />
    );
  else if (
    snapshot &&
    [
      'general-ledger/documents/automatic-templates',
      'general-ledger/documents/revaluation-templates',
      'general-ledger/documents/lists/automatic-templates',
      'general-ledger/documents/lists/revaluation-templates',
    ].includes(section)
  )
    content = (
      <AccountingDocumentTemplate
        key={bookId + section + (urlParams.get('id') ?? '')}
        book={snapshot}
        run={run}
        busy={busy}
        kind={
          section.includes('automatic-templates') ? 'AUTOMATIC' : 'REVALUATION'
        }
        listOnly={section.includes('/lists/')}
      />
    );
  else if (snapshot && section.endsWith('/allocation-templates'))
    content = (
      <AccountingAutomationWorkspace
        book={snapshot}
        run={run}
        busy={busy}
        mode="templates"
      />
    );
  else if (
    snapshot &&
    ['detail-types', 'details', 'detail-type-converters'].some(
      (kind) => section === `general-ledger/accounts/lists/${kind}`,
    )
  )
    content = (
      <AccountingAccountsList
        key={bookId + section}
        book={snapshot}
        kind={section.split('/').at(-1) as AccountsListKind}
      />
    );
  else if (
    snapshot &&
    [
      'general-ledger/accounts/detail-types',
      'general-ledger/accounts/details',
    ].includes(section)
  )
    content = (
      <AccountingDetailEditor
        key={bookId + section + (urlParams.get('id') ?? '')}
        book={snapshot}
        kind={section.endsWith('/details') ? 'details' : 'detail-types'}
        run={run}
        busy={busy}
      />
    );
  else if (
    snapshot &&
    section === 'general-ledger/accounts/detail-type-converter'
  )
    content = (
      <AccountingDetailConversion
        key={bookId + (urlParams.get('id') ?? '')}
        book={snapshot}
        run={run}
        busy={busy}
      />
    );
  else if (snapshot && section.endsWith('/mappings'))
    content = (
      <AccountingSubsidiaryMapping
        key={bookId}
        book={snapshot}
        run={run}
        busy={busy}
      />
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
      <AccountingAccountGroups
        key={bookId + section}
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
    content = (
      <AccountingDocumentReorder book={snapshot} run={run} busy={busy} />
    );
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
        run={run}
      />
    );
  } else if (home) content = null;
  else if (
    snapshot &&
    (section.endsWith('/documents/list') ||
      section === 'general-ledger/documents/lists/journals' ||
      section === 'general-ledger/documents/lists/revaluations' ||
      section.endsWith('/documents/review') ||
      section.endsWith('/documents/deleted'))
  )
    content = (
      <AccountingDocumentList
        key={bookId + section}
        book={snapshot}
        mode={
          section.endsWith('/review')
            ? 'review'
            : section.endsWith('/lists/revaluations')
              ? 'revaluation'
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
      const listRoute =
        accountingParityDefinitions.find(
          (definition) =>
            definition.implementation === 'configuration-list' &&
            definition.route.replace('/lists/', '/') === section,
        )?.route ?? 'general-ledger/accounts';
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
              id={'accounting-base-definition'}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save('stay');
              }}
            >
              {
                <AccountingDefinitionToolbar
                  busy={busy}
                  canClose={!!listRoute}
                  {...(editing &&
                  (details ||
                    ['fiscal-years', 'voucher-types', 'detail-types'].includes(
                      kind ?? '',
                    ))
                    ? {
                        deleteRecord: (after: 'new' | 'close') => {
                          if (
                            !window.confirm(
                              'رکورد انتخاب‌شده برای همیشه حذف شود؟ رکورد استفاده‌شده حذف نمی‌شود.',
                            )
                          )
                            return;
                          void run(
                            'delete-base-record',
                            {
                              id: editing.id,
                              entity: details ? 'detail' : 'configuration',
                            },
                            editing.version,
                          ).then((result) => {
                            if (!result) return;
                            setEditing(null);
                            setDraft({ active: true, permanent: true });
                            if (after === 'close' && listRoute)
                              router.push(
                                `/finance/accounting/${listRoute}?bookId=${bookId}`,
                              );
                          });
                        },
                      }
                    : {})}
                  save={(after) => {
                    const form = document.getElementById(
                      'accounting-base-definition',
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
              }
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
function JournalWorkspace(
  props: Omit<Parameters<typeof JournalEditorWorkspace>[0], 'initialJournal'>,
) {
  const linkedId = useSearchParams().get('journalId') ?? '';
  const linked = useQuery({
    queryKey: ['accounting', 'linked-journal', props.book.book.id, linkedId],
    queryFn: () => accountingApi.journals(props.book.book.id, { id: linkedId }),
    enabled: props.mode === 'edit' && Boolean(linkedId),
  });
  if (props.mode === 'edit' && linkedId) {
    if (linked.isPending)
      return (
        <Panel title="سند حسابداری">
          <p role="status">در حال خواندن سند…</p>
        </Panel>
      );
    if (linked.error)
      return (
        <Panel title="سند حسابداری">
          <p role="alert">{linked.error.message}</p>
        </Panel>
      );
    const record = linked.data?.items[0];
    if (!record)
      return (
        <Panel title="سند حسابداری">
          <p role="alert">سند در این دفتر در دسترس نیست.</p>
        </Panel>
      );
    return (
      <JournalEditorWorkspace
        key={`${record.id}:${record.version}`}
        {...props}
        initialJournal={record}
      />
    );
  }
  return <JournalEditorWorkspace {...props} />;
}
const journalHeader = (journal: AccountingJournalV1): Draft => ({
  periodId: journal.periodId ?? '',
  typeId: journal.typeId ?? '',
  documentDate: journal.documentDate ?? '',
  description: journal.description,
  reference: journal.reference ?? '',
  auxiliaryNumber: String(journal.attributes.auxiliaryNumber ?? ''),
  descriptionEn: String(journal.attributes.descriptionEn ?? ''),
});
function JournalEditorWorkspace({
  book,
  mode,
  busy,
  run,
  can,
  initialJournal,
  setupOpening = false,
}: {
  book: AccountingSnapshotV1;
  mode: JournalMode;
  busy: boolean;
  run: Run;
  can: (p: string) => boolean;
  initialJournal?: AccountingJournalV1;
  setupOpening?: boolean;
}) {
  const router = useRouter();
  const fresh = () => {
    setJournal(null);
    setHead(defaultHead());
    setLines([]);
    setNotes([]);
    setTab('main');
  };
  const closeEditor = () =>
    router.push(
      `/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}`,
    );
  const defaultHead = (): Draft => {
    const today = new Date();
    return {
      documentDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      typeId:
        book.configurations.find(
          (item) =>
            item.kind === 'voucher-types' &&
            item.active &&
            item.title === (setupOpening ? 'افتتاحیه استقرار' : 'عمومی'),
        )?.id ?? '',
    };
  };
  const [journal, setJournal] = useState<AccountingJournalV1 | null>(
      initialJournal ?? null,
    ),
    [head, setHead] = useState<Draft>(() =>
      initialJournal ? journalHeader(initialJournal) : defaultHead(),
    ),
    [reverseHead, setReverseHead] = useState<Draft>({}),
    [lines, setLines] = useState<AccountingLineV1[]>(
      initialJournal?.lines ?? [],
    );
  const [notes, setNotes] = useState<SetupNote[]>(
    parseSetupNotes(initialJournal?.attributes.notes),
  );
  const [openVisible, setOpenVisible] = useState(false);
  const [tab, setTab] = useState<'main' | 'notes'>('main');
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
      !status,
      linkedId,
    ],
    queryFn: () =>
      accountingApi.journals(book.book.id, {
        page: String(page),
        id: linkedId,
        search,
        status,
        excludeCancelled: status ? '' : 'true',
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
    setHead(journalHeader(j));
    setLines(j.lines);
    setNotes(parseSetupNotes(j.attributes.notes));
    setOpenVisible(false);
  };
  const readonly =
    journal !== null && !['DRAFT', 'MEMORANDUM'].includes(journal.status);
  const action = async (name: string) => {
    if (!journal) return;
    let current = journal;
    if (name === 'submit') {
      const { auxiliaryNumber, descriptionEn, ...header } = head;
      const saved = await run<AccountingJournalV1>(
        'journal-save',
        {
          ...header,
          periodId:
            book.periods.find(
              (period) =>
                period.status === 'OPEN' &&
                String(header.documentDate ?? '') >= period.startDate &&
                String(header.documentDate ?? '') <= period.endDate,
            )?.id ?? header.periodId,
          attributes: { auxiliaryNumber, descriptionEn },
          notes,
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
  const save = async (
    after: 'stay' | 'new' | 'close' = 'stay',
    memorandum = false,
  ) => {
    if (busy || readonly || !can('finance.journal.create')) return;
    const { auxiliaryNumber, descriptionEn, ...header } = head;
    const result = await run<AccountingJournalV1>(
      memorandum ? 'journal-memorandum-save' : 'journal-document-save',
      {
        ...header,
        ...(setupOpening ? { sourcePage: 'setup-opening' } : {}),
        periodId:
          book.periods.find(
            (period) =>
              period.status === 'OPEN' &&
              String(header.documentDate ?? '') >= period.startDate &&
              String(header.documentDate ?? '') <= period.endDate,
          )?.id ?? header.periodId,
        attributes: { auxiliaryNumber, descriptionEn },
        notes,
        lines: writableJournalLines(lines),
        ...(journal ? { id: journal.id } : {}),
      },
      journal?.version,
    );
    if (result) {
      open(result);
      await load();
      if (after === 'new') fresh();
      if (after === 'close') {
        fresh();
        closeEditor();
      }
    }
  };
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
      {mode === 'edit' ? (
        <>
          <AccountingDocumentImportDialog
            book={book}
            busy={busy}
            run={run}
            canCreate={can('finance.journal.create')}
            onOpen={open}
            typeId={String(head.typeId ?? '')}
          />
          <DocumentIconAction
            label="باز کردن"
            shortcut="Ctrl+L"
            disabled={busy}
            onClick={() => setOpenVisible(true)}
          >
            <FolderOpen className="size-4" />
          </DocumentIconAction>
          <Dialog open={openVisible} onOpenChange={setOpenVisible}>
            <DialogContent className="max-h-[85vh] max-w-6xl overflow-auto">
              <DialogTitle>باز کردن سند حسابداری</DialogTitle>
              <AccountingDocumentList
                book={book}
                busy={busy}
                run={run}
                can={can}
                onOpen={open}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {(['close', 'new'] as const).map((after) => (
        <Button
          key={after}
          type="button"
          permission="finance.journal.create"
          disabled={
            busy ||
            !journal ||
            journal.status === 'POSTED' ||
            journal.status === 'CANCELLED'
          }
          onClick={() => {
            if (
              !journal ||
              !window.confirm(
                'سند انتخاب‌شده به فهرست اسناد حذف‌شده منتقل شود؟ امکان بازیابی پیش‌نویس وجود دارد.',
              )
            )
              return;
            void run(
              'cancel',
              { id: journal.id, reason: 'حذف از نوار عملیات حسابداری' },
              journal.version,
            ).then(async (result) => {
              if (!result) return;
              fresh();
              await load();
              if (after === 'close') closeEditor();
            });
          }}
        >
          {after === 'close' ? 'حذف و بستن' : 'حذف و جدید'}
        </Button>
      ))}
      {mode !== 'edit' ? (
        <>
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
            {mode === 'list' ? (
              <Button
                permission="finance.journal.create"
                variant="outline"
                onClick={fresh}
              >
                سند جدید
              </Button>
            ) : null}
          </div>
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
        </>
      ) : null}
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
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              !event.ctrlKey ||
              event.altKey ||
              event.metaKey ||
              busy
            )
              return;
            const key = event.key.toLowerCase();
            if (
              !event.shiftKey &&
              key === 'b' &&
              can('finance.journal.create')
            ) {
              event.preventDefault();
              fresh();
              return;
            }
            if (event.shiftKey && key === 'b' && !readonly) {
              event.preventDefault();
              void save('new');
              return;
            }
            if (event.shiftKey && key === 'f4' && !readonly) {
              event.preventDefault();
              void save('close');
              return;
            }
            if (!event.shiftKey && key === 's' && !readonly) {
              event.preventDefault();
              void save();
              return;
            }
            if (
              event.ctrlKey &&
              event.shiftKey &&
              event.key.toLowerCase() === 's' &&
              !busy &&
              !readonly
            ) {
              event.preventDefault();
              void save('stay', true);
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            void save(accountingSaveDisposition(e));
          }}
        >
          <DocumentIconAction
            label="ذخیره یادداشت"
            shortcut="Ctrl+Shift+S"
            disabled={busy || readonly}
            onClick={() => void save('stay', true)}
          >
            <FileText className="size-4" />
          </DocumentIconAction>
          <div className="flex justify-between">
            <h3 className="font-bold">
              {journal
                ? `سند ${journal.number ?? 'بدون شماره'} — ${statuses[journal.status]}`
                : 'پیش‌نویس جدید'}
            </h3>
            {journal?.reversalOfId ? <span>سند برگشتی</span> : null}
          </div>
          <div
            role="tablist"
            aria-label="بخش‌های سند"
            className="flex gap-2 border-b"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'main'}
              onClick={() => setTab('main')}
              className="px-4 py-2"
            >
              اطلاعات اصلی
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'notes'}
              onClick={() => setTab('notes')}
              className="px-4 py-2"
            >
              یادداشت
            </button>
          </div>
          <div hidden={tab !== 'main'} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <FormField label="شماره سند">
                <Input
                  aria-label="شماره سند"
                  readOnly
                  value={journal?.number ?? ''}
                />
              </FormField>
              <FormField label="شماره روزانه">
                <Input
                  aria-label="شماره روزانه"
                  readOnly
                  value={String(journal?.attributes.dailyNumber ?? '')}
                />
              </FormField>
              <FormField label="شماره عطف">
                <Input
                  aria-label="شماره عطف"
                  readOnly
                  value={journal?.reference ?? ''}
                />
              </FormField>
              <FormField label="صادر کننده">
                <Input
                  aria-label="صادر کننده"
                  readOnly
                  value={journal?.makerName ?? ''}
                />
              </FormField>
            </div>
            <Fields
              fields={[
                {
                  key: 'typeId',
                  label: 'نوع سند',
                  required: true,
                  kind: 'select',
                  disabled: setupOpening,
                  options: book.configurations
                    .filter((c) => c.kind === 'voucher-types')
                    .map((c) => ({ value: c.id, label: c.title })),
                },
                {
                  key: 'documentDate',
                  label: 'تاریخ سند',
                  kind: 'date',
                  required: true,
                },
                { key: 'auxiliaryNumber', label: 'شماره فرعی' },
                { key: 'description', label: 'شرح', kind: 'area' },
                { key: 'descriptionEn', label: 'شرح به زبان دوم' },
              ]}
              draft={head}
              disabled={readonly}
              set={(key, value) => setHead((h) => ({ ...h, [key]: value }))}
            />
            <AccountingJournalLines
              key={`${journal?.id ?? 'new'}:${journal?.version ?? 0}`}
              book={book}
              rows={lines}
              onChange={setLines}
              readonly={readonly}
              journalId={
                journal &&
                JSON.stringify(lines) === JSON.stringify(journal.lines)
                  ? journal.id
                  : undefined
              }
              canWriteStatement={can('finance.journal.create') && !busy}
              canExport={can('finance.export')}
              onAddDefaultDescription={
                can('finance.account.manage') && !busy
                  ? (row) => {
                      const account = book.accounts.find(
                        (account) => account.id === row.accountId,
                      );
                      if (account)
                        void run(
                          'add-line-default-description',
                          {
                            accountId: account.id,
                            description: row.description,
                            descriptionEn: String(
                              row.attributes.descriptionEn ?? '',
                            ),
                          },
                          account.version,
                        );
                    }
                  : undefined
              }
              periodId={
                book.periods.find(
                  (period) =>
                    String(head.documentDate ?? '') >= period.startDate &&
                    String(head.documentDate ?? '') <= period.endDate,
                )?.id
              }
            />
            {Array.isArray(journal?.attributes.warnings) ? (
              <div role="status" className="rounded-xl border p-3">
                {journal.attributes.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            ) : null}
          </div>
          <div hidden={tab !== 'notes'} className="space-y-4">
            <AccountingSetupNotes
              requireDate={false}
              notes={notes}
              onChange={setNotes}
              book={book}
              {...(journal
                ? {
                    record: {
                      id: journal.id,
                      entityType: 'AccountingJournal',
                      title: journal.description || 'سند حسابداری',
                    },
                  }
                : {})}
            />
            <Button
              type="button"
              permission="finance.journal.create"
              disabled={busy || !journal}
              onClick={() => {
                if (journal)
                  void run<AccountingJournalV1>(
                    'journal-notes-save',
                    { id: journal.id, notes },
                    journal.version,
                  ).then((result) => {
                    if (result) {
                      open(result);
                      void load();
                    }
                  });
              }}
            >
              ذخیره یادداشت‌های فرم
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {journal &&
            ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(
              journal.status,
            ) &&
            mode === 'list' ? (
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
                <AccountingSaveButtons
                  busy={busy}
                  permission="finance.journal.create"
                />
              </>
            ) : null}
            {journal?.status === 'DRAFT' && mode === 'list' ? (
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
          {journal?.status === 'POSTED' && mode !== 'edit' ? (
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
