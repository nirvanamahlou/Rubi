'use client';
import { useEffect, useState } from 'react';
import type {
  AuthenticatedActor,
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
import { integrationsApi } from '../api/client';
import {
  publishableTickets,
  publishableTours,
  websiteDestinations,
} from '../site-publication-model';

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
}: {
  site: (typeof websiteDestinations)[number];
  kind: 'tour' | 'ticket';
  resourceId: string;
  branchId: string;
  children?: React.ReactNode;
}) {
  const [stored, setStored] = useState<Publication>();
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
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
  async function save() {
    if (!stored || busy) return;
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
          enabled: selected,
          version: stored.version,
          branchId,
          ...(kind === 'tour' ? { presentation } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(
          result.error?.message ?? result.message ?? 'ثبت انتشار ناموفق بود.',
        );
      setStored(result.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ثبت انتشار ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 rounded-xl border border-border p-3 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          disabled={!stored || busy}
          onChange={(e) => setSelected(e.target.checked)}
        />
        {site.name}
      </label>
      <p className="mt-2 text-xs text-muted-foreground">
        {site.connected
          ? stored?.enabled
            ? 'انتشار فعال'
            : 'منتشر نشده'
          : 'در انتظار اتصال'}
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-2"
        disabled={
          !stored ||
          busy ||
          (stored.enabled === selected &&
            JSON.stringify(
              stored.presentation ?? {
                title: '',
                description: '',
                commissionPercent: '0',
              },
            ) === JSON.stringify(presentation))
        }
        onClick={() => void save()}
      >
        {busy ? 'در حال ثبت…' : 'ذخیره'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={!stored || busy}
        onClick={() => setEditing((v) => !v)}
      >
        ویرایش
      </Button>
      {editing ? (
        <div className="mt-3 grid gap-2">
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
        const rows: { id: string; name: string }[] = [];
        for (let page = 1; page <= 100; page++) {
          const result = await listReferences(
            'cities',
            '',
            page,
            undefined,
            {},
            'sales',
          );
          rows.push(...result.data);
          if (page * result.meta.pageSize >= result.meta.total) break;
        }
        return rows;
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
            Object.fromEntries(cityResult.map((row) => [row.id, row.name])),
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
            <div className="grid gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="grid gap-4">
              {resources
                .filter((row) =>
                  (tab === 'tickets' ? search : `${row.title} ${row.detail}`)
                    .toLocaleLowerCase()
                    .includes(search.toLocaleLowerCase()),
                )
                .map((row) => (
                  <article
                    key={`${revision}:${branchId}:${row.kind}:${row.id}`}
                    className="grid gap-4 rounded-2xl border border-border bg-surface p-4 xl:grid-cols-[minmax(12rem,1fr)_3fr]"
                  >
                    <div className="min-w-0 break-words">
                      <h2 className="font-bold">{row.title}</h2>
                      <p className="text-sm leading-7" dir="auto">
                        {row.detail}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {websiteDestinations.map((site) => (
                        <WebsiteDestination
                          key={site.code}
                          site={site}
                          kind={row.kind}
                          resourceId={row.id}
                          branchId={branchId}
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
