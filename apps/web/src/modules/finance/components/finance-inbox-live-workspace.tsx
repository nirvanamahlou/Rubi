import styles from './finance-inbox.module.css';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  FileUp,
  Landmark,
  ListFilter,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isActionablePayment } from '../model/inbox-filters';
import { paymentWithReceipt } from '../model/payment-with-receipt';
import { FinanceHistoryPanel } from './finance-history-panel';
import { FinanceExportActions } from './finance-export-actions';
import { FinancePayrollActions } from './finance-payroll-actions';
import { FinanceFollowupPanel } from './finance-followup-panel';
import { FinanceRequestCreate } from './finance-request-create';
import type {
  FinanceInboxItemV1,
  FinanceInboxSource,
  FinanceInboxQueryV1,
  FinanceInboxPageV1,
  FinanceBankOptionV1,
  FinancePaymentMethodOptionV1,
  FinanceRequestStatus,
  FinanceSettlementAccountKind,
  FinanceSettlementAccountV1,
  FinanceTicketPaymentCommandV1,
} from '@nora/contracts';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { MoneyInput } from '@/components/ui/money-input';
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
import { documentsApi } from '@/modules/documents/api/client';

const sourceLabels: Record<FinanceInboxSource, string> = {
  SALES: 'فروش',
  HR: 'منابع انسانی',
  RESERVATIONS: 'رزرواسیون',
  PURCHASES: 'تنخواه / خرید و تأمین',
  FINANCE: 'درخواست مستقیم مالی',
};
const statusLabels: Partial<Record<FinanceRequestStatus, string>> = {
  NEW: 'جدید',
  UNDER_REVIEW: 'در حال بررسی',
  APPROVED: 'تأییدشده',
  READY_FOR_PAYMENT: 'آماده پرداخت',
  PAYING: 'پرداخت جزئی',
  PAID: 'تسویه‌شده',
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

const isClosed = (item: FinanceInboxItemV1) =>
  item.status === 'APPROVED'
    ? item.kind === 'HR_REFERRAL'
    : closed.has(item.status);

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
    FINANCE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[source];
}

