'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  Clock3,
  Database,
  GraduationCap,
  Globe2,
  Info,
  Landmark,
  Network,
  Plane,
  Settings2,
  ShoppingCart,
  UsersRound,
  Wallet,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Badge, Card } from '@/components/ui/surfaces';
import {
  catalogueSystems,
  domainLabels,
  type IntegrationSection,
} from '../model';
import {
  metricDetails,
  metricState,
  metricTitles,
  periodLabel,
  periodRange,
  validRange,
  type MetricKey,
  type PeriodKey,
} from '../dashboard-model';
import styles from './brands-dashboard.module.css';
import { integrationsApi, IntegrationsApiError } from '../api/client';
import { ExternalFields } from './niyayesh-data';
import { Alert } from '@/components/ui/surfaces';
import {
  reportMetricText,
  reportCount,
  scopedSiteReport,
  type SiteReportResult,
} from '../report-model';
import { SiteTrend, SiteVisits, SiteActivity } from './site-report';

const palettes = ['sand', 'blue', 'violet', 'teal'] as const;
const symbols = [Landmark, Plane, Wallet, Globe2];
const metrics = ['sales', 'orders', 'users', 'pending'] as const;
const metricIcons = {
  sales: BarChart3,
  orders: ShoppingCart,
  users: UsersRound,
  pending: Clock3,
};
const periods: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'امروز' },
  { key: 'week', label: '۷ روز' },
  { key: 'month', label: '۳۰ روز' },
  { key: 'current', label: 'ماه جاری' },
  { key: 'custom', label: 'سفارشی' },
];

