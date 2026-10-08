'use client';

import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { FilePlus2, RefreshCw, Save, Plus, X, Pencil } from 'lucide-react';
import type {
  AccountingBookV1,
  AccountingPeriodV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { accountingApi } from '../api/accounting-api';

type Run = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;
type Props = {
  snapshot: AccountingSnapshotV1 | null;
  branches: { id: string; name: string }[];
  busy: boolean;
  run: Run;
  refresh: () => Promise<void>;
  onCreated: (book: AccountingBookV1) => Promise<void>;
};

export function AccountingLedgerEditor({
  snapshot,
  branches,
  busy,
  run,
  refresh,
  onCreated,
}: Props) {
  const book = snapshot?.book;
  const formRef = useRef<HTMLFormElement>(null);
  const [creating, setCreating] = useState(!book);
  const [version, setVersion] = useState(book?.version);
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createId, setCreateId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    code: book?.code ?? '',
    title: book?.title ?? '',
    titleEn: book?.titleEn ?? '',
    description: book?.description ?? '',
    notes: book?.notes ?? '',
    active: book?.active ?? true,
    isMain: book?.isMain ?? false,
    allowsPosting: book?.allowsPosting ?? true,
    branchId: book?.branchId ?? branches[0]?.id ?? '',
    baseCurrency: book?.baseCurrency ?? 'IRR',
  });
  const [period, setPeriod] = useState<{
    id?: string;
    version?: number;
    fiscalYearId: string;
    startDate: string;
    endDate: string;
  } | null>(null);
  const locked = busy || saving;
  const set = (key: keyof typeof draft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (locked) return;
    setError('');
    setSaving(true);
    try {
      if (creating) {
        const id = createId ?? crypto.randomUUID();
        setCreateId(id);
        const created = await accountingApi.createBook({
          ...draft,
          id,
          approvalPolicy: 'DUAL_CONTROL',
        });
        setCreating(false);
        setVersion(created.version);
        await onCreated(created);
      } else {
        const saved = await run<AccountingBookV1>('save-book', draft, version);
        if (saved) setVersion(saved.version);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };
  const newBook = () => {
    setCreating(true);
    setVersion(undefined);
    setCreateId(null);
    setPeriod(null);
    setError('');
    setTab('main');
    setDraft({
      code: '',
      title: '',
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
  const openPeriod = (row: AccountingPeriodV1) => setPeriod({ ...row });
  const reload = () => {
    if (book && !creating) {
      setDraft({
        code: book.code,
        title: book.title,
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
    } else newBook();
    void refresh();
  };
  const shortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      locked ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector('[role="dialog"], [role="alertdialog"]') ||
      (event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="combobox"]',
        ))
    )
      return;
    if (event.code === 'KeyN') {
      event.preventDefault();
      newBook();
    }
    if (event.code === 'KeyR') {
      event.preventDefault();
      reload();
    }
    if (event.code === 'KeyS') {
      const button = document.querySelector<HTMLButtonElement>(
        'button[form="accounting-ledger-form"]',
      );
      if (button && !button.disabled) {
        event.preventDefault();
        formRef.current?.requestSubmit(button);
      }
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  const years =
    snapshot?.configurations.filter((row) => row.kind === 'fiscal-years') ?? [];
  return (
    <section
      dir="rtl"
      aria-label="معرفی دفتر کل"
      className="overflow-hidden rounded-md border border-border bg-surface"
    >
      <div
        className="flex justify-end gap-1 border-b bg-muted/30 p-2"
        aria-label="عملیات دفتر کل"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="جدید"
          title="جدید (Alt+Shift+N)"
          aria-keyshortcuts="Alt+Shift+N"
          disabled={locked}
          onClick={newBook}
        >
          <FilePlus2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="بارگذاری مجدد"
          title="بارگذاری مجدد (Alt+Shift+R)"
          aria-keyshortcuts="Alt+Shift+R"
          disabled={locked}
          onClick={reload}
        >
          <RefreshCw className="size-4" />
        </Button>
        <Button
          type="submit"
          form="accounting-ledger-form"
          size="sm"
          aria-label="ذخیره"
          title="ذخیره (Alt+Shift+S)"
          aria-keyshortcuts="Alt+Shift+S"
          permission="finance.account.manage"
          disabled={locked}
        >
          <Save className="size-4" />
        </Button>
      </div>
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
      {error && (
        <p role="alert" className="p-3 text-destructive">
          {error}
        </p>
      )}
      <form
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
                  value={draft.title}
                  required
                  maxLength={160}
                  disabled={locked}
                  onChange={(e) => set('title', e.target.value)}
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
        {creating && (
          <details className="m-2 rounded border p-3">
            <summary className="cursor-pointer text-sm">
              تنظیمات دفتر در روبی
            </summary>
            <div className="grid gap-3 pt-3 md:grid-cols-2">
              <FormField label="شعبه" id="ledger-branch">
                <SearchCombobox
                  id="ledger-branch"
                  value={draft.branchId}
                  onValueChange={(id) => set('branchId', id)}
                  options={branches.map((row) => ({
                    value: row.id,
                    label: row.name,
                  }))}
                />
              </FormField>
              <FormField label="ارز پایه" id="ledger-currency">
                <Input
                  id="ledger-currency"
                  value={draft.baseCurrency}
                  maxLength={3}
                  pattern="[A-Z]{3}"
                  required
                  onChange={(e) =>
                    set('baseCurrency', e.target.value.toUpperCase())
                  }
                />
              </FormField>
            </div>
          </details>
        )}
      </form>
      <fieldset className="m-2 border p-2">
        <legend className="px-2 text-sm">تخصیص سال مالی</legend>
        <div className="min-h-60 overflow-x-auto border">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary/10">
              <tr>
                {['سال مالی', 'تاریخ شروع', 'تاریخ پایان', 'سال', ''].map(
                  (label) => (
                    <th key={label} className="border-e px-3 py-2 font-normal">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {!creating &&
                snapshot?.periods.map((row) => {
                  const year = years.find((y) => y.id === row.fiscalYearId);
                  return (
                    <tr key={row.id} className="border-b">
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
            onClick={() =>
              setPeriod({ fiscalYearId: '', startDate: '', endDate: '' })
            }
          >
            <Plus className="size-4 text-green-600" />
          </Button>
        </div>
        {period && !creating && (
          <form
            className="space-y-3 border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!locked)
                void run('save-period', period, period.version).then(
                  (result) => {
                    if (result) setPeriod(null);
                  },
                );
            }}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="سال مالی" id="ledger-year">
                <SearchCombobox
                  id="ledger-year"
                  value={period.fiscalYearId}
                  onValueChange={(id) =>
                    setPeriod({ ...period, fiscalYearId: id })
                  }
                  options={years
                    .filter((row) => row.active)
                    .map((row) => ({ value: row.id, label: row.title }))}
                />
              </FormField>
              <FormField label="تاریخ شروع" id="ledger-start">
                <DatePicker
                  id="ledger-start"
                  value={period.startDate}
                  onChange={(value) =>
                    setPeriod({ ...period, startDate: value })
                  }
                />
              </FormField>
              <FormField label="تاریخ پایان" id="ledger-end">
                <DatePicker
                  id="ledger-end"
                  value={period.endDate}
                  onChange={(value) => setPeriod({ ...period, endDate: value })}
                />
              </FormField>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                aria-label="ذخیره تخصیص سال مالی"
                title="ذخیره تخصیص سال مالی"
                disabled={locked}
                permission="finance.account.manage"
              >
                <Save className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="بستن تخصیص"
                title="بستن تخصیص"
                disabled={locked}
                onClick={() => setPeriod(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </form>
        )}
      </fieldset>
    </section>
  );
}
