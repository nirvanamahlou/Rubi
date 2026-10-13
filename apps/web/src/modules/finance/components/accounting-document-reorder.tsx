'use client';

import { useState } from 'react';
import type {
  AccountingCommandV1,
  AccountingJournalV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { ArrowUp, ArrowDown, Search, Save } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/overlays';
import { accountingApi } from '../api/accounting-api';
import { AccountingButton } from './accounting-operations';

type Run = <T = unknown>(
  action: string,
  payload: AccountingCommandV1['payload'],
  version?: number,
) => Promise<T | undefined>;

export function AccountingDocumentReorder({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: Run;
  busy: boolean;
}) {
  const [date, setDate] = useState('');
  const [loadedDate, setLoadedDate] = useState('');
  const [rows, setRows] = useState<AccountingJournalV1[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const search = async () => {
    if (!date || loading) return;
    setLoading(true);
    setError('');
    try {
      const first = await accountingApi.journals(book.book.id, {
        from: date,
        to: date,
        status: 'APPROVED',
        page: '1',
      });
      if (first.total > 500)
        throw new Error('در هر جابجایی حداکثر ۵۰۰ سند مجاز است.');
      const all = [...first.items];
      for (let page = 2; all.length < first.total; page++) {
        const next = await accountingApi.journals(book.book.id, {
          from: date,
          to: date,
          status: 'APPROVED',
          page: String(page),
        });
        if (!next.items.length)
          throw new Error('فهرست تغییر کرد؛ دوباره جستجو کنید.');
        all.push(...next.items);
      }
      all.sort(
        (a, b) =>
          Number(a.attributes.dailyNumber ?? a.number ?? 0) -
            Number(b.attributes.dailyNumber ?? b.number ?? 0) ||
          a.id.localeCompare(b.id),
      );
      setRows(all);
      setLoadedDate(date);
      setSelected('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'خواندن اسناد انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  };
  const index = rows.findIndex((row) => row.id === selected);
  const move = (direction: number) => {
    if (index < 0 || index + direction < 0 || index + direction >= rows.length)
      return;
    setRows((current) => {
      const next = [...current];
      const source = next[index];
      const target = next[index + direction];
      if (source && target) {
        next[index] = target;
        next[index + direction] = source;
      }
      return next;
    });
  };
  const editable = rows.every((row) => row.status === 'APPROVED');
  return (
    <section
      className="space-y-4"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, [role="combobox"]')
        )
          return;
        if (
          event.ctrlKey &&
          event.shiftKey &&
          ['u', 'd'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          if (editable) move(event.key.toLowerCase() === 'u' ? -1 : 1);
        }
      }}
    >
      <h2 className="text-lg font-black">جابجایی اسناد</h2>
      <div className="flex items-end gap-3">
        <FormField label="تاریخ" id="reorder-date">
          <DatePicker id="reorder-date" value={date} onChange={setDate} />
        </FormField>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="جستجو"
              onClick={() => void search()}
              disabled={!date || loading || busy}
            >
              <Search className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>جستجو</TooltipContent>
        </Tooltip>
        <AccountingButton
          permission="finance.journal.create"
          disabled={
            busy || loading || !rows.length || date !== loadedDate || !editable
          }
          onClick={() =>
            void run('reorder-journals', {
              documentDate: loadedDate,
              items: rows.map((row) => ({
                id: row.id,
                expectedVersion: row.version,
              })),
            }).then((result) => {
              if (result) void search();
            })
          }
        >
          <Save className="size-4" />
          ذخیره
        </AccountingButton>
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <fieldset className="border border-border">
        <legend className="px-2 text-sm">تاریخ اسناد {loadedDate}</legend>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  'شماره سند',
                  'تاریخ سند',
                  'وضعیت سند',
                  'شرح',
                  'شماره عطف',
                  'شماره روزانه',
                  'شماره فرعی',
                ].map((title) => (
                  <th key={title} className="border p-2 text-right">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={selected === row.id}
                  tabIndex={0}
                  onClick={() => setSelected(row.id)}
                  onFocus={() => setSelected(row.id)}
                  className={
                    selected === row.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }
                >
                  {[
                    row.number ?? '',
                    row.documentDate ?? '',
                    (
                      {
                        DRAFT: 'موقت',
                        PENDING_APPROVAL: 'در انتظار بررسی',
                        APPROVED: 'بررسی شده',
                        POSTED: 'قطعی',
                        CANCELLED: 'حذف شده',
                      } as Record<string, string>
                    )[row.status],
                    row.description,
                    row.reference ?? '',
                    String(row.attributes.dailyNumber ?? ''),
                    String(row.attributes.auxiliaryNumber ?? ''),
                  ].map((value, i) => (
                    <td key={i} className="border p-2">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="p-5 text-center text-muted-foreground">
            سطری برای نمایش وجود ندارد.
          </p>
        ) : null}
        <div className="flex gap-2 border-t p-2">
          {[
            {
              direction: -1,
              label: 'بالا',
              shortcut: 'Ctrl+Shift+U',
              icon: ArrowUp,
            },
            {
              direction: 1,
              label: 'پایین',
              shortcut: 'Ctrl+Shift+D',
              icon: ArrowDown,
            },
          ].map(({ direction, label, shortcut, icon: Icon }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={label}
                  aria-keyshortcuts={shortcut}
                  disabled={
                    !editable ||
                    index < 0 ||
                    index + direction < 0 ||
                    index + direction >= rows.length
                  }
                  onClick={() => move(direction)}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {label} ({shortcut})
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
