import {
  DOCUMENT_DOMAIN_CODES,
  type DocumentDomainCode,
  type DocumentRelationV1,
} from '@rubi/contracts';

export type ConnectedDocumentsSection =
  'all' | 'customer' | 'sales' | 'travel' | 'procurement' | 'hr';

export interface DocumentConnectionDefinition {
  domain: DocumentDomainCode;
  documentsSection: ConnectedDocumentsSection;
  sectionLabel: string;
  moduleLabel: string;
  moduleHref: `/${string}` | null;
  description: string;
}

const connectionByDomain = {
  CUSTOMER_IDENTITY: {
    domain: 'CUSTOMER_IDENTITY',
    documentsSection: 'customer',
    sectionLabel: 'مشتری و هویت',
    moduleLabel: 'مشتریان و مسافران',
    moduleHref: '/customers',
    description:
      'مدارک هویتی در پرونده مشتری ثبت می‌شوند و نسخه نهایی آن‌ها در آرشیو اسناد نگه‌داری می‌شود.',
  },
  SALES: {
    domain: 'SALES',
    documentsSection: 'sales',
    sectionLabel: 'فروش و قرارداد',
    moduleLabel: 'قراردادها و فروش',
    moduleHref: '/sales',
    description:
      'قرارداد، پیشنهاد قیمت و پیوست‌های فروش در ماژول فروش صادر و نسخه نهایی آن‌ها اینجا آرشیو می‌شود.',
  },
  TRAVEL: {
    domain: 'TRAVEL',
    documentsSection: 'travel',
    sectionLabel: 'سفر و رزرواسیون',
    moduleLabel: 'رزرواسیون و عملیات سفر',
    moduleHref: '/reservations',
    description:
      'واچر، برنامه سفر و مدارک عملیاتی از پرونده سفر می‌آیند و فایل نهایی در آرشیو نگه‌داری می‌شود.',
  },
  PROCUREMENT: {
    domain: 'PROCUREMENT',
    documentsSection: 'procurement',
    sectionLabel: 'خرید و تأمین',
    moduleLabel: 'خرید و تأمین',
    moduleHref: '/purchases',
    description:
      'استعلام، سفارش و مدارک تأمین در ماژول خرید مدیریت و نسخه نهایی آن‌ها در آرشیو ثبت می‌شود.',
  },
  FINANCE: {
    domain: 'FINANCE',
    documentsSection: 'procurement',
    sectionLabel: 'مالی',
    moduleLabel: 'مالی و خزانه‌داری',
    moduleHref: '/finance',
    description:
      'رسیدها و اسناد مالی در ماژول مالی ثبت می‌شوند و فایل نهایی قابل استناد در آرشیو باقی می‌ماند.',
  },
  HUMAN_RESOURCES: {
    domain: 'HUMAN_RESOURCES',
    documentsSection: 'hr',
    sectionLabel: 'منابع انسانی',
    moduleLabel: 'منابع انسانی',
    moduleHref: '/human-resources',
    description:
      'مدارک کارکنان در پرونده منابع انسانی مدیریت و نسخه نهایی آن‌ها در آرشیو امن نگه‌داری می‌شود.',
  },
  ORGANIZATION: {
    domain: 'ORGANIZATION',
    documentsSection: 'hr',
    sectionLabel: 'سازمان',
    moduleLabel: 'آژانس‌ها و مشتریان سازمانی',
    moduleHref: '/organizations',
    description:
      'مدارک ثبتی و همکاری سازمان‌ها در پرونده سازمانی تعریف و نسخه نهایی آن‌ها در آرشیو ثبت می‌شود.',
  },
  REPORTING: {
    domain: 'REPORTING',
    documentsSection: 'all',
    sectionLabel: 'گزارش‌ها',
    moduleLabel: 'گزارش‌ها',
    moduleHref: '/reports',
    description:
      'خروجی نهایی گزارش‌ها پس از تولید در ماژول گزارش‌ها برای نگه‌داری و کنترل دسترسی به آرشیو سپرده می‌شود.',
  },
  BRAND: {
    domain: 'BRAND',
    documentsSection: 'all',
    sectionLabel: 'شرکت و برند',
    moduleLabel: 'شرکت‌های صادرکننده',
    moduleHref: '/system/legal-entities',
    description:
      'اسناد ثبتی شرکت و برند در بخش شرکت‌های صادرکننده مدیریت و فایل نهایی آن‌ها در آرشیو نگه‌داری می‌شود.',
  },
  GENERAL: {
    domain: 'GENERAL',
    documentsSection: 'all',
    sectionLabel: 'آرشیو عمومی',
    moduleLabel: 'آرشیو عمومی اسناد',
    moduleHref: null,
    description:
      'این اسناد ماژول مبدأ جداگانه ندارند و مستقیماً در آرشیو عمومی اسناد مدیریت می‌شوند.',
  },
} as const satisfies Record<DocumentDomainCode, DocumentConnectionDefinition>;

