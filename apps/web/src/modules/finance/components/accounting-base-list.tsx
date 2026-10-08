'use client';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ListChecks,
  Calculator,
  List,
  RefreshCw,
  Filter,
  FilterX,
  Plus,
  FolderPlus,
  Trash2,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AccountingBookV1, AccountingSnapshotV1 } from '@nora/contracts';
import Link from '@/i18n/link';
import { AccountingButton as Button } from './accounting-operations';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/overlays';
import {
  accountingLists,
  definitionRoute,
  listRoute,
  listFields,
  listRecords,
  filterRecords,
  filterModes,
  filterRuleCount,
  incompleteFilter,
  type AccountingListKind,
  type FilterGroup,
  type FilterNode,
  type FilterRule,
  type ListField,
  type FilterOperator,
} from '../accounting-list-filters';

const emptyFilter = (): FilterGroup => ({
  type: 'group',
  id: 'root',
  mode: 'all',
  children: [],
});
const newRule = (): FilterRule => ({
  type: 'rule',
  id: crypto.randomUUID(),
  field: 'title',
  operator: 'contains',
  value: '',
  relationMode: 'any',
});
const nodeCount = (node: FilterNode): number =>
  node.type === 'rule'
    ? 1
    : 1 + node.children.reduce((count, child) => count + nodeCount(child), 0);
const selectClass =
  'h-10 min-w-0 rounded-lg border border-input bg-surface px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
const operators: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'شامل باشد' },
  { value: 'not-contains', label: 'شامل نباشد' },
  { value: 'equals', label: 'برابر باشد' },
  { value: 'not-equals', label: 'برابر نباشد' },
  { value: 'starts', label: 'شروع شود با' },
  { value: 'empty', label: 'خالی باشد' },
  { value: 'not-empty', label: 'خالی نباشد' },
  { value: 'before', label: 'قبل از' },
  { value: 'after', label: 'بعد از' },
];

