'use client';
import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import type {
  AuthenticatedActor,
  MasterDataRecord,
  BranchReference,
  TicketOfferV1,
  TourDepartureV1,
  TicketSalePriceTargetV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { PageHeader, Alert, Skeleton } from '@/components/ui/surfaces';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { listReferences } from '@/modules/ticket-catalog/api/references';
import { SalesDatePicker } from '@/modules/sales/components/sales-date-picker';
import {
  filterTicketRows,
  ticketPriceRows,
  ticketCabinLabel,
} from '@/modules/sales/model/ticket-price-rows';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import { pricingCityCountries } from '@/modules/sales/model/ticket-pricing-display';
import { integrationsApi } from '../api/client';
import { SiteTicketFacts } from './site-ticket-facts';
import styles from './site-management.module.css';
import {
  publishableTickets,
  publishableTours,
  websiteDestinations,
} from '../site-publication-model';

async function siteReferences(resource: 'cities' | 'countries') {
  const rows: MasterDataRecord[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await listReferences(
      resource,
      '',
      page,
      undefined,
      {},
      'ticket-catalog',
    );
    rows.push(...result.data);
    if (page * result.meta.pageSize >= result.meta.total) break;
  }
  return rows;
}

type Presentation = {
  title: string;
  description: string;
  commissionPercent: string;
};
type Publication = {
  enabled: boolean;
  version: number;
  presentation?: Presentation | null;
};
export function WebsiteDestination({
  site,
  kind,
  resourceId,
  branchId,
  children,
  compact = false,
}: {
  site: (typeof websiteDestinations)[number];
  kind: 'tour' | 'ticket';
  resourceId: string;
  branchId: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const [stored, setStored] = useState<Publication>();
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [presentation, setPresentation] = useState<Presentation>({
    title: '',
    description: '',
    commissionPercent: '0',
  });
  const path = `${getPublicApiBaseUrl()}/sales/site-commerce/v1/${site.code}/publications/${kind}/${resourceId}`;
  useEffect(() => {
    const abort = new AbortController();
    void localizedFetch(`${path}?branchId=${encodeURIComponent(branchId)}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('وضعیت انتشار دریافت نشد.');
        return response.json();
      })
      .then((result) => {
        if (!abort.signal.aborted) {
          const value = result.data ?? { enabled: false, version: 0 };
          setStored(value);
          setSelected(value.enabled);
          setPresentation(
            value.presentation ?? {
              title: '',
              description: '',
              commissionPercent: '0',
            },
          );
        }
      })
      .catch((cause) => {
        if (!abort.signal.aborted) setError(cause.message);
      });
    return () => abort.abort();
  }, [path, branchId]);
  async function save(enabled = selected, selectionOnly = false) {
    if (!stored || busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await localizedFetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-nora-site-commerce': '1',
        },
        body: JSON.stringify({
          enabled,
          version: stored.version,
          branchId,
          ...(kind === 'tour'
            ? {
                presentation: selectionOnly
                  ? (stored.presentation ?? {
                      title: '',
                      description: '',
                      commissionPercent: '0',
                    })
                  : presentation,
              }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error?.message ?? result.message ?? 'ثبت انتشار ناموفق بود.',
        );
      setStored(result.data);
      if (selectionOnly) setSelected(result.data.enabled);
    } catch (cause) {
      if (selectionOnly) setSelected(stored.enabled);
      setError(
        cause instanceof Error ? cause.message : 'ثبت انتشار ناموفق بود.',
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const unchanged =
    !stored ||
    (stored.enabled === selected &&
      JSON.stringify(
        stored.presentation ?? {
          title: '',
          description: '',
          commissionPercent: '0',
        },
      ) === JSON.stringify(presentation));
  const status = !site.connected
    ? 'در انتظار اتصال'
    : stored?.enabled
      ? 'انتشار فعال'
      : 'منتشر نشده';
  return (
    <div
      aria-busy={busy}
      data-selected={selected}
      className={
        compact
          ? styles.destination
          : `min-w-0 rounded-xl border p-2.5 text-sm transition-colors ${selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'} ${editing ? 'col-span-2 sm:col-span-4' : ''}`
      }
    >
      <label
        className={
          compact
            ? styles.destinationHeader
            : 'flex min-h-6 cursor-pointer items-center gap-2 font-semibold text-primary'
        }
      >
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary"
          checked={selected}
          disabled={!stored || busy}
          onChange={async (e) => {
            if (!stored || busy) return;
            const enabled = e.target.checked;
            setSelected(enabled);
            await save(enabled, true);
          }}
        />
        <span className="min-w-0 break-words leading-5">{site.name}</span>
      </label>
      <div
        className={
          compact
            ? styles.destinationStatus
            : 'mt-1 flex min-h-7 items-center justify-between gap-1'
        }
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${!site.connected ? 'bg-amber-500' : stored?.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          />
          {busy ? 'در حال ثبت…' : status}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className={
              compact
                ? styles.editButton
                : 'h-7 min-h-0 w-7 shrink-0 p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary'
            }
            aria-label={compact ? `ویرایش ${site.name}` : 'ویرایش'}
            title="ویرایش"
            aria-expanded={editing}
            disabled={!stored || busy}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="mt-2 grid gap-3 border-t border-primary/10 pt-3 sm:grid-cols-3">
          {kind === 'tour' ? (
            <>
              <label>
                عنوان سایت
                <input
                  className="w-full rounded border border-border bg-surface p-2"
                  value={presentation.title}
                  maxLength={200}
                  onChange={(e) =>
                    setPresentation((v) => ({ ...v, title: e.target.value }))
                  }
                />
              </label>
              <label>
                توضیحات سایت
                <textarea
                  className="w-full rounded border border-border bg-surface p-2"
                  value={presentation.description}
                  maxLength={5000}
                  onChange={(e) =>
                    setPresentation((v) => ({
                      ...v,
                      description: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                درصد کمیسیون
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  className="w-full rounded border border-border bg-surface p-2"
                  value={presentation.commissionPercent}
                  onChange={(e) =>
                    setPresentation((v) => ({
                      ...v,
                      commissionPercent: e.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : (
            children
          )}
          {kind === 'tour' ? (
            <div className="sm:col-span-3">
              {' '}
              <Button
                type="button"
                variant="primary"
                className="h-8 min-h-0 px-3 py-0 text-xs"
                disabled={unchanged || busy}
                onClick={() => void save()}
              >
                {busy ? 'در حال ثبت…' : 'ذخیره'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
export function SiteManagement({ actor }: { actor: AuthenticatedActor }) {
  const [tab, setTab] = useState<'tours' | 'tickets' | 'hotels'>('tours');
  const [branches, setBranches] = useState<BranchReference[]>([]);
  const [branchId, setBranchId] = useState('');
  const [targets, setTargets] = useState<TicketSalePriceTargetV1[]>([]);
  const [tourId, setTourId] = useState('');
  const [tours, setTours] = useState<TourDepartureV1[]>([]);
  const [tickets, setTickets] = useState<TicketOfferV1[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [cities, setCities] = useState<Record<string, string>>({});
  const [cityCountries, setCityCountries] = useState<Record<string, string>>(
    {},
  );
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [tripType, setTripType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const canManage = actor.permissions.includes('ticket_catalog.manage');
  const branchScope = JSON.stringify([...actor.branchIds].sort());
  useEffect(() => {
    let active = true;
    const allowedBranchIds = JSON.parse(branchScope) as string[];
    if (!canManage) return;
    void Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setError('');
      }
    });
    void Promise.all([
      (async () => {
        const [cities, countries] = await Promise.all([
          siteReferences('cities'),
          siteReferences('countries'),
        ]);
        return { cities, countries };
      })(),
      integrationsApi.branches(),
      toursApi.departures(true),
      toursApi.managedOffers(),
      toursApi.salePriceTargets(),
      localizedFetch(
        `${getPublicApiBaseUrl()}/sales/pricing/tour-drafts/website-publication-candidates`,
        { credentials: 'include', cache: 'no-store' },
      ).then(async (response) => {
        if (!response.ok) throw Error('پکیج‌های منتشرشده دریافت نشد.');
        return response.json() as Promise<{ data: string[] }>;
      }),
    ])
      .then(
        ([
          cityResult,
          branchResult,
          tourResult,
          ticketResult,
          targetResult,
          published,
        ]) => {
          if (!active) return;
          const allowed = branchResult.filter((row) =>
            allowedBranchIds.includes(row.id),
          );
          setCities(
            Object.fromEntries(
              cityResult.cities.map((row) => [row.id, row.name]),
            ),
          );
          setCityCountries(
            pricingCityCountries(cityResult.cities, cityResult.countries),
          );
          setBranches(allowed);
          setBranchId((current) =>
            allowed.some((row) => row.id === current)
              ? current
              : (allowed[0]?.id ?? ''),
          );
          setTours(
            tourResult.data.filter((row) => published.data.includes(row.id)),
          );
          setTargets(targetResult.data);
          setTickets(ticketResult.data);
        },
      )
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchScope, canManage, revision]);
  if (!canManage)
    return (
      <Alert
        title="دسترسی مجاز نیست"
        description="مجوز مدیریت بلیط و تور برای انتشار سایت لازم است."
      />
    );
  const flightLabel = (offer: TicketOfferV1) =>
    `${cities[offer.originId] ?? offer.originId} → ${cities[offer.destinationId] ?? offer.destinationId} · ${offer.carrierName} · ${offer.serviceNumber} · ${ticketCabinLabel(offer.cabinClassCode)}`;
  const eligible = new Set(
    filterTicketRows(
      ticketPriceRows(publishableTickets(tickets, branchId)),
      { originId, destinationId, tripType, query: search, from, to },
      flightLabel,
    ).map((row) => row.offer.id),
  );
  const resources =
    tab === 'tours'
      ? publishableTours(tours, branchId)
          .filter((row) => !tourId || row.packageId === tourId)
          .map((row) => ({
            id: row.id,
            title: row.package.name,
            detail: `${row.startsOn} — ${row.endsOn}`,
            kind: 'tour' as const,
          }))
      : publishableTickets(tickets, branchId)
          .filter((row) => eligible.has(row.id))
          .map((row) => ({
            id: row.id,
            title: flightLabel(row),
            offer: row,
            detail: `${new Date(row.departureAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })} — ${new Date(row.arrivalAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })} · مانده: ${row.remainingCapacity} · ظرفیت: ${row.totalCapacity} · ${(row.baseStandaloneSalePrice ?? row.standaloneSalePrice) ? `یک‌طرفه: ${(row.baseStandaloneSalePrice ?? row.standaloneSalePrice)!.amount} ${(row.baseStandaloneSalePrice ?? row.standaloneSalePrice)!.currencyCode}` : ''} ${(
              row.baseRoundTripSalePrices ??
              row.roundTripSalePrices ??
              []
            )
              .map((price) => {
                const returning = tickets.find(
                  (ticket) => ticket.id === price.returnOfferId,
                );
                return `رفت‌وبرگشت: ${price.baseAmount ?? price.amount} ${price.currencyCode}${returning ? ` · ${flightLabel(returning)} · ${new Date(returning.departureAt).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}` : ''}`;
              })
              .join(' / ')}`,
            kind: 'ticket' as const,
          }));
  return (
    <div className="grid gap-4" dir="rtl">
      <PageHeader title="مدیریت سایت" />
      <nav aria-label="مدیریت سایت" className="flex flex-wrap gap-2">
        {(
          [
            ['tours', 'تور‌ها'],
            ['tickets', 'بلیط‌ها'],
            ['hotels', 'هتل‌ها'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? 'primary' : 'outline'}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </nav>
      {tab === 'hotels' ? (
        <Alert
          title="هتل‌ها"
          description="این بخش فعلاً به منبع هتل یا سایت‌ها متصل نیست."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <NativeSearchSelect
              aria-label="شعبه مجاز"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </NativeSearchSelect>
            <input
              className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2"
              aria-label="جست‌وجو"
              placeholder="جست‌وجو"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevision((value) => value + 1)}
            >
              دریافت اطلاعات
            </Button>
          </div>
          {tab === 'tickets' ? (
            <div className={styles.filters}>
              {(
                [
                  {
                    label: 'مبدأ',
                    value: originId,
                    change: setOriginId,
                    field: 'originId',
                  },
                  {
                    label: 'مقصد',
                    value: destinationId,
                    change: setDestinationId,
                    field: 'destinationId',
                  },
                ] as const
              ).map((filter) => (
                <label key={filter.field}>
                  {filter.label}
                  <NativeSearchSelect
                    value={filter.value}
                    onChange={(e) => filter.change(e.target.value)}
                  >
                    <option value="">همه</option>
                    {[...new Set(tickets.map((row) => row[filter.field]))].map(
                      (id) => (
                        <option key={id} value={id}>
                          {cities[id] ?? id}
                        </option>
                      ),
                    )}
                  </NativeSearchSelect>
                </label>
              ))}
              <label>
                نوع بلیط
                <NativeSearchSelect
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value)}
                >
                  <option value="">همه</option>
                  <option value="ONEWAY">یک‌طرفه</option>
                  <option value="ROUNDTRIP">رفت‌وبرگشت</option>
                </NativeSearchSelect>
              </label>
              <label>
                از تاریخ
                <SalesDatePicker value={from} onChange={setFrom} />
              </label>
              <label>
                تا تاریخ
                <SalesDatePicker value={to} onChange={setTo} />
              </label>
              <Button
                variant="outline"
                onClick={() => {
                  setOriginId('');
                  setDestinationId('');
                  setTripType('');
                  setFrom('');
                  setTo('');
                  setSearch('');
                }}
              >
                پاک‌کردن فیلترها
              </Button>
            </div>
          ) : null}
          {tab === 'tours' ? (
            <NativeSearchSelect
              aria-label="انتخاب تور"
              value={tourId}
              onChange={(e) => setTourId(e.target.value)}
            >
              <option value="">همه تورها</option>
              {[
                ...new Map(
                  publishableTours(tours, branchId).map((row) => [
                    row.packageId,
                    row.package,
                  ]),
                ).values(),
              ].map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </NativeSearchSelect>
          ) : null}
          <p className="text-sm text-muted-foreground">
            انتخاب سایت‌های متصل‌نشده ذخیره می‌شود؛ ارسال پس از اتصال فعال خواهد
            شد.
          </p>
          {error ? (
            <Alert title="عملیات کامل نشد" description={error} tone="error" />
          ) : loading ? (
            <Skeleton className="h-48" />
          ) : (
            <div
              className={tab === 'tickets' ? styles.ticketGrid : 'grid gap-4'}
            >
              {resources
                .filter((row) =>
                  (tab === 'tickets' ? search : `${row.title} ${row.detail}`)
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((row) => (
                  <article
                    key={`${revision}:${branchId}:${row.kind}:${row.id}`}
                    className={styles.resource}
                  >
                    <div
                      className={
                        row.kind === 'ticket'
                          ? styles.resourceHeader
                          : 'grid gap-4'
                      }
                    >
                      <div className="min-w-0 break-words">
                        {row.kind === 'ticket' ? (
                          <SiteTicketFacts
                            offer={row.offer}
                            tickets={tickets}
                            cities={cities}
                            cityCountries={cityCountries}
                          />
                        ) : (
                          <h2 className={styles.title}>{row.title}</h2>
                        )}
                        {row.kind === 'tour' ? (
                          <p className="text-sm leading-7" dir="auto">
                            {row.detail}
                          </p>
                        ) : null}
                      </div>
                      <div
                        className={
                          row.kind === 'ticket'
                            ? styles.destinations
                            : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4'
                        }
                      >
                        {websiteDestinations.map((site) => (
                          <WebsiteDestination
                            key={site.code}
                            site={site}
                            kind={row.kind}
                            resourceId={row.id}
                            branchId={branchId}
                            compact={row.kind === 'ticket'}
                          >
                            {row.kind === 'ticket' ? (
                              <TicketSiteCommission
                                offer={tickets.find(
                                  (offer) => offer.id === row.id,
                                )!}
                                site={site}
                                targets={targets}
                              />
                            ) : null}
                          </WebsiteDestination>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              {resources.length === 0 ? (
                <p>مورد قابل انتشار وجود ندارد.</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TicketSiteCommission({
  offer,
  site,
  targets,
}: {
  offer: TicketOfferV1;
  site: (typeof websiteDestinations)[number];
  targets: TicketSalePriceTargetV1[];
}) {
  const initialTarget = targets.find(
    (t) =>
      t.branchId === offer.branchId &&
      t.isActive &&
      (t.code === site.code ||
        t.name === site.name ||
        (site.code === 'nss' && t.name === 'نیایش سیر سحر')),
  );
  const [target, setTarget] = useState(initialTarget);
  const [pair, setPair] = useState('');
  const [percent, setPercent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [commissions, setCommissions] = useState([
    ...(offer.saleCommissions ?? []),
  ]);
  const base = pair
    ? (offer.baseRoundTripSalePrices ?? offer.roundTripSalePrices)?.find(
        (p) => p.returnOfferId === pair,
      )
    : (offer.baseStandaloneSalePrice ?? offer.standaloneSalePrice);
  const current = commissions.find(
    (c) =>
      c.salePriceTargetId === target?.id && c.returnOfferId === (pair || null),
  );
  async function save() {
    if (!base || busy) return;
    const value = percent || current?.percent || '0';
    if (!/^\d{1,3}(\.\d{1,4})?$/.test(value) || Number(value) > 100)
      return setError('درصد کمیسیون معتبر نیست.');
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const destination =
        target ??
        (
          await toursApi.createSalePriceTarget(
            {
              version: 1,
              branchId: offer.branchId,
              name: site.code === 'nss' ? 'نیایش سیر سحر' : site.name,
              code: site.code,
            },
            offer.branchId,
          )
        ).data;
      setTarget(destination);
      const result = await toursApi.updateSaleCommission(
        {
          offerId: offer.id,
          returnOfferId: pair || null,
          salePriceTargetId: destination.id,
          percent: value,
          expectedRevision: current?.revision ?? 0,
          expectedBaseRevision: base.revision,
        },
        crypto.randomUUID(),
      );
      setCommissions((rows) => [
        ...rows.filter(
          (c) =>
            !(
              c.salePriceTargetId === destination.id &&
              c.returnOfferId === (pair || null)
            ),
        ),
        {
          salePriceTargetId: destination.id,
          returnOfferId: pair || null,
          percent: value,
          revision: result.data.revision,
          amount: '',
          currencyCode: base.currencyCode,
        },
      ]);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ثبت انتشار ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      <NativeSearchSelect
        aria-label="نوع قیمت"
        value={pair}
        onChange={(e) => {
          setPair(e.target.value);
          setPercent('');
          setSaved(false);
        }}
      >
        <option value="">یک‌طرفه</option>
        {(offer.baseRoundTripSalePrices ?? offer.roundTripSalePrices ?? []).map(
          (p) => (
            <option key={p.returnOfferId} value={p.returnOfferId}>
              رفت‌وبرگشت · {p.returnOfferId.slice(0, 8)}
            </option>
          ),
        )}
      </NativeSearchSelect>
      <label>
        درصد کمیسیون
        <input
          type="number"
          min="0"
          max="100"
          step="0.0001"
          className="w-full rounded border border-border bg-surface p-2"
          value={percent || current?.percent || '0'}
          disabled={busy}
          onChange={(e) => setPercent(e.target.value)}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={!base || busy}
        onClick={() => void save()}
      >
        ثبت کمیسیون
      </Button>
      {saved ? <p role="status">کمیسیون ذخیره شد.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
