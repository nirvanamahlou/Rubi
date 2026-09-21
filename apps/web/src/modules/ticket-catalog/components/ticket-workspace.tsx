'use client';

import { useEffect, useRef, useState } from 'react';
import type { TicketOfferCreateV1, TicketOfferV1 } from '@nora/contracts';
import {
  BusFront,
  Plane,
  Plus,
  Ticket,
  TicketCheck,
  TrainFront,
  Trash2,
} from 'lucide-react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import {
  createProduct,
  reviseProduct,
  transitionProduct,
  type CatalogStatus,
  type Inventory,
  type Product,
  type ProductInput,
  type Reference,
  type ReferenceResolver,
} from '../model/catalog';
import {
  activateDraftCatalogProduct,
  catalogStorageKey,
  countProductsByRoute,
  displayTime,
  emptyInput,
  groupProductsForCards,
  initialQuery,
  parseCatalogSnapshot,
  pauseExpiredCatalogProduct,
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
import { ConnectedIssuedTicketsWorkspace } from './issued-tickets-workspace';
import { TourWorkspace } from './tour-workspace';
import { toursApi } from '../api/tours';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

const actor = 'کاربر جاری';
const transportIcons = {
  flight: Plane,
  train: TrainFront,
  bus: BusFront,
};

function availableInventory(product: Product): Inventory {
  return {
    total: product.definition.totalCapacity,
    version: product.version,
    allocations: [],
  };
}

export function flightOfferInput(
  definition: ProductInput,
  references: readonly Reference[],
): TicketOfferCreateV1 | undefined {
  if (definition.transport !== 'flight') return undefined;
  const firstSegment = definition.segments[0];
  const lastSegment = definition.segments.at(-1);
  if (!firstSegment || !lastSegment)
    throw new Error('حداقل یک مسیر برای بلیط قابل فروش الزامی است.');
  if (
    definition.segments.some(
      (segment) => !segment.departureAt || !segment.arrivalAt,
    )
  )
    throw new Error('ساعت حرکت و رسیدن برای بلیط قابل فروش الزامی است.');
  const carriers = definition.segments.map((segment) =>
    references.find(
      (reference) =>
        reference.kind === 'airline' && reference.id === segment.airlineId,
    ),
  );
  if (
    carriers.some((carrier) => !carrier?.name) ||
    definition.segments.some((segment) => !segment.flightNumber.trim())
  )
    throw new Error('ایرلاین و شماره پرواز برای بلیط قابل فروش الزامی است.');
  const carrierName = [
    ...new Set(carriers.map((carrier) => carrier!.name.trim())),
  ].join(' / ');
  const serviceNumber = definition.segments
    .map((segment) => segment.flightNumber.trim())
    .join(' / ');
  if (carrierName.length > 160 || serviceNumber.length > 80)
    throw new Error(
      'نام ایرلاین‌ها یا شماره‌های پرواز برای ثبت بیش از حد طولانی است.',
    );
  const cabin = references.find(
    (reference) =>
      reference.kind === 'flightClass' &&
      reference.id === definition.flightClassId,
  );
  const classText = `${cabin?.code ?? ''} ${cabin?.name ?? ''}`.toUpperCase();
  const cabinClassCode = classText.includes('FIRST')
    ? 'FIRST'
    : classText.includes('BUSINESS')
      ? 'BUSINESS'
      : 'ECONOMY';
  return {
    originId: firstSegment.originCityId,
    destinationId: lastSegment.destinationCityId,
    departureAt: firstSegment.departureAt,
    arrivalAt: lastSegment.arrivalAt,
    carrierName,
    serviceNumber,
    cabinClassCode,
    totalCapacity: definition.totalCapacity,
  };
}
export function planCatalogPublication(
  items: readonly Product[],
  references: readonly Reference[],
) {
  const problems: string[] = [];
  const publishable = items.flatMap((product) => {
    if (product.id.startsWith('sample-ticket-')) return [];
    try {
      const input = flightOfferInput(product.definition, references);
      if (input && new Date(input.departureAt).getTime() <= Date.now())
        return [];
      return input ? [{ product, input }] : [];
    } catch (error) {
      problems.push(
        `${product.definition.title}: ${error instanceof Error ? error.message : 'اطلاعات ناقص است.'}`,
      );
      return [];
    }
  });
  return { publishable, problems };
}
export function TicketWorkspace() {
  return (
    <>
      <Tabs defaultValue="catalog" dir="rtl" className="space-y-5">
        <TabsList
          aria-label="انتخاب بخش مدیریت بلیط"
          className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] p-2 sm:grid-cols-3 lg:w-fit"
        >
          <TabsTrigger
            className="group min-h-20 justify-start gap-3 border border-transparent px-4 py-3 text-start transition hover:border-primary/20 hover:bg-surface/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            value="catalog"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-data-[state=active]:bg-primary-foreground/15 group-data-[state=active]:text-primary-foreground">
              <Ticket className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-bold">تعریف بلیط قابل فروش</span>
              <span className="mt-1 block text-xs opacity-75">
                مسیر، برنامه حرکت و ظرفیت
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            className="group min-h-20 justify-start gap-3 border border-transparent px-4 py-3 text-start transition hover:border-primary/20 hover:bg-surface/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            value="issued"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-data-[state=active]:bg-primary-foreground/15 group-data-[state=active]:text-primary-foreground">
              <TicketCheck className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-bold">بلیط‌های صادرشده مسافران</span>
              <span className="mt-1 block text-xs opacity-75">
                گزارش صدور، PNR و قرارداد
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            className="min-h-20 rounded-xl px-4 py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            value="tours"
          >
            تعریف تور و خدمات
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tours">
          <TourWorkspace />
        </TabsContent>
        <TabsContent value="catalog">
          <TicketCatalogWorkspace />
        </TabsContent>
        <TabsContent value="issued">
          <ConnectedIssuedTicketsWorkspace />
        </TabsContent>
      </Tabs>
    </>
  );
}

