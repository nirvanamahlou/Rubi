'use client';
import { PurchaseFilterControls } from './filters';
import { useDisplayLanguage } from '@/i18n/locale-context';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Bus,
  Layers3,
  Plane,
  ShieldCheck,
  RefreshCw,
  Search,
  ClipboardList,
  CheckCircle2,
  Clock3,
  CircleHelp,
} from 'lucide-react';
import type {
  ReservationIntakeV1,
  SalesServiceInput,
  TicketPurchaseInboxItemV1,
} from '@nora/contracts';
import { canViewRoute } from '@nora/contracts';
import Link from '@/components/access-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/surfaces';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { formatSalesMoney } from '@/components/ui/money-input';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { TicketPurchaseWorkspace } from '@/modules/ticket-purchases/workspace';
import { ticketPurchaseApi } from '@/modules/ticket-purchases/api';
import { ReservationPurchaseDialog } from '@/modules/reservations/components/reservation-hotel-purchase';
import {
  purchaseFilters,
  writePurchaseFilters,
  purchaseDateFields,
  purchaseCategories,
  purchaseCategory,
  contractPurchaseServices,
  servicePurchase,
  flightPurchase,
  flightOfferId,
  type PurchaseCategory,
} from './model';
import { loadPurchaseInbox, type PurchaseInbox } from './api';