function IconAction({
  label,
  shortcut,
  children,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  shortcut: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          <Button
            type="button"
            size="sm"
            variant={pressed ? 'primary' : 'outline'}
            aria-label={label}
            aria-keyshortcuts={shortcut}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <span
          dir="ltr"
          className="ms-2 rounded bg-white/15 px-1.5 font-mono text-xs"
        >
          {shortcut}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function GroupEditor({
  group,
  fields: availableFields,
  onChange,
  depth = 0,
  limit,
}: {
  group: FilterGroup;
  fields: ListField[];
  onChange: (next: FilterGroup) => void;
  depth?: number;
  limit: boolean;
}) {
  const fields =
    group.scope === 'allocations'
      ? availableFields
          .filter((field) => field.relation)
          .map((field) => ({ ...field, relation: false }))
      : availableFields;
  const createRule = () => ({ ...newRule(), field: fields[0]!.key });
  const append = (choice: string) => {
    if (!choice || limit) return;
    const [type, value] = choice.split(':');
    const field = fields.find((item) => item.key === value);
    const node: FilterNode =
      type === 'field' && field
        ? {
            ...createRule(),
            field: field.key,
            operator:
              field.type === 'text'
                ? ('contains' as const)
                : ('equals' as const),
            value: field.type === 'boolean' ? 'true' : '',
          }
        : {
            type: 'group',
            id: crypto.randomUUID(),
            mode:
              type === 'allocation' ? 'all' : (value as FilterGroup['mode']),
            children: [],
            ...(type === 'allocation'
              ? {
                  scope: 'allocations' as const,
                  relationMode: value as FilterGroup['mode'],
                }
              : {}),
          };
    onChange({ ...group, children: [...group.children, node] });
  };
  const update = (id: string, next: FilterNode) =>
    onChange({
      ...group,
      children: group.children.map((child) => (child.id === id ? next : child)),
    });
  const remove = (id: string) =>
    onChange({
      ...group,
      children: group.children.filter((child) => child.id !== id),
    });
  return (
    <div
      className={`space-y-3 rounded-xl border p-3 ${depth ? 'border-s-4 border-primary/20 bg-primary/5' : 'bg-surface'}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">
          {group.scope === 'allocations'
            ? 'دوره‌های مالی دفتر کل جاری'
            : depth
              ? 'شاخه شرط‌ها'
              : 'رکوردهایی که'}
        </span>
        {group.scope === 'allocations' && (
          <select
            aria-label="تطبیق دوره‌های مالی مرتبط"
            className={selectClass}
            value={group.relationMode ?? 'any'}
            onChange={(event) =>
              onChange({
                ...group,
                relationMode: event.target.value as FilterGroup['mode'],
              })
            }
          >
            {filterModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label={depth ? 'ترکیب شرط‌های گروه' : 'ترکیب شرط‌های فیلتر'}
          className={selectClass}
          value={group.mode}
          onChange={(event) =>
            onChange({
              ...group,
              mode: event.target.value as FilterGroup['mode'],
            })
          }
        >
          {filterModes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          از شرط‌های زیر برقرار باشد
        </span>
        <select
          aria-label="افزودن شرط یا شاخه به این گروه"
          className={`${selectClass} border-primary/30 text-primary`}
          value=""
          disabled={limit}
          onChange={(event) => append(event.target.value)}
        >
          <option value="">＋ افزودن شرط یا شاخه</option>
          <optgroup label="فیلدها">
            {fields
              .filter((field) => !field.relation)
              .map((field) => (
                <option key={field.key} value={`field:${field.key}`}>
                  {field.label}
                </option>
              ))}
          </optgroup>
          {fields.some((field) => field.relation) && (
            <optgroup label="دوره‌های مالی مرتبط با دفتر کل جاری">
              <option value="allocation:all">
                همه دوره‌های مالی دفتر کل‌ها
              </option>
              <option value="allocation:any">
                حداقل یکی از دوره‌های مالی دفتر کل‌ها
              </option>
            </optgroup>
          )}
          <optgroup label="شاخه شرط‌ها">
            {filterModes.map((mode) => (
              <option key={mode.value} value={`group:${mode.value}`}>
                {mode.label}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {group.children.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          هنوز شرطی اضافه نشده است؛ همه رکوردها نمایش داده می‌شوند.
        </p>
      )}
      {group.children.map((child) => (
        <div key={child.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {child.type === 'group' ? (
              <GroupEditor
                group={child}
                fields={fields}
                depth={depth + 1}
                limit={limit}
                onChange={(next) => update(child.id, next)}
              />
            ) : (
              (() => {
                const field = fields.find((item) => item.key === child.field)!;
                const available = operators.filter((operator) =>
                  field.type === 'boolean'
                    ? ['equals', 'not-equals'].includes(operator.value)
                    : field.type === 'date'
                      ? [
                          'equals',
                          'not-equals',
                          'before',
                          'after',
                          'empty',
                          'not-empty',
                        ].includes(operator.value)
                      : !['before', 'after'].includes(operator.value),
                );
                return (
                  <div className="grid gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-2 xl:grid-cols-4">
                    <select
                      aria-label="فیلد شرط"
                      className={selectClass}
                      value={child.field}
                      onChange={(event) => {
                        const nextField = fields.find(
                          (item) => item.key === event.target.value,
                        )!;
                        update(child.id, {
                          ...child,
                          field: nextField.key,
                          operator:
                            nextField.type === 'text'
                              ? ('contains' as const)
                              : ('equals' as const),
                          value: nextField.type === 'boolean' ? 'true' : '',
                        });
                      }}
                    >
                      <optgroup label="اطلاعات اصلی">
                        {fields
                          .filter((item) => !item.relation)
                          .map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                      </optgroup>
                      {fields.some((item) => item.relation) && (
                        <optgroup label="دوره‌های مالی دفتر کل جاری">
                          {fields
                            .filter((item) => item.relation)
                            .map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.label}
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </select>
                    {field.relation && (
                      <select
                        aria-label="شرط تخصیص‌های دفتر کل"
                        className={selectClass}
                        value={child.relationMode}
                        onChange={(event) =>
                          update(child.id, {
                            ...child,
                            relationMode: event.target
                              .value as FilterGroup['mode'],
                          })
                        }
                      >
                        {filterModes.map((mode) => (
                          <option key={mode.value} value={mode.value}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      aria-label="عملگر شرط"
                      className={selectClass}
                      value={child.operator}
                      onChange={(event) =>
                        update(child.id, {
                          ...child,
                          operator: event.target.value as FilterOperator,
                        })
                      }
                    >
                      {available.map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </select>
                    {!['empty', 'not-empty'].includes(child.operator) &&
                      (field.type === 'boolean' ? (
                        <select
                          aria-label="مقدار شرط"
                          className={selectClass}
                          value={child.value}
                          onChange={(event) =>
                            update(child.id, {
                              ...child,
                              value: event.target.value,
                            })
                          }
                        >
                          <option key="true" value="true">
                            بله
                          </option>
                          <option key="false" value="false">
                            خیر
                          </option>
                        </select>
                      ) : field.type === 'date' ? (
                        <DatePicker
                          id={`filter-${child.id}`}
                          aria-label="مقدار تاریخ شرط"
                          value={child.value}
                          onChange={(value) =>
                            update(child.id, { ...child, value })
                          }
                        />
                      ) : (
                        <Input
                          aria-label="مقدار شرط"
                          className="h-10"
                          value={child.value}
                          placeholder="مقدار مورد نظر…"
                          maxLength={2000}
                          onChange={(event) =>
                            update(child.id, {
                              ...child,
                              value: event.target.value,
                            })
                          }
                        />
                      ))}
                  </div>
                );
              })()
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={
                  child.type === 'group' ? 'حذف گروه شرط‌ها' : 'حذف شرط'
                }
                aria-keyshortcuts="Delete"
                onClick={() => remove(child.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Delete') {
                    event.preventDefault();
                    remove(child.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              حذف {child.type === 'group' ? 'گروه' : 'شرط'} · Delete هنگام تمرکز
              روی این دکمه
            </TooltipContent>
          </Tooltip>
        </div>
      ))}
      {depth > 0 && (
        <div className="flex gap-2">
          <IconAction
            label="افزودن شرط به این گروه"
            shortcut="Enter"
            disabled={limit}
            onClick={() =>
              onChange({
                ...group,
                children: [...group.children, createRule()],
              })
            }
          >
            <Plus className="size-4" />
          </IconAction>
          <IconAction
            label="افزودن زیرگروه به این گروه"
            shortcut="Enter"
            disabled={limit}
            onClick={() =>
              onChange({
                ...group,
                children: [
                  ...group.children,
                  {
                    type: 'group',
                    id: crypto.randomUUID(),
                    mode: 'all',
                    children: [],
                  },
                ],
              })
            }
          >
            <FolderPlus className="size-4" />
          </IconAction>
        </div>
      )}
    </div>
  );
}

export function AccountingBaseList({
  kind,
  snapshot,
  books,
  busy,
  refresh,
  run,
}: {
  kind: AccountingListKind;
  snapshot: AccountingSnapshotV1;
  books: AccountingBookV1[];
  busy: boolean;
  refresh: () => Promise<void>;
  run: (
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<unknown>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<FilterGroup>(emptyFilter);
  const [applied, setApplied] = useState<FilterGroup>(emptyFilter);
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );
  const [showFilters, setShowFilters] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [countRequested, setCountRequested] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reloading, setReloading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fields = listFields(kind);
  const records = listRecords(kind, snapshot, books);
  const columns =
    kind === 'ledgers'
      ? [
          { key: 'code', label: 'کد', type: 'text' },
          { key: 'title', label: 'عنوان', type: 'text' },
          { key: 'isMain', label: 'دفتر کل اصلی', type: 'boolean' },
          {
            key: 'allowsPosting',
            label: 'امکان صدور سند حسابداری در دفتر کل',
            type: 'boolean',
          },
          { key: 'active', label: 'وضعیت', type: 'boolean' },
        ]
      : fields
          .filter((field) =>
            ['code', 'title', 'titleEn', 'description', 'active'].includes(
              field.key,
            ),
          )
          .sort(
            (a, b) =>
              ['code', 'title', 'titleEn', 'description', 'active'].indexOf(
                a.key,
              ) -
              ['code', 'title', 'titleEn', 'description', 'active'].indexOf(
                b.key,
              ),
          );
  const filtered = filterRecords(
    records,
    {
      type: 'group',
      id: 'combined',
      mode: 'all',
      children: [
        applied,
        ...columns
          .filter((column) => columnFilters[column.key])
          .map((column): FilterRule => ({
            ...newRule(),
            id: `column-${column.key}`,
            field: column.key,
            operator: column.type === 'boolean' ? 'equals' : 'contains',
            value: columnFilters[column.key]!,
          })),
      ],
    },
    fields,
    search,
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const actualPage = Math.min(page, pages);
  const visible = filtered.slice(
    (actualPage - 1) * pageSize,
    actualPage * pageSize,
  );
  const selectedIds = selected.filter((id) =>
    filtered.some((row) => row.id === id),
  );
  const deleteTarget =
    kind !== 'ledgers' && selectedIds.length === 1
      ? snapshot.configurations.find((item) => item.id === selectedIds[0])
      : undefined;
  const allPageSelected =
    visible.length > 0 && visible.every((row) => selectedIds.includes(row.id));
  const somePageSelected =
    visible.some((row) => selectedIds.includes(row.id)) && !allPageSelected;
  const definition = accountingLists.find((list) => list.kind === kind)!;
  const dirty = JSON.stringify(applied) !== JSON.stringify(draft);
  const presetRule = applied.children[0];
  const presetValue = Object.values(columnFilters).some(Boolean)
    ? 'custom'
    : applied.children.length === 0
      ? 'all'
      : applied.mode === 'all' &&
          applied.children.length === 1 &&
          presetRule?.type === 'rule' &&
          presetRule.field === 'active' &&
          presetRule.operator === 'equals'
        ? presetRule.value
        : 'custom';
  const locked = busy || reloading;
  const apply = () => {
    if (incompleteFilter(draft)) {
      setMessage(
        'برای همه شرط‌ها مقدار وارد کنید یا عملگر «خالی باشد» را انتخاب کنید.',
      );
      return;
    }
    setApplied(draft);
    setSelected([]);
    setPage(1);
    setMessage('فیلتر اعمال شد.');
  };
  const clear = () => {
    setDraft(emptyFilter());
    setApplied(emptyFilter());
    setSearch('');
    setColumnFilters({});
    setSelected([]);
    setPage(1);
    setMessage('فیلترها پاک شدند.');
  };
  const toggleSelection = () => {
    setSelectionMode(!selectionMode);
    setSelected([]);
  };
  const count = () => {
    setCountRequested(true);
    setMessage('تعداد رکوردها بر اساس فیلتر اعمال‌شده محاسبه شد.');
  };
  const reload = async () => {
    if (locked) return;
    setReloading(true);
    setMessage('');
    setSelected([]);
    try {
      await refresh();
      setMessage('فهرست به‌روز شد.');
    } catch {
      setMessage('بارگذاری فهرست ناموفق بود.');
    } finally {
      setReloading(false);
    }
  };
  const openDefinition = () =>
    router.push(`${definitionRoute(kind)}?bookId=${snapshot.book.id}`);
  const addRule = () => {
    setShowFilters(true);
    if (nodeCount(draft) < 32)
      setDraft({ ...draft, children: [...draft.children, newRule()] });
  };
  const addGroup = () => {
    setShowFilters(true);
    if (nodeCount(draft) < 32)
      setDraft({
        ...draft,
        children: [
          ...draft.children,
          { type: 'group', id: crypto.randomUUID(), mode: 'all', children: [] },
        ],
      });
  };
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      locked ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector(
        '[role="dialog"], [role="alertdialog"], [role="menu"]',
      ) ||
      (event.target instanceof Element &&
        event.target.closest(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"], [role="combobox"]',
        ))
    )
      return;
    const actions: Record<string, () => void> = {
      KeyM: toggleSelection,
      KeyK: count,
      KeyL: () => setListOpen(true),
      KeyR: () => void reload(),
      KeyT: () => setShowFilters(!showFilters),
      KeyF: apply,
      KeyC: clear,
      KeyB: addRule,
      KeyG: addGroup,
      KeyO: openDefinition,
      KeyQ: () => searchRef.current?.focus(),
      ArrowRight: () => {
        if (actualPage > 1) setPage(actualPage - 1);
      },
      ArrowLeft: () => {
        if (actualPage < pages) setPage(actualPage + 1);
      },
    };
    const action = actions[event.code];
    if (action) {
      event.preventDefault();
      action();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  const preset = (active: string | null) => {
    const filter: FilterGroup =
      active === null
        ? emptyFilter()
        : {
            ...emptyFilter(),
            children: [
              {
                ...newRule(),
                field: 'active',
                operator: 'equals' as const,
                value: active,
              },
            ],
          };
    setDraft(filter);
    setApplied(filter);
    setSelected([]);
    setSearch('');
    setPage(1);
    setColumnFilters({});
    setMessage('فهرست انتخاب شد.');
  };
  return (
    <section
      dir="rtl"
      aria-label={definition.title}
      className="overflow-hidden rounded-2xl border bg-surface shadow-sm"
    >
      <Button
        permission="finance.account.manage"
        disabled={busy}
        onClick={() =>
          router.push(`${definitionRoute(kind)}?bookId=${snapshot.book.id}`)
        }
      >
        جدید
      </Button>
      {(['close', 'new'] as const).map((after) => (
        <Button
          key={after}
          permission="finance.account.manage"
          disabled={busy || !deleteTarget}
          onClick={() => {
            if (
              !deleteTarget ||
              !window.confirm(
                'رکورد انتخاب‌شده برای همیشه حذف شود؟ رکورد استفاده‌شده حذف نمی‌شود.',
              )
            )
              return;
            void run(
              'delete-base-record',
              { entity: 'configuration', id: deleteTarget.id },
              deleteTarget.version,
            ).then((result) => {
              if (!result) return;
              setSelected([]);
              if (after === 'new')
                router.push(
                  `${definitionRoute(kind)}?bookId=${snapshot.book.id}`,
                );
              if (after === 'close')
                router.push(
                  `/finance/accounting/general-ledger/base-information?bookId=${snapshot.book.id}`,
                );
            });
          }}
        >
          {after === 'close' ? 'حذف و بستن' : 'حذف و جدید'}
        </Button>
      ))}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h2 className="text-lg font-bold">{definition.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {kind === 'ledgers'
              ? 'دفترهای قابل دسترس شما'
              : `دفتر جاری: ${snapshot.book.title}`}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="toolbar"
          aria-label="عملیات فهرست"
        >
          <IconAction
            label="انتخاب چند رکورد"
            shortcut="Alt+Shift+M"
            pressed={selectionMode}
            disabled={locked}
            onClick={toggleSelection}
          >
            <ListChecks className="size-4" />
          </IconAction>
          <IconAction
            label="حذف فیلتر"
            shortcut="Alt+Shift+C"
            disabled={locked}
            onClick={clear}
          >
            <FilterX className="size-4" />
          </IconAction>
          <IconAction
            label="محاسبه تعداد رکوردها"
            shortcut="Alt+Shift+K"
            disabled={locked}
            onClick={count}
          >
            <Calculator className="size-4" />
          </IconAction>
          <DropdownMenu open={listOpen} onOpenChange={setListOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="فهرست‌ها"
                    aria-keyshortcuts="Alt+Shift+L"
                    disabled={locked}
                  >
                    <List className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                فهرست‌ها <span dir="ltr">Alt+Shift+L</span>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {accountingLists.map((list) => (
                <DropdownMenuItem key={list.kind} asChild>
                  <Link
                    href={`${listRoute(list.kind)}?bookId=${snapshot.book.id}`}
                  >
                    {list.kind === kind && <Check className="size-4" />}
                    {list.title}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <IconAction
            label="بارگذاری مجدد"
            shortcut="Alt+Shift+R"
            disabled={locked}
            onClick={() => void reload()}
          >
            <RefreshCw
              className={`size-4 ${reloading ? 'animate-spin' : ''}`}
            />
          </IconAction>
          <IconAction
            label="نمایش فیلترها"
            shortcut="Alt+Shift+T"
            pressed={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="size-4" />
          </IconAction>
          <IconAction
            label="بازکردن فرم تعریف"
            shortcut="Alt+Shift+O"
            onClick={openDefinition}
          >
            <ExternalLink className="size-4" />
          </IconAction>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-4">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute start-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            aria-label="جست‌وجوی فهرست"
            placeholder="جست‌وجو در کد، عنوان و توضیحات…"
            value={search}
            className="h-10 ps-9"
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected([]);
              setPage(1);
            }}
          />
        </div>
        <select
          aria-label="نمای فهرست"
          className={selectClass}
          value={presetValue}
          onChange={(event) =>
            preset(event.target.value === 'all' ? null : event.target.value)
          }
        >
          <option value="all">{definition.allTitle}</option>
          <option key="true" value="true">
            فقط فعال‌ها
          </option>
          <option key="false" value="false">
            فقط غیرفعال‌ها
          </option>
          <option value="custom" disabled>
            فیلتر سفارشی
          </option>
        </select>
        <IconAction
          label="تمرکز روی جست‌وجو"
          shortcut="Alt+Shift+Q"
          onClick={() => searchRef.current?.focus()}
        >
          <Search className="size-4" />
        </IconAction>
      </div>
      {showFilters && (
        <form
          aria-label="فیلتر پیشرفته"
          className="space-y-3 border-y bg-muted/20 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-primary" />
              <h3 className="text-sm font-bold">فیلتر پیشرفته</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {filterRuleCount(draft)} شرط
              </span>
              {dirty && (
                <span className="text-xs text-amber-700">
                  تغییرات اعمال نشده
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <IconAction
                label="افزودن شرط"
                shortcut="Alt+Shift+B"
                disabled={nodeCount(draft) >= 32}
                onClick={addRule}
              >
                <Plus className="size-4" />
              </IconAction>
              <IconAction
                label="افزودن گروه شرط‌ها"
                shortcut="Alt+Shift+G"
                disabled={nodeCount(draft) >= 32}
                onClick={addGroup}
              >
                <FolderPlus className="size-4" />
              </IconAction>
              <IconAction
                label="پاک‌کردن فیلترها"
                shortcut="Alt+Shift+C"
                onClick={clear}
              >
                <FilterX className="size-4" />
              </IconAction>
              <IconAction
                label="اعمال فیلتر"
                shortcut="Alt+Shift+F"
                disabled={locked}
                onClick={apply}
              >
                <Check className="size-4" />
              </IconAction>
            </div>
          </div>
          <GroupEditor
            group={draft}
            fields={fields}
            limit={nodeCount(draft) >= 32}
            onChange={setDraft}
          />
          {kind === 'fiscal-years' && (
            <p className="text-xs text-muted-foreground">
              شرط‌های دوره مالی دفتر کل، تخصیص‌های ثبت‌شده در دفتر جاری را بررسی
              می‌کنند.
            </p>
          )}
        </form>
      )}
      {message && (
        <p role="status" className="px-4 pt-3 text-sm text-primary">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
        <span className="rounded-lg bg-muted px-3 py-1.5">
          {filtered.length.toLocaleString('fa-IR')} نتیجه
        </span>
        {countRequested && (
          <span
            role="status"
            className="rounded-lg bg-primary/10 px-3 py-1.5 font-bold text-primary"
          >
            تعداد محاسبه‌شده: {filtered.length.toLocaleString('fa-IR')}
          </span>
        )}
        {selectionMode && (
          <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-primary">
            {selectedIds.length.toLocaleString('fa-IR')} رکورد انتخاب‌شده
          </span>
        )}
        {search && (
          <span className="text-muted-foreground">جست‌وجو: {search}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right text-sm">
          <caption className="sr-only">{definition.title}</caption>
          <thead className="border-y bg-muted/40">
            <tr key="titles">
              {selectionMode && (
                <th className="w-12 p-3">
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه رکوردهای این صفحه"
                    checked={allPageSelected}
                    aria-checked={somePageSelected ? 'mixed' : allPageSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = somePageSelected;
                    }}
                    disabled={locked || visible.length === 0}
                    onChange={() =>
                      setSelected(
                        allPageSelected
                          ? selectedIds.filter(
                              (id) => !visible.some((row) => row.id === id),
                            )
                          : [
                              ...new Set([
                                ...selectedIds,
                                ...visible.map((row) => row.id),
                              ]),
                            ],
                      )
                    }
                  />
                </th>
              )}
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  className="px-4 py-3 font-semibold text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
            {kind === 'ledgers' && (
              <tr key="filters" className="bg-surface">
                {selectionMode && <th key="selection-filter" />}
                {columns.map((column) => (
                  <th key={column.key} className="px-2 pb-3">
                    <div className="flex items-center gap-1 rounded-lg border border-input bg-surface px-2">
                      <Filter
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {column.type === 'boolean' ? (
                        <select
                          aria-label={`فیلتر ${column.label}`}
                          className="h-9 min-w-0 w-full bg-transparent text-sm font-normal"
                          value={columnFilters[column.key] ?? ''}
                          onChange={(event) => {
                            setColumnFilters({
                              ...columnFilters,
                              [column.key]: event.target.value,
                            });
                            setSelected([]);
                            setPage(1);
                          }}
                        >
                          <option key="all" value="">
                            همه
                          </option>
                          <option key="true" value="true">
                            {column.key === 'active' ? 'فعال' : 'بله'}
                          </option>
                          <option key="false" value="false">
                            {column.key === 'active' ? 'غیرفعال' : 'خیر'}
                          </option>
                        </select>
                      ) : (
                        <Input
                          aria-label={`فیلتر ${column.label}`}
                          className="h-9 border-0 bg-transparent font-normal shadow-none"
                          value={columnFilters[column.key] ?? ''}
                          onChange={(event) => {
                            setColumnFilters({
                              ...columnFilters,
                              [column.key]: event.target.value,
                            });
                            setSelected([]);
                            setPage(1);
                          }}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {visible.map((record) => (
              <tr
                key={record.id}
                aria-selected={
                  selectionMode ? selectedIds.includes(record.id) : undefined
                }
                className={`border-b transition-colors hover:bg-muted/25 ${selectedIds.includes(record.id) ? 'bg-primary/5' : ''}`}
              >
                {selectionMode && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`انتخاب ${record.values.title}`}
                      checked={selectedIds.includes(record.id)}
                      disabled={locked}
                      onChange={() =>
                        setSelected(
                          selectedIds.includes(record.id)
                            ? selectedIds.filter((id) => id !== record.id)
                            : [...selectedIds, record.id],
                        )
                      }
                    />
                  </td>
                )}
                {columns
                  .filter((column) => column.key !== 'active')
                  .map(({ key: field, type }) => (
                    <td key={field} className="max-w-80 px-4 py-4">
                      <span className="line-clamp-2">
                        {type === 'boolean'
                          ? record.values[field] === 'true'
                            ? 'بله'
                            : 'خیر'
                          : record.values[field] || '—'}
                      </span>
                    </td>
                  ))}
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${record.values.active === 'true' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}
                  >
                    {record.values.active === 'true' ? 'فعال' : 'غیرفعال'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <Search className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="font-semibold">رکوردی با این شرط‌ها پیدا نشد.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              عبارت جست‌وجو یا فیلترها را تغییر دهید.
            </p>
          </div>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-4 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          تعداد در صفحه
          <select
            aria-label="تعداد رکورد در صفحه"
            className={selectClass}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <IconAction
            label="صفحه قبل"
            shortcut="Alt+Shift+ArrowRight"
            disabled={actualPage === 1}
            onClick={() => setPage(actualPage - 1)}
          >
            <ChevronRight className="size-4" />
          </IconAction>
          <span>
            صفحه {actualPage.toLocaleString('fa-IR')} از{' '}
            {pages.toLocaleString('fa-IR')}
          </span>
          <IconAction
            label="صفحه بعد"
            shortcut="Alt+Shift+ArrowLeft"
            disabled={actualPage === pages}
            onClick={() => setPage(actualPage + 1)}
          >
            <ChevronLeft className="size-4" />
          </IconAction>
        </div>
      </footer>
    </section>
  );
}
