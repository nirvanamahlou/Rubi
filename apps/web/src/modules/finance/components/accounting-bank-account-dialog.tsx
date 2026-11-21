'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  bankInstitutionKinds,
  hasAccessControl,
  type AccountingDetailOwnerPageV1,
  type AccountingDetailOwnerV1,
  type AccountingSnapshotV1,
  type CompanyBankAccountV1,
  type MasterDataListQuery,
  type MasterDataRecord,
  type TreasuryBankProfileInputV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { accountingApi } from '../api/accounting-api';
import { bankAccountsApi } from '../api/bank-accounts-api';
import { DetailPicker } from './accounting-detail-picker';
import {
  BankBranchDialog,
  BankInstitutionDialog,
} from './accounting-bank-reference-dialogs';
import type { PersistedEditorRun } from './accounting-persisted-editor';

type Props = {
  book: AccountingSnapshotV1;
  initial?: AccountingDetailOwnerV1 | undefined;
  run: PersistedEditorRun;
  onSelected: (row: AccountingDetailOwnerV1) => void;
  onClose: () => void;
};

const list = (search = '', page = 1): MasterDataListQuery => ({
  search,
  status: 'active',
  sortBy: 'name',
  sortDirection: 'asc',
  page,
  pageSize: 30,
});
const bankAttr = (row: MasterDataRecord | undefined, name: string) =>
  String(row?.attributes[name] ?? '');
const noProfile: TreasuryBankProfileInputV1 = {
  creditLimit: null,
  reserveBalance: null,
  materiality: null,
  automaticTransfer: false,
  transferMethodId: null,
  backupAccountId: null,
  description: '',
  descriptionEn: '',
  notes: '',
  signerIds: [],
};

function asBankDetailOwner(row: CompanyBankAccountV1): AccountingDetailOwnerV1 {
  return {
    id: row.id,
    kind: 'BANK',
    code: row.accountingCode ?? '',
    title: row.title,
    titleEn: '',
    active: row.isActive,
    version: row.version,
    currency: row.currencyCode,
    configurationId: null,
    accountId: row.id,
    bankId: row.bankId,
    attributes: {},
  };
}

