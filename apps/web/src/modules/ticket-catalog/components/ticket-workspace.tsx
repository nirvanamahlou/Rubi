'use client';

import { useEffect, useState } from 'react';
import { BusFront, Plane, Plus, Tickets, TrainFront } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  createProduct,
  reviseProduct,
  transitionProduct,
  type CatalogStatus,
  type Product,
  type ProductInput,
  type Reference,
  type ReferenceResolver,
} from '../model/catalog';
import {
  activateCatalogSample,
  catalogSamples,
  catalogStorageKey,
  displayTime,
  emptyInput,
  groupProductsForCards,
  initialQuery,
  parseCatalogSnapshot,
  queryProducts,
  moveDefinitionToDate,
  repeatDefinition,
  replacePreview,
  statusLabels,
  supplyLabels,
  transportLabels,
  type PreviewQuery,
  type RepeatCadence,
} from '../model/preview';
import { TicketCatalogCard } from './ticket-catalog-card';
import { TicketDetails } from './ticket-details';
import { TicketForm } from './ticket-form';
import formStyles from './ticket-form.module.css';
import { TicketDatePicker } from './ticket-date-picker';

const actor = 'کاربر جاری';
const transportIcons = {
  flight: Plane,
  train: TrainFront,
  bus: BusFront,
};

