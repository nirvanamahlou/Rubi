'use client';
import {
  useState,
  useEffect,
  useEffectEvent,
  useRef,
  type ReactNode,
} from 'react';
import {
  Plus,
  FolderPlus,
  Trash2,
  Filter,
  FilterX,
  Save,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/overlays';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../api/accounting-api';
import { SearchCombobox } from '@/components/ui/search-combobox';

type Kind = 'text' | 'number' | 'date' | 'uuid' | 'boolean';
export type DocumentRule = {
  type: 'rule';
  field: string;
  operator: string;
  value?: string;
  end?: string;
  values?: string[];
};
export type DocumentGroup = {
  type: 'group';
  domain?: 'journal';
  mode: 'all' | 'any' | 'not-all' | 'none';
  children: DocumentFilterNode[];
};
export type DocumentFilterNode =
  | DocumentRule
  | DocumentGroup
  | { type: 'lines'; mode: 'all' | 'any'; condition: DocumentGroup };
export const emptyDocumentFilter = (): DocumentGroup => ({
  type: 'group',
  mode: 'all',
  children: [],
});
type FilterDomain = 'journal' | 'general' | 'revaluation';
const revaluationFields: [string, string, Kind][] = [
  ['auxiliaryNumber', 'شماره فرعی', 'number'],
  ['documentDate', 'تاریخ', 'date'],
  ['revaluationRate', 'نرخ ارز', 'number'],
  ['branchId', 'شعبه', 'uuid'],
  ['bookId', 'دفتر کل', 'uuid'],
  ['periodId', 'دوره مالی', 'uuid'],
];
const generalFields: [string, string, Kind][] = [
  ['number', 'شماره', 'number'],
  ['documentDate', 'تاریخ', 'date'],
  ['amount', 'مبلغ', 'number'],
  ['makerId', 'صادر کننده', 'uuid'],
];
function validStoredFilter(
  value: unknown,
  domain: FilterDomain = 'journal',
): value is DocumentGroup {
  let count = 0;
  const visit = (
    input: unknown,
    depth: number,
    line = false,
    currentDomain = domain,
  ): boolean => {
    if (++count > 100 || depth > 8 || !input || typeof input !== 'object')
      return false;
    const node = input as Record<string, unknown>;
    if (node.type === 'group')
      return (
        ['all', 'any', 'not-all', 'none'].includes(String(node.mode)) &&
        (node.domain === undefined ||
          (currentDomain === 'revaluation' &&
            node.domain === 'journal' &&
            !line)) &&
        Array.isArray(node.children) &&
        node.children.every((child) =>
          visit(
            child,
            depth + 1,
            line,
            node.domain === 'journal' ? 'journal' : currentDomain,
          ),
        )
      );
    if (node.type === 'lines')
      return (
        currentDomain === 'journal' &&
        !line &&
        ['all', 'any'].includes(String(node.mode)) &&
        !!node.condition &&
        typeof node.condition === 'object' &&
        (node.condition as Record<string, unknown>).type === 'group' &&
        visit(node.condition, depth + 1, true, currentDomain)
      );
    return (
      node.type === 'rule' &&
      (currentDomain === 'general'
        ? generalFields
        : currentDomain === 'revaluation'
          ? revaluationFields
          : line
            ? lineFields
            : headerFields
      ).some(([field]) => field === node.field) &&
      typeof node.operator === 'string' &&
      node.operator.length <= 30 &&
      [node.value, node.end].every(
        (item) =>
          item === undefined ||
          (typeof item === 'string' && item.length <= 2000),
      ) &&
      (node.values === undefined ||
        (Array.isArray(node.values) &&
          node.values.length <= 50 &&
          node.values.every(
            (item) => typeof item === 'string' && item.length <= 2000,
          )))
    );
  };
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).type === 'group' &&
    visit(value, 0)
  );
}
const headerFields: [string, string, Kind][] = [
  ['number', 'شماره سند', 'number'],
  ['reference', 'شماره عطف', 'number'],
  ['dailyNumber', 'شماره روزانه', 'number'],
  ['auxiliaryNumber', 'شماره فرعی', 'number'],
  ['documentDate', 'تاریخ', 'date'],
  ['description', 'شرح', 'text'],
  ['descriptionEn', 'شرح به زبان دوم', 'text'],
  ['status', 'وضعیت', 'text'],
  ['referenceNumber', 'شماره ارجاع', 'text'],
  ['makerId', 'ایجاد کننده', 'uuid'],
  ['branchId', 'شعبه', 'uuid'],
  ['bookId', 'دفتر کل', 'uuid'],
  ['periodId', 'دوره مالی', 'uuid'],
  ['lastModifierId', 'آخرین تغییر دهنده', 'uuid'],
  ['typeId', 'نوع سند', 'uuid'],
];
const lineFields: [string, string, Kind][] = [
  ['position', 'شماره ردیف', 'number'],
  ['debit', 'بدهکار', 'number'],
  ['credit', 'بستانکار', 'number'],
  ['baseDebit', 'بدهکار ارز مبنا', 'number'],
  ['baseCredit', 'بستانکار ارز مبنا', 'number'],
  ['rate', 'نرخ ارز', 'number'],
  ['conversionRate', 'نرخ تبدیل', 'number'],
  ['foreignDebit', 'بدهکار ارزی', 'number'],
  ['foreignCredit', 'بستانکار ارزی', 'number'],
  ['description', 'شرح', 'text'],
  ['descriptionEn', 'شرح به زبان دوم', 'text'],
  ['trackingNumber', 'شماره پیگیری', 'text'],
  ['trackingDate', 'تاریخ پیگیری', 'date'],
  ['detail4Id', 'سطح 4', 'uuid'],
  ['detail5Id', 'سطح 5', 'uuid'],
  ['detail6Id', 'سطح 6', 'uuid'],
  ['taxAccountType', 'نوع حساب مالیاتی', 'text'],
  ['taxStatus', 'وضعیت مالیاتی', 'text'],
  ['transactionType', 'نوع معامله', 'text'],
  ['purchaseOrSale', 'خرید یا فروش', 'text'],
  ['goodsOrService', 'کالا یا خدمت', 'text'],
  ['isCurrency', 'ارزی؟', 'boolean'],
  ['quantity', 'تعداد', 'number'],
  ['taxAmount', 'مبلغ مالیات', 'number'],
  ['dutyAmount', 'مبلغ عوارض', 'number'],
  ['periodNature', 'ماهیت دوره', 'text'],
  ['nonRefundableTax', 'مالیات غیر قابل استرداد', 'boolean'],
  ['nonRefundableDuty', 'عوارض غیر قابل استرداد', 'boolean'],
  ['branchId', 'شعبه', 'uuid'],
  ['currency', 'ارز', 'text'],
  ['baseCurrency', 'ارز مبنا', 'text'],
  ['accountId', 'معین', 'uuid'],
  ['personId', 'شخص/شرکت', 'uuid'],
];
const modes = [
  ['all', 'همه'],
  ['any', 'حداقل یکی باشد'],
  ['not-all', 'حداقل یکی نباشد'],
  ['none', 'هیچکدام'],
] as const;
const operators = [
  ['equals', 'مساوی'],
  ['not-equals', 'نامساوی'],
  ['between', 'بین'],
  ['in', 'هر یک از'],
  ['not-in', 'هیچکدام از'],
  ['empty', 'خالی باشد'],
  ['not-empty', 'خالی نباشد'],
  ['contains', 'شامل باشد'],
  ['not-contains', 'شامل نباشد'],
  ['starts', 'شروع شود با'],
] as const;
const selectClass = 'h-9 rounded-md border bg-background px-2 text-xs';
export function DocumentIconAction({
  label,
  shortcut,
  onClick,
  disabled,
  children,
}: {
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const handle = useEffectEvent((event: KeyboardEvent) => {
    const button = ref.current;
    if (
      event.defaultPrevented ||
      disabled ||
      !button ||
      !button.getClientRects().length
    )
      return;
    const parts = shortcut.toLowerCase().split('+');
    const key = parts.at(-1);
    const aliases: Record<string, string> = {
      left: 'arrowleft',
      right: 'arrowright',
      up: 'arrowup',
      down: 'arrowdown',
    };
    if (
      event.key.toLowerCase() !== (key ? (aliases[key] ?? key) : '') ||
      event.ctrlKey !== parts.includes('ctrl') ||
      event.altKey !== parts.includes('alt') ||
      event.shiftKey !== parts.includes('shift') ||
      event.metaKey
    )
      return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const dialog =
      target?.closest('[role="dialog"],[role="alertdialog"]') ??
      document.querySelector(
        '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]',
      );
    if (dialog && !dialog.contains(button)) return;
    if (
      !event.ctrlKey &&
      !event.altKey &&
      target?.closest('input,textarea,select,[role="combobox"]')
    )
      return;
    const scope = button.closest('[data-document-shortcut-scope]');
    const focused = target?.closest('[data-document-shortcut-scope]');
    if (focused && scope !== focused && !scope?.contains(focused)) return;
    if (shortcut === 'Enter' && target !== button && target?.tagName !== 'TR')
      return;
    if (shortcut === 'Delete' && target !== button) return;
    event.preventDefault();
    onClick();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          title={`${label} (${shortcut})`}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span dir="ltr">({shortcut})</span>
      </TooltipContent>
    </Tooltip>
  );
}
function Rule({
  rule,
  onChange,
  scope,
  book,
  domain,
}: {
  rule: DocumentRule;
  onChange: (node: DocumentRule) => void;
  scope: 'header' | 'line';
  book: AccountingSnapshotV1;
  domain: FilterDomain;
}) {
  const fields =
    domain === 'general'
      ? generalFields
      : domain === 'revaluation'
        ? revaluationFields
        : scope === 'header'
          ? headerFields
          : lineFields;
  const kind = fields.find(([key]) => key === rule.field)?.[2] ?? 'text';
  const directory = useQuery({
    queryKey: ['accounting', 'document-filter-options', book.book.id],
    enabled: ['makerId', 'lastModifierId', 'branchId'].includes(rule.field),
    staleTime: 60000,
    queryFn: () =>
      accountingApi.analytical<{
        actors: { value: string; label: string }[];
        branches: { value: string; label: string }[];
      }>(book.book.id, 'document-filter-options', {}),
  });
  const choices = ['makerId', 'lastModifierId'].includes(rule.field)
    ? (directory.data?.actors ?? [])
    : rule.field === 'branchId'
      ? (directory.data?.branches ?? [])
      : rule.field === 'accountId'
        ? book.accounts
            .filter((a) => a.level === 'SUBSIDIARY')
            .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }))
        : rule.field.startsWith('detail')
          ? book.details.map((a) => ({
              value: a.id,
              label: `${a.code} — ${a.title}`,
            }))
          : rule.field === 'periodId'
            ? book.periods.map((a) => ({
                value: a.id,
                label:
                  book.configurations.find((item) => item.id === a.fiscalYearId)
                    ?.title ?? `${a.startDate} — ${a.endDate}`,
              }))
            : rule.field === 'bookId'
              ? [{ value: book.book.id, label: book.book.title }]
              : rule.field === 'typeId'
                ? book.configurations
                    .filter((c) => c.kind === 'voucher-types')
                    .map((c) => ({ value: c.id, label: c.title }))
                : rule.field === 'status'
                  ? [
                      { value: 'MEMORANDUM', label: 'ثبت یادداشت' },
                      { value: 'DRAFT', label: 'ثبت موقت' },
                      { value: 'PENDING_APPROVAL', label: 'در انتظار بررسی' },
                      { value: 'APPROVED', label: 'بررسی شده' },
                      { value: 'POSTED', label: 'قطعی' },
                      { value: 'CANCELLED', label: 'حذف شده' },
                    ]
                  : kind === 'boolean'
                    ? [
                        { value: 'true', label: 'بله' },
                        { value: 'false', label: 'خیر' },
                      ]
                    : [];
  const operand = (
    value: string,
    onChange: (value: string) => void,
    label: string,
  ) =>
    choices.length ||
    ['makerId', 'lastModifierId', 'branchId'].includes(rule.field) ? (
      <SearchCombobox
        label={label}
        value={value}
        options={choices}
        disabled={
          directory.isFetching &&
          ['makerId', 'lastModifierId', 'branchId'].includes(rule.field)
        }
        onValueChange={onChange}
      />
    ) : (
      <Input
        className="h-9 min-w-28 text-xs"
        type={kind === 'date' ? 'date' : 'text'}
        inputMode={kind === 'number' ? 'decimal' : undefined}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {directory.error ? (
        <p role="alert" className="text-xs text-destructive">
          {directory.error.message}
        </p>
      ) : null}
      <select
        className={selectClass}
        aria-label="فیلد شرط"
        value={rule.field}
        onChange={(e) =>
          onChange({
            type: 'rule',
            field: e.target.value,
            operator: 'equals',
            value: '',
          })
        }
      >
        {fields.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        aria-label="عملگر شرط"
        value={rule.operator}
        onChange={(e) => onChange({ ...rule, operator: e.target.value })}
      >
        {operators
          .filter(
            ([op]) => op !== 'between' || kind === 'date' || kind === 'number',
          )
          .filter(
            ([op]) =>
              !['contains', 'not-contains', 'starts'].includes(op) ||
              kind === 'text',
          )
          .map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
      </select>
      {!['empty', 'not-empty'].includes(rule.operator) ? (
        rule.operator === 'in' || rule.operator === 'not-in' ? (
          <Input
            className="h-9"
            aria-label="مقادیر شرط با جداکننده ویرگول"
            value={(rule.values ?? []).join(',')}
            onChange={(e) =>
              onChange({
                ...rule,
                values: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        ) : (
          <>
            {operand(
              rule.value ?? '',
              (value) => onChange({ ...rule, value }),
              'مقدار شرط',
            )}
            {rule.operator === 'between'
              ? operand(
                  rule.end ?? '',
                  (end) => onChange({ ...rule, end }),
                  'انتهای بازه',
                )
              : null}
          </>
        )
      ) : null}
    </div>
  );
}
function Group({
  group,
  onChange,
  scope,
  book,
  domain,
  depth = 0,
}: {
  group: DocumentGroup;
  onChange: (group: DocumentGroup) => void;
  scope: 'header' | 'line';
  book: AccountingSnapshotV1;
  domain: FilterDomain;
  depth?: number;
}) {
  const update = (index: number, node: DocumentFilterNode) =>
    onChange({
      ...group,
      children: group.children.map((current, n) =>
        n === index ? node : current,
      ),
    });
  return (
    <fieldset
      data-document-shortcut-scope
      tabIndex={-1}
      className="space-y-2 rounded-md border-s-2 border-primary/40 bg-muted/10 p-3"
    >
      <legend className="px-1">
        {group.domain === 'journal' ? (
          <span className="me-2">سند حسابداری</span>
        ) : null}
        <select
          className={selectClass}
          aria-label="ترکیب شرط‌ها"
          value={group.mode}
          onChange={(e) =>
            onChange({
              ...group,
              mode: e.target.value as DocumentGroup['mode'],
            })
          }
        >
          {modes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </legend>
      {group.children.map((node, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {node.type === 'rule' ? (
              <Rule
                rule={node}
                domain={domain}
                onChange={(value) => update(index, value)}
                scope={scope}
                book={book}
              />
            ) : node.type === 'group' ? (
              <Group
                group={node}
                domain={node.domain === 'journal' ? 'journal' : domain}
                onChange={(value) => update(index, value)}
                scope={scope}
                book={book}
                depth={depth + 1}
              />
            ) : (
              <fieldset className="rounded border p-2">
                <legend>
                  <select
                    className={selectClass}
                    aria-label="شرط اقلام سند"
                    value={node.mode}
                    onChange={(e) =>
                      update(index, {
                        ...node,
                        mode: e.target.value as 'all' | 'any',
                      })
                    }
                  >
                    <option value="all">همه قلم سند حسابداری ها</option>
                    <option value="any">
                      حداقل یکی از قلم سند حسابداری ها
                    </option>
                  </select>
                </legend>
                <Group
                  group={node.condition}
                  domain={domain}
                  onChange={(condition) =>
                    update(index, { ...node, condition })
                  }
                  scope="line"
                  book={book}
                  depth={depth + 1}
                />
              </fieldset>
            )}
          </div>
          <DocumentIconAction
            label="حذف شرط"
            shortcut="Delete"
            onClick={() =>
              onChange({
                ...group,
                children: group.children.filter((_, n) => n !== index),
              })
            }
          >
            <Trash2 className="size-4" />
          </DocumentIconAction>
        </div>
      ))}
      <div className="flex gap-1">
        <DocumentIconAction
          label="افزودن شرط"
          shortcut="Insert"
          disabled={depth >= 7}
          onClick={() =>
            onChange({
              ...group,
              children: [
                ...group.children,
                {
                  type: 'rule',
                  field:
                    domain === 'revaluation'
                      ? 'auxiliaryNumber'
                      : domain !== 'journal'
                        ? 'number'
                        : scope === 'header'
                          ? 'description'
                          : 'accountId',
                  operator: 'equals',
                  value: '',
                },
              ],
            })
          }
        >
          <Plus className="size-4" />
        </DocumentIconAction>
        <DocumentIconAction
          label="افزودن گروه شرط"
          shortcut="Ctrl+Insert"
          disabled={depth >= 7}
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, emptyDocumentFilter()],
            })
          }
        >
          <FolderPlus className="size-4" />
        </DocumentIconAction>
        {domain === 'journal' && scope === 'header' ? (
          <select
            className={selectClass}
            aria-label="افزودن شرط اقلام سند"
            value=""
            onChange={(e) => {
              if (e.target.value)
                onChange({
                  ...group,
                  children: [
                    ...group.children,
                    {
                      type: 'lines',
                      mode: e.target.value as 'all' | 'any',
                      condition: emptyDocumentFilter(),
                    },
                  ],
                });
            }}
          >
            <option value="">اقلام سند</option>
            <option value="all">همه قلم سند حسابداری ها</option>
            <option value="any">حداقل یکی از قلم سند حسابداری ها</option>
          </select>
        ) : null}
        {domain === 'revaluation' && scope === 'header' ? (
          <DocumentIconAction
            label="افزودن شرط سند حسابداری"
            shortcut="Alt+Insert"
            disabled={depth >= 7}
            onClick={() =>
              onChange({
                ...group,
                children: [
                  ...group.children,
                  { ...emptyDocumentFilter(), domain: 'journal' },
                ],
              })
            }
          >
            <FolderPlus className="size-4" />
          </DocumentIconAction>
        ) : null}
      </div>
    </fieldset>
  );
}
export function AccountingDocumentFilter({
  book,
  value,
  onChange,
  onApply,
  busy,
  domain = 'journal',
}: {
  book: AccountingSnapshotV1;
  value: DocumentGroup;
  onChange: (value: DocumentGroup) => void;
  onApply: (value: DocumentGroup) => void;
  busy: boolean;
  domain?: FilterDomain;
}) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<{ name: string; filter: DocumentGroup }[]>(
    [],
  );
  const [error, setError] = useState('');
  const key = `rubi-document-filters:${book.book.id}${domain !== 'journal' ? ':' + domain : ''}`;
  const read = () => {
    try {
      const records = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
      if (!Array.isArray(records)) return [];
      return records
        .filter(
          (r) =>
            r &&
            typeof r.name === 'string' &&
            r.name.length <= 160 &&
            validStoredFilter(r.filter, domain),
        )
        .slice(0, 30) as typeof saved;
    } catch {
      return [];
    }
  };
  const clear = () => {
    const filter = emptyDocumentFilter();
    onChange(filter);
    onApply(filter);
  };
  return (
    <details className="rounded-lg border" data-document-shortcut-scope open>
      <summary className="cursor-pointer bg-muted/30 px-3 py-2 text-sm font-bold">
        فیلتر
      </summary>
      <div className="space-y-3 p-3">
        <div className="flex flex-wrap justify-end gap-1">
          <DocumentIconAction
            label="اجرای فیلتر"
            shortcut="Alt+F"
            disabled={busy}
            onClick={() => onApply(value)}
          >
            <Filter className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="حذف فیلتر"
            shortcut="Alt+X"
            onClick={clear}
          >
            <FilterX className="size-4" />
          </DocumentIconAction>
          <Input
            aria-label="نام فیلتر"
            className="h-9 max-w-48"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <DocumentIconAction
            label="ذخیره فیلتر"
            shortcut="Alt+S"
            disabled={!name.trim()}
            onClick={() => {
              try {
                const next = [
                  ...read().filter((item) => item.name !== name.trim()),
                  { name: name.trim(), filter: value },
                ].slice(-30);
                localStorage.setItem(key, JSON.stringify(next));
                setSaved(next);
                setError('');
              } catch {
                setError('ذخیره فیلتر در این مرورگر انجام نشد.');
              }
            }}
          >
            <Save className="size-4" />
          </DocumentIconAction>
          <DocumentIconAction
            label="بارگذاری فیلتر"
            shortcut="Alt+O"
            onClick={() => setSaved(read())}
          >
            <FolderOpen className="size-4" />
          </DocumentIconAction>
          <select
            className={selectClass}
            aria-label="فیلتر ذخیره شده"
            value=""
            onChange={(e) => {
              const item = saved.find((item) => item.name === e.target.value);
              if (item) {
                onChange(item.filter);
                setName(item.name);
              }
            }}
          >
            <option value="">فیلترهای ذخیره شده</option>
            {saved.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <DocumentIconAction
            label="حذف فیلتر ذخیره شده"
            shortcut="Alt+Delete"
            disabled={!name}
            onClick={() => {
              try {
                const next = read().filter((item) => item.name !== name);
                localStorage.setItem(key, JSON.stringify(next));
                setSaved(next);
              } catch {
                setError('حذف فیلتر ذخیره‌شده انجام نشد.');
              }
            }}
          >
            <Trash2 className="size-4" />
          </DocumentIconAction>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <Group
          group={value}
          onChange={onChange}
          scope="header"
          book={book}
          domain={domain}
        />
      </div>
    </details>
  );
}
