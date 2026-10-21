import {
  MASTER_DATA_EDITABLE_FIELDS,
  MASTER_DATA_RESOURCES,
  type MasterDataResource,
} from '../master-data';
import { MANUAL_ACCESS_VERSION, allowAccessControl } from './manual-access';

export const USER_ACCESS_DENY_PREFIX = 'ui.deny.' as const;

export const CUSTOMER_EDITABLE_FIELDS = [
  'kind',
  'organizationId',
  'firstName',
  'lastName',
  'displayName',
  'birthDate',
  'nationalId',
  'passportNumber',
  'passportExpiryDate',
  'passportFirstName',
  'passportLastName',
  'gender',
  'nationalityCode',
  'passportIssuingCountryCode',
  'birthCountryCode',
  'roles',
  'acquaintanceMethodId',
] as const;

export const SYSTEM_SETTING_EDITABLE_KEYS = [
  'general.locale',
  'general.worktime',
  'general.numbering',
  'customers.duplicates',
  'customers.passport',
  'affairs.sla',
  'affairs.assignment',
  'affairs.closure',
  'sales.quotation',
  'sales.discount',
  'sales.contracts',
  'sales.delivery',
  'catalog.window',
  'catalog.fares',
  'operations.manifest',
  'operations.ancillary',
  'operations.insurance',
  'procurement.approval',
  'procurement.receipt',
  'marketing.audience',
  'marketing.campaign',
  'marketing.offers',
  'b2b.credit',
  'b2b.settlement',
  'b2b.commercial',
  'hr.attendance',
  'hr.leave',
  'hr.payroll',
  'hr.lifecycle',
  'hr.privacy',
  'tasks.tasks',
  'tasks.workbench',
  'messages.routing',
  'messages.quiet',
  'messages.chat',
  'messages.templates',
  'documents.upload',
  'documents.access',
  'documents.archive',
  'documents.output',
  'reports.defaults',
  'reports.export',
  'reports.schedule',
  'reports.alerts',
  'master.import',
  'master.rates',
  'master.providers',
  'integrations.registry',
] as const;

export interface UserAccessControl {
  id: string;
  kind: 'field' | 'screen';
  group: string;
  title: string;
}

export const masterDataFieldControlId = (resource: string, field: string) =>
  `field.master-data.${resource}.${field}` as const;
export const customerFieldControlId = (field: string) =>
  `field.customers.${field}` as const;
export const systemSettingControlId = (namespace: string, key: string) =>
  `field.system-settings.${namespace}.${key}` as const;
export const denyPermission = (controlId: string) =>
  `${USER_ACCESS_DENY_PREFIX}${controlId}` as const;

export const USER_ACCESS_FIELD_CONTROLS: readonly UserAccessControl[] = [
  ...Object.entries(MASTER_DATA_EDITABLE_FIELDS).flatMap(([resource, fields]) =>
    fields.map((field) => ({
      id: masterDataFieldControlId(resource, field),
      kind: 'field' as const,
      group: 'master-data',
      title: `${resource} · ${field}`,
    })),
  ),
  ...CUSTOMER_EDITABLE_FIELDS.map((field) => ({
    id: customerFieldControlId(field),
    kind: 'field' as const,
    group: 'customers',
    title: `مشتری · ${field}`,
  })),
  ...SYSTEM_SETTING_EDITABLE_KEYS.map((key) => ({
    id: `field.system-settings.${key}`,
    kind: 'field' as const,
    group: key === 'integrations.registry' ? 'integrations' : 'system',
    title: `تنظیم · ${key}`,
  })),
];

const masterDataSectionByResource: Record<MasterDataResource, string> = {
  countries: 'geography',
  regions: 'geography',
  cities: 'geography',
  airports: 'geography',
  terminals: 'geography',
  'rail-terminals': 'geography',
  currencies: 'finance',
  'exchange-rates': 'finance',
  banks: 'finance',
  'bank-branches': 'finance',
  'payment-methods': 'finance',
  organizations: 'organizations-suppliers',
  suppliers: 'organizations-suppliers',
  brokers: 'organizations-suppliers',
  'organization-contacts': 'organizations-suppliers',
  hotels: 'accommodation',
  'hotel-chains': 'accommodation',
  'room-types': 'accommodation',
  'meal-services': 'accommodation',
  facilities: 'accommodation',
  'composite-hotels': 'accommodation',
  airlines: 'transportation',
  'aircraft-types': 'transportation',
  'cabin-classes': 'transportation',
  'baggage-rules': 'transportation',
  'manifest-templates': 'transportation',
  'rail-companies': 'transportation',
  'train-types': 'transportation',
  'bus-companies': 'transportation',
  'bus-types': 'transportation',
  insurers: 'insurance',
  'insurance-plans': 'insurance',
  'insurance-coverages': 'insurance',
  leaders: 'tours-travel-services',
  'tour-types': 'tours-travel-services',
  'transfer-types': 'tours-travel-services',
  'cip-services': 'tours-travel-services',
  'visa-services': 'tours-travel-services',
  'travel-services': 'tours-travel-services',
  'acquaintance-methods': 'sales-references',
  'lead-sources': 'sales-references',
  'sales-channels': 'sales-references',
  'lost-reasons': 'sales-references',
  'customer-types': 'sales-references',
  tags: 'sales-references',
  'campaign-types': 'sales-references',
};

