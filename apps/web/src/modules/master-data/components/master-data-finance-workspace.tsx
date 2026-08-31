'use client';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import {
  ArrowRight,
  Building2,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  CreditCard,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Landmark,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Timer,
  WalletCards,
  Workflow,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
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
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import { masterDataApi, MasterDataApiError } from '../api/client';
import { MasterDataDeleteButton } from './master-data-delete-button';
import {
  getMasterDataDefinition,
  type MasterDataResourceKey,
} from '../model/catalog';
import type { MasterDataSectionDefinition } from '../model/sections';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import {
  MasterDataKpiGrid,
  type MasterDataKpiItem,
} from './master-data-kpi-grid';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataCurrencyForm } from './master-data-currency-form';

type FinanceTab =
  'currencies' | 'approvals' | 'banks' | 'branches' | 'payments';
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';
type RateStatus = 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

interface CurrencyRateRow {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: string;
  rateType: 'BUY' | 'SELL' | 'REFERENCE';
  source: string;
  observedAt: string;
  validFrom: string;
  validTo: string | null;
  status: RateStatus;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  version: number;
  isAuthoritative: false;
}

const tabs: readonly {
  key: FinanceTab;
  label: string;
  resource: MasterDataResourceKey;
  icon: typeof Coins;
}[] = [
  { key: 'currencies', label: 'ارزها', resource: 'currencies', icon: Coins },
  {
    key: 'approvals',
    label: 'گردش تأیید نرخ',
    resource: 'exchange-rates',
    icon: Workflow,
  },
  { key: 'banks', label: 'بانک‌ها', resource: 'banks', icon: Landmark },
  {
    key: 'branches',
    label: 'شعب بانک',
    resource: 'bank-branches',
    icon: Building2,
  },
  {
    key: 'payments',
    label: 'روش پرداخت',
    resource: 'payment-methods',
    icon: WalletCards,
  },
];

const tabCopy: Record<FinanceTab, { title: string; description: string }> = {
  currencies: {
    title: 'ارزها',
    description:
      'تعریف ارزهای ISO-4217؛ با انتخاب هر ارز، نرخ جاری و تاریخچه واقعی آن نمایش داده می‌شود.',
  },
  approvals: {
    title: 'گردش تأیید نرخ',
    description:
      'Maker/Checker برای نرخ‌های پیشنهادی با ثبت دلیل تصمیم، نسخه و Audit واقعی.',
  },
  banks: {
    title: 'بانک‌ها',
    description:
      'بانک‌های مرجع مشترک بین شرکت‌ها؛ حساب، مانده و شبا متعلق به Finance است.',
  },
  branches: {
    title: 'شعب بانک',
    description:
      'تعریف مستقل شعبه با بانک، شهر، نشانی و تلفن عمومی بدون اطلاعات حساب.',
  },
  payments: {
    title: 'روش‌های پرداخت',
    description:
      'تعریف کانال‌های مرجع دریافت و پرداخت؛ پیکربندی درگاه و تراکنش خارج از Master Data است.',
  },
};

function isRateTab(tab: FinanceTab): boolean {
  return tab === 'approvals';
}

function ratePairKey(row: CurrencyRateRow): string {
  return `${row.fromCurrencyId}:${row.toCurrencyId}:${row.rateType}`;
}

function resourceFor(tab: FinanceTab): MasterDataResourceKey {
  return tabs.find((item) => item.key === tab)?.resource ?? 'currencies';
}

function rateRecord(row: CurrencyRateRow): MasterDataRecord {
  return {
    id: row.id,
    resource: 'exchange-rates',
    code: `${row.fromCurrencyCode}/${row.toCurrencyCode}`,
    name: `${row.fromCurrencyCode}/${row.toCurrencyCode} · ${row.source}`,
    status: row.status === 'EXPIRED' ? 'inactive' : 'active',
    attributes: {
      rate: row.rate,
      rateType: row.rateType,
      source: row.source,
      observedAt: row.observedAt,
      validFrom: row.validFrom,
      validTo: row.validTo,
      status: row.status,
      createdByUserId: row.createdByUserId,
      approvedByUserId: row.approvedByUserId,
      approvedAt: row.approvedAt,
      isAuthoritative: false,
    },
    version: row.version,
    createdAt: row.observedAt,
    updatedAt: row.approvedAt ?? row.observedAt,
  };
}

function faDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString('fa-IR') : '—';
}

function rateTypeLabel(value: CurrencyRateRow['rateType']): string {
  return value === 'BUY' ? 'خرید' : value === 'SELL' ? 'فروش' : 'مبنا';
}

function statusLabel(value: RateStatus): string {
  return value === 'DRAFT'
    ? 'پیش‌نویس'
    : value === 'APPROVED'
      ? 'تأییدشده'
      : value === 'REJECTED'
        ? 'ردشده'
        : 'منقضی';
}

