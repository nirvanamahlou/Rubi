'use client';
import { useState, type ReactNode } from 'react';
import { BookCopy, Minus, Plus, Search } from 'lucide-react';
import type { AccountingAccountV1 } from '@nora/contracts';
import { normalizeFilterText } from '../accounting-list-filters';

export const referenceAccountGroups = [
  ['11', 'داراییهای جاری'],
  ['12', 'داراییهای غیرجاری'],
  ['21', 'بدهیهای جاری'],
  ['22', 'بدهیهای غیرجاری'],
  ['31', 'حقوق صاحبان سهام'],
  ['51', 'درآمدها'],
  ['61', 'هزینه های فعالیت'],
  ['62', 'سایر هزینه های غیر عملیاتی'],
  ['63', 'هزینه های پرسنلی'],
  ['81', 'عملکرد'],
  ['91', 'حسابهای انتظامی'],
  ['92', 'طرف حسابهای انتظامی'],
  ['93', 'افتتاحیه و اختتامیه'],
] as const;

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
  const [term, setTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const toggle = (id: string) =>
    setExpanded((rows) =>
      rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id],
    );
  const matchedGroups = referenceAccountGroups
    .map(([code]) =>
      accounts.find(
        (account) => account.level === 'GROUP' && account.code === code,
      ),
    )
    .filter((account) => account !== undefined);
  const otherRoots = accounts.filter(
    (account) =>
      account.parentId === null &&
      !matchedGroups.some((group) => group.id === account.id),
  );
  const rows = accounts.filter((account) =>
    normalizeFilterText(`${account.code} ${account.title}`).includes(
      normalizeFilterText(term),
    ),
  );
  const renderAccount = (
    account: AccountingAccountV1,
    ancestors: string[] = [],
  ): ReactNode => {
    if (ancestors.includes(account.id)) return null;
    const children = accounts.filter((child) => child.parentId === account.id);
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
        <input
          aria-label="جست‌وجوی ساختار حساب"
          className="h-8 w-full border bg-surface px-2"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
      )}
      <div className="min-h-[26rem] overflow-auto border bg-surface p-2">
        <button
          type="button"
          aria-expanded={expanded.includes('root')}
          onClick={() => toggle('root')}
          className="mb-1 flex items-center gap-1 border bg-sky-50 px-1"
        >
          <Minus className="size-3" />
          ساختار حساب
        </button>
        {expanded.includes('root') && (
          <ul className="space-y-1">
            {matchedGroups.map((account) => renderAccount(account))}
            {!!otherRoots.length && (
              <li>
                <details className="mt-3 border-t pt-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    حساب‌های موجود دفتر
                  </summary>
                  <ul>{otherRoots.map((account) => renderAccount(account))}</ul>
                </details>
              </li>
            )}
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
            {term
              ? rows.map((account) => (
                  <tr key={account.id}>
                    <td className="p-1">{account.code}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onSelect(account.id)}
                      >
                        {account.title}
                      </button>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
        {(!term || !rows.length) && (
          <p className="p-3 text-center text-muted-foreground">
            سطری برای نمایش وجود ندارد.
          </p>
        )}
      </div>
    </aside>
  );
}
