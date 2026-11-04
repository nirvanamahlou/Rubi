'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  Plane,
  Settings2,
  ShoppingCart,
  UsersRound,
  Wallet,
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
import { Card } from '@/components/ui/surfaces';
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
  aggregateSiteMetric,
  type SiteReportResult,
} from '../report-model';
import { SiteTrackingDialog } from './site-tracking-dialog';
import { isGhestirooSystem } from '../system-connector';
import { SiteTrend, SiteVisits } from './site-report';

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
  const [trend, setTrend] = useState('orders');
  const [trendSite, setTrendSite] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const systems = useMemo(
    () => catalogueSystems(data, undefined, true),
    [data],
  );
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
  const activeConnector =
    activeSite && isGhestirooSystem(activeSite, data)
      ? 'ghestiroo'
      : 'niyayesh';
  const connected = scopedSiteReport(
    results[activeId],
    activeId,
    range.from,
    range.to,
  );
  const trendId = systems.some((system) => system.id === trendSite)
    ? trendSite
    : (systems.find((system) => results[system.id]?.report)?.id ??
      systems[0]?.id ??
      '');
  function siteReport(id: string) {
    return scopedSiteReport(results[id], id, range.from, range.to);
  }
  function connectionLabel(id: string, connectedLabel = 'متصل') {
    if (siteReport(id)) return connectedLabel;
    if (loading) return 'دریافت گزارش…';
    return results[id]?.state === 'forbidden'
      ? 'بدون دسترسی'
      : results[id]?.state === 'error'
        ? 'خطای اتصال'
        : 'آماده اتصال';
  }

  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<
    { externalId: string; data: Record<string, unknown> | null }[]
  >([]);
  const [cursor, setCursor] = useState<string | number>(0);
  const [hasMore, setHasMore] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const detailGeneration = useRef(0);
  function value(system: IntegrationSystemConfigV1, key: MetricKey) {
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
              const selectedSystem = systems.find(
                (system) => system.id === id,
              )!;
              const report = await integrationsApi.siteReport(
                data.branchId,
                range.from,
                range.to,
                control.signal,
                id,
                isGhestirooSystem(selectedSystem, data)
                  ? 'ghestiroo'
                  : 'niyayesh',
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
    data,
    systems,
  ]);
  const loadDetails = useCallback(
    async (key: MetricKey, after: string | number = 0) => {
      if (
        !connected ||
        connected.metrics[key]?.state !== 'AVAILABLE' ||
        connected.metrics[key]?.value === null
      )
        return;
      const generation = ++detailGeneration.current;
      setDetailBusy(true);
      setDetailError('');
      if (!after) setRows([]);
      try {
        const result = await integrationsApi.siteReportDetails(
          data.branchId,
          activeId,
          activeConnector,
          {
            metric: key,
            from: range.from,
            to: range.to,
            after,
          },
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
    },
    [
      connected,
      data.branchId,
      activeId,
      activeConnector,
      range.from,
      range.to,
      setRows,
      setHasMore,
      setCursor,
      setDetailBusy,
      setDetailError,
    ],
  );
  useEffect(() => {
    const state = detailGeneration;
    const timer = window.setTimeout(() => {
      if (metric && connected) void loadDetails(metric);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      state.current++;
    };
  }, [metric, connected, loadDetails]);

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
      <div className={styles.dashboardTools}>
        <span className={styles.caption}>{label}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !rangeValid}
          onClick={() => setRevision((v) => v + 1)}
        >
          به‌روزرسانی گزارش‌ها
        </Button>
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
                    {connectionLabel(system.id, 'متصل به منبع گزارش')}
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
      <div className={styles.kpiGrid} aria-label="آمار مجموع سایت‌ها">
        {metrics.map((key) => {
          const Icon = metricIcons[key];
          const summary = aggregateSiteMetric(
            systems.map((system) => system.id),
            results,
            range.from,
            range.to,
            key,
          );
          return (
            <button
              key={key}
              disabled={!rangeValid || loading}
              className={`${styles.kpi} ${styles[key]}`}
              aria-label={metricDetails[key]}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setMetric(key);
                setRows([]);
                setDetailError('');
                setHasMore(false);
              }}
            >
              <div>
                <h3>{metricTitles[key]}</h3>
                <strong>{loading ? 'در حال دریافت…' : summary.text}</strong>
                {!loading && summary.covered > 0 && !summary.complete ? (
                  <small className={styles.coverage}>
                    گزارش {reportCount(summary.covered)} از{' '}
                    {reportCount(summary.total)} سایت
                  </small>
                ) : null}
                <span>
                  مشاهده جزئیات
                  <ChevronLeft className="size-3" />
                </span>
              </div>
              <span className={styles.kpiIcon}>
                <Icon aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
      <SiteTrackingDialog
        key={`${data.branchId}:${siteIds}`}
        registry={data}
        systems={systems}
      />
      <section
        className={styles.visitsGrid}
        aria-label="بازدید سایت‌ها در بازه انتخابی"
      >
        {systems.map((system) => (
          <SiteVisits
            key={system.id}
            compact
            report={siteReport(system.id)}
            label={label}
            siteName={system.name}
            loading={loading}
            state={results[system.id]?.state}
          />
        ))}
      </section>
      <Card className={styles.panel}>
        <PanelTitle icon={<ChartNoAxesCombined />}>روند سایت‌ها</PanelTitle>
        <div className={styles.trendControls}>
          <label className={styles.sitePicker}>
            سایت
            <NativeSearchSelect
              aria-label="سایت نمودار روند"
              value={trendId}
              disabled={!systems.length}
              onChange={(event) => setTrendSite(event.target.value)}
            >
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
          <label className={styles.sitePicker}>
            شاخص
            <NativeSearchSelect
              aria-label="شاخص روند"
              value={trend}
              onChange={(event) => setTrend(event.target.value)}
            >
              <option value="orders">تعداد سفارش‌ها</option>
              <option value="users">کاربران جدید</option>
            </NativeSearchSelect>
          </label>
          <span className={styles.caption}>{label}</span>
        </div>
        {loading ? (
          <p role="status" className={styles.caption}>
            در حال دریافت…
          </p>
        ) : (
          <SiteTrend report={siteReport(trendId)} metric={trend} />
        )}
      </Card>
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
              <DialogTitle className="text-lg font-semibold">
                {metricDetails[metric]}
              </DialogTitle>
              <DialogDescription>
                مجموع سایت‌ها در بازهٔ انتخابی و سهم هر سایت
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
                        <td>{value(system, metric)}</td>
                        {metric === 'sales' ? (
                          <td>
                            {siteReport(system.id)
                              ? reportCount(
                                  siteReport(system.id)?.metrics.orders?.value,
                                )
                              : 'داده موجود نیست'}
                          </td>
                        ) : null}
                        <td>{connectionLabel(system.id)}</td>
                      </tr>
                    ))}
                    {!systems.length ? (
                      <tr>
                        <td colSpan={metric === 'sales' ? 4 : 3}>
                          سامانه‌ای در فهرست نیست.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>مجموع سایت‌ها</th>
                      <td colSpan={metric === 'sales' ? 3 : 2}>
                        {
                          aggregateSiteMetric(
                            systems.map((system) => system.id),
                            results,
                            range.from,
                            range.to,
                            metric,
                          ).text
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <label className={styles.sitePicker}>
                جزئیات رکوردهای سایت
                <NativeSearchSelect
                  aria-label="سایت جزئیات شاخص"
                  value={activeId}
                  disabled={!systems.length}
                  onChange={(event) => {
                    detailGeneration.current++;
                    setSelectedSite(event.target.value);
                    setRows([]);
                    setHasMore(false);
                    setDetailError('');
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
              {connected?.definitions?.[metric] ? (
                <p className={styles.caption}>
                  {connected.definitions[metric]}
                </p>
              ) : null}
              {connected?.warnings?.map((warning) => (
                <Alert
                  key={warning}
                  title="محدودیت داده تاریخی"
                  description={warning}
                />
              ))}
              {connected &&
              connected.metrics[metric]?.state === 'AVAILABLE' &&
              connected.metrics[metric]?.value !== null ? (
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
                  {!detailBusy && !detailError && rows.length === 0 ? (
                    <p>رکوردی برای این شاخص ثبت نشده است.</p>
                  ) : null}
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
              ) : (
                <p role="status" className={styles.caption}>
                  {results[activeId]?.message ??
                    'گزارش این شاخص برای سایت انتخاب‌شده در دسترس نیست.'}
                </p>
              )}
              <p className={styles.modalNote}>
                <Info />
                {metric === 'sales'
                  ? 'مبلغ هر ارز جداگانه جمع می‌شود؛ سایت‌های بدون گزارش یا مبلغ معتبر در جمع لحاظ نمی‌شوند.'
                  : 'جمع رکوردهای هر سایت در بازهٔ انتخابی است؛ سایت‌های بدون گزارش یا مجوز در جمع لحاظ نمی‌شوند.'}
              </p>
              <div className={styles.modalFooter}>
                <Button
                  variant="outline"
                  disabled={!activeId}
                  onClick={() => {
                    setMetric(null);
                    onOpen(activeId);
                  }}
                >
                  مدیریت این سایت
                </Button>
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
