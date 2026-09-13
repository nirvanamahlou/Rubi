'use client';

import {
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Inbox,
  RefreshCw,
  Search,
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
  const availableSources = (data?.sources ?? []).filter(
    ({ connection }) => connection !== 'NOT_CONNECTED',
  );
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
  ];

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
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