function TicketCatalogWorkspace() {
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
  const [publishedOffers, setPublishedOffers] = useState<
    readonly TicketOfferV1[]
  >([]);
  const [publishedProblem, setPublishedProblem] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, { amount: string; currencyCode: string }>
  >({});
  const [priceSaving, setPriceSaving] = useState<string>();
  const [capacityHold, setCapacityHold] = useState<{
    offer: TicketOfferV1;
    quantity: number;
    expiresAt: string;
  }>();
  const [capacityHoldSaving, setCapacityHoldSaving] = useState(false);
  const backfillStarted = useRef(false);
  const [catalogNow, setCatalogNow] = useState(0);
  const updateCapacityHold = (
    value:
      | {
          offer: TicketOfferV1;
          quantity: number;
          expiresAt: string;
        }
      | undefined,
  ) => {
    setProblem('');
    setCapacityHold(value);
  };
  const updateRepeat = (value: typeof repeat) => {
    setProblem('');
    setRepeat(value);
  };

  const refreshPublishedOffers = async () => {
    setCatalogNow(new Date().getTime());
    try {
      const result = await toursApi.managedOffers();
      setPublishedOffers(result.data);
      setPriceDrafts(
        Object.fromEntries(
          result.data.map((offer) => [
            offer.id,
            {
              amount: offer.standaloneSalePrice?.amount ?? '',
              currencyCode: offer.standaloneSalePrice?.currencyCode ?? 'IRR',
            },
          ]),
        ),
      );
      setPublishedProblem('');
    } catch (error) {
      setPublishedProblem(
        error instanceof Error
          ? error.message
          : 'دریافت بلیط‌های قابل فروش ناموفق بود.',
      );
    }
  };
  const saveStandalonePrice = async (offer: TicketOfferV1) => {
    const draft = priceDrafts[offer.id];
    try {
      if (!draft?.amount || !/^[A-Z]{3}$/.test(draft.currencyCode))
        throw new Error('مبلغ و کد سه‌حرفی ارز را کامل کنید.');
      setPriceSaving(offer.id);
      await toursApi.updateStandaloneSalePrice(
        offer.id,
        {
          expectedRevision: offer.standaloneSalePrice?.revision ?? 0,
          amount: draft.amount,
          currencyCode: draft.currencyCode,
        },
        crypto.randomUUID(),
      );
      await refreshPublishedOffers();
      setPublishedProblem('');
      setNotice('قیمت فروش تکی این مسیر ثبت شد.');
    } catch (error) {
      setPublishedProblem(
        error instanceof Error ? error.message : 'ثبت قیمت تکی ناموفق بود.',
      );
    } finally {
      setPriceSaving(undefined);
    }
  };
  const submitCapacityHold = async () => {
    if (!capacityHold) return;
    try {
      if (
        !Number.isSafeInteger(capacityHold.quantity) ||
        capacityHold.quantity < 1
      )
        throw new Error('تعداد نفرات رزرو باید حداقل ۱ باشد.');
      if (capacityHold.quantity > capacityHold.offer.remainingCapacity)
        throw new Error('تعداد واردشده از ظرفیت باقی‌مانده بیشتر است.');
      const expiresAt = new Date(capacityHold.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())
        throw new Error('تاریخ و ساعت انقضا باید در آینده باشد.');
      setCapacityHoldSaving(true);
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const session = await refreshAuthenticatedSession(base);
      const branchId = session?.user.branches[0]?.id;
      if (!branchId) throw new Error('شعبه مجاز برای رزرو ظرفیت پیدا نشد.');
      const result = await toursApi.temporaryHold(
        capacityHold.offer.id,
        { quantity: capacityHold.quantity, expiresAt: expiresAt.toISOString() },
        branchId,
        crypto.randomUUID(),
      );
      await refreshPublishedOffers();
      setNotice(
        `${result.data.quantity.toLocaleString('fa-IR')} نفر تا ${displayTime(result.data.expiresAt, 'Asia/Tehran')} رزرو شد.`,
      );
      setProblem('');
      updateCapacityHold(undefined);
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'رزرو ظرفیت ناموفق بود.',
      );
    } finally {
      setCapacityHoldSaving(false);
    }
  };
  const publishFlights = async (
    inputs: readonly ProductInput[],
    productIds: readonly string[],
  ) => {
    const publishable = inputs
      .map((input, index) => ({
        input: flightOfferInput(input, references),
        id: productIds[index]!,
      }))
      .filter((item): item is { input: TicketOfferCreateV1; id: string } =>
        Boolean(item.input),
      );
    if (!publishable.length) return;
    const base = getPublicApiBaseUrl();
    if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
    const session = await refreshAuthenticatedSession(base);
    const branchId = session?.user.branches[0]?.id;
    if (!branchId) throw new Error('شعبه مجاز برای ثبت بلیط پیدا نشد.');
    await Promise.all(
      publishable.map(({ input, id }) =>
        toursApi.publishOffer(input, branchId, `ticket-catalog:${id}`),
      ),
    );
    await refreshPublishedOffers();
  };
  const publishExistingFlights = async (
    items: readonly Product[],
    itemReferences: readonly Reference[],
  ) => {
    const { publishable, problems } = planCatalogPublication(
      items,
      itemReferences,
    );
    if (!publishable.length) {
      if (problems.length) setPublishedProblem(problems.join('؛ '));
      return;
    }
    const base = getPublicApiBaseUrl();
    if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
    const session = await refreshAuthenticatedSession(base);
    const branchId = session?.user.branches[0]?.id;
    if (!branchId) throw new Error('شعبه مجاز برای ثبت بلیط پیدا نشد.');
    const existing = (await toursApi.managedOffers()).data;
    const outcomes = await Promise.allSettled(
      publishable.map(({ product, input }) => {
        const match = existing.find(
          (offer) =>
            offer.branchId === branchId &&
            (Object.keys(input) as (keyof TicketOfferCreateV1)[]).every(
              (key) =>
                key === 'departureAt' || key === 'arrivalAt'
                  ? new Date(offer[key]).getTime() ===
                    new Date(input[key]).getTime()
                  : offer[key] === input[key],
            ),
        );
        return match
          ? Promise.resolve({ data: { id: match.id } })
          : toursApi.publishOffer(
              input,
              branchId,
              `ticket-catalog:${product.id}`,
            );
      }),
    );
    await refreshPublishedOffers();
    outcomes.forEach((result, index) => {
      if (result.status === 'rejected')
        problems.push(
          `${publishable[index]!.product.definition.title}: ${result.reason instanceof Error ? result.reason.message : 'ثبت ناموفق بود.'}`,
        );
    });
    if (problems.length) setPublishedProblem(problems.join('؛ '));
  };

  useEffect(() => {
    const refresh = () => void refreshPublishedOffers();
    const timer = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = parseCatalogSnapshot(
        localStorage.getItem(catalogStorageKey),
      );
      if (stored) {
        const now = new Date().toISOString();
        const restoredProducts = stored.products.map((product) =>
          pauseExpiredCatalogProduct(
            activateDraftCatalogProduct(product, now),
            now,
          ),
        );
        setProducts(restoredProducts);
        setReferences(stored.references);
        if (!backfillStarted.current) {
          backfillStarted.current = true;
          void publishExistingFlights(
            restoredProducts,
            stored.references,
          ).catch((error) =>
            setPublishedProblem(
              error instanceof Error
                ? error.message
                : 'اتصال بلیط‌های قبلی به قراردادها ناموفق بود.',
            ),
          );
        }
      } else setProducts([]);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // Hydration must backfill once; adding the render-scoped helper would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      catalogStorageKey,
      JSON.stringify({ products, references }),
    );
  }, [hydrated, products, references]);
  const result = queryProducts(products, query);
  const routeCounts = countProductsByRoute(products);
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
  async function save(inputs: readonly ProductInput[], editReason: string) {
    if (!form || form.mode === 'view') throw new Error('فرم قابل ویرایش نیست.');
    const now = new Date().toISOString();
    const current = form.product;
    if (current && inputs.length !== 1)
      throw new Error('ویرایش باید روی همان بلیط انجام شود.');
    let updated = products;
    const createdIds: string[] = [];
    if (current) {
      const next = reviseProduct(
        current,
        inputs[0]!,
        current.version,
        resolve,
        now,
        actor,
        editReason.trim() || 'ویرایش اطلاعات بلیط',
        {
          total: current.definition.totalCapacity,
          version: 0,
          allocations: [],
        },
      );
      updated = replacePreview(updated, next, current.version);
    } else {
      for (const input of inputs) {
        const next = activateDraftCatalogProduct(
          createProduct(
            `ticket-${crypto.randomUUID()}`,
            input,
            resolve,
            now,
            actor,
          ),
          now,
        );
        updated = replacePreview(updated, next);
        createdIds.push(next.id);
      }
    }
    if (!current) await publishFlights(inputs, createdIds);
    else {
      const nextInput = flightOfferInput(inputs[0]!, references);
      if (nextInput) {
        let previous: TicketOfferCreateV1 | undefined;
        try {
          previous = flightOfferInput(current.definition, references);
        } catch {
          /* Legacy incomplete definitions have no published offer. */
        }
        const offers = (await toursApi.managedOffers()).data;
        const matches = previous
          ? offers.filter(
              (offer) =>
                offer.originId === previous!.originId &&
                offer.destinationId === previous!.destinationId &&
                new Date(offer.departureAt).getTime() ===
                  new Date(previous!.departureAt).getTime() &&
                new Date(offer.arrivalAt).getTime() ===
                  new Date(previous!.arrivalAt).getTime() &&
                offer.serviceNumber === previous!.serviceNumber &&
                offer.carrierName === previous!.carrierName &&
                offer.cabinClassCode === previous!.cabinClassCode &&
                offer.totalCapacity === previous!.totalCapacity,
            )
          : [];
        if (matches.length > 1)
          throw new Error(
            'بیش از یک بلیط مشابه در فروش ثبت شده؛ ابتدا بلیط مرتبط را مشخص کنید.',
          );
        if (matches[0])
          await toursApi.reviseOffer(
            matches[0].id,
            matches[0].version,
            nextInput,
          );
        else await publishFlights(inputs, [current.id]);
        await refreshPublishedOffers();
      }
    }
    setProducts(updated);
    setForm(null);
    setProblem('');
    setNotice(
      inputs.length === 2
        ? 'دو بلیط مستقل رفت و برگشت ذخیره شد.'
        : current
          ? 'تغییرات بلیط ذخیره شد.'
          : 'بلیط جدید ذخیره شد.',
    );
  }
  async function applyRepeat() {
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
        const next = activateDraftCatalogProduct(
          createProduct(
            `ticket-${crypto.randomUUID()}`,
            definition,
            resolve,
            now,
            actor,
          ),
          now,
        );
        await publishFlights([definition], [next.id]);
        updated = replacePreview(updated, next);
      }
      setProducts(updated);
      updateRepeat(undefined);
      setProblem('');
      setNotice(
        `${repeat.count.toLocaleString('fa-IR')} بلیط ${repeat.cadence === 'weekly' ? 'هفتگی' : 'ماهانه'} جدید ساخته شد.`,
      );
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'تکرار بلیط ناموفق بود.',
      );
    }
  }
  function removeProduct() {
    if (!deleteProduct) return;
    setProducts((rows) => rows.filter((row) => row.id !== deleteProduct.id));
    setDeleteProduct(undefined);
    setNotice('بلیط از فهرست این مرورگر حذف شد.');
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
        statusChange.status === 'active'
          ? 'فعال‌سازی مجدد فروش بلیط'
          : 'توقف فروش بلیط',
        {
          total: current.definition.totalCapacity,
          version: 0,
          allocations: [],
        },
      );
      setProducts(replacePreview(products, next, current.version));
      setStatusChange(null);
      setProblem('');
      setNotice(`وضعیت بلیط به «${statusLabels[next.status]}» تغییر کرد.`);
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
  const routeOptions = (() => {
    const origins = new Map<string, string>();
    const destinations = new Map<string, string>();
    for (const product of products) {
      const segment = product.definition.segments[0]!;
      const lastSegment = product.definition.segments.at(-1)!;
      origins.set(
        segment.originCityId,
        referenceLabel(
          'city',
          segment.originCityId,
          product.definition.display?.origin || 'مبدأ نامشخص',
        ),
      );
      destinations.set(
        lastSegment.destinationCityId,
        referenceLabel(
          'city',
          lastSegment.destinationCityId,
          product.definition.display?.destination || 'مقصد نامشخص',
        ),
      );
    }
    return { origins: [...origins], destinations: [...destinations] };
  })();

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="مدیریت و تعریف بلیط‌ها"
        eyebrow="هواپیما • قطار • اتوبوس"
        actions={
          <Button onClick={() => setForm({ mode: 'create' })}>
            <Plus className="size-4" aria-hidden />
            تعریف بلیط جدید
          </Button>
        }
      />
      {problem && !statusChange && !repeat ? (
        <Alert tone="error" title={problem} />
      ) : null}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/5 px-4 py-3">
          <div>
            <h2 className="font-bold">بلیط‌های ثبت‌شده برای فروش و قرارداد</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              این فهرست همان منبع انتخاب بلیط در قرارداد جدید است.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refreshPublishedOffers()}
          >
            به‌روزرسانی فهرست
          </Button>
        </div>
        {publishedProblem ? (
          <Alert className="m-4" tone="error" title={publishedProblem} />
        ) : publishedOffers.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start">ایرلاین / پرواز</th>
                  <th className="px-4 py-3 text-start">مسیر</th>
                  <th className="px-4 py-3 text-right">حرکت</th>
                  <th className="px-4 py-3 text-start">ظرفیت قابل فروش</th>
                  <th className="min-w-64 px-4 py-3 text-start">
                    قیمت فروش تکی هر صندلی
                  </th>
                  <th className="px-4 py-3 text-start">وضعیت</th>
                  <th className="px-4 py-3 text-start">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {publishedOffers.map((offer) => (
                  <tr key={offer.id} className="border-t">
                    <td className="px-4 py-3 font-medium">
                      {offer.carrierName} ·{' '}
                      <span dir="ltr">{offer.serviceNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      {referenceLabel('city', offer.originId, offer.originId)} ←{' '}
                      {referenceLabel(
                        'city',
                        offer.destinationId,
                        offer.destinationId,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <time
                        dateTime={offer.departureAt}
                        dir="rtl"
                        lang="fa"
                        className="block whitespace-nowrap text-right tabular-nums"
                      >
                        {displayTime(offer.departureAt, 'Asia/Tehran')}
                      </time>
                    </td>
                    <td className="px-4 py-3">
                      {offer.remainingCapacity.toLocaleString('fa-IR')} از{' '}
                      {offer.totalCapacity.toLocaleString('fa-IR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-60 items-end gap-2">
                        <FormField label="مبلغ">
                          <Input
                            dir="ltr"
                            inputMode="decimal"
                            className="h-9 min-w-32 text-left tabular-nums"
                            value={priceDrafts[offer.id]?.amount ?? ''}
                            onChange={(event) =>
                              setPriceDrafts((current) => ({
                                ...current,
                                [offer.id]: {
                                  amount: event.target.value,
                                  currencyCode:
                                    current[offer.id]?.currencyCode ?? 'IRR',
                                },
                              }))
                            }
                          />
                        </FormField>
                        <FormField label="ارز">
                          <Input
                            dir="ltr"
                            maxLength={3}
                            className="h-9 w-20 text-left uppercase"
                            value={priceDrafts[offer.id]?.currencyCode ?? 'IRR'}
                            onChange={(event) =>
                              setPriceDrafts((current) => ({
                                ...current,
                                [offer.id]: {
                                  amount: current[offer.id]?.amount ?? '',
                                  currencyCode:
                                    event.target.value.toUpperCase(),
                                },
                              }))
                            }
                          />
                        </FormField>
                        <Button
                          size="sm"
                          type="button"
                          disabled={
                            priceSaving === offer.id ||
                            !priceDrafts[offer.id]?.amount
                          }
                          onClick={() => void saveStandalonePrice(offer)}
                        >
                          ثبت
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {offer.status === 'ACTIVE' ? 'فعال' : offer.status}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(offer.departureAt).getTime() <= catalogNow ? (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`حذف بلیط تاریخ‌گذشته ${offer.serviceNumber}`}
                          title="حذف بلیط تاریخ‌گذشته"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `بلیط ${offer.serviceNumber} از فهرست حذف شود؟ سوابق قرارداد و مالی حفظ می‌شود.`,
                              )
                            )
                              return;
                            try {
                              await toursApi.archiveExpiredOffer(
                                offer.id,
                                offer.version,
                              );
                              await refreshPublishedOffers();
                            } catch (error) {
                              setPublishedProblem(
                                error instanceof Error
                                  ? error.message
                                  : 'حذف بلیط ناموفق بود.',
                              );
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            offer.status !== 'ACTIVE' ||
                            offer.remainingCapacity < 1
                          }
                          onClick={() =>
                            updateCapacityHold({
                              offer,
                              quantity: 1,
                              expiresAt: new Date(Date.now() + 60 * 60 * 1000)
                                .toISOString()
                                .slice(0, 16),
                            })
                          }
                        >
                          رزرو ظرفیت
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-muted-foreground">
            هنوز بلیط قابل فروش ثبت نشده است.
          </p>
        )}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/70 p-5 dark:border-blue-900 dark:from-blue-950/70 dark:to-blue-900/30">
          <p className="text-sm text-muted-foreground">کل بلیط‌ها</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-2xl font-black text-blue-800 dark:text-blue-200">
              {hydrated ? products.length.toLocaleString('fa-IR') : '…'}
            </p>
            <Ticket className="size-7 text-blue-600" aria-hidden />
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
      <Card className="p-4">
        <h2 className="font-bold">جمع بلیط‌های تعریف‌شده در هر مسیر</h2>
        {routeCounts.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {routeCounts.map((route) => (
              <Button
                key={route.key}
                type="button"
                size="sm"
                variant={
                  query.originCityId === route.originCityId &&
                  query.destinationCityId === route.destinationCityId
                    ? 'primary'
                    : 'outline'
                }
                onClick={() =>
                  filter({
                    originCityId: route.originCityId,
                    destinationCityId: route.destinationCityId,
                  })
                }
              >
                {route.origin} ← {route.destination} •{' '}
                {route.count.toLocaleString('fa-IR')} بلیط
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            پس از تعریف بلیط، جمع هر مسیر اینجا نمایش داده می‌شود.
          </p>
        )}
      </Card>
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="جست‌وجوی بلیط" id="ticket-search">
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
          <FormField label="مبدأ مسیر" id="ticket-origin-filter">
            <Select
              value={query.originCityId}
              onValueChange={(originCityId) => filter({ originCityId })}
            >
              <SelectTrigger id="ticket-origin-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه مبدأها</SelectItem>
                {routeOptions.origins.map(([id, name]) => (
                  <SelectItem value={id} key={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="مقصد مسیر" id="ticket-destination-filter">
            <Select
              value={query.destinationCityId}
              onValueChange={(destinationCityId) =>
                filter({ destinationCityId })
              }
            >
              <SelectTrigger id="ticket-destination-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه مقصدها</SelectItem>
                {routeOptions.destinations.map(([id, name]) => (
                  <SelectItem value={id} key={id}>
                    {name}
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
          title="بلیطی یافت نشد"
          description="بلیط جدید بسازید یا فیلترها را پاک کنید."
        />
      ) : (
        <>
          <div className="grid grid-flow-row-dense items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                    inventory={availableInventory(product)}
                    referenceLabel={referenceLabel}
                    onView={() => setForm({ mode: 'view', product })}
                    onEdit={() => setForm({ mode: 'edit', product })}
                    onRepeat={() =>
                      updateRepeat({
                        product,
                        cadence: 'weekly',
                        count: 1,
                        startDate: '',
                      })
                    }
                    onDelete={() => setDeleteProduct(product)}
                    onStatus={(status) => {
                      setProblem('');
                      setStatusChange({ product, status });
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <nav
            aria-label="صفحه‌بندی بلیط‌ها"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span>
              {result.total.toLocaleString('fa-IR')} بلیط • صفحه{' '}
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
              ? 'مشاهده بلیط'
              : form?.mode === 'edit'
                ? 'ویرایش بلیط'
                : 'تعریف بلیط جدید'}
          </DialogTitle>
          <DialogDescription>
            {form?.mode === 'view'
              ? 'اطلاعات کامل مسیر، زمان، ظرفیت و نرخ این بلیط را مشاهده کنید.'
              : 'اطلاعات مسیر، ظرفیت و نرخ خرید را کامل کنید.'}
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
        open={Boolean(capacityHold)}
        onOpenChange={(open) => {
          if (!open && !capacityHoldSaving) updateCapacityHold(undefined);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>رزرو موقت ظرفیت</DialogTitle>
          <DialogDescription>
            ظرفیت تا زمان انقضا برای این بلیت نگه داشته می‌شود و پس از آن خودکار
            آزاد خواهد شد.
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
            {capacityHold?.offer.carrierName} ·{' '}
            <span dir="ltr">{capacityHold?.offer.serviceNumber}</span> · ظرفیت
            باقی‌مانده:{' '}
            {capacityHold?.offer.remainingCapacity.toLocaleString('fa-IR')}
          </p>
          <FormField
            label="تعداد نفرات"
            id="ticket-capacity-hold-quantity"
            required
          >
            <Input
              id="ticket-capacity-hold-quantity"
              type="number"
              min={1}
              max={capacityHold?.offer.remainingCapacity ?? 1}
              value={capacityHold?.quantity ?? 1}
              onChange={(event) =>
                capacityHold &&
                updateCapacityHold({
                  ...capacityHold,
                  quantity: Number(event.target.value),
                })
              }
            />
          </FormField>
          <FormField
            label="تاریخ و ساعت انقضا"
            id="ticket-capacity-hold-expires-at"
            required
          >
            <TicketDatePicker
              id="ticket-capacity-hold-expires-at"
              includeTime
              required
              value={capacityHold?.expiresAt ?? ''}
              onChange={(expiresAt) =>
                capacityHold &&
                updateCapacityHold({ ...capacityHold, expiresAt })
              }
            />
          </FormField>
          <div className="mt-2 flex gap-2">
            <Button
              disabled={capacityHoldSaving}
              onClick={() => void submitCapacityHold()}
            >
              {capacityHoldSaving ? 'در حال ثبت…' : 'ثبت رزرو موقت'}
            </Button>
            <Button
              disabled={capacityHoldSaving}
              variant="outline"
              onClick={() => updateCapacityHold(undefined)}
            >
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(repeat)}
        onOpenChange={(open) => {
          if (!open) updateRepeat(undefined);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2!">
          <DialogTitle>تکرار هفتگی یا ماهانه بلیط</DialogTitle>
          <DialogDescription>
            تاریخ اولین بلیط جدید را انتخاب کنید؛ تکرارهای بعدی با همان ساعت و
            ظرفیت از این تاریخ ساخته می‌شوند.
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <FormField
            label="تاریخ اولین بلیط جدید"
            id="ticket-repeat-start-date"
          >
            <TicketDatePicker
              id="ticket-repeat-start-date"
              value={repeat?.startDate ?? ''}
              required
              onChange={(startDate) =>
                repeat && updateRepeat({ ...repeat, startDate })
              }
            />
          </FormField>
          <FormField label="دوره تکرار" id="ticket-repeat-cadence">
            <Select
              value={repeat?.cadence ?? 'weekly'}
              onValueChange={(cadence) =>
                repeat &&
                updateRepeat({
                  ...repeat,
                  cadence: cadence as RepeatCadence,
                })
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
          <FormField label="تعداد بلیط جدید" id="ticket-repeat-count">
            <Input
              id="ticket-repeat-count"
              type="number"
              min={1}
              max={24}
              value={repeat?.count ?? 1}
              onChange={(event) =>
                repeat &&
                updateRepeat({
                  ...repeat,
                  count: Number(event.target.value),
                })
              }
            />
          </FormField>
          <Button
            className="mt-4"
            disabled={!repeat?.startDate}
            onClick={() => void applyRepeat()}
          >
            ساخت بلیط‌های تکرارشونده
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
          <DialogTitle>حذف بلیط</DialogTitle>
          <DialogDescription>
            «{deleteProduct?.definition.title}» از فهرست این مرورگر حذف شود؟
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button variant="destructive" onClick={removeProduct}>
              حذف بلیط
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
          <DialogTitle>
            {statusChange?.status === 'active'
              ? 'فعال‌کردن فروش بلیط'
              : 'توقف فروش بلیط'}
          </DialogTitle>
          <DialogDescription>
            {statusChange?.status === 'active'
              ? 'پس از تأیید، این بلیط دوباره برای فروش در دسترس قرار می‌گیرد.'
              : 'پس از تأیید، فروش این بلیط متوقف می‌شود و بعداً می‌توانید دوباره آن را فعال کنید.'}
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <Button className="mt-4" onClick={applyStatus}>
            {statusChange?.status === 'active' ? 'فعال‌کردن فروش' : 'توقف فروش'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
