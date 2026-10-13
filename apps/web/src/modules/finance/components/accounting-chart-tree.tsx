'use client';
import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Folder,
  FileText,
  Search,
  Network,
} from 'lucide-react';
import type { AccountingAccountV1 } from '@nora/contracts';
import { normalizeFilterText } from '../accounting-list-filters';
import styles from './accounting-chart-tree.module.css';

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
        <div className={styles.row} data-selected={selectedId === account.id}>
          <button
            type="button"
            disabled={!children.length}
            aria-label={`${opened ? 'بستن' : 'بازکردن'} شاخه ${account.title}`}
            aria-expanded={children.length ? opened : undefined}
            onClick={() => toggle(account.id)}
            className={styles.toggle}
          >
            {opened ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelect(account.id)}
            aria-pressed={selectedId === account.id}
            className={styles.account}
          >
            {children.length ? (
              <Folder className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <FileText className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className={styles.code} dir="ltr">
              {account.code}
            </span>
            <span className={styles.title}>{account.title}</span>
          </button>
        </div>
        {opened && (
          <ul className={styles.branch}>
            {children.map((child) =>
              renderAccount(child, [...ancestors, account.id]),
            )}
          </ul>
        )}
      </li>
    );
  };
  return (
    <aside dir="rtl" className={styles.tree} aria-label="ساختار حساب">
      <div className={styles.heading}>
        <Network className="size-5" aria-hidden="true" />
        <strong>ساختار حساب</strong>
        <span className={styles.count}>
          {accounts.length.toLocaleString('fa-IR')}
        </span>
      </div>
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
        className={styles.searchToggle}
      >
        <span>جستجو</span>
        <Search className="size-3" />
      </button>
      {searchOpen && (
        <form
          className="space-y-3 rounded-xl border border-border bg-muted/20 p-3"
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
          <button type="submit" className={styles.searchToggle}>
            جستجو
          </button>
        </form>
      )}
      <div className={styles.canvas}>
        <div className={styles.root}>
          <button
            type="button"
            aria-label={
              expanded.includes('root')
                ? 'بستن ساختار حساب'
                : 'بازکردن ساختار حساب'
            }
            aria-expanded={expanded.includes('root')}
            onClick={() => toggle('root')}
            className={styles.toggle}
          >
            {expanded.includes('root') ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelect('')}
            aria-pressed={!selectedId}
            className={styles.rootTitle}
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
      <div className={styles.results}>
        <p className="border-b border-border p-3 font-bold">نتایج جستجو</p>
        <table className="w-full text-right">
          <thead className="bg-muted/40">
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
