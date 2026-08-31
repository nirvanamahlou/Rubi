'use client';

import { useState } from 'react';
import type { MasterDataRecord } from '@rubi/contracts';
import { Copy, Eye, FilePenLine, Plane, Plus } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
} from '@/components/ui';
import { asReference } from '../api/references';
import {
  copyProduct,
  createProduct,
  reviseProduct,
  transitionProduct,
  transitions,
  type CatalogStatus,
  type Product,
  type ProductInput,
  type Reference,
  type ReferenceResolver,
} from '../model/catalog';
import {
  displayTime,
  emptyInput,
  initialQuery,
  previewSamples,
  queryProducts,
  replacePreview,
  statusLabels,
  supplyLabels,
  type PreviewQuery,
} from '../model/preview';
import { ReferenceBrowser } from './reference-browser';
import { TicketForm } from './ticket-form';

export const previewStates = {
  ready: 'عادی',
  loading: 'در حال دریافت',
  empty: 'خالی',
  error: 'خطا',
  unauthorized: 'ورود لازم',
  forbidden: 'بدون مجوز',
  conflict: 'تعارض نسخه',
  success: 'اعمال تغییر آزمایشی',
} as const;
export function CatalogState({ state }: { state: keyof typeof previewStates }) {
  if (state === 'ready') return null;
  const messages = {
    loading: 'در حال دریافت فهرست…',
    empty: 'برنامه‌ای مطابق فیلترها وجود ندارد.',
    error: 'دریافت فهرست ناموفق بود؛ دوباره تلاش کنید.',
    unauthorized: 'برای مشاهده داده عملیاتی وارد شوید (401).',
    forbidden:
      'مجوز اختصاصی مدیریت بلیت منتشر نشده است؛ عملیات واقعی مسدود است (403).',
    conflict:
      'نسخه برنامه تغییر کرده است؛ فرم را ببندید و نسخه تازه را باز کنید (409).',
    success:
      'تغییر فقط در حافظه پیش‌نمایش اعمال شد؛ ذخیره واقعی انجام نشده است.',
  };
  return (
    <Alert
      title={messages[state]}
      tone={state === 'error' || state === 'conflict' ? 'error' : 'info'}
    />
  );
}
export function TicketWorkspace() {
  const [preview, setPreview] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [query, setQuery] = useState<PreviewQuery>(initialQuery);
  const [form, setForm] = useState<{
    mode: 'create' | 'view' | 'edit';
    product?: Product;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [state, setState] = useState<keyof typeof previewStates>('ready');
  const [statusChange, setStatusChange] = useState<{
    product: Product;
    status: CatalogStatus;
  } | null>(null);
  const [reason, setReason] = useState('');
  const result = queryProducts(products, query);
  const resolve: ReferenceResolver = (kind, id) =>
    references.find((r) => r.kind === kind && r.id === id);
  const label = (kind: Reference['kind'], id: string) =>
    resolve(kind, id)?.name ?? 'منتظر مرجع';
  function selectReference(record: MasterDataRecord) {
    const value = asReference(record);
    if (!value) return;
    setReferences((rows) => [
      ...rows.filter((r) => r.id !== value.id || r.kind !== value.kind),
      value,
    ]);
    setNotice(
      'مرجع «' +
        value.name +
        '» از API دریافت شد و در انتخاب‌های فرم در دسترس است؛ هیچ محصولی ذخیره نشده است.',
    );
  }
  function resetSession() {
    setPreview(false);
    setProducts([]);
    setQuery(initialQuery);
    setForm(null);
    setStatusChange(null);
    setState('ready');
    setNotice('حافظه پیش‌نمایش این صفحه پاک شد.');
    setProblem('');
  }
  function save(input: ProductInput, editReason: string) {
    if (!preview || !form || form.mode === 'view')
      throw new Error('ویرایش فقط در Preview مجاز است.');
    const now = new Date().toISOString();
    const current = form.product;
    const next = current
      ? reviseProduct(
          current,
          input,
          current.version,
          resolve,
          now,
          'کاربر نمایشی',
          editReason,
          {
            total: current.definition.totalCapacity,
            version: 0,
            allocations: [],
          },
        )
      : createProduct(
          'preview-' + crypto.randomUUID(),
          input,
          resolve,
          now,
          'کاربر نمایشی',
        );
    // Preview is a single mounted session. Validate against the current collection.
    const updated = replacePreview(products, next, current?.version);
    setProducts(updated);
    setForm(null);
    setProblem('');
    setNotice(
      'تغییر فقط در حافظه پیش‌نمایش اعمال شد؛ با خروج یا بازخوانی صفحه از بین می‌رود.',
    );
  }
  function copy(product: Product) {
    try {
      const next = copyProduct(
        product,
        'preview-' + crypto.randomUUID(),
        resolve,
        new Date().toISOString(),
        'کاربر نمایشی',
      );
      setProducts(replacePreview(products, next));
      setProblem('');
      setNotice(
        'کپی پیش‌نویس ساخته شد؛ بدون کپی تخصیص، Hold یا سابقه برنامه قبلی.',
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'کپی ناموفق بود.');
    }
  }
  function applyStatus() {
    if (!statusChange || !preview) return;
    try {
      const current = statusChange.product;
      const next = transitionProduct(
        current,
        statusChange.status,
        current.version,
        resolve,
        new Date().toISOString(),
        'کاربر نمایشی',
        reason,
        {
          total: current.definition.totalCapacity,
          version: 0,
          allocations: [],
        },
      );
      setProducts(replacePreview(products, next, current.version));
      setStatusChange(null);
      setProblem('');
      setNotice(
        'وضعیت فقط در پیش‌نمایش تغییر کرد؛ هیچ عملیات فروش یا رزرو اجرا نشد.',
      );
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }
  const filter = (patch: Partial<PreviewQuery>) =>
    setQuery({ ...query, ...patch, page: 1 });
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="مدیریت و تعریف بلیت‌ها"
        eyebrow="محصول • برنامه پرواز • نرخ و ظرفیت"
        description="تعریف برنامه‌های قابل فروش؛ صدور بلیت مسافر و Manifest در رزرواسیون انجام می‌شود."
        actions={
          <>
            <Button
              variant="outline"
              disabled
              title="منتظر API بلیت، مجوز خروجی و Worker"
            >
              خروجی فهرست
            </Button>
            <Button
              disabled={!preview}
              onClick={() => setForm({ mode: 'create' })}
            >
              <Plus className="size-4" aria-hidden />
              برنامه جدید نمایشی
            </Button>
          </>
        }
      />
      <Alert
        title="مرحله A — ذخیره عملیاتی بلیت هنوز متصل نیست"
        description="مجوز اختصاصی، API بلیت و Persistence منتظر Handoff هستند. پیش‌نمایش فقط داده ساختگی در حافظه همین صفحه دارد؛ ظرفیت و قیمت آن آمار واقعی شرکت نیست."
        tone="warning"
      />
      <div className="flex flex-wrap items-center gap-3">
        {!preview ? (
          <Button
            onClick={() => {
              setPreview(true);
              setNotice(
                'پیش‌نمایش خالی آغاز شد؛ هیچ داده واقعی بارگذاری نشده است.',
              );
            }}
          >
            شروع پیش‌نمایش مستقل
          </Button>
        ) : (
          <>
            <Badge>جلسه نمایشی • بدون ذخیره دائمی</Badge>
            <Button variant="outline" onClick={resetSession}>
              پایان و پاک‌کردن پیش‌نمایش
            </Button>
            <Button
              variant="ghost"
              disabled={products.length > 0}
              onClick={() => {
                setProducts(previewSamples(new Date().toISOString()));
                setNotice(
                  '۸ برنامه کاملاً ساختگی بارگذاری شد؛ مراجع و شمارنده‌های واقعی ندارد.',
                );
              }}
            >
              بارگذاری برنامه‌های ساختگی
            </Button>
          </>
        )}
      </div>
      {notice ? <Alert title={notice} /> : null}
      {problem && !statusChange ? <Alert tone="error" title={problem} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            'برنامه‌های این پیش‌نمایش',
            preview ? products.length.toLocaleString('fa-IR') : '—',
          ],
          ['موجودی قابل فروش واقعی', 'منتظر رزرواسیون'],
          ['نرخ مالی / سود قطعی', 'ارائه نمی‌شود'],
        ].map(([title, value]) => (
          <Card key={title} className="p-5">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-3 text-xl font-black text-primary">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="جست‌وجوی برنامه و شماره پرواز" id="ticket-search">
            <Input
              id="ticket-search"
              value={query.search}
              placeholder="عنوان یا شماره پرواز…"
              onChange={(e) => filter({ search: e.target.value })}
            />
          </FormField>
          <FormField label="وضعیت فروش" id="ticket-status-filter">
            <select
              id="ticket-status-filter"
              className="h-11 rounded-xl border bg-surface px-3"
              value={query.status}
              onChange={(e) => filter({ status: e.target.value })}
            >
              <option value="all">همه وضعیت‌ها</option>
              {Object.entries(statusLabels).map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="نوع تأمین" id="ticket-supply-filter">
            <select
              id="ticket-supply-filter"
              className="h-11 rounded-xl border bg-surface px-3"
              value={query.supply}
              onChange={(e) => filter({ supply: e.target.value })}
            >
              <option value="all">همه انواع</option>
              {Object.entries(supplyLabels).map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="ایرلاین" id="ticket-airline-filter">
            <select
              id="ticket-airline-filter"
              className="h-11 rounded-xl border bg-surface px-3"
              value={query.airline}
              onChange={(e) => filter({ airline: e.target.value })}
            >
              <option value="">همه ایرلاین‌ها</option>
              {references
                .filter((r) => r.kind === 'airline')
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="حرکت از تاریخ (UTC)" id="ticket-filter-from">
            <DatePicker
              id="ticket-filter-from"
              value={query.from}
              onChange={(from) => filter({ from })}
            />
          </FormField>
          <FormField label="حرکت تا تاریخ (UTC)" id="ticket-filter-to">
            <DatePicker
              id="ticket-filter-to"
              value={query.to}
              onChange={(to) => filter({ to })}
            />
          </FormField>
          <FormField label="مرتب‌سازی" id="ticket-sort">
            <select
              id="ticket-sort"
              className="h-11 rounded-xl border bg-surface px-3"
              value={query.sort}
              onChange={(e) =>
                filter({ sort: e.target.value as PreviewQuery['sort'] })
              }
            >
              <option value="departure">تاریخ حرکت</option>
              <option value="title">عنوان</option>
              <option value="updated">آخرین ویرایش</option>
            </select>
          </FormField>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                filter({
                  direction: query.direction === 'asc' ? 'desc' : 'asc',
                })
              }
            >
              {query.direction === 'asc' ? 'صعودی ↑' : 'نزولی ↓'}
            </Button>
            <Button variant="ghost" onClick={() => setQuery(initialQuery)}>
              پاک‌کردن فیلترها
            </Button>
          </div>
        </div>
        {query.from && query.to && query.from > query.to ? (
          <Alert tone="error" title="پایان بازه جست‌وجو قبل از شروع آن است." />
        ) : null}
        {preview ? (
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              بررسی حالت‌های رابط — فقط شبیه‌سازی
            </summary>
            <select
              aria-label="حالت آزمایشی رابط"
              className="mt-2 rounded-lg border bg-surface p-2 text-sm"
              value={state}
              onChange={(e) =>
                setState(e.target.value as keyof typeof previewStates)
              }
            >
              {Object.entries(previewStates).map(([key, value]) => (
                <option value={key} key={key}>
                  {value}
                </option>
              ))}
            </select>
          </details>
        ) : null}
      </Card>
      {!preview ? (
        <EmptyState
          icon={Plane}
          title="فهرست عملیاتی هنوز در دسترس نیست"
          description="برای بررسی فرم‌ها و منطق مرحله A، پیش‌نمایش مستقل را آغاز کنید. هیچ محصول واقعی از API دریافت نشده است."
        />
      ) : state !== 'ready' ? (
        <>
          <Badge>حالت شبیه‌سازی رابط</Badge>
          <CatalogState state={state} />
          <Button variant="outline" onClick={() => setState('ready')}>
            بازگشت به پیش‌نمایش
          </Button>
        </>
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="برنامه‌ای یافت نشد"
          description="برنامه نمایشی جدید بسازید یا فیلترها را پاک کنید."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-right text-sm">
                <caption className="border-b bg-primary/5 px-4 py-3 text-right font-semibold">
                  برنامه‌های ساختگی • قیمت‌ها و ظرفیت‌ها آزمایشی‌اند
                </caption>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    {[
                      'برنامه / ایرلاین',
                      'مسیر / کلاس',
                      'حرکت / رسیدن',
                      'تأمین / وضعیت',
                      'ظرفیت تعریف‌شده',
                      'آخرین نرخ نمایشی',
                      'عملیات',
                    ].map((heading) => (
                      <th className="px-4 py-3" key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((product) => {
                    const segment = product.definition.segments[0]!;
                    const fare = product.fares.at(-1)!;
                    return (
                      <tr
                        key={product.id}
                        className="border-t align-top hover:bg-muted/20"
                      >
                        <td className="space-y-2 px-4 py-4">
                          <p className="font-bold">
                            {product.definition.title}
                          </p>
                          <p dir="ltr" className="text-right">
                            {segment.flightNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {label('airline', segment.airlineId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            نسخه {product.version.toLocaleString('fa-IR')}
                          </p>
                        </td>
                        <td className="space-y-2 px-4 py-4">
                          <p>
                            {label('airport', segment.originAirportId)} ←{' '}
                            {label('airport', segment.destinationAirportId)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {label(
                              'flightClass',
                              product.definition.flightClassId,
                            )}
                          </p>
                        </td>
                        <td className="space-y-2 whitespace-nowrap px-4 py-4">
                          <p>
                            {displayTime(
                              segment.departureAt,
                              segment.departureZone,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {displayTime(
                              segment.arrivalAt,
                              segment.arrivalZone,
                            )}
                          </p>
                          <p className="text-xs" dir="ltr">
                            {segment.departureZone}
                          </p>
                        </td>
                        <td className="space-y-2 px-4 py-4">
                          <Badge>{statusLabels[product.status]}</Badge>
                          <p>{supplyLabels[product.definition.supplyType]}</p>
                          <p className="text-xs text-muted-foreground">
                            ورود{' '}
                            {product.definition.entryMethod === 'manual'
                              ? 'دستی'
                              : 'API'}
                          </p>
                        </td>
                        <td className="space-y-2 px-4 py-4">
                          <p className="font-bold">
                            {product.definition.totalCapacity.toLocaleString(
                              'fa-IR',
                            )}{' '}
                            <span className="text-xs font-normal">نمایشی</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Hold / قطعی / باقی‌مانده: —
                          </p>
                          <p className="text-xs text-muted-foreground">
                            منتظر رزرواسیون
                          </p>
                        </td>
                        <td className="space-y-2 px-4 py-4">
                          <p dir="ltr">
                            {fare.sale} {fare.currencyCode || 'ارز انتخاب نشده'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            نسخه نرخ {fare.version.toLocaleString('fa-IR')}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              onClick={() => setForm({ mode: 'view', product })}
                            >
                              <Eye className="size-4" aria-hidden />
                              مشاهده
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={
                                product.status !== 'draft' &&
                                product.status !== 'paused'
                              }
                              onClick={() => setForm({ mode: 'edit', product })}
                            >
                              <FilePenLine className="size-4" aria-hidden />
                              ویرایش
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => copy(product)}
                            >
                              <Copy className="size-4" aria-hidden />
                              کپی
                            </Button>
                            {transitions[product.status].map((status) => (
                              <Button
                                key={status}
                                variant="outline"
                                onClick={() => {
                                  setProblem('');
                                  setReason('');
                                  setStatusChange({ product, status });
                                }}
                              >
                                {statusLabels[status]} نمایشی
                              </Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <nav
            aria-label="صفحه‌بندی بلیت‌ها"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span>
              {result.total.toLocaleString('fa-IR')} برنامه نمایشی • صفحه{' '}
              {result.page.toLocaleString('fa-IR')} از{' '}
              {result.pages.toLocaleString('fa-IR')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={result.page <= 1}
                onClick={() => setQuery({ ...query, page: result.page - 1 })}
              >
                صفحه قبل
              </Button>
              <Button
                variant="outline"
                disabled={result.page >= result.pages}
                onClick={() => setQuery({ ...query, page: result.page + 1 })}
              >
                صفحه بعد
              </Button>
            </div>
          </nav>
        </>
      )}
      <ReferenceBrowser onSelect={selectReference} />
      {references.length ? (
        <p className="text-xs text-muted-foreground">
          مراجع انتخاب‌شده برای فرم: {references.map((r) => r.name).join('، ')}{' '}
          — Snapshot خواندنی؛ فعال‌سازی واقعی نیازمند اعتبارسنجی دوباره سرور
          است.
        </p>
      ) : null}
      <Card className="p-5 space-y-3">
        <h2 className="font-bold">وضعیت اتصال و توسعه بعدی</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <p>پیاده‌شده: اعتبارسنجی، نسخه نرخ، قواعد وضعیت و ظرفیت</p>
          <p>نمایشی: ایجاد، مشاهده، ویرایش، کپی و تاریخچه همین جلسه</p>
          <p>منتظر API: مراجع پرواز، مجوز بلیت و رزرواسیون</p>
          <p>منتظر Migration: ذخیره پایدار، Audit و تراکنش ظرفیت</p>
        </div>
        <p className="text-xs leading-6 text-muted-foreground">
          خروجی فهرست با همان فیلتر و دسترسی، Import/Export گروهی و برنامه
          تکرارشونده در نقشه توسعه‌اند. خروجی فایل تا قرارداد عمومی و Worker
          غیرفعال است. Manifest و مدارک مسافر متعلق به این ماژول نیستند.
        </p>
      </Card>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className="start-auto! left-1/2! max-h-[90vh] max-w-4xl overflow-y-auto"
        >
          <DialogTitle>
            {form?.mode === 'view'
              ? 'مشاهده برنامه نمایشی'
              : form?.mode === 'edit'
                ? 'ویرایش برنامه نمایشی'
                : 'برنامه جدید نمایشی'}
          </DialogTitle>
          <DialogDescription>
            اطلاعات همین جلسه؛ بدون ذخیره در سرور
          </DialogDescription>
          {form ? (
            <div className="mt-5">
              <TicketForm
                initial={form.product?.definition ?? emptyInput()}
                references={references}
                onSave={save}
                onCancel={() => setForm(null)}
                readOnly={form.mode === 'view'}
              />
              {form.product ? (
                <section className="mt-6 space-y-3 border-t pt-4">
                  <h3 className="font-bold">
                    تاریخچه واقعی همین پیش‌نمایش (Audit سرور نیست)
                  </h3>
                  {form.product.history.map((item) => (
                    <p className="text-sm" key={item.version}>
                      نسخه {item.version} • {item.actor} •{' '}
                      {displayTime(item.at)} • {item.reason}
                    </p>
                  ))}
                  <h3 className="font-bold">نسخه‌های نرخ — حفظ مقادیر پیشین</h3>
                  {form.product.fares.map((fare) => (
                    <p className="text-sm" key={fare.version}>
                      نسخه {fare.version}: خرید {fare.purchase} / فروش{' '}
                      {fare.sale} {fare.currencyCode || '(بدون ارز)'} •{' '}
                      {displayTime(fare.createdAt)}
                    </p>
                  ))}
                </section>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(statusChange)}
        onOpenChange={(open) => {
          if (!open) setStatusChange(null);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>تأیید تغییر وضعیت نمایشی</DialogTitle>
          <DialogDescription>
            فعال‌سازی به همه مراجع معتبر و نرخ دارای اعتبار نیاز دارد. توقف فروش
            تخصیص‌ها را آزاد نمی‌کند. لغو برنامه تخصیص‌یافته مسدود است.
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <FormField label="دلیل تغییر وضعیت" id="ticket-status-reason">
            <Input
              id="ticket-status-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <Button className="mt-4" onClick={applyStatus}>
            اعمال {statusChange ? statusLabels[statusChange.status] : ''} فقط در
            پیش‌نمایش
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
