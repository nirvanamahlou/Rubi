'use client';

import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AccountingConfigurationV1,
  AccountingDetailV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  AccountingButton,
  AccountingDeleteButtons,
  AccountingSaveButtons,
  accountingSaveDisposition,
} from './accounting-operations';
import type { PersistedEditorRun } from './accounting-persisted-editor';

type RecordRow = AccountingConfigurationV1 | AccountingDetailV1;
const attr = (row: RecordRow | null, name: string) =>
  String(row?.attributes[name] ?? '');
const initial = (row: RecordRow | null) => ({
  title: row?.title ?? '',
  titleEn: row?.titleEn ?? attr(row, 'titleEn'),
  description: row?.description ?? attr(row, 'description'),
  code: row?.code ?? '',
  active: row?.active ?? true,
  typeId: row && 'typeId' in row ? row.typeId : '',
  parentId: row && 'parentId' in row ? (row.parentId ?? '') : '',
  currency: row && 'currency' in row ? (row.currency ?? '') : '',
  defaultFirstCode: attr(row, 'defaultFirstCode'),
  parentTypeId: attr(row, 'parentTypeId'),
  classificationNumberLength: attr(row, 'classificationNumberLength'),
  classificationNumber: attr(row, 'classificationNumber'),
  enforceParent: row?.attributes.enforceParent === true,
});

