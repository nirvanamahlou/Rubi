import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Landmark,
  ListFilter,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
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
  const dashboard = useMemo(() => {
    const openItems = items.filter((item) => !closed.has(item.status));
    const receiptItems = openItems.filter((item) => item.source === 'SALES');
    const paymentItems = openItems.filter((item) => item.source !== 'SALES');
    const dueItems = [...openItems]
      .filter((item) => item.dueAt)
      .sort((left, right) =>
        (left.dueAt ?? '').localeCompare(right.dueAt ?? ''),
      )
      .slice(0, 3);
    const sourceSummary = (Object.keys(sourceLabels) as FinanceInboxSource[])
      .map((key) => ({
        source: key,
        count: openItems.filter((item) => item.source === key).length,
      }))
      .filter((item) => item.count > 0);
    return {
      receiptCount: receiptItems.length,
      paymentCount: paymentItems.length,
      dueItems,
      sourceSummary,
      activeAccountCount: accounts.filter((account) => account.isActive).length,
    };
  }, [accounts, items]);
  const selected =
    items.find(({ id }) => id === selectedId) ?? items[0] ?? null;
  const openCount = items.filter((item) => !closed.has(item.status)).length;
  const overdueCount = items.filter(
    (item) =>
      !closed.has(item.status) &&
      item.dueAt !== null &&
      (data?.generatedAt ?? '') > item.dueAt,
  ).length;
  const availableSources = (data?.sources ?? []).filter(
    ({ connection }) => connection !== 'NOT_CONNECTED',
  );
  const kpis = [
    {
      label: 'دریافت‌های در انتظار',
      helper: 'نیازمند تعیین حساب مقصد',
      value: dashboard.receiptCount,
      icon: ArrowDownLeft,
      tone: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'پرداخت‌های قابل اقدام',
      helper: 'کارگزار، خرید و رزرواسیون',
      value: dashboard.paymentCount,
      icon: ArrowUpRight,
      tone: 'from-blue-600 to-indigo-700',
    },
    {
      label: 'ریسک سررسید',
      helper: 'درخواست‌های گذشته از موعد',
      value: overdueCount,
      icon: CircleAlert,
      tone: 'from-rose-500 to-pink-600',
    },
    {
      label: 'حساب‌های فعال',
      helper: 'حساب مبدأ و مقصد قابل انتخاب',
      value: dashboard.activeAccountCount,
      icon: Landmark,
      tone: 'from-violet-600 to-purple-700',
    },
  ];

  function openReceiptAction(
    item: FinanceInboxItemV1,
    kind: 'APPROVE' | 'CORRECTION_REQUIRED',
  ) {
    const eligibleAccounts = accounts.filter(
      (account) =>
        account.branchId === item.branchReference &&
        account.currencyCode === item.amount?.currencyCode,
    );
    setActionItem(item);
    setActionKind(kind);
    setAccountId(kind === 'APPROVE' ? (eligibleAccounts[0]?.id ?? '') : '');
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
          accountId: actionKind === 'APPROVE' ? accountId : null,
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
      <Card className="overflow-hidden border-0 bg-gradient-to-l from-slate-950 via-blue-950 to-indigo-900 p-0 text-white shadow-xl shadow-primary/10">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white">
                <BarChart3 className="size-3.5" />
                مرکز کنترل مالی
              </Badge>
              <span className="text-xs text-blue-200">
                داده‌های عملیاتی ·{' '}
                {data ? faDate(data.generatedAt) : 'در حال دریافت'}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">
              امروز چه چیزی نیاز به تصمیم مالی دارد؟
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-blue-100">
              دریافت‌ها را به حساب مقصد متصل کنید، پرداخت‌های کارگزار را از حساب
              مبدأ ثبت کنید و موارد سررسیددار را پیش از تأخیر ببندید.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
              size="sm"
              variant="outline"
            >
              <RefreshCw
                className={`size-4 ${loading ? 'animate-spin' : ''}`}
              />
              به‌روزرسانی
            </Button>
            <Button
              className="bg-white text-slate-900 hover:bg-blue-50"
              onClick={() => {
                setStatus('OPEN');
                setSource('ALL');
              }}
              size="sm"
            >
              <ListFilter className="size-4" />
              مشاهده موارد باز
            </Button>
          </div>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-l">
            <p className="text-xs text-blue-200">صف کارتابل</p>
            <p className="mt-1 text-2xl font-black">{items.length}</p>
          </div>
          <div className="border-b border-white/10 p-4 sm:border-b-0 sm:border-l">
            <p className="text-xs text-blue-200">نیازمند اقدام امروز</p>
            <p className="mt-1 text-2xl font-black">{openCount}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-blue-200">اولویت سررسید</p>
            <p className="mt-1 text-2xl font-black">{overdueCount}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, helper, value, icon: Icon, tone }) => (
          <Card className="group overflow-hidden p-0" key={label}>
            <div className={`h-1 bg-gradient-to-l ${tone}`} />
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-black">{String(value)}</p>
                <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
              </div>
              <span
                className={`rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg ${tone}`}
              >
                <Icon className="size-5" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">جریان کارتابل بر اساس واحد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                حجم درخواست‌های باز در هر واحد عملیاتی
              </p>
            </div>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <div className="mt-5 space-y-4">
            {dashboard.sourceSummary.length ? (
              dashboard.sourceSummary.map(({ source: sourceName, count }) => {
                const ratio = openCount
                  ? Math.round((count / openCount) * 100)
                  : 0;
                return (
                  <div key={sourceName}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {sourceLabels[sourceName]}
                      </span>
                      <span className="text-muted-foreground">
                        {count} مورد · {ratio}٪
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-primary to-cyan-400"
                        style={{ width: `${Math.max(ratio, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                درخواستی برای نمایش در بازه و فیلتر فعلی وجود ندارد.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black">اولویت‌های نزدیک</p>
              <p className="mt-1 text-xs text-muted-foreground">
                موارد باز با نزدیک‌ترین سررسید
              </p>
            </div>
            <Clock3 className="size-5 text-rose-500" />
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.dueItems.length ? (
              dashboard.dueItems.map((item) => (
                <button
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border p-3 text-start transition hover:border-primary/40 hover:bg-muted/40"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {sourceLabels[item.source]} · {faDate(item.dueAt)}
                    </span>
                  </span>
                  <ChevronLeft className="size-4 shrink-0 text-primary" />
                </button>
              ))
            ) : (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                هیچ سررسید بازی در فیلتر فعلی وجود ندارد.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-sm font-black">حساب‌های قابل استفاده</p>
              <p className="text-xs text-muted-foreground">
                برای ثبت دریافت و پرداخت
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {accounts
              .filter((account) => account.isActive)
              .slice(0, 3)
              .map((account) => (
                <div
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5"
                  key={account.id}
                >
                  <span className="truncate text-sm font-semibold">
                    {account.title}
                  </span>
                  <Badge>{account.currencyCode}</Badge>
                </div>
              ))}
            {!accounts.filter((account) => account.isActive).length ? (
              <p className="text-sm text-muted-foreground">
                حساب فعالی برای شعبه انتخاب‌شده دریافت نشد.
              </p>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col justify-between gap-4 bg-gradient-to-l from-primary/10 via-surface to-cyan-500/10 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-primary p-3 text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="font-black">راهنمای اقدام مالی</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                برای دریافت قرارداد، حساب مقصد را تعیین کن؛ برای پرداخت کارگزار،
                حساب مبدأ، روش پرداخت و شماره پیگیری را ثبت کن.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setSource('SALES');
                setStatus('OPEN');
              }}
              size="sm"
            >
              <ArrowDownLeft className="size-4" />
              دریافت‌های فروش
            </Button>
            <Button
              onClick={() => {
                setSource('RESERVATIONS');
                setStatus('OPEN');
              }}
              size="sm"
              variant="outline"
            >
              <ArrowUpRight className="size-4" />
              پرداخت کارگزار
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <ListFilter className="size-4 text-primary" />
          <div>
            <h3 className="text-sm font-black">فیلتر و جست‌وجوی کارتابل</h3>
            <p className="text-xs text-muted-foreground">
              تمام کارت‌ها و اولویت‌ها با فیلترهای زیر همگام می‌شوند.
            </p>
          </div>
        </div>
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
            {actionKind === 'APPROVE' ? (
              <label className="grid gap-2">
                <span>واریز به حساب</span>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب حساب مقصد" />
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
                  (actionKind === 'APPROVE' && !accountId) ||
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
          <DialogTitle>
            {actionKind === 'APPROVE'
              ? 'تعریف حساب دریافت'
              : 'تعریف حساب پرداخت'}
          </DialogTitle>
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
