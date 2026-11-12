'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AccountingDefinitionToolbar } from './accounting-definition-toolbar';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  AccountingFiscalAllocationForm,
  type FiscalAllocationDraft,
} from './accounting-fiscal-allocation-form';
import type {
  AccountingBookV1,
  AccountingLedgerCompanyV1,
  AccountingPeriodV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { accountingApi } from '../api/accounting-api';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Props = {
  snapshot: AccountingSnapshotV1 | null;
  branches: { id: string; name: string }[];
  company?: AccountingLedgerCompanyV1 | null | undefined;
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  onCreated: (
    book: AccountingBookV1,
    after: 'stay' | 'new' | 'close',
  ) => Promise<void>;
  startNew?: boolean;
};

export function AccountingLedgerEditor({
  snapshot,
  branches,
  company,
  busy,
  run,
  refresh,
  onCreated,
}: Props) {
  const router = useRouter();
  const book = snapshot?.book;
  const initialBook = book;
  const years =
    snapshot?.configurations.filter((row) => row.kind === 'fiscal-years') ?? [];
  const formRef = useRef<HTMLFormElement>(null);
  const [creating, setCreating] = useState(!initialBook);
  const [version, setVersion] = useState(initialBook?.version);
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createId, setCreateId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    code: initialBook?.code ?? '',
    title: company?.title ?? initialBook?.title ?? '',
    titleEn: initialBook?.titleEn ?? '',
    description: initialBook?.description ?? '',
    notes: initialBook?.notes ?? '',
    active: initialBook?.active ?? true,
    isMain: initialBook?.isMain ?? false,
    allowsPosting: initialBook?.allowsPosting ?? true,
    branchId: initialBook?.branchId ?? branches[0]?.id ?? '',
    baseCurrency: initialBook?.baseCurrency ?? 'IRR',
  });
  const [period, setPeriod] = useState<FiscalAllocationDraft | null>(null);
  const [selectedAllocationId, setSelectedAllocationId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AccountingPeriodV1 | null>(
    null,
  );
  const [allocationBusy, setAllocationBusy] = useState(false);
  const locked = busy || saving || allocationBusy || !company;
  const selectedAllocation = snapshot?.periods.find(
    (row) => row.id === selectedAllocationId,
  );
  const set = (key: keyof typeof draft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (after: 'stay' | 'new' | 'close' = 'stay') => {
    if (locked) return false;
    setError('');
    setSaving(true);
    try {
      if (creating) {
        const id = createId ?? crypto.randomUUID();
        setCreateId(id);
        const created = await accountingApi.createBook({
          ...draft,
          legalEntityId: company?.id,
          id,
          approvalPolicy: 'DUAL_CONTROL',
        });
        setCreating(false);
        setVersion(created.version);
        await onCreated(created, after);
      } else {
        const saved = await run<AccountingBookV1>(
          'save-book',
          { ...draft, legalEntityId: company?.id },
          version,
        );
        if (!saved) return false;
        setVersion(saved.version);
        if (after === 'new') newBook();
        if (after === 'close')
          router.push(
            `/finance/accounting/general-ledger/base-information/lists/ledgers?bookId=${book?.id ?? ''}`,
          );
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود.');
      return false;
    } finally {
      setSaving(false);
    }
  };
  const newBook = () => {
    if (book) {
      reloadExisting();
      return;
    }
    setCreating(true);
    setVersion(undefined);
    setCreateId(null);
    setPeriod(null);
    setError('');
    setTab('main');
    setDraft({
      code: '',
      title: company?.title ?? '',
      titleEn: '',
      description: '',
      notes: '',
      active: true,
      isMain: false,
      allowsPosting: true,
      branchId: branches[0]?.id ?? '',
      baseCurrency: 'IRR',
    });
  };
  const openPeriod = (row: AccountingPeriodV1) => {
    setSelectedAllocationId(row.id);
    setError('');
    setPeriod({
      ...row,
      fiscalYearCode:
        years.find((year) => year.id === row.fiscalYearId)?.code ?? '',
    });
  };
  const reloadExisting = () => {
    if (book) {
      setCreating(false);
      setDraft({
        code: book.code,
        title: company?.title ?? book.title,
        titleEn: book.titleEn ?? '',
        description: book.description ?? '',
        notes: book.notes ?? '',
        active: book.active,
        isMain: book.isMain,
        allowsPosting: book.allowsPosting,
        branchId: book.branchId,
        baseCurrency: book.baseCurrency,
      });
      setVersion(book.version);
      setPeriod(null);
      setError('');
    }
  };
  const reload = () => {
    if (book) reloadExisting();
    else newBook();
    void refresh();
  };
  const saveAllocation = async () => {
    if (!period || locked) return;
    if (!period.fiscalYearCode || !period.startDate || !period.endDate) {
      setError('سال مالی، تاریخ شروع و پایان را کامل کنید.');
      return;
    }
    setAllocationBusy(true);
    setError('');
    try {
      const result = await run('save-period', period, period.version);
      if (result) setPeriod(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره ناموفق بود.');
    } finally {
      setAllocationBusy(false);
    }
  };
  const removeAllocation = async () => {
    if (!deleteTarget || locked) return;
    setAllocationBusy(true);
    setError('');
    try {
      const result = await run(
        'delete-period',
        { id: deleteTarget.id },
        deleteTarget.version,
      );
      if (result) {
        setSelectedAllocationId('');
        setPeriod(null);
      }
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteTarget(null);
      setError(
        cause instanceof Error
          ? cause.message
          : 'حذف تخصیص سال مالی ناموفق بود.',
      );
    } finally {
      setAllocationBusy(false);
    }
  };
  return (
    <section
      dir="rtl"
      aria-label="معرفی دفتر کل"
      className="overflow-hidden rounded-md border border-border bg-surface"
    >
      <AccountingDefinitionToolbar
        busy={locked}
        canClose={!!book}
        save={(after) => {
          if (formRef.current?.reportValidity()) void save(after);
        }}
        reset={newBook}
        refresh={reload}
        close={() =>
          router.push(
            `/finance/accounting/general-ledger/base-information/lists/ledgers?bookId=${book?.id ?? ''}`,
          )
        }
      />
      <div
        role="tablist"
        aria-label="اطلاعات دفتر کل"
        className="flex gap-1 border-b px-3"
      >
        <button
          type="button"
          id="ledger-main-tab"
          role="tab"
          aria-selected={tab === 'main'}
          aria-controls="ledger-main-panel"
          onClick={() => setTab('main')}
          className={`px-3 py-3 text-sm ${tab === 'main' ? 'border-b-2 border-primary font-bold text-primary' : ''}`}
        >
          اطلاعات اصلی
        </button>
        <button
          type="button"
          id="ledger-notes-tab"
          role="tab"
          aria-selected={tab === 'notes'}
          aria-controls="ledger-notes-panel"
          onClick={() => setTab('notes')}
          className={`px-3 py-3 text-sm ${tab === 'notes' ? 'border-b-2 border-primary font-bold text-primary' : ''}`}
        >
          یادداشت
        </button>
      </div>
      {!company && (
        <p role="status" className="p-3 text-muted-foreground">
          برای تعریف دفتر کل، یک شرکت را از نوار بالای صفحه انتخاب کنید.
        </p>
      )}
      {book && !book.legalEntityId && company && (
        <p role="status" className="p-3 text-sm text-muted-foreground">
          این دفتر قدیمی هنوز به شرکتی متصل نشده است. با ذخیره، همین دفتر و
          سوابقش به «{company.title}» متصل می‌شوند.
        </p>
      )}
      {error && (
        <p role="alert" className="p-3 text-destructive">
          {error}
        </p>
      )}
      <form
        data-accounting-inline-form
        ref={formRef}
        id="accounting-ledger-form"
        onInvalidCapture={() => setTab('main')}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div
          id="ledger-main-panel"
          role="tabpanel"
          aria-labelledby="ledger-main-tab"
          hidden={tab !== 'main'}
        >
          <div className="m-2 grid gap-x-8 gap-y-3 border bg-muted/20 p-4 md:grid-cols-2">
            <div className="space-y-3 [&>div]:items-center [&>div]:lg:grid-cols-[7rem_minmax(0,1fr)] [&_input:not([type=checkbox])]:h-7 [&_input:not([type=checkbox])]:rounded-sm [&_label]:text-xs [&_label]:font-normal">
              <FormField label="کد *" id="ledger-code">
                <Input
                  id="ledger-code"
                  value={draft.code}
                  required
                  maxLength={20}
                  disabled={locked}
                  onChange={(e) => set('code', e.target.value)}
                />
              </FormField>
              <FormField label="عنوان *" id="ledger-title">
                <Input
                  id="ledger-title"
                  value={company?.title ?? draft.title}
                  readOnly
                  aria-readonly="true"
                  className="bg-muted text-muted-foreground"
                  required
                  maxLength={160}
                  disabled={locked}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isMain}
                  disabled={locked}
                  onChange={(e) => set('isMain', e.target.checked)}
                />
                دفتر کل اصلی
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.allowsPosting}
                  disabled={locked}
                  onChange={(e) => set('allowsPosting', e.target.checked)}
                />
                امکان صدور سند حسابداری در دفتر کل
              </label>
            </div>
            <div className="space-y-3 [&>div]:items-center [&>div]:lg:grid-cols-[7rem_minmax(0,1fr)] [&_input:not([type=checkbox])]:h-7 [&_input:not([type=checkbox])]:rounded-sm [&_label]:text-xs [&_label]:font-normal">
              <FormField label="عنوان به زبان دوم" id="ledger-title-en">
                <Input
                  id="ledger-title-en"
                  value={draft.titleEn}
                  maxLength={160}
                  disabled={locked}
                  onChange={(e) => set('titleEn', e.target.value)}
                />
              </FormField>
              <FormField label="توضیحات" id="ledger-description">
                <Input
                  id="ledger-description"
                  value={draft.description}
                  maxLength={2000}
                  disabled={locked}
                  onChange={(e) => set('description', e.target.value)}
                />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={locked}
                  onChange={(e) => set('active', e.target.checked)}
                />
                فعال
              </label>
            </div>
          </div>
        </div>
        <div
          id="ledger-notes-panel"
          role="tabpanel"
          aria-labelledby="ledger-notes-tab"
          hidden={tab !== 'notes'}
          className="p-4"
        >
          <FormField label="یادداشت" id="ledger-notes">
            <Textarea
              id="ledger-notes"
              value={draft.notes}
              maxLength={2000}
              disabled={locked}
              onChange={(e) => set('notes', e.target.value)}
            />
          </FormField>
        </div>
      </form>
      <fieldset className="m-2 border p-2">
        <legend className="px-2 text-sm">تخصیص سال مالی</legend>
        <div className="min-h-60 overflow-x-auto border">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary/10">
              <tr>
                {[
                  'انتخاب',
                  'سال مالی',
                  'تاریخ شروع',
                  'تاریخ پایان',
                  'سال',
                  '',
                ].map((label) => (
                  <th key={label} className="border-e px-3 py-2 font-normal">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!creating &&
                snapshot?.periods.map((row) => {
                  const year = years.find((y) => y.id === row.fiscalYearId);
                  return (
                    <tr
                      key={row.id}
                      aria-selected={selectedAllocationId === row.id}
                      className={`border-b ${selectedAllocationId === row.id ? 'bg-primary/10' : ''}`}
                    >
                      <td className="p-3">
                        <input
                          type="radio"
                          name="ledger-period-selection"
                          aria-label={`انتخاب تخصیص ${year?.code ?? ''}`}
                          checked={selectedAllocationId === row.id}
                          disabled={locked}
                          onChange={() => {
                            setSelectedAllocationId(row.id);
                            setPeriod(null);
                            setError('');
                          }}
                        />
                      </td>
                      <td className="p-3">{year?.title}</td>
                      <td className="p-3" dir="ltr">
                        {row.startDate}
                      </td>
                      <td className="p-3" dir="ltr">
                        {row.endDate}
                      </td>
                      <td className="p-3">{year?.code}</td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`ویرایش تخصیص ${year?.title ?? ''}`}
                          title="ویرایش تخصیص سال مالی"
                          disabled={locked || row.status !== 'OPEN'}
                          onClick={() => openPeriod(row)}
                          permission="finance.account.manage"
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-start gap-1 border bg-muted/30 p-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="افزودن تخصیص سال مالی"
            title={
              creating ? 'ابتدا دفتر را ذخیره کنید' : 'افزودن تخصیص سال مالی'
            }
            disabled={locked || creating}
            permission="finance.account.manage"
            onClick={() => {
              setSelectedAllocationId('');
              setError('');
              setPeriod({
                fiscalYearId: '',
                fiscalYearCode: '',
                startDate: '',
                endDate: '',
              });
            }}
          >
            <Plus className="size-4 text-green-600" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="حذف تخصیص سال مالی"
            title="حذف تخصیص سال مالی"
            disabled={
              locked ||
              creating ||
              !selectedAllocation ||
              selectedAllocation.status !== 'OPEN'
            }
            permission="finance.account.manage"
            onClick={() => {
              if (selectedAllocation) {
                setError('');
                setDeleteTarget({ ...selectedAllocation });
              }
            }}
          >
            <Trash2 className="size-4 text-red-600" />
          </Button>
        </div>
        {period && !creating && (
          <AccountingFiscalAllocationForm
            draft={period}
            locked={locked}
            onChange={setPeriod}
            onSubmit={() => void saveAllocation()}
            onCancel={() => setPeriod(null)}
          />
        )}
      </fieldset>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !allocationBusy) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>حذف تخصیص سال مالی</DialogTitle>
          <DialogDescription>
            تخصیص سال{' '}
            {years.find((year) => year.id === deleteTarget?.fiscalYearId)?.code}{' '}
            از دفتر {company?.title ?? book?.title} حذف شود؟ تعریف سال مالی حفظ
            می‌شود.
          </DialogDescription>
          <p className="text-sm">
            فقط تخصیص سال مالی باز و بدون سابقه مالی قابل حذف است.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={locked}
              permission="finance.account.manage"
              onClick={() => void removeAllocation()}
            >
              تأیید حذف تخصیص
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={allocationBusy}
              onClick={() => setDeleteTarget(null)}
            >
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
