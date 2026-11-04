'use client';

import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useQuery } from '@tanstack/react-query';
import {
  customersApi,
  CustomerDrawer,
  type CustomerTab,
  type CustomerCalendarMode,
} from '@/modules/customers/public/entry';
import { masterDataApi } from '@/modules/master-data/api/client';
import { useRef, useState } from 'react';
import styles from './accounting-detail-editor.module.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { LedgerPersonDialog } from './ledger-person-dialog';
import { DetailPicker } from './accounting-detail-picker';
import {
  detailDigits,
  detailWidth,
  nextDetailCode,
  paddedDetailCode,
} from '@nora/contracts';
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
  customerId: (row && 'typeId' in row ? row.customerId : '') ?? '',
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
  const [manualCode, setManualCode] = useState(false);
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerDialog, setOwnerDialog] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<'person' | 'organization'>('person');
  const [customerTab, setCustomerTab] = useState<CustomerTab>('overview');
  const [calendar, setCalendar] = useState<CustomerCalendarMode>('persian');
  const focusRef = useRef<HTMLElement>(null);
  const fresh = () => {
    setManualCode(false);
    setOwnerPage(1);
    setOwnerDialog(null);
    setOwnerSearch('');
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
  const [ownerSearch, setOwnerSearch] = useState('');
  const personTitle = !isType && ['شخص', 'شرکت'].includes(type?.title ?? '');
  const detailRows = book.details.filter((row) => row.typeId === draft.typeId);
  const width = detailWidth(type?.attributes.classificationNumberLength);
  const suggesting =
    !isType &&
    !manualCode &&
    (!selected || !('typeId' in selected) || selected.typeId !== draft.typeId);
  const suggestedCode =
    width && suggesting
      ? nextDetailCode(
          width,
          String(type?.attributes.defaultFirstCode ?? ''),
          detailRows.map((row) => row.code),
        )
      : null;
  const displayCode = suggesting ? (suggestedCode ?? '') : draft.code;
  const personEditor =
    ownerDialog === 'new' ? newKind === 'person' : type?.title === 'شخص';
  const profile = useQuery({
    queryKey: ['ledger-person', book.book.branchId, ownerDialog],
    queryFn: () => customersApi.ledgerPerson(ownerDialog!, book.book.branchId),
    enabled:
      !!ownerDialog && !['choose', 'new'].includes(ownerDialog) && personEditor,
    gcTime: 0,
    retry: false,
  });
  const ownerRecord = useQuery({
    queryKey: [
      'accounting',
      'detail-owner-edit',
      book.book.branchId,
      ownerDialog,
    ],
    queryFn: () => customersApi.detail(ownerDialog!),
    enabled:
      !!ownerDialog &&
      !['choose', 'new'].includes(ownerDialog) &&
      !personEditor,
    staleTime: 0,
    gcTime: 0,
  });
  const people = useQuery({
    queryKey: [
      'accounting',
      'detail-title',
      book.book.branchId,
      type?.title,
      ownerSearch,
      ownerPage,
    ],
    queryFn: () =>
      customersApi.selections('accounting', {
        search: ownerSearch,
        kind: type?.title === 'شرکت' ? 'organization' : 'person',
        status: 'active',
        role: 'all',
        branchId: book.book.branchId,
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: ownerPage,
        pageSize: 30,
      }),
    enabled: personTitle,
  });
  function editDetail(id: string) {
    const row = detailRows.find((item) => item.id === id);
    if (row) {
      setSelected(row);
      setDraft(initial(row));
      setManualCode(false);
      setNotes(parseSetupNotes(row.attributes.notes));
      setTab('main');
    }
  }
  function openOwner(id: string) {
    setCustomerTab('overview');
    if (id === 'new') {
      setNewKind(type?.title === 'شرکت' ? 'organization' : 'person');
      setOwnerDialog('choose');
    } else setOwnerDialog(id);
  }
  function selectType(typeId: string) {
    if (typeId === draft.typeId) return;
    setManualCode(false);
    setOwnerSearch('');
    setOwnerPage(1);
    setDraft((old) => ({
      ...old,
      typeId,
      parentId: '',
      code:
        selected && 'typeId' in selected && selected.typeId === typeId
          ? selected.code
          : '',
      title: '',
      customerId: '',
    }));
  }
  function adoptOwner(
    customer: { id: string; displayName: string },
    kind: 'person' | 'organization',
  ) {
    const target = types.find(
      (t) => t.active && t.title === (kind === 'person' ? 'شخص' : 'شرکت'),
    );
    if (!target) return;
    if (target.id !== draft.typeId) selectType(target.id);
    setDraft((old) => ({
      ...old,
      title: customer.displayName,
      customerId: customer.id,
    }));
    setOwnerDialog(null);
    void people.refetch();
  }
  const currencies = useQuery({
    queryKey: ['accounting', 'currencies'],
    queryFn: () =>
      masterDataApi.list(
        'currencies',
        {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
        },
        'accounting',
      ),
    enabled: !isType,
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
    <FormField key={key} label={label} required={required} id={`detail-${key}`}>
      <Input
        id={`detail-${key}`}
        required={required}
        disabled={disabled}
        {...(key === 'classificationNumberLength'
          ? {
              inputMode: 'numeric' as const,
              pattern: '([1-9]|1[0-9]|20)',
              maxLength: 2,
            }
          : {})}
        {...(['code', 'defaultFirstCode', 'classificationNumber'].includes(key)
          ? {
              inputMode: 'numeric' as const,
              dir: 'ltr',
              maxLength: 20,
              pattern: '[0-9]+',
            }
          : {})}
        onBlur={() => {
          if (key === 'code' && manualCode && width && draft.code) {
            const padded = paddedDetailCode(draft.code, width);
            if (padded) update('code', padded);
          }
        }}
        value={key === 'code' ? displayCode : String(draft[key])}
        onChange={(e) => {
          if (key === 'code') setManualCode(true);
          update(
            key,
            [
              'code',
              'defaultFirstCode',
              'classificationNumber',
              'classificationNumberLength',
            ].includes(key)
              ? detailDigits(e.target.value)
              : e.target.value,
          );
        }}
      />
    </FormField>
  );
  return (
    <section
      ref={focusRef}
      tabIndex={-1}
      className="@container space-y-3"
      dir="rtl"
    >
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
              ...(!isType ? { code: suggesting ? '' : draft.code } : {}),
              ...(isType ? { kind: 'detail-types' } : {}),
              attributes,
              ...(selected ? { id: selected.id } : {}),
            },
            selected?.version,
          ).then((saved) => {
            if (!saved) return;
            setManualCode(false);
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
        <div hidden={tab !== 'main'} className={styles.panel}>
          {isType ? (
            <div className={styles.columns + ' ' + styles.typeColumns}>
              <div>
                {field('title', 'عنوان', true, !!isSystem)}
                {field('titleEn', 'عنوان به زبان دوم', false, !!isSystem)}
                {field('defaultFirstCode', 'اولین کد پیش فرض')}
              </div>
              <div>
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
            <div className={styles.columns + ' ' + styles.accountColumns}>
              <div>
                <DetailPicker
                  label="نوع تفصیلی"
                  required
                  value={type?.title ?? ''}
                  columns={[
                    'عنوان',
                    'پیش‌فرض',
                    'نوع تفصیلی پدر',
                    'کنترل رابطه پدر فرزندی',
                  ]}
                  rows={types
                    .filter((row) => row.active)
                    .map((row) => ({
                      id: row.id,
                      cells: [
                        row.title,
                        row.attributes.isSystem ? 'بله' : 'خیر',
                        types.find((p) => p.id === row.attributes.parentTypeId)
                          ?.title ?? '—',
                        row.attributes.enforceParent ? 'بله' : 'خیر',
                      ],
                    }))}
                  onSelect={selectType}
                />
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
              <div>
                {field('code', 'کد', true, !type)}
                {suggesting && type && !suggestedCode && (
                  <p role="alert">بازه کد این نوع تفصیلی تکمیل شده است.</p>
                )}
                {field('classificationNumber', 'شماره طبقه بندی')}
              </div>
              <div>
                <DetailPicker
                  key={draft.typeId}
                  label="عنوان"
                  value={draft.title}
                  disabled={!type}
                  required
                  columns={['نام کامل', 'شماره', 'نوع']}
                  rows={
                    personTitle
                      ? (people.data?.data ?? []).map((row) => ({
                          id: row.id,
                          cells: [
                            row.displayName,
                            row.personCode ??
                              detailRows.find((d) => d.customerId === row.id)
                                ?.code ??
                              '—',
                            type!.title,
                          ],
                        }))
                      : detailRows.map((row) => ({
                          id: row.id,
                          cells: [row.title, row.code, type?.title ?? ''],
                        }))
                  }
                  {...(personTitle
                    ? {
                        onSearch: (value: string) => {
                          setOwnerSearch(value);
                          setOwnerPage(1);
                        },
                      }
                    : { onType: (title: string) => update('title', title) })}
                  onSelect={(id) => {
                    if (personTitle) {
                      const row = people.data?.data.find(
                        (item) => item.id === id,
                      );
                      if (row)
                        setDraft((old) => ({
                          ...old,
                          customerId: id,
                          title: row.displayName,
                        }));
                    } else {
                      const row = detailRows.find((item) => item.id === id);
                      if (row) update('title', row.title);
                    }
                  }}
                  onEdit={personTitle ? openOwner : editDetail}
                  message={
                    personTitle
                      ? people.isFetching
                        ? 'در حال دریافت…'
                        : people.error?.message
                      : undefined
                  }
                  footer={
                    personTitle && (
                      <>
                        <button type="button" onClick={() => openOwner('new')}>
                          ＋ ایجاد {type?.title}
                        </button>
                        {ownerPage > 1 && (
                          <button
                            type="button"
                            onClick={() => setOwnerPage((page) => page - 1)}
                          >
                            قبلی
                          </button>
                        )}
                        {people.data?.data.length === 30 && (
                          <button
                            type="button"
                            onClick={() => setOwnerPage((page) => page + 1)}
                          >
                            بعدی
                          </button>
                        )}
                      </>
                    )
                  }
                />
                {field('titleEn', 'عنوان به زبان دوم')}
                <FormField label="ارز پیش فرض">
                  <SearchCombobox
                    label="ارز پیش فرض"
                    value={draft.currency}
                    onValueChange={(value) => update('currency', value)}
                    options={currencyOptions}
                  />
                </FormField>
              </div>
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
      {ownerDialog === 'choose' ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setOwnerDialog(null);
          }}
        >
          <DialogContent
            dir="rtl"
            aria-describedby={undefined}
            className="max-w-sm"
          >
            <DialogTitle>انتخاب شخص یا شرکت</DialogTitle>
            <fieldset className="grid gap-3">
              <legend>مایل به افزودن شخص هستید یا شرکت؟</legend>
              {(['person', 'organization'] as const).map((k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="new-owner-kind"
                    checked={newKind === k}
                    onChange={() => setNewKind(k)}
                  />{' '}
                  {k === 'person' ? 'شخص' : 'شرکت'}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-4">
              <button type="button" onClick={() => setOwnerDialog('new')}>
                تأیید
              </button>
              <button type="button" onClick={() => setOwnerDialog(null)}>
                انصراف
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : ownerDialog &&
        personEditor &&
        (ownerDialog === 'new' || profile.data) ? (
        <LedgerPersonDialog
          key={ownerDialog}
          initial={ownerDialog === 'new' ? undefined : profile.data?.data}
          book={book}
          onClose={() => setOwnerDialog(null)}
          onSelected={(row) => adoptOwner(row, 'person')}
        />
      ) : (
        ownerDialog &&
        (!personEditor && (ownerDialog === 'new' || ownerRecord.data) ? (
          <CustomerDrawer
            key={ownerDialog}
            mode={ownerDialog === 'new' ? 'create' : 'edit'}
            customer={
              ownerDialog === 'new' ? undefined : ownerRecord.data?.data
            }
            fixedKind="organization"
            createBranchId={book.book.branchId}
            activeTab={customerTab}
            onTabChange={setCustomerTab}
            calendarMode={calendar}
            onCalendarModeChange={setCalendar}
            returnFocusRef={focusRef}
            onClose={() => setOwnerDialog(null)}
            onSaved={async (_, row) => adoptOwner(row, 'organization')}
          />
        ) : (
          <div role="status">
            {profile.error?.message ??
              ownerRecord.error?.message ??
              'در حال دریافت…'}{' '}
            <button type="button" onClick={() => setOwnerDialog(null)}>
              بستن
            </button>
          </div>
        ))
      )}
    </section>
  );
}
