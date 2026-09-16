'use client';

import {
  Activity,
  ArrowLeft,
  BellRing,
  Building2,
  CalendarDays,
  Clock3,
  Database,
  FileText,
  Flag,
  Gauge,
  History,
  KeyRound,
  ListOrdered,
  LockKeyhole,
  Network,
  RefreshCw,
  ServerCog,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { cn } from '@/lib/utils';

type ResourceState =
  'blocked' | 'forbidden' | 'ready' | 'unauthorized' | 'unavailable';
type Readiness = 'connected' | 'owner' | 'restricted';
type SystemSection = 'access' | 'governance' | 'operations' | 'organization';

interface Resource<T> {
  data: T | null;
  state: ResourceState;
}

interface UserRecord {
  status: string;
}

interface AccessOptions {
  branches: unknown[];
  permissions: unknown[];
  roles: unknown[];
}

interface LegalEntityRecord {
  isActive: boolean;
}

interface AuditRecord {
  action: string;
  id: string;
  occurredAt: string;
  outcome: string;
}

interface HealthRecord {
  status: string;
  timestamp: string;
}

interface OverviewData {
  access: Resource<AccessOptions>;
  audit: Resource<AuditRecord[]>;
  health: Resource<HealthRecord>;
  legalEntities: Resource<LegalEntityRecord[]>;
  users: Resource<UserRecord[]>;
}

interface ManagementArea {
  description: string;
  href?: string;
  id: string;
  owner: string;
  readiness: Readiness;
  section: SystemSection;
  title: string;
}

const sectionLabels: Record<SystemSection | 'all', string> = {
  all: 'همه بخش‌ها',
  access: 'دسترسی و هویت',
  organization: 'سازمان و هویت حقوقی',
  governance: 'سیاست و حاکمیت',
  operations: 'عملیات و پایداری',
};

const managementAreas: readonly ManagementArea[] = [
  {
    id: 'users',
    title: 'کاربران',
    description: 'فهرست، وضعیت، نقش و شعب مجاز کاربر از IAM مدیریت می‌شود.',
    owner: 'IAM',
    href: '/users',
    readiness: 'connected',
    section: 'access',
  },
  {
    id: 'roles',
    title: 'نقش‌ها',
    description: 'ایجاد و تغییر نقش تنها از جریان کنترل‌شده IAM انجام می‌شود.',
    owner: 'IAM',
    href: '/users',
    readiness: 'connected',
    section: 'access',
  },
  {
    id: 'permissions',
    title: 'مجوزها و دامنه دسترسی',
    description: 'ماتریس نقش و مجوز و دامنه شعبه در مالک IAM باقی می‌ماند.',
    owner: 'IAM',
    href: '/users',
    readiness: 'connected',
    section: 'access',
  },
  {
    id: 'branches',
    title: 'شعب و دسترسی سازمانی',
    description:
      'انتساب شعبه از IAM و مرجع شعب از مالک داده پایه خوانده می‌شود.',
    owner: 'IAM / Master Data',
    href: '/users',
    readiness: 'connected',
    section: 'organization',
  },
  {
    id: 'legal-entities',
    title: 'شرکت‌ها و سربرگ‌ها',
    description:
      'شرکت صادرکننده، Branding و نسخه‌های قابل ممیزی در Legal Entity است.',
    owner: 'Legal Entity',
    href: '/system/legal-entities',
    readiness: 'connected',
    section: 'organization',
  },
  {
    id: 'settings',
    title: 'تنظیمات عمومی',
    description:
      'تنظیم Typed و versioned تنها پس از اتصال قرارداد عمومی Settings قابل تغییر است.',
    owner: 'Settings',
    href: '/settings',
    readiness: 'owner',
    section: 'governance',
  },
  {
    id: 'security',
    title: 'تنظیمات امنیتی',
    description:
      'Password Policy، Session و کنترل حساس از سیاست‌های IAM پیروی می‌کنند.',
    owner: 'IAM',
    href: '/users',
    readiness: 'owner',
    section: 'access',
  },
  {
    id: 'sessions',
    title: 'نشست‌ها و دستگاه‌ها',
    description:
      'هیچ Token یا IP خامی نمایش داده نمی‌شود؛ پروژکشن مدیریت نشست هنوز باید از IAM منتشر شود.',
    owner: 'IAM',
    readiness: 'restricted',
    section: 'access',
  },
  {
    id: 'numbering',
    title: 'شماره‌گذاری و شناسه‌ها',
    description:
      'الگو و Sequence باید از مالک Settings به‌صورت اتمیک و نسخه‌دار ارائه شوند.',
    owner: 'Settings',
    readiness: 'owner',
    section: 'governance',
  },
  {
    id: 'calendar',
    title: 'تقویم، تاریخ و زمان',
    description:
      'نمایش شمسی، زمان محلی و تقویم کاری بدون تغییر UTC در مالک تنظیمات اعمال می‌شوند.',
    owner: 'Settings / Master Data',
    readiness: 'owner',
    section: 'governance',
  },
  {
    id: 'notifications',
    title: 'اعلان‌ها',
    description:
      'تنظیم کانال و سیاست ارسال از مالک Notification و Integrations مصرف می‌شود.',
    owner: 'Notifications / Integrations',
    href: '/integrations',
    readiness: 'owner',
    section: 'operations',
  },
  {
    id: 'templates',
    title: 'قالب‌های سیستمی',
    description:
      'فایل، نسخه و دسترسی قالب در Documents باقی می‌ماند؛ انتشار immutable است.',
    owner: 'Documents',
    href: '/documents',
    readiness: 'connected',
    section: 'governance',
  },
  {
    id: 'audit',
    title: 'Audit و رخدادهای امنیتی',
    description:
      'نمایش رخدادها در صورت مجوز جداگانه انجام می‌شود و مقدار حساس هرگز اینجا افشا نمی‌شود.',
    owner: 'IAM / Audit',
    readiness: 'connected',
    section: 'operations',
  },
  {
    id: 'health',
    title: 'وضعیت سرویس‌ها و Jobها',
    description:
      'تنها Health عمومی API فعلاً متصل است؛ PostgreSQL، Redis، Worker و Storage نیازمند contract مشاهده‌پذیری‌اند.',
    owner: 'Observability',
    readiness: 'owner',
    section: 'operations',
  },
  {
    id: 'feature-flags',
    title: 'Feature Flagها',
    description:
      'Flag هرگز جای Permission backend نیست و تا انتشار قرارداد مالک قابل تغییر نیست.',
    owner: 'Settings',
    readiness: 'owner',
    section: 'governance',
  },
  {
    id: 'backup',
    title: 'نگهداری و درخواست پشتیبان',
    description:
      'فقط ثبت و پیگیری درخواست امن مجاز است؛ Restore مستقیم از UI ارائه نمی‌شود.',
    owner: 'Infrastructure',
    readiness: 'restricted',
    section: 'operations',
  },
  {
    id: 'setting-history',
    title: 'تاریخچه تغییرات تنظیمات',
    description:
      'نسخه، دلیل و Before/After redacted باید از owner Settings به‌صورت append-only ارائه شود.',
    owner: 'Settings / Audit',
    readiness: 'owner',
    section: 'governance',
  },
];

const areaIcons: Record<string, LucideIcon> = {
  users: UsersRound,
  roles: ShieldCheck,
  permissions: KeyRound,
  branches: Building2,
  'legal-entities': Building2,
  settings: Settings2,
  security: LockKeyhole,
  sessions: Clock3,
  numbering: ListOrdered,
  calendar: CalendarDays,
  notifications: BellRing,
  templates: FileText,
  audit: History,
  health: Gauge,
  'feature-flags': Flag,
  backup: Database,
  'setting-history': SlidersHorizontal,
};

function resourceLabel(state: ResourceState): string {
  switch (state) {
    case 'ready':
      return 'متصل';
    case 'forbidden':
      return 'بدون مجوز';
    case 'unauthorized':
      return 'نیازمند ورود';
    case 'blocked':
      return 'API پیکربندی نشده';
    default:
      return 'در دسترس نیست';
  }
}

function readinessLabel(readiness: Readiness): string {
  switch (readiness) {
    case 'connected':
      return 'مسیر عملیاتی موجود';
    case 'owner':
      return 'نیازمند قرارداد مالک';
    default:
      return 'کنترل‌شده و محدود';
  }
}

function metricValue<T>(resource: Resource<T>, value: string): string {
  return resource.state === 'ready' ? value : resourceLabel(resource.state);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'زمان ثبت‌شده نامعتبر است'
    : date.toLocaleString('fa-IR');
}

async function requestResource<T>(path: string): Promise<Resource<T>> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) return { data: null, state: 'blocked' };
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (response.status === 401) return { data: null, state: 'unauthorized' };
    if (response.status === 403) return { data: null, state: 'forbidden' };
    if (!response.ok) return { data: null, state: 'unavailable' };
    return { data: (await response.json()) as T, state: 'ready' };
  } catch {
    return { data: null, state: 'unavailable' };
  }
}

