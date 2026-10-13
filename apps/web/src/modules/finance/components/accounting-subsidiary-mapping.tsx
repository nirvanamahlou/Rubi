'use client';
import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingSubsidiaryMappingV1,
} from '@nora/contracts';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { accountingApi } from '../api/accounting-api';
import { AccountingButton as Button } from './accounting-operations';
import type { PersistedEditorRun } from './accounting-persisted-editor';
import { Trash2, Plus, ListChecks, ChevronLeft } from 'lucide-react';

type Mapping = Pick<
  AccountingSubsidiaryMappingV1,
  | 'sourceAccountId'
  | 'sourceDetail4Id'
  | 'sourceDetail5Id'
  | 'sourceDetail6Id'
  | 'targetAccountId'
  | 'detail4Id'
  | 'detail5Id'
  | 'detail6Id'
>;
import { mappingKey, mappingChildren } from '../accounting-accounts-model';
export function AccountingSubsidiaryMapping({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  run: PersistedEditorRun;
  busy: boolean;
}) {
  const books = useQuery({
    queryKey: ['accounting', 'books'],
    queryFn: accountingApi.books,
  });
  const others = useQueries({
    queries: (books.data?.books ?? [])
      .filter((row) => row.id !== book.book.id && row.active)
      .map((row) => ({
        queryKey: ['accounting', 'mapping-target', row.id],
        queryFn: () => accountingApi.snapshot(row.id),
      })),
  });
  const targets = others.flatMap((query) => (query.data ? [query.data] : []));
  const [rows, setRows] = useState<Mapping[]>(book.subsidiaryMappings ?? []);
  const [versions, setVersions] = useState(book.subsidiaryMappings ?? []);
  const accounts = book.accounts.filter((row) => row.level === 'SUBSIDIARY');
  const [selected, setSelected] = useState(accounts[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [path, setPath] = useState<string[]>([]);
  const [levelAccount, setLevelAccount] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const level = 4 + path.length;
  const pathAccount = book.accounts.find((row) => row.id === levelAccount);
  const sourceAllowed = pathAccount?.attributes[`detail${level}TypeIds`];
  const sourceSingle = pathAccount?.attributes[`detail${level}TypeId`];
  const detailCandidates = book.details.filter(
    (row) =>
      row.active &&
      (!Array.isArray(sourceAllowed) ||
        !sourceAllowed.length ||
        sourceAllowed.includes(row.typeId)) &&
      (!sourceSingle || sourceSingle === row.typeId),
  );
  const pathRow = (detailId: string): Mapping => ({
    sourceAccountId: levelAccount,
    sourceDetail4Id: path[0] ?? (level === 4 ? detailId : null),
    sourceDetail5Id: path[1] ?? (level === 5 ? detailId : null),
    sourceDetail6Id: level === 6 ? detailId : null,
    targetAccountId: '',
    detail4Id: null,
    detail5Id: null,
    detail6Id: null,
  });
  const addDetails = (ids: string[]) => {
    setRows((old) => [
      ...old,
      ...ids
        .map(pathRow)
        .filter(
          (row) => !old.some((item) => mappingKey(item) === mappingKey(row)),
        ),
    ]);
    setAdding(false);
    setBulk(false);
    setBulkIds([]);
  };
  const drill = () => {
    if (!levelAccount) {
      setLevelAccount(selected);
      setPath([]);
    } else if (selectedPath && level < 6) setPath([...path, selectedPath]);
    setSelectedPath('');
    setAdding(false);
    setBulk(false);
    setSearch('');
  };
  const sources = accounts.filter((row) =>
    `${row.code} ${row.title}`.includes(search),
  );
  const targetAccounts = targets.flatMap((snapshot) =>
    snapshot.accounts
      .filter((row) => row.level === 'SUBSIDIARY' && row.active)
      .map((row) => ({ ...row, bookTitle: snapshot.book.title })),
  );
  const change = (source: Mapping, patch: Partial<Mapping>) =>
    setRows((old) => {
      const key = mappingKey(source),
        prior = old.find((row) => mappingKey(row) === key) ?? source;
      return [
        ...old.filter((row) => mappingKey(row) !== key),
        { ...prior, ...patch },
      ];
    });
  const displaySources = !levelAccount
    ? sources.map((row) => ({
        account: row,
        source: {
          sourceAccountId: row.id,
          targetAccountId: '',
          detail4Id: null,
          detail5Id: null,
          detail6Id: null,
        } as Mapping,
        label: `${row.code} — ${row.title}`,
      }))
    : mappingChildren(rows, levelAccount, path)
        .map((row) => ({
          account: pathAccount!,
          source: {
            ...row,
            targetAccountId: '',
            detail4Id: null,
            detail5Id: null,
            detail6Id: null,
          } as Mapping,
          label: book.details
            .filter(
              (d) =>
                d.id === row[`sourceDetail${level}Id` as 'sourceDetail4Id'],
            )
            .map((d) => `${d.code} — ${d.title}`)
            .join(''),
        }))
        .filter((row) => row.label.includes(search));
  const leading = accounts.find((row) => row.id === (levelAccount || selected)),
    secondary = targetAccounts.find(
      (row) =>
        row.id ===
        rows.find(
          (row) =>
            mappingKey(row) ===
            mappingKey(
              levelAccount
                ? pathRow(selectedPath)
                : { sourceAccountId: selected },
            ),
        )?.targetAccountId,
    );
  return (
    <section className="space-y-3" dir="rtl">
      <h2 className="font-bold">نگاشت حساب</h2>
      <Input
        aria-label="جستجوی معین"
        placeholder="جستجو"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {others.some((query) => query.error) ? (
        <p role="alert" className="text-destructive">
          دریافت اطلاعات دفتر فرعی ناموفق بود.
        </p>
      ) : null}
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run<{ rows: AccountingSubsidiaryMappingV1[] }>(
            'save-subsidiary-mappings',
            {
              rows: rows.filter((row) => row.targetAccountId),
              versions: versions.map((row) => ({
                id: row.id,
                version: row.version,
              })),
            },
          ).then((saved) => {
            if (saved) {
              setRows(saved.rows);
              setVersions(saved.rows);
            }
          });
        }}
      >
        {levelAccount ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setLevelAccount('');
                setPath([]);
              }}
            >
              حساب معین
            </button>
            <ChevronLeft className="size-3" />
            <button type="button" onClick={() => setPath([])}>
              {pathAccount?.code} — {pathAccount?.title}
            </button>
            {path.map((id, index) => (
              <button
                key={id}
                type="button"
                onClick={() => setPath(path.slice(0, index + 1))}
              >
                {' '}
                / {book.details.find((row) => row.id === id)?.title}
              </button>
            ))}
          </div>
        ) : null}
        <div className="max-h-[30rem] overflow-auto rounded border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                {[
                  levelAccount
                    ? `تفصیلی سطح ${level} دفتر کل اصلی`
                    : 'عنوان-کد معین اصلی',
                  'عنوان-کد معین فرعی',
                  'تفصیلی سطح 4 دفتر کل فرعی',
                  'تفصیلی سطح 5 دفتر کل فرعی',
                  'تفصیلی سطح 6 دفتر کل فرعی',
                  '',
                ].map((label, index) => (
                  <th key={index} className="border p-2 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displaySources.map(({ source, account, label }) => {
                const row = rows.find(
                  (item) => mappingKey(item) === mappingKey(source),
                );
                const target = targetAccounts.find(
                  (item) => item.id === row?.targetAccountId,
                );
                const snapshot = targets.find(
                  (item) => item.book.id === target?.bookId,
                );
                return (
                  <tr
                    key={mappingKey(source)}
                    onFocus={() => {
                      setSelected(account.id);
                      setSelectedPath(
                        source[`sourceDetail${level}Id` as 'sourceDetail4Id'] ??
                          '',
                      );
                    }}
                    onClick={() => {
                      setSelected(account.id);
                      setSelectedPath(
                        source[`sourceDetail${level}Id` as 'sourceDetail4Id'] ??
                          '',
                      );
                    }}
                    className={
                      selected === account.id &&
                      (!levelAccount ||
                        selectedPath ===
                          source[`sourceDetail${level}Id` as 'sourceDetail4Id'])
                        ? 'bg-primary/5'
                        : ''
                    }
                  >
                    <td className="border p-2">{label}</td>
                    <td className="min-w-64 border p-1">
                      <SearchCombobox
                        label={`معین فرعی ${label}`}
                        value={row?.targetAccountId ?? ''}
                        onValueChange={(value) =>
                          change(source, {
                            targetAccountId: value,
                            detail4Id: null,
                            detail5Id: null,
                            detail6Id: null,
                          })
                        }
                        options={targetAccounts.map((item) => ({
                          value: item.id,
                          label: `${item.code} — ${item.title} (${item.bookTitle})`,
                        }))}
                      />
                    </td>
                    {([4, 5, 6] as const).map((level) => {
                      const key = `detail${level}Id` as const;
                      const allowed =
                        target?.attributes[`detail${level}TypeIds`];
                      const single = target?.attributes[`detail${level}TypeId`];
                      return (
                        <td key={level} className="min-w-44 border p-1">
                          <SearchCombobox
                            label={`تفصیلی سطح ${level} برای ${label}`}
                            disabled={!target}
                            value={row?.[key] ?? ''}
                            onValueChange={(value) =>
                              change(source, { [key]: value || null })
                            }
                            options={(snapshot?.details ?? [])
                              .filter(
                                (item) =>
                                  item.active &&
                                  (!Array.isArray(allowed) ||
                                    !allowed.length ||
                                    allowed.includes(item.typeId)) &&
                                  (!single || single === item.typeId),
                              )
                              .map((item) => ({
                                value: item.id,
                                label: `${item.code} — ${item.title}`,
                              }))}
                          />
                        </td>
                      );
                    })}
                    <td className="border p-1">
                      <Button
                        variant="ghost"
                        type="button"
                        aria-label={`حذف نگاشت ${label}`}
                        title="حذف نگاشت"
                        disabled={!row}
                        onClick={() =>
                          setRows((old) =>
                            old.filter(
                              (item) => mappingKey(item) !== mappingKey(source),
                            ),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          {levelAccount ? (
            <>
              <Button
                type="button"
                aria-label="افزودن نگاشت"
                title="افزودن نگاشت"
                variant="outline"
                onClick={() => setAdding(!adding)}
              >
                <Plus className="size-4" />
              </Button>
              <Button
                type="button"
                aria-label="انتخاب دسته ای"
                title="انتخاب دسته ای"
                variant="outline"
                onClick={() => setBulk(!bulk)}
              >
                <ListChecks className="size-4" />
              </Button>
            </>
          ) : null}
          {!levelAccount || level < 6 ? (
            <Button
              type="button"
              variant="outline"
              disabled={levelAccount ? !selectedPath : !selected}
              onClick={drill}
            >{`تفصیلی سطح ${levelAccount ? level + 1 : 4}`}</Button>
          ) : null}
        </div>
        {adding ? (
          <SearchCombobox
            label={`تفصیلی سطح ${level} دفتر کل اصلی`}
            value=""
            onValueChange={(id) => {
              if (id) addDetails([id]);
            }}
            options={detailCandidates.map((row) => ({
              value: row.id,
              label: `${row.code} — ${row.title}`,
            }))}
          />
        ) : null}
        {bulk ? (
          <fieldset className="border rounded p-3 space-y-2">
            <legend>انتخاب دسته ای</legend>
            <div className="max-h-48 overflow-auto">
              {detailCandidates.map((row) => (
                <label className="flex gap-2" key={row.id}>
                  <input
                    type="checkbox"
                    checked={bulkIds.includes(row.id)}
                    onChange={(e) =>
                      setBulkIds((old) =>
                        e.target.checked
                          ? [...old, row.id]
                          : old.filter((id) => id !== row.id),
                      )
                    }
                  />
                  {row.code} — {row.title}
                </label>
              ))}
            </div>
            <Button type="button" onClick={() => addDetails(bulkIds)}>
              اضافه
            </Button>
          </fieldset>
        ) : null}
        <fieldset className="space-y-3 rounded border p-3">
          <legend>اطلاعات حساب</legend>
          {[
            { title: 'دفترکل اصلی', row: leading },
            { title: 'دفتر کل فرعی', row: secondary },
          ].map((item) => (
            <fieldset
              key={item.title}
              className="flex flex-wrap items-center gap-5 rounded border bg-muted/20 p-3"
            >
              <legend>{item.title}</legend>
              <FormField label={`معین ${item.title}`}>
                <Input
                  aria-label={`معین ${item.title}`}
                  readOnly
                  value={item.row ? `${item.row.code} — ${item.row.title}` : ''}
                />
              </FormField>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  disabled
                  checked={item.row?.attributes.multiCurrency === true}
                />
                ویژگی ارزی
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  disabled
                  checked={item.row?.attributes.traceable === true}
                />
                ویژگی پیگیری
              </label>
            </fieldset>
          ))}
        </fieldset>
        <Button
          type="submit"
          disabled={
            busy || others.some((query) => query.isPending || query.error)
          }
        >
          ذخیره
        </Button>
      </form>
    </section>
  );
}
