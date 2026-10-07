'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  WalletCards,
  Ticket,
  CheckCircle2,
} from 'lucide-react';
import type {
  FinanceTicketCostCommandV1,
  TicketPurchaseInboxItemV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { ticketPurchaseTotal } from '@/modules/finance/model/ticket-purchase-total';
import { FinanceInboxApiError } from '@/modules/finance/api/finance-inbox-api';
import { ticketPurchaseApi } from './api';
import { purchaseStages, purchaseSummary } from './model';
export function TicketPurchaseWorkspace() {
  const [items, setItems] = useState<TicketPurchaseInboxItemV1[]>([]),
    [canPrice, setCanPrice] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [search, setSearch] = useState(''),
    [stage, setStage] = useState('ALL');
  const [selected, setSelected] = useState<TicketPurchaseInboxItemV1 | null>(
      null,
    ),
    [seats, setSeats] = useState(''),
    [unit, setUnit] = useState(''),
    [currency, setCurrency] = useState('IRR'),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [priceError, setPriceError] = useState('');
  const frozen = useRef<FinanceTicketCostCommandV1 | null>(null);
  useEffect(() => {
    let live = true;
    ticketPurchaseApi
      .list()
      .then((result) => {
        if (live) {
          setItems(result.data);
          setCanPrice(result.meta.canPrice);
          setError('');
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(
            e instanceof Error ? e.message : 'دریافت کارتابل ناموفق بود.',
          );
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [revision]);
  const summary = useMemo(() => purchaseSummary(items), [items]);
  const visible = items.filter(
    (i) =>
      (stage === 'ALL' || i.stage === stage) &&
      [
        i.request.title,
        i.request.supplierDisplaySnapshot,
        i.request.serviceDate,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const total = ticketPurchaseTotal(seats, unit);
  function open(item: TicketPurchaseInboxItemV1) {
    frozen.current = null;
    setSelected(item);
    setSeats(String(item.cost?.seatCount ?? item.request.seatCount ?? ''));
    setUnit(item.cost?.unitCost ?? '');
    setCurrency(item.cost?.currencyCode ?? 'IRR');
    setPriceError('');
    setUncertain(false);
  }
  async function save() {
    if (!selected || busy || !total) return;
    setBusy(true);
    setPriceError('');
    frozen.current ??= {
      version: 1,
      operationId: crypto.randomUUID(),
      expectedCostVersion: selected.cost?.version ?? 0,
      seatCount: Number(seats),
      unitCost: unit,
      currencyCode: currency,
    };
    try {
      await ticketPurchaseApi.price(selected.request.id, frozen.current);
      frozen.current = null;
      setSelected(null);
      setUncertain(false);
      setLoading(true);
      setRevision((v) => v + 1);
    } catch (e) {
      const pending = e instanceof FinanceInboxApiError && e.status === 0;
      setUncertain(pending);
      if (!pending) frozen.current = null;
      setPriceError(e instanceof Error ? e.message : 'ثبت قیمت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-l from-blue-50 to-background p-6">
        <div>
          <h1 className="text-2xl font-bold">خرید و تأمین</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            کارتابل خرید پرواز · ثبت قیمت صندلی و پیگیری پرداخت به ایرلاین
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRevision((v) => v + 1);
          }}
        >
          <RefreshCw className="size-4" />
          به‌روزرسانی
        </Button>
      </header>
      <section
        aria-label="داشبورد خرید پرواز"
        className="grid gap-3 sm:grid-cols-3"
      >
        {[
          [Ticket, 'در انتظار قیمت خرید', summary.unpriced],
          [WalletCards, 'در انتظار تسویه مالی', summary.pending],
          [CheckCircle2, 'تسویه‌شده', summary.paid],
        ].map(([Icon, label, count]) => {
          const C = Icon as typeof Ticket;
          return (
            <div key={String(label)} className="rounded-2xl border bg-card p-5">
              <C className="mb-3 size-6 text-primary" />
              <p className="text-sm text-muted-foreground">{String(label)}</p>
              <strong className="text-3xl">
                {Number(count).toLocaleString('fa-IR')}
              </strong>
            </div>
          );
        })}
      </section>
      {summary.totals.length > 0 && (
        <section className="flex flex-wrap gap-4 rounded-2xl border p-4">
          {summary.totals.map((t) => (
            <div key={t.currencyCode} className="space-y-1">
              <strong>{t.currencyCode}</strong>
              <p>
                کل خرید: <bdi>{formatSalesMoney(t.invoice)}</bdi>
              </p>
              <p>
                پرداخت‌شده: <bdi>{formatSalesMoney(t.paid)}</bdi> · مانده:{' '}
                <bdi>{formatSalesMoney(t.remaining)}</bdi>
              </p>
            </div>
          ))}
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap gap-3 border-b p-4">
          <label className="flex flex-1 items-center gap-2">
            <Search className="size-4" />
            <Input
              aria-label="جست‌وجوی پرواز"
              placeholder="ایرلاین، شماره پرواز یا تاریخ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="وضعیت خرید"
            className="rounded-xl border bg-background px-3"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="ALL">همه وضعیت‌ها</option>
            {Object.entries(purchaseStages).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p role="alert" className="p-4 text-destructive">
            {error}
          </p>
        ) : loading ? (
          <p role="status" className="p-6">
            در حال دریافت کارتابل…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="bg-muted">
                <tr>
                  {[
                    'پرواز',
                    'تاریخ پرواز',
                    'تأمین‌کننده',
                    'صندلی خرید',
                    'قیمت هر صندلی',
                    'جمع خرید',
                    'مانده پرداخت',
                    'وضعیت',
                    'عملیات',
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.request.id}
                    className="border-t hover:bg-muted/30"
                  >
                    <td className="p-3 font-semibold">{item.request.title}</td>
                    <td className="p-3">
                      <bdi>{item.request.serviceDate ?? '—'}</bdi>
                    </td>
                    <td className="p-3">
                      {item.request.supplierDisplaySnapshot ?? '—'}
                    </td>
                    <td className="p-3">
                      {(
                        item.cost?.seatCount ?? item.request.seatCount
                      )?.toLocaleString('fa-IR') ?? '—'}
                    </td>
                    <td className="p-3">
                      <bdi>
                        {item.cost?.unitCost
                          ? formatSalesMoney(item.cost.unitCost)
                          : '—'}{' '}
                        {item.cost?.currencyCode}
                      </bdi>
                    </td>
                    <td className="p-3">
                      <bdi>
                        {item.cost
                          ? formatSalesMoney(item.cost.invoiceAmount)
                          : '—'}{' '}
                        {item.cost?.currencyCode}
                      </bdi>
                    </td>
                    <td className="p-3">
                      <bdi>
                        {item.cost
                          ? formatSalesMoney(item.cost.remainingAmount)
                          : '—'}{' '}
                        {item.cost?.currencyCode}
                      </bdi>
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                        {purchaseStages[item.stage]}
                      </span>
                    </td>
                    <td className="p-3">
                      {canPrice &&
                      item.request.status === 'PENDING' &&
                      !item.cost?.paymentCount ? (
                        <Button size="sm" onClick={() => open(item)}>
                          {item.cost ? 'ویرایش قیمت خرید' : 'ثبت قیمت خرید'}
                        </Button>
                      ) : (
                        <span>
                          {item.stage === 'PAID'
                            ? 'تسویه کامل'
                            : 'قیمت خرید قفل شده'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <p className="p-6 text-center text-muted-foreground">
                پروازی با این فیلتر در کارتابل وجود ندارد.
              </p>
            )}
          </div>
        )}
      </section>
      <p className="text-sm text-muted-foreground">
        پس از ثبت قیمت، درخواست به مالی ارسال می‌شود. پرداخت‌های جزئی و مانده در
        همین جدول قابل پیگیری‌اند. سود قرارداد از قیمت خرید صندلی‌های مسافران
        همان قرارداد محاسبه می‌شود.
      </p>
      <Link
        className="inline-flex items-center gap-2 text-sm text-primary"
        href="/finance/requests"
      >
        کارتابل مالی <ArrowLeft className="size-4" />
      </Link>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy && !uncertain) setSelected(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>ثبت قیمت خرید پرواز</DialogTitle>
          <DialogDescription>
            {selected?.request.title} · تأمین‌کننده:{' '}
            {selected?.request.supplierDisplaySnapshot ?? '—'}
          </DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset
              disabled={busy || uncertain}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label className="space-y-2">
                <span>تعداد صندلی خریداری‌شده</span>
                <Input
                  type="number"
                  min={1}
                  max={selected?.request.seatCount ?? 100000}
                  required
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                />
              </label>
              <label className="space-y-2">
                <span>قیمت خرید هر صندلی</span>
                <MoneyInput required value={unit} onValueChange={setUnit} />
              </label>
              <label className="space-y-2">
                <span>کد ارز خرید</span>
                <Input
                  required
                  maxLength={3}
                  pattern="[A-Z]{3}"
                  dir="ltr"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </label>
              <div className="rounded-xl bg-muted p-3">
                <span>جمع خرید</span>
                <strong className="mt-2 block" dir="ltr">
                  {total ? formatSalesMoney(total) : '—'} {currency}
                </strong>
              </div>
            </fieldset>
            {priceError && (
              <p role="alert" className="text-sm text-destructive">
                {priceError}
              </p>
            )}
            {uncertain && (
              <p className="text-sm">
                نتیجه ثبت مشخص نیست؛ برای دریافت نتیجه، همین عملیات را دوباره
                ارسال کنید.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  busy || !total || !selected?.request.supplierDisplaySnapshot
                }
              >
                {busy
                  ? 'در حال ثبت…'
                  : uncertain
                    ? 'تلاش مجدد همان ثبت'
                    : 'ثبت و ارسال به مالی'}
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={busy || uncertain}
                onClick={() => setSelected(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