export function AccountingDetailEditor({
  book,
  kind,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  kind: 'detail-types' | 'details';
  run: PersistedEditorRun;
  busy: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const types = book.configurations.filter(
    (row) => row.kind === 'detail-types',
  );
  const rows: RecordRow[] = kind === 'details' ? book.details : types;
  const [selected, setSelected] = useState<RecordRow | null>(
    () => rows.find((row) => row.id === params.get('id')) ?? null,
  );
  const [draft, setDraft] = useState(() => initial(selected));
  const [tab, setTab] = useState('main');
  const [notes, setNotes] = useState(() =>
    parseSetupNotes(selected?.attributes.notes),
  );
  const isType = kind === 'detail-types';
  const isSystem = isType && selected?.attributes.isSystem === true;
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/accounts/lists/${kind}?bookId=${book.book.id}`,
    );
  const fresh = () => {
    setSelected(null);
    setDraft(initial(null));
    setNotes([]);
    setTab('main');
  };
  const update = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => setDraft((old) => ({ ...old, [key]: value }));
  const type = types.find((row) => row.id === draft.typeId);
  const permissions = useAccessPermissions() ?? [];
  const [ownerSearch, setOwnerSearch] = useState('');
  const linkedTitle =
    !isType &&
    type?.attributes.isSystem === true &&
    [
      'شخص',
      'شرکت',
      'انبار',
      'پروژه',
      'ماهیت تسویه',
      'مرکز فروش',
      'کانال فروش',
      'بخش',
      'طبقه حساب محصول',
      'طبقه حساب مشتری',
    ].includes(type.title);
  const personTitle =
    linkedTitle && ['شخص', 'شرکت'].includes(type?.title ?? '');
  const people = useQuery({
    queryKey: [
      'accounting',
      'detail-title',
      book.book.branchId,
      type?.title,
      ownerSearch,
    ],
    queryFn: () =>
      customersApi.list({
        search: ownerSearch,
        kind: type?.title === 'شرکت' ? 'organization' : 'person',
        status: 'active',
        role: 'all',
        branchId: book.book.branchId,
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: 1,
        pageSize: 30,
      }),
    enabled: personTitle && permissions.includes('customers.read'),
  });
  const salesChannels = useQuery({
    queryKey: ['accounting', 'detail-sales-channels', ownerSearch],
    queryFn: () =>
      masterDataApi.list('sales-channels', {
        search: ownerSearch,
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 30,
      }),
    enabled:
      linkedTitle &&
      type?.title === 'کانال فروش' &&
      permissions.includes('master_data.read'),
  });
  const ownerOptions = personTitle
    ? (people.data?.data ?? []).map((row) => ({
        value: row.displayName,
        label: row.displayName,
      }))
    : (type?.title === 'کانال فروش'
        ? (salesChannels.data?.data ?? [])
        : []
      ).map((row) => ({
        value: row.name,
        label: row.name,
      }));
  const ownerError = personTitle
    ? permissions.includes('customers.read')
      ? people.error?.message
      : 'دسترسی مشاهده اشخاص و شرکت‌ها لازم است.'
    : type?.title === 'کانال فروش'
      ? permissions.includes('master_data.read')
        ? salesChannels.error?.message
        : 'دسترسی مشاهده اطلاعات پایه لازم است.'
      : 'فهرست موجودیت‌های این نوع تفصیلی هنوز به روبی متصل نشده است.';
  const currencies = useQuery({
    queryKey: ['accounting', 'currencies'],
    queryFn: () =>
      masterDataApi.list('currencies', {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      }),
    enabled: !isType && permissions.includes('master_data.read'),
  });
  const currencyOptions = currencies.data?.data.map((row) => ({
    value: row.code,
    label: row.name,
  })) ?? [
    { value: 'IRR', label: 'ریال' },
    { value: 'IQD', label: 'دینار عراق' },
    { value: 'USD', label: 'دلار' },
  ];
  const parentTypes = types.filter(
    (row) => row.id !== selected?.id && row.active,
  );
  const parents = book.details.filter(
    (row) =>
      row.active &&
      row.id !== selected?.id &&
      (!type?.attributes.parentTypeId ||
        row.typeId === type.attributes.parentTypeId),
  );
  const field = (
    key: keyof typeof draft,
    label: string,
    required = false,
    disabled = false,
  ) => (
    <FormField key={key} label={label} id={`detail-${key}`}>
      <Input
        id={`detail-${key}`}
        required={required}
        disabled={disabled}
        value={String(draft[key])}
        onChange={(e) => update(key, e.target.value)}
      />
    </FormField>
  );
  return (
    <section className="@container space-y-3" dir="rtl">
      <AccountingButton onClick={fresh}>جدید</AccountingButton>
      <AccountingDeleteButtons
        busy={busy || !!isSystem}
        selected={selected}
        entity={isType ? 'configuration' : 'detail'}
        run={run}
        reset={fresh}
        close={close}
      />
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="font-bold">{isType ? 'نوع تفصیلی' : 'حساب تفصیلی'}</h2>
        <AccountingButton variant="outline" onClick={close}>
          فهرست
        </AccountingButton>
      </div>
      <form
        data-accounting-inline-form
        className="space-y-4 rounded-lg border bg-muted/15 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const after = accountingSaveDisposition(event);
          const attributes = {
            ...selected?.attributes,
            notes: JSON.stringify(notes),
            ...(isType
              ? {
                  defaultFirstCode: draft.defaultFirstCode,
                  parentTypeId: draft.parentTypeId,
                  classificationNumberLength: draft.classificationNumberLength,
                  enforceParent: draft.enforceParent,
                }
              : { classificationNumber: draft.classificationNumber }),
          };
          void run<RecordRow>(
            isType ? 'save-configuration' : 'save-detail',
            {
              ...draft,
              ...(isType ? { kind: 'detail-types' } : {}),
              attributes,
              ...(selected ? { id: selected.id } : {}),
            },
            selected?.version,
          ).then((saved) => {
            if (!saved) return;
            setSelected(saved);
            setDraft(initial(saved));
            setNotes(parseSetupNotes(saved.attributes.notes));
            if (after === 'new') fresh();
            if (after === 'close') close();
          });
        }}
      >
        <div role="tablist" className="flex gap-4 border-b pb-2">
          {[
            ['main', 'اطلاعات اصلی'],
            ['notes', 'یادداشت'],
          ].map(([key, title]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'font-semibold text-primary' : ''}
              onClick={() => setTab(key!)}
            >
              {title}
            </button>
          ))}
        </div>
        <div hidden={tab !== 'main'} className="space-y-4">
          {isType ? (
            <div className="grid gap-4 @min-[40rem]:grid-cols-2">
              <div className="space-y-4">
                {field('title', 'عنوان', true, !!isSystem)}
                {field('titleEn', 'عنوان به زبان دوم', false, !!isSystem)}
                {field('defaultFirstCode', 'اولین کد پیش فرض')}
              </div>
              <div className="space-y-4">
                <FormField label="نوع تفصیلی پدر">
                  <SearchCombobox
                    label="نوع تفصیلی پدر"
                    value={draft.parentTypeId}
                    onValueChange={(value) => update('parentTypeId', value)}
                    options={parentTypes.map((row) => ({
                      value: row.id,
                      label: row.title,
                    }))}
                  />
                </FormField>
                {field(
                  'classificationNumberLength',
                  'طول شماره طبقه بندی',
                  true,
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.enforceParent}
                    onChange={(e) => update('enforceParent', e.target.checked)}
                  />
                  کنترل رابطه پدر فرزندی
                </label>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 @min-[40rem]:grid-cols-2">
              <div className="space-y-4">
                <FormField label="نوع تفصیلی">
                  <SearchCombobox
                    label="نوع تفصیلی"
                    value={draft.typeId}
                    onValueChange={(value) => {
                      update('typeId', value);
                      update('parentId', '');
                      update('title', '');
                      setOwnerSearch('');
                    }}
                    options={types
                      .filter((row) => row.active)
                      .map((row) => ({ value: row.id, label: row.title }))}
                  />
                </FormField>
                <FormField label="تفصیلی پدر">
                  <SearchCombobox
                    label="تفصیلی پدر"
                    value={draft.parentId}
                    onValueChange={(value) => update('parentId', value)}
                    options={parents.map((row) => ({
                      value: row.id,
                      label: `${row.code} — ${row.title}`,
                    }))}
                  />
                </FormField>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => update('active', e.target.checked)}
                  />
                  فعال
                </label>
              </div>
              <div className="space-y-4">
                {field('code', 'کد', !type?.attributes.defaultFirstCode)}
                {field('classificationNumber', 'شماره طبقه بندی')}
              </div>
              <div className="space-y-4">
                {linkedTitle ? (
                  <FormField label="عنوان">
                    <SearchCombobox
                      label="عنوان"
                      required
                      value={draft.title}
                      selectedLabel={draft.title}
                      onSearchChange={setOwnerSearch}
                      remote
                      loading={people.isFetching || salesChannels.isFetching}
                      error={ownerError}
                      onValueChange={(value) => update('title', value)}
                      options={ownerOptions}
                    />
                  </FormField>
                ) : (
                  field('title', 'عنوان', true)
                )}
                {field('titleEn', 'عنوان به زبان دوم')}
              </div>
              <FormField label="ارز پیش فرض">
                <SearchCombobox
                  label="ارز پیش فرض"
                  value={draft.currency}
                  onValueChange={(value) => update('currency', value)}
                  options={currencyOptions}
                />
              </FormField>
            </div>
          )}
          <FormField label="توضیحات" id="detail-description">
            <Textarea
              id="detail-description"
              disabled={!!isSystem}
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </FormField>
        </div>
        <div hidden={tab !== 'notes'}>
          <AccountingSetupNotes
            notes={notes}
            onChange={setNotes}
            book={book}
            record={
              selected
                ? {
                    id: selected.id,
                    entityType: isType
                      ? 'AccountingDetailType'
                      : 'AccountingDetail',
                    title: selected.title,
                  }
                : undefined
            }
          />
        </div>
        <AccountingSaveButtons busy={busy} />
      </form>
    </section>
  );
}
