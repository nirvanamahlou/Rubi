'use client';

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Inbox,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  FinanceInboxItemV1,
  FinanceInboxSource,
  FinanceInboxV1,
  FinanceRequestStatus,
} from '@rubi/contracts';

import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
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
        matchesSource && matchesStatus && (!query || haystack.includes(query))
      );
    });
  }, [data, search, source, status]);
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
  const connectedCount =
    data?.sources.filter(({ connection }) => connection === 'CONNECTED')
      .length ?? 0;
  const kpis = [
    {
      label: 'کل درخواست‌های واقعی',
      value: data?.items.length ?? 0,
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
    {
      label: 'منابع متصل',
      value: `${connectedCount} از ۴`,
      icon: CheckCircle2,
      tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
    },
  ];

  return (
    <section className="space-y-5" aria-label="کارتابل یکپارچه مالی">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#082f6b] via-[#0e56ae] to-[#1194b8] p-6 text-white shadow-lg shadow-blue-950/10 md:p-8">
        <div className="absolute -start-20 -top-24 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 end-16 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <ShieldCheck className="size-4" /> صف امن و شعبه‌محور
            </div>
            <h2 className="text-2xl font-black md:text-3xl">
              مرکز درخواست‌های مالی
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-blue-50/90">
              درخواست‌های ثبت‌شده واحدها، با منبع و وضعیت اتصال مشخص، در یک صف
              قابل پیگیری
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-xl bg-white/12 px-3 py-2 backdrop-blur">
              آخرین دریافت: {data ? faDate(data.generatedAt) : '—'}
            </span>
            <Button
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
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
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-black">وضعیت اتصال واحدها</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              فقط منابع دارای Producer واقعی وارد صف می‌شوند.
            </p>
          </div>
          <Badge>Live sources</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.sources ?? []).map((item) => (
            <div
              className={`rounded-2xl border p-3 ${sourceTone(item.source)}`}
              key={item.source}
            >
              <div className="flex items-center justify-between gap-2">
                <strong>{sourceLabels[item.source]}</strong>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <span
                    className={`size-2 rounded-full ${item.connection === 'CONNECTED' ? 'bg-emerald-500' : item.connection === 'UNAVAILABLE' ? 'bg-rose-500' : 'bg-amber-500'}`}
                  />
                  {item.connection === 'CONNECTED'
                    ? 'متصل'
                    : item.connection === 'UNAVAILABLE'
                      ? 'پاسخ نمی‌دهد'
                      : 'در انتظار Producer'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 opacity-80">
                {item.message}
              </p>
              <p className="mt-2 text-sm font-black">
                {item.itemCount.toLocaleString('fa-IR')} درخواست
              </p>
            </div>
          ))}
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
                <div
                  className="h-28 animate-pulse rounded-2xl bg-muted"
                  key={index}
                />
              ))
            : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_13rem_13rem_auto]">
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
              {Object.entries(sourceLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
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
          <Button
            onClick={() => {
              setSearch('');
              setSource('ALL');
              setStatus('OPEN');
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
          description="اگر منبعی هنوز متصل نیست، پس از انتشار Producer همان واحد وارد این صف خواهد شد."
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mb-1 inline size-4" /> این مرحله فقط
                  خواندن درخواست واقعی است؛ تأیید دریافت یا پرداخت تا فعال‌شدن
                  Persistence مالی انجام نمی‌شود.
                </div>
                <Button className="w-full" disabled>
                  <Send className="size-4" /> عملیات مالی پس از فعال‌سازی
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Building2 className="size-4" /> دامنه نمایش از شعب مجاز کاربر گرفته
        می‌شود؛ Finance مستقیماً جدول Sales یا HR را Query نمی‌کند.
      </div>
    </section>
  );
}