export function TicketWorkspace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState<PreviewQuery>(initialQuery);
  const [form, setForm] = useState<{
    mode: 'create' | 'view' | 'edit';
    product?: Product;
    initial?: ProductInput;
  } | null>(null);
  const [, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [statusChange, setStatusChange] = useState<{
    product: Product;
    status: CatalogStatus;
  } | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product>();
  const [repeat, setRepeat] = useState<{
    product: Product;
    cadence: RepeatCadence;
    count: number;
    startDate: string;
  }>();
  const [reason, setReason] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = parseCatalogSnapshot(
        localStorage.getItem(catalogStorageKey),
      );
      if (stored) {
        setProducts(
          stored.products.map((product) =>
            activateCatalogSample(product, new Date().toISOString()),
          ),
        );
        setReferences(stored.references);
      } else setProducts(catalogSamples(new Date().toISOString()));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      catalogStorageKey,
      JSON.stringify({ products, references }),
    );
  }, [hydrated, products, references]);

  const result = queryProducts(products, query);
  const cardGroups = groupProductsForCards(result.rows);
  const resolve: ReferenceResolver = (kind, id) =>
    references.find((r) => r.kind === kind && r.id === id);
  const referenceLabel = (
    kind: Reference['kind'],
    id: string,
    fallback: string,
  ) => resolve(kind, id)?.name ?? fallback;
  function rememberReference(value: Reference) {
    setReferences((rows) => [
      ...rows.filter((r) => r.id !== value.id || r.kind !== value.kind),
      value,
    ]);
  }
  function save(inputs: readonly ProductInput[], editReason: string) {
    if (!form || form.mode === 'view') throw new Error('فرم قابل ویرایش نیست.');
    const now = new Date().toISOString();
    const current = form.product;
    if (current && inputs.length !== 1)
      throw new Error('ویرایش باید روی همان بلیت انجام شود.');
    let updated = products;
    if (current) {
      const next = reviseProduct(
        current,
        inputs[0]!,
        current.version,
        resolve,
        now,
        actor,
        editReason.trim() || 'ویرایش اطلاعات بلیت',
        {
          total: current.definition.totalCapacity,
          version: 0,
          allocations: [],
        },
      );
      updated = replacePreview(updated, next, current.version);
    } else {
      for (const input of inputs) {
        const next = createProduct(
          `ticket-${crypto.randomUUID()}`,
          input,
          resolve,
          now,
          actor,
        );
        updated = replacePreview(updated, next);
      }
    }
    setProducts(updated);
    setForm(null);
    setProblem('');
    setNotice(
      inputs.length === 2
        ? 'دو بلیت مستقل رفت و برگشت ذخیره شد.'
        : current
          ? 'تغییرات بلیت ذخیره شد.'
          : 'بلیت جدید ذخیره شد.',
    );
  }
  function applyRepeat() {
    if (!repeat) return;
    try {
      if (
        !Number.isSafeInteger(repeat.count) ||
        repeat.count < 1 ||
        repeat.count > 24
      )
        throw new Error('تعداد تکرار باید بین ۱ تا ۲۴ باشد.');
      const anchored = moveDefinitionToDate(
        repeat.product.definition,
        repeat.startDate,
      );
      const now = new Date().toISOString();
      let updated = products;
      for (let occurrence = 0; occurrence < repeat.count; occurrence += 1) {
        const definition =
          occurrence === 0
            ? anchored
            : repeatDefinition(anchored, repeat.cadence, occurrence);
        const next = createProduct(
          `ticket-${crypto.randomUUID()}`,
          definition,
          resolve,
          now,
          actor,
        );
        updated = replacePreview(updated, next);
      }
      setProducts(updated);
      setRepeat(undefined);
      setProblem('');
      setNotice(
        `${repeat.count.toLocaleString('fa-IR')} بلیت ${repeat.cadence === 'weekly' ? 'هفتگی' : 'ماهانه'} جدید ساخته شد.`,
      );
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'تکرار بلیت ناموفق بود.',
      );
    }
  }
  function removeProduct() {
    if (!deleteProduct) return;
    setProducts((rows) => rows.filter((row) => row.id !== deleteProduct.id));
    setDeleteProduct(undefined);
    setNotice('بلیت از فهرست این مرورگر حذف شد.');
    setProblem('');
  }
  function applyStatus() {
    if (!statusChange) return;
    try {
      const current = statusChange.product;
      const next = transitionProduct(
        current,
        statusChange.status,
        current.version,
        resolve,
        new Date().toISOString(),
        actor,
        reason.trim() || 'تغییر وضعیت بلیت',
        {
          total: current.definition.totalCapacity,
          version: 0,
          allocations: [],
        },
      );
      setProducts(replacePreview(products, next, current.version));
      setStatusChange(null);
      setProblem('');
      setNotice(`وضعیت بلیت به «${statusLabels[next.status]}» تغییر کرد.`);
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }
  const filter = (patch: Partial<PreviewQuery>) =>
    setQuery({ ...query, ...patch, page: 1 });
  const counts = {
    flight: products.filter((p) => p.definition.transport === 'flight').length,
    train: products.filter((p) => p.definition.transport === 'train').length,
    bus: products.filter((p) => p.definition.transport === 'bus').length,
  };

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="مدیریت و تعریف بلیت‌ها"
        eyebrow="هواپیما • قطار • اتوبوس"
        actions={
          <Button onClick={() => setForm({ mode: 'create' })}>
            <Plus className="size-4" aria-hidden />
            تعریف بلیت جدید
          </Button>
        }
      />
      {problem && !statusChange && !repeat ? (
        <Alert tone="error" title={problem} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/70 p-5 dark:border-blue-900 dark:from-blue-950/70 dark:to-blue-900/30">
          <p className="text-sm text-muted-foreground">کل بلیت‌ها</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-2xl font-black text-blue-800 dark:text-blue-200">
              {hydrated ? products.length.toLocaleString('fa-IR') : '…'}
            </p>
            <Tickets className="size-7 text-blue-600" aria-hidden />
          </div>
        </Card>
        {(['flight', 'train', 'bus'] as const).map((transport) => {
          const Icon = transportIcons[transport];
          const tone = {
            flight:
              'border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-100/70 dark:border-cyan-900 dark:from-cyan-950/70 dark:to-sky-900/30',
            train:
              'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100/70 dark:border-emerald-900 dark:from-emerald-950/70 dark:to-teal-900/30',
            bus: 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100/70 dark:border-amber-900 dark:from-amber-950/70 dark:to-orange-900/30',
          }[transport];
          return (
            <Card
              className={`flex items-center justify-between p-5 ${tone}`}
              key={transport}
            >
              <div>
                <p className="text-sm text-muted-foreground">
                  {transportLabels[transport]}
                </p>
                <p className="mt-3 text-2xl font-black text-primary">
                  {counts[transport].toLocaleString('fa-IR')}
                </p>
              </div>
              <Icon className="size-7 text-primary" aria-hidden />
            </Card>
          );
        })}
      </div>
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="جست‌وجوی بلیت" id="ticket-search">
            <Input
              id="ticket-search"
              value={query.search}
              placeholder="شماره، شرکت یا مسیر…"
              onChange={(e) => filter({ search: e.target.value })}
            />
          </FormField>
          <FormField label="نوع وسیله" id="ticket-transport-filter">
            <Select
              value={query.transport}
              onValueChange={(transport) => filter({ transport })}
            >
              <SelectTrigger id="ticket-transport-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه</SelectItem>
                {Object.entries(transportLabels).map(([key, value]) => (
                  <SelectItem value={key} key={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="وضعیت" id="ticket-status-filter">
            <Select
              value={query.status}
              onValueChange={(status) => filter({ status })}
            >
              <SelectTrigger id="ticket-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {Object.entries(statusLabels).map(([key, value]) => (
                  <SelectItem value={key} key={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="نوع تأمین" id="ticket-supply-filter">
            <Select
              value={query.supply}
              onValueChange={(supply) => filter({ supply })}
            >
              <SelectTrigger id="ticket-supply-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه انواع</SelectItem>
                {Object.entries(supplyLabels).map(([key, value]) => (
                  <SelectItem value={key} key={key}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="حرکت از تاریخ" id="ticket-filter-from">
            <TicketDatePicker
              id="ticket-filter-from"
              value={query.from}
              onChange={(from) => filter({ from })}
            />
          </FormField>
          <FormField label="حرکت تا تاریخ" id="ticket-filter-to">
            <TicketDatePicker
              id="ticket-filter-to"
              value={query.to}
              onChange={(to) => filter({ to })}
            />
          </FormField>
          <FormField label="مرتب‌سازی" id="ticket-sort">
            <Select
              value={query.sort}
              onValueChange={(sort) =>
                filter({ sort: sort as PreviewQuery['sort'] })
              }
            >
              <SelectTrigger id="ticket-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="departure">تاریخ حرکت</SelectItem>
                <SelectItem value="title">عنوان خودکار</SelectItem>
                <SelectItem value="updated">آخرین ویرایش</SelectItem>
              </SelectContent>
            </Select>
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
      </Card>
      {!hydrated ? (
        <EmptyState
          title="در حال آماده‌سازی فهرست…"
          description="اطلاعات ذخیره‌شده در حال بارگذاری است."
        />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="بلیتی یافت نشد"
          description="بلیت جدید بسازید یا فیلترها را پاک کنید."
        />
      ) : (
        <>
          <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cardGroups.map((group) => (
              <div
                key={group[0]!.definition.tripGroupId ?? group[0]!.id}
                className={
                  group.length > 1
                    ? 'grid gap-3 md:col-span-2 md:grid-cols-2'
                    : undefined
                }
              >
                {group.map((product) => (
                  <TicketCatalogCard
                    key={product.id}
                    product={product}
                    referenceLabel={referenceLabel}
                    onView={() => setForm({ mode: 'view', product })}
                    onEdit={() => setForm({ mode: 'edit', product })}
                    onRepeat={() =>
                      setRepeat({
                        product,
                        cadence: 'weekly',
                        count: 1,
                        startDate: '',
                      })
                    }
                    onDelete={() => setDeleteProduct(product)}
                    onStatus={(status) => {
                      setProblem('');
                      setReason('');
                      setStatusChange({ product, status });
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <nav
            aria-label="صفحه‌بندی بلیت‌ها"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span>
              {result.total.toLocaleString('fa-IR')} بلیت • صفحه{' '}
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
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className={`${formStyles.dialog} start-auto! left-1/2! max-w-4xl`}
        >
          <DialogTitle className="pe-10">
            {form?.mode === 'view'
              ? 'مشاهده بلیت'
              : form?.mode === 'edit'
                ? 'ویرایش بلیت'
                : 'تعریف بلیت جدید'}
          </DialogTitle>
          <DialogDescription>
            {form?.mode === 'view'
              ? 'اطلاعات کامل مسیر، زمان، ظرفیت و نرخ این بلیت را مشاهده کنید.'
              : 'اطلاعات مسیر، زمان، ظرفیت و نرخ خرید را کامل کنید.'}
          </DialogDescription>
          {form ? (
            <div className="mt-5">
              {form.mode === 'view' && form.product ? (
                <TicketDetails
                  product={form.product}
                  referenceLabel={referenceLabel}
                />
              ) : (
                <TicketForm
                  initial={
                    form.initial ?? form.product?.definition ?? emptyInput()
                  }
                  references={references}
                  onReference={rememberReference}
                  onSave={save}
                  onCancel={() => setForm(null)}
                  allowRoundTrip={form.mode === 'create' && !form.initial}
                />
              )}
              {form.product ? (
                <section className="mt-6 space-y-3 border-t pt-4">
                  <h3 className="font-bold">تاریخچه تغییرات</h3>
                  {form.product.history.map((item) => (
                    <p className="text-sm" key={item.version}>
                      نسخه {item.version} • {item.actor} •{' '}
                      {displayTime(item.at)} • {item.reason}
                    </p>
                  ))}
                  <h3 className="font-bold">نسخه‌های نرخ خرید</h3>
                  {form.product.fares.map((fare) => (
                    <p className="text-sm" key={fare.version}>
                      نسخه {fare.version}: {fare.purchase}{' '}
                      {fare.currencyCode || '—'} • {displayTime(fare.createdAt)}
                    </p>
                  ))}
                </section>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(repeat)}
        onOpenChange={(open) => {
          if (!open) setRepeat(undefined);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>تکرار هفتگی یا ماهانه بلیت</DialogTitle>
          <DialogDescription>
            تاریخ اولین بلیت جدید را انتخاب کنید؛ تکرارهای بعدی با همان ساعت و
            ظرفیت از این تاریخ ساخته می‌شوند.
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <FormField
            label="تاریخ اولین بلیت جدید"
            id="ticket-repeat-start-date"
          >
            <TicketDatePicker
              id="ticket-repeat-start-date"
              value={repeat?.startDate ?? ''}
              required
              onChange={(startDate) =>
                repeat && setRepeat({ ...repeat, startDate })
              }
            />
          </FormField>
          <FormField label="دوره تکرار" id="ticket-repeat-cadence">
            <Select
              value={repeat?.cadence ?? 'weekly'}
              onValueChange={(cadence) =>
                repeat &&
                setRepeat({ ...repeat, cadence: cadence as RepeatCadence })
              }
            >
              <SelectTrigger id="ticket-repeat-cadence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="weekly">هفتگی</SelectItem>
                <SelectItem value="monthly">ماهانه</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="تعداد بلیت جدید" id="ticket-repeat-count">
            <Input
              id="ticket-repeat-count"
              type="number"
              min={1}
              max={24}
              value={repeat?.count ?? 1}
              onChange={(event) =>
                repeat &&
                setRepeat({ ...repeat, count: Number(event.target.value) })
              }
            />
          </FormField>
          <Button
            className="mt-4"
            disabled={!repeat?.startDate}
            onClick={applyRepeat}
          >
            ساخت بلیت‌های تکرارشونده
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleteProduct)}
        onOpenChange={(open) => {
          if (!open) setDeleteProduct(undefined);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>حذف بلیت</DialogTitle>
          <DialogDescription>
            «{deleteProduct?.definition.title}» از فهرست این مرورگر حذف شود؟
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button variant="destructive" onClick={removeProduct}>
              حذف بلیت
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteProduct(undefined)}
            >
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(statusChange)}
        onOpenChange={(open) => {
          if (!open) setStatusChange(null);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>تغییر وضعیت بلیت</DialogTitle>
          <DialogDescription>
            فعال‌سازی به مراجع معتبر، ظرفیت مثبت و نرخ معتبر نیاز دارد.
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
            اعمال {statusChange ? statusLabels[statusChange.status] : ''}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
