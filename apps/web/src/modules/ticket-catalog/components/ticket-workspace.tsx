'use client';
import { flightCabinCode } from '../model/flight-cabins';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TicketOfferCreateV1, TicketOfferV1 } from '@nora/contracts';
import { Power, Plus, Ticket, TicketCheck, Trash2 } from 'lucide-react';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import {
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
  type Product,
  type ProductInput,
  type Reference,
  type ReferenceResolver,
} from '../model/catalog';
import {
  activateDraftCatalogProduct,
  catalogStorageKey,
  readableCityName,
  displayTime,
  emptyInput,
  isExpiredCatalogProduct,
  parseCatalogSnapshot,
  replacePreview,
  statusLabels,
  type RepeatCadence,
} from '../model/preview';
import {
  repeatedDefinitions,
  publishRepeatedProducts,
} from '../model/repeat-publication';
import { TicketDetails } from './ticket-details';
import { TicketForm } from './ticket-form';
import { FlightScheduleForm } from './flight-schedule-form';
import { FlightLoadGrid } from './flight-load-grid';
import formStyles from './ticket-form.module.css';
import { TicketDatePicker } from './ticket-date-picker';
import { ConnectedIssuedTicketsWorkspace } from './issued-tickets-workspace';
import { toursApi } from '../api/tours';
import { getActiveCityReference } from '../api/references';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

import {
  catalogProductsFromOffers,
  catalogOffer,
  publishedLoadGroups,
  publishedOfferInput,
  samePublishedFlight,
} from '../model/published-catalog';
import { PublishedOfferForm } from './published-offer-form';

