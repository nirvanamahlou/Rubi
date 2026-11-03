'use client';

import { useState } from 'react';
import { accountingApi } from '../api/accounting-api';
import type {
  AccountingConfigurationV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import {
  Copy,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  Pencil,
  Unlink,
  RefreshCw,
} from 'lucide-react';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  AccountingButton,
  AccountingDeleteButtons,
  AccountingSaveButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import { DocumentIconAction } from './accounting-document-filter';
import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import type { PersistedEditorRun } from './accounting-persisted-editor';

type Entity = {
  id: string;
  title: string;
  titleEn: string;
  systemEntity: string;
  detailReference: string;
};
type Extra = { id: string; title: string; value: string; description: string };
const systemEntities = [
  'گروه حساب',
  'شخص',
  'شرکت',
  'شعبه',
  'مرکز هزینه',
  'پروژه',
  'منبع تامین اعتبار',
  'دوره مالی',
  'کد',
  'طبقه خدمت',
  'حساب بانکی',
  'صندوق',
  'تنخواه',
  'تسهیلات مالی',
  'سفارشات',
  'قرارداد خرید',
  'مرکز نگهداری',
  'انبار',
  'طبقه',
  'کالا',
  'قرارداد فروش',
  'طبقه حساب مشتری',
  'طبقه حساب محصول',
  'بخش',
  'کانال فروش',
  'مرکز فروش',
  'ماهیت تسویه',
  'کانتر فروش',
  'حساب کل',
  'حساب معین',
];
function parseRows<T>(value: unknown): T[] {
  try {
    const rows: unknown = JSON.parse(String(value ?? '[]'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
const initial = (row: AccountingConfigurationV1 | null) => ({
  title: row?.title ?? '',
  titleEn: row?.titleEn ?? '',
  protocolVersion: String(row?.attributes.protocolVersion ?? ''),
  entities: parseRows<Entity>(row?.attributes.entities),
  extraFields: parseRows<Extra>(row?.attributes.extraFields),
});

/** The two source grids are editable metadata. No synthetic standard codes are
 * inserted: the observed source code tree is empty in the available standards. */
export function AccountingCodingStandard({
  book,
  busy,
  run,
  refresh,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: PersistedEditorRun;
  refresh: () => Promise<void>;
}) {
  const records = book.configurations.filter(
    (row) => row.kind === 'coding-standards',
  );
  const [selected, setSelected] = useState<AccountingConfigurationV1 | null>(
    null,
  );
  const [draft, setDraft] = useState(() => initial(null));
  const [notes, setNotes] = useState(() => parseSetupNotes(undefined));
  const [tab, setTab] = useState('main');
  const [subtab, setSubtab] = useState('entities');
  const [opening, setOpening] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const [reloading, setReloading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState('');
  const readonly = busy || reloading || selected?.attributes.isSystem === true;
  const adopt = (row: AccountingConfigurationV1 | null) => {
    setSelected(row);
    setDraft(initial(row));
    setNotes(parseSetupNotes(row?.attributes.notes));
    setSelectedRow('');
    setSearch('');
    setSearching(false);
    setOpening(false);
    setTab('main');
    setSubtab('entities');
  };
  const reset = () => adopt(null);
  const update = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => setDraft((old) => ({ ...old, [key]: value }));
  const save = async (after: 'stay' | 'new' | 'close') => {
    if (readonly) return;
    const result = await run<AccountingConfigurationV1>(
      'save-configuration',
      {
        ...(selected ? { id: selected.id } : {}),
        kind: 'coding-standards',
        title: draft.title,
        titleEn: draft.titleEn,
        attributes: {
          protocolVersion: draft.protocolVersion,
          entities: JSON.stringify(draft.entities),
          extraFields: JSON.stringify(draft.extraFields),
          notes: JSON.stringify(notes),
        },
      },
      selected?.version,
    );
    if (result) {
      adopt(after === 'stay' ? result : null);
      if (after === 'close') setOpening(true);
    }
  };
  const add = () => {
    const id = crypto.randomUUID();
    if (subtab === 'entities')
      update('entities', [
        ...draft.entities,
        {
          id,
          title: '',
          titleEn: '',
          systemEntity: '',
          detailReference: 'STANDARD',
        },
      ]);
    else
      update('extraFields', [
        ...draft.extraFields,
        { id, title: '', value: '', description: '' },
      ]);
    setSelectedRow(id);
    setSearch('');
  };
  const patchEntity = (id: string, key: keyof Entity, value: string) =>
    update(
      'entities',
      draft.entities.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      ),
    );
  const patchExtra = (id: string, key: keyof Extra, value: string) =>
    update(
      'extraFields',
      draft.extraFields.map((row) =>
        row.id === id ? { ...row, [key]: value } : row,
      ),
    );
  return (
    <form
      data-coding-standard-form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save(accountingSaveDisposition(event));
      }}
    >
      <div className="flex justify-end gap-1">
        <AccountingButton type="button" disabled={busy} onClick={reset}>
          جدید
        </AccountingButton>
        <DocumentIconAction
          label="باز کردن"
          shortcut="Alt+Shift+O"
          onClick={() => setOpening(!opening)}
        >
          <FolderOpen className="size-4" />
        </DocumentIconAction>
        <AccountingSaveButtons busy={!!readonly} />
        <AccountingDeleteButtons
          busy={busy}
          selected={selected?.attributes.isSystem ? null : selected}
          entity="configuration"
          run={run}
          reset={reset}
          close={() => setOpening(true)}
        />
        <AccountingButton
          type="button"
          disabled={busy || reloading}
          onClick={() => {
            setReloadError('');
            setReloading(true);
            void accountingApi
              .snapshot(book.book.id)
              .then(async (fresh) => {
                adopt(
                  selected
                    ? (fresh.configurations.find((r) => r.id === selected.id) ??
                        null)
                    : null,
                );
                await refresh();
              })
              .catch((error: unknown) =>
                setReloadError(
                  error instanceof Error
                    ? error.message
                    : 'بارگذاری ناموفق بود.',
                ),
              )
              .finally(() => setReloading(false));
          }}
        >
          بارگذاری مجدد
        </AccountingButton>
        <DocumentIconAction
          label="عملیات کپی"
          shortcut="Alt+Shift+C"
          disabled={busy || !selected}
          onClick={() => {
            setSelected(null);
            setDraft((old) => ({
              ...old,
              entities: old.entities.map((r) => ({
                ...r,
                id: crypto.randomUUID(),
              })),
              extraFields: old.extraFields.map((r) => ({
                ...r,
                id: crypto.randomUUID(),
              })),
            }));
            setNotes([]);
          }}
        >
          <Copy className="size-4" />
        </DocumentIconAction>
      </div>
      {reloadError && <p role="alert">{reloadError}</p>}
      {opening && (
        <SearchCombobox
          label="باز کردن کدینگ استاندارد"
          value={selected?.id ?? ''}
          options={records.map((r) => ({
            value: r.id,
            label: `${r.title} — ${r.attributes.protocolVersion ?? ''}`,
          }))}
          onValueChange={(id) =>
            adopt(records.find((r) => r.id === id) ?? null)
          }
        />
      )}
      <div
        role="tablist"
        aria-label="کدینگ استاندارد"
        className="flex gap-4 border-b"
      >
        {[
          ['main', 'اطلاعات اصلی'],
          ['notes', 'یادداشت'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            type="button"
            className="border-b-2 px-2 py-1 aria-selected:border-primary"
            onClick={() => setTab(id!)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'notes' ? (
        <AccountingSetupNotes notes={notes} onChange={setNotes} book={book} />
      ) : (
        <>
          <div
            role="tablist"
            aria-label="جزئیات کدینگ استاندارد"
            className="flex gap-3 border-b"
          >
            {[
              ['entities', 'کدینگ استاندارد'],
              ['extraFields', 'فیلدهای تکمیلی کدینگ استاندارد'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={subtab === id}
                type="button"
                className="border px-2 py-1 aria-selected:bg-muted"
                onClick={() => {
                  setSubtab(id!);
                  setSelectedRow('');
                  setSearch('');
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {subtab === 'entities' && (
            <div
              data-coding-standard-header
              className="grid gap-2 border bg-muted/20 p-2 sm:grid-cols-2"
            >
              <FormField
                id="coding-standard-title"
                label="عنوان کدینگ استاندارد"
                required
              >
                <Input
                  required
                  maxLength={160}
                  disabled={readonly}
                  id="coding-standard-title"
                  value={draft.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </FormField>
              <FormField
                id="coding-standard-title-en"
                label="عنوان لاتین کدینگ استاندارد"
              >
                <Input
                  maxLength={160}
                  disabled={readonly}
                  id="coding-standard-title-en"
                  value={draft.titleEn}
                  onChange={(e) => update('titleEn', e.target.value)}
                />
              </FormField>
              <FormField id="coding-standard-protocol" label="نسخه پروتکل">
                <Input
                  maxLength={80}
                  disabled={readonly}
                  id="coding-standard-protocol"
                  value={draft.protocolVersion}
                  onChange={(e) => update('protocolVersion', e.target.value)}
                />
              </FormField>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  disabled
                  checked={selected?.attributes.isSystem === true}
                  readOnly
                />
                استاندارد پیش فرض
              </label>
            </div>
          )}
          <div
            className={
              subtab === 'entities' ? 'grid gap-3 lg:grid-cols-[5fr_3fr]' : ''
            }
          >
            <fieldset
              className="min-w-0 border p-1"
              data-document-shortcut-scope
            >
              <legend className="px-1 text-xs">
                {subtab === 'entities'
                  ? 'موجودیت استاندارد'
                  : 'فیلدهای تکمیلی کدینگ استاندارد'}
              </legend>
              {searching && (
                <Input
                  aria-label="جستجوی ردیف‌ها"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              <div className="min-h-80 overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="bg-blue-50">
                    <tr>
                      {(subtab === 'entities'
                        ? [
                            'شماره قلم',
                            'عنوان موجودیت استاندارد',
                            'عنوان لاتین موجودیت استاندارد',
                            'موجودیت سیستمی',
                            'مرجع جزئیات',
                          ]
                        : ['شماره قلم', 'عنوان فیلد', 'مقدار فیلد', 'شرح فیلد']
                      ).map((label) => (
                        <th
                          key={label}
                          className="border p-1 text-start font-normal"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subtab === 'entities'
                      ? draft.entities.map((row, index) =>
                          !search ||
                          `${row.title} ${row.titleEn} ${row.systemEntity}`.includes(
                            search,
                          ) ? (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedRow(row.id)}
                              className={
                                selectedRow === row.id ? 'bg-blue-50' : ''
                              }
                            >
                              <td className="border p-1">{index + 1}</td>
                              {(['title', 'titleEn'] as const).map((key) => (
                                <td className="border" key={key}>
                                  <Input
                                    aria-label={`${key === 'title' ? 'عنوان موجودیت استاندارد' : 'عنوان لاتین موجودیت استاندارد'} ${index + 1}`}
                                    required={key === 'title'}
                                    maxLength={160}
                                    disabled={readonly}
                                    value={row[key]}
                                    onChange={(e) =>
                                      patchEntity(row.id, key, e.target.value)
                                    }
                                  />
                                </td>
                              ))}
                              <td className="border">
                                <select
                                  aria-label={`موجودیت سیستمی ${index + 1}`}
                                  className="w-full border bg-transparent"
                                  disabled={readonly}
                                  value={row.systemEntity}
                                  onChange={(e) =>
                                    patchEntity(
                                      row.id,
                                      'systemEntity',
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value=""></option>
                                  {systemEntities.map((name) => (
                                    <option key={name}>{name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="border">
                                <select
                                  aria-label={`مرجع جزئیات ${index + 1}`}
                                  className="w-full border bg-transparent"
                                  disabled={readonly}
                                  value={row.detailReference}
                                  onChange={(e) =>
                                    patchEntity(
                                      row.id,
                                      'detailReference',
                                      e.target.value,
                                    )
                                  }
                                >
                                  <option value="SYSTEM">موجودیت سیستمی</option>
                                  <option value="STANDARD">
                                    موجودیت استاندارد
                                  </option>
                                </select>
                              </td>
                            </tr>
                          ) : null,
                        )
                      : draft.extraFields.map((row, index) =>
                          !search ||
                          `${row.title} ${row.value} ${row.description}`.includes(
                            search,
                          ) ? (
                            <tr
                              key={row.id}
                              onClick={() => setSelectedRow(row.id)}
                              className={
                                selectedRow === row.id ? 'bg-blue-50' : ''
                              }
                            >
                              <td className="border p-1">{index + 1}</td>
                              {(['title', 'value', 'description'] as const).map(
                                (key) => (
                                  <td key={key} className="border">
                                    <Input
                                      aria-label={`${key === 'title' ? 'عنوان فیلد' : key === 'value' ? 'مقدار فیلد' : 'شرح فیلد'} ${index + 1}`}
                                      required={key === 'title'}
                                      maxLength={key === 'title' ? 160 : 500}
                                      disabled={readonly}
                                      value={row[key]}
                                      onChange={(e) =>
                                        patchExtra(row.id, key, e.target.value)
                                      }
                                    />
                                  </td>
                                ),
                              )}
                            </tr>
                          ) : null,
                        )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-1 border-t pt-1">
                <DocumentIconAction
                  label="افزودن"
                  shortcut="Insert"
                  disabled={
                    !!readonly ||
                    (subtab === 'entities' ? draft.entities : draft.extraFields)
                      .length >= 100
                  }
                  onClick={add}
                >
                  <Plus className="size-3" />
                </DocumentIconAction>
                <DocumentIconAction
                  label="حذف ردیف"
                  shortcut="Delete"
                  disabled={!!readonly || !selectedRow}
                  onClick={() => {
                    if (subtab === 'entities')
                      update(
                        'entities',
                        draft.entities.filter((r) => r.id !== selectedRow),
                      );
                    else
                      update(
                        'extraFields',
                        draft.extraFields.filter((r) => r.id !== selectedRow),
                      );
                    setSelectedRow('');
                  }}
                >
                  <Trash2 className="size-3" />
                </DocumentIconAction>
                <DocumentIconAction
                  label="جستجو"
                  shortcut="Ctrl+F"
                  onClick={() => setSearching(!searching)}
                >
                  <Search className="size-3" />
                </DocumentIconAction>
              </div>
            </fieldset>
            {subtab === 'entities' && (
              <fieldset className="min-h-80 border p-1">
                <legend className="px-1 text-xs">کدهای استاندارد</legend>
                <div
                  role="tree"
                  aria-label="کدهای استاندارد"
                  className="min-h-80"
                />
                <div
                  className="flex justify-end gap-1 border-t pt-1"
                  data-document-shortcut-scope
                >
                  <DocumentIconAction
                    label="جدید — کد استاندارد"
                    shortcut="Alt+Shift+I"
                    disabled={busy}
                    onClick={() =>
                      setReloadError('ابتدا یک نود را انتخاب کنید.')
                    }
                  >
                    <Plus className="size-3" />
                  </DocumentIconAction>
                  <DocumentIconAction
                    label="ویرایش کد استاندارد"
                    shortcut="Alt+Shift+J"
                    disabled
                    onClick={() => {}}
                  >
                    <Pencil className="size-3" />
                  </DocumentIconAction>
                  <DocumentIconAction
                    label="حذف کد استاندارد"
                    shortcut="Alt+Shift+K"
                    disabled
                    onClick={() => {}}
                  >
                    <Trash2 className="size-3" />
                  </DocumentIconAction>
                  <DocumentIconAction
                    label="حذف نگاشت‌ها"
                    shortcut="Alt+Shift+U"
                    disabled
                    onClick={() => {}}
                  >
                    <Unlink className="size-3" />
                  </DocumentIconAction>
                  <DocumentIconAction
                    label="بارگذاری مجدد کدهای استاندارد"
                    shortcut="Alt+Shift+L"
                    disabled={busy}
                    onClick={() =>
                      void refresh().catch((error: unknown) =>
                        setReloadError(
                          error instanceof Error
                            ? error.message
                            : 'بارگذاری ناموفق بود.',
                        ),
                      )
                    }
                  >
                    <RefreshCw className="size-3" />
                  </DocumentIconAction>
                </div>
              </fieldset>
            )}
          </div>
        </>
      )}
    </form>
  );
}
