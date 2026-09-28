'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CircleDollarSign,
  PencilLine,
  RefreshCw,
  Search,
  TicketCheck,
} from 'lucide-react';
import type { TicketOfferV1, TicketSalePriceTargetV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
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
import { SalesDatePicker } from './sales-date-picker';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  listActiveCurrencyReferences,
  listReferences,
} from '@/modules/ticket-catalog/api/references';

type Draft = { amount: string; currencyCode: string };
const DIRECT_TARGET = '__DIRECT__';
const faDate = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});
const faDay = new Intl.DateTimeFormat('fa-IR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Tehran',
});
const faTime = new Intl.DateTimeFormat('fa-IR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Tehran',
});
const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function departureDay(iso: string) {
  const parts = Object.fromEntries(
    tehranDay
      .formatToParts(new Date(iso))
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function TicketPricesWorkspace() {
  const [offers, setOffers] = useState<TicketOfferV1[]>([]);
  const [targets, setTargets] = useState<TicketSalePriceTargetV1[]>([]);
  const [targetId, setTargetId] = useState(DIRECT_TARGET);
  const [newTargetName, setNewTargetName] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [currencies, setCurrencies] = useState<string[]>(['IRR']);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [pairQuery, setPairQuery] = useState('');
  const [pairDateFrom, setPairDateFrom] = useState('');
  const [pairDateTo, setPairDateTo] = useState('');
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
      const [offerResult, currencyRows, targetResult] = await Promise.all([
        toursApi.managedOffers(),
        listActiveCurrencyReferences(),
        toursApi.salePriceTargets(),
      ]);
      const cityRows = [];
      for (let page = 1; page <= 100; page += 1) {
        const result = await listReferences('cities', '', page);
        cityRows.push(...result.data);
        if (page * result.meta.pageSize >= result.meta.total) break;
      }
      setOffers(offerResult.data);
      setTargets(targetResult.data);
      setCurrencies(currencyRows.map((row) => row.code!).filter(Boolean));
      setCities(Object.fromEntries(cityRows.map((row) => [row.id, row.name])));
      setDrafts(
        Object.fromEntries(
          offerResult.data.map((offer) => {
            const price =
              targetId === DIRECT_TARGET
                ? offer.standaloneSalePrice
                : offer.targetedStandaloneSalePrices?.find(
                    (item) => item.salePriceTarget.id === targetId,
                  );
            return [
              `${offer.id}:${targetId}`,
              {
                amount: price?.amount ?? '',
                currencyCode: price?.currencyCode ?? 'IRR',
              },
            ];
          }),
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
  }, [targetId]);
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
  const savedPairs = useMemo(
    () =>
      offers.flatMap((outboundOffer) =>
        (outboundOffer.roundTripSalePrices ?? []).map((price) => ({
          outbound: outboundOffer,
          returning: offers.find((offer) => offer.id === price.returnOfferId),
          price,
        })),
      ),
    [offers],
  );
  const filteredPairs = useMemo(() => {
    const search = pairQuery.trim().toLocaleLowerCase();
    return savedPairs.filter((pair) => {
      const day = departureDay(pair.outbound.departureAt);
      if (pairDateFrom && day < pairDateFrom) return false;
      if (pairDateTo && day > pairDateTo) return false;
      if (!search) return true;
      return [
        label(pair.outbound),
        pair.returning ? label(pair.returning) : '',
        pair.price.amount,
        pair.price.currencyCode,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(search);
    });
  }, [savedPairs, pairQuery, pairDateFrom, pairDateTo, label]);

  const priceForTarget = useCallback(
    (offer: TicketOfferV1) =>
      targetId === DIRECT_TARGET
        ? offer.standaloneSalePrice
        : offer.targetedStandaloneSalePrices?.find(
            (price) => price.salePriceTarget.id === targetId,
          ),
    [targetId],
  );

  async function addTarget() {
    if (!newTargetName.trim()) return setError('نام مقصد قیمت را وارد کنید.');
    const base = getPublicApiBaseUrl();
    if (!base) return setError('نشانی سرور تنظیم نشده است.');
    setSaving('target');
    setError('');
    try {
      const session = await refreshAuthenticatedSession(base);
      const branchId = session?.user.branches[0]?.id;
      if (!branchId) throw new Error('شعبه مجاز برای مقصد قیمت یافت نشد.');
      const result = await toursApi.createSalePriceTarget(
        { version: 1, branchId, name: newTargetName.trim() },
        branchId,
      );
      setTargets((current) => [...current, result.data]);
      setTargetId(result.data.id);
      setNewTargetName('');
      setNotice(`مقصد «${result.data.name}» اضافه شد.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'افزودن مقصد قیمت ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }

  async function saveOneWay(offer: TicketOfferV1) {
    const draft = drafts[`${offer.id}:${targetId}`];
    if (!draft?.amount) return setError('مبلغ قیمت یک‌طرفه را وارد کنید.');
    setSaving(offer.id);
    setError('');
    try {
      await toursApi.updateStandaloneSalePrice(
        offer.id,
        {
          expectedRevision: priceForTarget(offer)?.revision ?? 0,
          salePriceTargetId: targetId === DIRECT_TARGET ? null : targetId,
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

  function editPair(pair: (typeof savedPairs)[number]) {
    if (!pair.returning) {
      setError('بلیط برگشت این قیمت دیگر در فهرست مدیریت بلیط‌ها موجود نیست.');
      return;
    }
    setOutboundId(pair.outbound.id);
    setReturnId(pair.returning.id);
    setPairDraft({
      amount: pair.price.amount,
      currencyCode: pair.price.currencyCode,
    });
    setNotice(
      'قیمت جفت انتخاب شد؛ مبلغ را اصلاح کنید و «ثبت نسخه جدید» را بزنید.',
    );
    setError('');
    window.requestAnimationFrame(() =>
      document
        .getElementById('round-trip-price-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
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
      <section
        aria-label="خلاصه قیمت‌گذاری بلیط‌ها"
        className="grid gap-3 sm:grid-cols-3"
      >
        <Card className="relative overflow-hidden border-sky-200/80 bg-gradient-to-br from-sky-500/20 via-sky-50 to-surface p-5 shadow-sm dark:border-sky-400/20 dark:from-sky-950/55 dark:via-sky-950/20">
          <div className="absolute -start-5 -top-6 size-24 rounded-full bg-sky-400/15" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-sky-900/75 dark:text-sky-100/75">
                بلیط‌های بارگذاری‌شده
              </p>
              <strong className="mt-2 block text-3xl font-black tabular-nums text-sky-950 dark:text-sky-50">
                {offers.length.toLocaleString('fa-IR')}
              </strong>
              <p className="mt-2 text-xs text-muted-foreground">
                آماده برای قیمت‌گذاری و قرارداد
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20">
              <TicketCheck className="size-5" />
            </span>
          </div>
        </Card>
        <Card className="relative overflow-hidden border-emerald-200/80 bg-gradient-to-br from-emerald-500/20 via-emerald-50 to-surface p-5 shadow-sm dark:border-emerald-400/20 dark:from-emerald-950/55 dark:via-emerald-950/20">
          <div className="absolute -start-5 -top-6 size-24 rounded-full bg-emerald-400/15" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-900/75 dark:text-emerald-100/75">
                دارای قیمت یک‌طرفه
              </p>
              <strong className="mt-2 block text-3xl font-black tabular-nums text-emerald-950 dark:text-emerald-50">
                {offers
                  .filter((offer) => priceForTarget(offer))
                  .length.toLocaleString('fa-IR')}
              </strong>
              <p className="mt-2 text-xs text-muted-foreground">
                برای مقصد قیمت انتخاب‌شده
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <CircleDollarSign className="size-5" />
            </span>
          </div>
        </Card>
        <Card className="relative overflow-hidden border-violet-200/80 bg-gradient-to-br from-violet-500/20 via-violet-50 to-surface p-5 shadow-sm dark:border-violet-400/20 dark:from-violet-950/55 dark:via-violet-950/20">
          <div className="absolute -start-5 -top-6 size-24 rounded-full bg-violet-400/15" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-violet-900/75 dark:text-violet-100/75">
                جفت‌های قیمت‌گذاری‌شده
              </p>
              <strong className="mt-2 block text-3xl font-black tabular-nums text-violet-950 dark:text-violet-50">
                {offers
                  .reduce(
                    (sum, offer) =>
                      sum + (offer.roundTripSalePrices?.length ?? 0),
                    0,
                  )
                  .toLocaleString('fa-IR')}
              </strong>
              <p className="mt-2 text-xs text-muted-foreground">
                قیمت واحد برای مسیر رفت و برگشت
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
              <ArrowLeftRight className="size-5" />
            </span>
          </div>
        </Card>
      </section>
      <Card className="border-violet-200/80 p-5 shadow-sm dark:border-violet-400/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
              فهرست قیمت‌گذاری
            </p>
            <h2 className="mt-1 text-lg font-black">
              قیمت‌های رفت‌وبرگشت ثبت‌شده
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              رفت، برگشت و قیمت کل هر جفت را ببینید و برای اصلاح انتخاب کنید.
            </p>
          </div>
          <Badge>
            {filteredPairs.length.toLocaleString('fa-IR')} از{' '}
            {savedPairs.length.toLocaleString('fa-IR')} جفت
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(14rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] md:items-end">
          <FormField label="مسیر، ایرلاین یا شماره پرواز">
            <Input
              value={pairQuery}
              onChange={(event) => setPairQuery(event.target.value)}
              placeholder="جست‌وجوی رفت یا برگشت"
            />
          </FormField>
          <FormField label="تاریخ رفت از">
            <SalesDatePicker value={pairDateFrom} onChange={setPairDateFrom} />
          </FormField>
          <FormField label="تاریخ رفت تا">
            <SalesDatePicker value={pairDateTo} onChange={setPairDateTo} />
          </FormField>
          <Button
            variant="outline"
            onClick={() => {
              setPairQuery('');
              setPairDateFrom('');
              setPairDateTo('');
            }}
          >
            پاک‌کردن فیلتر
          </Button>
        </div>
        {busy ? (
          <p className="mt-4 text-sm text-muted-foreground">
            در حال دریافت قیمت‌ها…
          </p>
        ) : filteredPairs.length ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {filteredPairs.map((pair) => (
              <div
                key={`${pair.outbound.id}:${pair.price.returnOfferId}`}
                className="rounded-xl border border-violet-100 bg-muted/15 p-4 dark:border-violet-400/15"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                      رفت
                    </span>
                    <p className="mt-1 text-sm font-semibold">
                      {label(pair.outbound)}
                    </p>
                    <strong className="mt-1 block text-base tabular-nums">
                      ظرفیت باقی‌مانده:{' '}
                      {pair.outbound.remainingCapacity.toLocaleString('fa-IR')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                      برگشت
                    </span>
                    <p className="mt-1 text-sm font-semibold">
                      {pair.returning
                        ? label(pair.returning)
                        : 'بلیط برگشت در دسترس نیست'}
                    </p>
                    {pair.returning ? (
                      <strong className="mt-1 block text-base tabular-nums">
                        ظرفیت باقی‌مانده:{' '}
                        {pair.returning.remainingCapacity.toLocaleString(
                          'fa-IR',
                        )}
                      </strong>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-violet-200 bg-surface px-3 py-2 dark:border-violet-400/20">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300">
                    مقصد سفر:{' '}
                    {cities[pair.outbound.destinationId] ?? 'مقصد نامشخص'}
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    رفت {faDay.format(new Date(pair.outbound.departureAt))}
                    {pair.returning
                      ? ` · برگشت ${faDay.format(new Date(pair.returning.departureAt))}`
                      : ''}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div>
                    <strong
                      dir="ltr"
                      className="block text-lg font-black tabular-nums"
                    >
                      {pair.price.amount} {pair.price.currencyCode}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      نسخه {pair.price.revision.toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => editPair(pair)}
                    disabled={!pair.returning}
                  >
                    <PencilLine className="size-4" /> ویرایش قیمت
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {savedPairs.length
              ? 'برای این فیلتر قیمت جفتی پیدا نشد.'
              : 'هنوز قیمت رفت‌وبرگشت ثبت نشده است.'}
          </p>
        )}
      </Card>
      <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-surface to-indigo-50/70 p-5 shadow-sm dark:border-violet-400/20 dark:from-violet-950/35 dark:via-surface dark:to-indigo-950/25">
        <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto] lg:items-end">
          <div>
            <h2 className="text-lg font-black">مقصد قیمت فروش</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              برای هر مقصد، نسخهٔ مستقل قیمت ثبت می‌شود؛ نمونه: فروش مجموعه یا
              علی‌بابا.
            </p>
          </div>
          <FormField label="این قیمت برای کجاست؟">
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DIRECT_TARGET}>
                  فروش مستقیم مجموعه
                </SelectItem>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex gap-2">
            <Input
              value={newTargetName}
              onChange={(event) => setNewTargetName(event.target.value)}
              placeholder="افزودن مقصد، مثلاً علی‌بابا"
            />
            <Button
              variant="outline"
              onClick={() => void addTarget()}
              loading={saving === 'target'}
            >
              افزودن
            </Button>
          </div>
        </div>
      </Card>
      <Card id="round-trip-price-editor" className="scroll-mt-24 p-5">
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
            <MoneyInput
              value={pairDraft.amount}
              onValueChange={(amount) =>
                setPairDraft({
                  ...pairDraft,
                  amount,
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
              {currentPair ? 'ثبت نسخه جدید' : 'ثبت قیمت جفت'}
            </Button>
          </div>
        </div>
        {outbound && returnId ? (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-sm dark:border-violet-400/20 dark:bg-violet-950/25">
            {currentPair ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  قیمت ثبت‌شدهٔ این جفت:{' '}
                  <strong dir="ltr" className="font-black">
                    {currentPair.amount} {currentPair.currencyCode}
                  </strong>
                </span>
                <Badge>
                  نسخه {currentPair.revision.toLocaleString('fa-IR')}
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground">
                برای این جفت هنوز قیمت ثبت نشده است.
              </span>
            )}
          </div>
        ) : null}
      </Card>
      <Card className="overflow-hidden border-sky-200/80 bg-gradient-to-br from-sky-50/70 via-surface to-blue-50/50 shadow-sm dark:border-sky-400/20 dark:from-sky-950/25 dark:via-surface dark:to-blue-950/20">
        <div className="flex flex-col gap-3 border-b border-sky-200/70 bg-sky-50/45 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-sky-400/15 dark:bg-sky-950/15">
          <div>
            <p className="text-xs font-bold tracking-wide text-sky-700 dark:text-sky-300">
              فهرست قیمت‌گذاری
            </p>
            <h2 className="mt-1 text-lg font-black">قیمت فروش یک‌طرفه</h2>
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
          <div className="space-y-3 p-3 sm:p-4">
            {filtered.map((offer) => (
              <div
                key={offer.id}
                className="grid gap-4 rounded-2xl border border-sky-100 bg-surface/90 p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-sky-400/15 xl:grid-cols-[minmax(17rem,2fr)_10rem_10rem_auto_minmax(10rem,1fr)] xl:items-end"
              >
                <div className="rounded-xl bg-sky-50/70 p-3 dark:bg-sky-950/25">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base">
                      {offer.carrierName} ·{' '}
                      <span dir="ltr">{offer.serviceNumber}</span>
                    </strong>
                    <Badge>
                      {offer.status === 'ACTIVE' ? 'فعال' : 'متوقف'}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium">
                    {cities[offer.originId] ?? offer.originId} ←{' '}
                    {cities[offer.destinationId] ?? offer.destinationId}
                  </p>
                  <strong className="mt-2 block text-base font-black tabular-nums text-sky-800 dark:text-sky-200">
                    ظرفیت فروش:{' '}
                    {offer.remainingCapacity.toLocaleString('fa-IR')}
                  </strong>
                </div>
                <FormField label="قیمت یک‌طرفه">
                  <MoneyInput
                    value={drafts[`${offer.id}:${targetId}`]?.amount ?? ''}
                    onValueChange={(amount) =>
                      setDrafts({
                        ...drafts,
                        [`${offer.id}:${targetId}`]: {
                          amount,
                          currencyCode:
                            drafts[`${offer.id}:${targetId}`]?.currencyCode ??
                            'IRR',
                        },
                      })
                    }
                  />
                </FormField>
                <FormField label="ارز">
                  <CurrencySelect
                    value={
                      drafts[`${offer.id}:${targetId}`]?.currencyCode ?? 'IRR'
                    }
                    values={currencies}
                    onChange={(currencyCode) =>
                      setDrafts({
                        ...drafts,
                        [`${offer.id}:${targetId}`]: {
                          amount:
                            drafts[`${offer.id}:${targetId}`]?.amount ?? '',
                          currencyCode,
                        },
                      })
                    }
                  />
                </FormField>
                <div className="flex flex-col gap-2">
                  {priceForTarget(offer) ? (
                    <span className="text-xs text-muted-foreground">
                      نسخه فعلی{' '}
                      {priceForTarget(offer)!.revision.toLocaleString('fa-IR')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      هنوز قیمت ثبت نشده است
                    </span>
                  )}
                  <Button
                    onClick={() => void saveOneWay(offer)}
                    loading={saving === offer.id}
                  >
                    ثبت نسخه جدید
                  </Button>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-left dark:border-sky-400/20 dark:bg-sky-950/25">
                  <span className="block text-xs font-bold text-muted-foreground">
                    تاریخ بلیط
                  </span>
                  <strong className="mt-1 block text-lg font-black tabular-nums text-primary">
                    {faDay.format(new Date(offer.departureAt))}
                  </strong>
                  <span className="mt-1 block text-sm font-semibold tabular-nums">
                    ساعت {faTime.format(new Date(offer.departureAt))}
                  </span>
                </div>
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
