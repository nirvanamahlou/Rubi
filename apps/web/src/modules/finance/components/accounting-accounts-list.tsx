'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calculator,
  ListChecks,
  FilterX,
  Columns3,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { Input } from '@/components/ui/form-controls';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/overlays';
import { AccountingButton as Button } from './accounting-operations';
import { GroupEditor } from './accounting-base-list';
import {
  filterRecords,
  normalizeFilterText,
  type FilterGroup,
} from '../accounting-list-filters';

import {
  accountListProjection,
  type AccountsListKind,
} from '../accounting-accounts-model';
export type { AccountsListKind } from '../accounting-accounts-model';
const empty = (): FilterGroup => ({
  type: 'group',
  id: 'root',
  mode: 'all',
  children: [],
});
export function AccountingAccountsList({
  book,
  kind,
}: {
  book: AccountingSnapshotV1;
  kind: AccountsListKind;
}) {
  const router = useRouter();
  const { fields, records } = accountListProjection(book, kind);
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [tree, setTree] = useState(empty),
    [multi, setMulti] = useState(false),
    [selection, setSelection] = useState<string[]>([]),
    [count, setCount] = useState(false),
    [columns, setColumns] = useState(false),
    [hidden, setHidden] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [sort, setSort] = useState({
      key: fields[0]?.key ?? 'title',
      ascending: true,
    });
  const route = `/finance/accounting/general-ledger/accounts/${kind === 'detail-type-converters' ? 'detail-type-converter' : kind}?bookId=${book.book.id}`;
  const open = (id: string) => router.push(`${route}&id=${id}`);
  const clear = () => {
    setFilters({});
    setTree(empty());
    setSelection([]);
    setPage(0);
  };
  const filtered = filterRecords(records, tree, fields, '')
    .filter((row) =>
      fields.every(
        (field) =>
          !filters[field.key] ||
          (field.type === 'boolean'
            ? row.values[field.key] === filters[field.key]
            : normalizeFilterText(row.values[field.key] ?? '').includes(
                normalizeFilterText(filters[field.key] ?? ''),
              )),
      ),
    )
    .sort(
      (a, b) =>
        (sort.ascending ? 1 : -1) *
        (a.values[sort.key] ?? '').localeCompare(
          b.values[sort.key] ?? '',
          'fa',
          { numeric: true },
        ),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50)),
    currentPage = Math.min(page, pageCount - 1),
    shown = fields.filter((field) => !hidden.includes(field.key));
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.repeat
    )
      return;
    switch (event.code) {
      case 'KeyM':
        event.preventDefault();
        setMulti((old) => !old);
        setSelection([]);
        break;
      case 'KeyC':
        event.preventDefault();
        clear();
        break;
      case 'KeyK':
        event.preventDefault();
        setCount((old) => !old);
        break;
    }
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => shortcut(event);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const action = (
    label: string,
    key: string,
    Icon: typeof Calculator,
    onClick: () => void,
    pressed?: boolean,
  ) => (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        <span>
          <Button
            type="button"
            size="sm"
            variant={pressed ? 'primary' : 'outline'}
            aria-label={label}
            aria-pressed={pressed}
            aria-keyshortcuts={key}
            onClick={onClick}
          >
            <Icon className="size-4" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {key ? (
          <span dir="ltr" className="ms-2">
            {key}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
  const toolbar = (
    <div className="flex justify-end gap-1 border-y bg-muted/30 p-2">
      {action('حذف فیلتر', 'Alt+Shift+C', FilterX, clear)}
      {action(
        'انتخاب چند رکورد',
        'Alt+Shift+M',
        ListChecks,
        () => {
          setMulti((old) => !old);
          setSelection([]);
        },
        multi,
      )}
      {action(
        'محاسبه تعداد رکوردها و صفحات فهرست',
        'Alt+Shift+K',
        Calculator,
        () => setCount((old) => !old),
        count,
      )}
      {action('ستونها', '', Columns3, () => setColumns((old) => !old), columns)}
      <Button
        size="sm"
        variant="outline"
        aria-label="ویرایش"
        disabled={selection.length !== 1}
        onClick={() => selection[0] && open(selection[0])}
      >
        <Pencil className="size-4" />
      </Button>
    </div>
  );
  return (
    <section dir="rtl" className="space-y-2">
      <Button onClick={() => router.push(route)}>جدید</Button>
      <h2 className="rounded border bg-muted/20 px-3 py-2 text-sm font-bold">
        {kind === 'details'
          ? 'لیست حساب های تفصیلی'
          : kind === 'detail-types'
            ? 'لیست انواع تفصیل'
            : 'لیست تبدیل‌های نوع تفصیلی'}
      </h2>
      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm">فیلتر</summary>
        <div className="pt-3">
          <GroupEditor
            group={tree}
            fields={fields}
            onChange={(next) => {
              setTree(next);
              setPage(0);
              setSelection([]);
            }}
            limit={false}
          />
        </div>
      </details>
      {toolbar}
      {columns ? (
        <div className="flex flex-wrap gap-4 rounded border p-3">
          {fields.map((field) => (
            <label key={field.key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={!hidden.includes(field.key)}
                onChange={(e) =>
                  setHidden((old) =>
                    e.target.checked
                      ? old.filter((key) => key !== field.key)
                      : shown.length > 1
                        ? [...old, field.key]
                        : old,
                  )
                }
              />
              {field.label}
            </label>
          ))}
        </div>
      ) : null}
      <div className="min-h-[28rem] overflow-auto rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-50 dark:bg-muted">
              {multi ? (
                <th className="w-9">
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه رکوردهای صفحه"
                    checked={
                      filtered.slice(currentPage * 50, currentPage * 50 + 50)
                        .length > 0 &&
                      filtered
                        .slice(currentPage * 50, currentPage * 50 + 50)
                        .every((row) => selection.includes(row.id))
                    }
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? filtered
                              .slice(currentPage * 50, currentPage * 50 + 50)
                              .map((row) => row.id)
                          : [],
                      )
                    }
                  />
                </th>
              ) : null}
              {shown.map((field) => (
                <th key={field.key} className="border p-2 text-start">
                  <button
                    onClick={() =>
                      setSort((old) => ({
                        key: field.key,
                        ascending:
                          old.key === field.key ? !old.ascending : true,
                      }))
                    }
                  >
                    {field.label}
                  </button>
                </th>
              ))}
            </tr>
            <tr>
              {multi ? <th /> : null}
              {shown.map((field) => (
                <th key={field.key} className="border p-1">
                  {field.type === 'boolean' ? (
                    <select
                      aria-label={`فیلتر ${field.label}`}
                      className="h-8 w-full rounded border bg-surface"
                      value={filters[field.key] ?? ''}
                      onChange={(e) => {
                        setFilters((old) => ({
                          ...old,
                          [field.key]: e.target.value,
                        }));
                        setPage(0);
                        setSelection([]);
                      }}
                    >
                      <option value="" />
                      <option value="true">
                        {field.key === 'active' ? 'فعال' : 'بله'}
                      </option>
                      <option value="false">
                        {field.key === 'active' ? 'غیرفعال' : 'خیر'}
                      </option>
                    </select>
                  ) : (
                    <Input
                      aria-label={`فیلتر ${field.label}`}
                      value={filters[field.key] ?? ''}
                      onChange={(e) => {
                        setFilters((old) => ({
                          ...old,
                          [field.key]: e.target.value,
                        }));
                        setPage(0);
                        setSelection([]);
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(currentPage * 50, currentPage * 50 + 50)
              .map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  aria-selected={selection.includes(row.id)}
                  className={`cursor-pointer border-b focus:outline-primary ${selection.includes(row.id) ? 'bg-primary/10' : 'even:bg-muted/30'}`}
                  onClick={() =>
                    setSelection((old) =>
                      multi
                        ? old.includes(row.id)
                          ? old.filter((id) => id !== row.id)
                          : [...old, row.id]
                        : [row.id],
                    )
                  }
                  onDoubleClick={() => open(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open(row.id);
                  }}
                >
                  {multi ? (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        aria-label={`انتخاب ${row.values.title}`}
                        checked={selection.includes(row.id)}
                        readOnly
                      />
                    </td>
                  ) : null}
                  {shown.map((field) => (
                    <td key={field.key} className="border-x px-3 py-2">
                      {field.type === 'boolean'
                        ? row.values[field.key] === 'true'
                          ? field.key === 'active'
                            ? 'فعال'
                            : 'بله'
                          : field.key === 'active'
                            ? 'غیرفعال'
                            : 'خیر'
                        : row.values[field.key]}
                    </td>
                  ))}
                </tr>
              ))}
            {!filtered.length ? (
              <tr>
                <td
                  colSpan={shown.length + (multi ? 1 : 0)}
                  className="p-8 text-center text-muted-foreground"
                >
                  سطری برای نمایش وجود ندارد.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {toolbar}
      <div className="flex items-center justify-between p-2 text-xs">
        <span role="status">
          {count ? `${filtered.length} رکورد · ${pageCount} صفحه` : ''}
          {selection.length ? ` · ${selection.length} انتخاب شده` : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label="صفحه قبل"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <span>صفحه {currentPage + 1}</span>
          <Button
            size="sm"
            variant="outline"
            aria-label="صفحه بعد"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