function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  return (
    <Badge
      className={cn(
        'shrink-0 text-[10px]',
        readiness === 'connected' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
        readiness === 'owner' &&
          'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-100',
        readiness === 'restricted' &&
          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      )}
    >
      {readinessLabel(readiness)}
    </Badge>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  title,
  value,
}: {
  detail: string;
  icon: LucideIcon;
  title: string;
  value: string;
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-3 break-words text-2xl font-black tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Card>
  );
}

function ManagementAreaCard({ area }: { area: ManagementArea }) {
  const Icon = areaIcons[area.id] ?? Settings2;
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <ReadinessBadge readiness={area.readiness} />
      </div>
      <h3 className="mt-4 font-black text-foreground">{area.title}</h3>
      <p className="mt-2 flex-1 text-xs leading-6 text-muted-foreground">
        {area.description}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[11px] font-semibold text-muted-foreground">
          مالک: <bdi dir="ltr">{area.owner}</bdi>
        </span>
        {area.href ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={area.href}>
              ورود به مالک
              <ArrowLeft aria-hidden="true" className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground">
            API مالک منتشر نشده
          </span>
        )}
      </div>
    </article>
  );
}

export function SystemManagementWorkspace() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [activeSection, setActiveSection] = useState<SystemSection | 'all'>(
    'all',
  );
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setOverview(null);
    const [users, access, legalEntities, audit, health] = await Promise.all([
      requestResource<UserRecord[]>('/iam/users'),
      requestResource<AccessOptions>('/iam/access-options'),
      requestResource<{ data: LegalEntityRecord[] }>('/legal-entities'),
      requestResource<AuditRecord[]>('/iam/audit-events'),
      requestResource<{ data: HealthRecord }>('/health'),
    ]);
    setOverview({
      users,
      access,
      legalEntities: {
        data: legalEntities.data?.data ?? null,
        state: legalEntities.state,
      },
      audit,
      health: { data: health.data?.data ?? null, state: health.state },
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa-IR');
    return managementAreas.filter((area) => {
      const inSection =
        activeSection === 'all' || area.section === activeSection;
      const matchesQuery =
        !normalizedQuery ||
        [area.title, area.description, area.owner].some((value) =>
          value.toLocaleLowerCase('fa-IR').includes(normalizedQuery),
        );
      return inSection && matchesQuery;
    });
  }, [activeSection, query]);

  if (!overview) {
    return (
      <div className="space-y-5" aria-label="در حال بارگذاری مدیریت سیستم">
        <Skeleton className="h-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="h-36" key={item} />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const activeUsers = overview.users.data?.filter(
    (user) => user.status === 'ACTIVE',
  ).length;
  const inactiveUsers = overview.users.data
    ? overview.users.data.length - (activeUsers ?? 0)
    : 0;
  const activeCompanies = overview.legalEntities.data?.filter(
    (entity) => entity.isActive,
  ).length;
  const latestAudit = overview.audit.data?.slice(0, 4) ?? [];
  const apiReady = overview.health.data?.status === 'ok';
  const accessState = overview.access.state;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="مرکز مدیریت سامانه"
        title="مدیریت سیستم"
        description="نمای کنترل‌شدهٔ وضعیت سامانه و مسیرهای مالک. این صفحه داده را تکرار نمی‌کند و هر عملیات حساس در API ماژول مالک دوباره مجوزسنجی می‌شود."
        actions={
          <Button onClick={() => void load()} type="button" variant="outline">
            <RefreshCw aria-hidden="true" className="size-4" />
            تازه‌سازی وضعیت
          </Button>
        }
      />

      <Alert
        description="Token، Cookie، Secret، رمز عبور و IP خام در این مرکز نمایش یا ثبت نمی‌شوند. معیار اتصال هر کارت از پاسخ واقعی API مالک می‌آید."
        title="کنترل دسترسی و محرمانگی"
      />

      <section aria-labelledby="system-metrics-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-black" id="system-metrics-title">
            نمای کلی مجاز
          </h2>
          <span className="text-xs text-muted-foreground">
            دسترسی IAM: {resourceLabel(accessState)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail="فقط از فهرست دارای مجوز IAM"
            icon={UsersRound}
            title="کاربران فعال"
            value={metricValue(
              overview.users,
              (activeUsers ?? 0).toLocaleString('fa-IR'),
            )}
          />
          <MetricCard
            detail="غیرفعال یا قفل‌شده در پاسخ IAM"
            icon={ShieldAlert}
            title="کاربران نیازمند بررسی"
            value={metricValue(
              overview.users,
              inactiveUsers.toLocaleString('fa-IR'),
            )}
          />
          <MetricCard
            detail="نقش‌های فعال از قرارداد IAM"
            icon={ShieldCheck}
            title="نقش‌ها و مجوزها"
            value={metricValue(
              overview.access,
              `${(overview.access.data?.roles.length ?? 0).toLocaleString('fa-IR')} / ${(overview.access.data?.permissions.length ?? 0).toLocaleString('fa-IR')}`,
            )}
          />
          <MetricCard
            detail="فهرست شعب فعال از قرارداد IAM"
            icon={Building2}
            title="شعب فعال"
            value={metricValue(
              overview.access,
              (overview.access.data?.branches.length ?? 0).toLocaleString(
                'fa-IR',
              ),
            )}
          />
          <MetricCard
            detail="شرکت‌های فعال از Legal Entity"
            icon={Building2}
            title="شرکت‌های فعال"
            value={metricValue(
              overview.legalEntities,
              (activeCompanies ?? 0).toLocaleString('fa-IR'),
            )}
          />
          <MetricCard
            detail="شمارش مدیریتی نشست هنوز public contract ندارد"
            icon={Clock3}
            title="نشست‌های فعال"
            value="—"
          />
          <MetricCard
            detail="آخرین رخدادهای مجاز IAM / Audit"
            icon={History}
            title="رخدادهای امنیتی"
            value={metricValue(
              overview.audit,
              latestAudit.length.toLocaleString('fa-IR'),
            )}
          />
          <MetricCard
            detail={
              apiReady
                ? 'پاسخ liveness از API'
                : resourceLabel(overview.health.state)
            }
            icon={Activity}
            title="وضعیت API"
            value={apiReady ? 'سالم' : resourceLabel(overview.health.state)}
          />
          <MetricCard
            detail="Jobهای ناموفق فقط با projection Worker نمایش داده می‌شوند"
            icon={ServerCog}
            title="Jobهای ناموفق"
            value="—"
          />
        </div>
      </section>

      <section
        className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]"
        aria-labelledby="system-areas-title"
      >
        <div className="min-w-0">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-black" id="system-areas-title">
                بخش‌های مدیریت سیستم
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                هر بخش وضعیت اتصال و مالک دادهٔ خود را روشن می‌کند.
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <Input
                aria-label="جست‌وجوی بخش مدیریت سیستم"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="جست‌وجو در بخش‌ها و مالکان"
                value={query}
              />
            </div>
          </div>

          <nav
            aria-label="فیلتر بخش‌های مدیریت سیستم"
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
          >
            {(Object.keys(sectionLabels) as Array<SystemSection | 'all'>).map(
              (section) => (
                <Button
                  aria-pressed={activeSection === section}
                  key={section}
                  onClick={() => setActiveSection(section)}
                  size="sm"
                  type="button"
                  variant={activeSection === section ? 'primary' : 'outline'}
                >
                  {sectionLabels[section]}
                </Button>
              ),
            )}
          </nav>

          {filteredAreas.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredAreas.map((area) => (
                <ManagementAreaCard area={area} key={area.id} />
              ))}
            </div>
          ) : (
            <Card className="mt-4 p-6 text-center">
              <p className="font-semibold">بخش منطبق با جست‌وجو پیدا نشد</p>
              <p className="mt-2 text-sm text-muted-foreground">
                عبارت دیگری را امتحان کنید یا فیلتر را به «همه بخش‌ها»
                برگردانید.
              </p>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="flex items-center gap-2 font-black">
              <Network aria-hidden="true" className="size-5 text-primary" />
              وضعیت سرویس‌ها
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                [
                  'API',
                  apiReady ? 'سالم' : resourceLabel(overview.health.state),
                ],
                ['PostgreSQL', 'بدون projection عمومی'],
                ['Redis', 'بدون projection عمومی'],
                ['Worker', 'بدون projection عمومی'],
                ['Storage', 'بدون projection عمومی'],
              ].map(([service, status]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/55 px-3 py-2"
                  key={service}
                >
                  <dt className="font-semibold">{service}</dt>
                  <dd className="text-xs text-muted-foreground">{status}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Commit runtime، صف و Migration status تنها پس از انتشار قرارداد
              Observability نمایش داده می‌شوند.
            </p>
          </Card>

          <Card className="p-4">
            <h2 className="flex items-center gap-2 font-black">
              <History aria-hidden="true" className="size-5 text-primary" />
              آخرین رخدادهای مجاز
            </h2>
            {overview.audit.state === 'ready' && latestAudit.length ? (
              <ol className="mt-4 space-y-3">
                {latestAudit.map((event) => (
                  <li
                    className="border-b border-border pb-3 last:border-0 last:pb-0"
                    key={event.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <strong className="break-words text-xs">
                        {event.action}
                      </strong>
                      <Badge className="bg-muted text-[10px] text-muted-foreground">
                        {event.outcome}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {overview.audit.state === 'ready'
                  ? 'رخداد قابل‌نمایشی ثبت نشده است.'
                  : `نمایش Audit: ${resourceLabel(overview.audit.state)}`}
              </p>
            )}
          </Card>

          <Alert
            description="عملیات حساس به دلیل معتبر، مجوز backend و Audit ماژول مالک نیاز دارند. این مرکز امکان اجرای فرمان سرور، حذف داده یا بازیابی مستقیم را ارائه نمی‌کند."
            title="مرز عملیات مدیریتی"
            tone="warning"
          />
        </aside>
      </section>
    </div>
  );
}
