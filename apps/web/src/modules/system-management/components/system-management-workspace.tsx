'use client';

import {
  ArrowLeft,
  Banknote,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Eye,
  FileText,
  Grid2X2,
  Headphones,
  History,
  Home,
  LayoutGrid,
  ListTodo,
  LockKeyhole,
  Megaphone,
  Plane,
  Plug,
  Save,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

import type { LegalEntitySummary, SystemSettingV1 } from '@nora/contracts';
import { legalEntitiesApi } from '@/modules/legal-entities/api/client';
import {
  systemManagementApi,
  SystemManagementApiError,
  type SystemAuditRecord,
  type SystemOverview,
} from '../api/client';
import {
  settingsModules,
  type SettingField,
  type SettingGroup,
  type SettingModule,
  type SettingTone,
} from '../model/settings-catalog';
import styles from './system-management-workspace.module.css';

type Page = 'history' | 'module' | 'modules' | 'overview' | 'reviews';
type Values = Record<string, boolean | string>;
type SettingsScope = {
  scope: 'GLOBAL' | 'LEGAL_ENTITY';
  scopeId: string | null;
  title: string;
};

interface ManagementArea {
  id: string;
  description: string;
  href: string;
  moduleIds: readonly string[];
  owner: string;
  title: string;
}

const globalScope: SettingsScope = {
  scope: 'GLOBAL',
  scopeId: null,
  title: 'کل مجموعه',
};

/** Links retain ownership instead of duplicating an owner's administration UI. */
const managementAreas: readonly ManagementArea[] = [
  {
    id: 'legal-entities',
    title: 'شرکت صادرکننده و برند',
    description: 'هویت حقوقی، Branding و سربرگ‌ها در ماژول مالک ثبت می‌شوند.',
    owner: 'Legal Entity',
    href: '/system/legal-entities',
    moduleIds: ['general'],
  },
  {
    id: 'iam',
    title: 'کاربران، نقش‌ها و دامنه دسترسی',
    description:
      'IAM وضعیت کاربر، نقش و مجوز مؤثر را دوباره اعتبارسنجی می‌کند.',
    owner: 'IAM',
    href: '/users',
    moduleIds: ['access'],
  },
  {
    id: 'documents',
    title: 'اسناد و فایل‌ها',
    description: 'فایل، دسترسی و نگه‌داری در مالک Documents باقی می‌ماند.',
    owner: 'Documents',
    href: '/documents',
    moduleIds: ['documents'],
  },
  {
    id: 'reporting',
    title: 'گزارش‌ها و خروجی‌ها',
    description: 'کاتالوگ و چرخهٔ خروجی گزارش را Reporting مالک است.',
    owner: 'Reporting',
    href: '/reports',
    moduleIds: ['reports'],
  },
  {
    id: 'operations',
    title: 'عملیات، سلامت و پشتیبان',
    description:
      'عملیات نسخه‌دار System Management و Probeهای مالک در این صفحه‌اند.',
    owner: 'System Management',
    href: '/system/operations',
    moduleIds: ['integrations'],
  },
];

const iconMap: Record<string, LucideIcon> = {
  bag: BriefcaseBusiness,
  bell: Bell,
  building: Building2,
  calendar: CalendarDays,
  chart: ChartNoAxesColumnIncreasing,
  check: Check,
  clock: Clock3,
  eye: Eye,
  file: FileText,
  grid: Grid2X2,
  headset: Headphones,
  history: History,
  home: Home,
  megaphone: Megaphone,
  money: Banknote,
  plane: Plane,
  plug: Plug,
  settings: Settings,
  shield: ShieldCheck,
  task: ListTodo,
  ticket: Ticket,
  users: Users,
  cart: ShoppingCart,
};

const tones: Record<SettingTone, { accent: string; tint: string }> = {
  amber: { tint: '#fff5e5', accent: '#c5892a' },
  blue: { tint: '#eaf3ff', accent: '#2175d6' },
  cyan: { tint: '#e7f7fd', accent: '#0c94bb' },
  rose: { tint: '#fff0f3', accent: '#d5597e' },
  teal: { tint: '#e5f8f1', accent: '#00a381' },
  violet: { tint: '#f1ebff', accent: '#8554ca' },
};

type SystemCategoryId =
  | 'all'
  | 'company-settings'
  | 'documents-reports'
  | 'finance'
  | 'human-resources'
  | 'reservations-supply'
  | 'sales-customers'
  | 'workspace';

const systemCategoryGroups: ReadonlyArray<{
  id: Exclude<SystemCategoryId, 'all'>;
  moduleIds: readonly string[];
  title: string;
}> = [
  {
    id: 'workspace',
    title: 'فضای کار',
    moduleIds: ['tasks', 'messages'],
  },
  {
    id: 'sales-customers',
    title: 'فروش و ارتباط با مشتری',
    moduleIds: ['customers', 'affairs', 'sales', 'marketing'],
  },
  {
    id: 'reservations-supply',
    title: 'رزرواسیون و تأمین سفر',
    moduleIds: ['catalog', 'operations', 'procurement'],
  },
  {
    id: 'finance',
    title: 'مالی',
    moduleIds: ['finance', 'b2b'],
  },
  {
    id: 'human-resources',
    title: 'سرمایه انسانی',
    moduleIds: ['hr'],
  },
  {
    id: 'documents-reports',
    title: 'اسناد و گزارش‌ها',
    moduleIds: ['documents', 'reports'],
  },
  {
    id: 'company-settings',
    title: 'تنظیمات شرکت',
    moduleIds: ['general', 'access', 'integrations', 'master'],
  },
];

function systemCategoryFor(module: SettingModule) {
  return systemCategoryGroups.find((group) =>
    group.moduleIds.includes(module.id),
  );
}

function palette(module: SettingModule): CSSProperties {
  return {
    '--accent': tones[module.tone].accent,
    '--tint': tones[module.tone].tint,
  } as CSSProperties;
}

function defaults(group: SettingGroup): Values {
  return Object.fromEntries(
    group.fields.map((field) => [field.key, field.value]),
  );
}

function isValues(value: unknown): value is Values {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function displayValue(field: SettingField, value: boolean | string) {
  if (typeof value === 'boolean') return value ? 'فعال' : 'غیرفعال';
  if (field.type === 'number') {
    const formatted = Number(value).toLocaleString('fa-IR');
    return field.unit ? `${formatted} ${field.unit}` : formatted;
  }
  return value;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString('fa-IR');
}

function apiMessage(error: unknown) {
  if (error instanceof SystemManagementApiError) {
    if (error.status === 401) return 'برای ادامه باید وارد سامانه شوید.';
    if (error.status === 403) return 'مجوز تغییر این تنظیم را ندارید.';
    if (error.status === 409)
      return 'نسخه تنظیم تغییر کرده است؛ صفحه را تازه کنید.';
    return error.message;
  }
  return 'ارتباط با مدیریت سامانه برقرار نشد.';
}

export function SystemManagementWorkspace() {
  const [page, setPage] = useState<Page>('overview');
  const [selectedModuleId, setSelectedModuleId] = useState('general');
  const [category, setCategory] = useState<SystemCategoryId>('all');
  const [expandedCategory, setExpandedCategory] = useState<Exclude<
    SystemCategoryId,
    'all'
  > | null>(null);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SettingsScope>(globalScope);
  const [legalEntities, setLegalEntities] = useState<LegalEntitySummary[]>([]);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);
  const [moduleTab, setModuleTab] = useState<'history' | 'settings'>(
    'settings',
  );
  const [settings, setSettings] = useState<SystemSettingV1[]>([]);
  const [audit, setAudit] = useState<SystemAuditRecord[]>([]);
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [editing, setEditing] = useState<{
    module: SettingModule;
    group: SettingGroup;
  } | null>(null);
  const [draft, setDraft] = useState<Values>({});
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [settingsResult, auditResult, overviewResult, legalEntitiesResult] =
      await Promise.allSettled([
        systemManagementApi.settings(),
        systemManagementApi.audit(),
        systemManagementApi.overview(),
        legalEntitiesApi.selectable(),
      ]);
    if (settingsResult.status === 'fulfilled')
      setSettings(settingsResult.value);
    if (auditResult.status === 'fulfilled') setAudit(auditResult.value);
    if (overviewResult.status === 'fulfilled')
      setOverview(overviewResult.value);
    if (legalEntitiesResult.status === 'fulfilled') {
      setLegalEntities(
        legalEntitiesResult.value.data.filter((entity) => entity.isActive),
      );
      setScopeLoadError(null);
    } else {
      setLegalEntities([]);
      setScopeLoadError(
        'دامنه‌های حقوقی از API مالک در دسترس نیست؛ فقط دامنه کل مجموعه قابل استفاده است.',
      );
      setScope(globalScope);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setEditing(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editing, saving]);

  const selectedModule =
    settingsModules.find((module) => module.id === selectedModuleId) ??
    settingsModules[0]!;

  const settingFor = (module: SettingModule, group: SettingGroup) =>
    settings.find(
      (setting) =>
        setting.namespace === module.id &&
        setting.key === group.id &&
        setting.scope === scope.scope &&
        setting.scopeId === scope.scopeId,
    );

  const valuesFor = (module: SettingModule, group: SettingGroup) => {
    const setting = settingFor(module, group);
    return setting && isValues(setting.value)
      ? { ...defaults(group), ...setting.value }
      : defaults(group);
  };

  const filteredModules = useMemo(() => {
    const normalized = query.trim();
    const selectedCategory = systemCategoryGroups.find(
      (group) => group.id === category,
    );
    return settingsModules.filter(
      (module) =>
        (!selectedCategory || selectedCategory.moduleIds.includes(module.id)) &&
        (!normalized ||
          [
            module.title,
            ...module.groups.flatMap((group) => [
              group.title,
              ...group.fields.map((field) => field.label),
            ]),
          ].some((text) => text.includes(normalized))),
    );
  }, [category, query]);

  const openModule = (module: SettingModule) => {
    setSelectedModuleId(module.id);
    setModuleTab('settings');
    setPage('module');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditor = (module: SettingModule, group: SettingGroup) => {
    setEditing({ module, group });
    setDraft(valuesFor(module, group));
    setReason('');
    setSaveError(null);
  };

  const saveGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!reason.trim()) {
      setSaveError('دلیل تغییر را وارد کنید.');
      return;
    }
    const current = settingFor(editing.module, editing.group);
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await systemManagementApi.writeSetting({
        ...(current ? { expectedVersion: current.version } : {}),
        key: editing.group.id,
        namespace: editing.module.id,
        reason: reason.trim(),
        scope: scope.scope,
        scopeId: scope.scopeId,
        status: 'ACTIVE',
        value: draft,
        valueType: 'JSON',
      });
      setSettings((items) => [
        saved,
        ...items.filter((item) => item.id !== saved.id),
      ]);
      setEditing(null);
      setToast(
        editing.group.sensitive
          ? 'تغییر حساس با دلیل و Audit ثبت شد.'
          : 'تنظیمات ذخیره شد.',
      );
      void load();
    } catch (error) {
      setSaveError(apiMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const navigate = (next: Page) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderHistory = (items = audit) => (
    <div className={styles.auditGrid}>
      {items.length ? (
        items.map((event) => (
          <article className={styles.auditItem} key={event.id}>
            <div>
              <strong>{event.action}</strong>
              <p>
                {event.entityType} • {event.entityId}
              </p>
              <p>
                {event.reason} • {formatDate(event.createdAt)}
              </p>
            </div>
            <div className={styles.tools}>
              <span className={styles.pill}>{event.outcome}</span>
            </div>
          </article>
        ))
      ) : (
        <div className={styles.empty}>تغییری در این بخش ثبت نشده است.</div>
      )}
    </div>
  );

  const renderHub = () => (
    <>
      <div className={styles.searchbar}>
        <label className={styles.search}>
          <Search aria-hidden="true" size={21} />
          <span className="sr-only">جست‌وجوی تنظیمات</span>
          <input
            aria-label="جست‌وجوی تنظیمات"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی بخش، کارت یا تنظیم…"
            value={query}
          />
        </label>
      </div>
      <nav aria-label="دسته‌بندی تنظیمات" className={styles.filters}>
        <button
          aria-pressed={category === 'all'}
          className={`${styles.filter} ${category === 'all' ? styles.filterActive : ''}`}
          onClick={() => {
            setCategory('all');
            setExpandedCategory(null);
          }}
          type="button"
        >
          <span aria-hidden="true" className={styles.categoryDot} />
          همه بخش‌ها
        </button>
        {systemCategoryGroups.map((group) => {
          const expanded = expandedCategory === group.id;
          const panelId = `system-category-${group.id}`;
          return (
            <button
              aria-controls={panelId}
              aria-expanded={expanded}
              aria-pressed={category === group.id}
              className={`${styles.filter} ${category === group.id ? styles.filterActive : ''}`}
              key={group.id}
              onClick={() => {
                setCategory(group.id);
                setExpandedCategory((current) =>
                  current === group.id ? null : group.id,
                );
              }}
              type="button"
            >
              <span aria-hidden="true" className={styles.categoryDot} />
              {group.title}
              {expanded ? (
                <ChevronDown
                  aria-hidden="true"
                  className={styles.categoryChevron}
                />
              ) : (
                <ChevronLeft
                  aria-hidden="true"
                  className={styles.categoryChevron}
                />
              )}
            </button>
          );
        })}
      </nav>
      {expandedCategory ? (
        <div
          aria-label={`زیرمجموعه‌های ${systemCategoryGroups.find((group) => group.id === expandedCategory)?.title ?? ''}`}
          className={styles.categoryPanel}
          id={`system-category-${expandedCategory}`}
        >
          {settingsModules
            .filter((module) =>
              systemCategoryGroups
                .find((group) => group.id === expandedCategory)
                ?.moduleIds.includes(module.id),
            )
            .map((module) => (
              <button
                aria-label={`مشاهده تنظیمات ${module.title}`}
                className={styles.categoryChild}
                key={module.id}
                onClick={() => openModule(module)}
                type="button"
              >
                {module.title}
                <ArrowLeft aria-hidden="true" size={16} />
              </button>
            ))}
        </div>
      ) : null}
      <div className={styles.hubGrid}>
        {filteredModules.length ? (
          filteredModules.map((module) => {
            const Icon = iconMap[module.icon] ?? Settings;
            return (
              <button
                aria-label={`مشاهده تنظیمات ${module.title}`}
                className={styles.hubCard}
                key={module.id}
                onClick={() => openModule(module)}
                style={palette(module)}
                type="button"
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <div className={styles.grow}>
                    <h3>{module.title}</h3>
                    <p className={styles.subtitle}>
                      {systemCategoryFor(module)?.title ?? module.category}
                    </p>
                  </div>
                </div>
                <div className={styles.tags}>
                  {module.groups.slice(0, 3).map((group) => (
                    <span className={styles.tag} key={group.id}>
                      {group.title}
                    </span>
                  ))}
                </div>
                <div className={styles.cardFoot}>
                  <span>
                    {module.groups.length.toLocaleString('fa-IR')} کارت تنظیمات
                  </span>
                  <span className={styles.enter}>
                    مشاهده تنظیمات <ArrowLeft aria-hidden="true" size={18} />
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className={styles.empty}>تنظیمی پیدا نشد.</div>
        )}
      </div>
    </>
  );

  const renderModule = () => {
    const ModuleIcon = iconMap[selectedModule.icon] ?? Settings;
    const ownerAreas = managementAreas.filter((area) =>
      area.moduleIds.includes(selectedModule.id),
    );
    const moduleSettingIds = new Set(
      settings
        .filter(
          (setting) =>
            setting.namespace === selectedModule.id &&
            setting.scope === scope.scope &&
            setting.scopeId === scope.scopeId,
        )
        .map((setting) => setting.id),
    );
    const moduleAudit = audit.filter(
      (event) =>
        event.entityType === 'SYSTEM_SETTING' &&
        moduleSettingIds.has(event.entityId),
    );
    return (
      <>
        <div className={styles.heading}>
          <div className={styles.moduleHead} style={palette(selectedModule)}>
            <span className={styles.cardIcon}>
              <ModuleIcon aria-hidden="true" />
            </span>
            <div>
              <h1>{selectedModule.title}</h1>
              <p className={styles.subtitle}>
                {selectedModule.groups.length.toLocaleString('fa-IR')} کارت
                تنظیمات • {scope.title}
              </p>
            </div>
          </div>
          <button
            className={styles.button}
            onClick={() => navigate('modules')}
            type="button"
          >
            <LayoutGrid aria-hidden="true" size={18} /> همه بخش‌ها
          </button>
        </div>
        {ownerAreas.length ? (
          <div className={styles.ownerLinks}>
            {ownerAreas.map((area) => (
              <p key={area.id}>
                <span>{area.description}</span>
                <Link href={area.href}>
                  ادامه در {area.owner}: {area.title}
                  <ArrowLeft aria-hidden="true" size={16} />
                </Link>
              </p>
            ))}
          </div>
        ) : null}
        <div className={styles.sectionbar}>
          <button
            className={`${styles.tab} ${moduleTab === 'settings' ? styles.tabActive : ''}`}
            onClick={() => setModuleTab('settings')}
            type="button"
          >
            تنظیمات
          </button>
          <button
            className={`${styles.tab} ${moduleTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setModuleTab('history')}
            type="button"
          >
            تاریخچه این بخش
          </button>
        </div>
        {moduleTab === 'history' ? (
          renderHistory(moduleAudit)
        ) : (
          <div className={styles.settingsGrid}>
            {selectedModule.groups.map((group) => {
              const GroupIcon = iconMap[group.icon] ?? Settings;
              const values = valuesFor(selectedModule, group);
              const current = settingFor(selectedModule, group);
              return (
                <article
                  className={styles.settingCard}
                  key={group.id}
                  style={palette(selectedModule)}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardIcon}>
                      <GroupIcon aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{group.title}</h3>
                      <p className={styles.subtitle}>
                        {group.sensitive
                          ? 'با ثبت دلیل و Audit'
                          : 'ذخیره مستقیم'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.previewValues}>
                    {group.fields.slice(0, 3).map((field) => (
                      <div className={styles.kv} key={field.key}>
                        <span>{field.label}</span>
                        <b>
                          {displayValue(
                            field,
                            values[field.key] ?? field.value,
                          )}
                        </b>
                      </div>
                    ))}
                  </div>
                  {group.rules.length ? (
                    <div className={styles.locked}>
                      <LockKeyhole aria-hidden="true" />
                      <span>
                        {group.rules.length.toLocaleString('fa-IR')} قاعده
                        الزامی
                      </span>
                    </div>
                  ) : null}
                  <div className={styles.cardFoot}>
                    <span className={styles.pill}>
                      نسخه {(current?.version ?? 0).toLocaleString('fa-IR')}
                    </span>
                    <button
                      aria-label={`ویرایش تنظیمات ${group.title}`}
                      className={styles.button}
                      onClick={() => openEditor(selectedModule, group)}
                      type="button"
                    >
                      <Settings aria-hidden="true" size={17} /> ویرایش تنظیمات
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const pageTitle =
    page === 'module'
      ? selectedModule.title
      : page === 'reviews'
        ? 'بررسی تغییرات'
        : page === 'history'
          ? 'تاریخچه تغییرات'
          : page === 'modules'
            ? 'تنظیمات بخش‌ها'
            : 'نمای کلی تنظیمات';

  return (
    <section className={styles.workspace} dir="rtl">
      <div className={styles.main}>
        <div className={styles.heading}>
          <h1>{pageTitle}</h1>
          <div className={styles.headingActions}>
            <label className={styles.scopeControl}>
              <Building2 aria-hidden="true" size={17} />
              <span className={styles.scopeLabel}>دامنه:</span>
              <select
                aria-label="دامنه تنظیمات"
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === 'GLOBAL') {
                    setScope(globalScope);
                    return;
                  }
                  const entity = legalEntities.find((item) => item.id === next);
                  if (entity)
                    setScope({
                      scope: 'LEGAL_ENTITY',
                      scopeId: entity.id,
                      title: entity.persianName,
                    });
                }}
                value={scope.scopeId ?? 'GLOBAL'}
              >
                <option value="GLOBAL">کل مجموعه</option>
                {legalEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.persianName}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.statusBadge} role="status">
              <span aria-hidden="true" className={styles.statusDot} />
              {overview ? 'داده‌های عملیاتی' : 'مقادیر مرجع'}
            </span>
          </div>
        </div>
        {scopeLoadError ? (
          <p className={styles.scopeHint} role="status">
            {scopeLoadError}
          </p>
        ) : null}

        {page === 'overview' || page === 'modules' ? renderHub() : null}
        {page === 'module' ? renderModule() : null}
        {page === 'history' ? renderHistory() : null}
        {page === 'reviews' ? (
          <div className={styles.empty}>
            <ShieldCheck
              aria-hidden="true"
              className="mx-auto mb-3"
              size={30}
            />
            تغییر واقعیِ منتظر بررسی وجود ندارد. این صفحه وضعیت ساختگی ایجاد
            نمی‌کند.
          </div>
        ) : null}
      </div>

      {editing ? (
        <div
          className={styles.dialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setEditing(null);
          }}
        >
          <section
            aria-labelledby="settings-dialog-title"
            aria-modal="true"
            className={styles.dialog}
            role="dialog"
          >
            <div className={styles.modalHead} style={palette(editing.module)}>
              <span className={styles.cardIcon}>
                {(() => {
                  const Icon = iconMap[editing.group.icon] ?? Settings;
                  return <Icon aria-hidden="true" />;
                })()}
              </span>
              <div className={styles.grow}>
                <h2 id="settings-dialog-title">{editing.group.title}</h2>
                <small>{editing.module.title}</small>
              </div>
              <button
                aria-label="بستن"
                className={styles.close}
                disabled={saving}
                onClick={() => setEditing(null)}
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <form onSubmit={saveGroup}>
              <div className={styles.modalBody}>
                <div className={styles.saveMeta}>
                  <span>{scope.title}</span>
                  <span className={`${styles.pill} ${styles.pillBlue}`}>
                    نسخه{' '}
                    {settingFor(
                      editing.module,
                      editing.group,
                    )?.version.toLocaleString('fa-IR') ?? '۰'}
                  </span>
                </div>
                <div className={styles.formGrid}>
                  {editing.group.fields.map((field) =>
                    field.type === 'boolean' ? (
                      <label
                        className={`${styles.field} ${styles.switchField}`}
                        key={field.key}
                      >
                        <span>{field.label}</span>
                        <input
                          className={styles.switch}
                          checked={Boolean(draft[field.key])}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              [field.key]: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                      </label>
                    ) : (
                      <label className={styles.field} key={field.key}>
                        <span>{field.label}</span>
                        {field.type === 'select' ? (
                          <select
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                [field.key]: event.target.value,
                              }))
                            }
                            value={String(draft[field.key] ?? '')}
                          >
                            {field.options?.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            max={field.max}
                            min={field.min}
                            onChange={(event) =>
                              setDraft((value) => ({
                                ...value,
                                [field.key]: event.target.value,
                              }))
                            }
                            type={field.type}
                            value={String(draft[field.key] ?? '')}
                          />
                        )}
                      </label>
                    ),
                  )}
                  <label className={`${styles.field} ${styles.wide}`}>
                    <span>دلیل تغییر</span>
                    <textarea
                      maxLength={300}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="دلیل اصلاح این تنظیمات"
                      value={reason}
                    />
                  </label>
                </div>
                {editing.group.rules.length ? (
                  <div className={styles.rules}>
                    {editing.group.rules.map((rule) => (
                      <div className={styles.locked} key={rule}>
                        <LockKeyhole aria-hidden="true" />
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {saveError ? (
                  <p className={styles.error} role="alert">
                    {saveError}
                  </p>
                ) : null}
              </div>
              <div className={styles.modalFoot}>
                <button
                  className={`${styles.button} ${styles.quiet}`}
                  disabled={saving}
                  onClick={() => {
                    setDraft(defaults(editing.group));
                    setReason('');
                    setSaveError(null);
                  }}
                  type="button"
                >
                  بازگردانی فرم
                </button>
                <div className={styles.tools}>
                  <button
                    className={styles.button}
                    disabled={saving}
                    onClick={() => setEditing(null)}
                    type="button"
                  >
                    انصراف
                  </button>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    disabled={saving}
                    type="submit"
                  >
                    <Save aria-hidden="true" size={18} />
                    {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
