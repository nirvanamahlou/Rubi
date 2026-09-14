'use client';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Landmark,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  ReservationServicePurchaseV1,
  FinancePaymentMethodOptionV1,
  FinanceSettlementAccountV1,
  SupplierPurchaseGateV1,
  TravelDeliveryAuthorizationV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { formatSalesMoney } from '@/components/ui/money-input';
import { Badge, EmptyState } from '@/components/ui/surfaces';
import { financeInboxApi } from '../api/finance-inbox-api';
import { travelRequest } from '@/modules/reservations/components/travel-workflow-form';

type Row = {
  id: string;
  contractNumber: string;
  delivery: TravelDeliveryAuthorizationV1;
  supplierPurchases: SupplierPurchaseGateV1;
};
export function FinanceDeliveryPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<
    readonly FinanceSettlementAccountV1[]
  >([]);
  const [methods, setMethods] = useState<
    readonly FinancePaymentMethodOptionV1[]
  >([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [payment, setPayment] = useState<{
    row: Row;
    purchase: ReservationServicePurchaseV1;
  } | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [transferAt, setTransferAt] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    let live = true;
    void Promise.all([financeInboxApi.accounts(), financeInboxApi.methods()])
      .then(([accountRows, methodRows]) => {
        if (live) {
          setAccounts(accountRows);
          setMethods(methodRows);
        }
      })
      .catch(() => {
        if (live) setError('فهرست حساب‌ها و روش‌های پرداخت دریافت نشد.');
      });
    return () => {
      live = false;
    };
  }, []);
  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await travelRequest<{ data: Row[] }>(
        `reservations/requests/delivery-queue?contractNumber=${encodeURIComponent(search)}`,
      );
      setRows(response.data);
      setLoaded(true);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'دریافت نشد');
    } finally {
      setBusy(false);
    }
  }
  async function savePayment() {
    if (!payment || busy) return;
    if (!accountId || !paymentMethodId || !paidAmount || !transferAt) {
      setDecisionError('حساب، روش، مبلغ و تاریخ پرداخت الزامی است.');
      return;
    }
    setBusy(true);
    setDecisionError('');
    try {
      await travelRequest(
        `reservations/requests/${payment.row.id}/service-purchases/${payment.purchase.id}/payment`,
        {
          expectedVersion: payment.purchase.finance.version,
          status: 'PAID',
          accountId,
          paymentMethodId,
          paidAmount,
          exchangeRateToIrr: exchangeRate,
          transferAt,
          paymentReference: reference.trim() || null,
          reason,
        },
      );
      setNotice(
        `${payment.row.contractNumber} · پرداخت ${payment.purchase.serviceTitle} ثبت شد.`,
      );
      setPayment(null);
      setReason('');
      setAccountId('');
      setPaymentMethodId('');
      setPaidAmount('');
      setExchangeRate('');
      setTransferAt('');
      setReference('');
      await load();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'پرداخت ثبت نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function updateDelivery(row: Row) {
    if (busy) return;
    if (!reason.trim()) {
      setDecisionError('دلیل تأیید یا لغو تحویل مدارک را وارد کنید.');
      return;
    }
    setBusy(true);
    setDecisionError('');
    try {
      const { data } = await travelRequest<{
        data: TravelDeliveryAuthorizationV1;
      }>(`reservations/requests/${row.id}/delivery`, {
        expectedVersion: row.delivery.version,
        approved: !row.delivery.approved,
        reason: reason.trim(),
      });
      setRows((list) =>
        list.map((item) =>
          item.id === row.id ? { ...item, delivery: data } : item,
        ),
      );
      setSelected(null);
      setReason('');
      setNotice(
        `${row.contractNumber} · ${data.approved ? 'تحویل مدارک به فروش تأیید شد.' : 'مجوز تحویل مدارک لغو شد.'}`,
      );
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'ثبت نشد');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm"
      aria-labelledby="delivery-panel-title"
    >
      <header className="border-b border-border bg-gradient-to-l from-blue-50 via-surface to-cyan-50 p-5 dark:from-blue-950/40 dark:to-cyan-950/30 md:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary">
                کنترل مالی قرارداد
              </p>
              <h2 id="delivery-panel-title" className="mt-1 text-xl font-black">
                پرداخت خدمات و مجوز تحویل مدارک
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                ابتدا هزینه خدمات کارگزاران را ثبت کنید؛ بعد از تسویه همه خدمات،
                امکان صدور مجوز تحویل مدارک به فروش فعال می‌شود.
              </p>
            </div>
          </div>
          <ol
            className="grid min-w-fit grid-cols-2 gap-2 text-xs"
            aria-label="مراحل کنترل مالی قرارداد"
          >
            <li className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/80 px-3 py-2.5 dark:border-blue-900 dark:bg-background/50">
              <span className="grid size-7 place-items-center rounded-full bg-blue-600 font-black text-white">
                ۱
              </span>
              <span>
                <b className="block">تسویه خدمات</b>
                <span className="text-muted-foreground">پرداخت کارگزاران</span>
              </span>
            </li>
            <li className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white/80 px-3 py-2.5 dark:border-emerald-900 dark:bg-background/50">
              <span className="grid size-7 place-items-center rounded-full bg-emerald-600 font-black text-white">
                ۲
              </span>
              <span>
                <b className="block">تحویل مدارک</b>
                <span className="text-muted-foreground">
                  اعلام مجوز به فروش
                </span>
              </span>
            </li>
          </ol>
        </div>
      </header>

      <div className="space-y-5 p-4 md:p-6">
        <form
          className="grid gap-2 rounded-2xl border border-border bg-muted/25 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">
              شماره قرارداد
            </span>
            <div className="relative">
              <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pe-10"
                aria-label="شماره قرارداد"
                placeholder="مثلاً SC-2026-000008"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <Button className="self-end" loading={busy} type="submit">
            نمایش قراردادها
          </Button>
        </form>

        {notice && (
          <div
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            role="status"
          >
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {notice}
          </div>
        )}
        {loaded && !busy && !error && rows.length === 0 && (
          <EmptyState
            title="قراردادی پیدا نشد"
            description="شماره قرارداد را بررسی کنید یا برای نمایش صف کامل، کادر جست‌وجو را خالی بگذارید."
          />
        )}
        {error && (
          <div
            className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {rows.map((row) => (
          <article
            key={row.id}
            className="overflow-hidden rounded-3xl border border-border bg-background"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/35 px-4 py-3 md:px-5">
              <div>
                <p className="text-xs text-muted-foreground">شماره قرارداد</p>
                <strong className="mt-0.5 block text-base" dir="ltr">
                  {row.contractNumber}
                </strong>
              </div>
              <Badge
                className={
                  row.delivery.approved
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                    : row.supplierPurchases.complete
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                }
              >
                {row.delivery.approved
                  ? 'مجوز تحویل صادر شده'
                  : row.supplierPurchases.complete
                    ? 'آماده صدور مجوز'
                    : 'در انتظار تسویه خدمات'}
              </Badge>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-2 md:p-5">
              <section
                className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"
                aria-label="مرحله اول: تسویه خدمات کارگزاران"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
                      <WalletCards className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-black">
                        ۱. پرداخت خدمات به کارگزاران
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        وضعیت پرداخت هر خدمت این قرارداد
                      </p>
                    </div>
                  </div>
                  <Badge>
                    {row.supplierPurchases.purchases
                      .filter(({ finance }) => finance.status === 'PAID')
                      .length.toLocaleString('fa-IR')}{' '}
                    از{' '}
                    {row.supplierPurchases.purchases.length.toLocaleString(
                      'fa-IR',
                    )}{' '}
                    پرداخت
                  </Badge>
                </div>

                <div className="mt-4 space-y-2">
                  {row.supplierPurchases.purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="rounded-xl border border-border bg-surface p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <b className="block text-sm">
                            {purchase.serviceTitle}
                          </b>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            کارگزار: {purchase.supplierName}
                          </span>
                        </div>
                        <div className="text-end">
                          <b className="block text-sm" dir="ltr">
                            {formatSalesMoney(purchase.amount)}{' '}
                            {purchase.currencyCode}
                          </b>
                          <span
                            className={`mt-1 inline-block text-xs font-bold ${purchase.finance.status === 'PAID' ? 'text-emerald-700 dark:text-emerald-300' : purchase.finance.status === 'REJECTED' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'}`}
                          >
                            {purchase.finance.status === 'PAID'
                              ? 'پرداخت‌شده'
                              : purchase.finance.status === 'REJECTED'
                                ? 'برگشت‌خورده'
                                : 'در انتظار پرداخت'}
                          </span>
                        </div>
                      </div>
                      {purchase.finance.status !== 'PAID' && (
                        <Button
                          className="mt-3 w-full sm:w-auto"
                          size="sm"
                          onClick={() => {
                            setPayment({ row, purchase });
                            setAccountId(
                              accounts.find(
                                (account) =>
                                  account.currencyCode ===
                                  purchase.currencyCode,
                              )?.id ?? '',
                            );
                            setPaymentMethodId(methods[0]?.id ?? '');
                            setPaidAmount(purchase.finance.remainingAmount);
                            setExchangeRate(
                              purchase.currencyCode === 'IRR' ? '1' : '',
                            );
                            setTransferAt(new Date().toISOString());
                            setReason('');
                            setDecisionError('');
                          }}
                        >
                          ثبت پرداخت این خدمت
                        </Button>
                      )}
                    </div>
                  ))}
                  {!row.supplierPurchases.purchases.length && (
                    <p className="rounded-xl border border-dashed border-border bg-surface p-3 text-sm text-muted-foreground">
                      هنوز خرید خدمتی برای این قرارداد ثبت نشده است.
                    </p>
                  )}
                </div>

                {!!row.supplierPurchases.missingServiceTitles.length && (
                  <p className="mt-3 rounded-xl bg-destructive/5 p-3 text-xs leading-5 text-destructive">
                    <b>خرید ثبت‌نشده:</b>{' '}
                    {row.supplierPurchases.missingServiceTitles.join('، ')}
                  </p>
                )}
                {!!row.supplierPurchases.unpaidServiceTitles.length && (
                  <p className="mt-3 rounded-xl bg-amber-100/70 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <b>در انتظار پرداخت:</b>{' '}
                    {row.supplierPurchases.unpaidServiceTitles.join('، ')}
                  </p>
                )}
              </section>

              <section
                className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
                aria-label="مرحله دوم: مجوز تحویل مدارک"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                    <FileCheck2 className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-black">۲. مجوز تحویل مدارک به فروش</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      نتیجه این مرحله مستقیماً وضعیت دسترسی فروش را مشخص می‌کند.
                    </p>
                  </div>
                </div>

                <div className="my-5 flex flex-1 items-center">
                  {row.delivery.approved ? (
                    <div className="w-full rounded-2xl border border-emerald-300 bg-surface p-4 text-center">
                      <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                      <p className="mt-2 font-black text-emerald-800 dark:text-emerald-200">
                        فروش مجاز به تحویل مدارک است
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        برای بستن دسترسی، از دکمه لغو مجوز استفاده کنید.
                      </p>
                    </div>
                  ) : row.supplierPurchases.complete ? (
                    <div className="w-full rounded-2xl border border-blue-200 bg-surface p-4 text-center">
                      <Landmark className="mx-auto size-8 text-blue-600" />
                      <p className="mt-2 font-black">همه خدمات تسویه شده‌اند</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        قرارداد آماده بررسی و صدور مجوز تحویل است.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl border border-amber-200 bg-surface p-4 text-center">
                      <CircleAlert className="mx-auto size-8 text-amber-600" />
                      <p className="mt-2 font-black text-amber-800 dark:text-amber-200">
                        این مرحله هنوز فعال نیست
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        ابتدا خریدهای ثبت‌نشده را تکمیل و تمام خدمات را پرداخت
                        کنید.
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  variant={row.delivery.approved ? 'outline' : 'primary'}
                  disabled={
                    busy ||
                    (!row.delivery.approved && !row.supplierPurchases.complete)
                  }
                  onClick={() => {
                    setSelected(row);
                    setReason('');
                    setDecisionError('');
                  }}
                >
                  {row.delivery.approved
                    ? 'لغو مجوز تحویل مدارک'
                    : 'صدور مجوز تحویل مدارک'}
                </Button>
              </section>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={payment !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPayment(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>ثبت پرداخت کارگزار</DialogTitle>
          <DialogDescription>
            {payment?.purchase.serviceTitle} · {payment?.purchase.supplierName}{' '}
            · {payment && formatSalesMoney(payment.purchase.amount)}{' '}
            {payment?.purchase.currencyCode}
          </DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void savePayment();
            }}
          >
            <label className="grid gap-2">
              <span>حساب پرداخت‌کننده</span>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب حساب مبدأ" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(
                      (account) =>
                        account.currencyCode === payment?.purchase.currencyCode,
                    )
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.title} · {account.currencyCode}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <span>روش پرداخت</span>
              <Select
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="حواله، چک، نقد، پوز یا…" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <span>مبلغ این پرداخت</span>
              <Input
                required
                dir="ltr"
                inputMode="decimal"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
              />
              <small className="text-muted-foreground">
                مانده: {payment?.purchase.finance.remainingAmount}{' '}
                {payment?.purchase.currencyCode}
              </small>
            </label>
            {payment?.purchase.currencyCode !== 'IRR' ? (
              <label className="grid gap-2">
                <span>نرخ روز ارز به ریال</span>
                <Input
                  required
                  dir="ltr"
                  inputMode="decimal"
                  value={exchangeRate}
                  onChange={(event) => setExchangeRate(event.target.value)}
                />
              </label>
            ) : null}
            <label className="grid gap-2">
              <span>تاریخ و ساعت انتقال</span>
              <DatePicker
                includeTime
                value={transferAt}
                onChange={setTransferAt}
              />
            </label>
            <label className="grid gap-2">
              <span>شماره پیگیری (اختیاری)</span>
              <Input
                dir="ltr"
                value={reference}
                maxLength={160}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span>توضیح پرداخت (اختیاری)</span>
              <Input
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {decisionError && (
              <p role="alert" className="text-destructive">
                {decisionError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'در حال ثبت…' : 'ثبت پرداخت'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPayment(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {selected?.delivery.approved
              ? 'لغو مجوز تحویل مدارک'
              : 'تأیید تحویل مدارک'}
          </DialogTitle>
          <DialogDescription>
            قرارداد <b dir="ltr">{selected?.contractNumber}</b>
          </DialogDescription>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) void updateDelivery(selected);
            }}
          >
            <label className="grid gap-2">
              <span>دلیل تصمیم مالی (الزامی)</span>
              <Input
                value={reason}
                maxLength={500}
                required
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {decisionError && (
              <p role="alert" className="text-destructive">
                {decisionError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                ثبت تصمیم
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
