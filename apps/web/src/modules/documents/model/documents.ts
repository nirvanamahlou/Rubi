import type { DocumentsPreviewState } from '../api/contracts';

export type DocumentsSection =
  | 'dashboard'
  | 'all'
  | 'categories'
  | 'versions'
  | 'sensitive'
  | 'quarantine'
  | 'archive'
  | 'history';

export type PreviewDocumentCategory =
  | 'قرارداد فروش'
  | 'بلیت'
  | 'واچر هتل'
  | 'بیمه‌نامه'
  | 'Manifest'
  | 'اسناد مالی'
  | 'مدارک مشتری و مسافر'
  | 'منابع انسانی'
  | 'بازاریابی'
  | 'اسناد عمومی';

export type PreviewConfidentiality =
  'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type PreviewScanStatus =
  | 'PENDING_SCAN'
  | 'CLEAN'
  | 'INFECTED'
  | 'SCAN_FAILED'
  | 'QUARANTINED'
  | 'AWAITING_ANTIVIRUS_ADAPTER';

export interface PreviewDocument {
  id: string;
  displayName: string;
  category: PreviewDocumentCategory;
  sourceModule: string;
  sourceRecord: string;
  issuer: string;
  version: number;
  sizeLabel: string;
  sizeBytes: number;
  format: string;
  confidentiality: PreviewConfidentiality;
  scanStatus: PreviewScanStatus;
  archiveStatus: 'ACTIVE' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  masked: boolean;
  legalHold: boolean;
}