const icons = [Layers3, Building2, Plane, Bus, ShieldCheck];
const tones = [
  'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/35 dark:text-blue-200',
  'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-950/35 dark:text-violet-200',
  'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/35 dark:text-sky-200',
  'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200',
  'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200',
];
type Selection = {
  id: string;
  kind: PurchaseCategory;
  serviceClientKey?: string;
};
export function ReservationPurchaseWorkspace() {
  return (
    <Suspense fallback={<p>در حال دریافت خریدها…</p>}>
      <PurchaseHubBoundary />
    </Suspense>
  );
}
function PurchaseHubBoundary() {
  const query = useSearchParams();
  const permissions = useAccessPermissions();
  return <PurchaseHub key={`${query?.toString()}:${permissions?.join('|')}`} />;
}
function PurchaseHub() {
  const query = useSearchParams();
  const router = useRouter();
  const permissions = useAccessPermissions();
  const canRead =
    !!permissions?.includes('reservations.read') &&
    canViewRoute(permissions, '/reservations');
  const canReadFlights =
    !!permissions &&
    permissions.some((p) =>
      [
        'procurement.read.own',
        'procurement.read.unit',
        'procurement.read.all',
        'procurement.quote.manage',
      ].includes(p),
    ) &&
    canViewRoute(permissions, '/purchases');
  const language = useDisplayLanguage();
  const filters = purchaseFilters(query);
  const filterKey = JSON.stringify(filters);
  const dateLabel = purchaseDateFields.find(
    ([key]) => key === filters.dateBy,
  )![1];
  const kind = purchaseCategory(query?.get('kind') ?? null);
  const filter = query?.get('contractNumber') ?? '';
  const reservationId = query?.get('reservationId');
  const [search, setSearch] = useState(filter);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    response?: PurchaseInbox;
    error?: string;
  }>();
  const [selection, setSelection] = useState<Selection | null>(() =>
    reservationId && canRead ? { id: reservationId, kind: 'ALL' } : null,
  );
  const [flights, setFlights] = useState<{
    revision: number;
    data?: TicketPurchaseInboxItemV1[];
    error?: string;
  }>();
  const lookupKey = JSON.stringify([kind, page, filter, revision, filterKey]);
  const result = loaded?.key === lookupKey ? loaded.response : undefined;
  const error = loaded?.key === lookupKey ? (loaded.error ?? '') : '';
  const loading = canRead && loaded?.key !== lookupKey;
  const flightItems = flights?.revision === revision ? flights.data : undefined;
  const flightError =
    flights?.revision === revision ? (flights.error ?? '') : '';
  const focusedOffer = query?.get('offerId') ?? undefined;
  useEffect(() => {
    if (focusedOffer)
      document
        .getElementById('flight-purchase-inbox')
        ?.scrollIntoView({ behavior: 'smooth' });
  }, [focusedOffer]);
  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    loadPurchaseInbox(
      kind,
      page,
      filter,
      controller.signal,
      JSON.parse(filterKey),
    )
      .then((value) => {
        if (!controller.signal.aborted)
          setLoaded({ key: lookupKey, response: value });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLoaded({
            key: lookupKey,
            error:
              reason instanceof Error
                ? reason.message
                : 'دریافت خریدهای رزرواسیون ناموفق بود.',
          });
      });
    return () => controller.abort();
  }, [canRead, kind, page, filter, lookupKey, filterKey]);
  useEffect(() => {
    let live = true;
    if (canReadFlights)
      ticketPurchaseApi
        .list()
        .then((value) => {
          if (live) setFlights({ revision, data: value.data });
        })
        .catch((reason) => {
          if (live)
            setFlights({
              revision,
              error:
                reason instanceof Error
                  ? reason.message
                  : 'دریافت خرید پرواز ناموفق بود.',
            });
        });
    return () => {
      live = false;
    };
  }, [canReadFlights, revision]);
  function navigate(
    nextKind: PurchaseCategory,
    nextFilter = filter,
    nextOfferId?: string,
  ) {
    const next = new URLSearchParams();
    writePurchaseFilters(next, filters);
    if (nextKind !== 'ALL') next.set('kind', nextKind);
    if (nextFilter) next.set('contractNumber', nextFilter);
    if (nextOfferId) next.set('offerId', nextOfferId);
    setPage(1);
    setSelection(null);
    router.replace('/ticket-purchases' + (next.size ? '?' + next : ''));
  }
  function open(request: ReservationIntakeV1, service: SalesServiceInput) {
    if (service.kind === 'FLIGHT') {
      navigate('FLIGHT', filter, flightOfferId(request, service));
    } else
      setSelection({
        id: request.id,
        kind: service.kind as PurchaseCategory,
        serviceClientKey: service.clientKey,
      });
  }
  function close() {
    setSelection(null);
    if (reservationId) {
      const next = new URLSearchParams(query?.toString());
      next.delete('reservationId');
      router.replace('/ticket-purchases' + (next.size ? '?' + next : ''));
    }
  }
  const displayRows = result?.meta.services
    ? result.meta.services.flatMap((row) => {
        const request = result.data.find((r) => r.id === row.id);
        const service =
          request &&
          contractPurchaseServices(request)
            .map((s) => ({ ...s }))
            .find((s) => s.clientKey === row.clientKey);
        if (
          service?.kind === 'TRANSFER' &&
          (row.coveredServiceClientKeys?.length ?? 0) > 1
        )
          service.titleSnapshot = 'ترانسفر رفت‌وبرگشت';
        return request && service ? [{ request, service, row }] : [];
      })
    : (result?.data.flatMap((request) =>
        contractPurchaseServices(request)
          .filter((service) => kind === 'ALL' || service.kind === kind)
          .map((service) => ({ request, service, row: undefined })),
      ) ?? []);
  const formatDate = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'fa-IR', {
          timeZone: 'UTC',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(value))
      : '—';
  return (
    <section className="space-y-6">
      <PageHeader
        title="خرید و تأمین"
        eyebrow="خرید خدمات قراردادهای رزرواسیون"
        actions={
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            <RefreshCw className="size-4" />
            به‌روزرسانی خریدها
          </Button>
        }
      />
      {permissions &&
        canViewRoute(permissions, '/purchases?section=suppliers') && (
          <Card
            className="flex flex-wrap items-center justify-between gap-4 border-cyan-200 p-5 dark:border-cyan-900"
            aria-label="تأمین‌کنندگان"
          >
            <div className="flex items-center gap-3">
              <Building2 className="size-6 text-primary" />
              <h2 className="text-lg font-bold">تأمین‌کنندگان</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/purchases?section=suppliers">
                مدیریت تأمین‌کنندگان
              </Link>
            </Button>
          </Card>
        )}
      {canRead && (
        <section aria-label="داشبورد خرید خدمات" className="space-y-3">
          <h2 className="text-lg font-bold">داشبورد خرید خدمات</h2>
          <p className="text-xs text-muted-foreground">
            آمار همه وضعیت‌ها در دسته، جست‌وجو و بازه انتخاب‌شده
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                [
                  ClipboardList,
                  'کل خریدهای خدمات',
                  'total',
                  'border-blue-200 bg-blue-50 text-blue-800',
                ],
                [
                  Clock3,
                  'در انتظار ثبت خرید',
                  'unregistered',
                  'border-amber-200 bg-amber-50 text-amber-800',
                ],
                [
                  CheckCircle2,
                  'خریدهای ثبت‌شده',
                  'registered',
                  'border-emerald-200 bg-emerald-50 text-emerald-800',
                ],
                [
                  CircleHelp,
                  'وضعیت نامشخص',
                  'unknown',
                  'border-slate-200 bg-slate-50 text-slate-800',
                ],
              ] as const
            ).map(([Icon, label, key, tone]) => (
              <Card
                key={key}
                className={`${tone} space-y-3 dark:bg-card dark:text-foreground`}
              >
                <Icon className="size-6" />
                <p className="text-sm font-medium">{label}</p>
                <strong className="text-3xl" aria-label={label}>
                  {result?.meta.summary && !loading && !error
                    ? result.meta.summary[key].toLocaleString(
                        language === 'en' ? 'en-GB' : 'fa-IR',
                      )
                    : '—'}
                </strong>
              </Card>
            ))}
          </div>
        </section>
      )}
      <nav
        aria-label="دسته‌های خرید خدمات"
        className="grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        {purchaseCategories.map(([value, label], index) => {
          const Icon = icons[index]!;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => navigate(value)}
              className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border p-4 font-bold shadow-sm transition hover:shadow-md ${tones[index]} ${kind === value ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
            >
              <Icon className="size-7" />
              {label}
            </button>
          );
        })}
      </nav>
      {canRead && (
        <Card className="overflow-hidden p-0">
          <form
            className="flex flex-wrap gap-3 border-b p-4"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(kind, search.trim());
            }}
          >
            <Input
              aria-label="جست‌وجوی شماره قرارداد خرید"
              placeholder="شماره قرارداد"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              className="max-w-sm"
            />
            <Button variant="outline" type="submit">
              <Search className="size-4" />
              جست‌وجو
            </Button>
            {filter && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => navigate(kind, '')}
              >
                پاک‌کردن جست‌وجو
              </Button>
            )}
          </form>
          <PurchaseFilterControls
            value={filters}
            onChange={(value) => {
              const next = new URLSearchParams(query?.toString());
              writePurchaseFilters(next, value);
              next.delete('reservationId');
              next.delete('offerId');
              router.replace('/ticket-purchases?' + next);
            }}
          />
          {error && <Alert tone="error" title={error} />}
          {loading ? (
            <p role="status" className="p-6">
              در حال دریافت خریدها…
            </p>
          ) : !error && !result?.data.length ? (
            <p className="p-6">قراردادی در این دسته پیدا نشد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      'شماره قرارداد',
                      'خدمت قرارداد',
                      'وضعیت خرید',
                      dateLabel,
                      'کارگزار و مبلغ خرید',
                      'عملیات',
                    ].map((label) => (
                      <th key={label} className="p-4 text-start">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map(({ request, service, row }) => {
                    const purchase = servicePurchase(
                      request,
                      service.clientKey,
                    );
                    const flight =
                      service.kind === 'FLIGHT'
                        ? flightPurchase(request, service, flightItems ?? [])
                        : undefined;
                    const legacy =
                      service.kind === 'HOTEL' && !purchase
                        ? request.hotelPurchases
                        : undefined;
                    const known = row
                      ? row.status !== 'UNKNOWN'
                      : service.kind !== 'FLIGHT' || !!flightItems;
                    const registered = row
                      ? row.status === 'REGISTERED'
                      : !!purchase || !!legacy?.length || !!flight?.cost;
                    return (
                      <tr
                        key={`${request.id}:${service.clientKey}`}
                        className="border-t align-top"
                      >
                        <td className="p-4 font-bold">
                          <Link
                            href={`/reservations?contractNumber=${encodeURIComponent(request.snapshot.contractNumber)}`}
                          >
                            {request.snapshot.contractNumber}
                          </Link>
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            نسخه قرارداد {request.contractVersion}
                          </p>
                        </td>
                        <td className="p-4">
                          <Badge>
                            {
                              purchaseCategories.find(
                                ([key]) => key === service.kind,
                              )?.[1]
                            }
                          </Badge>
                          <p className="mt-2">{service.titleSnapshot}</p>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={
                              registered
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            }
                          >
                            {registered
                              ? 'خرید ثبت‌شده'
                              : known
                                ? 'خرید ثبت نشده'
                                : 'وضعیت خرید پرواز در دسترس نیست'}
                          </Badge>
                          {purchase?.finance && (
                            <p className="mt-2 text-xs">
                              {purchase.finance.status === 'PAID'
                                ? 'تسویه‌شده'
                                : purchase.finance.status === 'REJECTED'
                                  ? 'نیازمند اصلاح خرید'
                                  : 'در انتظار تسویه مالی'}
                            </p>
                          )}
                        </td>
                        <td className="p-4">
                          <bdi>{formatDate(row?.sortAt)}</bdi>
                        </td>
                        <td className="p-4">
                          {purchase ? (
                            <>
                              <p>{purchase.supplierName}</p>
                              <p>
                                <bdi>
                                  {formatSalesMoney(purchase.amount)}{' '}
                                  {purchase.currencyCode}
                                </bdi>
                              </p>
                            </>
                          ) : flight?.cost ? (
                            <>
                              <p>{flight.request.supplierDisplaySnapshot}</p>
                              <p>
                                {flight.cost.unitCost
                                  ? 'قیمت هر صندلی'
                                  : 'کل خرید پرواز'}
                                :{' '}
                                <bdi>
                                  {formatSalesMoney(
                                    flight.cost.unitCost ??
                                      flight.cost.invoiceAmount,
                                  )}{' '}
                                  {flight.cost.currencyCode}
                                </bdi>
                              </p>
                            </>
                          ) : legacy?.length ? (
                            legacy.map((cost) => (
                              <p key={cost.id}>
                                خرید قدیمی هتل:{' '}
                                <bdi>
                                  {formatSalesMoney(cost.amount)}{' '}
                                  {cost.currencyCode}
                                </bdi>
                              </p>
                            ))
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            disabled={
                              service.kind === 'FLIGHT'
                                ? !canReadFlights
                                : !result?.meta.canRecord
                            }
                            onClick={() => open(request, service)}
                          >
                            {registered ? 'مشاهده و اصلاح خرید' : 'ثبت خرید'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <nav
            aria-label="صفحه‌بندی خریدهای قرارداد"
            className="flex items-center justify-between border-t p-4"
          >
            <Button
              variant="outline"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              قبلی
            </Button>
            <span>صفحه {page}</span>
            <Button
              variant="outline"
              disabled={!result?.meta.hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </nav>
        </Card>
      )}
      {!canRead && permissions && (
        <Alert title="برای مشاهده خریدهای قرارداد، دسترسی مشاهده رزرواسیون لازم است." />
      )}
      {flightError && <Alert tone="error" title={flightError} />}
      {(kind === 'ALL' || kind === 'FLIGHT') && canReadFlights && (
        <section id="flight-purchase-inbox" className="space-y-4">
          <h2 className="text-xl font-bold">خرید پرواز و قیمت صندلی</h2>
          <TicketPurchaseWorkspace
            key={focusedOffer ?? 'all'}
            initialOfferId={focusedOffer}
            filters={filters}
            onSaved={() => setRevision((v) => v + 1)}
          />
        </section>
      )}
      <Dialog
        open={!!selection}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogTitle>خرید خدمات قرارداد</DialogTitle>
          <DialogDescription>
            ثبت و اصلاح خرید با اطلاعات رزرواسیون
          </DialogDescription>
          {selection && (
            <ReservationPurchaseDialog
              id={selection.id}
              category={selection.kind}
              serviceClientKey={selection.serviceClientKey}
              readOnly={!result?.meta.canRecord}
              onSaved={() => {
                setRevision((v) => v + 1);
                window.dispatchEvent(new Event('reservation-workflow-changed'));
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
