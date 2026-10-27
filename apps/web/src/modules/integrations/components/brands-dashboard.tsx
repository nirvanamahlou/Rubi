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
import { integrationsApi, type SiteReport } from '../api/client';
import { ExternalFields } from './niyayesh-data';
import { Alert } from '@/components/ui/surfaces';
import { reportMetricText, reportCount } from '../report-model';
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
  const [trend, setTrend] = useState('sales');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const systems = catalogueSystems(data, undefined, true);
  const rangeValid = validRange(range.from, range.to);
  const label = periodLabel(range.from, range.to);
  const [report, setReport] = useState<SiteReport | null>(null);
  const [reportError, setReportError] = useState('');
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
  const connected =
    report && systems.some((system) => system.id === report.registrySystemId)
      ? report
      : null;
  function value(system: IntegrationSystemConfigV1, key: MetricKey) {
    if (key === 'sales' && system.businessDomain !== 'TRAVEL') return 'نامرتبط';
    return system.id === connected?.registrySystemId
      ? reportMetricText(connected, key)
      : metricState(system, key);
  }
  useEffect(() => {
    const control = new AbortController();
    void (async () => {
      await Promise.resolve();
      detailGeneration.current++;
      setMetric(null);
      setRows([]);
      setDetailBusy(false);
      setReport(null);
      setReportError('');
      setLoading(true);
      if (!rangeValid) {
        setLoading(false);
        return;
      }
      try {
        const result = await integrationsApi.niyayeshReport(
          data.branchId,
          range.from,
          range.to,
          control.signal,
        );
        if (!control.signal.aborted) setReport(result);
      } catch (error) {
        if (!control.signal.aborted)
          setReportError(
            error instanceof Error ? error.message : 'دریافت گزارش انجام نشد.',
          );
      } finally {
        if (!control.signal.aborted) setLoading(false);
      }
    })();
    return () => control.abort();
  }, [data.branchId, range.from, range.to, rangeValid, revision]);
  async function loadDetails(key: MetricKey, after = 0) {
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
        { metric: key, from: range.from, to: range.to },
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
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          {loading
            ? 'در حال دریافت گزارش…'
            : connected
              ? `گزارش واقعی یک سامانه از ${systems.length.toLocaleString('fa-IR')} سامانه؛ سایر منابع هنوز متصل نیستند`
              : 'منبع گزارش قابل دسترس نیست؛ نبود داده به معنی صفر نیست'}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          به‌روزرسانی گزارش
        </Button>
        {connected ? (
          <Badge>
            {connected.environment === 'LOCAL'
              ? 'داده نسخه محلی نیایش'
              : connected.environment}
          </Badge>
        ) : null}
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
                    {system.id === connected?.registrySystemId
                      ? 'متصل به منبع گزارش'
                      : 'آماده اتصال'}
                  </span>
                </div>
                <div className={styles.miniMetrics}>
                  <div>
                    <strong>
                      {system.id === connected?.registrySystemId
                        ? reportCount(connected.totals['customer-accounts'])
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
                  {system.id === connected?.registrySystemId
                    ? `تورهای ثبت‌شده: ${reportCount(connected.totals.tours)} · هتل‌ها: ${reportCount(connected.totals.hotels)} · ${label}`
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
                    ? reportMetricText(connected, key)
                    : loading
                      ? 'در حال دریافت…'
                      : 'داده موجود نیست'}
                </strong>
                <span>
                  مشاهده جزئیات سامانه‌ها
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
        با انتخاب هر شاخص، جزئیات سامانه‌ها در بازه انتخابی نمایش داده می‌شود.
        نبود داده به معنی صفر نیست. فروش، جمع اقلام سفارش پرداخت‌شده و لغونشدهٔ
        سایت با ارز اصلی است؛ تأیید مالی نورا نیست. سفارش منتظر، وضعیت فعلیِ
        منقضی‌نشده در میان سفارش‌های ایجادشده در بازه است.
      </p>
      <SiteVisits report={connected} label={label} />
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
            روند عملکرد
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
          <PanelTitle icon={<Clock3 />}>آخرین فعالیت‌ها</PanelTitle>
          {data.lastChange ? (
            <div className={styles.activity}>
              <span className={`${styles.symbol} ${styles.blue}`}>
                <Settings2 />
              </span>
              <div>
                <h3>{data.lastChange.reason}</h3>
                <p>
                  تغییر تنظیمات فهرست · نسخه{' '}
                  {data.version.toLocaleString('fa-IR')}
                </p>
                <time dateTime={data.lastChange.occurredAt}>
                  {new Date(data.lastChange.occurredAt).toLocaleString(
                    'fa-IR',
                    { timeZone: 'Asia/Tehran' },
                  )}
                </time>
              </div>
            </div>
          ) : (
            <p className={styles.caption}>
              {allowedSections && !allowedSections.includes('logs')
                ? 'مجوز مشاهده سوابق را ندارید.'
                : 'تغییری در تنظیمات ثبت نشده است.'}
            </p>
          )}
          <div className={styles.operationEmpty}>
            {connected?.activity.length ? (
              connected.activity.map((row) => (
                <p key={row.version}>
                  {row.resource} · شناسه {row.externalId} · {row.operation} ·{' '}
                  {new Date(row.occurredAt).toLocaleString('fa-IR')}
                </p>
              ))
            ) : (
              <p>
                {connected?.activityAvailable
                  ? 'فعالیتی در این بازه ثبت نشده است.'
                  : 'سابقه بیرونی در دسترس نیست یا مجوز مشاهده ندارید.'}
              </p>
            )}
          </div>
          <button
            className={styles.textButton}
            disabled={allowedSections && !allowedSections.includes('logs')}
            onClick={() => onSection('logs')}
          >
            مشاهده سوابق
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
                      {system.id === connected?.registrySystemId
                        ? reportCount(connected.totals['customer-accounts'])
                        : '—'}
                    </td>
                    <td>{value(system, 'sales')}</td>
                    <td>
                      <span className={styles.ready}>
                        {system.id === connected?.registrySystemId
                          ? 'گزارش متصل'
                          : 'آماده اتصال'}
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
                توزیع شاخص بین سامانه‌های در فهرست؛ مقادیر پس از اتصال منبع
                معتبر نمایش داده می‌شوند.
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
                      <th>
                        {metric === 'pending' ? 'وضعیت دریافت' : 'سهم از کل'}
                      </th>
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
                            ? 'پس از دریافت نوع رویداد'
                            : `${domainLabels[system.businessDomain]} · ${system.kind}`}
                        </td>
                        <td>{value(system, metric)}</td>
                        {metric === 'sales' ? (
                          <td>
                            {system.id === connected?.registrySystemId
                              ? reportCount(connected.metrics.sales?.value)
                              : 'داده موجود نیست'}
                          </td>
                        ) : null}
                        <td>
                          {metricState(system, metric) === 'نامرتبط'
                            ? 'نامرتبط'
                            : metric === 'pending'
                              ? 'متصل نشده'
                              : 'قابل محاسبه نیست'}
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
                        مجموع منابع متصل: {metricTitles[metric]}
                      </th>
                      <td colSpan={metric === 'sales' ? 3 : 2}>
                        {connected
                          ? reportMetricText(connected, metric)
                          : 'داده موجود نیست'}{' '}
                        · فقط منابع متصل
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