export interface PreviewDocumentQuery {
  search: string;
  category: PreviewDocumentCategory | 'ALL';
  confidentiality: PreviewConfidentiality | 'ALL';
  scanStatus: PreviewScanStatus | 'ALL';
  archiveStatus: PreviewDocument['archiveStatus'] | 'ALL';
  sortBy: 'updatedAt' | 'displayName' | 'sizeBytes';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const documentCategories: readonly PreviewDocumentCategory[] = [
  'قرارداد فروش',
  'بلیت',
  'واچر هتل',
  'بیمه‌نامه',
  'Manifest',
  'اسناد مالی',
  'مدارک مشتری و مسافر',
  'منابع انسانی',
  'بازاریابی',
  'اسناد عمومی',
];

export const previewDocuments: readonly PreviewDocument[] = [
  {
    id: 'preview-document-001',
    displayName: 'قرارداد فروش نمونه ۱۴۰۵-۰۰۱',
    category: 'قرارداد فروش',
    sourceModule: 'Sales Contracts',
    sourceRecord: 'preview-sales-contract-001',
    issuer: 'شرکت صادرکننده نمونه الف',
    version: 3,
    sizeLabel: '۲٫۴ MB',
    sizeBytes: 2_400_000,
    format: 'PDF',
    confidentiality: 'CONFIDENTIAL',
    scanStatus: 'CLEAN',
    archiveStatus: 'ACTIVE',
    createdBy: 'کارشناس نمونه فروش',
    createdAt: '2026-08-27T09:30:00.000Z',
    updatedAt: '2026-09-01T07:20:00.000Z',
    expiresAt: null,
    masked: false,
    legalHold: false,
  },
  {
    id: 'preview-document-002',
    displayName: 'بلیت نهایی نمونه مسیر تهران–استانبول',
    category: 'بلیت',
    sourceModule: 'Reservations',
    sourceRecord: 'preview-issued-ticket-002',
    issuer: 'شرکت صادرکننده نمونه ب',
    version: 1,
    sizeLabel: '۸۴۰ KB',
    sizeBytes: 840_000,
    format: 'PDF',
    confidentiality: 'INTERNAL',
    scanStatus: 'PENDING_SCAN',
    archiveStatus: 'ACTIVE',
    createdBy: 'اپراتور نمونه',
    createdAt: '2026-09-01T06:45:00.000Z',
    updatedAt: '2026-09-01T06:45:00.000Z',
    expiresAt: '2026-09-03T00:00:00.000Z',
    masked: false,
    legalHold: false,
  },
  {
    id: 'preview-document-003',
    displayName: 'فایل قرنطینه‌شده نمونه',
    category: 'اسناد عمومی',
    sourceModule: 'Documents',
    sourceRecord: 'preview-upload-session-003',
    issuer: 'فاقد صادرکننده',
    version: 1,
    sizeLabel: '۱٫۱ MB',
    sizeBytes: 1_100_000,
    format: 'DOCX',
    confidentiality: 'INTERNAL',
    scanStatus: 'QUARANTINED',
    archiveStatus: 'ACTIVE',
    createdBy: 'کاربر نمونه',
    createdAt: '2026-08-31T14:10:00.000Z',
    updatedAt: '2026-08-31T14:15:00.000Z',
    expiresAt: null,
    masked: false,
    legalHold: false,
  },
  {
    id: 'preview-document-004',
    displayName: 'سند محرمانه ••••••••',
    category: 'منابع انسانی',
    sourceModule: 'Human Resources',
    sourceRecord: 'preview-hr-record-masked',
    issuer: 'نمایش محدود',
    version: 2,
    sizeLabel: '—',
    sizeBytes: 0,
    format: 'MASKED',
    confidentiality: 'RESTRICTED',
    scanStatus: 'CLEAN',
    archiveStatus: 'ACTIVE',
    createdBy: 'نمایش محدود',
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    expiresAt: null,
    masked: true,
    legalHold: true,
  },
  {
    id: 'preview-document-005',
    displayName: 'واچر آرشیوشده نمونه',
    category: 'واچر هتل',
    sourceModule: 'Reservations',
    sourceRecord: 'preview-voucher-005',
    issuer: 'شرکت صادرکننده نمونه الف',
    version: 4,
    sizeLabel: '۱٫۷ MB',
    sizeBytes: 1_700_000,
    format: 'PDF',
    confidentiality: 'INTERNAL',
    scanStatus: 'CLEAN',
    archiveStatus: 'ARCHIVED',
    createdBy: 'کارشناس نمونه رزرو',
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
    expiresAt: '2026-09-10T00:00:00.000Z',
    masked: false,
    legalHold: false,
  },
  {
    id: 'preview-document-006',
    displayName: 'Manifest نمونه در انتظار آنتی‌ویروس',
    category: 'Manifest',
    sourceModule: 'Reservations',
    sourceRecord: 'preview-manifest-006',
    issuer: 'شرکت صادرکننده نمونه ب',
    version: 2,
    sizeLabel: '۳۲۰ KB',
    sizeBytes: 320_000,
    format: 'XLSX',
    confidentiality: 'CONFIDENTIAL',
    scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
    archiveStatus: 'ACTIVE',
    createdBy: 'کارشناس نمونه عملیات',
    createdAt: '2026-09-01T05:20:00.000Z',
    updatedAt: '2026-09-01T05:21:00.000Z',
    expiresAt: null,
    masked: false,
    legalHold: false,
  },
];

export const previewAccessHistory = [
  {
    id: 'preview-access-001',
    action: 'مشاهده',
    actor: 'کارشناس نمونه فروش',
    occurredAt: '2026-09-01T07:25:00.000Z',
    ipSummary: '192.0.2.xxx',
    userAgent: 'مرورگر سازمانی · Windows',
    reason: 'بررسی پرونده فروش نمونه',
    outcome: 'مجاز',
  },
  {
    id: 'preview-access-002',
    action: 'دانلود ناموفق',
    actor: 'کاربر خارج از شعبه',
    occurredAt: '2026-09-01T07:10:00.000Z',
    ipSummary: '198.51.100.xxx',
    userAgent: 'مرورگر ناشناس',
    reason: 'فاقد Branch Scope',
    outcome: 'ردشده',
  },
  {
    id: 'preview-access-003',
    action: 'ایجاد نسخه',
    actor: 'کارشناس نمونه رزرو',
    occurredAt: '2026-08-31T12:40:00.000Z',
    ipSummary: '203.0.113.xxx',
    userAgent: 'مرورگر سازمانی · macOS',
    reason: 'اصلاح نسخه نهایی نمونه',
    outcome: 'مجاز',
  },
] as const;

export const defaultDocumentQuery: PreviewDocumentQuery = {
  search: '',
  category: 'ALL',
  confidentiality: 'ALL',
  scanStatus: 'ALL',
  archiveStatus: 'ALL',
  sortBy: 'updatedAt',
  sortDirection: 'desc',
  page: 1,
  pageSize: 5,
};

export function normalizeDocumentQuery(
  input: Partial<PreviewDocumentQuery>,
): PreviewDocumentQuery {
  return {
    ...defaultDocumentQuery,
    ...input,
    search: input.search?.trim().slice(0, 120) ?? '',
    page: Number.isFinite(input.page)
      ? Math.max(1, Math.trunc(input.page!))
      : 1,
    pageSize: Number.isFinite(input.pageSize)
      ? Math.min(50, Math.max(5, Math.trunc(input.pageSize!)))
      : 25,
  };
}

export function filterPreviewDocuments(
  documents: readonly PreviewDocument[],
  query: PreviewDocumentQuery,
): readonly PreviewDocument[] {
  const search = query.search.toLocaleLowerCase('fa');
  const filtered = documents.filter((document) => {
    const searchable = [
      document.displayName,
      document.id,
      document.sourceModule,
      document.sourceRecord,
      document.issuer,
      document.createdBy,
    ]
      .join(' ')
      .toLocaleLowerCase('fa');
    return (
      (!search || searchable.includes(search)) &&
      (query.category === 'ALL' || document.category === query.category) &&
      (query.confidentiality === 'ALL' ||
        document.confidentiality === query.confidentiality) &&
      (query.scanStatus === 'ALL' ||
        document.scanStatus === query.scanStatus) &&
      (query.archiveStatus === 'ALL' ||
        document.archiveStatus === query.archiveStatus)
    );
  });
  return [...filtered].sort((left, right) => {
    const comparison =
      query.sortBy === 'sizeBytes'
        ? left.sizeBytes - right.sizeBytes
        : query.sortBy === 'displayName'
          ? left.displayName.localeCompare(right.displayName, 'fa')
          : left.updatedAt.localeCompare(right.updatedAt);
    return query.sortDirection === 'asc' ? comparison : -comparison;
  });
}

export function paginatePreviewDocuments(
  documents: readonly PreviewDocument[],
  page: number,
  pageSize: number,
): readonly PreviewDocument[] {
  const start = (Math.max(1, page) - 1) * pageSize;
  return documents.slice(start, start + pageSize);
}

export function shouldBlockPreviewDownload(document: PreviewDocument): string {
  if (document.masked) return 'SENSITIVE_PERMISSION_REQUIRED';
  if (document.archiveStatus === 'ARCHIVED') return 'DOCUMENT_ARCHIVED';
  if (document.scanStatus === 'QUARANTINED') return 'QUARANTINED';
  if (document.scanStatus !== 'CLEAN') return 'SCAN_REQUIRED';
  return 'PREVIEW_NO_SIGNED_URL';
}

export function stateDescription(state: DocumentsPreviewState): string {
  const descriptions: Record<DocumentsPreviewState, string> = {
    preview: 'داده‌های کاملاً synthetic و بدون Persistence نمایش داده می‌شوند.',
    loading: 'قرارداد آینده در حال دریافت فهرست صفحه‌بندی‌شده است.',
    empty: 'برای فیلترهای انتخاب‌شده سندی وجود ندارد.',
    error: 'سرویس اسناد پاسخ معتبر برنگرداند.',
    unauthorized: 'برای مشاهده Workspace باید وارد سامانه شوید.',
    forbidden: 'Permission یا Branch Scope لازم در دسترس نیست.',
    conflict: 'نسخه مورد انتظار تغییر کرده و عملیات باید دوباره بررسی شود.',
  };
  return descriptions[state];
}