function FinanceChart({ rates }: { rates: readonly CurrencyRateRow[] }) {
  const points = useMemo(() => {
    const ordered = [...rates]
      .filter((row) => row.status === 'APPROVED')
      .sort(
        (left, right) =>
          new Date(left.observedAt).getTime() -
          new Date(right.observedAt).getTime(),
      );
    const values = ordered.map((row) => Number(row.rate));
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = maximum - minimum || 1;
    return ordered.map((row, index) => ({
      row,
      x: ordered.length === 1 ? 50 : (index / (ordered.length - 1)) * 100,
      y: 90 - ((Number(row.rate) - minimum) / spread) * 75,
    }));
  }, [rates]);

  if (!points.length)
    return (
      <EmptyState
        description="پس از تأیید نرخ، روند واقعی Backend در این نمودار نمایش داده می‌شود."
        icon={ChartNoAxesCombined}
        title="نرخ تأییدشده‌ای در این بازه نیست"
      />
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-4">
      <svg
        aria-label="نمودار تاریخچه نرخ‌های تأییدشده"
        className="h-64 w-full"
        preserveAspectRatio="none"
        role="img"
        viewBox="0 0 100 100"
      >
        <polyline
          fill="none"
          points={points.map(({ x, y }) => `${x},${y}`).join(' ')}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(({ row, x, y }) => (
          <circle
            className="fill-background stroke-primary"
            cx={x}
            cy={y}
            key={row.id}
            r="1.8"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${row.fromCurrencyCode}/${row.toCurrencyCode} · ${row.rate} · ${faDate(row.observedAt)}`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        Tooltip هر نقطه شامل جفت ارز، نرخ و زمان مشاهده UTC است.
      </p>
    </div>
  );
}

export function MasterDataFinanceWorkspace({
  section,
}: {
  section: MasterDataSectionDefinition;
}) {
  const [tab, setTab] = useState<FinanceTab>('currencies');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [rates, setRates] = useState<readonly CurrencyRateRow[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [rangeDays, setRangeDays] = useState('90');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [latestReferenceUpdatedAt, setLatestReferenceUpdatedAt] = useState<
    string | null
  >(null);
  const [kpiRates, setKpiRates] = useState<readonly CurrencyRateRow[]>([]);
  const [draftRateTotal, setDraftRateTotal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [selected, setSelected] = useState<MasterDataRecord | undefined>();
  const [selectedCurrency, setSelectedCurrency] = useState<
    MasterDataRecord | undefined
  >();
  const [currencyProfileOpen, setCurrencyProfileOpen] = useState(false);
  const [currencyHistoryState, setCurrencyHistoryState] =
    useState<RequestState>('ready');
  const [currencyHistory, setCurrencyHistory] = useState<
    readonly CurrencyRateRow[]
  >([]);
  const [selectedPair, setSelectedPair] = useState('');
  const [audit, setAudit] = useState<readonly Record<string, unknown>[]>([]);
  const [auditRateId, setAuditRateId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const resource = resourceFor(tab);
  const definition = getMasterDataDefinition(resource);
  const copy = tabCopy[tab];

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      if (isRateTab(tab)) {
        const [response, approvedResponse, draftResponse] = await Promise.all([
          masterDataApi.currencyRateHistory({
            search,
            status: 'DRAFT',
            page,
            pageSize: 25,
          }),
          masterDataApi.currencyRateHistory({
            status: 'APPROVED',
            page: 1,
            pageSize: 100,
          }),
          masterDataApi.currencyRateHistory({
            status: 'DRAFT',
            page: 1,
            pageSize: 10,
          }),
        ]);
        setRates(response.data as unknown as readonly CurrencyRateRow[]);
        setKpiRates(
          approvedResponse.data as unknown as readonly CurrencyRateRow[],
        );
        setDraftRateTotal(draftResponse.meta.total);
        setRecords([]);
        setTotal(response.meta.total);
      } else {
        const baseQuery: MasterDataListQuery = {
          search,
          status,
          sortBy: resource === 'payment-methods' ? 'updatedAt' : 'name',
          sortDirection: 'asc' as const,
          page,
          pageSize: 25,
        };
        const [response, activeResponse, latestResponse] = await Promise.all([
          masterDataApi.list(resource as MasterDataResource, baseQuery),
          masterDataApi.list(resource as MasterDataResource, {
            ...baseQuery,
            search: '',
            status: 'active',
            page: 1,
            pageSize: 1,
          }),
          masterDataApi.list(resource as MasterDataResource, {
            search: '',
            status: 'all',
            sortBy: 'updatedAt',
            sortDirection: 'desc',
            page: 1,
            pageSize: 1,
          }),
        ]);
        setRecords(response.data);
        setRates([]);
        setKpiRates([]);
        setActiveTotal(activeResponse.meta.total);
        setLatestReferenceUpdatedAt(latestResponse.data[0]?.updatedAt ?? null);
        setTotal(response.meta.total);
      }
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setRates([]);
      setKpiRates([]);
      setRequestState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [page, resource, search, status, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadCurrencyHistory = useCallback(async () => {
    if (!selectedCurrency) return;
    setCurrencyHistoryState('loading');
    const observedFrom = new Date(
      Date.now() - Number(rangeDays) * 86_400_000,
    ).toISOString();
    const query = {
      observedFrom,
      observedTo: new Date().toISOString(),
      page: 1,
      pageSize: 100,
    } as const;
    try {
      const [asSource, asTarget] = await Promise.all([
        masterDataApi.currencyRateHistory({
          ...query,
          fromCurrencyId: selectedCurrency.id,
        }),
        masterDataApi.currencyRateHistory({
          ...query,
          toCurrencyId: selectedCurrency.id,
        }),
      ]);
      const merged = [
        ...(asSource.data as unknown as readonly CurrencyRateRow[]),
        ...(asTarget.data as unknown as readonly CurrencyRateRow[]),
      ];
      const unique = [
        ...new Map(merged.map((row) => [row.id, row] as const)).values(),
      ].sort(
        (left, right) =>
          new Date(right.observedAt).getTime() -
          new Date(left.observedAt).getTime(),
      );
      setCurrencyHistory(unique);
      setSelectedPair((current) => {
        if (unique.some((row) => ratePairKey(row) === current)) return current;
        const preferred =
          unique.find(
            (row) =>
              row.status === 'APPROVED' &&
              (row.toCurrencyCode === 'IRR' || row.fromCurrencyCode === 'IRR'),
          ) ??
          unique.find((row) => row.status === 'APPROVED') ??
          unique[0];
        return preferred ? ratePairKey(preferred) : '';
      });
      setCurrencyHistoryState('ready');
    } catch (error) {
      setCurrencyHistory([]);
      setCurrencyHistoryState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [rangeDays, selectedCurrency]);

  useEffect(() => {
    if (!currencyProfileOpen) return;
    const timer = window.setTimeout(() => void loadCurrencyHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [currencyProfileOpen, loadCurrencyHistory]);

  const currencyPairs = useMemo(() => {
    const pairs = new Map<string, string>();
    for (const row of currencyHistory)
      pairs.set(
        ratePairKey(row),
        `${row.fromCurrencyCode}/${row.toCurrencyCode} · ${rateTypeLabel(row.rateType)}`,
      );
    return [...pairs.entries()].map(([value, label]) => ({ value, label }));
  }, [currencyHistory]);

  const selectedCurrencyRates = useMemo(
    () => currencyHistory.filter((row) => ratePairKey(row) === selectedPair),
    [currencyHistory, selectedPair],
  );

  function openCurrencyProfile(record: MasterDataRecord) {
    setSelectedCurrency(record);
    setSelectedPair('');
    setAudit([]);
    setAuditRateId(null);
    setCurrencyProfileOpen(true);
  }

  function changeTab(next: FinanceTab) {
    setTab(next);
    setSearch('');
    setStatus('all');
    setPage(1);
    setSelected(undefined);
    setSelectedCurrency(undefined);
    setCurrencyProfileOpen(false);
    setAudit([]);
    setAuditRateId(null);
    setNotice(null);
  }

  async function persist(values: Record<string, string>) {
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(resource, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(`${definition.singularLabel} با موفقیت ویرایش شد.`);
    } else {
      await masterDataApi.create(resource, { values });
      setNotice(`${definition.singularLabel} با موفقیت ایجاد شد.`);
    }
    setFormMode(null);
    await load();
  }

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setNotice('رکورد با موفقیت حذف شد.');
    if ((isRateTab(tab) ? rates.length : records.length) === 1 && page > 1)
      setPage(page - 1);
    else await load();
  }

  async function toggle(record: MasterDataRecord) {
    const next: MasterDataStatus =
      record.status === 'active' ? 'inactive' : 'active';
    try {
      await masterDataApi.setStatus(resource, record.id, next, record.version);
      setNotice(
        `${definition.singularLabel} ${next === 'active' ? 'فعال' : 'غیرفعال'} شد.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  async function decide(row: CurrencyRateRow, action: 'approve' | 'reject') {
    const reason = window.prompt(
      action === 'approve' ? 'دلیل تأیید نرخ:' : 'دلیل رد نرخ:',
    );
    if (!reason?.trim()) return;
    try {
      await masterDataApi.decideCurrencyRate(
        row.id,
        action,
        row.version,
        reason.trim(),
      );
      setNotice(action === 'approve' ? 'نرخ تأیید شد.' : 'نرخ رد شد.');
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'ثبت تصمیم ناموفق بود.',
      );
    }
  }

  async function showAudit(row: CurrencyRateRow) {
    try {
      const response = await masterDataApi.audit('exchange-rates', row.id);
      setAudit(response.data);
      setAuditRateId(row.id);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'دریافت Audit ناموفق بود.',
      );
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: Array.from(
          new Set([
            'code',
            'name',
            ...definition.fields.map((field) => field.key),
            'status',
            'updatedAt',
          ]),
        ),
        locale: 'fa-IR',
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran',
      });
      const url = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'خروجی Excel ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  const todayKey = new Date().toDateString();
  const averageApprovalMinutes = (() => {
    const durations = kpiRates.flatMap((row) =>
      row.approvedAt
        ? [
            Math.max(
              0,
              (new Date(row.approvedAt).getTime() -
                new Date(row.observedAt).getTime()) /
                60_000,
            ),
          ]
        : [],
    );
    if (!durations.length) return '—';
    return `${Math.round(
      durations.reduce((sum, value) => sum + value, 0) / durations.length,
    ).toLocaleString('fa-IR')} دقیقه`;
  })();
  const missingBankDetails = records.filter(
    (row) =>
      tab === 'banks' &&
      (!row.attributes.englishName || !row.attributes.swiftCode),
  ).length;
  const coveredCities = new Set(
    records
      .map((row) => row.attributes.cityName)
      .filter((value): value is string => typeof value === 'string' && !!value),
  ).size;
  const kpis: readonly MasterDataKpiItem[] =
    tab === 'currencies'
      ? [
          { label: 'کل ارزها', value: total, icon: Coins, tone: 'sky' },
          {
            label: 'ارز فعال',
            value: activeTotal,
            icon: CheckCircle2,
            tone: 'emerald',
          },
          {
            label: 'ارز پایه سازمان',
            value: '—',
            icon: Building2,
            tone: 'violet',
            hint: 'پس از اتصال قرارداد Finance',
          },
          {
            label: 'آخرین همگام‌سازی',
            value: latestReferenceUpdatedAt
              ? faDate(latestReferenceUpdatedAt)
              : '—',
            icon: RefreshCw,
            tone: 'amber',
          },
        ]
      : tab === 'approvals'
        ? [
            {
              label: 'در انتظار بررسی',
              value: draftRateTotal,
              icon: Clock3,
              tone: 'amber',
            },
            {
              label: 'تأییدشده امروز',
              value: kpiRates.filter(
                (row) =>
                  row.approvedAt &&
                  new Date(row.approvedAt).toDateString() === todayKey,
              ).length,
              icon: CheckCircle2,
              tone: 'emerald',
            },
            {
              label: 'ردشده امروز',
              value: '—',
              icon: XCircle,
              tone: 'rose',
            },
            {
              label: 'میانگین زمان تأیید',
              value: averageApprovalMinutes,
              icon: Timer,
              tone: 'sky',
            },
          ]
        : tab === 'banks'
          ? [
              {
                label: 'کل بانک‌ها',
                value: total,
                icon: Landmark,
                tone: 'sky',
              },
              {
                label: 'بانک فعال',
                value: activeTotal,
                icon: CheckCircle2,
                tone: 'emerald',
              },
              {
                label: 'حساب‌های متصل',
                value: '—',
                icon: WalletCards,
                tone: 'violet',
                hint: 'در مالکیت Finance',
              },
              {
                label: 'نیازمند تکمیل اطلاعات',
                value: missingBankDetails,
                icon: FilePenLine,
                tone: 'amber',
                hint: 'در صفحه جاری',
              },
            ]
          : tab === 'branches'
            ? [
                {
                  label: 'کل شعب ثبت‌شده',
                  value: total,
                  icon: Building2,
                  tone: 'sky',
                },
                {
                  label: 'شعب فعال',
                  value: activeTotal,
                  icon: CheckCircle2,
                  tone: 'emerald',
                },
                {
                  label: 'شهرهای تحت پوشش',
                  value: coveredCities,
                  icon: MapPin,
                  tone: 'violet',
                  hint: 'در صفحه جاری',
                },
                {
                  label: 'شعب بدون حساب متصل',
                  value: '—',
                  icon: WalletCards,
                  tone: 'amber',
                  hint: 'پس از اتصال قرارداد Finance',
                },
              ]
            : [
                {
                  label: 'روش‌های فعال',
                  value: activeTotal,
                  icon: WalletCards,
                  tone: 'emerald',
                },
                {
                  label: 'تراکنش‌های امروز',
                  value: '—',
                  icon: RefreshCw,
                  tone: 'sky',
                  hint: 'در مالکیت Finance',
                },
                {
                  label: 'درگاه‌های متصل',
                  value: '—',
                  icon: CreditCard,
                  tone: 'violet',
                  hint: 'در مالکیت Finance',
                },
                {
                  label: 'نیازمند پیکربندی',
                  value: '—',
                  icon: Settings2,
                  tone: 'amber',
                  hint: 'پس از اتصال قرارداد Finance',
                },
              ];

  const approvedCurrencyRates = [...selectedCurrencyRates]
    .filter((row) => row.status === 'APPROVED')
    .sort(
      (left, right) =>
        new Date(right.observedAt).getTime() -
        new Date(left.observedAt).getTime(),
    );
  const currentCurrencyRate = approvedCurrencyRates[0];
  const previousCurrencyRate = approvedCurrencyRates[1];
  const currencyRateChange = (() => {
    if (!currentCurrencyRate || !previousCurrencyRate) return '—';
    const previous = Number(previousCurrencyRate.rate);
    if (!Number.isFinite(previous) || previous === 0) return '—';
    const change =
      ((Number(currentCurrencyRate.rate) - previous) / previous) * 100;
    return `${change > 0 ? '+' : ''}${change.toLocaleString('fa-IR', {
      maximumFractionDigits: 2,
    })}٪`;
  })();
  const currencyProfileKpis: readonly MasterDataKpiItem[] = [
    {
      label: 'نرخ جاری تأییدشده',
      value: currentCurrencyRate
        ? Number(currentCurrencyRate.rate).toLocaleString('fa-IR', {
            maximumFractionDigits: 10,
          })
        : '—',
      icon: CircleDollarSign,
      tone: 'sky',
      hint: currentCurrencyRate
        ? `${currentCurrencyRate.fromCurrencyCode}/${currentCurrencyRate.toCurrencyCode} · ${rateTypeLabel(currentCurrencyRate.rateType)}`
        : 'نرخ تأییدشده‌ای ثبت نشده است',
    },
    {
      label: 'تغییر نسبت به نرخ قبل',
      value: currencyRateChange,
      icon: ChartNoAxesCombined,
      tone: 'emerald',
    },
    {
      label: 'آخرین مشاهده',
      value: currentCurrencyRate ? faDate(currentCurrencyRate.observedAt) : '—',
      icon: Clock3,
      tone: 'violet',
    },
    {
      label: 'رکورد تاریخچه در بازه',
      value: selectedCurrencyRates.length,
      icon: Workflow,
      tone: 'amber',
    },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ variant: 'outline' })}
            href="/master-data"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            همه بخش‌ها
          </Link>
        }
        description={section.description}
        title={copy.title}
      />

      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setSelected(undefined);
              setFormMode('create');
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            {tab === 'approvals'
              ? 'درخواست نرخ'
              : `افزودن ${definition.singularLabel}`}
          </Button>
          <Button
            loading={exporting}
            onClick={() => void exportExcel()}
            variant="outline"
          >
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            خروجی اکسل
          </Button>
        </div>
      </div>

      <p className="text-sm leading-7 text-muted-foreground">
        {copy.description}
      </p>

      <Card className="overflow-x-auto p-2">
        <nav
          aria-label="زیرمجموعه‌های مالی و پولی"
          className="flex min-w-max gap-1 rounded-xl bg-primary/5 p-1"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={tab === item.key ? 'page' : undefined}
                className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-background aria-[current=page]:text-primary aria-[current=page]:shadow-sm"
                key={item.key}
                onClick={() => changeTab(item.key)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </Card>

      <MasterDataKpiGrid items={kpis} label={`شاخص‌های ${copy.title}`} />

      <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto]">
        <FormField id="finance-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="finance-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`جست‌وجو در ${copy.title}`}
              value={search}
            />
          </div>
        </FormField>
        {isRateTab(tab) ? (
          <FormField label="وضعیت نرخ">
            <Select disabled value="DRAFT">
              <SelectTrigger aria-label="فیلتر وضعیت نرخ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">پیش‌نویس</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        ) : (
          <FormField label="وضعیت">
            <Select
              onValueChange={(value) => {
                setStatus(value as typeof status);
                setPage(1);
              }}
              value={status}
            >
              <SelectTrigger aria-label="فیلتر وضعیت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="inactive">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}
        <div />
        <Button onClick={() => void load()} variant="ghost">
          <RefreshCw aria-hidden="true" className="size-4" /> تازه‌سازی
        </Button>
      </FilterBar>

      {requestState === 'loading' ? (
        <div className="space-y-3" aria-live="polite">
          {[0, 1, 2].map((item) => (
            <Skeleton className="h-16 w-full" key={item} />
          ))}
        </div>
      ) : requestState === 'forbidden' ? (
        <EmptyState
          description="مجوز master_data.read لازم است."
          icon={Workflow}
          title="دسترسی وجود ندارد"
        />
      ) : requestState === 'error' ? (
        <ErrorState
          action={
            <Button onClick={() => void load()} variant="outline">
              تلاش دوباره
            </Button>
          }
          description="اتصال به Backend مالی و پولی اطلاعات پایه ناموفق بود."
          title="دریافت اطلاعات ناموفق بود"
        />
      ) : isRateTab(tab) ? (
        rates.length ? (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 text-start">جفت ارز</th>
                  <th className="p-4 text-start">نرخ</th>
                  <th className="p-4 text-start">نوع</th>
                  <th className="p-4 text-start">منبع</th>
                  <th className="p-4 text-start">زمان UTC</th>
                  <th className="p-4 text-start">وضعیت</th>
                  <th className="p-4 text-start">مسئول ثبت</th>
                  <th className="p-4 text-start">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((row) => (
                  <tr className="border-t border-border" key={row.id}>
                    <td className="p-4 font-mono" dir="ltr">
                      {row.fromCurrencyCode}/{row.toCurrencyCode}
                    </td>
                    <td className="p-4 font-mono" dir="ltr">
                      {row.rate}
                    </td>
                    <td className="p-4">{rateTypeLabel(row.rateType)}</td>
                    <td className="p-4">{row.source}</td>
                    <td className="p-4">{faDate(row.observedAt)}</td>
                    <td className="p-4">
                      <Badge>{statusLabel(row.status)}</Badge>
                    </td>
                    <td className="p-4 font-mono text-xs" dir="ltr">
                      {row.createdByUserId}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            setSelected(rateRecord(row));
                            setFormMode('view');
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="size-4" /> مشاهده
                        </Button>
                        {row.status === 'DRAFT' ? (
                          <>
                            <MasterDataDeleteButton
                              record={rateRecord(row)}
                              onDeleted={afterDelete}
                            />
                            <Button
                              onClick={() => void decide(row, 'approve')}
                              size="sm"
                              variant="outline"
                            >
                              <CheckCircle2 className="size-4" /> تأیید
                            </Button>
                            <Button
                              onClick={() => void decide(row, 'reject')}
                              size="sm"
                              variant="ghost"
                            >
                              <XCircle className="size-4" /> رد
                            </Button>
                          </>
                        ) : null}
                        <Button
                          onClick={() => void showAudit(row)}
                          size="sm"
                          variant="ghost"
                        >
                          Audit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState
            action={
              <Button onClick={() => setFormMode('create')}>
                ثبت نرخ جدید
              </Button>
            }
            description="در بازه و فیلتر فعلی نرخ واقعی ثبت نشده است؛ Seed نرخ عمداً خالی است."
            icon={ChartNoAxesCombined}
            title="تاریخچه نرخ خالی است"
          />
        )
      ) : records.length ? (
        tab === 'payments' ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {records.map((record) => (
              <Card className="p-5" key={record.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <WalletCards className="size-5" />
                  </span>
                  <Badge>
                    {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </div>
                <h3 className="mt-4 font-black">{record.name}</h3>
                <p className="mt-2 min-h-10 text-xs leading-6 text-muted-foreground">
                  {String(
                    record.attributes.description ?? 'تعریف مرجع روش پرداخت',
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    onClick={() => {
                      setSelected(record);
                      setFormMode('view');
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <Eye className="size-4" /> مشاهده
                  </Button>
                  <Button
                    onClick={() => {
                      setSelected(record);
                      setFormMode('edit');
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <FilePenLine className="size-4" /> ویرایش
                  </Button>
                  <MasterDataDeleteButton
                    record={record}
                    onDeleted={afterDelete}
                  />
                  <Button
                    onClick={() => void toggle(record)}
                    size="sm"
                    variant="ghost"
                  >
                    {record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 text-start">کد</th>
                  <th className="p-4 text-start">نام فارسی</th>
                  <th className="p-4 text-start">نام انگلیسی / مرجع</th>
                  <th className="p-4 text-start">جزئیات</th>
                  <th className="p-4 text-start">وضعیت</th>
                  <th className="p-4 text-start">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr className="border-t border-border" key={record.id}>
                    <td className="p-4 font-mono" dir="ltr">
                      {record.code}
                    </td>
                    <td className="p-4 font-semibold">
                      {tab === 'currencies' ? (
                        <button
                          className="text-start font-semibold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => openCurrencyProfile(record)}
                          type="button"
                        >
                          {record.name}
                        </button>
                      ) : (
                        record.name
                      )}
                    </td>
                    <td className="p-4">
                      {String(
                        record.attributes.englishName ??
                          record.attributes.bankName ??
                          '—',
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {tab === 'currencies'
                        ? `${String(record.attributes.symbol ?? '—')} · ${Number(record.attributes.decimalDigits ?? 0).toLocaleString('fa-IR')} رقم اعشار`
                        : tab === 'banks'
                          ? `${String(record.attributes.countryName ?? '—')} · ${Number(record.attributes.branchCount ?? 0).toLocaleString('fa-IR')} شعبه`
                          : `${String(record.attributes.cityName ?? '—')} · ${String(record.attributes.phone ?? 'بدون تلفن')}`}
                    </td>
                    <td className="p-4">
                      <Badge>
                        {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            if (tab === 'currencies')
                              openCurrencyProfile(record);
                            else {
                              setSelected(record);
                              setFormMode('view');
                            }
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="size-4" /> مشاهده
                        </Button>
                        <Button
                          onClick={() => {
                            setSelected(record);
                            setFormMode('edit');
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <FilePenLine className="size-4" /> ویرایش
                        </Button>
                        <MasterDataDeleteButton
                          record={record}
                          onDeleted={afterDelete}
                        />
                        <Button
                          onClick={() => void toggle(record)}
                          size="sm"
                          variant="ghost"
                        >
                          {record.status === 'active'
                            ? 'غیرفعال‌سازی'
                            : 'فعال‌سازی'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        <EmptyState
          action={
            <Button onClick={() => setFormMode('create')}>
              افزودن {definition.singularLabel}
            </Button>
          }
          description="با فیلتر فعلی رکوردی پیدا نشد."
          icon={Landmark}
          title={`${definition.label} خالی است`}
        />
      )}

      {auditRateId ? (
        <Card className="p-5">
          <h2 className="font-black">Audit Timeline نرخ</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
            {auditRateId}
          </p>
          {audit.length ? (
            <ol className="mt-4 space-y-3 border-r border-border pr-5">
              {audit.map((event, index) => (
                <li
                  className="relative rounded-xl bg-muted/40 p-4"
                  key={String(event.id ?? index)}
                >
                  <span className="absolute -right-[1.45rem] top-5 size-2.5 rounded-full bg-primary" />
                  <p className="font-semibold">
                    {String(event.action ?? 'رویداد Audit')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {faDate(String(event.occurredAt ?? ''))} · نسخه{' '}
                    {String(event.entityVersion ?? '—')}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              رویداد Audit برای این نرخ ثبت نشده است.
            </p>
          )}
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} رکورد`}
        />
        <div className="flex gap-2">
          <Button
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            قبلی
          </Button>
          <Button
            disabled={page * 25 >= total}
            onClick={() => setPage((value) => value + 1)}
            size="sm"
            variant="outline"
          >
            بعدی
          </Button>
        </div>
      </div>

      {formMode && resource === 'currencies' ? (
        <MasterDataCurrencyForm
          key={`currency-${selected?.id ?? 'new'}`}
          {...(selected ? { record: selected } : {})}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onSaved={(record) => {
            if (selectedCurrency?.id === record.id) setSelectedCurrency(record);
            void load();
          }}
        />
      ) : formMode ? (
        <MasterDataLiveForm
          definition={definition}
          key={`${resource}-${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onPersist={persist}
          open
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
      {selectedCurrency ? (
        <MasterDataProfileDialog
          description="نرخ جاری، نمودار و جدول تاریخچه براساس ارز و جفت نرخ انتخاب‌شده از Backend خوانده می‌شود."
          onOpenChange={setCurrencyProfileOpen}
          open={currencyProfileOpen}
          title={`جزئیات ارز ${selectedCurrency.code}`}
        >
          <div className="space-y-5">
            <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['کد ISO-4217', selectedCurrency.code],
                ['نام فارسی', selectedCurrency.name],
                [
                  'نام انگلیسی',
                  String(selectedCurrency.attributes.englishName ?? '—'),
                ],
                [
                  'نماد / اعشار',
                  `${String(selectedCurrency.attributes.symbol ?? '—')} · ${Number(selectedCurrency.attributes.decimalDigits ?? 0).toLocaleString('fa-IR')} رقم`,
                ],
                [
                  'وضعیت ارز',
                  selectedCurrency.status === 'active' ? 'فعال' : 'غیرفعال',
                ],
                ['ارز پایه', 'نامشخص — در انتظار اتصال مالی'],
              ].map(([label, value]) => (
                <dl className="rounded-xl bg-muted/40 p-3" key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-bold">{value}</dd>
                </dl>
              ))}
            </Card>

            <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto_auto]">
              <FormField label="جفت ارز و نوع نرخ">
                <Select
                  disabled={!currencyPairs.length}
                  onValueChange={(value) => {
                    setSelectedPair(value);
                    setAudit([]);
                    setAuditRateId(null);
                  }}
                  value={selectedPair}
                >
                  <SelectTrigger aria-label="انتخاب جفت ارز برای نمودار">
                    <SelectValue placeholder="تاریخچه‌ای ثبت نشده است" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyPairs.map((pair) => (
                      <SelectItem key={pair.value} value={pair.value}>
                        {pair.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="بازه تاریخچه">
                <Select onValueChange={setRangeDays} value={rangeDays}>
                  <SelectTrigger aria-label="انتخاب بازه تاریخچه ارز">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">۳۰ روز اخیر</SelectItem>
                    <SelectItem value="90">۹۰ روز اخیر</SelectItem>
                    <SelectItem value="365">یک سال اخیر</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <Button
                onClick={() => void loadCurrencyHistory()}
                variant="ghost"
              >
                <RefreshCw className="size-4" /> تازه‌سازی
              </Button>
              <Button
                onClick={() => {
                  setCurrencyProfileOpen(false);
                  setSelected(selectedCurrency);
                  setFormMode('edit');
                }}
              >
                <Plus className="size-4" /> ثبت نرخ جدید
              </Button>
            </FilterBar>

            {currencyHistoryState === 'loading' ? (
              <div className="space-y-3" aria-label="در حال دریافت تاریخچه ارز">
                {[0, 1, 2].map((item) => (
                  <Skeleton className="h-20 w-full" key={item} />
                ))}
              </div>
            ) : currencyHistoryState === 'forbidden' ? (
              <EmptyState
                description="مجوز master_data.read برای مشاهده تاریخچه نرخ لازم است."
                icon={Workflow}
                title="دسترسی تاریخچه نرخ وجود ندارد"
              />
            ) : currencyHistoryState === 'error' ? (
              <ErrorState
                action={
                  <Button
                    onClick={() => void loadCurrencyHistory()}
                    variant="outline"
                  >
                    تلاش دوباره
                  </Button>
                }
                description="دریافت نرخ‌های این ارز از Backend ناموفق بود."
                title="تاریخچه ارز دریافت نشد"
              />
            ) : selectedCurrencyRates.length ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-black">نرخ و تاریخچه ارز</h2>
                  <Badge>isAuthoritative=false</Badge>
                </div>
                <MasterDataKpiGrid
                  items={currencyProfileKpis}
                  label={`شاخص‌های نرخ ${selectedCurrency.code}`}
                />
                <FinanceChart rates={selectedCurrencyRates} />
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[62rem] text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="p-4 text-start">جفت ارز</th>
                        <th className="p-4 text-start">نرخ</th>
                        <th className="p-4 text-start">نوع</th>
                        <th className="p-4 text-start">منبع</th>
                        <th className="p-4 text-start">زمان UTC</th>
                        <th className="p-4 text-start">وضعیت</th>
                        <th className="p-4 text-start">مسئول ثبت</th>
                        <th className="p-4 text-start">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCurrencyRates.map((row) => (
                        <tr className="border-t border-border" key={row.id}>
                          <td className="p-4 font-mono" dir="ltr">
                            {row.fromCurrencyCode}/{row.toCurrencyCode}
                          </td>
                          <td className="p-4 font-mono" dir="ltr">
                            {row.rate}
                          </td>
                          <td className="p-4">{rateTypeLabel(row.rateType)}</td>
                          <td className="p-4">{row.source}</td>
                          <td className="p-4">{faDate(row.observedAt)}</td>
                          <td className="p-4">
                            <Badge>{statusLabel(row.status)}</Badge>
                          </td>
                          <td className="p-4 font-mono text-xs" dir="ltr">
                            {row.createdByUserId}
                          </td>
                          <td className="p-4">
                            {row.status === 'DRAFT' ? (
                              <MasterDataDeleteButton
                                record={rateRecord(row)}
                                onDeleted={loadCurrencyHistory}
                              />
                            ) : null}
                            <Button
                              onClick={() => void showAudit(row)}
                              size="sm"
                              variant="ghost"
                            >
                              مشاهده
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                {auditRateId ? (
                  <Card className="p-5">
                    <h3 className="font-black">Audit Timeline نرخ</h3>
                    {audit.length ? (
                      <ol className="mt-4 space-y-3 border-r border-border pr-5">
                        {audit.map((event, index) => (
                          <li
                            className="relative rounded-xl bg-muted/40 p-4"
                            key={String(event.id ?? index)}
                          >
                            <span className="absolute -right-[1.45rem] top-5 size-2.5 rounded-full bg-primary" />
                            <p className="font-semibold">
                              {String(event.action ?? 'رویداد Audit')}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {faDate(String(event.occurredAt ?? ''))} · نسخه{' '}
                              {String(event.entityVersion ?? '—')}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        رویدادی برای نرخ انتخاب‌شده ثبت نشده است.
                      </p>
                    )}
                  </Card>
                ) : null}
              </>
            ) : (
              <EmptyState
                action={
                  <Button
                    onClick={() => {
                      setCurrencyProfileOpen(false);
                      setSelected(selectedCurrency);
                      setFormMode('edit');
                    }}
                  >
                    ثبت نرخ جدید
                  </Button>
                }
                description="برای این ارز در بازه انتخاب‌شده نرخ واقعی ثبت نشده است؛ Seed نرخ عمداً خالی است."
                icon={ChartNoAxesCombined}
                title="تاریخچه نرخ این ارز خالی است"
              />
            )}
          </div>
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
