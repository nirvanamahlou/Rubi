'use client';
import {
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Folder,
  FileText,
  Search,
} from 'lucide-react';
import type { AccountingAccountV1 } from '@nora/contracts';
import { createPortal } from 'react-dom';
import { normalizeFilterText } from '../accounting-list-filters';
import { chartChildAction } from '../accounting-chart-form';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/overlays';
import styles from './accounting-chart-tree.module.css';

export function AccountingChartTree({
  accounts,
  selectedId,
  onSelect,
  onCreateChild,
  creationDisabled = false,
}: {
  accounts: AccountingAccountV1[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateChild?: (parentId: string) => void;
  creationDisabled?: boolean;
}) {
  const [expanded, setExpanded] = useState<string[]>(['root']);
  const [filters, setFilters] = useState({ code: '', title: '', level: '' });
  const [applied, setApplied] = useState<typeof filters | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState<'code' | 'title'>('code');
  const [context, setContext] = useState<{
    parentId: string;
    x: number;
    y: number;
  } | null>(null);
  const contextSource = useRef<HTMLElement | null>(null);
  const contextParent = accounts.find(
    (account) => account.id === context?.parentId,
  );
  const contextAction = chartChildAction(contextParent);
  const showContext = (
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    parentId: string,
  ) => {
    if (!onCreateChild) return;
    event.preventDefault();
    event.stopPropagation();
    contextSource.current = event.currentTarget.matches('button')
      ? event.currentTarget
      : event.currentTarget.querySelector<HTMLElement>(
          '[aria-haspopup="menu"]',
        );
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer =
      'clientX' in event && (event.clientX !== 0 || event.clientY !== 0);
    setContext({
      parentId,
      x: pointer ? event.clientX : rect.right,
      y: pointer ? event.clientY : rect.bottom,
    });
  };
  const contextKeys = (event: KeyboardEvent<HTMLElement>, parentId: string) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
      showContext(event, parentId);
  };
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
        <div
          className={styles.row}
          data-selected={selectedId === account.id}
          onContextMenu={(event) => showContext(event, account.id)}
        >
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
            onKeyDown={(event) => contextKeys(event, account.id)}
            aria-haspopup={onCreateChild ? 'menu' : undefined}
            aria-pressed={selectedId === account.id}
            className={styles.account}
          >
            {account.level !== 'SUBSIDIARY' ? (
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
        <div
          className={styles.root}
          onContextMenu={(event) => showContext(event, '')}
        >
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
            onKeyDown={(event) => contextKeys(event, '')}
            aria-haspopup={onCreateChild ? 'menu' : undefined}
            aria-pressed={!selectedId}
            className={styles.rootTitle}
          >
            ساختار حساب
          </button>
        </div>
        {expanded.includes('root') && (
          <ul>{roots.map((account) => renderAccount(account))}</ul>
        )}
      </div>
      <DropdownMenu
        open={context !== null}
        onOpenChange={(open) => {
          if (!open) setContext(null);
        }}
        dir="rtl"
      >
        {context &&
          createPortal(
            <DropdownMenuTrigger
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none fixed h-0 w-0 opacity-0"
              style={{ left: context.x, top: context.y }}
            />,
            document.body,
          )}
        <DropdownMenuContent
          aria-label="عملیات ساختار حساب"
          align="start"
          sideOffset={0}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            contextSource.current?.focus();
          }}
        >
          <DropdownMenuItem
            disabled={
              creationDisabled ||
              !contextAction ||
              (!!context?.parentId && !contextParent)
            }
            onSelect={() => {
              if (context && contextAction) onCreateChild?.(context.parentId);
            }}
          >
            {contextAction?.label ?? 'ایجاد زیرمجموعه مجاز نیست'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