export const DOCUMENT_CONNECTIONS = DOCUMENT_DOMAIN_CODES.map(
  (domain) => connectionByDomain[domain],
);

export function getDocumentConnection(
  domain: DocumentDomainCode,
): DocumentConnectionDefinition {
  return connectionByDomain[domain];
}

const domainBySourceModule: Readonly<Record<string, DocumentDomainCode>> = {
  customer: 'CUSTOMER_IDENTITY',
  customers: 'CUSTOMER_IDENTITY',
  'customer-identity': 'CUSTOMER_IDENTITY',
  sales: 'SALES',
  contracts: 'SALES',
  'sales-contracts': 'SALES',
  travel: 'TRAVEL',
  reservation: 'TRAVEL',
  reservations: 'TRAVEL',
  procurement: 'PROCUREMENT',
  purchase: 'PROCUREMENT',
  purchases: 'PROCUREMENT',
  finance: 'FINANCE',
  hr: 'HUMAN_RESOURCES',
  'human-resources': 'HUMAN_RESOURCES',
  organization: 'ORGANIZATION',
  organizations: 'ORGANIZATION',
  reporting: 'REPORTING',
  reports: 'REPORTING',
  brand: 'BRAND',
  'legal-entities': 'BRAND',
  documents: 'GENERAL',
  general: 'GENERAL',
};

function normalizeSourceModule(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

export function getDocumentRelationConnection(
  relation: Pick<DocumentRelationV1, 'sourceModule'>,
  fallbackDomain: DocumentDomainCode,
): DocumentConnectionDefinition {
  const sourceModule = normalizeSourceModule(relation.sourceModule);
  const domain = domainBySourceModule[sourceModule] ?? fallbackDomain;
  return getDocumentConnection(domain);
}

export function documentRelationSourceLabel(
  relation: Pick<DocumentRelationV1, 'sourceModule'>,
  fallbackDomain: DocumentDomainCode,
): string {
  const connection = getDocumentRelationConnection(relation, fallbackDomain);
  return normalizeSourceModule(relation.sourceModule) === 'documents-demo'
    ? `داده آزمایشیِ ${connection.moduleLabel}`
    : connection.moduleLabel;
}

const relationTypeLabel: Readonly<Record<string, string>> = {
  PRIMARY_CASE: 'پرونده اصلی',
  ATTACHMENT: 'پیوست پرونده',
  SUPPORTING_DOCUMENT: 'مدرک پشتیبان',
  ISSUED_DOCUMENT: 'سند صادرشده',
  IDENTITY_DOCUMENT: 'مدرک هویتی',
  CONTRACT_DOCUMENT: 'مدرک قرارداد',
};

export function documentRelationTypeLabel(value: string): string {
  return relationTypeLabel[value.trim().toUpperCase()] ?? 'پرونده مرتبط';
}

export function createDocumentConnectionHref(
  connection: DocumentConnectionDefinition,
  context?: { documentId?: string; relationId?: string },
): string | null {
  if (!connection.moduleHref) return null;
  if (!context?.documentId) return connection.moduleHref;

  const search = new URLSearchParams({
    from: 'documents',
    document: context.documentId,
  });
  if (context.relationId) search.set('relation', context.relationId);
  return `${connection.moduleHref}?${search.toString()}`;
}
