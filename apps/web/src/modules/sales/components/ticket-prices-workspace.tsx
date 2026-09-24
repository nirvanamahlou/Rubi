'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CircleDollarSign,
  RefreshCw,
  Search,
  TicketCheck,
} from 'lucide-react';
import type { TicketOfferV1 } from '@nora/contracts';
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
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/ui/surfaces';
import { toursApi } from '@/modules/ticket-catalog/api/tours';
import {
  listActiveCurrencyReferences,
  listReferences,
} from '@/modules/ticket-catalog/api/references';

type Draft = { amount: string; currencyCode: string };
const faDate = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});

export function TicketPricesWorkspace() {
  const [offers, setOffers] = useState<TicketOfferV1[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [currencies, setCurrencies] = useState<string[]>(['IRR']);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [outboundId, setOutboundId] = useState('');
  const [returnId, setReturnId] = useState('');
  const [pairDraft, setPairDraft] = useState<Draft>({
    amount: '',
    currencyCode: 'IRR',
  });
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [offerResult, currencyRows] = await Promise.all([
        toursApi.managedOffers(),
        listActiveCurrencyReferences(),
      ]);
      const cityRows = [];
      for (let page = 1; page <= 100; page += 1) {
        const result = await listReferences('cities', '', page);
        cityRows.push(...result.data);
        if (page * result.meta.pageSize >= result.meta.total) break;
      }
      setOffers(offerResult.data);
      setCurrencies(currencyRows.map((row) => row.code!).filter(Boolean));
      setCities(Object.fromEntries(cityRows.map((row) => [row.id, row.name])));
      setDrafts(
        Object.fromEntries(
          offerResult.data.map((offer) => [
            offer.id,
            {
              amount: offer.standaloneSalePrice?.amount ?? '',
              currencyCode: offer.standaloneSalePrice?.currencyCode ?? 'IRR',
            },
          ]),
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'دریافت قیمت بلیط‌ها ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const label = useCallback(
    (offer: TicketOfferV1) =>
      `${offer.carrierName} · ${offer.serviceNumber} | ${cities[offer.originId] ?? offer.originId} ← ${cities[offer.destinationId] ?? offer.destinationId} | ${faDate.format(new Date(offer.departureAt))}`,
    [cities],
  );
  const filtered = useMemo(
    () =>
      offers.filter((offer) =>
        label(offer).toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [offers, query, label],
  );
  const outbound = offers.find((offer) => offer.id === outboundId);
  const returnOptions = outbound
    ? offers.filter(
        (offer) =>
          offer.originId === outbound.destinationId &&
          offer.destinationId === outbound.originId &&
          Date.parse(offer.departureAt) > Date.parse(outbound.departureAt),
      )
    : [];
  const currentPair = outbound?.roundTripSalePrices?.find(
    (price) => price.returnOfferId === returnId,
  );

  async function saveOneWay(offer: TicketOfferV1) {
    const draft = drafts[offer.id];
    if (!draft?.amount) return setError('مبلغ قیمت یک‌طرفه را وارد کنید.');
    setSaving(offer.id);
    setError('');
    try {
      await toursApi.updateStandaloneSalePrice(
        offer.id,
        {
          expectedRevision: offer.standaloneSalePrice?.revision ?? 0,
          ...draft,
        },
        crypto.randomUUID(),
      );
      setNotice('قیمت فروش یک‌طرفه ثبت شد.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت قیمت ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }
  async function savePair() {
    if (!outbound || !returnId || !pairDraft.amount)
      return setError('بلیط رفت، برگشت و مبلغ جفت را کامل کنید.');
    setSaving('pair');
    setError('');
    try {
      await toursApi.updateRoundTripSalePrice(
        outbound.id,
        returnId,
        { expectedRevision: currentPair?.revision ?? 0, ...pairDraft },
        crypto.randomUUID(),
      );
      setNotice('قیمت فروش رفت‌وبرگشت ثبت شد و مبنای قراردادهای جدید است.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'ثبت قیمت رفت‌وبرگشت ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        eyebrow="فروش"
        title="قیمت بلیط"
        description="قیمت فروش یک‌طرفه هر بلیط و قیمت واحد جفت رفت‌وبرگشت را ثبت کنید. قراردادهای جدید از آخرین نسخه معتبر استفاده می‌کنند."
        actions={
          <Button variant="outline" onClick={() => void load()} loading={busy}>
            <RefreshCw className="size-4" />
            به‌روزرسانی
          </Button>
        }
      />
      {error ? <Alert tone="error" title={error} /> : null}
      {notice ? <Alert title={notice} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <TicketCheck className="size-5 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            بلیط‌های بارگذاری‌شده
          </p>
          <strong className="text-2xl">
            {offers.length.toLocaleString('fa-IR')}
          </strong>
        </Card>
        <Card className="p-4">
          <CircleDollarSign className="size-5 text-emerald-600" />
          <p className="mt-3 text-sm text-muted-foreground">
            دارای قیمت یک‌طرفه
          </p>
          <strong className="text-2xl">
            {offers
              .filter((o) => o.standaloneSalePrice)
              .length.toLocaleString('fa-IR')}
          </strong>
        </Card>
        <Card className="p-4">
          <ArrowLeftRight className="size-5 text-violet-600" />
          <p className="mt-3 text-sm text-muted-foreground">
            جفت‌های قیمت‌گذاری‌شده
          </p>
          <strong className="text-2xl">
            {offers
              .reduce((sum, o) => sum + (o.roundTripSalePrices?.length ?? 0), 0)
              .toLocaleString('fa-IR')}
          </strong>
        </Card>
      </div>
      <Card className="p-5">
        <div className="mb-5">
          <h2 className="text-lg font-black">قیمت فروش رفت‌وبرگشت</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            این مبلغ، قیمت کل یک مسافر برای هر دو بلیط است و بر مجموع دو مسیر
            اولویت دارد.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <FormField label="بلیط رفت">
            <Select
              value={outboundId}
              onValueChange={(id) => {
                setOutboundId(id);
                setReturnId('');
                setPairDraft({ amount: '', currencyCode: 'IRR' });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب رفت" />
              </SelectTrigger>
              <SelectContent>
                {offers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {label(offer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="بلیط برگشت">
            <Select
              value={returnId}
              onValueChange={(id) => {
                setReturnId(id);
                const price = outbound?.roundTripSalePrices?.find(
                  (p) => p.returnOfferId === id,
                );
                setPairDraft({
                  amount: price?.amount ?? '',
                  currencyCode: price?.currencyCode ?? 'IRR',
                });
              }}
              disabled={!outbound}
            >
              <SelectTrigger>
                <SelectValue placeholder="مسیر معکوس" />
              </SelectTrigger>
              <SelectContent>
                {returnOptions.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {label(offer)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="قیمت کل رفت‌وبرگشت">
            <Input
              inputMode="decimal"
              value={pairDraft.amount}
              onChange={(e) =>
                setPairDraft({
                  ...pairDraft,
                  amount: e.target.value.replace(/[^0-9.]/g, ''),
                })
              }
              placeholder="مثلاً ۲۵۰۰۰۰۰۰"
            />
          </FormField>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <FormField label="ارز">
              <CurrencySelect
                value={pairDraft.currencyCode}
                values={currencies}
                onChange={(currencyCode) =>
                  setPairDraft({ ...pairDraft, currencyCode })
                }
              />
            </FormField>
            <Button onClick={() => void savePair()} loading={saving === 'pair'}>
              ثبت قیمت جفت
            </Button>
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">قیمت فروش یک‌طرفه</h2>
            <p className="text-sm text-muted-foreground">
              هر ردیف یک بلیط منتشرشده و قیمت فروش مستقل آن است.
            </p>
          </div>
          <label className="relative block sm:w-80">
            <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجوی مسیر یا شماره پرواز"
            />
          </label>
        </div>
        {busy ? (
          <p className="p-8 text-center">در حال بارگذاری…</p>
        ) : !filtered.length ? (
          <EmptyState
            title="بلیطی پیدا نشد"
            description="ابتدا بلیط را در مدیریت بلیط‌ها منتشر کنید یا عبارت جست‌وجو را تغییر دهید."
          />
        ) : (
          <div className="divide-y">
            {filtered.map((offer) => (
              <div
                key={offer.id}
                className="grid gap-4 p-5 xl:grid-cols-[minmax(18rem,2fr)_10rem_10rem_auto] xl:items-end"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>
                      {offer.carrierName} ·{' '}
                      <span dir="ltr">{offer.serviceNumber}</span>
                    </strong>
                    <Badge>
                      {offer.status === 'ACTIVE' ? 'فعال' : 'متوقف'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">
                    {cities[offer.originId] ?? offer.originId} ←{' '}
                    {cities[offer.destinationId] ?? offer.destinationId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    حرکت {faDate.format(new Date(offer.departureAt))} · ظرفیت
                    فروش {offer.remainingCapacity.toLocaleString('fa-IR')}
                  </p>
                </div>
                <FormField label="قیمت یک‌طرفه">
                  <Input
                    inputMode="decimal"
                    value={drafts[offer.id]?.amount ?? ''}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [offer.id]: {
                          amount: e.target.value.replace(/[^0-9.]/g, ''),
                          currencyCode: drafts[offer.id]?.currencyCode ?? 'IRR',
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="ارز">
                  <CurrencySelect
                    value={drafts[offer.id]?.currencyCode ?? 'IRR'}
                    values={currencies}
                    onChange={(currencyCode) =>
                      setDrafts({
                        ...drafts,
                        [offer.id]: {
                          amount: drafts[offer.id]?.amount ?? '',
                          currencyCode,
                        },
                      })
                    }
                  />
                </FormField>
                <Button
                  onClick={() => void saveOneWay(offer)}
                  loading={saving === offer.id}
                >
                  ثبت نسخه جدید
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CurrencySelect({
  value,
  values,
  onChange,
}: {
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