const actor = 'کاربر جاری';

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
  const cabinClassCode = flightCabinCode(cabin);
  return {
    originAirportId: firstSegment.originAirportId || null,
    destinationAirportId: lastSegment.destinationAirportId || null,
    originId: firstSegment.originCityId,
    destinationId: lastSegment.destinationCityId,
    departureAt: firstSegment.departureAt,
    arrivalAt: lastSegment.arrivalAt,
    carrierName,
    serviceNumber,
    cabinClassCode,
    totalCapacity: definition.totalCapacity,
    supplyType:
      definition.supplyType === 'company' || definition.supplyType === 'charter'
        ? 'COMPANY'
        : definition.supplyType === 'allotment'
          ? 'FLOATING'
          : 'API',
    economyBaggageKg: definition.economyBaggageKg ?? null,
    businessBaggageKg: definition.businessBaggageKg ?? null,
    manifestTemplateId: definition.manifestTemplateId ?? null,
    returnMinDays: definition.returnMinDays ?? null,
    returnMaxDays: definition.returnMaxDays ?? null,
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

export function findPublishedOffer(
  definition: ProductInput,
  references: readonly Reference[],
  offers: readonly TicketOfferV1[],
) {
  const input = flightOfferInput(definition, references);
  if (!input) return undefined;
  const matches = offers.filter(
    (offer) =>
      offer.originId === input.originId &&
      offer.destinationId === input.destinationId &&
      new Date(offer.departureAt).getTime() ===
        new Date(input.departureAt).getTime() &&
      new Date(offer.arrivalAt).getTime() ===
        new Date(input.arrivalAt).getTime() &&
      offer.serviceNumber === input.serviceNumber &&
      offer.carrierName === input.carrierName &&
      offer.cabinClassCode === input.cabinClassCode &&
      offer.totalCapacity === input.totalCapacity,
  );
  if (matches.length > 1)
    throw new Error(
      'بیش از یک بلیت مشابه در فهرست فروش ثبت شده است؛ فهرست را بررسی کنید.',
    );
  return matches[0];
}

export function requireFutureTicketDates(
  inputs: readonly TicketOfferCreateV1[],
  allowPastDate: boolean,
  now = new Date(),
) {
  if (
    !allowPastDate &&
    inputs.some((input) => new Date(input.departureAt) <= now)
  )
    throw new Error('تاریخ بلیت جدید باید در آینده باشد.');
}

export function TicketWorkspace() {
  return (
    <>
      <Tabs defaultValue="catalog" dir="rtl" className="space-y-5">
        <TabsList
          aria-label="انتخاب بخش تعریف و ظرفیت پرواز"
          className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] p-2 sm:grid-cols-2 lg:w-fit"
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
        </TabsList>
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
  const [form, setForm] = useState<{
    mode: 'create' | 'view' | 'edit';
    product?: Product;
    products?: readonly Product[];
    offers?: readonly TicketOfferV1[];
    initial?: ProductInput;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [statusChange, setStatusChange] = useState<{
    product: Product;
    status: CatalogStatus;
  } | null>(null);
  const [repeat, setRepeat] = useState<{
    product: Product;
    cadence: RepeatCadence;
    count: number;
    startDate: string;
  }>();
  const [repeatSaving, setRepeatSaving] = useState(false);
  const repeatBusy = useRef(false);
  const repeatBatch = useRef<{
    items: Product[];
    completed: Set<string>;
  } | null>(null);
  const [publishedOffers, setPublishedOffers] = useState<
    readonly TicketOfferV1[]
  >([]);
  const [offerForm, setOfferForm] = useState<{
    offer: TicketOfferV1;
    readOnly: boolean;
  } | null>(null);
  const displayedProducts = useMemo(
    () => catalogProductsFromOffers(products, publishedOffers, references),
    [products, publishedOffers, references],
  );
  const [publishedProblem, setPublishedProblem] = useState('');
  const [publishedNotice, setPublishedNotice] = useState('');
  const [publishedRefreshing, setPublishedRefreshing] = useState(false);
  const [statusSaving, setStatusSaving] = useState<string>();
  const [deleteSaving, setDeleteSaving] = useState<string>();
  const [capacityHold, setCapacityHold] = useState<{
    offer: TicketOfferV1;
    quantity: number;
    requesterName: string;
  }>();
  const [capacityHoldSaving, setCapacityHoldSaving] = useState(false);
  const pendingCreate = useRef<{
    signature: string;
    groupId: string;
    ids: string[];
  } | null>(null);
  const backfillStarted = useRef(false);
  const requestedCityNames = useRef(new Set<string>());
  const [catalogNow, setCatalogNow] = useState(0);
  const updateCapacityHold = (
    value:
      | {
          offer: TicketOfferV1;
          quantity: number;
          requesterName: string;
        }
      | undefined,
  ) => {
    setProblem('');
    setCapacityHold(value);
  };
  const updateRepeat = (value: typeof repeat) => {
    if (repeatBusy.current) return;
    repeatBatch.current = null;
    setProblem('');
    setRepeat(value);
  };

  const refreshPublishedOffers = async (announce = false) => {
    setCatalogNow(new Date().getTime());
    if (announce) setPublishedRefreshing(true);
    try {
      const result = await toursApi.managedOffers(true);
      setPublishedOffers(result.data);
      setPublishedProblem('');
      if (announce) setPublishedNotice('فهرست بلیت‌ها به‌روز شد.');
    } catch (error) {
      setPublishedNotice('');
      setPublishedProblem(
        error instanceof Error
          ? error.message
          : 'دریافت بلیط‌های قابل فروش ناموفق بود.',
      );
    } finally {
      if (announce) setPublishedRefreshing(false);
    }
  };
  const updatePublishedStatus = async (
    offer: TicketOfferV1,
    status: 'ACTIVE' | 'PAUSED',
  ) => {
    setStatusSaving(offer.id);
    setPublishedProblem('');
    setPublishedNotice('');
    try {
      await toursApi.updateOfferStatus(offer.id, offer.version, status);
      await refreshPublishedOffers();
      setPublishedNotice(
        status === 'ACTIVE'
          ? 'بلیت فعال شد و در قرارداد جدید قابل انتخاب است.'
          : 'فروش بلیت متوقف شد.',
      );
    } catch (error) {
      setPublishedProblem(
        error instanceof Error ? error.message : 'تغییر وضعیت بلیت ناموفق بود.',
      );
      throw error;
    } finally {
      setStatusSaving(undefined);
    }
  };
  const editPublishedLoad = (visibleOffers: readonly TicketOfferV1[]) => {
    const offers = publishedLoadGroups(
      visibleOffers,
      publishedOffers,
      products,
    );
    const offer = visibleOffers[0];
    if (!offer || !offers.length) {
      setPublishedProblem('ردیفی برای ویرایش در این جدول وجود ندارد.');
      return;
    }
    const selected = displayedProducts.find(
      (item) => item.id === `offer:${offer.id}`,
    );
    const selectedSegment = selected?.definition.segments[0];
    const grouped = offers.flatMap((item) => {
      const product = displayedProducts.find(
        (candidate) => candidate.id === `offer:${item.id}`,
      );
      if (!product || !selectedSegment) return [];
      const segment = product.definition.segments[0]!;
      const sameDirection =
        segment.originCityId === selectedSegment.originCityId &&
        segment.destinationCityId === selectedSegment.destinationCityId;
      return [
        {
          ...product,
          definition: {
            ...product.definition,
            journeyRole: sameDirection
              ? ('outbound' as const)
              : ('return' as const),
          },
        },
      ];
    });
    const product = grouped.find((item) => item.id === `offer:${offer.id}`);
    if (!product || grouped.length !== offers.length) {
      setPublishedProblem(
        'اطلاعات فرم این لود آماده نیست؛ فهرست را به‌روزرسانی کنید.',
      );
      return;
    }
    setOfferForm(null);
    setForm({ mode: 'edit', product, products: grouped, offers });
  };
  const archivePublishedLoad = async (
    visibleOffers: readonly TicketOfferV1[],
  ) => {
    const offers = publishedLoadGroups(
      visibleOffers,
      publishedOffers,
      products,
    );
    if (!offers.length) return;
    setDeleteSaving(offers[0]!.id);
    setPublishedProblem('');
    setPublishedNotice('');
    try {
      await toursApi.archiveOfferBatch(
        offers.map(({ id, version }) => ({ id, expectedVersion: version })),
      );
      await refreshPublishedOffers();
      setPublishedNotice(
        `${offers.length.toLocaleString('fa-IR')} ردیف لود باهم حذف شد؛ سوابق قیمت، خرید، مالی و ممیزی حفظ شده است.`,
      );
    } catch (error) {
      setPublishedProblem(
        error instanceof Error ? error.message : 'حذف لود ناموفق بود.',
      );
    } finally {
      setDeleteSaving(undefined);
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
      if (!capacityHold.requesterName.trim())
        throw new Error('نام درخواست‌کننده رزرو را وارد کنید.');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      setCapacityHoldSaving(true);
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const session = await refreshAuthenticatedSession(base);
      const branchId = capacityHold.offer.branchId;
      if (!session?.user.branches.some((branch) => branch.id === branchId))
        throw new Error('شعبه مجاز برای رزرو ظرفیت پیدا نشد.');
      const result = await toursApi.temporaryHold(
        capacityHold.offer.id,
        {
          quantity: capacityHold.quantity,
          expiresAt: expiresAt.toISOString(),
          requesterName: capacityHold.requesterName.trim(),
        },
        branchId,
        browserRandomUuid(),
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
    allowPastDate = false,
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
    requireFutureTicketDates(
      publishable.map((item) => item.input),
      allowPastDate,
    );
    const base = getPublicApiBaseUrl();
    if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
    const session = await refreshAuthenticatedSession(base);
    const branchId = session?.user.branches[0]?.id;
    if (!branchId) throw new Error('شعبه مجاز برای ثبت بلیط پیدا نشد.');
    // Settle each bounded group before exposing a retry; a failed request must
    // not leave other in-flight writes racing with the next submission.
    let completed = 0;
    for (let index = 0; index < publishable.length; index += 8) {
      const outcomes = await Promise.allSettled(
        publishable
          .slice(index, index + 8)
          .map(({ input, id }) =>
            toursApi.publishOffer(input, branchId, `ticket-catalog:${id}`),
          ),
      );
      completed += outcomes.filter(
        (outcome) => outcome.status === 'fulfilled',
      ).length;
      const failure = outcomes.find((outcome) => outcome.status === 'rejected');
      if (failure?.status === 'rejected') {
        throw new Error(
          `${completed.toLocaleString('fa-IR')} بلیت ثبت شد؛ ثبت برنامه کامل نشد. برای ادامه بدون تکرار، دوباره با همین مشخصات ثبت کنید. ${failure.reason instanceof Error ? failure.reason.message : ''}`,
        );
      }
    }
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
            (offer.catalogProductId === product.id ||
              samePublishedFlight(offer, input)),
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
    const refresh = () => {
      void refreshPublishedOffers();
      const now = new Date().toISOString();
      setProducts((current) => {
        const available = current.filter(
          (product) => !isExpiredCatalogProduct(product, now),
        );
        return available.length === current.length ? current : available;
      });
    };
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
        const restoredProducts = stored.products
          .filter((product) => !isExpiredCatalogProduct(product, now))
          .map((product) => activateDraftCatalogProduct(product, now));
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
  useEffect(() => {
    if (!hydrated) return;
    const cityIds = new Set(
      displayedProducts.flatMap((product) =>
        product.definition.segments.flatMap((segment) => [
          segment.originCityId,
          segment.destinationCityId,
        ]),
      ),
    );
    for (const id of cityIds) {
      if (!id || requestedCityNames.current.has(id)) continue;
      const current = references.find(
        (reference) => reference.kind === 'city' && reference.id === id,
      );
      if (
        current &&
        current.countryId &&
        readableCityName(current.name, undefined) !== 'نام شهر نامشخص'
      )
        continue;
      requestedCityNames.current.add(id);
      void getActiveCityReference(id)
        .then((reference) => {
          if (!reference) return;
          setReferences((rows) => [
            ...rows.filter((item) => item.kind !== 'city' || item.id !== id),
            reference,
          ]);
        })
        .catch(() => {
          // Keep the route readable even if master data is temporarily unavailable.
        });
    }
  }, [hydrated, displayedProducts, references]);
  const resolve: ReferenceResolver = (kind, id) =>
    references.find((r) => r.kind === kind && r.id === id);
  const referenceLabel = (
    kind: Reference['kind'],
    id: string,
    fallback: string,
  ) =>
    kind === 'city'
      ? readableCityName(resolve(kind, id)?.name, fallback)
      : (resolve(kind, id)?.name ?? fallback);
  function rememberReference(value: Reference) {
    setReferences((rows) => [
      ...rows.filter((r) => r.id !== value.id || r.kind !== value.kind),
      value,
    ]);
  }
  async function save(
    inputs: readonly ProductInput[],
    editReason: string,
    allowPastDate = false,
  ) {
    if (!form || form.mode === 'view') throw new Error('فرم قابل ویرایش نیست.');
    const now = new Date().toISOString();
    const current = form.product;
    const currentPublishedOffer = current
      ? catalogOffer(current, publishedOffers)
      : undefined;
    const editedOffers = form.offers ?? [];
    if (current && editedOffers.length > 1) {
      const nextOffers = inputs
        .map((input) => flightOfferInput(input, references))
        .filter((input): input is TicketOfferCreateV1 => Boolean(input))
        .sort(
          (left, right) =>
            left.departureAt.localeCompare(right.departureAt) ||
            left.originId.localeCompare(right.originId) ||
            left.destinationId.localeCompare(right.destinationId) ||
            left.cabinClassCode.localeCompare(right.cabinClassCode),
        );
      const currentOffers = [...editedOffers].sort(
        (left, right) =>
          left.departureAt.localeCompare(right.departureAt) ||
          left.originId.localeCompare(right.originId) ||
          left.destinationId.localeCompare(right.destinationId) ||
          left.cabinClassCode.localeCompare(right.cabinClassCode),
      );
      if (nextOffers.length !== currentOffers.length)
        throw new Error(
          `این لود ${currentOffers.length.toLocaleString('fa-IR')} ردیف دارد؛ بازه، روزها و کلاس‌ها را طوری تنظیم کنید که همین تعداد ردیف ساخته شود.`,
        );
      await toursApi.reviseOfferBatch(
        currentOffers.map((offer, index) => ({
          id: offer.id,
          expectedVersion: offer.version,
          offer: nextOffers[index]!,
        })),
      );
      await refreshPublishedOffers();
      setForm(null);
      setProblem('');
      setNotice(
        `${currentOffers.length.toLocaleString('fa-IR')} ردیف لود باهم ویرایش شد.`,
      );
      return;
    }
    if (current && inputs.length !== 1)
      throw new Error('ویرایش باید روی همان بلیط انجام شود.');
    let updated = products;
    const signature = JSON.stringify(inputs);
    if (!current && pendingCreate.current?.signature !== signature) {
      const groupId = browserRandomUuid();
      pendingCreate.current = {
        signature,
        groupId,
        ids: inputs.map((_, index) => `ticket-load:${groupId}:${index}`),
      };
    }
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
      updated = currentPublishedOffer
        ? products
        : replacePreview(updated, next, current.version);
    } else {
      for (const [index, input] of inputs.entries()) {
        const next = activateDraftCatalogProduct(
          createProduct(
            pendingCreate.current!.ids[index]!,
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
    if (!current) {
      try {
        await publishFlights(inputs, createdIds, allowPastDate);
      } catch (error) {
        await refreshPublishedOffers();
        throw error;
      }
    } else {
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
        if (matches.length > 1 && !currentPublishedOffer)
          throw new Error(
            'بیش از یک بلیط مشابه در فروش ثبت شده؛ ابتدا بلیط مرتبط را مشخص کنید.',
          );
        if (currentPublishedOffer)
          await toursApi.reviseOffer(
            currentPublishedOffer.id,
            currentPublishedOffer.version,
            nextInput,
          );
        else if (matches[0])
          await toursApi.reviseOffer(
            matches[0].id,
            matches[0].version,
            nextInput,
          );
        else await publishFlights(inputs, [current.id], allowPastDate);
        await refreshPublishedOffers();
      }
    }
    setProducts(updated);
    setForm(null);
    pendingCreate.current = null;
    setProblem('');
    setNotice(
      inputs.length > 1
        ? `${inputs.length.toLocaleString('fa-IR')} بلیط مستقل ذخیره شد.`
        : current
          ? 'تغییرات بلیط ذخیره شد.'
          : 'بلیط جدید ذخیره شد.',
    );
  }
  async function applyRepeat() {
    if (!repeat || repeatBusy.current) return;
    repeatBusy.current = true;
    setRepeatSaving(true);
    setProblem('');
    try {
      if (!repeatBatch.current) {
        const definitions = repeatedDefinitions(
          repeat.product.definition,
          repeat.startDate,
          repeat.cadence,
          repeat.count,
        );
        // Validate the entire batch before creating any server record.
        const sourceOffer = catalogOffer(repeat.product, publishedOffers);
        definitions.forEach((definition) => {
          if (new Date(definition.segments[0]!.departureAt) <= new Date())
            throw new Error('تاریخ بلیت جدید باید در آینده باشد.');
          if (!sourceOffer) flightOfferInput(definition, references);
        });
        const now = new Date().toISOString();
        repeatBatch.current = {
          items: definitions.map((definition) =>
            sourceOffer
              ? {
                  ...repeat.product,
                  id: 'ticket-' + browserRandomUuid(),
                  definition,
                  version: 1,
                  history: [
                    {
                      version: 1,
                      action: 'created',
                      at: now,
                      actor,
                      reason: 'تکرار بلیط ثبت‌شده',
                    },
                  ],
                }
              : activateDraftCatalogProduct(
                  createProduct(
                    'ticket-' + browserRandomUuid(),
                    definition,
                    resolve,
                    now,
                    actor,
                  ),
                  now,
                ),
          ),
          completed: new Set(),
        };
      }
      const batch = repeatBatch.current;
      await publishRepeatedProducts(
        batch.items,
        batch.completed,
        async (product) => {
          const source = catalogOffer(repeat.product, publishedOffers);
          if (source) {
            await toursApi.publishOffer(
              {
                ...publishedOfferInput(source),
                departureAt: product.definition.segments[0]!.departureAt,
                arrivalAt: product.definition.segments.at(-1)!.arrivalAt,
              },
              source.branchId,
              'ticket-catalog:' + product.id,
            );
            await refreshPublishedOffers();
          } else await publishFlights([product.definition], [product.id]);
        },
        (product) => {
          setProducts((current) => replacePreview(current, product));
        },
      );
      setNotice(
        `${batch.items.length.toLocaleString('fa-IR')} بلیط مستقل از تاریخ انتخاب‌شده ثبت شد.`,
      );
      repeatBatch.current = null;
      setRepeat(undefined);
    } catch (error) {
      const completed = repeatBatch.current?.completed.size ?? 0;
      setProblem(
        `${error instanceof Error ? error.message : 'تکرار بلیط ناموفق بود.'} ${completed.toLocaleString('fa-IR')} نوبت ثبت شده است؛ تلاش دوباره فقط نوبت‌های باقی‌مانده را ثبت می‌کند.`,
      );
      await refreshPublishedOffers();
    } finally {
      repeatBusy.current = false;
      setRepeatSaving(false);
    }
  }
  async function applyStatus() {
    if (!statusChange) return;
    try {
      const current = statusChange.product;
      const published = catalogOffer(current, publishedOffers);
      if (published) {
        await updatePublishedStatus(
          published,
          statusChange.status === 'active' ? 'ACTIVE' : 'PAUSED',
        );
        setStatusChange(null);
        return;
      }
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
      if (current.definition.transport === 'flight') {
        let offer = findPublishedOffer(
          current.definition,
          references,
          publishedOffers,
        );
        if (!offer) {
          await publishExistingFlights([current], references);
          const refreshed = (await toursApi.managedOffers()).data;
          offer = findPublishedOffer(current.definition, references, refreshed);
        }
        if (!offer)
          throw new Error(
            'رکورد قابل فروش این بلیت در سرور پیدا نشد؛ فهرست را به‌روز کنید.',
          );
        await updatePublishedStatus(
          offer,
          statusChange.status === 'active' ? 'ACTIVE' : 'PAUSED',
        );
      }
      setProducts((rows) => replacePreview(rows, next, current.version));
      setStatusChange(null);
      setProblem('');
      setNotice(`وضعیت بلیط به «${statusLabels[next.status]}» تغییر کرد.`);
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }
  const renderLoadActions = (visibleOffers: readonly TicketOfferV1[]) => {
    const load = publishedLoadGroups(visibleOffers, publishedOffers, products);
    const count = load.length.toLocaleString('fa-IR');
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          onClick={() => editPublishedLoad(visibleOffers)}
        >
          ویرایش کل جدول ({count})
        </Button>
        <ConfirmDialog
          title={`حذف کل جدول لود (${count} ردیف)`}
          description="تمام ردیف‌های رفت و برگشت متعلق به لودهای نمایش‌داده‌شده در این بلوک، به‌صورت یکجا از مدیریت و فروش جدید خارج می‌شوند. فروش‌ها و سوابق قیمت، خرید، مالی و ممیزی باقی می‌مانند. عملیات اتمیک است؛ اگر رزرو ظرفیت فعال یا تور متصل وجود داشته باشد هیچ ردیفی حذف نمی‌شود."
          destructive
          onConfirm={() => void archivePublishedLoad(visibleOffers)}
          trigger={
            <Button
              size="sm"
              variant="destructive"
              loading={Boolean(deleteSaving)}
              disabled={Boolean(deleteSaving)}
            >
              <Trash2 className="size-4" aria-hidden />
              حذف کل جدول ({count})
            </Button>
          }
        />
      </>
    );
  };
  const renderOfferActions = (offer: TicketOfferV1) => {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOfferForm({ offer, readOnly: true })}
        >
          مشاهده
        </Button>
        {new Date(offer.departureAt).getTime() > catalogNow ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={statusSaving === offer.id}
              aria-label={
                offer.status === 'ACTIVE'
                  ? 'غیرفعال کردن بلیت'
                  : 'فعال کردن بلیت'
              }
              title={
                offer.status === 'ACTIVE'
                  ? 'غیرفعال کردن بلیت'
                  : 'فعال کردن بلیت'
              }
              className={
                offer.status === 'ACTIVE' ? 'text-red-600' : 'text-emerald-600'
              }
              onClick={() =>
                void updatePublishedStatus(
                  offer,
                  offer.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                ).catch(() => undefined)
              }
            >
              <Power className="size-5" aria-hidden />
            </Button>
            {offer.status === 'ACTIVE' ? (
              <Button
                size="sm"
                variant="outline"
                disabled={offer.remainingCapacity < 1}
                onClick={() =>
                  updateCapacityHold({
                    offer,
                    quantity: 1,
                    requesterName: '',
                  })
                }
              >
                رزرو ظرفیت
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="تعریف و ظرفیت پرواز"
        eyebrow="هواپیما • قطار • اتوبوس"
        actions={
          <Button
            onClick={() => {
              pendingCreate.current = null;
              setForm({ mode: 'create' });
            }}
          >
            <Plus className="size-4" aria-hidden />
            تعریف بلیط جدید
          </Button>
        }
      />
      {notice ? <Alert title={notice} /> : null}
      {problem && !statusChange && !repeat ? (
        <Alert tone="error" title={problem} />
      ) : null}
      {publishedNotice ? <Alert title={publishedNotice} /> : null}
      {publishedProblem ? (
        <Alert tone="error" title={publishedProblem} />
      ) : null}
      <FlightLoadGrid
        references={references}
        offers={publishedOffers}
        renderActions={renderOfferActions}
        renderLoadActions={renderLoadActions}
        cityName={(id) => referenceLabel('city', id, id)}
        refreshing={publishedRefreshing}
        onRefresh={() => void refreshPublishedOffers(true)}
      />

      <Dialog
        open={Boolean(offerForm)}
        onOpenChange={(open) => {
          if (!open) setOfferForm(null);
        }}
      >
        <DialogContent dir="rtl" className="start-auto! left-1/2! max-w-2xl">
          <DialogTitle>
            {offerForm?.readOnly
              ? 'مشاهده بلیط ثبت‌شده'
              : 'ویرایش بلیط ثبت‌شده'}
          </DialogTitle>
          <DialogDescription>
            اطلاعات این بلیط مستقیماً از سرور دریافت می‌شود.
          </DialogDescription>
          {offerForm ? (
            <PublishedOfferForm
              key={offerForm.offer.id}
              offer={offerForm.offer}
              readOnly={offerForm.readOnly}
              onSaved={async () => {
                await refreshPublishedOffers();
                setOfferForm(null);
                setPublishedNotice('تغییرات بلیط ذخیره شد.');
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open) setForm(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className={`${formStyles.dialog} ${(form?.mode === 'create' && !form.initial) || form?.mode === 'edit' ? formStyles.scheduleDialog : 'max-w-4xl'} start-auto! left-1/2!`}
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
              ) : (form.mode === 'create' && !form.initial) ||
                (form.mode === 'edit' &&
                  form.product?.definition.transport === 'flight') ? (
                <FlightScheduleForm
                  key={form.product?.id ?? 'create-flight-schedule'}
                  initial={form.product?.definition}
                  initials={form.products?.map(({ definition }) => definition)}
                  editing={form.mode === 'edit'}
                  references={references}
                  onReference={rememberReference}
                  onSave={save}
                  onCancel={() => setForm(null)}
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
                  allowMultipleClasses={form.mode === 'create'}
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
            label="درخواست‌کننده رزرو"
            id="ticket-capacity-hold-requester"
            required
          >
            <Input
              id="ticket-capacity-hold-requester"
              required
              maxLength={160}
              value={capacityHold?.requesterName ?? ''}
              onChange={(event) =>
                capacityHold &&
                updateCapacityHold({
                  ...capacityHold,
                  requesterName: event.target.value,
                })
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
            تعداد شامل تاریخ شروع است: ۱ بلیط در همان تاریخ، ۲ بلیط هفتگی در
            همان تاریخ و همان روز هفته بعد. هر نوبت مستقل در فهرست ثبت می‌شود.
          </DialogDescription>
          {problem ? <Alert tone="error" title={problem} /> : null}
          <FormField
            label="تاریخ اولین بلیط جدید"
            id="ticket-repeat-start-date"
          >
            <TicketDatePicker
              id="ticket-repeat-start-date"
              disabled={repeatSaving}
              value={repeat?.startDate ?? ''}
              required
              onChange={(startDate) =>
                repeat && updateRepeat({ ...repeat, startDate })
              }
            />
          </FormField>
          <FormField label="دوره تکرار" id="ticket-repeat-cadence">
            <Select
              disabled={repeatSaving}
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
          <FormField
            label="تعداد کل بلیط‌ها (شامل تاریخ شروع)"
            id="ticket-repeat-count"
          >
            <Input
              id="ticket-repeat-count"
              type="number"
              min={1}
              max={24}
              disabled={repeatSaving}
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
            disabled={repeatSaving || !repeat?.startDate}
            onClick={() => void applyRepeat()}
          >
            {repeatSaving ? 'در حال ثبت نوبت‌ها…' : 'ساخت بلیط‌های تکرارشونده'}
          </Button>
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
          <Button
            className="mt-4"
            disabled={Boolean(statusSaving)}
            onClick={() => void applyStatus()}
          >
            {statusChange?.status === 'active' ? 'فعال‌کردن فروش' : 'توقف فروش'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
