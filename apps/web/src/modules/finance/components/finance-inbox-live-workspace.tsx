'use client';

import {
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Inbox,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  FinanceInboxItemV1,
  FinanceInboxSource,
  FinanceInboxV1,
  FinanceBankOptionV1,
  FinancePaymentMethodOptionV1,
  FinanceRequestStatus,
  FinanceSettlementAccountKind,
  FinanceSettlementAccountV1,
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
  Textarea,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surfaces';
import {
  FinanceInboxApiError,
  financeInboxApi,
} from '../api/finance-inbox-api';

const sourceLabels: Record<FinanceInboxSource, string> = {
  SALES: 'فروش',
  HR: 'منابع انسانی',
  RESERVATIONS: 'رزرواسیون',
  PURCHASES: 'خرید و تأمین',
};
const statusLabels: Partial<Record<FinanceRequestStatus, string>> = {
  NEW: 'جدید',
  UNDER_REVIEW: 'در حال بررسی',
  APPROVED: 'پاسخ داده‌شده',
  READY_FOR_PAYMENT: 'آماده پرداخت',
  PAYING: 'در حال پرداخت',
  PAID: 'پرداخت‌شده',
  RECEIPT_CONFIRMED: 'دریافت تأییدشده',
  CORRECTION_REQUIRED: 'نیازمند اصلاح',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
};
const closed = new Set<FinanceRequestStatus>([
  'APPROVED',
  'PAID',
  'RECEIPT_CONFIRMED',
  'REJECTED',
  'CANCELLED',
]);

function faDate(value: string | null) {
  if (!value) return 'بدون سررسید';
  return new Date(value).toLocaleString('fa-IR', {
    timeZone: 'Asia/Tehran',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function money(item: FinanceInboxItemV1) {
  if (!item.amount) return 'بدون مبلغ مالی';
  return `${item.amount.amount.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} ${item.amount.currencyCode}`;
}

function sourceTone(source: FinanceInboxSource) {
  return {
    SALES:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    HR: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200',
    RESERVATIONS:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200',
    PURCHASES:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
  }[source];
}

export function FinanceInboxLiveWorkspace() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    revision: number;
    data: FinanceInboxV1 | null;
    error: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<FinanceInboxSource | 'ALL'>('ALL');
  const [status, setStatus] = useState<'ALL' | 'OPEN' | 'CLOSED'>('OPEN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [accounts, setAccounts] = useState<
    readonly FinanceSettlementAccountV1[]
  >([]);
  const [methods, setMethods] = useState<
    readonly FinancePaymentMethodOptionV1[]
  >([]);
  const [banks, setBanks] = useState<readonly FinanceBankOptionV1[]>([]);
  const [actionItem, setActionItem] = useState<FinanceInboxItemV1 | null>(null);
  const [actionKind, setActionKind] = useState<
    'APPROVE' | 'CORRECTION_REQUIRED' | 'PAYMENT' | 'TICKET_COST' | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reason, setReason] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString());
  const [paymentReference, setPaymentReference] = useState('');
  const [ticketAdultCost, setTicketAdultCost] = useState('');
  const [ticketChildCost, setTicketChildCost] = useState('');
  const [ticketInvoice, setTicketInvoice] = useState('');
  const [ticketCurrency, setTicketCurrency] = useState('IRR');
  const [accountDialog, setAccountDialog] = useState(false);
  const [accountTitle, setAccountTitle] = useState('');
  const [accountKind, setAccountKind] =
    useState<FinanceSettlementAccountKind>('BANK');
  const [accountBankId, setAccountBankId] = useState('');
  const [accountMaskedId, setAccountMaskedId] = useState('');
  const loading = state?.revision !== revision;
  const data = loading ? null : state.data;
  const error = loading ? '' : state.error;

  useEffect(() => {
    let active = true;
    void financeInboxApi
      .list()
      .then((value) => {
        if (active) setState({ revision, data: value, error: '' });
      })
      .catch((reason: unknown) => {
        if (active)
          setState({
            revision,
            data: null,
            error:
              reason instanceof FinanceInboxApiError
                ? reason.message
                : 'دریافت کارتابل مالی ناموفق بود.',
          });
      });
    void Promise.allSettled([
      financeInboxApi.accounts(),
      financeInboxApi.methods(),
      financeInboxApi.banks(),
    ]).then(([accountResult, methodResult, bankResult]) => {
      if (!active) return;
      if (accountResult.status === 'fulfilled')
        setAccounts(accountResult.value);
      if (methodResult.status === 'fulfilled') setMethods(methodResult.value);
      if (bankResult.status === 'fulfilled') setBanks(bankResult.value);
    });
    return () => {
      active = false;
    };
  }, [revision]);

  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa');
    return (data?.items ?? []).filter((item) => {
      const matchesSource = source === 'ALL' || item.source === source;
      const matchesStatus =
        status === 'ALL' ||
        (status === 'OPEN'
          ? !closed.has(item.status)
          : closed.has(item.status));
      const createdAt = new Date(item.createdAt).getTime();
      const matchesFrom =
        !fromDate || createdAt >= new Date(fromDate).getTime();
      const matchesTo = !toDate || createdAt <= new Date(toDate).getTime();
      const haystack = [
        item.title,
        item.sourceReference,
        item.contractReference,
        item.partyDisplaySnapshot,
        item.description,
        item.requesterDisplaySnapshot,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fa');
      return (
        matchesSource &&
        matchesStatus &&
        matchesFrom &&
        matchesTo &&
        (!query || haystack.includes(query))
      );
    });
  }, [data, fromDate, search, source, status, toDate]);
  const selected =
    items.find(({ id }) => id === selectedId) ?? items[0] ?? null;
  const openCount =
    data?.items.filter((item) => !closed.has(item.status)).length ?? 0;
  const overdueCount =
    data?.items.filter(
      (item) =>
        !closed.has(item.status) &&
        item.dueAt !== null &&
        data.generatedAt > item.dueAt,
    ).length ?? 0;
  const availableSources = (data?.sources ?? []).filter(
    ({ connection }) => connection !== 'NOT_CONNECTED',
  );
  const kpis = [
    {
      label: 'کل درخواست‌های واقعی',
      value: items.length,
      icon: Inbox,
      tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
    },
    {
      label: 'درخواست‌های باز',
      value: openCount,
      icon: CircleDollarSign,
      tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      label: 'گذشته از سررسید',
      value: overdueCount,
      icon: Clock3,
      tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
    },
  ];

  function openReceiptAction(
    item: FinanceInboxItemV1,
    kind: 'APPROVE' | 'CORRECTION_REQUIRED',
  ) {
    setActionItem(item);
    setActionKind(kind);
    setReason('');
    setActionError('');
  }

  function openSupplierPayment(item: FinanceInboxItemV1) {
    const eligibleAccounts = accounts.filter(
      (account) =>
        account.branchId === item.branchReference &&
        account.currencyCode === item.amount?.currencyCode,
    );
    setActionItem(item);
    setActionKind('PAYMENT');
    setAccountId(eligibleAccounts[0]?.id ?? '');
    setPaymentMethodId(methods[0]?.id ?? '');
    setPaidAmount(
      item.settlement?.remainingAmount ?? item.amount?.amount ?? '',
    );
    setExchangeRate(item.amount?.currencyCode === 'IRR' ? '1' : '');
    setPaidAt(new Date().toISOString());
    setPaymentReference('');
    setReason('');
    setActionError('');
  }

  function openTicketCost(item: FinanceInboxItemV1) {
    setActionItem(item);
    setActionKind('TICKET_COST');
    setTicketAdultCost('');
    setTicketChildCost('');
    setTicketInvoice('');
    setTicketCurrency('IRR');
    setReason('');
    setActionError('');
  }

  async function submitAction() {
    if (!actionItem || !actionKind) return;
    setActionBusy(true);
    setActionError('');
    try {
      if (actionKind === 'TICKET_COST') {
        await financeInboxApi.recordTicketCost(actionItem.sourceReference, {
          version: 1,
          adultUnitCost: ticketAdultCost,
          childUnitCost: ticketChildCost,
          invoiceAmount: ticketInvoice,
          currencyCode: ticketCurrency.toUpperCase().trim(),
          reason: reason.trim(),
        });
      } else if (
        actionKind === 'PAYMENT' &&
        actionItem.source === 'PURCHASES'
      ) {
        await financeInboxApi.payTicket(actionItem.sourceReference, {
          version: 1,
          costRevisionId: actionItem.sourceContextReference,
          accountId,
          paymentMethodId,
          paidAmount,
          exchangeRateToIrr: exchangeRate,
          transferAt: paidAt,
          paymentReference: paymentReference.trim() || null,
          reason: reason.trim(),
        });
      } else if (actionKind === 'PAYMENT') {
        await financeInboxApi.paySupplier(
          actionItem.sourceContextReference,
          actionItem.sourceReference,
          {
            expectedVersion: actionItem.sourceVersion,
            status: 'PAID',
            accountId,
            paymentMethodId,
            paidAmount,
            exchangeRateToIrr: exchangeRate,
            transferAt: paidAt,
            paymentReference: paymentReference.trim() || null,
            reason,
          },
        );
      } else {
        await financeInboxApi.decideReceipt(actionItem.sourceReference, {
          version: 1,
          contractId: actionItem.sourceContextReference,
          action: actionKind,
          reason: reason.trim() || null,
        });
      }
      setActionItem(null);
      setActionKind(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof FinanceInboxApiError
          ? cause.message
          : 'ثبت عملیات مالی ناموفق بود.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function createAccount() {
    if (!actionItem) return;
    setActionBusy(true);
    setActionError('');
    try {
      const created = await financeInboxApi.createAccount({
        version: 1,
        branchId: actionItem.branchReference,
        title: accountTitle,
        kind: accountKind,
        currencyCode: actionItem.amount?.currencyCode ?? 'IRR',
        bankId: accountKind === 'BANK' ? accountBankId : null,
        maskedIdentifier: accountMaskedId.trim() || null,
      });
      setAccounts((current) => [...current, created]);
      setAccountId(created.id);
      setAccountDialog(false);
      setAccountTitle('');
      setAccountBankId('');
      setAccountMaskedId('');
    } catch (cause) {
      setActionError(
        cause instanceof FinanceInboxApiError
          ? cause.message
          : 'تعریف حساب مالی ناموفق بود.',
      );
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <section className="space-y-5" aria-label="کارتابل یکپارچه مالی">
      <Card className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-black">صف درخواست‌های مالی</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            آخرین به‌روزرسانی: {data ? faDate(data.generatedAt) : '—'}
          </p>
        </div>
        <Button
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          به‌روزرسانی
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <Card className="flex items-center gap-4 p-4" key={label}>
            <span className={`rounded-2xl p-3 ${tone}`}>
              <Icon className="size-6" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-black">{String(value)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_12rem_12rem_11rem_11rem_auto]">
          <div className="relative">
            <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجوی قرارداد، طرف‌حساب، شرح یا شماره درخواست"
              value={search}
            />
          </div>
          <Select
            onValueChange={(value) => setSource(value as typeof source)}
            value={source}
          >
            <SelectTrigger aria-label="فیلتر واحد ارسال‌کننده">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه واحدها</SelectItem>
              {availableSources.map(({ source: value }) => (
                <SelectItem key={value} value={value}>
                  {sourceLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={(value) => setStatus(value as typeof status)}
            value={status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت درخواست">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">درخواست‌های باز</SelectItem>
              <SelectItem value="CLOSED">درخواست‌های بسته</SelectItem>
              <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            </SelectContent>
          </Select>
          <label className="grid gap-1 text-xs text-muted-foreground">
            از تاریخ ثبت درخواست
            <DatePicker onChange={setFromDate} value={fromDate} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            تا تاریخ ثبت درخواست
            <DatePicker onChange={setToDate} value={toDate} />
          </label>
          <Button
            onClick={() => {
              setSearch('');
              setSource('ALL');
              setStatus('OPEN');
              setFromDate('');
              setToDate('');
            }}
            variant="outline"
          >
            پاک‌کردن فیلترها
          </Button>
        </div>
      </Card>

      {error ? (
        <Alert tone="warning" title="کارتابل دریافت نشد" description={error} />
      ) : null}
      {loading ? (
        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Card className="h-36 animate-pulse bg-muted/60" key={index} />
            ))}
          </div>
          <Card className="h-96 animate-pulse bg-muted/60" />
        </div>
      ) : null}
      {!loading && !error && !items.length ? (
        <EmptyState
          title="درخواستی با این فیلتر پیدا نشد"
          description="فیلترها را تغییر دهید یا کارتابل را به‌روزرسانی کنید."
        />
      ) : null}
      {!loading && !error && items.length ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
          <div className="space-y-3">
            {items.map((item) => {
              const active = selected?.id === item.id;
              const overdue = Boolean(
                data &&
                item.dueAt &&
                !closed.has(item.status) &&
                data.generatedAt > item.dueAt,
              );
              return (
                <button
                  aria-pressed={active}
                  className={`w-full rounded-3xl border bg-surface p-4 text-start transition ${active ? 'border-primary shadow-md shadow-primary/10 ring-2 ring-primary/10' : 'border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm'}`}
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={sourceTone(item.source)}>
                          {sourceLabels[item.source]}
                        </Badge>
                        <Badge>
                          {statusLabels[item.status] ?? item.status}
                        </Badge>
                        {overdue ? (
                          <Badge className="bg-rose-100 text-rose-700">
                            سررسید گذشته
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 truncate font-black">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <p className="text-lg font-black text-primary" dir="ltr">
                      {money(item)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                    <span>
                      {item.contractReference ?? item.sourceReference}
                    </span>
                    <span>
                      {item.partyDisplaySnapshot ?? 'طرف‌حساب درج نشده'}
                    </span>
                    <span>سررسید: {faDate(item.dueAt)}</span>
                    <ChevronLeft className="ms-auto size-4 text-primary" />
                  </div>
                </button>
              );
            })}
          </div>
          {selected ? (
            <Card className="sticky top-4 overflow-hidden p-0">
              <div className="bg-gradient-to-l from-primary/15 to-cyan-500/10 p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge className={sourceTone(selected.source)}>
                    {sourceLabels[selected.source]}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-4" />
                    {selected.origin === 'PERSISTED_SOURCE'
                      ? 'منبع ثبت‌شده'
                      : 'منبع نامشخص'}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black">{selected.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {selected.description}
                </p>
              </div>
              <div className="space-y-4 p-5">
                {[
                  ['شماره منبع', selected.sourceReference],
                  ['قرارداد', selected.contractReference ?? '—'],
                  ['طرف‌حساب / کارمند', selected.partyDisplaySnapshot ?? '—'],
                  ['مبلغ', money(selected)],
                  ...(selected.settlement
                    ? [
                        [
                          'پرداخت‌شده',
                          `${selected.settlement.paidAmount} ${selected.amount?.currencyCode ?? ''}`,
                        ],
                        [
                          'مانده',
                          `${selected.settlement.remainingAmount} ${selected.amount?.currencyCode ?? ''}`,
                        ],
                      ]
                    : []),
                  ['درخواست‌کننده', selected.requesterDisplaySnapshot ?? '—'],
                  ['تاریخ ایجاد', faDate(selected.createdAt)],
                  ['تاریخ سررسید', faDate(selected.dueAt)],
                  ['نسخه منبع', selected.sourceVersion.toLocaleString('fa-IR')],
                ].map(([label, value]) => (
                  <div
                    className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-0"
                    key={label}
                  >
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <strong className="max-w-[65%] text-end text-sm">
                      {value}
                    </strong>
                  </div>
                ))}
                {selected.kind === 'RECEIPT_VERIFICATION' ? (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button
                      onClick={() => openReceiptAction(selected, 'APPROVE')}
                    >
                      <CheckCircle2 className="size-4" />
                      تأیید دریافت
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        openReceiptAction(selected, 'CORRECTION_REQUIRED')
                      }
                    >
                      <RotateCcw className="size-4" />
                      درخواست اصلاح
                    </Button>
                  </div>
                ) : null}
                {selected.kind === 'PAYMENT_REQUEST' &&
                selected.source === 'RESERVATIONS' ? (
                  <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <p className="text-xs leading-5 text-muted-foreground">
                      پرداخت به کارگزار با انتخاب حساب مبدأ و روش پرداخت ثبت
                      می‌شود. پرداخت جزئی نیز مجاز است.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => openSupplierPayment(selected)}
                    >
                      <WalletCards className="size-4" />
                      ثبت پرداخت کارگزار
                    </Button>
                  </div>
                ) : null}
                {selected.kind === 'PAYMENT_REQUEST' &&
                selected.source === 'PURCHASES' ? (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <p className="text-xs leading-5 text-muted-foreground">
                      مالی قیمت خرید بزرگسال و کودک و مبلغ فاکتور را ثبت می‌کند؛
                      پس از پرداخت کامل، این نرخ برای قیمت‌گذاری پکیج آزاد
                      می‌شود.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() =>
                        selected.amount
                          ? openSupplierPayment(selected)
                          : openTicketCost(selected)
                      }
                    >
                      <WalletCards className="size-4" />
                      {selected.amount
                        ? 'ثبت پرداخت خرید بلیت'
                        : 'ثبت قیمت خرید بلیت'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={actionItem !== null && actionKind !== null}
        onOpenChange={(open) => {
          if (!open && !actionBusy) {
            setActionItem(null);
            setActionKind(null);
          }
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {actionKind === 'APPROVE'
              ? 'تأیید دریافت مسافر'
              : actionKind === 'CORRECTION_REQUIRED'
                ? 'ارسال برای اصلاح'
                : actionKind === 'TICKET_COST'
                  ? 'ثبت قیمت خرید بلیت توسط مالی'
                  : actionItem?.source === 'PURCHASES'
                    ? 'ثبت پرداخت خرید بلیت'
                    : 'ثبت پرداخت کارگزار'}
          </DialogTitle>
          <DialogDescription>
            {actionItem?.title} · {actionItem && money(actionItem)}
          </DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAction();
            }}
          >
            {actionKind === 'TICKET_COST' ? (
              <>
                {(
                  [
                    ['نرخ خرید بزرگسال', ticketAdultCost, setTicketAdultCost],
                    ['نرخ خرید کودک', ticketChildCost, setTicketChildCost],
                    ['مبلغ کل فاکتور', ticketInvoice, setTicketInvoice],
                  ] as const
                ).map(([label, value, change]) => (
                  <label key={label} className="grid gap-2">
                    <span>{label}</span>
                    <Input
                      required
                      dir="ltr"
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => change(event.target.value)}
                    />
                  </label>
                ))}
                <label className="grid gap-2">
                  <span>کد ارز خرید</span>
                  <Input
                    required
                    dir="ltr"
                    maxLength={3}
                    value={ticketCurrency}
                    onChange={(event) =>
                      setTicketCurrency(event.target.value.toUpperCase())
                    }
                  />
                </label>
              </>
            ) : null}
            {actionKind === 'PAYMENT' ? (
              <>
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
                            account.branchId === actionItem?.branchReference &&
                            account.currencyCode ===
                              actionItem?.amount?.currencyCode,
                        )
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.title} · {account.currencyCode}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAccountDialog(true);
                      setActionError('');
                    }}
                  >
                    <PlusCircle className="size-4" />
                    تعریف حساب جدید
                  </Button>
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
                    مانده فعلی: {actionItem?.settlement?.remainingAmount ?? '—'}{' '}
                    {actionItem?.amount?.currencyCode}
                  </small>
                </label>
                {actionItem?.amount?.currencyCode !== 'IRR' ? (
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
                  <span>تاریخ و ساعت پرداخت</span>
                  <DatePicker includeTime value={paidAt} onChange={setPaidAt} />
                </label>
                <label className="grid gap-2">
                  <span>شماره پیگیری (اختیاری)</span>
                  <Input
                    dir="ltr"
                    maxLength={160}
                    value={paymentReference}
                    onChange={(event) =>
                      setPaymentReference(event.target.value)
                    }
                  />
                </label>
              </>
            ) : null}
            <label className="grid gap-2">
              <span>
                {actionKind === 'CORRECTION_REQUIRED'
                  ? 'دلیل اصلاح (الزامی)'
                  : actionKind === 'TICKET_COST' ||
                      actionItem?.source === 'PURCHASES'
                    ? 'توضیح ثبت مالی (الزامی)'
                    : 'توضیح مالی (اختیاری)'}
              </span>
              <Textarea
                required={
                  actionKind === 'CORRECTION_REQUIRED' ||
                  actionKind === 'TICKET_COST' ||
                  actionItem?.source === 'PURCHASES'
                }
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {actionError ? (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  actionBusy ||
                  (actionKind === 'PAYMENT' &&
                    (!accountId || !paymentMethodId || !paidAmount)) ||
                  (actionKind === 'TICKET_COST' &&
                    (!ticketAdultCost ||
                      !ticketChildCost ||
                      !ticketInvoice ||
                      !ticketCurrency ||
                      !reason.trim()))
                }
              >
                {actionBusy ? 'در حال ثبت…' : 'ثبت عملیات'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={actionBusy}
                onClick={() => {
                  setActionItem(null);
                  setActionKind(null);
                }}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent dir="rtl">
          <DialogTitle>تعریف حساب پرداخت</DialogTitle>
          <DialogDescription>
            این حساب فقط برای شعبه و ارز همین درخواست قابل انتخاب است.
          </DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <label className="grid gap-2">
              <span>عنوان حساب</span>
              <Input
                required
                maxLength={160}
                placeholder="مثلاً حساب جاری شرکت"
                value={accountTitle}
                onChange={(event) => setAccountTitle(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span>نوع حساب</span>
              <Select
                value={accountKind}
                onValueChange={(value) =>
                  setAccountKind(value as FinanceSettlementAccountKind)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">حساب بانکی</SelectItem>
                  <SelectItem value="CASH">صندوق نقدی</SelectItem>
                  <SelectItem value="POS">دستگاه پوز</SelectItem>
                  <SelectItem value="GATEWAY">درگاه پرداخت</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {accountKind === 'BANK' ? (
              <label className="grid gap-2">
                <span>بانک</span>
                <Select value={accountBankId} onValueChange={setAccountBankId}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب بانک" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="grid gap-2">
              <span>شناسه پوشیده حساب (اختیاری)</span>
              <Input
                dir="ltr"
                maxLength={80}
                placeholder="IR••••1234"
                value={accountMaskedId}
                onChange={(event) => setAccountMaskedId(event.target.value)}
              />
            </label>
            {actionError ? (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={
                  actionBusy ||
                  !accountTitle.trim() ||
                  (accountKind === 'BANK' && !accountBankId)
                }
              >
                ذخیره حساب
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={actionBusy}
                onClick={() => setAccountDialog(false)}
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
