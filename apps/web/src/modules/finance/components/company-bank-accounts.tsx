'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, FilePenLine, Plus, Trash2 } from 'lucide-react';
import type {
  CompanyBankAccountInputV1,
  CompanyBankAccountV1,
  CompanyBankAccountOptionsV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { bankAccountsApi } from '../api/bank-accounts-api';

type Editor = {
  mode: 'create' | 'edit' | 'view';
  requestId: string;
  branchId: string;
  record?: CompanyBankAccountV1;
  values: CompanyBankAccountInputV1;
};
const labels = {
  accountNumber: 'شماره حساب',
  cardNumber: 'شماره کارت',
  iban: 'شماره شبا',
} as const;

export function CompanyBankAccounts({ bankId }: { bankId: string }) {
  const [rows, setRows] = useState<CompanyBankAccountV1[]>([]);
  const [options, setOptions] = useState<CompanyBankAccountOptionsV1 | null>(
    null,
  );
  const [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null),
    [formError, setFormError] = useState(''),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    generation = useRef(0);
  const [deleting, setDeleting] = useState<CompanyBankAccountV1 | null>(null);
  async function remove() {
    if (!deleting || busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await bankAccountsApi.remove(bankId, deleting.id, deleting.version);
      setDeleting(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'حذف حساب بانکی ناموفق بود.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    setRows([]);
    setOptions(null);
    try {
      const [list, available] = await Promise.all([
        bankAccountsApi.list(bankId, page),
        bankAccountsApi.options(bankId),
      ]);
      if (generation.current !== current) return;
      setRows(list.items);
      setHasMore(list.hasMore);
      setOptions(available);
    } catch (cause) {
      if (generation.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'دریافت حساب‌های بانک ناموفق بود.',
        );
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [bankId, page]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      invalidate();
    };
  }, [load, invalidate]);
  async function open(row: CompanyBankAccountV1, mode: 'view' | 'edit') {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    const current = generation.current;
    try {
      const full = await bankAccountsApi.details(bankId, row.id);
      if (generation.current !== current) return;
      setFormError('');
      setEditor({
        mode,
        requestId: '',
        branchId: full.branchId,
        record: full,
        values: {
          title: full.title,
          currencyCode: full.currencyCode,
          isActive: full.isActive,
          accountNumber: full.accountNumber,
          cardNumber: full.cardNumber,
          iban: full.iban,
        },
      });
    } catch (cause) {
      if (generation.current === current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'دریافت حساب‌های بانک ناموفق بود.',
        );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function save() {
    if (!editor || busy.current || editor.mode === 'view') return;
    if (
      ![
        editor.values.accountNumber,
        editor.values.cardNumber,
        editor.values.iban,
      ].some((value) => value?.trim())
    ) {
      setFormError('حداقل یکی از شماره حساب، کارت یا شبا را وارد کنید.');
      return;
    }
    const captured = editor;
    busy.current = true;
    setPending(true);
    setFormError('');
    try {
      if (captured.mode === 'create')
        await bankAccountsApi.create(bankId, {
          ...captured.values,
          branchId: captured.branchId,
          requestId: captured.requestId,
        });
      else
        await bankAccountsApi.update(bankId, captured.record!.id, {
          ...captured.values,
          expectedVersion: captured.record!.version,
        });
      setEditor(null);
      setNotice('حساب بانکی با موفقیت ذخیره شد.');
      if (page === 1) await load();
      else setPage(1);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : 'ذخیره حساب بانکی ناموفق بود.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const readonly = editor?.mode === 'view';
  return (
    <Card className="space-y-3 p-4" aria-busy={loading || pending}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">حساب‌های شرکت در این بانک</h3>
        {options?.canManage ? (
          <Button
            disabled={pending || loading}
            onClick={() => {
              setFormError('');
              setNotice('');
              setEditor({
                mode: 'create',
                requestId: crypto.randomUUID(),
                branchId:
                  options.branches.length === 1 ? options.branches[0]!.id : '',
                values: {
                  title: '',
                  currencyCode:
                    options.currencies.find((x) => x.code === 'IRR')?.code ??
                    options.currencies[0]?.code ??
                    '',
                  isActive: true,
                  accountNumber: '',
                  cardNumber: '',
                  iban: '',
                },
              });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            افزودن حساب
          </Button>
        ) : null}
      </div>
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-destructive"
        >
          {error}
          <Button variant="outline" onClick={() => void load()}>
            تلاش دوباره
          </Button>
        </div>
      ) : loading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="حسابی برای این بانک ثبت نشده است"
          description="حساب‌های متعلق به شرکت را در این بخش ثبت کنید."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">حساب‌های شرکت در این بانک</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[
                  'عنوان حساب',
                  'شعبه شرکت',
                  'ارز',
                  'شماره حساب',
                  'شماره کارت',
                  'شماره شبا',
                  'وضعیت',
                  'عملیات',
                ].map((label) => (
                  <th key={label} scope="col" className="p-3 text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-3 text-center">{row.title}</td>
                  <td className="p-3 text-center">
                    {options?.branches.find((x) => x.id === row.branchId)
                      ?.name ?? '—'}
                  </td>
                  <td className="p-3 text-center" dir="ltr">
                    {row.currencyCode}
                  </td>
                  {(['accountNumber', 'cardNumber', 'iban'] as const).map(
                    (field) => (
                      <td
                        key={field}
                        className="p-3 text-center font-mono"
                        dir="ltr"
                      >
                        {row[field] ?? '—'}
                      </td>
                    ),
                  )}
                  <td className="p-3 text-center">
                    {row.isActive ? 'فعال' : 'غیرفعال'}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      {options?.canManage ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label="مشاهده حساب بانکی"
                            disabled={pending}
                            onClick={() => void open(row, 'view')}
                          >
                            <Eye aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label="ویرایش حساب بانکی"
                            disabled={pending}
                            onClick={() => void open(row, 'edit')}
                          >
                            <FilePenLine
                              aria-hidden="true"
                              className="size-4"
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            aria-label="حذف حساب بانکی"
                            disabled={pending}
                            onClick={() => {
                              setError('');
                              setDeleting(row);
                            }}
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!error && !loading && (page > 1 || hasMore) ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={page === 1 || pending}
            onClick={() => setPage((n) => n - 1)}
          >
            قبلی
          </Button>
          <span>{page.toLocaleString('fa-IR')}</span>
          <Button
            variant="outline"
            disabled={!hasMore || pending}
            onClick={() => setPage((n) => n + 1)}
          >
            بعدی
          </Button>
        </div>
      ) : null}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(value) => {
          if (!value && !busy.current) setDeleting(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>حذف حساب بانکی</DialogTitle>
          <DialogDescription>
            فقط حساب بدون استفاده حذف می‌شود و سابقه عملیات باقی می‌ماند.
          </DialogDescription>
          <p>{deleting?.title}</p>
          {error ? <p role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => void remove()}
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={editor !== null}
        onOpenChange={(value) => {
          if (!value && !busy.current) setEditor(null);
        }}
      >
        <DialogContent dir="rtl" aria-busy={pending}>
          <DialogTitle>
            {readonly
              ? 'مشاهده حساب بانکی'
              : editor?.mode === 'create'
                ? 'افزودن حساب بانکی'
                : 'ویرایش حساب بانکی'}
          </DialogTitle>
          <DialogDescription>حساب متعلق به شرکت</DialogDescription>
          {editor ? (
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <FormField id="company-bank-title" label="عنوان حساب" required>
                <Input
                  id="company-bank-title"
                  required
                  maxLength={160}
                  value={editor.values.title}
                  disabled={pending || readonly}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      values: { ...editor.values, title: event.target.value },
                    })
                  }
                />
              </FormField>
              <FormField id="company-bank-branch" label="شعبه شرکت" required>
                <Select
                  value={editor.branchId}
                  disabled={pending || readonly || editor.mode !== 'create'}
                  onValueChange={(value) =>
                    setEditor({ ...editor, branchId: value })
                  }
                >
                  <SelectTrigger id="company-bank-branch" aria-required="true">
                    <SelectValue placeholder="انتخاب شعبه" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="company-bank-currency" label="ارز" required>
                <Select
                  value={editor.values.currencyCode}
                  disabled={pending || readonly || editor.mode !== 'create'}
                  onValueChange={(value) =>
                    setEditor({
                      ...editor,
                      values: { ...editor.values, currencyCode: value },
                    })
                  }
                >
                  <SelectTrigger
                    id="company-bank-currency"
                    aria-required="true"
                  >
                    <SelectValue placeholder="انتخاب ارز" />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} · {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {(['accountNumber', 'cardNumber', 'iban'] as const).map(
                (field) => (
                  <FormField
                    key={field}
                    id={`company-bank-${field}`}
                    label={labels[field]}
                  >
                    <Input
                      id={`company-bank-${field}`}
                      dir="ltr"
                      autoComplete="off"
                      maxLength={120}
                      value={editor.values[field] ?? ''}
                      disabled={pending || readonly}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          values: {
                            ...editor.values,
                            [field]: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                ),
              )}
              <FormField id="company-bank-active" label="وضعیت">
                <Select
                  value={editor.values.isActive ? 'active' : 'inactive'}
                  disabled={pending || readonly}
                  onValueChange={(value) =>
                    setEditor({
                      ...editor,
                      values: {
                        ...editor.values,
                        isActive: value === 'active',
                      },
                    })
                  }
                >
                  <SelectTrigger id="company-bank-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">فعال</SelectItem>
                    <SelectItem value="inactive">غیرفعال</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {formError ? (
                <p
                  role="alert"
                  className="text-sm text-destructive sm:col-span-2"
                >
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditor(null)}
                >
                  بستن
                </Button>
                {!readonly ? (
                  <Button
                    type="submit"
                    loading={pending}
                    disabled={
                      pending || !editor.branchId || !editor.values.currencyCode
                    }
                  >
                    ذخیره حساب
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setFormError('');
                      setEditor({ ...editor, mode: 'edit' });
                    }}
                  >
                    ویرایش حساب بانکی
                  </Button>
                )}
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
