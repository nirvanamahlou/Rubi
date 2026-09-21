'use client';

import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Landmark,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  FinanceCustomerDocumentDeliveryBasisV1,
  FinanceCustomerDocumentDeliveryCandidateV1,
} from '@nora/contracts';
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
import { Badge, EmptyState } from '@/components/ui/surfaces';
import { financeInboxApi } from '../api/finance-inbox-api';

const basisLabels: Record<FinanceCustomerDocumentDeliveryBasisV1, string> = {
  AFTER_RECEIPT: 'پس از تأیید این دریافت مشتری',
  FULL_SETTLEMENT: 'فقط پس از تسویه کامل قرارداد',
  MANAGER_EXCEPTION: 'استثنای مدیر',
};

const settlementLabels: Record<
  FinanceCustomerDocumentDeliveryCandidateV1['settlementStatus'],
  string
> = {
  UNPAID: 'تسویه‌نشده',
  PARTIALLY_SETTLED: 'بخشی تسویه شده',
  SETTLED: 'تسویه کامل',
  OVERPAID: 'بیش‌پرداخت',
};

export function FinanceDeliveryPanel() {
  const [rows, setRows] = useState<
    readonly FinanceCustomerDocumentDeliveryCandidateV1[]
  >([]);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] =
    useState<FinanceCustomerDocumentDeliveryCandidateV1 | null>(null);
  const [basis, setBasis] =
    useState<FinanceCustomerDocumentDeliveryBasisV1>('AFTER_RECEIPT');
  const [reason, setReason] = useState('');
  const [secondApproverReference, setSecondApproverReference] = useState('');
  const [exceptionExpiresAt, setExceptionExpiresAt] = useState('');

  async function load(contractNumber = search) {
    setBusy(true);
    setError('');
    try {
      setRows(await financeInboxApi.customerDocumentDeliveries(contractNumber));
      setLoaded(true);
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error ? cause.message : 'فهرست قراردادها دریافت نشد.',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load('');
    }, 0);
    return () => window.clearTimeout(timer);
    // Initial queue is deliberately independent of the text filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDecision(row: FinanceCustomerDocumentDeliveryCandidateV1) {
    setSelected(row);
    setBasis(
      row.delivery.basis ??
        (row.settlementStatus === 'SETTLED' ||
        row.settlementStatus === 'OVERPAID'
          ? 'FULL_SETTLEMENT'
          : 'AFTER_RECEIPT'),
    );
    setReason(
      row.delivery.approved ? 'لغو مجوز تحویل مدارک مشتری' : 'درخواست پشتیبانی',
    );
    setSecondApproverReference('');
    setExceptionExpiresAt('');
    setError('');
  }

  async function submitDecision() {
    if (!selected || busy) return;
    if (!reason.trim()) {
      setError('دلیل عملیات برای ثبت در Audit الزامی است.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await financeInboxApi.decideCustomerDocumentDelivery(
        selected.contractId,
        {
          expectedVersion: selected.delivery.version,
          approved: !selected.delivery.approved,
          basis,
          reason: reason.trim(),
          secondApproverReference:
            basis === 'MANAGER_EXCEPTION'
              ? secondApproverReference.trim() || null
              : null,
          exceptionExpiresAt:
            basis === 'MANAGER_EXCEPTION'
              ? exceptionExpiresAt
                ? new Date(exceptionExpiresAt).toISOString()
                : null
              : null,
        },
      );
      setRows((current) =>
        current.map((row) =>
          row.contractId === selected.contractId
            ? { ...row, delivery: result.data }
            : row,
        ),
      );
      setNotice(
        `${selected.contractNumber} · ${result.data.approved ? 'مجوز تحویل مدارک مشتری صادر شد.' : 'مجوز تحویل مدارک مشتری لغو شد.'}`,
      );
      setSelected(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'ثبت مجوز تحویل مدارک ناموفق بود.',
      );
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
                مجوز تحویل مدارک به مشتری
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                این مجوز فقط رابطهٔ شرکت و مشتری را کنترل می‌کند. پرداخت خریدهای
                کارگزار و وضعیت رزرواسیون، شرط تحویل مدارک نیستند.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white/80 px-4 py-3 text-xs leading-5 text-muted-foreground dark:border-blue-900 dark:bg-background/50">
            مسیرهای مجاز: تأیید دریافت مشتری، تسویه کامل قرارداد، یا استثنای
            مدیر با دلیل، تأییدکنندهٔ دوم و تاریخ انقضا.
          </div>
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
                placeholder="بخشی یا همهٔ شماره؛ مثلاً SC-2026"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>
          <Button className="self-end" loading={busy} type="submit">
            نمایش قراردادها
          </Button>
        </form>

        {notice ? (
          <div
            className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
            role="status"
          >
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}
        {loaded && !busy && !error && !rows.length ? (
          <EmptyState
            title="قراردادی پیدا نشد"
            description="شماره قرارداد را کامل یا بخشی از آن وارد کنید؛ برای نمایش همه، کادر را خالی بگذارید."
          />
        ) : null}

        <div className="grid gap-3">
          {rows.map((row) => (
            <article
              key={row.contractId}
              className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-4 md:flex-row md:items-center md:justify-between md:p-5"
            >
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">قرارداد / مشتری</p>
                <h3 className="mt-1 font-black" dir="ltr">
                  {row.contractNumber}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.customerNameSnapshot}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={
                    row.delivery.approved
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                  }
                >
                  {row.delivery.approved
                    ? 'تحویل مدارک مجاز'
                    : 'تحویل مدارک مسدود'}
                </Badge>
                <Badge className="border border-border bg-surface text-foreground">
                  {settlementLabels[row.settlementStatus]}
                </Badge>
                {row.hasConfirmedPayment ? (
                  <Badge className="border border-border bg-surface text-foreground">
                    دریافت تأییدشده دارد
                  </Badge>
                ) : null}
              </div>
              <Button
                className="shrink-0"
                variant={row.delivery.approved ? 'outline' : 'primary'}
                onClick={() => openDecision(row)}
              >
                <FileCheck2 className="size-4" />
                {row.delivery.approved ? 'لغو مجوز' : 'صدور مجوز'}
              </Button>
            </article>
          ))}
        </div>
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {selected?.delivery.approved
              ? 'لغو مجوز تحویل مدارک مشتری'
              : 'صدور مجوز تحویل مدارک مشتری'}
          </DialogTitle>
          <DialogDescription>
            {selected?.contractNumber} · {selected?.customerNameSnapshot}
          </DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitDecision();
            }}
          >
            {!selected?.delivery.approved ? (
              <label className="grid gap-2">
                <span>مبنای صدور مجوز</span>
                <Select
                  value={basis}
                  onValueChange={(value) =>
                    setBasis(value as FinanceCustomerDocumentDeliveryBasisV1)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(basisLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            {basis === 'MANAGER_EXCEPTION' && !selected?.delivery.approved ? (
              <>
                <label className="grid gap-2">
                  <span>شناسهٔ تأییدکنندهٔ دوم</span>
                  <Input
                    required
                    dir="ltr"
                    placeholder="UUID کاربر دوم"
                    value={secondApproverReference}
                    onChange={(event) =>
                      setSecondApproverReference(event.target.value)
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span>انقضای استثنا (UTC)</span>
                  <DatePicker
                    required
                    withinDialog
                    includeTime
                    defaultCalendarSystem="gregorian"
                    gregorianEnglish
                    value={exceptionExpiresAt}
                    onChange={setExceptionExpiresAt}
                    aria-label="تاریخ و ساعت انقضای استثنا"
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-2">
              <span>دلیل ثبت‌شونده در Audit</span>
              <Input
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
              <Landmark className="ms-1 inline size-4" />
              این عملیات به پرداخت خرید، کارگزار یا تأیید رزرواسیون وابسته نیست.
            </p>
            <Button loading={busy} type="submit">
              {selected?.delivery.approved ? 'ثبت لغو مجوز' : 'ثبت مجوز تحویل'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
