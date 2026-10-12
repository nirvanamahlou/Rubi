'use client';
import { useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AccountingSnapshotV1,
  AccountingTemplateV1,
  AccountingTemplateLineV1,
} from '@nora/contracts';
import { Plus, Trash2, Search, ListChecks, FolderOpen } from 'lucide-react';
import { Button as UiButton } from '@/components/ui/button';
import { Input, FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/overlays';
import {
  AccountingButton,
  AccountingSaveButtons,
  AccountingDeleteButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import {
  AccountingSetupNotes,
  parseSetupNotes,
  type SetupNote,
} from './accounting-setup-notes';

type Role = NonNullable<AccountingTemplateLineV1['role']>;
type Line = Omit<AccountingTemplateLineV1, 'id' | 'position'>;
type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
const freshLine = (role: Role): Line => ({
  role,
  accountId: '',
  detail4Id: null,
  detail5Id: null,
  detail6Id: null,
  side: 'DEBIT',
  percentage: role === 'TARGET' ? '100' : '',
  include: true,
});
function Action({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <UiButton
          type="button"
          variant="outline"
          size="sm"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </UiButton>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span dir="ltr">({shortcut})</span>
      </TooltipContent>
    </Tooltip>
  );
}
function TemplateGrid({
  title,
  role,
  rows,
  setRows,
  book,
  busy,
  parentPosition,
  onSelectParent,
  onParentPositionChange,
}: {
  title: string;
  role: Role;
  rows: Line[];
  setRows: (rows: Line[]) => void;
  book: AccountingSnapshotV1;
  busy: boolean;
  parentPosition?: number | null;
  onSelectParent?: (position: number | null) => void;
  onParentPositionChange?: (position: number | null) => void;
}) {
  const [selected, setSelected] = useState(-1);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const accounts = book.accounts.filter(
    (account) => account.active && account.level === 'SUBSIDIARY',
  );
  const options = accounts.map((account) => ({
    value: account.id,
    label: `${account.code} — ${account.title}`,
  }));
  const matching = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        row.role === role &&
        ((role !== 'SOURCE' && role !== 'BASIS') ||
          row.parentPosition === parentPosition),
    );
  const update = (index: number, patch: Partial<Line>) =>
    setRows(rows.map((row, n) => (n === index ? { ...row, ...patch } : row)));
  const childRole = role === 'SOURCE' || role === 'BASIS';
  const validParent =
    !childRole ||
    (parentPosition != null &&
      accounts.some(
        (account) => account.id === rows[parentPosition]?.accountId,
      ));
  const add = () => {
    if (!validParent) return;
    setRows([
      ...rows,
      {
        ...freshLine(role),
        ...(role === 'SOURCE' || role === 'BASIS' ? { parentPosition } : {}),
      },
    ]);
    setSelected(rows.length);
  };
  const remove = () => {
    if (selected >= 0 && rows[selected]?.role === role) {
      const removed = new Set(
        rows
          .map((row, index) => ({ row, index }))
          .filter(
            ({ row, index }) =>
              index === selected || row.parentPosition === selected,
          )
          .map(({ index }) => index),
      );
      const positions = new Map(
        rows
          .map((_, index) => index)
          .filter((index) => !removed.has(index))
          .map((oldPosition, newPosition) => [oldPosition, newPosition]),
      );
      setRows(
        rows
          .filter((_, index) => !removed.has(index))
          .map((row) => ({
            ...row,
            parentPosition:
              row.parentPosition == null
                ? null
                : (positions.get(row.parentPosition) ?? null),
          })),
      );
      onSelectParent?.(null);
      if (onParentPositionChange)
        onParentPositionChange(
          parentPosition == null
            ? null
            : (positions.get(parentPosition) ?? null),
        );
      setSelected(-1);
    }
  };
  return (
    <fieldset
      className="space-y-2 rounded border p-3"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          setSearchVisible((value) => !value);
          return;
        }
        if (event.altKey && event.key.toLowerCase() === 'l' && !busy) {
          event.preventDefault();
          setChecked([]);
          setBulk((value) => !value);
          return;
        }
        if (
          busy ||
          (event.target instanceof HTMLElement &&
            event.target.closest('input,[role="combobox"]'))
        )
          return;
        if (event.key === 'Insert') {
          event.preventDefault();
          add();
        }
        if (event.key === 'Delete') {
          event.preventDefault();
          remove();
        }
      }}
    >
      <legend className="px-2 font-bold">{title}</legend>
      <div className="overflow-auto">
        <table className="w-full min-w-[45rem] text-xs">
          <thead className="bg-muted">
            <tr>
              {[
                'کد حساب معین',
                'سطح 4',
                'سطح 5',
                'سطح 6',
                ...(role === 'TARGET' ? ['درصد'] : []),
              ].map((heading) => (
                <th key={heading} className="border p-2 text-right">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matching
              .filter(({ row }) => {
                const account = accounts.find(
                  (item) => item.id === row.accountId,
                );
                return (
                  !search ||
                  `${account?.code ?? ''} ${account?.title ?? ''}`.includes(
                    search,
                  )
                );
              })
              .map(({ row, index }) => {
                const account = accounts.find(
                  (item) => item.id === row.accountId,
                );
                return (
                  <tr
                    key={index}
                    tabIndex={0}
                    aria-selected={selected === index}
                    className={selected === index ? 'bg-primary/10' : ''}
                    onFocus={() => {
                      setSelected(index);
                      onSelectParent?.(index);
                    }}
                    onClick={() => {
                      setSelected(index);
                      onSelectParent?.(index);
                    }}
                    onDoubleClick={() => onSelectParent?.(index)}
                  >
                    <td className="border p-1">
                      <SearchCombobox
                        label={`کد حساب معین ${title} ${index + 1}`}
                        options={options}
                        disabled={busy}
                        value={row.accountId}
                        onValueChange={(accountId) =>
                          update(index, {
                            accountId,
                            detail4Id: null,
                            detail5Id: null,
                            detail6Id: null,
                          })
                        }
                      />
                    </td>
                    {([4, 5, 6] as const).map((level) => {
                      const attributes = account?.attributes ?? {};
                      const allowed = Array.isArray(
                        attributes[`detail${level}TypeIds`],
                      )
                        ? (attributes[`detail${level}TypeIds`] as string[])
                        : [
                            String(attributes[`detail${level}TypeId`] ?? ''),
                          ].filter(Boolean);
                      return (
                        <td key={level} className="border p-1">
                          <SearchCombobox
                            label={`سطح ${level} ${title} ${index + 1}`}
                            value={row[`detail${level}Id`] ?? ''}
                            options={book.details
                              .filter(
                                (detail) =>
                                  detail.active &&
                                  allowed.includes(detail.typeId ?? ''),
                              )
                              .map((detail) => ({
                                value: detail.id,
                                label: `${detail.code} — ${detail.title}`,
                              }))}
                            disabled={busy || !allowed.length}
                            onValueChange={(value) =>
                              update(index, {
                                [`detail${level}Id`]: value || null,
                              })
                            }
                          />
                        </td>
                      );
                    })}
                    {role === 'TARGET' ? (
                      <td className="border p-1">
                        <Input
                          aria-label={`درصد ${index + 1}`}
                          required
                          inputMode="decimal"
                          dir="ltr"
                          disabled={busy}
                          value={row.percentage}
                          onChange={(event) =>
                            update(index, { percentage: event.target.value })
                          }
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {searchVisible ? (
        <Input
          aria-label={`جستجوی ${title}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      <div
        role="toolbar"
        aria-label={`عملیات ${title}`}
        className="flex justify-end gap-1"
      >
        <Action
          label="افزودن"
          shortcut="Insert"
          disabled={busy || !validParent}
          onClick={add}
        >
          <Plus className="size-4" />
        </Action>
        <Action
          label="حذف"
          shortcut="Delete"
          disabled={busy || selected < 0}
          onClick={remove}
        >
          <Trash2 className="size-4" />
        </Action>
        <Action
          label="جستجو"
          shortcut="Ctrl+F"
          onClick={() => setSearchVisible((value) => !value)}
        >
          <Search className="size-4" />
        </Action>
        <Action
          label={
            role === 'BASIS'
              ? 'انتخاب دسته ای'
              : role === 'SOURCE'
                ? 'انتخاب معین با سطوح مشخص'
                : 'انتخاب'
          }
          shortcut="Alt+L"
          disabled={busy || !validParent}
          onClick={() => {
            setChecked([]);
            setBulk((value) => !value);
          }}
        >
          <ListChecks className="size-4" />
        </Action>
      </div>
      {bulk ? (
        <div
          className="max-h-72 overflow-auto rounded border p-3"
          role="region"
          aria-label="انتخاب حساب معین"
        >
          <div className="space-y-1">
            {accounts.map((account) => (
              <label key={account.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked.includes(account.id)}
                  onChange={(event) =>
                    setChecked((current) =>
                      event.target.checked
                        ? [...current, account.id]
                        : current.filter((id) => id !== account.id),
                    )
                  }
                />
                {account.code} — {account.title}
              </label>
            ))}
          </div>
          <UiButton
            type="button"
            onClick={() => {
              setRows([
                ...rows,
                ...checked
                  .filter(
                    (accountId) =>
                      !matching.some(
                        ({ row }) =>
                          row.accountId === accountId &&
                          !row.detail4Id &&
                          !row.detail5Id &&
                          !row.detail6Id,
                      ),
                  )
                  .map((accountId) => ({
                    ...freshLine(role),
                    accountId,
                    ...(role === 'SOURCE' || role === 'BASIS'
                      ? { parentPosition }
                      : {}),
                  })),
              ]);
              setBulk(false);
            }}
          >
            تأیید
          </UiButton>
          <UiButton
            type="button"
            variant="outline"
            onClick={() => setBulk(false)}
          >
            انصراف
          </UiButton>
        </div>
      ) : null}
    </fieldset>
  );
}
export function AccountingDocumentTemplate({
  book,
  kind,
  run,
  busy,
  listOnly = false,
}: {
  book: AccountingSnapshotV1;
  kind: 'AUTOMATIC' | 'REVALUATION';
  run: Run;
  busy: boolean;
  listOnly?: boolean;
}) {
  const router = useRouter();
  const linkedId = useSearchParams().get('id');
  const initial = book.templates.find(
    (template) =>
      template.id === linkedId &&
      template.kind === kind &&
      template.attributes?.sourceForm === 'rahkaran-documents-v1',
  );
  const [selected, setSelected] = useState<AccountingTemplateV1 | null>(
    initial ?? null,
  );
  const [head, setHead] = useState({
    code: initial?.code ?? '',
    title: initial?.title ?? '',
    titleEn: initial?.titleEn ?? '',
    description: initial?.description ?? '',
    descriptionEn: initial?.descriptionEn ?? '',
  });
  const [lines, setLines] = useState<Line[]>(initial?.lines ?? []);
  const [parentPosition, setParentPosition] = useState<number | null>(null);
  const [notes, setNotes] = useState<SetupNote[]>(
    parseSetupNotes(initial?.attributes?.notes),
  );
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [openVisible, setOpenVisible] = useState(false);
  const [search, setSearch] = useState('');
  const title = kind === 'AUTOMATIC' ? 'الگوی سند اتوماتیک' : 'الگوی تسعیر ارز';
  const templates = book.templates.filter(
    (template) =>
      template.kind === kind &&
      template.attributes?.sourceForm === 'rahkaran-documents-v1',
  );
  const reset = () => {
    setSelected(null);
    setHead({
      code: '',
      title: '',
      titleEn: '',
      description: '',
      descriptionEn: '',
    });
    setLines([]);
    setParentPosition(null);
    setNotes([]);
    setTab('main');
  };
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/documents/lists/${kind === 'AUTOMATIC' ? 'automatic-templates' : 'revaluation-templates'}`,
    );
  const open = (template: AccountingTemplateV1) => {
    if (listOnly) {
      router.push(
        `/finance/accounting/general-ledger/documents/${kind === 'AUTOMATIC' ? 'automatic-templates' : 'revaluation-templates'}?id=${template.id}`,
      );
      return;
    }
    setSelected(template);
    setHead({
      code: template.code,
      title: template.title,
      titleEn: template.titleEn ?? '',
      description: template.description ?? '',
      descriptionEn: template.descriptionEn ?? '',
    });
    setLines(template.lines);
    setParentPosition(null);
    setNotes(parseSetupNotes(template.attributes?.notes));
    setOpenVisible(false);
  };
  const save = async (after: 'stay' | 'new' | 'close') => {
    const response = await run<AccountingTemplateV1>(
      'save-template',
      {
        ...head,
        kind,
        sourceForm: 'rahkaran-documents-v1',
        ...(selected ? { id: selected.id } : {}),
        lines,
        notes,
      },
      selected?.version,
    );
    if (!response) return;
    open(response);
    if (after === 'new') reset();
    if (after === 'close') close();
  };
  return (
    <section
      className="space-y-4"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (
          event.ctrlKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'l'
        ) {
          event.preventDefault();
          setOpenVisible((value) => !value);
        }
      }}
    >
      <h2 className="text-lg font-bold">
        {listOnly ? 'فهرست ' : ''}
        {title}
      </h2>
      {!listOnly ? (
        <>
          <AccountingDeleteButtons
            busy={busy}
            selected={selected}
            entity="template"
            run={run}
            reset={reset}
            close={close}
          />
          <div className="flex justify-end gap-2">
            <AccountingButton type="button" onClick={reset} disabled={busy}>
              جدید
            </AccountingButton>
            <Action
              label="باز کردن"
              shortcut="Ctrl+L"
              onClick={() => setOpenVisible((value) => !value)}
            >
              <FolderOpen className="size-4" />
            </Action>
          </div>
          <div role="tablist" className="flex gap-2">
            <UiButton
              type="button"
              role="tab"
              aria-selected={tab === 'main'}
              onClick={() => setTab('main')}
            >
              اطلاعات اصلی
            </UiButton>
            <UiButton
              type="button"
              role="tab"
              aria-selected={tab === 'notes'}
              onClick={() => setTab('notes')}
            >
              یادداشت
            </UiButton>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save(accountingSaveDisposition(event));
            }}
          >
            <div hidden={tab !== 'main'} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {(
                  [
                    'code',
                    'title',
                    'titleEn',
                    ...(kind === 'AUTOMATIC'
                      ? (['description', 'descriptionEn'] as const)
                      : []),
                  ] as const
                ).map((key) => (
                  <FormField
                    key={key}
                    id={`document-template-${key}`}
                    required={key === 'code' || key === 'title'}
                    label={
                      {
                        code: 'کد',
                        title: 'عنوان',
                        titleEn: 'عنوان به زبان دوم',
                        description: 'شرح پیش فرض',
                        descriptionEn: 'شرح پیش فرض به زبان دوم',
                      }[key]
                    }
                  >
                    <Input
                      id={`document-template-${key}`}
                      required={key === 'code' || key === 'title'}
                      disabled={busy}
                      value={head[key]}
                      onChange={(event) =>
                        setHead((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                ))}
              </div>
              <TemplateGrid
                title={
                  kind === 'AUTOMATIC' ? 'حساب های مقصد' : 'حساب های تسعیر'
                }
                role={kind === 'AUTOMATIC' ? 'TARGET' : 'OFFSET'}
                rows={lines}
                setRows={setLines}
                book={book}
                busy={busy}
                onSelectParent={setParentPosition}
              />
              <TemplateGrid
                title={
                  kind === 'AUTOMATIC' ? 'حساب های مبدا' : 'حساب تسعیر پذیر'
                }
                role={kind === 'AUTOMATIC' ? 'SOURCE' : 'BASIS'}
                rows={lines}
                setRows={setLines}
                book={book}
                busy={busy}
                parentPosition={parentPosition}
                onParentPositionChange={setParentPosition}
              />
            </div>
            <div hidden={tab !== 'notes'}>
              <AccountingSetupNotes
                notes={notes}
                onChange={setNotes}
                book={book}
                requireDate={false}
                {...(selected
                  ? {
                      record: {
                        id: selected.id,
                        entityType: 'AccountingTemplate',
                        title: selected.title,
                      },
                    }
                  : {})}
              />
            </div>
            <AccountingSaveButtons busy={busy} />
          </form>
        </>
      ) : null}
      {listOnly || openVisible ? (
        <div className="space-y-2">
          <Input
            aria-label="فیلتر عنوان الگو"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {[
                    'کد',
                    'عنوان',
                    ...(kind === 'AUTOMATIC'
                      ? ['شرح پیش فرض', 'شرح پیش فرض به زبان دوم']
                      : ['عنوان به زبان دوم']),
                  ].map((column) => (
                    <th key={column} className="border p-2 text-right">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates
                  .filter((template) =>
                    `${template.code} ${template.title}`.includes(search),
                  )
                  .map((template) => (
                    <tr
                      key={template.id}
                      tabIndex={0}
                      onDoubleClick={() => open(template)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') open(template);
                      }}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <td className="border p-2">{template.code}</td>
                      <td className="border p-2">{template.title}</td>
                      {kind === 'AUTOMATIC' ? (
                        <>
                          <td className="border p-2">{template.description}</td>
                          <td className="border p-2">
                            {template.descriptionEn}
                          </td>
                        </>
                      ) : (
                        <td className="border p-2">{template.titleEn}</td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