export function AccountingBankAccountDialog(props: Props) {
  const [existing, setExisting] = useState(props.initial);
  const record = useQuery({
    queryKey: [
      'accounting',
      'bank-detail-private',
      props.book.book.id,
      existing?.bankId,
      existing?.id,
    ],
    enabled: Boolean(existing?.bankId),
    queryFn: () => bankAccountsApi.details(existing!.bankId!, existing!.id),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[90vh] max-w-6xl overflow-auto"
      >
        <DialogTitle>
          {existing ? 'ویرایش حساب بانکی' : 'تعریف حساب بانکی'}
        </DialogTitle>
        {existing && !record.data ? (
          <p role={record.error ? 'alert' : 'status'}>
            {record.error?.message ?? 'در حال دریافت حساب بانکی…'}
          </p>
        ) : (
          <BankAccountFields
            {...props}
            initial={existing}
            current={record.data}
            onPickExisting={(row) => setExisting(asBankDetailOwner(row))}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BankAccountFields({
  book,
  initial,
  run,
  onSelected,
  onClose,
  current,
  onPickExisting,
}: Props & {
  current: CompanyBankAccountV1 | undefined;
  onPickExisting: (row: CompanyBankAccountV1) => void;
}) {
  const ledger = book.book;
  const permissions = useAccessPermissions() ?? [];
  const canManage = permissions.includes('finance.account.manage');
  const canCreateReference = (id: 'banks' | 'bank-branches') =>
    permissions.includes('master_data.create') &&
    hasAccessControl(permissions, 'master-data.resource.' + id);
  const client = useQueryClient();
  const busy = useRef(false);
  const requestId = useRef('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [nested, setNested] = useState<'bank' | 'branch' | 'type' | null>(null);
  const [bankId, setBankId] = useState(current?.bankId ?? '');
  const [bankChoice, setBankChoice] = useState<MasterDataRecord>();
  const [branchId, setBranchId] = useState(
    current?.treasury?.bankBranchId ?? '',
  );
  const [newBranch, setNewBranch] = useState<MasterDataRecord>();
  const [bankSearch, setBankSearch] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const [existingPage, setExistingPage] = useState(1);
  const [showExisting, setShowExisting] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [backupSearch, setBackupSearch] = useState('');
  const [signerSearch, setSignerSearch] = useState('');
  const [methodSearch, setMethodSearch] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeTitle, setTypeTitle] = useState('');
  const [addedType, setAddedType] = useState<{ id: string; title: string }>();
  const [signers, setSigners] = useState(current?.bankProfile?.signers ?? []);
  const [draft, setDraft] = useState({
    title: current?.title ?? '',
    currencyCode: current?.currencyCode ?? 'IRR',
    accountNumber: current?.accountNumber ?? '',
    cardNumber: current?.cardNumber ?? '',
    iban: current?.iban ?? '',
    isActive: current?.isActive ?? true,
    type: current?.treasury?.bankAccountTypeId ?? '',
  });
  const [profile, setProfile] = useState<TreasuryBankProfileInputV1>(() => {
    if (!current?.bankProfile) return noProfile;
    const { signers: existingSigners, ...stored } = current.bankProfile;
    return { ...stored, signerIds: existingSigners.map((person) => person.id) };
  });
  const bankList = useQuery({
    queryKey: ['accounting', 'bank-title-bank-list', bankSearch, bankPage],
    queryFn: () => masterDataApi.list('banks', list(bankSearch, bankPage)),
  });
  const selectedBank = useQuery({
    queryKey: ['accounting', 'bank-title-bank-record', bankId],
    queryFn: () => masterDataApi.detail('banks', bankId),
    enabled: !!bankId && bankChoice?.id !== bankId,
  });
  const bank = bankChoice?.id === bankId ? bankChoice : selectedBank.data?.data;
  const options = useQuery({
    queryKey: ['accounting', 'bank-title-currencies', bankId],
    enabled: !!bankId,
    queryFn: () => bankAccountsApi.options(bankId),
  });
  const existingAccounts = useQuery({
    queryKey: [
      'accounting',
      'bank-title-existing-accounts',
      bankId,
      ledger.id,
      existingPage,
    ],
    enabled: !!bankId && showExisting && !current,
    queryFn: () =>
      bankAccountsApi.list(bankId, existingPage, ledger.branchId, ledger.id),
  });
  const branches = useQuery({
    queryKey: ['accounting', 'bank-title-branches', bankId, branchSearch],
    enabled: !!bankId,
    queryFn: () =>
      masterDataApi.list('bank-branches', { ...list(branchSearch), bankId }),
  });
  const selectedBranch = useQuery({
    queryKey: ['accounting', 'bank-title-branch-record', branchId],
    enabled: !!branchId && newBranch?.id !== branchId,
    queryFn: () => masterDataApi.detail('bank-branches', branchId),
  });
  const branch =
    newBranch?.id === branchId
      ? newBranch
      : (selectedBranch.data?.data ??
        branches.data?.data.find((row) => row.id === branchId));
  const cityId = bankAttr(branch, 'cityId');
  const city = useQuery({
    queryKey: ['accounting', 'bank-title-branch-city', cityId],
    enabled: !!cityId && !bankAttr(branch, 'cityName'),
    queryFn: () => masterDataApi.detail('cities', cityId, 'accounting'),
  });
  const backups = useQuery({
    queryKey: ['accounting', 'bank-title-backups', ledger.id, backupSearch],
    queryFn: () =>
      accountingApi.analytical<AccountingDetailOwnerPageV1>(
        ledger.id,
        'detail-owners',
        { kind: 'BANK', search: backupSearch },
      ),
  });
  const backupChoice = useQuery({
    queryKey: [
      'accounting',
      'bank-title-backup-label',
      ledger.id,
      profile.backupAccountId,
    ],
    enabled: !!profile.backupAccountId,
    queryFn: () =>
      accountingApi.analytical<AccountingDetailOwnerPageV1>(
        ledger.id,
        'detail-owners',
        { kind: 'BANK', id: profile.backupAccountId! },
      ),
  });
  const signersQuery = useQuery({
    queryKey: [
      'accounting',
      'bank-title-signers',
      ledger.branchId,
      signerSearch,
    ],
    enabled: !!signerSearch.trim(),
    queryFn: () =>
      customersApi.selections('accounting', {
        search: signerSearch,
        kind: 'person',
        status: 'active',
        role: 'all',
        branchId: ledger.branchId,
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: 1,
        pageSize: 30,
      }),
  });
  const methods = useQuery({
    queryKey: ['accounting', 'bank-title-methods', methodSearch],
    queryFn: () => masterDataApi.list('payment-methods', list(methodSearch)),
    enabled: profile.automaticTransfer,
  });

  const chooseBank = (row: MasterDataRecord) => {
    if (row.id !== bankId) {
      setBranchId('');
      setExistingPage(1);
      setShowExisting(false);
    }
    setBankId(row.id);
    setBankChoice(row);
    setNested(null);
  };
  const set = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => setDraft((old) => ({ ...old, [key]: value }));
  const typeRows = book.configurations.filter(
    (row) =>
      row.kind === 'bank-account-types' &&
      (row.active || row.id === draft.type),
  );
  const visibleTypes =
    addedType && !typeRows.some(({ id }) => id === addedType.id)
      ? [...typeRows, addedType]
      : typeRows;

  async function save() {
    if (busy.current || !canManage) return;
    setError('');
    if (
      !bankId ||
      !branchId ||
      !draft.type ||
      !draft.currencyCode ||
      !draft.accountNumber.trim() ||
      !draft.title.trim()
    ) {
      setTab('main');
      setError('بانک، شعبه، عنوان، شماره حساب، ارز و نوع حساب را وارد کنید.');
      return;
    }
    if (
      profile.automaticTransfer &&
      (!profile.backupAccountId || !profile.transferMethodId)
    ) {
      setTab('main');
      setError('برای انتقال خودکار، حساب پشتیبان و روش انتقال را انتخاب کنید.');
      return;
    }
    if (!options.data?.canManage) return;
    if (!requestId.current) requestId.current = crypto.randomUUID();
    busy.current = true;
    setSaving(true);
    const { type, ...values } = draft;
    const payload = {
      ...values,
      branchId: ledger.branchId,
      treasury: {
        treasuryBookId: ledger.id,
        bankBranchId: branchId,
        bankAccountTypeId: type,
      },
      bankProfile: { ...profile, signerIds: signers.map(({ id }) => id) },
    };
    try {
      const saved = current
        ? await bankAccountsApi.update(bankId, current.id, {
            ...payload,
            expectedVersion: current.version,
          })
        : await bankAccountsApi.create(bankId, {
            ...payload,
            requestId: requestId.current,
          });
      if (!saved.isActive) {
        onClose();
        return;
      }
      onSelected(asBankDetailOwner(saved));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره حساب بانکی ناموفق بود.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const amount = (
    key: 'creditLimit' | 'reserveBalance' | 'materiality',
    label: string,
  ) => (
    <FormField id={'bank-account-' + key} label={label}>
      <Input
        id={'bank-account-' + key}
        inputMode="decimal"
        maxLength={25}
        value={profile[key] ?? ''}
        onChange={(e) =>
          setProfile((old) => ({ ...old, [key]: e.target.value || null }))
        }
      />
    </FormField>
  );
  const field = (
    key: 'title' | 'accountNumber' | 'iban' | 'cardNumber',
    label: string,
    required = false,
  ) => (
    <FormField id={'bank-account-' + key} label={label} required={required}>
      <Input
        id={'bank-account-' + key}
        dir={key === 'title' ? 'auto' : 'ltr'}
        value={draft[key]}
        required={required}
        maxLength={key === 'title' ? 160 : 40}
        onChange={(e) => set(key, e.target.value)}
      />
    </FormField>
  );
  return (
    <>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex gap-2 border-b pb-2">
          <Button
            type="button"
            variant={tab === 'main' ? 'primary' : 'outline'}
            onClick={() => setTab('main')}
          >
            اطلاعات اصلی
          </Button>
          <Button
            type="button"
            variant={tab === 'notes' ? 'primary' : 'outline'}
            onClick={() => setTab('notes')}
          >
            یادداشت
          </Button>
        </div>
        {tab === 'main' ? (
          <fieldset className="space-y-3" disabled={saving || !canManage}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-3">
                <DetailPicker
                  label="نام بانک"
                  required
                  value={
                    bank?.name ?? String(initial?.attributes.bankName ?? '')
                  }
                  disabled={Boolean(current)}
                  wide="start"
                  columns={[
                    'نام',
                    'نام به زبان دوم',
                    'نوع بانک',
                    'کد سوئیفت',
                    'کد بانک',
                    'تلفن روابط عمومی',
                    'وب‌سایت',
                  ]}
                  rows={(bankList.data?.data ?? []).map((row) => ({
                    id: row.id,
                    cells: [
                      row.name,
                      bankAttr(row, 'englishName'),
                      bankInstitutionKinds.find(
                        ({ value }) =>
                          value ===
                          (bankAttr(row, 'institutionKind') || 'BANK'),
                      )?.label ?? '',
                      bankAttr(row, 'swiftCode'),
                      row.code,
                      bankAttr(row, 'publicRelationsPhone'),
                      bankAttr(row, 'website'),
                    ],
                  }))}
                  onSearch={(search) => {
                    setBankSearch(search);
                    setBankPage(1);
                  }}
                  onSelect={(id) => {
                    const selected = bankList.data?.data.find(
                      (row) => row.id === id,
                    );
                    if (selected) chooseBank(selected);
                  }}
                  message={bankList.error?.message}
                  footer={
                    <>
                      {canCreateReference('banks') && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setNested('bank')}
                        >
                          <Plus className="size-4" />
                          افزودن بانک
                        </Button>
                      )}
                      {bankPage > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setBankPage((page) => page - 1)}
                        >
                          قبلی
                        </Button>
                      )}
                      {bankList.data &&
                        bankPage * 30 < bankList.data.meta.total && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setBankPage((page) => page + 1)}
                          >
                            بعدی
                          </Button>
                        )}
                    </>
                  }
                />
                <DetailPicker
                  label="شعبه بانک"
                  required
                  disabled={!bankId}
                  value={
                    branch?.name ??
                    String(initial?.attributes.bankBranchName ?? '')
                  }
                  columns={['نام شعبه', 'کد شعبه']}
                  rows={(branches.data?.data ?? []).map((row) => ({
                    id: row.id,
                    cells: [row.name, row.code],
                  }))}
                  onSearch={setBranchSearch}
                  onSelect={setBranchId}
                  message={branches.error?.message}
                  footer={
                    bank && canCreateReference('bank-branches') ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNested('branch')}
                      >
                        <Plus className="size-4" />
                        افزودن شعبه بانک
                      </Button>
                    ) : undefined
                  }
                />
                <FormField id="bank-account-branch-code" label="کد شعبه">
                  <Input
                    id="bank-account-branch-code"
                    value={branch?.code ?? ''}
                    readOnly
                  />
                </FormField>
                <FormField id="bank-account-branch-city" label="شهر شعبه">
                  <Input
                    id="bank-account-branch-city"
                    value={
                      bankAttr(branch, 'cityName') || city.data?.data.name || ''
                    }
                    readOnly
                  />
                </FormField>
                {field('title', 'عنوان حساب', true)}
              </div>
              <div className="space-y-3">
                {field('accountNumber', 'شماره حساب', true)}
                <FormField id="bank-account-currency" label="نوع ارز" required>
                  <select
                    id="bank-account-currency"
                    className="w-full rounded-md border bg-background p-2"
                    required
                    disabled={Boolean(current)}
                    value={draft.currencyCode}
                    onChange={(e) => set('currencyCode', e.target.value)}
                  >
                    <option value="">انتخاب کنید</option>
                    {(
                      options.data?.currencies ?? [
                        { code: 'IRR', name: 'ریال' },
                      ]
                    ).map(({ code, name }) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id="bank-account-kind" label="نوع حساب" required>
                  <div className="flex gap-2">
                    <select
                      id="bank-account-kind"
                      className="min-w-0 flex-1 rounded-md border bg-background p-2"
                      required
                      value={draft.type}
                      onChange={(e) => set('type', e.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {visibleTypes.map(({ id, title }) => (
                        <option key={id} value={id}>
                          {title}
                        </option>
                      ))}
                    </select>
                    {canManage && (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="تعریف نوع حساب بانکی"
                        onClick={() => setNested('type')}
                      >
                        <Plus className="size-4" />
                      </Button>
                    )}
                  </div>
                </FormField>
                {amount('reserveBalance', 'موجودی ذخیره')}
                {amount('materiality', 'مبلغ اهمیت')}
              </div>
              <div className="space-y-3">
                {amount('creditLimit', 'اعتبار حساب')}
                {field('iban', 'شبا')}
                <FormField id="bank-account-backup" label="حساب پشتیبان">
                  <SearchCombobox
                    id="bank-account-backup"
                    value={profile.backupAccountId ?? ''}
                    remote
                    onSearchChange={setBackupSearch}
                    selectedLabel={backupChoice.data?.rows[0]?.title}
                    options={(backups.data?.rows ?? [])
                      .filter(
                        (row) =>
                          row.active &&
                          row.id !== current?.id &&
                          row.currency === draft.currencyCode,
                      )
                      .map(({ id, title }) => ({ value: id, label: title }))}
                    onValueChange={(id) =>
                      setProfile((old) => ({
                        ...old,
                        backupAccountId: id || null,
                      }))
                    }
                    footer={
                      profile.backupAccountId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setProfile((old) => ({
                              ...old,
                              backupAccountId: null,
                            }))
                          }
                        >
                          پاک کردن انتخاب
                        </Button>
                      ) : undefined
                    }
                    error={backups.error?.message}
                  />
                </FormField>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={profile.automaticTransfer}
                    onChange={(e) =>
                      setProfile((old) => ({
                        ...old,
                        automaticTransfer: e.target.checked,
                      }))
                    }
                  />
                  انتقال خودکار
                </label>
                {profile.automaticTransfer && (
                  <p className="text-xs text-muted-foreground">
                    این گزینه تنظیمات حساب را ثبت می‌کند.
                  </p>
                )}
                <FormField
                  id="bank-account-transfer-method"
                  label="روش انتقال"
                  required={profile.automaticTransfer}
                >
                  <SearchCombobox
                    id="bank-account-transfer-method"
                    value={profile.transferMethodId ?? ''}
                    remote
                    onSearchChange={setMethodSearch}
                    disabled={!profile.automaticTransfer}
                    options={(methods.data?.data ?? [])
                      .filter((row) => row.attributes.direction !== 'RECEIPT')
                      .map(({ id, name }) => ({ value: id, label: name }))}
                    onValueChange={(id) =>
                      setProfile((old) => ({
                        ...old,
                        transferMethodId: id || null,
                      }))
                    }
                    error={methods.error?.message}
                  />
                </FormField>
              </div>
            </div>
            <FormField id="bank-account-description" label="شرح">
              <Textarea
                id="bank-account-description"
                maxLength={2000}
                value={profile.description}
                onChange={(e) =>
                  setProfile((old) => ({ ...old, description: e.target.value }))
                }
              />
            </FormField>
            <FormField id="bank-account-description-en" label="شرح به زبان دوم">
              <Input
                id="bank-account-description-en"
                maxLength={2000}
                value={profile.descriptionEn}
                onChange={(e) =>
                  setProfile((old) => ({
                    ...old,
                    descriptionEn: e.target.value,
                  }))
                }
              />
            </FormField>
            <details>
              <summary className="cursor-pointer text-sm">
                اطلاعات تکمیلی حساب
              </summary>
              {field('cardNumber', 'شماره کارت')}
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => set('isActive', e.target.checked)}
                />
                فعال
              </label>
            </details>
            {bankId && !current && (
              <details onToggle={(e) => setShowExisting(e.currentTarget.open)}>
                <summary className="cursor-pointer text-sm">
                  حساب‌های ثبت‌شدهٔ این بانک
                </summary>
                <div className="space-y-2 py-2">
                  {existingAccounts.isFetching && (
                    <p role="status">در حال دریافت…</p>
                  )}
                  {existingAccounts.error && (
                    <p role="alert">{existingAccounts.error.message}</p>
                  )}
                  {existingAccounts.data?.items.length === 0 && (
                    <p>موردی یافت نشد.</p>
                  )}
                  {existingAccounts.data?.items.map((row) => (
                    <Button
                      key={row.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onPickExisting(row)}
                      className="me-2"
                    >
                      {row.title} {row.accountNumber}
                    </Button>
                  ))}
                  {existingPage > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setExistingPage((page) => page - 1)}
                    >
                      قبلی
                    </Button>
                  )}
                  {existingAccounts.data?.hasMore && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setExistingPage((page) => page + 1)}
                    >
                      بعدی
                    </Button>
                  )}
                </div>
              </details>
            )}
            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-2 font-medium">امضاکنندگان دسته چک</legend>
              <FormField id="bank-account-signer" label="افزودن امضاکننده">
                <SearchCombobox
                  id="bank-account-signer"
                  value=""
                  remote
                  onSearchChange={setSignerSearch}
                  options={(signersQuery.data?.data ?? [])
                    .filter(
                      (person) => !signers.some(({ id }) => id === person.id),
                    )
                    .map(({ id, displayName }) => ({
                      value: id,
                      label: displayName,
                    }))}
                  onValueChange={(id) => {
                    const person = signersQuery.data?.data.find(
                      (row) => row.id === id,
                    );
                    if (person)
                      setSigners((old) =>
                        old.some((row) => row.id === id)
                          ? old
                          : [...old, { id, name: person.displayName }],
                      );
                  }}
                  loading={signersQuery.isFetching}
                  error={signersQuery.error?.message}
                />
              </FormField>
              <table className="w-full text-start text-sm">
                <thead>
                  <tr>
                    <th className="text-start">شخص</th>
                    <th className="w-16">
                      <span className="sr-only">عملیات</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {signers.map(({ id, name }) => (
                    <tr key={id} className="border-t">
                      <td>{name}</td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={'حذف امضاکننده ' + name}
                          onClick={() =>
                            setSigners((old) =>
                              old.filter((row) => row.id !== id),
                            )
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>
          </fieldset>
        ) : (
          <FormField id="bank-account-notes" label="یادداشت">
            <Textarea
              id="bank-account-notes"
              maxLength={4000}
              value={profile.notes}
              onChange={(e) =>
                setProfile((old) => ({ ...old, notes: e.target.value }))
              }
            />
          </FormField>
        )}
        {(error || options.error) && (
          <p role="alert" className="text-destructive">
            {error || options.error?.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={
              saving ||
              !canManage ||
              (Boolean(bankId) && !options.data?.canManage)
            }
          >
            ذخیره و انتخاب حساب بانکی
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            انصراف
          </Button>
        </div>
      </form>
      {nested === 'bank' && (
        <BankInstitutionDialog
          onClose={() => setNested(null)}
          onSaved={(row) => {
            chooseBank(row);
            void client.invalidateQueries({
              queryKey: ['accounting', 'bank-title-bank-list'],
            });
          }}
        />
      )}
      {nested === 'branch' && bank && (
        <BankBranchDialog
          bank={bank}
          onClose={() => setNested(null)}
          onSaved={(row) => {
            setNewBranch(row);
            setBranchId(row.id);
            setNested(null);
            void client.invalidateQueries({
              queryKey: ['accounting', 'bank-title-branches', bankId],
            });
          }}
        />
      )}
      {nested === 'type' && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !saving) setNested(null);
          }}
        >
          <DialogContent dir="rtl" aria-describedby={undefined}>
            <DialogTitle>تعریف نوع حساب بانکی</DialogTitle>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy.current) return;
                busy.current = true;
                setSaving(true);
                try {
                  const row = await run<{ id: string; title: string }>(
                    'save-configuration',
                    {
                      kind: 'bank-account-types',
                      code: typeCode,
                      title: typeTitle,
                      active: true,
                      attributes: {},
                    },
                  );
                  if (row) {
                    setAddedType(row);
                    set('type', row.id);
                    setNested(null);
                    setTypeCode('');
                    setTypeTitle('');
                  }
                } finally {
                  setSaving(false);
                  busy.current = false;
                }
              }}
            >
              <FormField
                id="bank-account-type-code"
                label="کد نوع حساب"
                required
              >
                <Input
                  id="bank-account-type-code"
                  required
                  maxLength={40}
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                />
              </FormField>
              <FormField
                id="bank-account-type-title"
                label="عنوان نوع حساب"
                required
              >
                <Input
                  id="bank-account-type-title"
                  required
                  maxLength={160}
                  value={typeTitle}
                  onChange={(e) => setTypeTitle(e.target.value)}
                />
              </FormField>
              <Button type="submit" disabled={saving}>
                ذخیره نوع حساب
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
