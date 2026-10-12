'use client';
import { useState, type ReactNode } from 'react';
import { BookCopy, Minus, Plus, Search } from 'lucide-react';
import type { AccountingAccountV1 } from '@nora/contracts';
import { normalizeFilterText } from '../accounting-list-filters';

export function AccountingChartTree({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: AccountingAccountV1[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>(['root']);
  const [filters, setFilters] = useState({ code: '', title: '', level: '' });
  const [applied, setApplied] = useState<typeof filters | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<'code' | 'title'>('code');
  const toggle = (id: string) =>
    setExpanded((rows) =>
      rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id],
    );
  const sorted = [...accounts].sort(
    (a, b) =>
      a[sort].localeCompare(b[sort], sort === 'code' ? 'en' : 'fa', {
        numeric: true,
      }) || a.code.localeCompare(b.code),
  );
  const roots = sorted.filter((account) => account.parentId === null);
  const rows = applied
    ? sorted.filter(
        (account) =>
          normalizeFilterText(account.code).includes(
            normalizeFilterText(applied.code),
          ) &&
          normalizeFilterText(account.title).includes(
            normalizeFilterText(applied.title),
          ) &&
          (!applied.level || account.level === applied.level),
      )
    : [];
  const renderAccount = (
    account: AccountingAccountV1,
    ancestors: string[] = [],
  ): ReactNode => {
    if (ancestors.includes(account.id)) return null;
    const children = sorted.filter((child) => child.parentId === account.id);
    const opened = expanded.includes(account.id);
    return (
      <li key={account.id}>
        <div className="flex items-center gap-1 py-0.5">
          <button
            type="button"
            disabled={!children.length}
            aria-label={`${opened ? 'بستن' : 'بازکردن'} شاخه ${account.title}`}
            aria-expanded={children.length ? opened : undefined}
            onClick={() => toggle(account.id)}
            className="size-4 shrink-0 border disabled:opacity-20"
          >
            {opened ? (
              <Minus className="size-3" />
            ) : (
              <Plus className="size-3" />
            )}
          </button>
          <BookCopy
            className="size-4 shrink-0 text-blue-600"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => onSelect(account.id)}
            aria-pressed={selectedId === account.id}
            className={`min-w-0 text-right hover:text-primary ${selectedId === account.id ? 'bg-sky-100 text-primary' : ''}`}
          >
            {account.code}-{account.title}
          </button>
        </div>
        {opened && (
          <ul className="ms-3 border-s border-dotted ps-2">
            {children.map((child) =>
              renderAccount(child, [...ancestors, account.id]),
            )}
          </ul>
        )}
      </li>
    );
  };
  return (
    <aside dir="rtl" className="space-y-2 border bg-muted/10 p-2 text-xs">
      <label className="flex items-center justify-between gap-2">
        مرتب سازی
        <select
          aria-label="مرتب سازی"
          value={sort}
          onChange={(event) => setSort(event.target.value as 'code' | 'title')}
          className="h-7 border bg-surface px-2"
        >
          <option value="code">کد</option>
          <option value="title">عنوان</option>
        </select>
      </label>
      <button
        type="button"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen(!searchOpen)}
        className="flex w-full items-center justify-between border bg-muted/40 px-2 py-1"
      >
        <span>جستجو</span>
        <Search className="size-3" />
      </button>
      {searchOpen && (
        <form
          className="space-y-2 border p-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ ...filters });
          }}
        >
          {(['code', 'title'] as const).map((key) => (
            <label
              key={key}
              className="grid grid-cols-[3rem_1fr] items-center gap-2"
            >
              {key === 'code' ? 'کد:' : 'عنوان:'}
              <input
                className="h-7 min-w-0 border bg-surface px-2"
                value={filters[key]}
                onChange={(event) =>
                  setFilters((old) => ({ ...old, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <label className="grid grid-cols-[3rem_1fr] items-center gap-2">
            نوع:
            <select
              className="h-7 min-w-0 border bg-surface"
              value={filters.level}
              onChange={(event) =>
                setFilters((old) => ({ ...old, level: event.target.value }))
              }
            >
              <option value="">همه</option>
              <option value="GROUP">گروه حساب</option>
              <option value="GENERAL">حساب کل</option>
              <option value="SUBSIDIARY">حساب معین</option>
            </select>
          </label>
          <button type="submit" className="border bg-sky-50 px-3 py-1">
            جستجو
          </button>
        </form>
      )}
      <div className="h-[26rem] overflow-auto border bg-surface p-2">
        <div className="mb-1 flex items-center gap-1">
          <button
            type="button"
            aria-label={
              expanded.includes('root')
                ? 'بستن ساختار حساب'
                : 'بازکردن ساختار حساب'
            }
            aria-expanded={expanded.includes('root')}
            onClick={() => toggle('root')}
            className="mb-1 flex items-center gap-1 border bg-sky-50 px-1"
          >
            {expanded.includes('root') ? (
              <Minus className="size-3" />
            ) : (
              <Plus className="size-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelect('')}
            aria-pressed={!selectedId}
          >
            ساختار حساب
          </button>
        </div>
        {expanded.includes('root') && (
          <ul className="space-y-1">
            {roots.map((account) => renderAccount(account))}
          </ul>
        )}
      </div>
      <div className="border bg-surface p-1">
        <p className="border-b bg-sky-50 p-1">نتایج جستجو</p>
        <table className="w-full text-right">
          <thead className="bg-sky-50">
            <tr>
              <th className="p-1">کد</th>
              <th className="p-1">عنوان</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => (
              <tr key={account.id}>
                <td className="p-1">{account.code}</td>
                <td>
                  <button type="button" onClick={() => onSelect(account.id)}>
                    {account.title}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-3 text-center text-muted-foreground">
            سطری برای نمایش وجود ندارد.
          </p>
        )}
      </div>
    </aside>
  );
}