function SystemSymbol({
  system,
  index = 0,
}: {
  system: IntegrationSystemConfigV1;
  index?: number;
}) {
  const Icon =
    system.businessDomain === 'EDUCATION'
      ? GraduationCap
      : symbols[index % symbols.length]!;
  return (
    <span
      className={`${styles.symbol} ${styles[palettes[index % palettes.length]!]}`}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

function PanelTitle({
  children,
  icon,
  action,
}: {
  children: ReactNode;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.panelTitle}>
      <h2>
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function BrandsDashboard({
  data,
  onOpen,
  onSection,
  onManage,
  onCreate,
  allowedSections,
}: {
  data: IntegrationRegistryV1;
  onOpen: (id: string) => void;
  onSection: (section: IntegrationSection) => void;
  onManage: () => void;
  onCreate?: () => void;
  allowedSections?: readonly IntegrationSection[];
}) {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [range, setRange] = useState(() => periodRange('month'));
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [trend, setTrend] = useState('sales');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const systems = catalogueSystems(data, undefined, true);
  const rangeValid = validRange(range.from, range.to);
  const label = periodLabel(range.from, range.to);
  const [siteResults, setSiteResults] = useState<{
    scope: string;
    results: Record<string, SiteReportResult>;
  }>({ scope: '', results: {} });
  const [selectedSite, setSelectedSite] = useState('');
  const siteIds = systems.map((system) => system.id).join(',');
  const scope = `${data.branchId}:${range.from}:${range.to}:${siteIds}`;
  const results = siteResults.scope === scope ? siteResults.results : {};
  const activeId = systems.some((system) => system.id === selectedSite)
    ? selectedSite
    : (systems.find((system) => results[system.id]?.report)?.id ??
      systems[0]?.id ??
      '');
  const activeSite = systems.find((system) => system.id === activeId);
  const connected = scopedSiteReport(
    results[activeId],
    activeId,
    range.from,
    range.to,
  );
  const reportError =
    results[activeId]?.state === 'error' ||
    results[activeId]?.state === 'forbidden'
      ? results[activeId]?.message
      : '';
  function siteReport(id: string) {
    return scopedSiteReport(results[id], id, range.from, range.to);
  }

  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<
    { externalId: string; data: Record<string, unknown> | null }[]
  >([]);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const detailGeneration = useRef(0);
  function value(system: IntegrationSystemConfigV1, key: MetricKey) {
    if (key === 'sales' && system.businessDomain !== 'TRAVEL') return 'نامرتبط';
    const report = siteReport(system.id);
    return report ? reportMetricText(report, key) : metricState(system, key);
  }
  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (control.signal.aborted) return;
      detailGeneration.current++;
      setMetric(null);
      setRows([]);
      setDetailBusy(false);
      setSiteResults({ scope, results: {} });
      setLoading(true);
      if (!rangeValid) {
        setLoading(false);
        return;
      }
      const entries = await Promise.all(
        siteIds
          .split(',')
          .filter(Boolean)
          .map(async (id) => {
            try {
              const report = await integrationsApi.niyayeshReport(
                data.branchId,
                range.from,
                range.to,
                control.signal,
                id,
              );
              if (
                report.registrySystemId !== id ||
                report.from !== range.from ||
                report.to !== range.to
              )
                throw new Error('پاسخ گزارش با سایت انتخاب‌شده مطابقت ندارد.');
              return [id, { report, state: 'available' }] as const;
            } catch (error) {
              const status =
                error instanceof IntegrationsApiError ? error.status : 0;
              return [
                id,
                {
                  report: null,
                  state:
                    status === 404
                      ? 'unconfigured'
                      : status === 403
                        ? 'forbidden'
                        : 'error',
                  message:
                    error instanceof Error
                      ? error.message
                      : 'دریافت گزارش انجام نشد.',
                },
              ] as const;
            }
          }),
      );
      if (!control.signal.aborted) {
        setSiteResults({ scope, results: Object.fromEntries(entries) });
        setLoading(false);
      }
    })();
    return () => control.abort();
  }, [
    data.branchId,
    range.from,
    range.to,
    rangeValid,
    revision,
    siteIds,
    scope,
  ]);
  async function loadDetails(key: MetricKey, after = 0) {
    if (!connected) return;
    const generation = ++detailGeneration.current;
    setDetailBusy(true);
    setDetailError('');
    if (!after) setRows([]);
    try {
      const result = await integrationsApi.niyayeshResources(
        data.branchId,
        key === 'users' ? 'customer-accounts' : 'customer-orders',
        after,
        undefined,
        undefined,
        { metric: key, from: range.from, to: range.to, systemId: activeId },
      );
      if (generation !== detailGeneration.current) return;
      setRows((old) => [...(after ? old : []), ...result.items]);
      setCursor(result.nextId);
      setHasMore(result.hasMore);
    } catch (error) {
      if (generation !== detailGeneration.current) return;
      setDetailError(
        error instanceof Error ? error.message : 'دریافت جزئیات انجام نشد.',
      );
    } finally {
      if (generation === detailGeneration.current) setDetailBusy(false);
    }
  }

  function selectPeriod(next: PeriodKey) {
    setPeriod(next);
    if (next !== 'custom') setRange(periodRange(next));
  }
  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>مدیریت و پایش یکپارچه مجموعه</p>
          <h2>برندها و سامانه‌ها</h2>
        </div>
        <div className={styles.periods} aria-label="بازه گزارش">
          {periods.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={period === item.key ? 'primary' : 'outline'}
              aria-pressed={period === item.key}
              onClick={() => selectPeriod(item.key)}
            >
              {item.key === 'custom' ? (
                <CalendarDays className="size-4" />
              ) : null}
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {period === 'custom' ? (
        <div className={styles.dateRange}>
          <label>
            از تاریخ
            <DatePicker
              aria-label="از تاریخ گزارش"
              value={range.from}
              onChange={(from) => setRange((current) => ({ ...current, from }))}
            />
          </label>
          <label>
            تا تاریخ
            <DatePicker
              aria-label="تا تاریخ گزارش"
              value={range.to}
              onChange={(to) => setRange((current) => ({ ...current, to }))}
            />
          </label>
          {!rangeValid ? (
            <p role="alert">تاریخ پایان باید برابر یا پس از تاریخ شروع باشد.</p>
          ) : null}
        </div>
      ) : null}
      {reportError ? (
        <Alert
          tone="error"
          title="گزارش سایت در دسترس نیست"
          description={reportError}
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <label className="grid min-w-56 gap-2 text-sm font-semibold">
          گزارش سایت
          <NativeSearchSelect
            aria-label="سایت گزارش"
            value={activeId}
            onChange={(event) => {
              detailGeneration.current++;
              setSelectedSite(event.target.value);
              setMetric(null);
              setRows([]);
              setHasMore(false);
              setDetailBusy(false);
            }}
          >
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            {loading
              ? 'دریافت گزارش…'
              : connected
                ? connected.environment === 'LOCAL'
                  ? 'متصل · نسخه محلی'
                  : 'متصل'
                : results[activeId]?.state === 'forbidden'
                  ? 'بدون دسترسی'
                  : results[activeId]?.state === 'error'
                    ? 'خطای اتصال'
                    : 'آماده اتصال'}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            به‌روزرسانی
          </Button>
        </div>
      </div>
      <Card className={styles.systemPanel}>
        <PanelTitle
          icon={<Database />}
          action={
            <Button size="sm" variant="ghost" onClick={onManage}>
              <Settings2 className="size-4" />
              مدیریت فهرست
            </Button>
          }
        >
          سامانه‌های مجموعه
        </PanelTitle>
        <p className={styles.caption}>
          هر برند می‌تواند چند سامانه داشته باشد؛ وضعیت اتصال مستقل از وضعیت
          فهرست است.
        </p>
        {systems.length ? (
          <div className={styles.systemGrid}>
            {systems.map((system, index) => (
              <article key={system.id} className={styles.systemCard}>
                <div className={styles.systemTop}>
                  <SystemSymbol system={system} index={index} />
                  <div>
                    <h3>{system.name}</h3>
                    <p>
                      {system.kind} · {domainLabels[system.businessDomain]}
                    </p>
                  </div>
                  <span className={styles.ready}>
                    <span />
                    {siteReport(system.id)
                      ? 'متصل به منبع گزارش'
                      : 'آماده اتصال'}
                  </span>
                </div>
                <div className={styles.miniMetrics}>
                  <div>
                    <strong>
                      {siteReport(system.id)
                        ? reportCount(
                            siteReport(system.id)?.totals['customer-accounts'],
                          )
                        : '—'}
                    </strong>
                    <span>کل کاربران</span>
                  </div>
                  <div>
                    <strong>{value(system, 'orders')}</strong>
                    <span>
                      {system.businessDomain === 'EDUCATION'
                        ? 'پرونده‌ها'
                        : 'سفارش‌ها'}
                    </span>
                  </div>
                  <div>
                    <strong>{value(system, 'sales')}</strong>
                    <span>فروش سفر</span>
                  </div>
                </div>
                <p className={styles.cardNote}>
                  {siteReport(system.id)
                    ? `تورهای ثبت‌شده: ${reportCount(siteReport(system.id)?.totals.tours)} · هتل‌ها: ${reportCount(siteReport(system.id)?.totals.hotels)} · ${label}`
                    : 'داده عملیاتی هنوز دریافت نشده است'}
                </p>
                <button
                  className={styles.manageButton}
                  onClick={() => onOpen(system.id)}
                >
                  مدیریت سامانه
                  <ArrowLeft className="size-4" />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <Database />
            <h3>فهرست سامانه‌ها آماده تکمیل است</h3>
            <p>
              سایت خود را مستقیم ثبت کنید؛ می‌توانید اطلاعات اتصال را بعداً
              تکمیل کنید.
            </p>
            {onCreate ? (
              <Button onClick={onCreate}>ثبت اولین سایت</Button>
            ) : null}
          </div>
        )}
        <div className={styles.catalogueSummary}>
          <span>
            {data.initialized
              ? data.counts?.brands.toLocaleString('fa-IR')
              : '—'}{' '}
            برند در فهرست
          </span>
          <span>
            {data.initialized
              ? data.counts?.systems.toLocaleString('fa-IR')
              : '—'}{' '}
            سامانه در فهرست
          </span>
          <button
            disabled={
              allowedSections && !allowedSections.includes('connections')
            }
            onClick={() => onSection('connections')}
          >
            بررسی اتصال‌ها
            <ChevronLeft className="size-3" />
          </button>
        </div>
      </Card>
      <h3 className="text-sm font-semibold">
        آمار {activeSite?.name ?? 'سایت انتخاب‌شده'}
      </h3>
      <div className={styles.kpiGrid}>
        {metrics.map((key) => {
          const Icon = metricIcons[key];
          return (
            <button
              key={key}
              disabled={!rangeValid}
              className={`${styles.kpi} ${styles[key]}`}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setMetric(key);
                setRows([]);
                setDetailError('');
                setHasMore(false);
              }}
              aria-label={metricDetails[key]}
            >
              <div>
                <h3>{metricTitles[key]}</h3>
                <strong>
                  {connected
                    ? activeSite?.businessDomain !== 'TRAVEL' && key === 'sales'
                      ? 'نامرتبط'
                      : reportMetricText(connected, key)
                    : loading
                      ? 'در حال دریافت…'
                      : 'داده موجود نیست'}
                </strong>
                <span>
                  مشاهده جزئیات سایت
                  <ChevronLeft className="size-3" />
                </span>
              </div>
              <span className={styles.kpiIcon}>
                <Icon />
              </span>
            </button>
          );
        })}
      </div>
      <p className={styles.info}>
        <Info />
        آمار و جزئیات مربوط به {activeSite?.name ?? 'سایت انتخاب‌شده'} در بازهٔ
        انتخابی است.
      </p>
      <SiteVisits
        report={connected}
        label={label}
        siteName={activeSite?.name ?? 'سایت انتخاب‌شده'}
        loading={loading}
        state={results[activeId]?.state}
      />
      <div className={styles.middleGrid}>
        <Card className={styles.panel}>
          <PanelTitle
            icon={<Zap />}
            action={
              <button
                className={styles.textButton}
                disabled={
                  allowedSections && !allowedSections.includes('connections')
                }
                onClick={() => onSection('connections')}
              >
                بررسی آماده‌سازی
              </button>
            }
          >
            عملیات نیازمند اقدام
          </PanelTitle>
          <div className={styles.actionRow}>
            <span className={`${styles.symbol} ${styles.sand}`}>
              <Clock3 />
            </span>
            <div>
              <h3>تکمیل اتصال سامانه‌ها</h3>
              <p>مستندات API و دسترسی معتبر مورد نیاز است</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="مشاهده اتصال‌های منتظر آماده‌سازی"
              disabled={
                allowedSections && !allowedSections.includes('connections')
              }
              onClick={() => onSection('connections')}
            >
              {data.counts?.awaitingConnection.toLocaleString('fa-IR') ?? '—'}
              <ChevronLeft className="size-4" />
            </Button>
          </div>
          <div className={styles.operationEmpty}>
            <h3>کارتابل عملیات کسب‌وکار</h3>
            <p>
              تأیید مالی، رزرو و پیگیری پرونده‌ها پس از اتصال منبع مجاز، با
              ارجاع به واحد مسئول نمایش داده می‌شوند.
            </p>
            {connected ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMetric('pending');
                  setRows([]);
                  setHasMore(false);
                }}
              >
                مشاهده {reportMetricText(connected, 'pending')} سفارش در انتظار
                خرید
              </Button>
            ) : (
              <Badge>داده موجود نیست</Badge>
            )}
          </div>
        </Card>
        <Card className={styles.panel}>
          <PanelTitle
            icon={<ChartNoAxesCombined />}
            action={
              <NativeSearchSelect
                aria-label="شاخص روند"
                value={trend}
                onChange={(event) => setTrend(event.target.value)}
              >
                <option value="sales">تعداد سفارش‌ها</option>
                <option value="users">کاربران جدید</option>
              </NativeSearchSelect>
            }
          >
            روند {activeSite?.name}
          </PanelTitle>
          <p className={styles.caption}>{label}</p>
          <SiteTrend
            report={connected}
            metric={trend === 'users' ? 'users' : 'orders'}
          />
        </Card>
      </div>
      <div className={styles.bottomGrid}>
        <Card className={styles.panel}>
          <PanelTitle icon={<Network />}>جریان یکپارچه در ERP</PanelTitle>
          <p className={styles.caption}>
            مسیر مسئولیت؛ اجرای خودکار هنوز متصل نیست
          </p>
          <div className={styles.flows}>
            {systems.map((system, index) => (
              <button key={system.id} onClick={() => onOpen(system.id)}>
                <SystemSymbol system={system} index={index} />
                <span>{system.name}</span>
                <ArrowLeft />
                <small>
                  {system.businessDomain === 'TRAVEL'
                    ? 'فروش و رزرواسیون'
                    : system.businessDomain === 'EDUCATION'
                      ? 'آموزش و مشاوره'
                      : 'واحد مسئول'}
                </small>
              </button>
            ))}
          </div>
          {!systems.length ? (
            <p className={styles.caption}>ابتدا سامانه‌ای ثبت کنید.</p>
          ) : null}
          <button
            className={styles.textButton}
            disabled={allowedSections && !allowedSections.includes('mapping')}
            onClick={() => onSection('mapping')}
          >
            مشاهده نگاشت و گردش داده
            <ChevronLeft className="size-3" />
          </button>
        </Card>
        <Card className={styles.panel}>
          <PanelTitle icon={<Clock3 />}>
            فعالیت‌های {activeSite?.name}
          </PanelTitle>
          <SiteActivity
            report={connected}
            siteName={activeSite?.name ?? ''}
            loading={loading}
          />
          <button
            className={styles.textButton}
            disabled={!activeId}
            onClick={() => onOpen(activeId)}
          >
            مدیریت این سایت
            <ChevronLeft className="size-3" />
          </button>
        </Card>
        <Card className={styles.panel}>
          <PanelTitle icon={<BarChart3 />}>مقایسه عملکرد سامانه‌ها</PanelTitle>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>سامانه</th>
                  <th>کاربران</th>
                  <th>فروش سفر</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {systems.map((system) => (
                  <tr key={system.id}>
                    <th>
                      <button
                        className={styles.nameButton}
                        onClick={() => onOpen(system.id)}
                      >
                        {system.name}
                      </button>
                    </th>
                    <td>
                      {siteReport(system.id)
                        ? reportCount(
                            siteReport(system.id)?.totals['customer-accounts'],
                          )
                        : '—'}
                    </td>
                    <td>{value(system, 'sales')}</td>
                    <td>
                      <span className={styles.ready}>
                        {siteReport(system.id) ? 'گزارش متصل' : 'آماده اتصال'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.caption}>
            مبالغ فقط با ارز مشخص و منبع معتبر قابل مقایسه‌اند.
          </p>
        </Card>
      </div>
      <Dialog
        open={metric !== null}
        onOpenChange={(open) => {
          if (!open) setMetric(null);
        }}
      >
        <DialogContent
          dir="rtl"
          className={styles.modal}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          {metric ? (
            <>
              <div className={styles.modalTitle}>
                <span className={`${styles.symbol} ${styles.blue}`}>
                  {(() => {
                    const Icon = metricIcons[metric];
                    return <Icon />;
                  })()}
                </span>
                <DialogTitle>{metricDetails[metric]}</DialogTitle>
              </div>
              <DialogDescription>
                مقایسه سایت‌ها در بازهٔ انتخابی؛ جزئیات رکوردها برای{' '}
                {activeSite?.name} نمایش داده می‌شود.
              </DialogDescription>
              <div className={styles.rangeBadge}>
                <CalendarDays className="size-4" />
                {label}
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>سامانه</th>
                      <th>
                        {metric === 'pending' ? 'مسئول رسیدگی' : 'حوزه فعالیت'}
                      </th>
                      <th>{metricTitles[metric]}</th>
                      {metric === 'sales' ? <th>سفارش‌ها</th> : null}
                      <th>وضعیت گزارش</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systems.map((system, index) => (
                      <tr key={system.id}>
                        <th>
                          <span className={styles.tableSystem}>
                            <SystemSymbol system={system} index={index} />
                            {system.name}
                          </span>
                        </th>
                        <td>
                          {metric === 'pending'
                            ? 'پنل سایت'
                            : `${domainLabels[system.businessDomain]} · ${system.kind}`}
                        </td>
                        <td>{value(system, metric)}</td>
                        {metric === 'sales' ? (
                          <td>
                            {siteReport(system.id)
                              ? reportCount(
                                  siteReport(system.id)?.metrics.sales?.value,
                                )
                              : 'داده موجود نیست'}
                          </td>
                        ) : null}
                        <td>
                          {metricState(system, metric) === 'نامرتبط'
                            ? 'نامرتبط'
                            : siteReport(system.id)
                              ? 'متصل'
                              : results[system.id]?.state === 'forbidden'
                                ? 'بدون دسترسی'
                                : 'آماده اتصال'}
                        </td>
                      </tr>
                    ))}
                    {!systems.length ? (
                      <tr>
                        <td colSpan={metric === 'sales' ? 5 : 4}>
                          سامانه‌ای در فهرست نیست.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>
                        {activeSite?.name}: {metricTitles[metric]}
                      </th>
                      <td colSpan={metric === 'sales' ? 3 : 2}>
                        {connected
                          ? reportMetricText(connected, metric)
                          : 'داده موجود نیست'}{' '}
                        · سایت انتخاب‌شده
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {connected && connected.metrics[metric]?.value !== null ? (
                <div className="grid gap-3">
                  <Button
                    disabled={detailBusy}
                    onClick={() => void loadDetails(metric)}
                  >
                    خواندن رکوردهای این شاخص از سایت
                  </Button>
                  {detailError ? (
                    <Alert
                      tone="error"
                      title="جزئیات دریافت نشد"
                      description={detailError}
                    />
                  ) : null}
                  {detailBusy ? <p role="status">در حال خواندن…</p> : null}
                  {rows.map((row) => (
                    <details
                      key={row.externalId}
                      className="rounded border border-border p-3"
                    >
                      <summary>رکورد {row.externalId}</summary>
                      <ExternalFields value={row.data} />
                    </details>
                  ))}
                  {hasMore ? (
                    <Button
                      disabled={detailBusy}
                      onClick={() => void loadDetails(metric, cursor)}
                    >
                      رکوردهای بیشتر
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <p className={styles.modalNote}>
                <Info />
                {metric === 'sales'
                  ? 'جهان آکادمی و سایر سامانه‌های غیرسفر در فروش مستقیم سفر لحاظ نمی‌شوند. جمع ارزهای متفاوت بدون مبنای تبدیل انجام نمی‌شود.'
                  : metric === 'pending'
                    ? 'آماده‌سازی اتصال با کارتابل کسب‌وکار متفاوت است. تأیید نهایی هر عملیات با ماژول مسئول است.'
                    : 'سامانه‌ها فقط داده منتسب به خود را ارائه می‌کنند؛ هویت مشتری و حساب کاربر توسط ماژول مسئول مدیریت می‌شود.'}
              </p>
              <div className={styles.modalFooter}>
                <Button variant="outline" onClick={() => setMetric(null)}>
                  بستن
                </Button>
                <Button
                  disabled={
                    allowedSections && !allowedSections.includes('connections')
                  }
                  onClick={() => {
                    setMetric(null);
                    onSection('connections');
                  }}
                >
                  بررسی اتصال منابع
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
