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
  Clock3,
  Eye,
  FileText,
  Grid2X2,
  Headphones,
  History,
  Home,
  ListTodo,
  LockKeyhole,
  Megaphone,
  Plane,
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

import type { SystemSettingV1 } from '@nora/contracts';
import {
  systemPreferencesChangedEvent,
  useSystemPreferences,
} from '@/components/system-preferences-provider';
import {
  usePageBreadcrumbs,
  type PageBreadcrumb,
} from '@/components/layout/page-breadcrumbs';
import { navigationGroups } from '@/lib/navigation';
import {
  systemManagementApi,
  SystemManagementApiError,
  type SystemAuditRecord,
} from '../api/client';
import {
  settingsModules,
  type SettingField,
  type SettingGroup,
  type SettingModule,
  type SettingTone,
} from '../model/settings-catalog';
import {
  containsPersian,
  englishText,
  localizeCategory,
  localizeOption,
  localizeSettingModules,
  type SystemManagementLanguage,
} from '../model/system-management-locale';
import styles from './system-management-workspace.module.css';

type Page = 'history' | 'module' | 'overview' | 'reviews';
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

interface SystemCategoryGroup {
  id: Exclude<SystemCategoryId, 'all'>;
  moduleIds: readonly string[];
  title: string;
}

const systemCategoryIdByNavigationGroup = {
  work: 'workspace',
  sales: 'sales-customers',
  operations: 'reservations-supply',
  finance: 'finance',
  hr: 'human-resources',
  resources: 'documents-reports',
  system: 'company-settings',
} as const satisfies Record<
  (typeof navigationGroups)[number]['id'],
  Exclude<SystemCategoryId, 'all'>
>;

const moduleIdsBySystemCategory: Record<
  Exclude<SystemCategoryId, 'all'>,
  readonly string[]
> = {
  workspace: ['tasks', 'messages'],
  'sales-customers': ['customers', 'affairs', 'sales', 'marketing'],
  'reservations-supply': ['catalog', 'operations'],
  finance: ['finance', 'b2b'],
  'human-resources': ['hr', 'procurement'],
  'documents-reports': ['documents', 'reports'],
  'company-settings': ['general', 'access', 'master'],
};

const systemCategoryGroups: readonly SystemCategoryGroup[] =
  navigationGroups.map((group) => {
    const id = systemCategoryIdByNavigationGroup[group.id];
    return {
      id,
      title: group.title,
      moduleIds: moduleIdsBySystemCategory[id],
    };
  });

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

function displayValue(
  field: SettingField,
  value: boolean | string,
  language: SystemManagementLanguage,
) {
  if (typeof value === 'boolean')
    return language === 'en'
      ? value
        ? 'Active'
        : 'Inactive'
      : value
        ? 'فعال'
        : 'غیرفعال';
  if (field.type === 'number') {
    const formatted = Number(value).toLocaleString(
      language === 'en' ? 'en-US' : 'fa-IR',
    );
    return field.unit ? `${formatted} ${field.unit}` : formatted;
  }
  return language === 'en' ? englishText(String(value)) : value;
}

function formatDate(value: string, language: SystemManagementLanguage) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? '—'
    : date.toLocaleString(language === 'en' ? 'en-US' : 'fa-IR');
}

function apiMessage(error: unknown, language: SystemManagementLanguage) {
  if (error instanceof SystemManagementApiError) {
    if (error.status === 401)
      return language === 'en'
        ? 'Sign in to continue.'
        : 'برای ادامه باید وارد سامانه شوید.';
    if (error.status === 403)
      return language === 'en'
        ? 'You do not have permission to change this setting.'
        : 'مجوز تغییر این تنظیم را ندارید.';
    if (error.status === 409)
      return language === 'en'
        ? 'This setting has changed. Refresh the page and try again.'
        : 'نسخه تنظیم تغییر کرده است؛ صفحه را تازه کنید.';
    return language === 'en' && containsPersian(error.message)
      ? 'The system-management request failed.'
      : error.message;
  }
  return language === 'en'
    ? 'Could not connect to system management.'
    : 'ارتباط با مدیریت سامانه برقرار نشد.';
}

