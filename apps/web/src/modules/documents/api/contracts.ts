export const documentsLocalContractVersion = 'documents.v1-proposal' as const;
export const documentsPhaseANotice =
  'Preview / Awaiting Persistence — هیچ فایل، آپلود، نتیجه اسکن یا لینک دانلود واقعی ایجاد نمی‌شود.' as const;

export const documentsLocalPermissions = [
  'documents.read',
  'documents.upload',
  'documents.version.create',
  'documents.download',
  'documents.sensitive.read',
  'documents.sensitive.download',
  'documents.archive',
  'documents.restore',
  'documents.audit.read',
  'documents.retention.manage',
  'documents.legal_hold.manage',
  'documents.quarantine.manage',
] as const;

export type DocumentsPreviewState =
  | 'preview'
  | 'loading'
  | 'empty'
  | 'error'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict';

export const documentsPreviewStates: readonly [
  DocumentsPreviewState,
  string,
][] = [
  ['preview', 'نمایش Preview'],
  ['loading', 'در حال بارگذاری'],
  ['empty', 'بدون نتیجه'],
  ['error', 'خطای سرویس'],
  ['unauthorized', 'نیازمند ورود'],
  ['forbidden', 'دسترسی ممنوع'],
  ['conflict', 'تعارض نسخه'],
];
