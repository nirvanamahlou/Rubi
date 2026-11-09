'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  DollarSign,
  Euro,
  FilePenLine,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  ExchangeOfficeInputV1,
  ExchangeOfficeListV1,
  ExchangeOfficeOptionsV1,
  ExchangeOfficeV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, FormField, Textarea } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { Card, EmptyState } from '@/components/ui/surfaces';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { MasterDataKpiGrid } from '@/modules/master-data/components/master-data-kpi-grid';
import { exchangeOfficesApi } from '../api/exchange-offices-api';

type Editor = {
  id: string | null;
  input: ExchangeOfficeInputV1;
  existingCurrencies?: string[];
};
export function ExchangeOfficeWorkspace() {
  const [data, setData] = useState<ExchangeOfficeListV1 | null>(null);
  const [options, setOptions] = useState<ExchangeOfficeOptionsV1 | null>(null);
  const [search, setSearch] = useState(''),
    [countryId, setCountryId] = useState(''),
    [currencyCode, setCurrencyCode] = useState(''),
    [status, setStatus] = useState('');
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [formError, setFormError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null),
    [deleting, setDeleting] = useState<ExchangeOfficeV1 | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void Promise.all([
        exchangeOfficesApi.list({
          search,
          countryId,
          currencyCode,
          status,
          page: String(page),
        }),
        exchangeOfficesApi.options(),
      ])
        .then(([list, choices]) => {
          if (active) {
            setData(list);
            setOptions(choices);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : 'دریافت صرافی‌ها ناموفق بود.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, countryId, currencyCode, status, page, revision]);
  const update = (patch: Partial<ExchangeOfficeInputV1>) => {
    if (editor) setEditor({ ...editor, input: { ...editor.input, ...patch } });
  };
  async function save() {
    if (!editor || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFormError('');
    try {
      const balances = (editor.input.balances ?? [])
        .filter((b) => b.currencyCode || b.amount)
        .map((b) => ({ ...b, amount: b.amount || '0' }));
      await exchangeOfficesApi.save(editor.id, { ...editor.input, balances });
      setEditor(null);
      setRevision((v) => v + 1);
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : 'ذخیره صرافی ناموفق بود.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4"
      aria-label="صندوق‌های ارزی"
      aria-busy={loading}
    >
      <MasterDataKpiGrid
        items={[
          {
            label: 'تعداد صرافی‌ها',
            value: data?.kpis.total ?? '—',
            icon: Building2,
            tone: 'sky',
          },
          {
            label: 'موجودی دلاری',
            value: data ? formatSalesMoney(data.kpis.usd) : '—',
            icon: DollarSign,
            tone: 'emerald',
          },
          {
            label: 'موجودی یورویی',
            value: data ? formatSalesMoney(data.kpis.eur) : '—',
            icon: Euro,
            tone: 'violet',
          },
          {
            label: 'صرافی‌های فعال',
            value: data?.kpis.active ?? '—',
            icon: CheckCircle2,
            tone: 'amber',
          },
        ]}
      />
      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="جست‌وجو" id="exchange-search">
          <Input
            id="exchange-search"
            value={search}
            placeholder="عنوان یا شماره تماس"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <FormField label="کشور" id="exchange-country-filter">
          <NativeSearchSelect
            id="exchange-country-filter"
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">همه کشورها</option>
            {options?.countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSearchSelect>
        </FormField>
        <FormField label="ارز" id="exchange-currency-filter">
          <NativeSearchSelect
            id="exchange-currency-filter"
            value={currencyCode}
            onChange={(e) => {
              setCurrencyCode(e.target.value);
              setPage(1);
            }}
          >
            <option value="">همه ارزها</option>
            {options?.currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} · {c.code}
              </option>
            ))}
          </NativeSearchSelect>
        </FormField>
        <FormField label="وضعیت" id="exchange-status-filter">
          <NativeSearchSelect
            id="exchange-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </NativeSearchSelect>
        </FormField>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          {options?.canManage && (
            <Button
              onClick={() => {
                setFormError('');
                setEditor({
                  id: null,
                  input: {
                    requestId: crypto.randomUUID(),
                    title: '',
                    isActive: true,
                    balances: [],
                  },
                });
              }}
            >
              <Plus className="size-4" />
              تعریف صرافی
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setSearch('');
              setCountryId('');
              setCurrencyCode('');
              setStatus('');
              setPage(1);
            }}
          >
            پاک‌کردن فیلتر
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="به‌روزرسانی"
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </Card>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {!loading && !error && data?.items.length === 0 ? (
        <EmptyState
          title="صرافی‌ای یافت نشد"
          description="صرافی جدید تعریف کنید یا فیلترها را تغییر دهید."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['عنوان', 'ارزها', 'موجودی', 'وضعیت', 'عملیات'].map(
                  (label) => (
                    <th className="p-3 text-start" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{row.title}</td>
                  <td className="p-3">
                    {row.balances.length
                      ? row.balances.map((b) => (
                          <div key={b.currencyCode} className="py-1" dir="ltr">
                            {b.currencyCode}
                          </div>
                        ))
                      : '—'}
                  </td>
                  <td className="p-3">
                    {row.balances.length
                      ? row.balances.map((b) => (
                          <div key={b.currencyCode} className="py-1" dir="ltr">
                            {formatSalesMoney(b.amount)} {b.currencyCode}
                          </div>
                        ))
                      : '—'}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        row.isActive
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-muted-foreground'
                      }
                    >
                      {row.isActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="p-3">
                    {options?.canManage && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="ویرایش صرافی"
                          disabled={busy || loading}
                          onClick={() => {
                            setFormError('');
                            setEditor({
                              id: row.id,
                              existingCurrencies: row.balances.map(
                                (b) => b.currencyCode,
                              ),
                              input: {
                                title: row.title,
                                countryId: row.countryId,
                                address: row.address,
                                phone: row.phone,
                                isActive: row.isActive,
                                expectedVersion: row.version,
                                balances: row.balances.map((b) => ({ ...b })),
                              },
                            });
                          }}
                        >
                          <FilePenLine className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="حذف صرافی"
                          disabled={busy || loading}
                          onClick={() => {
                            setFormError('');
                            setDeleting(row);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {data && (page > 1 || data.hasMore) && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            قبلی
          </Button>
          <span>{page.toLocaleString('fa-IR')}</span>
          <Button
            variant="outline"
            disabled={!data.hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            بعدی
          </Button>
        </div>
      )}
      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {editor?.id ? 'ویرایش صرافی' : 'تعریف صرافی'}
          </DialogTitle>
          <DialogDescription>صندوق‌های ارزی</DialogDescription>
          {editor && (
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset className="contents" disabled={busy}>
                <FormField label="عنوان" id="exchange-title" required>
                  <Input
                    id="exchange-title"
                    required
                    maxLength={200}
                    value={editor.input.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </FormField>
                <FormField label="کشور" id="exchange-country">
                  <NativeSearchSelect
                    id="exchange-country"
                    value={editor.input.countryId ?? ''}
                    onChange={(e) =>
                      update({ countryId: e.target.value || null })
                    }
                  >
                    <option value="">انتخاب کشور</option>
                    {options?.countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </FormField>
                <FormField label="شماره تماس" id="exchange-phone">
                  <Input
                    id="exchange-phone"
                    dir="ltr"
                    maxLength={80}
                    value={editor.input.phone ?? ''}
                    onChange={(e) => update({ phone: e.target.value })}
                  />
                </FormField>
                <FormField label="وضعیت" id="exchange-active">
                  <NativeSearchSelect
                    id="exchange-active"
                    value={editor.input.isActive ? 'active' : 'inactive'}
                    onChange={(e) =>
                      update({ isActive: e.target.value === 'active' })
                    }
                  >
                    <option value="active">فعال</option>
                    <option value="inactive">غیرفعال</option>
                  </NativeSearchSelect>
                </FormField>
                <div className="sm:col-span-2">
                  <FormField label="آدرس" id="exchange-address">
                    <Textarea
                      id="exchange-address"
                      maxLength={1000}
                      value={editor.input.address ?? ''}
                      onChange={(e) => update({ address: e.target.value })}
                    />
                  </FormField>
                </div>
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm">موجودی</strong>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update({
                          balances: [
                            ...(editor.input.balances ?? []),
                            { currencyCode: '', amount: '' },
                          ],
                        })
                      }
                    >
                      <Plus className="size-4" />
                      افزودن ارز
                    </Button>
                  </div>
                  {(editor.input.balances ?? []).map((b, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3">
                      <FormField
                        label="ارز"
                        id={`exchange-balance-currency-${index}`}
                      >
                        <NativeSearchSelect
                          id={`exchange-balance-currency-${index}`}
                          value={b.currencyCode}
                          disabled={
                            editor.existingCurrencies?.includes(
                              b.currencyCode,
                            ) ?? false
                          }
                          onChange={(e) =>
                            update({
                              balances: editor.input.balances!.map((v, i) =>
                                i === index
                                  ? { ...v, currencyCode: e.target.value }
                                  : v,
                              ),
                            })
                          }
                        >
                          <option value="">انتخاب ارز</option>
                          {options?.currencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} · {c.code}
                            </option>
                          ))}
                        </NativeSearchSelect>
                      </FormField>
                      <FormField
                        label="مبلغ"
                        id={`exchange-balance-amount-${index}`}
                      >
                        <MoneyInput
                          id={`exchange-balance-amount-${index}`}
                          value={b.amount}
                          onValueChange={(amount) =>
                            update({
                              balances: editor.input.balances!.map((v, i) =>
                                i === index ? { ...v, amount } : v,
                              ),
                            })
                          }
                        />
                      </FormField>
                    </div>
                  ))}
                </div>
                {formError && (
                  <p role="alert" className="text-destructive sm:col-span-2">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditor(null)}
                  >
                    انصراف
                  </Button>
                  <Button type="submit" loading={busy}>
                    ذخیره
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>حذف صرافی</DialogTitle>
          <DialogDescription>{deleting?.title}</DialogDescription>
          {formError && <p role="alert">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              onClick={async () => {
                if (!deleting || lock.current) return;
                lock.current = true;
                setBusy(true);
                setFormError('');
                try {
                  await exchangeOfficesApi.remove(
                    deleting.id,
                    deleting.version,
                  );
                  setDeleting(null);
                  setRevision((v) => v + 1);
                } catch (cause) {
                  setFormError(
                    cause instanceof Error
                      ? cause.message
                      : 'حذف صرافی ناموفق بود.',
                  );
                } finally {
                  lock.current = false;
                  setBusy(false);
                }
              }}
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