export function SystemManagementWorkspace() {
  const preferences = useSystemPreferences();
  const language = preferences.language;
  const english = language === 'en';
  const copy = english
    ? {
        allSections: 'All sections',
        auditDirect: 'Saved directly',
        auditSensitive: 'Automatically audited',
        cancel: 'Cancel',
        card: 'settings card',
        cards: 'settings cards',
        close: 'Close',
        edit: 'Edit settings',
        empty: 'No settings found.',
        history: 'History',
        noChanges: 'No changes have been recorded in this section.',
        noReviews:
          'There are no real changes awaiting review. This page does not create synthetic status.',
        overview: 'Settings overview',
        requiredRule: 'required rule',
        requiredRules: 'required rules',
        reset: 'Reset form',
        reviewChanges: 'Review changes',
        save: 'Save changes',
        saved: 'Settings saved.',
        saving: 'Saving…',
        search: 'Search settings',
        searchPlaceholder: 'Search section, card, or setting…',
        sectionFilters: 'Section filters',
        sensitiveSaved: 'Sensitive change saved with an audit record.',
        settings: 'Settings',
        view: 'View settings',
      }
    : {
        allSections: 'همه بخش‌ها',
        auditDirect: 'ذخیره مستقیم',
        auditSensitive: 'با ثبت خودکار Audit',
        cancel: 'انصراف',
        card: 'کارت تنظیمات',
        cards: 'کارت تنظیمات',
        close: 'بستن',
        edit: 'ویرایش تنظیمات',
        empty: 'تنظیمی پیدا نشد.',
        history: 'تاریخچه',
        noChanges: 'تغییری در این بخش ثبت نشده است.',
        noReviews:
          'تغییر واقعیِ منتظر بررسی وجود ندارد. این صفحه وضعیت ساختگی ایجاد نمی‌کند.',
        overview: 'نمای کلی تنظیمات',
        requiredRule: 'قاعده الزامی',
        requiredRules: 'قاعده الزامی',
        reset: 'بازگردانی فرم',
        reviewChanges: 'بررسی تغییرات',
        save: 'ذخیره تغییرات',
        saved: 'تنظیمات ذخیره شد.',
        saving: 'در حال ذخیره…',
        search: 'جست‌وجوی تنظیمات',
        searchPlaceholder: 'جست‌وجوی بخش، کارت یا تنظیم…',
        sectionFilters: 'فیلتر بخش‌ها',
        sensitiveSaved: 'تغییر حساس همراه با Audit ثبت شد.',
        settings: 'تنظیمات',
        view: 'مشاهده تنظیمات',
      };
  const localizedModules = useMemo(
    () => localizeSettingModules(settingsModules, language),
    [language],
  );
  const [page, setPage] = useState<Page>('overview');
  const [selectedModuleId, setSelectedModuleId] = useState('general');
  const [category, setCategory] = useState<SystemCategoryId>('all');
  const [query, setQuery] = useState('');
  const scope: SettingsScope = globalScope;
  const [moduleTab, setModuleTab] = useState<'history' | 'settings'>(
    'settings',
  );
  const [settings, setSettings] = useState<SystemSettingV1[]>([]);
  const [audit, setAudit] = useState<SystemAuditRecord[]>([]);
  const [editing, setEditing] = useState<{
    module: SettingModule;
    group: SettingGroup;
  } | null>(null);
  const [draft, setDraft] = useState<Values>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [settingsResult, auditResult] = await Promise.allSettled([
      systemManagementApi.settings(),
      systemManagementApi.audit(),
    ]);
    if (settingsResult.status === 'fulfilled')
      setSettings(settingsResult.value);
    if (auditResult.status === 'fulfilled') setAudit(auditResult.value);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const syncViewFromLocation = () => {
      const moduleId = new URL(window.location.href).searchParams.get('module');
      const moduleExists = settingsModules.some(
        (settingsModule) => settingsModule.id === moduleId,
      );
      if (moduleId && moduleExists) {
        setSelectedModuleId(moduleId);
        setModuleTab('settings');
        setPage('module');
      } else {
        setPage('overview');
      }
      setEditing(null);
    };

    syncViewFromLocation();
    window.addEventListener('popstate', syncViewFromLocation);
    return () => window.removeEventListener('popstate', syncViewFromLocation);
  }, []);

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
    localizedModules.find((module) => module.id === selectedModuleId) ??
    localizedModules[0]!;

  const openOverview = useCallback(() => {
    setPage('overview');
    setEditing(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('module');
    window.history.pushState(
      { ...window.history.state, noraSystemModule: null },
      '',
      url,
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const breadcrumbs = useMemo<readonly PageBreadcrumb[]>(
    () =>
      page === 'module'
        ? [
            {
              key: 'system-management',
              title: english ? 'System management' : 'مدیریت سیستم',
              onSelect: openOverview,
            },
            {
              key: `system-module-${selectedModule.id}`,
              title: selectedModule.title,
            },
          ]
        : [
            {
              key: 'system-management',
              title: english ? 'System management' : 'مدیریت سیستم',
            },
          ],
    [english, openOverview, page, selectedModule.id, selectedModule.title],
  );
  usePageBreadcrumbs('/system', breadcrumbs);

  const ownSettingFor = (module: SettingModule, group: SettingGroup) =>
    settings.find(
      (setting) =>
        setting.namespace === module.id &&
        setting.key === group.id &&
        setting.scope === scope.scope &&
        setting.scopeId === scope.scopeId,
    );

  const settingFor = (module: SettingModule, group: SettingGroup) =>
    ownSettingFor(module, group) ??
    (scope.scope !== 'GLOBAL'
      ? settings.find(
          (setting) =>
            setting.namespace === module.id &&
            setting.key === group.id &&
            setting.scope === 'GLOBAL' &&
            setting.scopeId === null,
        )
      : undefined);

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
    return localizedModules.filter(
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
  }, [category, localizedModules, query]);

  const openModule = (module: SettingModule) => {
    setSelectedModuleId(module.id);
    setModuleTab('settings');
    setPage('module');
    const url = new URL(window.location.href);
    url.searchParams.set('module', module.id);
    window.history.pushState(
      { ...window.history.state, noraSystemModule: module.id },
      '',
      url,
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditor = (module: SettingModule, group: SettingGroup) => {
    setEditing({ module, group });
    setDraft(valuesFor(module, group));
    setPendingFile(null);
    setSaveError(null);
  };

  const saveGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const editingContractTemplate =
      editing.module.id === 'sales' && editing.group.id === 'contracts';
    const templateName = String(draft.templateName ?? '').trim();
    if (editingContractTemplate && templateName.length < 2) {
      setSaveError(
        english
          ? 'Enter a template name with at least two characters.'
          : 'نام قالب باید حداقل دو نویسه داشته باشد.',
      );
      return;
    }
    if (
      editingContractTemplate &&
      !pendingFile &&
      !String(draft.templateDocumentId ?? '').trim()
    ) {
      setSaveError(
        english
          ? 'Select the contract template file.'
          : 'فایل قالب قرارداد را انتخاب کنید.',
      );
      return;
    }
    // Only the value owned by the selected scope supplies expectedVersion.
    // An inherited global value creates a new scoped override atomically.
    const current = ownSettingFor(editing.module, editing.group);
    setSaving(true);
    setSaveError(null);
    try {
      const nextDraft = { ...draft };
      if (editingContractTemplate) delete nextDraft.template;
      if (editingContractTemplate && pendingFile) {
        const form = new FormData();
        form.set('title', templateName);
        form.set('file', pendingFile);
        const uploaded = await systemManagementApi.uploadContractTemplate(form);
        nextDraft.templateName = templateName;
        nextDraft.templateFile = uploaded.originalFileName;
        nextDraft.templateDocumentId = uploaded.id;
        nextDraft.templateScanStatus = uploaded.scanStatus;
        nextDraft.templateSizeBytes = String(uploaded.sizeBytes);
      }
      const saved = await systemManagementApi.writeSetting({
        ...(current ? { expectedVersion: current.version } : {}),
        key: editing.group.id,
        namespace: editing.module.id,
        reason: english
          ? `Updated ${editing.module.title}: ${editing.group.title}`
          : `ویرایش تنظیمات ${editing.module.title}؛ ${editing.group.title}`,
        scope: scope.scope,
        scopeId: scope.scopeId,
        status: 'ACTIVE',
        value: nextDraft,
        valueType: 'JSON',
      });
      setSettings((items) => [
        saved,
        ...items.filter((item) => item.id !== saved.id),
      ]);
      if (editing.module.id === 'general')
        window.dispatchEvent(new Event(systemPreferencesChangedEvent));
      setDraft(nextDraft);
      setPendingFile(null);
      setEditing(null);
      setToast(editing.group.sensitive ? copy.sensitiveSaved : copy.saved);
      void load();
    } catch (error) {
      setSaveError(apiMessage(error, language));
    } finally {
      setSaving(false);
    }
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
                {english && containsPersian(event.reason)
                  ? 'Recorded system change'
                  : event.reason}{' '}
                • {formatDate(event.createdAt, language)}
              </p>
            </div>
            <div className={styles.tools}>
              <span className={styles.pill}>{event.outcome}</span>
            </div>
          </article>
        ))
      ) : (
        <div className={styles.empty}>{copy.noChanges}</div>
      )}
    </div>
  );

  const renderHub = () => (
    <>
      <div className={styles.searchbar}>
        <label className={styles.search}>
          <Search aria-hidden="true" size={21} />
          <span className="sr-only">{copy.search}</span>
          <input
            aria-label={copy.search}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            value={query}
          />
        </label>
      </div>
      <nav aria-label={copy.sectionFilters} className={styles.filters}>
        <button
          aria-pressed={category === 'all'}
          className={`${styles.filter} ${category === 'all' ? styles.filterActive : ''}`}
          onClick={() => {
            setCategory('all');
          }}
          type="button"
        >
          {copy.allSections}
        </button>
        {systemCategoryGroups.map((group) => {
          return (
            <button
              aria-pressed={category === group.id}
              className={`${styles.filter} ${category === group.id ? styles.filterActive : ''}`}
              key={group.id}
              onClick={() => setCategory(group.id)}
              type="button"
            >
              {localizeCategory(group.title, language)}
            </button>
          );
        })}
      </nav>
      <div className={styles.hubGrid}>
        {filteredModules.length ? (
          filteredModules.map((module) => {
            const Icon = iconMap[module.icon] ?? Settings;
            return (
              <button
                aria-label={`${copy.view}: ${module.title}`}
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
                      {localizeCategory(
                        systemCategoryFor(module)?.title ?? module.category,
                        language,
                      )}
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
                    {module.groups.length.toLocaleString(
                      english ? 'en-US' : 'fa-IR',
                    )}{' '}
                    {module.groups.length === 1 ? copy.card : copy.cards}
                  </span>
                  <span className={styles.enter}>
                    {copy.view} <ArrowLeft aria-hidden="true" size={18} />
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className={styles.empty}>{copy.empty}</div>
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
                {selectedModule.groups.length.toLocaleString(
                  english ? 'en-US' : 'fa-IR',
                )}{' '}
                {selectedModule.groups.length === 1 ? copy.card : copy.cards} •{' '}
                {english ? 'Entire organization' : scope.title}
              </p>
            </div>
          </div>
        </div>
        {ownerAreas.length ? (
          <div className={styles.ownerLinks}>
            {ownerAreas.map((area) => (
              <p key={area.id}>
                <span>
                  {english
                    ? 'This capability is managed in its owning module.'
                    : area.description}
                </span>
                <Link href={area.href}>
                  {english
                    ? `Continue in ${area.owner}: ${area.id === 'iam' ? 'Users, roles & permissions' : area.id === 'documents' ? 'Documents & files' : area.id === 'reports' ? 'Reports & exports' : 'Operations & service health'}`
                    : `ادامه در ${area.owner}: ${area.title}`}
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
            {copy.settings}
          </button>
          <button
            className={`${styles.tab} ${moduleTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setModuleTab('history')}
            type="button"
          >
            {copy.history}
          </button>
        </div>
        {moduleTab === 'history' ? (
          renderHistory(moduleAudit)
        ) : (
          <div className={styles.settingsGrid}>
            {selectedModule.groups.map((group) => {
              const GroupIcon = iconMap[group.icon] ?? Settings;
              const values = valuesFor(selectedModule, group);
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
                          ? copy.auditSensitive
                          : copy.auditDirect}
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
                            language,
                          )}
                        </b>
                      </div>
                    ))}
                  </div>
                  {group.rules.length ? (
                    <div className={styles.locked}>
                      <LockKeyhole aria-hidden="true" />
                      <span>
                        {group.rules.length.toLocaleString(
                          english ? 'en-US' : 'fa-IR',
                        )}{' '}
                        {group.rules.length === 1
                          ? copy.requiredRule
                          : copy.requiredRules}
                      </span>
                    </div>
                  ) : null}
                  <div className={styles.cardFoot}>
                    <button
                      aria-label={`${copy.edit}: ${group.title}`}
                      className={styles.button}
                      onClick={() => openEditor(selectedModule, group)}
                      type="button"
                    >
                      <Settings aria-hidden="true" size={17} /> {copy.edit}
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
        ? copy.reviewChanges
        : page === 'history'
          ? english
            ? 'Change history'
            : 'تاریخچه تغییرات'
          : copy.overview;

  return (
    <section className={styles.workspace} dir={preferences.direction}>
      <div className={styles.main}>
        {page !== 'module' ? (
          <div className={styles.heading}>
            <h1>{pageTitle}</h1>
          </div>
        ) : null}
        {page === 'overview' ? renderHub() : null}
        {page === 'module' ? renderModule() : null}
        {page === 'history' ? renderHistory() : null}
        {page === 'reviews' ? (
          <div className={styles.empty}>
            <ShieldCheck
              aria-hidden="true"
              className="mx-auto mb-3"
              size={30}
            />
            {copy.noReviews}
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
                aria-label={copy.close}
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
                  <span>{english ? 'Entire organization' : scope.title}</span>
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
                        <span className={styles.fieldLabel}>
                          <span>{field.label}</span>
                          {field.unit ? (
                            <small className={styles.fieldUnit}>
                              {field.unit}
                            </small>
                          ) : null}
                        </span>
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
                            {field.options?.map((option, index) => (
                              <option key={option} value={option}>
                                {english
                                  ? localizeOption(option, index)
                                  : option}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'file' ? (
                          <>
                            <input
                              accept={field.accept}
                              onChange={(event) =>
                                setPendingFile(event.target.files?.[0] ?? null)
                              }
                              required={!draft.templateDocumentId}
                              type="file"
                            />
                            <small className={styles.fileStatus}>
                              {pendingFile?.name ??
                                String(draft[field.key] ?? field.value)}
                            </small>
                          </>
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
                    setPendingFile(null);
                    setSaveError(null);
                  }}
                  type="button"
                >
                  {copy.reset}
                </button>
                <div className={styles.tools}>
                  <button
                    className={styles.button}
                    disabled={saving}
                    onClick={() => setEditing(null)}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    className={`${styles.button} ${styles.primary}`}
                    disabled={saving}
                    type="submit"
                  >
                    <Save aria-hidden="true" size={18} />
                    {saving ? copy.saving : copy.save}
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
