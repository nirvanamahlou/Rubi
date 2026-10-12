'use client';

import { useRef, useState, type ReactNode } from 'react';
import type { AccountingLineV1, AccountingSnapshotV1 } from '@nora/contracts';
import {
  Plus,
  Trash2,
  Search,
  ArrowUp,
  ArrowDown,
  Copy,
  Scissors,
  ClipboardPaste,
  Undo2,
  Redo2,
  ArrowLeftRight,
  Languages,
  ListEnd,
  BookPlus,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/overlays';
import { journalDisplayTotals } from '../accounting-money';
import { descriptionRows } from '../accounting-chart-form';
import { AccountingJournalFigures } from './accounting-journal-figures';
import { AccountingDocumentStatement } from './accounting-document-statement';
import {
  copyJournalRows,
  journalRowIndices,
  pasteJournalRows,
  removeJournalRows,
} from '../accounting-journal-row-selection';

export const emptyJournalLine = (): AccountingLineV1 => ({
  accountId: null,
  detail4Id: null,
  detail5Id: null,
  detail6Id: null,
  description: '',
  debit: '0',
  credit: '0',
  currency: null,
  foreignAmount: null,
  rate: null,
  fxSnapshotId: null,
  attributes: {},
});
const cloneRows = (rows: AccountingLineV1[]) => structuredClone(rows);
function RowAction({
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={label}
          aria-keyshortcuts={shortcut}
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
export function AccountingJournalLines({
  book,
  rows,
  onChange,
  readonly,
  periodId,
  onAddDefaultDescription,
  journalId,
  canWriteStatement = false,
  canExport = false,
}: {
  book: AccountingSnapshotV1;
  rows: AccountingLineV1[];
  onChange: (rows: AccountingLineV1[]) => void;
  readonly: boolean;
  periodId?: string | undefined;
  onAddDefaultDescription?: ((row: AccountingLineV1) => void) | undefined;
  journalId?: string | undefined;
  canWriteStatement?: boolean;
  canExport?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [multiple, setMultiple] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [targetVisible, setTargetVisible] = useState(false);
  const [target, setTarget] = useState('');
  const [revision, setRevision] = useState(0);
  const history = useRef<{
    past: AccountingLineV1[][];
    future: AccountingLineV1[][];
  }>({ past: [], future: [] });
  const [clipboard, setClipboard] = useState<AccountingLineV1[]>([]);
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });
  const selectedRow = rows[selected];
  const change = (next: AccountingLineV1[]) => {
    if (readonly) return;
    history.current.past.push(cloneRows(rows));
    if (history.current.past.length > 100) history.current.past.shift();
    history.current.future = [];
    setHistoryDepth({ past: history.current.past.length, future: 0 });
    onChange(next);
    setSelectedRows([]);
    setRevision((value) => value + 1);
  };
  const undo = (redo = false) => {
    const from = redo ? history.current.future : history.current.past;
    const to = redo ? history.current.past : history.current.future;
    const next = from.pop();
    if (!next || readonly) return;
    to.push(cloneRows(rows));
    setHistoryDepth({
      past: history.current.past.length,
      future: history.current.future.length,
    });
    onChange(next);
    setSelectedRows([]);
    setRevision((value) => value + 1);
  };
  const update = (index: number, data: Partial<AccountingLineV1>) =>
    change(rows.map((row, n) => (n === index ? { ...row, ...data } : row)));
  const copyPrevious = () => {
    const previous = rows[selected - 1];
    if (readonly || !selectedRow || !previous) return;
    update(selected, {
      accountId: previous.accountId,
      description: previous.description,
      debit: previous.debit,
      credit: previous.credit,
      attributes: {
        ...selectedRow.attributes,
        descriptionEn: previous.attributes.descriptionEn ?? '',
      },
    });
  };
  const move = (to: number) => {
    if (!selectedRow || to < 0 || to >= rows.length || to === selected) return;
    const next = [...rows];
    next.splice(selected, 1);
    next.splice(to, 0, selectedRow);
    change(next);
    setSelected(to);
  };
  const copy = (cut = false) => {
    if (!selectedRow) return;
    if (cut && readonly) return;
    setClipboard(copyJournalRows(rows, selectedRows, selected));
    if (cut) {
      change(removeJournalRows(rows, selectedRows, selected));
      setSelected(Math.max(0, selected - 1));
    }
    setRevision((value) => value + 1);
  };
  const paste = () => {
    if (!clipboard.length || readonly) return;
    const pasted = pasteJournalRows(rows, clipboard, selected);
    change(pasted.rows);
    setSelectedRows(pasted.indices);
    setSelected(pasted.indices[0] ?? selected);
  };
  const add = () => {
    const position = rows.length;
    change([...rows, emptyJournalLine()]);
    setSelected(position);
  };
  const remove = () => {
    change(removeJournalRows(rows, selectedRows, selected));
    setSelected(Math.max(0, selected - 1));
  };
  const reverse = () => {
    const indices = new Set(
      journalRowIndices(rows.length, selectedRows, selected),
    );
    change(
      rows.map((row, index) =>
        indices.has(index)
          ? { ...row, debit: row.credit, credit: row.debit }
          : row,
      ),
    );
  };
  const account = book.accounts.find(
    (item) => item.id === selectedRow?.accountId,
  );
  const general = book.accounts.find((item) => item.id === account?.parentId);
  const group = book.accounts.find((item) => item.id === general?.parentId);
  const totals = journalDisplayTotals(rows);
  const td = 'border border-border p-1 align-top';
  const query = search.trim().toLocaleLowerCase();
  const summary = [
    ['گروه حساب', group?.title ?? ''],
    ['حساب کل', general?.title ?? ''],
    ['حساب معین', account?.title ?? ''],
    ...([4, 5, 6] as const).map((level) => [
      `عنوان سطح ${level}`,
      book.details.find((item) => item.id === selectedRow?.[`detail${level}Id`])
        ?.title ?? '',
    ]),
  ];
  return (
    <section
      className="space-y-2"
      data-revision={revision}
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (
          event.altKey &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          key === 'm'
        ) {
          event.preventDefault();
          setMultiple((value) => !value);
          setSelectedRows([]);
          return;
        }
        if (
          event.altKey &&
          event.shiftKey &&
          key === 'q' &&
          !readonly &&
          selectedRow?.accountId &&
          selectedRow.description.trim() &&
          onAddDefaultDescription
        ) {
          event.preventDefault();
          onAddDefaultDescription(selectedRow);
          return;
        }
        if (event.altKey && key === 'c') {
          event.preventDefault();
          setCurrencyVisible((value) => !value);
          return;
        }
        if (event.altKey && key === 'g' && !readonly && selectedRow) {
          event.preventDefault();
          setTargetVisible((value) => !value);
          return;
        }
        if (event.ctrlKey && !event.shiftKey && key === 'f') {
          event.preventDefault();
          setSearchVisible((value) => !value);
          return;
        }
        if (event.ctrlKey && event.shiftKey && key === 'y') {
          if (!readonly && selected > 0 && selectedRow) {
            event.preventDefault();
            copyPrevious();
          }
          return;
        }
        if (
          event.target instanceof HTMLElement &&
          event.target.closest('input, textarea, [role="combobox"]')
        )
          return;
        if (event.ctrlKey && event.shiftKey && key === 'c') {
          event.preventDefault();
          copy();
          return;
        }
        if (readonly) return;
        if (key === 'insert') {
          event.preventDefault();
          add();
        } else if (key === 'delete' && selectedRow) {
          event.preventDefault();
          remove();
        } else if (
          event.ctrlKey &&
          event.shiftKey &&
          ['c', 'x', 'v', 'u', 'd', 'z', 'r', 'l'].includes(key)
        ) {
          event.preventDefault();
          if (key === 'c') copy();
          if (key === 'x') copy(true);
          if (key === 'v') paste();
          if (key === 'u') move(selected - 1);
          if (key === 'd') move(selected + 1);
          if (key === 'z') undo();
          if (key === 'r') undo(true);
          if (key === 'l' && selectedRow) reverse();
        }
      }}
    >
      <div
        className="flex flex-wrap justify-end gap-1"
        role="toolbar"
        aria-label="عملیات ردیف سند"
      >
        <RowAction
          label="انتخاب چند ردیف"
          shortcut="Alt+M"
          onClick={() => {
            setMultiple((value) => !value);
            setSelectedRows([]);
          }}
        >
          <ListChecks className="size-4" />
        </RowAction>
        <AccountingJournalFigures
          book={book}
          row={selectedRow}
          periodId={periodId}
        />
        <AccountingDocumentStatement
          book={book}
          journalId={journalId}
          lineIds={journalRowIndices(
            rows.length,
            selectedRows,
            selected,
          ).flatMap((index) => (rows[index]?.id ? [rows[index]!.id!] : []))}
          canWrite={canWriteStatement}
          canExport={canExport}
        />
        <RowAction
          label="کپی اطلاعات ردیف قبلی"
          shortcut="Ctrl+Shift+Y"
          disabled={readonly || selected < 1 || !selectedRow}
          onClick={copyPrevious}
        >
          <Copy className="h-4 w-4" />
        </RowAction>
        <RowAction
          label="نمایش فیلدهای ارزی"
          shortcut="Alt+C"
          onClick={() => setCurrencyVisible((value) => !value)}
        >
          <Languages className="size-4" />
        </RowAction>
        <RowAction
          label="جستجو"
          shortcut="Ctrl+F"
          onClick={() => setSearchVisible((value) => !value)}
        >
          <Search className="size-4" />
        </RowAction>
        <RowAction
          label="افزودن"
          shortcut="Insert"
          disabled={readonly}
          onClick={add}
        >
          <Plus className="size-4" />
        </RowAction>
        <RowAction
          label="افزودن شرح به شرح‌های پیش‌فرض معین"
          shortcut="Alt+Shift+Q"
          disabled={
            readonly ||
            !onAddDefaultDescription ||
            !selectedRow?.accountId ||
            !selectedRow.description.trim()
          }
          onClick={() => {
            if (selectedRow) onAddDefaultDescription?.(selectedRow);
          }}
        >
          <BookPlus className="size-4" />
        </RowAction>
        <RowAction
          label="حذف"
          shortcut="Delete"
          disabled={readonly || !selectedRow}
          onClick={remove}
        >
          <Trash2 className="size-4" />
        </RowAction>
        <RowAction
          label="جابجایی بدهکار و بستانکار"
          shortcut="Ctrl+Shift+L"
          disabled={readonly || !selectedRow}
          onClick={reverse}
        >
          <ArrowLeftRight className="size-4" />
        </RowAction>
        <RowAction
          label="کپی"
          shortcut="Ctrl+Shift+C"
          disabled={!selectedRow}
          onClick={() => copy()}
        >
          <Copy className="size-4" />
        </RowAction>
        <RowAction
          label="بریدن"
          shortcut="Ctrl+Shift+X"
          disabled={readonly || !selectedRow}
          onClick={() => copy(true)}
        >
          <Scissors className="size-4" />
        </RowAction>
        <RowAction
          label="درج"
          shortcut="Ctrl+Shift+V"
          disabled={readonly || !clipboard.length}
          onClick={paste}
        >
          <ClipboardPaste className="size-4" />
        </RowAction>
        <RowAction
          label="بالا"
          shortcut="Ctrl+Shift+U"
          disabled={readonly || selected <= 0}
          onClick={() => move(selected - 1)}
        >
          <ArrowUp className="size-4" />
        </RowAction>
        <RowAction
          label="پایین"
          shortcut="Ctrl+Shift+D"
          disabled={readonly || selected >= rows.length - 1}
          onClick={() => move(selected + 1)}
        >
          <ArrowDown className="size-4" />
        </RowAction>
        <RowAction
          label="انتقال به ردیف مورد نظر"
          shortcut="Alt+G"
          disabled={readonly || !selectedRow}
          onClick={() => setTargetVisible((value) => !value)}
        >
          <ListEnd className="size-4" />
        </RowAction>
        <RowAction
          label="لغو تغییرات"
          shortcut="Ctrl+Shift+Z"
          disabled={readonly || !historyDepth.past}
          onClick={() => undo()}
        >
          <Undo2 className="size-4" />
        </RowAction>
        <RowAction
          label="اعمال مجدد تغییرات"
          shortcut="Ctrl+Shift+R"
          disabled={readonly || !historyDepth.future}
          onClick={() => undo(true)}
        >
          <Redo2 className="size-4" />
        </RowAction>
      </div>
      {searchVisible ? (
        <Input
          aria-label="جستجوی ردیف"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      {targetVisible ? (
        <div className="flex gap-2">
          <Input
            aria-label="ردیف مقصد"
            inputMode="numeric"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              const to = Number(target) - 1;
              if (Number.isSafeInteger(to) && to >= 0 && to < rows.length) {
                move(to);
                setTargetVisible(false);
              }
            }}
          >
            انتقال
          </Button>
        </div>
      ) : null}
      <div className="overflow-auto rounded border border-border">
        <table className="w-full min-w-[90rem] text-xs">
          <thead className="bg-muted">
            <tr>
              {multiple ? (
                <th className="border border-border p-2">
                  <span className="sr-only">انتخاب ردیف</span>
                </th>
              ) : null}
              {[
                'وضعیت مالیاتی',
                'ردیف',
                'کد حساب معین',
                'سطح 4',
                'سطح 5',
                'سطح 6',
                'شرح',
                'بدهکار',
                'بستانکار',
                ...(currencyVisible ? ['ارز', 'نرخ ارز', 'مبلغ ارز'] : []),
                'شماره پیگیری',
                'تاریخ پیگیری',
                'شرح به زبان دوم',
              ].map((title) => (
                <th
                  className="border border-border p-2 text-right font-semibold"
                  key={title}
                >
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const chosen = book.accounts.find(
                (item) => item.id === row.accountId,
              );
              const rowText = [
                chosen?.code,
                chosen?.title,
                row.description,
                row.attributes.trackingNumber,
                row.debit,
                row.credit,
              ]
                .join(' ')
                .toLocaleLowerCase();
              if (query && !rowText.includes(query)) return null;
              return (
                <tr
                  key={index}
                  aria-selected={
                    selectedRows.length
                      ? selectedRows.includes(index)
                      : index === selected
                  }
                  tabIndex={0}
                  onFocus={() => setSelected(index)}
                  onClick={() => setSelected(index)}
                  className={
                    selectedRows.includes(index) || index === selected
                      ? 'bg-primary/10'
                      : 'even:bg-muted/20'
                  }
                >
                  {multiple ? (
                    <td className={td}>
                      <input
                        type="checkbox"
                        aria-label={`انتخاب ردیف ${index + 1}`}
                        checked={selectedRows.includes(index)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() =>
                          setSelectedRows((current) =>
                            current.includes(index)
                              ? current.filter((item) => item !== index)
                              : [...current, index],
                          )
                        }
                      />
                    </td>
                  ) : null}
                  <td className={td}>
                    {String(row.attributes.taxStatus ?? '')}
                  </td>
                  <td className={td}>{index + 1}</td>
                  <td className={td}>
                    <SearchCombobox
                      label={`حساب معین ردیف ${index + 1}`}
                      disabled={readonly}
                      value={row.accountId ?? ''}
                      options={book.accounts
                        .filter(
                          (item) => item.active && item.level === 'SUBSIDIARY',
                        )
                        .map((item) => ({
                          value: item.id,
                          label: `${item.code} — ${item.title}`,
                        }))}
                      onValueChange={(value) =>
                        update(index, {
                          accountId: value || null,
                          detail4Id: null,
                          detail5Id: null,
                          detail6Id: null,
                        })
                      }
                    />
                  </td>
                  {([4, 5, 6] as const).map((level) => {
                    const allowed = chosen?.attributes[`detail${level}TypeIds`];
                    const typeIds = Array.isArray(allowed)
                      ? allowed
                      : chosen?.attributes[`detail${level}TypeId`]
                        ? [String(chosen.attributes[`detail${level}TypeId`])]
                        : [];
                    return (
                      <td key={level} className={td}>
                        <SearchCombobox
                          label={`سطح ${level} ردیف ${index + 1}`}
                          disabled={readonly || !typeIds.length}
                          value={row[`detail${level}Id`] ?? ''}
                          options={book.details
                            .filter(
                              (item) =>
                                item.active && typeIds.includes(item.typeId),
                            )
                            .map((item) => ({
                              value: item.id,
                              label: `${item.code} — ${item.title}`,
                            }))}
                          onValueChange={(value) =>
                            update(index, {
                              [`detail${level}Id`]: value || null,
                            })
                          }
                        />
                      </td>
                    );
                  })}
                  <td className={td}>
                    <Input
                      aria-label={`شرح ردیف ${index + 1}`}
                      disabled={readonly}
                      value={row.description}
                      onChange={(event) =>
                        update(index, { description: event.target.value })
                      }
                    />
                    {chosen && descriptionRows(chosen.attributes).length ? (
                      <select
                        className="mt-1 h-8 w-full rounded border bg-background text-xs"
                        aria-label={`شرح پیش فرض ردیف ${index + 1}`}
                        disabled={readonly}
                        value=""
                        onChange={(event) => {
                          const item = descriptionRows(chosen.attributes)[
                            Number(event.target.value)
                          ];
                          if (item)
                            update(index, {
                              description: item.text,
                              attributes: {
                                ...row.attributes,
                                descriptionEn: item.textEn,
                              },
                            });
                        }}
                      >
                        <option value="" disabled>
                          شرح پیش فرض
                        </option>
                        {descriptionRows(chosen.attributes).map(
                          (item, position) => (
                            <option key={position} value={position}>
                              {item.text}
                            </option>
                          ),
                        )}
                      </select>
                    ) : null}
                  </td>
                  {(['debit', 'credit'] as const).map((key) => (
                    <td className={td} key={key}>
                      <Input
                        aria-label={`${key === 'debit' ? 'بدهکار' : 'بستانکار'} ردیف ${index + 1}`}
                        disabled={readonly}
                        inputMode="decimal"
                        dir="ltr"
                        value={row[key]}
                        onChange={(event) =>
                          update(index, { [key]: event.target.value })
                        }
                      />
                    </td>
                  ))}
                  {currencyVisible ? (
                    <>
                      <td className={td}>
                        <SearchCombobox
                          label={`ارز ردیف ${index + 1}`}
                          disabled={readonly}
                          value={row.currency ?? ''}
                          options={[
                            ...new Set(
                              book.fxRates.map((rate) => rate.currency),
                            ),
                          ].map((currency) => ({
                            value: currency,
                            label: currency,
                          }))}
                          onValueChange={(value) =>
                            update(index, {
                              currency: value || null,
                              rate: null,
                              fxSnapshotId: null,
                            })
                          }
                        />
                      </td>
                      <td className={td}>
                        <SearchCombobox
                          label={`نرخ ارز ردیف ${index + 1}`}
                          disabled={readonly || !row.currency}
                          value={row.fxSnapshotId ?? ''}
                          options={book.fxRates
                            .filter(
                              (rate) =>
                                rate.status === 'APPROVED' &&
                                rate.currency === row.currency,
                            )
                            .map((rate) => ({
                              value: rate.id,
                              label: rate.rate,
                            }))}
                          onValueChange={(value) => {
                            const rate = book.fxRates.find(
                              (item) => item.id === value,
                            );
                            update(index, {
                              fxSnapshotId: value || null,
                              rate: rate?.rate ?? null,
                            });
                          }}
                        />
                      </td>
                      <td className={td}>
                        <Input
                          aria-label={`مبلغ ارز ردیف ${index + 1}`}
                          disabled={readonly}
                          inputMode="decimal"
                          dir="ltr"
                          value={row.foreignAmount ?? ''}
                          onChange={(event) =>
                            update(index, {
                              foreignAmount: event.target.value || null,
                            })
                          }
                        />
                      </td>
                    </>
                  ) : null}
                  <td className={td}>
                    <Input
                      aria-label={`شماره پیگیری ردیف ${index + 1}`}
                      disabled={readonly || !chosen?.attributes.traceable}
                      value={String(row.attributes.trackingNumber ?? '')}
                      onChange={(event) =>
                        update(index, {
                          attributes: {
                            ...row.attributes,
                            trackingNumber: event.target.value,
                          },
                        })
                      }
                    />
                  </td>
                  <td className={td}>
                    <DatePicker
                      aria-label={`تاریخ پیگیری ردیف ${index + 1}`}
                      disabled={readonly || !chosen?.attributes.traceable}
                      value={String(row.attributes.trackingDate ?? '')}
                      onChange={(value) =>
                        update(index, {
                          attributes: {
                            ...row.attributes,
                            trackingDate: value,
                          },
                        })
                      }
                    />
                  </td>
                  <td className={td}>
                    <Input
                      aria-label={`شرح به زبان دوم ردیف ${index + 1}`}
                      disabled={readonly}
                      value={String(row.attributes.descriptionEn ?? '')}
                      onChange={(event) =>
                        update(index, {
                          attributes: {
                            ...row.attributes,
                            descriptionEn: event.target.value,
                          },
                        })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-5 text-center text-muted-foreground">
            سطری برای نمایش وجود ندارد.
          </p>
        ) : null}
      </div>
      <fieldset className="border border-border p-3">
        <legend className="px-2 font-semibold">خلاصه</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {summary.map(([title, value]) => (
            <label key={title} className="text-xs">
              {title}
              <Input aria-label={title} readOnly value={value} />
            </label>
          ))}
        </div>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr>
              <th />
              <th>بدهکار</th>
              <th>بستانکار</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>مجموع</th>
              <td dir="ltr">{totals.debit}</td>
              <td dir="ltr">{totals.credit}</td>
            </tr>
            <tr>
              <th>مانده</th>
              <td dir="ltr">
                {totals.valid && !totals.difference.startsWith('-')
                  ? totals.difference
                  : '0'}
              </td>
              <td dir="ltr">
                {totals.valid && totals.difference.startsWith('-')
                  ? totals.difference.slice(1)
                  : '0'}
              </td>
            </tr>
          </tbody>
        </table>
        {!totals.valid ? <p role="alert">مبالغ ردیف‌ها معتبر نیستند.</p> : null}
      </fieldset>
    </section>
  );
}
