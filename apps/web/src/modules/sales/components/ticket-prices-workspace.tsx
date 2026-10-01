'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CircleDollarSign,
  Copy,
  FileSpreadsheet,
  PencilLine,
  RefreshCw,
  Search,
  TicketCheck,
  Trash2,
} from 'lucide-react';
import type {
  TicketOfferV1,
  TicketSalePriceTargetV1,
  TicketSalePriceTierV1,
} from '@nora/contracts';
import { eligibleTicketReturn } from '@nora/contracts';
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
import {
  listActiveCurrencyReferences,
  listReferences,
} from '@/modules/ticket-catalog/api/references';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { SalesDatePicker } from './sales-date-picker';
import {
  ticketPriceRows,
  clearSavedCommissionDrafts,
  filterTicketRows,
  netTicketPrice,
  normalizePercent,
  validPercent,
  type TicketPriceRow,
} from '../model/ticket-price-rows';
import { ticketPriceExportRows } from '../model/ticket-prices-export';
import targetStyles from './ticket-price-targets.module.css';
type Draft = {
  amount: string;
  currencyCode: string;
  tiers?: TicketSalePriceTierV1[] | undefined;
};
function validTierDraft(draft: Draft, capacity: number) {
  return (
    !draft.tiers ||
    (draft.tiers.length > 0 &&
      draft.tiers.every(
        (tier) =>
          Number.isSafeInteger(tier.seatCount) &&
          tier.seatCount > 0 &&
          /^\d+(?:\.\d{1,4})?$/.test(tier.amount) &&
          Number(tier.amount) > 0,
      ) &&
      draft.tiers.reduce((sum, tier) => sum + tier.seatCount, 0) === capacity &&
      draft.tiers[0]?.amount === draft.amount)
  );
}
export function maxTierSeatCount(
  tiers: readonly TicketSalePriceTierV1[],
  index: number,
  capacity: number,
) {
  const assignedToOtherTiers = tiers.reduce(
    (sum, tier, tierIndex) =>
      tierIndex === index ? sum : sum + (Number(tier.seatCount) || 0),
    0,
  );
  return Math.max(0, capacity - assignedToOtherTiers);
}
export function clampTierSeatCount(
  value: string,
  tiers: readonly TicketSalePriceTierV1[],
  index: number,
  capacity: number,
) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(
        maxTierSeatCount(tiers, index, capacity),
        Math.max(0, Math.trunc(parsed)),
      )
    : 0;
}
function TierEditor({
  draft,
  capacity,
  onChange,
  onSave,
  saving,
}: {
  draft: Draft;
  capacity: number;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const tiers = draft.tiers;
  let first = 1;
  const assigned =
    tiers?.reduce((sum, tier) => sum + (Number(tier.seatCount) || 0), 0) ?? 0;
  const remaining = Math.max(0, capacity - assigned);
  return (
    <div className="col-span-2 space-y-1 text-xs">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!tiers}
          onChange={(e) =>
            onChange({
              ...draft,
              tiers: e.target.checked
                ? [{ seatCount: capacity, amount: draft.amount }]
                : undefined,
            })
          }
        />
        قیمت‌گذاری پله‌ای صندلی‌ها
      </label>
      {tiers?.map((tier, index) => {
        const start = first;
        first += Number(tier.seatCount) || 0;
        return (
          <div key={index} className="flex items-center gap-1">
            <span className="shrink-0">
              {start} تا {first - 1}
            </span>
            <Input
              aria-label={`تعداد صندلی پله ${index + 1}`}
              type="number"
              min="1"
              max={maxTierSeatCount(tiers, index, capacity)}
              className="h-8 w-16"
              value={tier.seatCount || ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  tiers: tiers.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          seatCount: clampTierSeatCount(
                            e.target.value,
                            tiers,
                            index,
                            capacity,
                          ),
                        }
                      : item,
                  ),
                })
              }
            />
            <MoneyInput
              className="h-8 min-w-0 flex-1"
              value={tier.amount}
              onValueChange={(amount) =>
                onChange({
                  ...draft,
                  amount: index === 0 ? amount : draft.amount,
                  tiers: tiers.map((item, i) =>
                    i === index ? { ...item, amount } : item,
                  ),
                })
              }
            />
            {tiers.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...draft,
                    tiers: tiers.filter((_, i) => i !== index),
                  })
                }
              >
                حذف
              </Button>
            ) : null}
          </div>
        );
      })}
      {tiers ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              remaining === 0 || tiers.length >= 40 || tiers.length >= capacity
            }
            onClick={() =>
              onChange({
                ...draft,
                tiers: [
                  ...tiers,
                  {
                    seatCount: remaining,
                    amount: draft.amount,
                  },
                ],
              })
            }
          >
            {remaining > 0 && tiers.length < 40 && tiers.length < capacity
              ? 'افزودن پله'
              : 'ظرفیت تکمیل شده'}
          </Button>
          <p>
            جمع:{' '}
            {tiers.reduce(
              (sum, tier) => sum + (Number(tier.seatCount) || 0),
              0,
            )}{' '}
            از {capacity} صندلی
          </p>
        </>
      ) : null}
      {tiers ? (
        <Button
          type="button"
          size="sm"
          className="mt-2 w-full"
          onClick={onSave}
          disabled={saving || !validTierDraft(draft, capacity)}
          loading={saving}
        >
          ثبت قیمت پله‌ای
        </Button>
      ) : null}
    </div>
  );
}
const DIRECT_TARGET = '__DIRECT__';
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
function formatAmount(value: string) {
  const [whole, fraction] = value.split('.');
  return (
    BigInt(whole!).toLocaleString('en-US') + (fraction ? '.' + fraction : '')
  );
}
export function TicketPricesWorkspace() {
  const [offers, setOffers] = useState<TicketOfferV1[]>([]);
  const [targets, setTargets] = useState<TicketSalePriceTargetV1[]>([]);
  const [newTargetName, setNewTargetName] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [percentDrafts, setPercentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [cities, setCities] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [tripType, setTripType] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [outboundId, setOutboundId] = useState('');
  const [returnId, setReturnId] = useState('');
  const [pairDraft, setPairDraft] = useState<Draft>({
    amount: '',
    currencyCode: 'IRR',
  });
  const [busy, setBusy] = useState(true);
  const [exporting, setExporting] = useState(false);
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
      for (let page = 1; page <= 100; page++) {
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
          ticketPriceRows(offerResult.data).map((row) => [
            row.id,
            {
              amount: row.base?.amount ?? '',
              tiers: row.base?.tiers?.map((tier) => ({ ...tier })),
              currencyCode:
                row.base?.currencyCode ?? currencyRows[0]?.code ?? 'IRR',
            },
          ]),
        ),
      );
      setPercentDrafts({});
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت قیمت‌ها ناموفق بود.',
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
      [
        offer.carrierName,
        offer.serviceNumber,
        cities[offer.originId] ?? offer.originId,
        cities[offer.destinationId] ?? offer.destinationId,
        faDay.format(new Date(offer.departureAt)),
        faTime.format(new Date(offer.departureAt)),
      ].join(' · '),
    [cities],
  );
  const rows = useMemo(() => ticketPriceRows(offers), [offers]);
  const filtered = useMemo(
    () =>
      filterTicketRows(
        rows,
        {
          originId,
          destinationId,
          tripType,
          query,
          from: dateFrom,
          to: dateTo,
        },
        label,
      ),
    [rows, originId, destinationId, tripType, query, dateFrom, dateTo, label],
  );
  const branches = useMemo(
    () => [...new Set(offers.map((o) => o.branchId))],
    [offers],
  );
  const outbound = offers.find((o) => o.id === outboundId);
  const returnOptions = outbound
    ? offers.filter(
        (o) =>
          o.branchId === outbound.branchId && eligibleTicketReturn(outbound, o),
      )
    : [];
  const currentPair = outbound?.roundTripSalePrices?.find(
    (p) => p.returnOfferId === returnId,
  );
  function updateDraft(row: TicketPriceRow, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [row.id]: {
        amount: current[row.id]?.amount ?? '',
        currencyCode: current[row.id]?.currencyCode ?? 'IRR',
        ...patch,
      },
    }));
  }
  async function saveBase(row: TicketPriceRow) {
    const draft = drafts[row.id];
    if (!draft?.amount || !currencies.includes(draft.currencyCode))
      return setError('قیمت مثبت و ارز فعال را وارد کنید.');
    if (
      !validTierDraft(
        draft,
        row.returning
          ? Math.min(row.offer.totalCapacity, row.returning.totalCapacity)
          : row.offer.totalCapacity,
      )
    )
      return setError(
        'جمع تعداد پله‌ها باید برابر ظرفیت بلیت باشد و قیمت پله اول با قیمت پایه یکسان باشد.',
      );
    setSaving(row.id);
    setError('');
    setNotice('');
    try {
      if (row.returnOfferId)
        await toursApi.updateRoundTripSalePrice(
          row.offer.id,
          row.returnOfferId,
          { expectedRevision: row.base?.revision ?? 0, ...draft },
          crypto.randomUUID(),
        );
      else
        await toursApi.updateStandaloneSalePrice(
          row.offer.id,
          {
            expectedRevision: row.base?.revision ?? 0,
            salePriceTargetId: null,
            ...draft,
          },
          crypto.randomUUID(),
        );
      await load();
      setNotice(
        'قیمت پایه ثبت شد؛ قیمت مقصدها با درصد ذخیره‌شده محاسبه می‌شود.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت قیمت ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }
  async function saveCommission(
    row: TicketPriceRow,
    targetId: string,
    copyToAll: boolean,
  ) {
    const target = targetId === DIRECT_TARGET ? null : targetId;
    const current = row.offer.saleCommissions?.find(
      (c) =>
        c.returnOfferId === row.returnOfferId && c.salePriceTargetId === target,
    );
    const percent =
      percentDrafts[row.id + ':' + targetId] ?? current?.percent ?? '0';
    if (!row.base || !validPercent(percent))
      return setError('درصدی بین صفر و صد با حداکثر چهار رقم اعشار وارد کنید.');
    setSaving(row.id + ':' + targetId);
    setError('');
    setNotice('');
    try {
      const result = await toursApi.updateSaleCommission(
        {
          offerId: row.offer.id,
          returnOfferId: row.returnOfferId,
          salePriceTargetId: target,
          percent,
          expectedRevision: current?.revision ?? 0,
          expectedBaseRevision: row.base.revision,
          copyToAll,
        },
        crypto.randomUUID(),
      );
      const refreshed = await toursApi.managedOffers();
      setOffers(refreshed.data);
      setPercentDrafts((drafts) =>
        clearSavedCommissionDrafts(drafts, rows, row, targetId, copyToAll),
      );
      setNotice(
        copyToAll
          ? 'درصد این مقصد برای ' +
              result.data.count.toLocaleString('fa-IR') +
              ' بلیت قیمت‌دار ثبت شد.'
          : 'درصد و قیمت مقصد فروش ثبت شد.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت درصد ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }
  async function removeTarget(target: TicketSalePriceTargetV1) {
    setSaving('target:' + target.id);
    setError('');
    setNotice('');
    try {
      await toursApi.removeSalePriceTarget(target.id, target.version);
      setTargets((current) => current.filter((item) => item.id !== target.id));
      setNotice('مقصد فروش حذف شد؛ سوابق قیمت آن محفوظ است.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'حذف مقصد ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }
  async function addTarget() {
    if (!newTargetName.trim()) return setError('نام مقصد فروش را وارد کنید.');
    setSaving('target');
    setError('');
    try {
      const base = getPublicApiBaseUrl();
      if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
      const session = await refreshAuthenticatedSession(base);
      const branchId =
        targetBranch ||
        (branches.length === 1 ? branches[0] : undefined) ||
        session?.user.branches[0]?.id;
      if (!branchId) throw new Error('شعبه مقصد فروش را انتخاب کنید.');
      await toursApi.createSalePriceTarget(
        { version: 1, branchId, name: newTargetName.trim() },
        branchId,
      );
      setNewTargetName('');
      await load();
      setNotice(
        'مقصد فروش اضافه شد و جلوی بلیت‌های همان شعبه نمایش داده می‌شود.',
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'افزودن مقصد ناموفق بود.',
      );
    } finally {
      setSaving('');
    }
  }
  async function savePair() {
    if (
      !outbound ||
      !returnId ||
      !pairDraft.amount ||
      !currencies.includes(pairDraft.currencyCode)
    )
      return setError('بلیط رفت، برگشت، مبلغ و ارز فعال را کامل کنید.');
    if (
      !validTierDraft(
        pairDraft,
        Math.min(
          outbound.totalCapacity,
          offers.find((o) => o.id === returnId)?.totalCapacity ?? 0,
        ),
      )
    )
      return setError('جمع تعداد پله‌ها باید برابر ظرفیت جفت بلیت باشد.');
    setSaving('pair');
    setError('');
    setNotice('');
    try {
      await toursApi.updateRoundTripSalePrice(
        outbound.id,
        returnId,
        { expectedRevision: currentPair?.revision ?? 0, ...pairDraft },
        crypto.randomUUID(),
      );
      await load();
      setNotice('قیمت فروش رفت‌وبرگشت ثبت شد و مبنای قراردادهای جدید است.');
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
  function editPair(row: TicketPriceRow) {
    setOutboundId(row.offer.id);
    setReturnId(row.returnOfferId ?? '');
    setPairDraft({
      amount: row.base?.amount ?? '',
      currencyCode: row.base?.currencyCode ?? 'IRR',
    });
    window.requestAnimationFrame(() =>
      document
        .getElementById('round-trip-price-editor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  async function exportPrices() {
    setExporting(true);
    setError('');
    try {
      const exportRows = ticketPriceExportRows(filtered, targets, cities);
      const { createTicketPricesXlsx } =
        await import('../model/ticket-prices-xlsx');
      const bytes = createTicketPricesXlsx(exportRows);
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `ticket-prices-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError('خروجی اکسل قیمت بلیت آماده نشد؛ دوباره تلاش کنید.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        eyebrow="فروش"
        title="قیمت بلیط"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void exportPrices()}
              disabled={busy || exporting || !filtered.length}
              loading={exporting}
            >
              <FileSpreadsheet className="size-4" />
              خروجی اکسل ({filtered.length.toLocaleString('fa-IR')})
            </Button>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={!!saving || exporting}
              loading={busy}
            >
              <RefreshCw className="size-4" />
              به‌روزرسانی
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error" title={error} /> : null}
      {notice ? <Alert title={notice} /> : null}

      <section
        aria-label="خلاصه قیمت‌گذاری بلیط‌ها"
        className="grid gap-3 sm:grid-cols-3"
      >
        {[
          {
            title: 'بلیط‌های بارگذاری‌شده',
            count: offers.length,
            Icon: TicketCheck,
            style: 'from-sky-500/20 via-sky-50 dark:via-sky-950/30',
            hint: 'آماده قیمت‌گذاری',
          },
          {
            title: 'دارای قیمت یک‌طرفه',
            count: rows.filter((row) => !row.returnOfferId && row.base).length,
            Icon: CircleDollarSign,
            style: 'from-emerald-500/20 via-emerald-50 dark:via-emerald-950/30',
            hint: 'قیمت پایه ثبت‌شده',
          },
          {
            title: 'جفت‌های قیمت‌گذاری‌شده',
            count: rows.filter((row) => row.returnOfferId).length,
            Icon: ArrowLeftRight,
            style: 'from-violet-500/20 via-violet-50 dark:via-violet-950/30',
            hint: 'قیمت واحد رفت و برگشت',
          },
        ].map(({ title, count, Icon, style, hint }) => (
          <Card
            key={title}
            className={'bg-gradient-to-br to-surface p-5 shadow-sm ' + style}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {title}
                </p>
                <strong className="mt-2 block text-3xl font-black">
                  {count.toLocaleString('fa-IR')}
                </strong>
                <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
              </div>
              <Icon className="size-6 text-primary" />
            </div>
          </Card>
        ))}
      </section>
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <h2 className="text-lg font-black">افزودن و حذف مقصد فروش</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              قیمت پایه را برای هر بلیت ثبت کنید؛ درصد هر مقصد جلوی همان بلیت
              قرار می‌گیرد.
            </p>
          </div>
          {branches.length > 1 ? (
            <FormField label="شعبه مقصد فروش">
              <Select value={targetBranch} onValueChange={setTargetBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب شعبه" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch, i) => (
                    <SelectItem key={branch} value={branch}>
                      شعبه {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          <FormField label="نام مقصد فروش">
            <Input
              value={newTargetName}
              onChange={(e) => setNewTargetName(e.target.value)}
              placeholder="مثلاً علی‌بابا"
            />
          </FormField>
          <Button
            variant="outline"
            onClick={() => void addTarget()}
            disabled={
              busy || !!saving || (branches.length > 1 && !targetBranch)
            }
            loading={saving === 'target'}
          >
            افزودن مقصد
          </Button>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2"
          aria-label="مقصدهای فروش فعال"
        >
          <span className="rounded-lg border px-3 py-1.5 text-xs">مجموعه</span>
          {targets
            .filter((target) => target.isActive)
            .map((target) => (
              <span
                key={target.id}
                className="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs"
              >
                {target.name}
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-7 px-1"
                  title={'حذف مقصد ' + target.name}
                  onClick={() => void removeTarget(target)}
                  disabled={!!saving}
                >
                  <Trash2 className="size-3.5" />
                  <span>حذف</span>
                </Button>
              </span>
            ))}
        </div>
      </Card>
      <Card id="round-trip-price-editor" className="scroll-mt-24 p-5">
        <h2 className="mb-4 text-lg font-black">ثبت قیمت رفت‌وبرگشت</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(8rem,1fr)_7rem_auto] xl:items-end">
          <FormField label="بلیط رفت">
            <Select
              value={outboundId}
              onValueChange={(id) => {
                setOutboundId(id);
                setReturnId('');
                setPairDraft({
                  amount: '',
                  currencyCode: currencies[0] ?? 'IRR',
                });
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="انتخاب رفت" />
              </SelectTrigger>
              <SelectContent>
                {offers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {label(o)}
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
                const p = outbound?.roundTripSalePrices?.find(
                  (p) => p.returnOfferId === id,
                );
                setPairDraft({
                  amount: p?.baseAmount ?? p?.amount ?? '',
                  tiers: (p?.baseTiers ?? p?.tiers)?.map((tier) => ({
                    ...tier,
                  })),
                  currencyCode: p?.currencyCode ?? currencies[0] ?? 'IRR',
                });
              }}
              disabled={!outbound}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="انتخاب برگشت" />
              </SelectTrigger>
              <SelectContent>
                {returnOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {label(o)}
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
                  ...(pairDraft.tiers?.length
                    ? {
                        tiers: pairDraft.tiers.map((tier, index) =>
                          index === 0 ? { ...tier, amount } : tier,
                        ),
                      }
                    : {}),
                })
              }
            />
          </FormField>
          <FormField label="ارز">
            <CurrencySelect
              value={pairDraft.currencyCode}
              values={currencies}
              onChange={(currencyCode) =>
                setPairDraft({ ...pairDraft, currencyCode })
              }
            />
          </FormField>
          {outbound && returnId ? (
            <TierEditor
              draft={pairDraft}
              capacity={Math.min(
                outbound.totalCapacity,
                offers.find((o) => o.id === returnId)?.totalCapacity ?? 0,
              )}
              onSave={() => void savePair()}
              saving={busy || !!saving}
              onChange={setPairDraft}
            />
          ) : null}
          <Button
            onClick={() => void savePair()}
            disabled={busy || !!saving}
            loading={saving === 'pair'}
          >
            {currentPair ? 'ثبت نسخه جدید' : 'ثبت قیمت جفت'}
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden border-sky-200/80 shadow-sm">
        <div className="space-y-4 border-b bg-sky-50/50 p-5 dark:bg-sky-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black">فهرست قیمت‌گذاری بلیت‌ها</h2>
            <Badge>{filtered.length.toLocaleString('fa-IR')} بلیت / جفت</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="مبدأ">
              <Select
                value={originId || 'ALL'}
                onValueChange={(v) => setOriginId(v === 'ALL' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه مبدأها</SelectItem>
                  {[...new Set(offers.map((o) => o.originId))].map((id) => (
                    <SelectItem key={id} value={id}>
                      {cities[id] ?? id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="مقصد سفر">
              <Select
                value={destinationId || 'ALL'}
                onValueChange={(v) => setDestinationId(v === 'ALL' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه مقصدها</SelectItem>
                  {[...new Set(offers.map((o) => o.destinationId))].map(
                    (id) => (
                      <SelectItem key={id} value={id}>
                        {cities[id] ?? id}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="نوع بلیت">
              <Select value={tripType} onValueChange={setTripType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه بلیت‌ها</SelectItem>
                  <SelectItem value="ONEWAY">یک‌طرفه</SelectItem>
                  <SelectItem value="ROUNDTRIP">رفت‌وبرگشت</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="مسیر، ایرلاین یا شماره پرواز">
              <div className="relative">
                <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pe-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="جست‌وجوی رفت یا برگشت"
                />
              </div>
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <FormField label="تاریخ رفت از">
              <SalesDatePicker value={dateFrom} onChange={setDateFrom} />
            </FormField>
            <FormField label="تاریخ رفت تا">
              <SalesDatePicker value={dateTo} onChange={setDateTo} />
            </FormField>
            <Button
              variant="outline"
              onClick={() => {
                setOriginId('');
                setDestinationId('');
                setTripType('ALL');
                setQuery('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              پاک‌کردن فیلتر
            </Button>
          </div>
          {dateFrom && dateTo && dateFrom > dateTo ? (
            <p role="alert" className="text-sm text-red-600">
              تاریخ پایان باید پس از تاریخ شروع باشد.
            </p>
          ) : null}
        </div>
        {busy ? (
          <p className="p-8 text-center">در حال بارگذاری…</p>
        ) : !filtered.length ? (
          <EmptyState
            title="بلیطی پیدا نشد"
            description="فیلترها را تغییر دهید یا بلیت تازه منتشر کنید."
          />
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {error ? <Alert tone="error" title={error} /> : null}
            {notice ? <Alert title={notice} /> : null}
            {filtered.map((row) => {
              const draft = drafts[row.id] ?? {
                amount: '',
                currencyCode: currencies[0] ?? 'IRR',
              };
              const channels = [
                { id: DIRECT_TARGET, name: 'مجموعه' },
                ...targets.filter(
                  (t) => t.isActive && t.branchId === row.offer.branchId,
                ),
              ];
              return (
                <article
                  key={row.id}
                  aria-label={
                    (row.returnOfferId ? 'رفت‌وبرگشت ' : 'یک‌طرفه ') +
                    label(row.offer)
                  }
                  className="min-w-0 rounded-xl border border-sky-100 bg-surface p-3 shadow-sm dark:border-sky-400/20"
                >
                  <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_15rem] xl:grid-cols-[minmax(0,1fr)_16rem_minmax(0,2.3fr)]">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge>
                          {row.returnOfferId ? 'رفت‌وبرگشت' : 'یک‌طرفه'}
                        </Badge>
                        <strong className="text-base font-bold">
                          {cities[row.offer.originId] ?? 'مبدأ'} ←{' '}
                          {cities[row.offer.destinationId] ?? 'مقصد'}
                        </strong>
                      </div>
                      <div className="grid gap-1.5">
                        <FlightSummary
                          offer={row.offer}
                          direction={row.returnOfferId ? 'رفت' : 'پرواز'}
                        />
                        {row.returnOfferId ? (
                          <FlightSummary
                            offer={row.returning}
                            direction="برگشت"
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] items-end gap-1.5 rounded-lg border bg-muted/15 p-2 [&_label]:text-xs">
                      <FormField
                        label={
                          row.returnOfferId
                            ? 'قیمت پایه کل رفت‌وبرگشت'
                            : 'قیمت پایه یک‌طرفه'
                        }
                      >
                        <MoneyInput
                          className="h-8 rounded-lg px-2 text-xs"
                          value={draft.amount}
                          onValueChange={(amount) =>
                            updateDraft(row, {
                              amount,
                              ...(draft.tiers?.length
                                ? {
                                    tiers: draft.tiers.map((tier, i) =>
                                      i === 0 ? { ...tier, amount } : tier,
                                    ),
                                  }
                                : {}),
                            })
                          }
                        />
                      </FormField>
                      <FormField label="ارز">
                        <CurrencySelect
                          value={draft.currencyCode}
                          values={currencies}
                          compact
                          onChange={(currencyCode) =>
                            updateDraft(row, { currencyCode })
                          }
                        />
                      </FormField>
                      <Button
                        size="sm"
                        className="col-span-2 min-h-8"
                        onClick={() => void saveBase(row)}
                        disabled={!!saving || !currencies.length}
                        loading={saving === row.id}
                      >
                        ثبت قیمت پایه
                      </Button>
                      {row.returnOfferId ? (
                        <Button
                          size="sm"
                          className="col-span-2 min-h-8"
                          variant="outline"
                          onClick={() => editPair(row)}
                          disabled={!row.returning}
                        >
                          <PencilLine className="size-4" />
                          ویرایش جفت
                        </Button>
                      ) : null}
                    </div>
                    {row.base ? (
                      <div
                        className={targetStyles.panel}
                        aria-label="قیمت مقصدهای فروش"
                      >
                        {Array.from(
                          { length: Math.ceil(channels.length / 2) },
                          (_, index) =>
                            channels.slice(index * 2, index * 2 + 2),
                        ).map((group) => (
                          <div
                            key={group[0]!.id}
                            className={targetStyles.group}
                          >
                            <div className={targetStyles.heading}>
                              مقصد فروش · کمیسیون ٪ · قیمت
                            </div>
                            {group.map((target) => {
                              const targetId =
                                target.id === DIRECT_TARGET ? null : target.id;
                              const current = row.offer.saleCommissions?.find(
                                (c) =>
                                  c.returnOfferId === row.returnOfferId &&
                                  c.salePriceTargetId === targetId,
                              );
                              const legacy =
                                targetId && !row.returnOfferId
                                  ? row.offer.targetedStandaloneSalePrices?.find(
                                      (p) => p.salePriceTarget.id === targetId,
                                    )
                                  : undefined;
                              const fieldKey = row.id + ':' + target.id;
                              const percent =
                                percentDrafts[fieldKey] ??
                                current?.percent ??
                                '0';
                              const net =
                                legacy &&
                                !current &&
                                percentDrafts[fieldKey] === undefined
                                  ? legacy.amount
                                  : netTicketPrice(row.base!.amount, percent);
                              return (
                                <div
                                  key={target.id}
                                  className={targetStyles.row}
                                >
                                  <strong className={targetStyles.name}>
                                    {target.name}
                                  </strong>
                                  <Input
                                    className="h-8 min-w-0 rounded-lg px-1 text-xs"
                                    aria-label={
                                      'درصد ' + target.name + ' برای ' + row.id
                                    }
                                    inputMode="decimal"
                                    dir="ltr"
                                    value={percent}
                                    onChange={(e) =>
                                      setPercentDrafts((p) => ({
                                        ...p,
                                        [fieldKey]: normalizePercent(
                                          e.target.value,
                                        ),
                                      }))
                                    }
                                    aria-invalid={!validPercent(percent)}
                                  />
                                  <strong
                                    dir="ltr"
                                    className={targetStyles.price}
                                  >
                                    {net
                                      ? formatAmount(net) +
                                        ' ' +
                                        (legacy &&
                                        !current &&
                                        percentDrafts[fieldKey] === undefined
                                          ? legacy.currencyCode
                                          : row.base!.currencyCode)
                                      : 'درصد نامعتبر'}
                                  </strong>
                                  <div className={targetStyles.actions}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="min-h-8 px-2"
                                      aria-label={'ثبت درصد ' + target.name}
                                      onClick={() =>
                                        void saveCommission(
                                          row,
                                          target.id,
                                          false,
                                        )
                                      }
                                      disabled={
                                        !!saving || !validPercent(percent)
                                      }
                                      loading={saving === fieldKey}
                                    >
                                      ثبت
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="min-h-8 px-2"
                                      aria-label="کپی درصد برای این مقصد"
                                      title="برای تمام بلیت‌های قیمت‌دار همین شعبه، حتی خارج از فیلتر"
                                      onClick={() =>
                                        void saveCommission(
                                          row,
                                          target.id,
                                          true,
                                        )
                                      }
                                      disabled={
                                        !!saving || !validPercent(percent)
                                      }
                                    >
                                      <Copy className="size-3" />
                                      کپی
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="self-center text-xs text-muted-foreground">
                        پس از ثبت قیمت پایه، فیلد مقصدهای فروش باز می‌شود.
                      </p>
                    )}
                  </div>
                  <div className="mt-2 max-w-xl rounded-lg border border-sky-100 p-2">
                    <TierEditor
                      draft={draft}
                      capacity={
                        row.returning
                          ? Math.min(
                              row.offer.totalCapacity,
                              row.returning.totalCapacity,
                            )
                          : row.offer.totalCapacity
                      }
                      onSave={() => void saveBase(row)}
                      saving={!!saving || !currencies.length}
                      onChange={(next) => updateDraft(row, next)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
function FlightSummary({
  offer,
  direction,
}: {
  offer?: TicketOfferV1 | undefined;
  direction: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-sky-50/70 px-2 py-1.5 dark:bg-sky-950/25">
      <span className="text-sm font-bold text-primary">{direction}</span>
      {offer ? (
        <>
          <p className="break-words text-sm font-semibold">
            {offer.carrierName} · <bdi>{offer.serviceNumber}</bdi>
          </p>
          <p className="text-sm">
            <bdi>{faDay.format(new Date(offer.departureAt))}</bdi> ·{' '}
            <bdi>{faTime.format(new Date(offer.departureAt))}</bdi>
          </p>
          <p className="text-xs text-muted-foreground">
            ظرفیت: {offer.remainingCapacity.toLocaleString('fa-IR')}
          </p>
        </>
      ) : (
        <p className="text-sm">بلیط برگشت در دسترس نیست</p>
      )}
    </div>
  );
}
function CurrencySelect({
  value,
  values,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  value: string;
  values: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={compact ? 'h-8 min-w-0 rounded-lg px-2 text-xs' : undefined}
      >
        <SelectValue placeholder="ارز" />
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