export function masterDataResourceParentScreen(
  resource: string,
): string | undefined {
  const section = masterDataSectionByResource[resource as MasterDataResource];
  return section ? `master-data.${section}` : undefined;
}

export const MASTER_DATA_RESOURCE_CONTROLS: readonly UserAccessControl[] =
  MASTER_DATA_RESOURCES.map((resource) => ({
    id: `master-data.resource.${resource}`,
    kind: 'screen' as const,
    group: 'master-data',
    title: `اطلاعات پایه · ${resource}`,
  }));

export function hasAccessControl(
  permissions: readonly string[],
  controlId: string,
): boolean {
  if (permissions.includes(MANUAL_ACCESS_VERSION))
    return (
      !permissions.includes(denyPermission(controlId)) &&
      permissions.includes(allowAccessControl(controlId)) &&
      (controlId.startsWith('field.') ||
        controlId.startsWith('master-data.resource.') ||
        permissions.includes(`ui.screen.${controlId}`))
    );
  return (
    permissions.includes('ui.administrator') ||
    !permissions.includes(denyPermission(controlId))
  );
}

export function changedDeniedFields(
  permissions: readonly string[],
  prefix: string,
  next: Readonly<Record<string, unknown>>,
  current?: Readonly<Record<string, unknown>>,
): string[] {
  return Object.keys(next).filter((field) => {
    if (hasAccessControl(permissions, `${prefix}.${field}`)) return false;
    return (
      !current ||
      stableAccessValue(next[field]) !== stableAccessValue(current[field])
    );
  });
}

function stableAccessValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value))
    return `[${value.map((item) => stableAccessValue(item) ?? 'null').join(',')}]`;
  if (value && typeof value === 'object') {
    const candidate = value as { toJSON?: () => unknown };
    if (typeof candidate.toJSON === 'function')
      return stableAccessValue(candidate.toJSON());
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, item]) =>
          `${JSON.stringify(key)}:${stableAccessValue(item) ?? 'null'}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function accessValuesEqual(left: unknown, right: unknown): boolean {
  return stableAccessValue(left) === stableAccessValue(right);
}

export interface AdditiveUserAccessScreen {
  id: string;
  group: string;
  title: string;
  route: string;
  tab?: string;
  query?: Record<string, string>;
  inheritFrom: string | readonly string[] | 'authenticated';
}

const childTabs = (
  group: string,
  route: string,
  parent: string,
  values: readonly (readonly [string, string])[],
  prefix = `${group}.tab`,
): AdditiveUserAccessScreen[] =>
  values.map(([tab, title]) => ({
    id: `${prefix}.${tab}`,
    group,
    title,
    route,
    tab,
    inheritFrom: parent,
  }));

const queryViews = (
  group: string,
  route: string,
  parent: string,
  key: string,
  values: readonly (readonly [string, string])[],
  prefix: string,
): AdditiveUserAccessScreen[] =>
  values.map(([value, title]) => ({
    id: `${prefix}.${value}`,
    group,
    title,
    route,
    query: { [key]: value },
    inheritFrom: parent,
  }));

export const ADDITIVE_USER_ACCESS_SCREENS: readonly AdditiveUserAccessScreen[] =
  [
    {
      id: 'system.module.integrations',
      group: 'integrations',
      title: 'تنظیمات اتصال و دسترسی',
      route: '/integrations',
      inheritFrom: 'integrations.home',
    },
    ...childTabs(
      'integrations',
      '/integrations',
      'integrations.home',
      [
        ['brands', 'برندها و سامانه‌ها'],
        ['overview', 'نمای کلی'],
        ['connections', 'اتصال‌ها و تأمین‌کنندگان'],
        ['events', 'رویدادها و وب‌هوک‌ها'],
        ['mapping', 'نگاشت و گردش داده'],
        ['sync', 'همگام‌سازی‌ها'],
        ['health', 'سلامت و خطاها'],
        ['logs', 'لاگ‌ها و سوابق'],
      ],
      'integrations.section',
    ),
    {
      id: 'ticket-purchases.home',
      group: 'procurement',
      title: 'خرید و تأمین خدمات سفر',
      route: '/ticket-purchases',
      inheritFrom: ['reservations.home', 'procurement.home'],
    },
    {
      id: 'correspondence.home',
      group: 'correspondence',
      title: 'مکاتبات',
      route: '/correspondence',
      inheritFrom: 'authenticated',
    },
    ...childTabs(
      'documents',
      '/documents',
      'documents.home',
      [
        ['preview', 'پیش‌نمایش سند'],
        ['information', 'اطلاعات سند'],
        ['access', 'دسترسی و اشتراک سند'],
        ['activity', 'فعالیت و نگهداری سند'],
      ],
      'documents.detail.tab',
    ),
    ...childTabs(
      'sales',
      '/sales/tours',
      'ticket-catalog.tab.tours',
      [
        ['intro', 'معرفی و شرایط تور'],
        ['transport', 'مشخصات سفر تور'],
        ['itinerary', 'برنامه سفر تور'],
        ['image', 'تصویر تور'],
      ],
      'sales.tours.tab',
    ),
    ...queryViews(
      'customer-affairs',
      '/customer-affairs',
      'customer-affairs.home',
      'view',
      [
        ['overview', 'نمای کلی'],
        ['leads', 'درخواست‌های مشتریان'],
        ['followups', 'پیگیری معوق'],
        ['handoffs', 'منتظر پذیرش فروش'],
        ['tickets', 'تیکت‌های پشتیبانی'],
        ['queues', 'تیکت‌های معوق'],
        ['satisfaction', 'رضایت و اقدام اصلاحی'],
        ['reports', 'گزارش‌ها'],
      ],
      'customer-affairs.view',
    ),
    ...childTabs(
      'organizations',
      '/organizations',
      'organizations.home',
      [
        ['profile', 'مشخصات و نقش‌ها'],
        ['branches', 'شعب'],
        ['representatives', 'نمایندگان'],
        ['signatories', 'امضاداران'],
        ['manager', 'مدیر حساب'],
        ['framework', 'قرارداد چارچوب'],
        ['credit', 'اعتبار و تضمین'],
        ['rates', 'نرخ‌های توافقی'],
        ['discounts', 'تخفیف'],
        ['commission', 'پورسانت'],
        ['statement', 'صورتحساب دوره‌ای'],
        ['invoice', 'فاکتور تجمیعی'],
        ['payments', 'دریافت‌ها'],
        ['checks', 'چک‌ها'],
        ['settlement', 'تسویه دوره‌ای'],
        ['disputes', 'مغایرت‌ها'],
        ['reports', 'گزارش فعالیت‌ها'],
      ],
      'organizations.profile.tab',
    ),
    ...queryViews(
      'reports',
      '/reports',
      'reports.home',
      'view',
      [
        ['catalog', 'کاتالوگ'],
        ['saved', 'ذخیره‌شده‌ها'],
        ['shared', 'اشتراکی'],
        ['recent', 'اجراهای اخیر'],
        ['downloads', 'دانلودها'],
      ],
      'reports.view',
    ),
    ...[
      'general',
      'customers',
      'affairs',
      'sales',
      'catalog',
      'operations',
      'procurement',
      'marketing',
      'b2b',
      'hr',
      'tasks',
      'messages',
      'documents',
      'reports',
      'master',
    ].map((module) => ({
      id: `system.module.${module}`,
      group: 'system',
      title: `تنظیمات ${module}`,
      route: '/system',
      query: { module },
      inheritFrom: 'system.home',
    })),
    {
      id: 'finance.accounting.taxpayer-system',
      group: 'finance',
      title: 'سامانه مؤدیان',
      route: '/finance/accounting/taxpayer-system',
      inheritFrom: [
        'finance.accounting.general-ledger.base-information',
        'finance.accounting.general-ledger.accounts',
        'finance.accounting.general-ledger.documents',
        'finance.accounting.general-ledger.year-end',
        'finance.accounting.general-ledger.reports',
        'finance.accounting.receipts-payments.reports',
      ],
    },
    {
      id: 'finance.accounting.tax-accounting',
      group: 'finance',
      title: 'حسابداری مالیاتی',
      route: '/finance/accounting/tax-accounting',
      inheritFrom: [
        'finance.accounting.general-ledger.base-information',
        'finance.accounting.general-ledger.accounts',
        'finance.accounting.general-ledger.documents',
        'finance.accounting.general-ledger.year-end',
        'finance.accounting.general-ledger.reports',
        'finance.accounting.receipts-payments.reports',
      ],
    },
  ];

export const USER_ACCESS_DENY_CONTROLS: readonly UserAccessControl[] = [
  ...ADDITIVE_USER_ACCESS_SCREENS.map(({ id, group, title }) => ({
    id,
    group,
    title,
    kind: 'screen' as const,
  })),
  ...MASTER_DATA_RESOURCE_CONTROLS,
  ...USER_ACCESS_FIELD_CONTROLS,
];

export function isUserAccessControlId(id: string): boolean {
  return USER_ACCESS_DENY_CONTROLS.some((control) => control.id === id);
}