export function FinanceInboxLiveWorkspace() {
  const ticketCommand = useRef<FinanceTicketPaymentCommandV1 | null>(null);
  const [paymentUncertain, setPaymentUncertain] = useState(false);
  const submitting = useRef(false);
  const hrResponseKey = useRef('');
  const [receiptRetries, setReceiptRetries] = useState<
    { id: string; item: FinanceInboxItemV1; file: File }[]
  >([]);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    revision: number;
    queryKey: string;
    data: FinanceInboxPageV1 | null;
    error: string;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<FinanceInboxSource | 'ALL'>('ALL');
  const [status, setStatus] = useState<
    'ALL' | 'OPEN' | 'CLOSED' | FinanceRequestStatus
  >('OPEN');
  const [currencyCode, setCurrencyCode] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueAt' | 'amount'>(
    'createdAt',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({ key: '', page: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const filterKey = JSON.stringify({
    search,
    source,
    status,
    fromDate,
    toDate,
    currencyCode,
    minAmount,
    maxAmount,
    sortBy,
    sortDirection,
  });
  const page = pagination.key === filterKey ? pagination.page : 1;
  const setPage = (value: number | ((current: number) => number)) =>
    setPagination({
      key: filterKey,
      page: typeof value === 'function' ? value(page) : value,
    });
  const [accounts, setAccounts] = useState<
    readonly FinanceSettlementAccountV1[]
  >([]);
  const [methods, setMethods] = useState<
    readonly FinancePaymentMethodOptionV1[]
  >([]);
  const [methodsError, setMethodsError] = useState('');
  const [banks, setBanks] = useState<readonly FinanceBankOptionV1[]>([]);
  const [actionItem, setActionItem] = useState<FinanceInboxItemV1 | null>(null);
  const [actionKind, setActionKind] = useState<
    | 'APPROVE'
    | 'CORRECTION_REQUIRED'
    | 'PAYMENT'
    | 'HR_REVIEW'
    | 'HR_ANSWER'
    | 'HR_REJECT'
    | null
  >(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reason, setReason] = useState('');
  const [issueDocumentDelivery, setIssueDocumentDelivery] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString());
  const [paymentReference, setPaymentReference] = useState('');
  const [ticketReceiptFile, setTicketReceiptFile] = useState<File | null>(null);
  const [accountDialog, setAccountDialog] = useState(false);
  const [accountTitle, setAccountTitle] = useState('');
  const [accountKind, setAccountKind] =
    useState<FinanceSettlementAccountKind>('BANK');
  const [accountBankId, setAccountBankId] = useState('');
  const [accountMaskedId, setAccountMaskedId] = useState('');
  const inboxQuery = useMemo<FinanceInboxQueryV1>(
    () => ({
      search,
      source: source === 'ALL' ? undefined : source,
      status: status === 'ALL' ? undefined : status,
      fromDate,
      toDate,
      currencyCode,
      minAmount,
      maxAmount,
      sortBy,
      sortDirection,
      page,
      pageSize: 25,
    }),
    [
      search,
      source,
      status,
      fromDate,
      toDate,
      currencyCode,
      minAmount,
      maxAmount,
      sortBy,
      sortDirection,
      page,
    ],
  );

  const queryKey = JSON.stringify(inboxQuery);
  const loading = state?.revision !== revision || state.queryKey !== queryKey;
  const data = loading ? null : state.data;
  const error = loading ? '' : state.error;
  const paymentCurrency = actionItem?.ticketPurchase
    ? actionItem.amount?.currencyCode
    : actionItem?.amount?.currencyCode;

  useEffect(() => {
    let active = true;
    void financeInboxApi
      .page(inboxQuery)
      .then((value) => {
        if (active) setState({ revision, queryKey, data: value, error: '' });
      })
      .catch((reason: unknown) => {
        if (active)
          setState({
            revision,
            queryKey,
            data: null,
            error:
              reason instanceof FinanceInboxApiError
                ? reason.message
                : 'دریافت کارتابل مالی ناموفق بود.',
          });
      });
    return () => {
      active = false;
    };
  }, [revision, inboxQuery, queryKey]);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      financeInboxApi.accounts(),
      financeInboxApi.methods(),
      financeInboxApi.banks(),
    ]).then(([accountResult, methodResult, bankResult]) => {
      if (!active) return;
      if (accountResult.status === 'fulfilled')
        setAccounts(accountResult.value);
      if (methodResult.status === 'fulfilled') {
        setMethods(methodResult.value);
        setMethodsError(
          methodResult.value.length
            ? ''
            : 'روش پرداخت خروجی فعالی تعریف نشده است؛ در اطلاعات پایه روش پرداخت را فعال کنید.',
        );
      } else {
        setMethods([]);
        setMethodsError(
          methodResult.reason instanceof FinanceInboxApiError
            ? methodResult.reason.message
            : 'دریافت روش‌های پرداخت ناموفق بود.',
        );
      }
      if (bankResult.status === 'fulfilled') setBanks(bankResult.value);
    });
    return () => {
      active = false;
    };
  }, [revision]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const dashboard = useMemo(() => {
    const openItems = items.filter((item) => !isClosed(item));
    const receiptItems = openItems.filter((item) => item.source === 'SALES');
    const paymentItems = openItems.filter(isActionablePayment);
    const dueItems = [...openItems]
      .filter((item) => item.dueAt)
      .sort((left, right) =>
        (left.dueAt ?? '').localeCompare(right.dueAt ?? ''),
      )
      .slice(0, 3);
    return {
      receiptCount: data?.summary.receiptCount ?? receiptItems.length,
      paymentCount: data?.summary.paymentCount ?? paymentItems.length,
      dueItems,
      activeAccountCount: accounts.filter((account) => account.isActive).length,
    };
  }, [accounts, items, data]);
  const selected =
    items.find(({ id }) => id === selectedId) ?? items[0] ?? null;
  const openCount =
    data?.summary.openCount ?? items.filter((item) => !isClosed(item)).length;
  const overdueCount =
    data?.summary.overdueCount ??
    items.filter(
      (item) =>
        !isClosed(item) &&
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
    setIssueDocumentDelivery(false);
    setActionError('');
  }

  function openSupplierPayment(item: FinanceInboxItemV1) {
    ticketCommand.current = null;
    setPaymentUncertain(false);
    const eligibleAccounts = accounts.filter(
      (account) =>
        account.branchId === item.branchReference &&
        account.currencyCode ===
          (item.amount?.currencyCode ??
            (item.ticketPurchase ? 'IRR' : undefined)),
    );
    setActionItem(item);
    setActionKind('PAYMENT');
    setAccountId(eligibleAccounts[0]?.id ?? '');
    setPaymentMethodId(methods[0]?.id ?? '');
    setPaidAmount(
      item.settlement?.remainingAmount ?? item.amount?.amount ?? '',
    );
    setExchangeRate((item.amount?.currencyCode ?? 'IRR') === 'IRR' ? '1' : '');
    setPaidAt(new Date().toISOString());
    setPaymentReference('');
    setTicketReceiptFile(null);
    setReason('');
    setActionError('');
  }

  function openHrResponse(
    item: FinanceInboxItemV1,
    kind: 'HR_REVIEW' | 'HR_ANSWER' | 'HR_REJECT',
  ) {
    setActionItem(item);
    setActionKind(kind);
    setReason('');
    setActionError('');
    hrResponseKey.current = crypto.randomUUID();
  }

  async function uploadTicketPaymentReceipt(
    file: File,
    paymentId: string,
    item: FinanceInboxItemV1,
  ) {
    const options = (await documentsApi.options()).data;
    const documentType = options.documentTypes.find(
      (type) => type.domain === 'FINANCE',
    );
    const category = options.categories[0];
    const owner =
      options.owners.find(
        (candidate) => candidate.id === options.currentUserId,
      ) ?? options.owners[0];
    if (!documentType || !category || !owner)
      throw new Error('تنظیمات اسناد مالی برای بارگذاری رسید کامل نیست.');
    const form = new FormData();
    form.set('file', file);
    form.set('title', `رسید پرداخت ${item.title} · ${file.name}`.slice(0, 240));
    form.set('description', 'رسید پرداخت ثبت‌شده در کارتابل مالی');
    form.set('documentTypeId', documentType.id);
    form.set('categoryId', category.id);
    form.set('branchId', item.branchReference);
    form.set('ownerUserId', owner.id);
    form.set('sourceModule', 'FINANCE');
    form.set('sourceEntityType', 'FinanceTicketPurchasePayment');
    form.set('sourceEntityId', paymentId);
    form.set('sourceDisplayLabel', `${item.title} · رسید پرداخت`);
    form.set('confidentiality', documentType.defaultConfidentiality);
    form.set('versionNote', 'بارگذاری از پرداخت خرید بلیت');
    await documentsApi.upload(form);
  }

  async function submitAction() {
    if (!actionItem || !actionKind || submitting.current) return;
    submitting.current = true;
    setActionBusy(true);
    setActionError('');
    try {
      if (
        actionKind === 'HR_REVIEW' ||
        actionKind === 'HR_ANSWER' ||
        actionKind === 'HR_REJECT'
      ) {
        await financeInboxApi.respondHr(
          actionItem.sourceContextReference,
          {
            version: actionItem.sourceVersion,
            status:
              actionKind === 'HR_REVIEW'
                ? 'IN_REVIEW'
                : actionKind === 'HR_ANSWER'
                  ? 'ANSWERED'
                  : 'REJECTED',
            note: reason,
          },
          hrResponseKey.current,
        );
      } else if (actionKind === 'PAYMENT' && actionItem.ticketPurchase) {
        const prepared = actionItem;
        if (!prepared.amount)
          throw new Error('قیمت خرید ابتدا باید در خرید و تأمین ثبت شود.');
        ticketCommand.current ??= {
          version: 1,
          operationId: crypto.randomUUID(),
          expectedPaymentVersion: actionItem.ticketPurchase.paymentCount,
          costRevisionId: prepared.sourceContextReference,
          accountId,
          paymentMethodId,
          paidAmount,
          exchangeRateToIrr: exchangeRate,
          transferAt: new Date(
            /[zZ]$|[+-]\d{2}:\d{2}$/.test(paidAt) ? paidAt : `${paidAt}+03:30`,
          ).toISOString(),
          paymentReference: paymentReference.trim() || null,
        };
        const command = ticketCommand.current;
        setPaymentUncertain(true);
        const result = await paymentWithReceipt(
          () => financeInboxApi.payTicket(actionItem.sourceReference, command),
          ticketReceiptFile
            ? (payment) =>
                uploadTicketPaymentReceipt(
                  ticketReceiptFile,
                  payment.id,
                  actionItem,
                )
            : undefined,
        );
        if (result.receiptFailed && ticketReceiptFile) {
          setReceiptRetries((current) => [
            ...current,
            {
              id: result.payment.id,
              item: actionItem,
              file: ticketReceiptFile,
            },
          ]);
        }
        ticketCommand.current = null;
        setPaymentUncertain(false);
      } else if (
        actionItem.source === 'PURCHASES' &&
        actionItem.kind === 'RETURN_CORRECTION'
      ) {
        await financeInboxApi.decideCorrection(actionItem.sourceReference, {
          version: 1,
          expectedVersion: actionItem.sourceVersion,
          action: actionKind as 'APPROVE' | 'CORRECTION_REQUIRED',
          reason,
        });
      } else if (
        actionItem.source === 'PURCHASES' &&
        !actionItem.ticketPurchase
      ) {
        if (actionKind === 'PAYMENT') {
          await financeInboxApi.payInvoice(actionItem.sourceReference, {
            version: 1,
            expectedVersion: actionItem.financeVersion ?? 0,
            expectedSourceVersion: actionItem.sourceVersion,
            accountId,
            paymentMethodId,
            paidAmount,
            exchangeRateToIrr: exchangeRate,
            transferAt: new Date(
              /[zZ]$|[+-]\d{2}:\d{2}$/.test(paidAt)
                ? paidAt
                : `${paidAt}+03:30`,
            ).toISOString(),
            paymentReference: paymentReference.trim() || null,
            reason,
          });
        } else {
          await financeInboxApi.decideInvoice(actionItem.sourceReference, {
            version: 1,
            expectedVersion: actionItem.financeVersion ?? 0,
            expectedSourceVersion: actionItem.sourceVersion,
            action: actionKind as 'APPROVE' | 'CORRECTION_REQUIRED',
            reason,
          });
        }
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
            transferAt: new Date(
              /[zZ]$|[+-]\d{2}:\d{2}$/.test(paidAt)
                ? paidAt
                : `${paidAt}+03:30`,
            ).toISOString(),
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
          ...(actionKind === 'APPROVE' && issueDocumentDelivery
            ? {
                documentDelivery: {
                  approved: true,
                  basis: 'AFTER_RECEIPT',
                  reason: 'تأیید دریافت مشتری و صدور مجوز تحویل مدارک',
                },
              }
            : {}),
        });
      }
      window.dispatchEvent(new Event('finance-transactions-changed'));
      setActionItem(null);
      setActionKind(null);
      setRevision((value) => value + 1);
    } catch (cause) {
      if (
        cause instanceof FinanceInboxApiError &&
        cause.status >= 400 &&
        cause.status < 500
      ) {
        ticketCommand.current = null;
        setPaymentUncertain(false);
      }
      setActionError(
        cause instanceof FinanceInboxApiError
          ? cause.message
          : 'ثبت عملیات مالی ناموفق بود.',
      );
    } finally {
      submitting.current = false;
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
        currencyCode: paymentCurrency ?? 'IRR',
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
    <section
      className={`${styles.workspace} space-y-4`}
      aria-label="کارتابل یکپارچه مالی"
    >
      {receiptRetries.map((retry) => (
        <Card key={retry.id} className="space-y-3 p-4">
          <p>
            پرداخت «{retry.item.title}» ثبت شده است؛ فقط بارگذاری رسید ناموفق
            بود. پرداخت را دوباره ثبت نکنید.
          </p>
          <Button
            disabled={receiptBusy}
            onClick={async () => {
              setReceiptBusy(true);
              setReceiptError('');
              try {
                await uploadTicketPaymentReceipt(
                  retry.file,
                  retry.id,
                  retry.item,
                );
                setReceiptRetries((current) =>
                  current.filter((entry) => entry.id !== retry.id),
                );
              } catch {
                setReceiptError(
                  'بارگذاری رسید ناموفق بود؛ پرداخت قبلی محفوظ است.',
                );
              } finally {
                setReceiptBusy(false);
              }
            }}
          >
            تلاش مجدد بارگذاری رسید
          </Button>
          {receiptError ? <p role="alert">{receiptError}</p> : null}
        </Card>
      ))}
      <Card className={`${styles.hero} overflow-hidden p-0`}>
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
              کارتابل درخواست‌ها
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

      <details className={styles.summary}>
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
          نمای کلی عملیات مالی
        </summary>
        <div className="space-y-4 p-4">
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
                    <p className="mt-2 text-xs text-muted-foreground">
                      {helper}
                    </p>
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

          <div className="grid gap-4">
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
                          {item.source === 'PURCHASES'
                            ? item.ticketPurchase
                              ? 'خرید و تأمین'
                              : 'تنخواه'
                            : sourceLabels[item.source]}{' '}
                          · {faDate(item.dueAt)}
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
                    برای دریافت قرارداد، حساب مقصد را تعیین کن؛ برای پرداخت
                    کارگزار، حساب مبدأ، روش پرداخت و شماره پیگیری را ثبت کن.
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
        </div>
      </details>

      <Card className={`${styles.filters} p-5`}>
        <FinanceRequestCreate
          onCreated={() => setRevision((value) => value + 1)}
        />
        <div className="mb-4 flex items-center gap-2">
          <ListFilter className="size-4 text-primary" />
          <div>
            <h3 className="text-sm font-black">فیلتر و جست‌وجوی کارتابل</h3>
            <p className="text-xs text-muted-foreground">
              تمام کارت‌ها و اولویت‌ها با فیلترهای زیر همگام می‌شوند.
            </p>
          </div>
        </div>
        <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs text-muted-foreground">
            مرتب‌سازی بر اساس
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as typeof sortBy)}
            >
              <SelectTrigger aria-label="مرتب‌سازی کارتابل مالی">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">تاریخ ورود به مالی</SelectItem>
                <SelectItem value="dueAt">تاریخ سررسید</SelectItem>
                <SelectItem value="amount">مبلغ درخواست</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            ترتیب نمایش
            <Select
              value={sortDirection}
              onValueChange={(value) =>
                setSortDirection(value as typeof sortDirection)
              }
            >
              <SelectTrigger aria-label="جهت مرتب‌سازی کارتابل">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">
                  صعودی (کمترین / قدیمی‌ترین اول)
                </SelectItem>
                <SelectItem value="desc">
                  نزولی (بیشترین / جدیدترین اول)
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          {sortBy === 'amount' ? (
            <p className="text-xs text-muted-foreground">
              مبلغ درخواست‌ها در هر ارز جداگانه مرتب می‌شود.
            </p>
          ) : null}
          <div className="relative sm:col-span-2">
            <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجوی قرارداد، طرف‌حساب، شرح یا شماره درخواست"
              aria-label="جست‌وجوی درخواست‌های مالی"
              value={search}
            />
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            فیلتر واحد ارسال‌کننده
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
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            فیلتر وضعیت درخواست
            <Select
              onValueChange={(value) => setStatus(value as typeof status)}
              value={status}
            >
              <SelectTrigger aria-label="فیلتر وضعیت درخواست">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">درخواست‌های باز</SelectItem>
                <SelectItem value="CLOSED">موارد بسته موجود در صف</SelectItem>
                <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
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
              setCurrencyCode('');
              setMinAmount('');
              setMaxAmount('');
              setSortBy('createdAt');
              setSortDirection('desc');
              setPage(1);
            }}
            variant="outline"
          >
            پاک‌کردن فیلترها
          </Button>
        </div>
        <div className="my-4 grid items-end gap-4 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            فیلتر ارز
            <Input
              aria-label="فیلتر ارز"
              placeholder="ارز، مثل IRR"
              value={currencyCode}
              onChange={(event) =>
                setCurrencyCode(event.target.value.toUpperCase())
              }
              maxLength={3}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            حداقل مبلغ
            <MoneyInput
              aria-label="حداقل مبلغ"
              placeholder="حداقل مبلغ"
              value={minAmount}
              onValueChange={setMinAmount}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            حداکثر مبلغ
            <MoneyInput
              aria-label="حداکثر مبلغ"
              placeholder="حداکثر مبلغ"
              value={maxAmount}
              onValueChange={setMaxAmount}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            صفحه قبل
          </Button>
          <span className="text-sm">
            صفحه {page.toLocaleString('fa-IR')} ·{' '}
            {data?.total.toLocaleString('fa-IR') ?? '—'} نتیجه
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !data || page * 25 >= data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            صفحه بعد
          </Button>
          {page > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setPage(1)}>
              بازگشت به صفحه اول
            </Button>
          ) : null}
        </div>
        <FinanceExportActions
          disabled={loading || !!error}
          query={{ ...inboxQuery, scope: 'INBOX' }}
        />
        <FinanceFollowupPanel
          showSavedViews={false}
          query={inboxQuery}
          onApply={(value) => {
            setSortBy(value.sortBy ?? 'createdAt');
            setSortDirection(value.sortDirection ?? 'desc');
            setSearch(value.search ?? '');
            setSource(value.source ?? 'ALL');
            setStatus(value.status ?? 'ALL');
            setCurrencyCode(value.currencyCode ?? '');
            setMinAmount(value.minAmount ?? '');
            setMaxAmount(value.maxAmount ?? '');
            setFromDate(value.fromDate ?? '');
            setToDate(value.toDate ?? '');
            setPage(1);
          }}
        />
      </Card>

      {error ? (
        <Alert tone="warning" title="کارتابل دریافت نشد" description={error} />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-4">
              <div>
                <h3 className="font-bold">فهرست درخواست‌ها</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  یک درخواست را انتخاب کنید تا جزئیات و اقداماتش پایین فهرست باز
                  شود.
                </p>
              </div>
              <Badge className="px-3 py-1">
                {items.length.toLocaleString('fa-IR')} درخواست
              </Badge>
            </div>
            {items.map((item) => {
              const active = selected?.id === item.id;
              const overdue = Boolean(
                data &&
                item.dueAt &&
                !isClosed(item) &&
                data.generatedAt > item.dueAt,
              );
              return (
                <button
                  aria-pressed={active}
                  aria-controls="finance-request-details"
                  className={`${styles.requestRow} w-full border border-s-4 p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${active ? 'border-s-primary bg-primary/5' : 'border-s-transparent hover:bg-muted/40'}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    document
                      .getElementById('finance-request-details')
                      ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={sourceTone(item.source)}>
                          {item.source === 'PURCHASES'
                            ? item.ticketPurchase
                              ? 'خرید و تأمین'
                              : 'تنخواه'
                            : sourceLabels[item.source]}
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
                      <h3 className="mt-2 break-words text-sm font-bold leading-6">
                        {item.title}
                      </h3>
                    </div>
                    <p
                      className="shrink-0 whitespace-nowrap text-base font-bold tabular-nums text-primary"
                      dir="ltr"
                    >
                      {money(item)}
                    </p>
                  </div>
                  {item.ticketPurchase ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      تعداد صندلی:{' '}
                      {item.ticketPurchase.seatCount?.toLocaleString('fa-IR') ??
                        '—'}{' '}
                      · قیمت تکی:{' '}
                      {item.ticketPurchase.unitCost
                        ? item.ticketPurchase.unitCost +
                          ' ' +
                          (item.amount?.currencyCode ?? '')
                        : 'ثبت نشده'}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <bdi className="break-all">
                      {item.contractReference ?? item.sourceReference}
                    </bdi>
                    <span>
                      {item.partyDisplaySnapshot ?? 'طرف‌حساب درج نشده'}
                    </span>
                    <span>سررسید: {faDate(item.dueAt)}</span>
                    <span className="ms-auto inline-flex items-center gap-1 font-semibold text-primary">
                      {active ? 'در حال مشاهده' : 'بررسی درخواست'}
                      <ChevronLeft aria-hidden="true" className="size-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {selected ? (
            <Card
              id="finance-request-details"
              className="scroll-mt-24 overflow-hidden p-0"
              aria-label="جزئیات درخواست انتخاب‌شده"
            >
              <div className="border-b border-border bg-primary/5 p-5">
                <p className="mb-3 text-xs font-bold text-primary">
                  جزئیات درخواست انتخاب‌شده
                </p>
                <div className="flex items-center justify-between gap-3">
                  <Badge className={sourceTone(selected.source)}>
                    {selected.source === 'PURCHASES'
                      ? selected.ticketPurchase
                        ? 'خرید و تأمین'
                        : 'تنخواه'
                      : sourceLabels[selected.source]}
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
                {selected.reservationPurchase ? (
                  <div className="space-y-3 rounded-xl border border-border p-3">
                    <strong className="text-sm">خریدهای این درخواست</strong>
                    {selected.reservationPurchase.lines.map((line) => (
                      <div
                        key={line.purchaseId}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm"
                      >
                        <span>
                          {line.serviceTitle} · {line.supplierName}
                        </span>
                        <span dir="ltr">
                          {line.amount} {line.currencyCode}
                        </span>
                        {line.status !== 'PAID' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openSupplierPayment({
                                ...selected,
                                sourceReference: line.purchaseId,
                                title: line.serviceTitle,
                                amount: {
                                  amount: line.amount,
                                  currencyCode: line.currencyCode,
                                },
                                settlement: {
                                  paidAmount: line.paidAmount,
                                  remainingAmount: line.remainingAmount,
                                },
                                sourceVersion: line.financeVersion,
                              })
                            }
                          >
                            ثبت پرداخت این خرید
                          </Button>
                        ) : (
                          <span>پرداخت‌شده</span>
                        )}
                      </div>
                    ))}
                    {selected.reservationPurchase.totals.map((total) => (
                      <p key={total.currencyCode} className="text-sm font-bold">
                        جمع درخواست: {total.amount} {total.currencyCode}
                      </p>
                    ))}
                  </div>
                ) : null}
                {[
                  ['شماره منبع', selected.sourceReference],
                  ['قرارداد', selected.contractReference ?? '—'],
                  ['طرف‌حساب / کارمند', selected.partyDisplaySnapshot ?? '—'],
                  ['مبلغ', money(selected)],
                  ...(selected.ticketPurchase
                    ? [
                        [
                          'تعداد صندلی',
                          selected.ticketPurchase.seatCount?.toLocaleString(
                            'fa-IR',
                          ) ?? 'در انتظار تعیین مالی',
                        ],
                        [
                          'قیمت خرید هر صندلی',
                          selected.ticketPurchase.unitCost
                            ? selected.ticketPurchase.unitCost +
                              ' ' +
                              (selected.amount?.currencyCode ?? '')
                            : 'ثبت نشده',
                        ],
                        [
                          'پرداخت‌های ثبت‌شده',
                          selected.ticketPurchase.paymentCount.toLocaleString(
                            'fa-IR',
                          ),
                        ],
                      ]
                    : []),
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
                    <strong className="max-w-[65%] break-words text-end text-sm [overflow-wrap:anywhere]">
                      {value}
                    </strong>
                  </div>
                ))}
                {selected.hrReferral ? (
                  <div className="space-y-2">
                    {selected.hrReferral.response ? (
                      <p>پاسخ مالی: {selected.hrReferral.response}</p>
                    ) : null}
                    {selected.hrReferral.canRespond ? (
                      <div className="flex flex-wrap gap-2">
                        {selected.status === 'NEW' ? (
                          <Button
                            onClick={() =>
                              openHrResponse(selected, 'HR_REVIEW')
                            }
                          >
                            شروع بررسی ارجاع
                          </Button>
                        ) : null}
                        {selected.status === 'UNDER_REVIEW' ? (
                          <Button
                            onClick={() =>
                              openHrResponse(selected, 'HR_ANSWER')
                            }
                          >
                            ثبت پاسخ ارجاع
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={() => openHrResponse(selected, 'HR_REJECT')}
                        >
                          رد ارجاع با علت
                        </Button>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      این مورد ارجاع منابع انسانی است؛ ثبت پاسخ به معنی ثبت
                      پرداخت حقوق نیست.
                    </p>
                  </div>
                ) : null}
                {selected.source === 'PURCHASES' && !selected.ticketPurchase ? (
                  <div className="space-y-2">
                    {selected.status === 'UNDER_REVIEW' ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => openReceiptAction(selected, 'APPROVE')}
                        >
                          تأیید درخواست خرید
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            openReceiptAction(selected, 'CORRECTION_REQUIRED')
                          }
                        >
                          برگشت برای اصلاح
                        </Button>
                      </div>
                    ) : null}
                    {isActionablePayment(selected) ? (
                      <Button onClick={() => openSupplierPayment(selected)}>
                        ثبت پرداخت فاکتور خرید
                      </Button>
                    ) : null}
                    {selected.kind === 'PAYMENT_REQUEST' ? (
                      <FinanceHistoryPanel
                        requestId={selected.sourceReference}
                        source="INVOICE"
                        compact
                      />
                    ) : null}
                  </div>
                ) : null}
                {selected.reservationPurchase
                  ? selected.reservationPurchase.lines.map((line) => (
                      <FinanceHistoryPanel
                        key={line.purchaseId}
                        requestId={line.purchaseId}
                        source="RESERVATIONS"
                        compact
                      />
                    ))
                  : null}
                {['PAYROLL_REQUEST', 'OPERATIONAL_REQUEST'].includes(
                  selected.kind,
                ) ? (
                  <FinancePayrollActions
                    key={selected.id}
                    item={selected}
                    accounts={accounts}
                    methods={methods}
                    onChanged={() => setRevision((value) => value + 1)}
                  />
                ) : null}
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
                selected.source === 'RESERVATIONS' &&
                !selected.reservationPurchase ? (
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
                selected.source === 'RESERVATIONS' &&
                !selected.reservationPurchase ? (
                  <FinanceHistoryPanel
                    requestId={selected.sourceReference}
                    source="RESERVATIONS"
                    compact
                  />
                ) : null}
                {selected.kind === 'PAYMENT_REQUEST' &&
                selected.source === 'PURCHASES' &&
                selected.ticketPurchase ? (
                  <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <Button
                      className="w-full"
                      onClick={() => openSupplierPayment(selected)}
                    >
                      <WalletCards className="size-4" /> ثبت پرداخت خرید بلیت
                    </Button>
                    <FinanceHistoryPanel
                      requestId={selected.sourceReference}
                      source="TICKET"
                      compact
                    />
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
          if (!open && !actionBusy && !ticketCommand.current) {
            setActionItem(null);
            setActionKind(null);
          }
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {actionItem?.kind === 'HR_REFERRAL'
              ? 'رسیدگی به ارجاع منابع انسانی'
              : actionKind === 'APPROVE'
                ? 'تأیید دریافت مسافر'
                : actionKind === 'CORRECTION_REQUIRED'
                  ? 'ارسال برای اصلاح'
                  : actionItem?.ticketPurchase
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
            <fieldset
              className="grid gap-3"
              disabled={actionBusy || paymentUncertain}
            >
              {actionKind === 'PAYMENT' && actionItem?.ticketPurchase ? (
                <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                  قیمت خرید ثبت‌شده در خرید و تأمین:{' '}
                  <bdi>
                    {actionItem.ticketPurchase.seatCount ?? '—'} صندلی · هر
                    صندلی {actionItem.ticketPurchase.unitCost ?? '—'}{' '}
                    {actionItem.amount?.currencyCode} · جمع{' '}
                    {actionItem.amount?.amount}
                  </bdi>
                </div>
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
                              account.branchId ===
                                actionItem?.branchReference &&
                              account.currencyCode === paymentCurrency,
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
                    <NativeSearchSelect
                      aria-label="روش پرداخت"
                      required
                      className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      value={paymentMethodId}
                      onChange={(event) =>
                        setPaymentMethodId(event.target.value)
                      }
                    >
                      <option value="" disabled>
                        انتخاب روش پرداخت
                      </option>
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </NativeSearchSelect>
                    {methodsError ? (
                      <span role="alert" className="text-sm text-destructive">
                        {methodsError}
                      </span>
                    ) : null}
                    {methodsError ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRevision((value) => value + 1)}
                      >
                        دریافت مجدد روش‌های پرداخت
                      </Button>
                    ) : null}
                  </label>
                  <label className="grid gap-2">
                    <span>مبلغ این پرداخت</span>
                    <MoneyInput
                      required
                      value={paidAmount}
                      onValueChange={setPaidAmount}
                    />
                    <small className="text-muted-foreground">
                      مانده فعلی:{' '}
                      {actionItem?.settlement?.remainingAmount ??
                        actionItem?.amount?.amount ??
                        '—'}{' '}
                      {paymentCurrency}
                    </small>
                  </label>
                  <p className="text-sm text-muted-foreground">
                    می‌توانید بخشی از مبلغ را پرداخت کنید و مانده را در
                    پرداخت‌های بعدی ثبت کنید؛ پس از هر ثبت، مانده به‌روز می‌شود.
                  </p>
                  {paymentCurrency !== 'IRR' ? (
                    <label className="grid gap-2">
                      <span>نرخ روز ارز به ریال</span>
                      <MoneyInput
                        required
                        value={exchangeRate}
                        onValueChange={setExchangeRate}
                      />
                    </label>
                  ) : null}
                  <label className="grid gap-2">
                    <span>تاریخ و ساعت پرداخت</span>
                    <DatePicker
                      includeTime
                      value={paidAt}
                      onChange={setPaidAt}
                    />
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
                  {actionItem?.ticketPurchase ? (
                    <label className="grid gap-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3">
                      <span className="flex items-center gap-2 font-semibold">
                        <FileUp className="size-4 text-primary" />
                        رسید پرداخت (اختیاری)
                      </span>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(event) =>
                          setTicketReceiptFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <small className="text-muted-foreground">
                        پس از ثبت پرداخت، فایل در اسناد مالی با مرجع همین پرداخت
                        ذخیره می‌شود.
                      </small>
                    </label>
                  ) : null}
                </>
              ) : null}
              {actionKind === 'APPROVE' && actionItem?.source === 'SALES' ? (
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
                            account.currencyCode === paymentCurrency,
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
              {actionKind === 'APPROVE' && actionItem?.source === 'SALES' ? (
                <div className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                  <label className="flex cursor-pointer items-start gap-3 text-sm font-bold">
                    <input
                      className="mt-1 size-4 accent-primary"
                      type="checkbox"
                      checked={issueDocumentDelivery}
                      onChange={(event) =>
                        setIssueDocumentDelivery(event.target.checked)
                      }
                    />
                    <span>
                      هم‌زمان مجوز تحویل مدارک به مشتری صادر شود
                      <small className="mt-1 block font-normal leading-5 text-muted-foreground">
                        این مجوز مستقل از خرید کارگزار و رزرواسیون است.
                      </small>
                    </span>
                  </label>
                </div>
              ) : null}
              {!(actionKind === 'PAYMENT' && actionItem?.ticketPurchase) ? (
                <label className="grid gap-2">
                  <span>
                    {actionKind === 'CORRECTION_REQUIRED'
                      ? 'دلیل اصلاح (الزامی)'
                      : 'توضیح مالی (اختیاری)'}
                  </span>
                  <Textarea
                    required={
                      actionKind === 'CORRECTION_REQUIRED' ||
                      actionItem?.kind === 'HR_REFERRAL'
                    }
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              ) : null}
            </fieldset>
            {paymentUncertain ? (
              <p role="status">
                نتیجه پرداخت هنوز قطعی دریافت نشده؛ فقط همان عملیات را دوباره
                ارسال کنید. اطلاعات این تلاش ثابت می‌ماند.
              </p>
            ) : null}
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
                  (actionKind === 'APPROVE' &&
                    actionItem?.source === 'SALES' &&
                    !accountId) ||
                  (actionKind === 'PAYMENT' &&
                    (!accountId || !paymentMethodId || !paidAmount))
                }
              >
                {actionBusy ? 'در حال ثبت…' : 'ثبت عملیات'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={actionBusy || paymentUncertain}
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
