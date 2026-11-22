'use client';
import { AccountingDetailOwnerDialog } from './accounting-detail-owner-dialog';
import {
  allowsManualFinanceCode,
  detailOwnerKind,
  financeCodingProfile,
  financeCodingProfiles,
  financeCodingProfileForValue,
  type AccountingDetailOwnerV1,
  type AccountingDetailOwnerPageV1,
} from '@nora/contracts';
import { accountingApi } from '../api/accounting-api';

import {
  AccountingSetupNotes,
  parseSetupNotes,
} from './accounting-setup-notes';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/modules/customers/public/entry';
import { masterDataApi } from '@/modules/master-data/api/client';
import { useRef, useState } from 'react';
import styles from './accounting-detail-editor.module.css';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { LedgerCompanyDialog } from './ledger-company-dialog';
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
import Link from '@/i18n/link';
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
  sourceConfigurationId:
    row && 'typeId' in row ? (row.sourceConfigurationId ?? '') : '',
  sourceAccountId: row && 'typeId' in row ? (row.sourceAccountId ?? '') : '',
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
  book: AccountingSnapshotV1 | null;
  kind: 'detail-types' | 'details';
  run: PersistedEditorRun;
  busy: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const types = (book?.configurations ?? []).filter(
    (row) => row.kind === 'detail-types',
  );
  const rows: RecordRow[] = kind === 'details' ? (book?.details ?? []) : types;
  const [selected, setSelected] = useState<RecordRow | null>(
    () => rows.find((row) => row.id === params.get('id')) ?? null,
  );
  const [draft, setDraft] = useState(() => initial(selected));
  const [tab, setTab] = useState('main');
  const [codingConflicts, setCodingConflicts] = useState<string[]>([]);
  const [invalidGeneratedCode, setInvalidGeneratedCode] = useState(false);
  const [notes, setNotes] = useState(() =>
    parseSetupNotes(selected?.attributes.notes),
  );
  const isType = kind === 'detail-types';
  const isSystem = isType && selected?.attributes.isSystem === true;
  const fixedDefinition =
    isType && Boolean(financeCodingProfile(selected?.code));
  const missingCodingTypes = financeCodingProfiles.some(
    (profile) => !types.some((row) => row.code === profile.typeCode),
  );
  const close = () =>
    router.push(
      `/finance/accounting/general-ledger/accounts/lists/${kind}${book ? `?bookId=${book.book.id}` : ''}`,
    );
  const [manualCode, setManualCode] = useState(false);
  const [ownerPage, setOwnerPage] = useState(1);
  const [ownerDialog, setOwnerDialog] = useState<string | null>(null);
  const [sourceDialog, setSourceDialog] = useState<
    AccountingDetailOwnerV1 | 'new' | null
  >(null);
  const [newKind, setNewKind] = useState<'person' | 'organization'>('person');
  const focusRef = useRef<HTMLElement>(null);
  const fresh = () => {
    setManualCode(false);
    setInvalidGeneratedCode(false);
    setOwnerPage(1);
    setOwnerDialog(null);
    setSourceDialog(null);
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
  const codingProfile = financeCodingProfile(type?.code);
  const editableCodingProfile =
    !isType &&
    !selected &&
    codingProfile &&
    allowsManualFinanceCode(codingProfile)
      ? codingProfile
      : undefined;
  const codeSuggestion = useQuery({
    queryKey: ['accounting', 'detail-code-suggestion', book?.book.id, type?.id],
    queryFn: () => accountingApi.detailCodeSuggestion(book!.book.id, type!.id),
    enabled: !!book && !!editableCodingProfile,
  });
  const invalidManualFinanceCode =
    !!editableCodingProfile &&
    !!draft.code &&
    financeCodingProfileForValue(draft.code) !== editableCodingProfile;
  const [ownerSearch, setOwnerSearch] = useState('');
  const sourceKind = !isType ? detailOwnerKind(type?.title ?? '') : undefined;
  const customerKind =
    !isType && codingProfile?.prefix === '3'
      ? 'organization'
      : !isType && codingProfile?.prefix === '4'
        ? 'person'
        : undefined;
  const individualCustomer = customerKind === 'person';
  const partyTitle =
    !!customerKind || (!isType && ['شخص', 'شرکت'].includes(type?.title ?? ''));
  const detailRows = (book?.details ?? []).filter(
    (row) => row.typeId === draft.typeId,
  );
  const width = detailWidth(type?.attributes.classificationNumberLength);
  const suggesting =
    !isType &&
    !codingProfile &&
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
  const ownerKind = type?.title === 'شرکت' ? 'organization' : 'person';
  const personEditor =
    (customerKind ?? (ownerDialog === 'new' ? newKind : ownerKind)) ===
    'person';
  const profile = useQuery({
    queryKey: ['ledger-person', book?.book.branchId, ownerDialog],
    queryFn: () => customersApi.ledgerPerson(ownerDialog!, book!.book.branchId),
    enabled:
      !!book &&
      !!ownerDialog &&
      !['choose', 'new'].includes(ownerDialog) &&
      personEditor,
    gcTime: 0,
    retry: false,
  });
  const ownerRecord = useQuery({
    queryKey: [
      'accounting',
      'detail-owner-edit',
      book?.book.branchId,
      ownerDialog,
    ],
    queryFn: () =>
      customersApi.ledgerCompany(ownerDialog!, book!.book.branchId),
    enabled:
      !!book &&
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
      book?.book.branchId,
      type?.id,
      ownerSearch,
      ownerPage,
    ],
    queryFn: () =>
      customersApi.selections('accounting', {
        search: ownerSearch,
        kind: customerKind ?? ownerKind,
        status: 'active',
        role: customerKind ? 'customer' : 'all',
        branchId: book!.book.branchId,
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: ownerPage,
        pageSize: 30,
      }),
    enabled: !!book && partyTitle,
  });
  const sourceOwners = useQuery({
    queryKey: [
      'accounting',
      'detail-owners',
      book?.book.id,
      sourceKind,
      ownerSearch,
      ownerPage,
    ],
    enabled: !!book && !!sourceKind,
    queryFn: () =>
      accountingApi.analytical<AccountingDetailOwnerPageV1>(
        book!.book.id,
        'detail-owners',
        { kind: sourceKind!, search: ownerSearch, page: String(ownerPage) },
      ),
  });
  function adoptSource(row: AccountingDetailOwnerV1) {
    setDraft((old) => ({
      ...old,
      title: row.title,
      sourceConfigurationId: row.configurationId ?? '',
      sourceAccountId: row.accountId ?? '',
      ...(row.currency ? { currency: row.currency } : {}),
    }));
    setSourceDialog(null);
    void sourceOwners.refetch();
  }
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
    if (id === 'new' && !customerKind) {
      setNewKind(ownerKind);
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
      sourceConfigurationId: '',
      sourceAccountId: '',
    }));
  }
  function adoptOwner(
    customer: { id: string; displayName: string },
    kind: 'person' | 'organization',
  ) {
    if (customerKind && customerKind !== kind) return;
    const target = customerKind
      ? type
      : types.find(
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
  const parents = (book?.details ?? []).filter(
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
        readOnly={key === 'code' && !!codingProfile && !editableCodingProfile}
        {...(key === 'code' && editableCodingProfile
          ? {
              placeholder: codeSuggestion.data?.code ?? '',
              'aria-invalid': invalidManualFinanceCode || undefined,
              'aria-describedby': invalidManualFinanceCode
                ? 'detail-code-format-error'
                : undefined,
            }
          : {})}
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
              pattern:
                key === 'code' && codingProfile
                  ? codingProfile.prefix +
                    (editableCodingProfile ? '(?!0000000)' : '') +
                    '[0-9]{7}'
                  : '[0-9]+',
            }
          : {})}
        onBlur={() => {
          if (
            key === 'code' &&
            !codingProfile &&
            manualCode &&
            width &&
            draft.code
          ) {
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
      {isType && book && missingCodingTypes && (
        <AccountingButton
          type="button"
          permission="finance.account.manage"
          disabled={busy}
          onClick={() =>
            void run<{ conflicts: string[] }>(
              'setup-finance-coding-types',
              {},
            ).then((result) => {
              if (result) setCodingConflicts(result.conflicts);
            })
          }
        >
          تعریف نوع‌های تفصیلی ۸ رقمی
        </AccountingButton>
      )}
      {isType && missingCodingTypes && codingConflicts.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          عنوان‌های هم‌نام در این دفتر{' '}
          <strong>{codingConflicts.join('، ')}</strong>
        </p>
      )}
      <AccountingDeleteButtons
        busy={busy || !!isSystem}
        selected={selected}
        entity={isType ? 'configuration' : 'detail'}
        run={run}
        reset={fresh}
        close={close}
      />
      {!isType && (
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="font-bold">حساب تفصیلی</h2>
          <AccountingButton variant="outline" onClick={close}>
            فهرست
          </AccountingButton>
        </div>
      )}
      <form
        data-accounting-inline-form
        className={
          isType
            ? styles.typeForm
            : 'space-y-4 rounded-lg border bg-muted/15 p-4'
        }
        onSubmit={(event) => {
          event.preventDefault();
          if (!book || invalidManualFinanceCode) return;
          setInvalidGeneratedCode(false);
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
              ...(!isType
                ? {
                    code:
                      suggesting ||
                      (codingProfile && !editableCodingProfile && !selected)
                        ? ''
                        : draft.code,
                  }
                : {}),
              ...(isType ? { kind: 'detail-types' } : {}),
              attributes,
              ...(selected ? { id: selected.id } : {}),
            },
            selected?.version,
          ).then((saved) => {
            if (!saved) return;
            setManualCode(false);
            if (
              codingProfile &&
              !selected &&
              financeCodingProfileForValue(saved.code) !== codingProfile
            ) {
              setInvalidGeneratedCode(true);
            }
            setSelected(saved);
            setDraft(initial(saved));
            setNotes(parseSetupNotes(saved.attributes.notes));
            if (after === 'new') fresh();
            if (after === 'close') close();
          });
        }}
      >
        <div
          role="tablist"
          aria-label={isType ? 'اطلاعات نوع تفصیلی' : 'اطلاعات حساب تفصیلی'}
          className={isType ? styles.typeTabs : 'flex gap-4 border-b pb-2'}
        >
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
        <div
          hidden={tab !== 'main'}
          className={`${styles.panel} ${isType ? styles.typePanel : ''}`}
        >
          {isType ? (
            <div className={styles.columns + ' ' + styles.typeColumns}>
              <div>
                {field('title', 'عنوان', true, !!isSystem)}
                {field('titleEn', 'عنوان به زبان دوم', false, !!isSystem)}
                {field(
                  'defaultFirstCode',
                  'اولین کد پیش فرض',
                  false,
                  fixedDefinition,
                )}
              </div>
              <div>
                <FormField label="نوع تفصیلی پدر" id="detail-parentTypeId">
                  <SearchCombobox
                    id="detail-parentTypeId"
                    label="نوع تفصیلی پدر"
                    disabled={fixedDefinition}
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
                  fixedDefinition,
                )}
                <label className={styles.parentControl}>
                  <input
                    type="checkbox"
                    checked={draft.enforceParent}
                    disabled={fixedDefinition}
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
                  disabled={Boolean(selected && codingProfile)}
                  required
                  value={type?.title ?? ''}
                  columns={[
                    'عنوان',
                    'پیش‌فرض',
                    'نوع تفصیلی پدر',
                    'کنترل رابطه پدر فرزندی',
                  ]}
                  rows={types
                    .filter(
                      (row) =>
                        row.active &&
                        (!selected ||
                          codingProfile ||
                          !financeCodingProfile(row.code)),
                    )
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
                {field('code', 'کد', !codingProfile, !type)}
                {codingProfile && invalidGeneratedCode && (
                  <p role="alert" className="text-xs text-destructive">
                    قالب کد تفصیلی دریافتی معتبر نیست.
                  </p>
                )}
                {editableCodingProfile && invalidManualFinanceCode && (
                  <p
                    id="detail-code-format-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    کد تفصیلی باید ۸ رقم، با پیش‌شماره نوع تفصیلی و شماره
                    بزرگ‌تر از صفر باشد.
                  </p>
                )}
                {editableCodingProfile && !draft.code && (
                  <p role="status" className="text-xs text-muted-foreground">
                    {codeSuggestion.isPending
                      ? 'در حال دریافت کد پیشنهادی…'
                      : codeSuggestion.isError
                        ? 'دریافت کد پیشنهادی ناموفق بود.'
                        : codeSuggestion.data?.code
                          ? 'برای دریافت خودکار کد پیشنهادی، این کادر را خالی بگذارید.'
                          : 'بازه کد این نوع تفصیلی تکمیل شده است.'}
                  </p>
                )}
                {codingProfile && !editableCodingProfile && !draft.code && (
                  <p className="text-xs text-muted-foreground">
                    کد پس از ذخیره اختصاص داده می‌شود.
                  </p>
                )}
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
                  {...(sourceKind === 'BANK' ? { wide: 'end' as const } : {})}
                  columns={
                    sourceKind === 'BANK'
                      ? [
                          'نام بانک',
                          'کد بانک',
                          'شماره حساب',
                          'نام شعبه',
                          'کد شعبه',
                          'کد تفصیلی',
                          'نوع ارز',
                          'نوع حساب',
                          'وضعیت',
                          'کد سوئیفت',
                          'شماره حساب پشتیبان',
                          'شماره شبا',
                        ]
                      : sourceKind === 'BRANCH'
                        ? ['عنوان', 'کد', 'نام بنگاه']
                        : sourceKind
                          ? ['عنوان', 'کد', 'وضعیت']
                          : ['نام کامل', 'شماره', 'نوع']
                  }
                  rows={
                    sourceKind
                      ? (sourceOwners.data?.rows ?? [])
                          .filter((row) => row.active)
                          .map((row) => ({
                            id: row.id,
                            cells:
                              sourceKind === 'BANK'
                                ? [
                                    String(
                                      row.attributes.bankName ?? row.title,
                                    ),
                                    String(row.attributes.bankCode ?? ''),
                                    String(
                                      row.attributes.maskedAccountNumber ?? '',
                                    ),
                                    String(row.attributes.bankBranchName ?? ''),
                                    String(row.attributes.bankBranchCode ?? ''),
                                    detailRows.find(
                                      (detail) =>
                                        detail.sourceAccountId === row.id,
                                    )?.code ?? '',
                                    row.currency ?? '',
                                    String(
                                      row.attributes.bankAccountType ?? '',
                                    ),
                                    row.active ? 'فعال' : 'غیرفعال',
                                    String(row.attributes.swiftCode ?? ''),
                                    String(
                                      row.attributes.backupAccountNumber ?? '',
                                    ),
                                    String(row.attributes.maskedIban ?? ''),
                                  ]
                                : [
                                    row.title,
                                    row.code,
                                    sourceKind === 'BRANCH'
                                      ? (book?.book.title ?? '')
                                      : row.active
                                        ? 'فعال'
                                        : 'غیرفعال',
                                  ],
                          }))
                      : partyTitle
                        ? (people.data?.data ?? []).map((row) => ({
                            id: row.id,
                            cells: [
                              row.displayName,
                              row.companyCode ??
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
                  {...(partyTitle || sourceKind
                    ? {
                        onSearch: (value: string) => {
                          setOwnerSearch(value);
                          setOwnerPage(1);
                        },
                      }
                    : { onType: (title: string) => update('title', title) })}
                  onSelect={(id) => {
                    if (sourceKind) {
                      const row = sourceOwners.data?.rows.find(
                        (r) => r.id === id,
                      );
                      if (row) adoptSource(row);
                    } else if (partyTitle) {
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
                  onEdit={
                    sourceKind
                      ? (id) => {
                          const row = sourceOwners.data?.rows.find(
                            (r) => r.id === id,
                          );
                          if (row) setSourceDialog(row);
                        }
                      : partyTitle
                        ? openOwner
                        : editDetail
                  }
                  message={
                    sourceKind
                      ? sourceOwners.isFetching
                        ? 'در حال دریافت…'
                        : sourceOwners.error?.message
                      : partyTitle
                        ? people.isFetching
                          ? 'در حال دریافت…'
                          : people.error?.message
                        : undefined
                  }
                  footer={
                    sourceKind ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSourceDialog('new')}
                        >
                          ＋ ایجاد {type?.title}
                        </button>
                        {ownerPage > 1 && (
                          <button
                            type="button"
                            onClick={() => setOwnerPage((p) => p - 1)}
                          >
                            قبلی
                          </button>
                        )}
                        {sourceOwners.data?.hasNext && (
                          <button
                            type="button"
                            onClick={() => setOwnerPage((p) => p + 1)}
                          >
                            بعدی
                          </button>
                        )}
                      </>
                    ) : (
                      partyTitle && (
                        <>
                          <button
                            type="button"
                            onClick={() => openOwner('new')}
                          >
                            {individualCustomer
                              ? '＋ افزودن مشتری حقیقی'
                              : customerKind === 'organization'
                                ? '＋ افزودن مشتری حقوقی'
                                : '＋ ایجاد ' + type?.title}
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
            book={book ?? undefined}
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
        {!book && (
          <p role="status" className={styles.bookNotice}>
            برای ثبت نوع تفصیلی، ابتدا دفتر حسابداری را تعریف کنید.{' '}
            <Link href="/finance/accounting/general-ledger/base-information/ledgers">
              تعریف دفتر کل
            </Link>
          </p>
        )}
        <AccountingSaveButtons busy={busy || !book} />
      </form>
      {sourceDialog && sourceKind && book && (
        <AccountingDetailOwnerDialog
          key={sourceDialog === 'new' ? 'new' : sourceDialog.id}
          kind={sourceKind}
          book={book}
          initial={sourceDialog === 'new' ? undefined : sourceDialog}
          run={run}
          onSelected={adoptSource}
          onClose={() => {
            setSourceDialog(null);
            void sourceOwners.refetch();
          }}
        />
      )}
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
        book &&
        (ownerDialog === 'new' || profile.data) ? (
        <LedgerPersonDialog
          key={ownerDialog}
          compact={individualCustomer}
          initial={ownerDialog === 'new' ? undefined : profile.data?.data}
          book={book}
          onClose={() => setOwnerDialog(null)}
          onSelected={(row) => adoptOwner(row, 'person')}
        />
      ) : (
        ownerDialog &&
        (book &&
        !personEditor &&
        (ownerDialog === 'new' || ownerRecord.data) ? (
          <LedgerCompanyDialog
            key={ownerDialog}
            initial={ownerDialog === 'new' ? undefined : ownerRecord.data?.data}
            book={book}
            onClose={() => {
              setOwnerDialog(null);
              void people.refetch();
            }}
            onSelected={(row) => adoptOwner(row, 'organization')}
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
