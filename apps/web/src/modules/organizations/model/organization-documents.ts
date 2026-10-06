import type {
  DocumentListItemV1,
  DocumentListQueryV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
  DocumentValidityFilter,
  IamPermissionCode,
  MasterDataRecord,
} from '@nora/contracts';
import { dossierDateBoundary } from './dossier-date-range';

/** Documents stores expiry as the end of the selected Tehran business day. */
export function formatOrganizationDocumentExpiry(value: string) {
  return new Date(value).toLocaleDateString('fa-IR', { timeZone: 'UTC' });
}

export type OrganizationDocumentOptions = DocumentOptionsResponseV1['data'];

export function organizationDocumentQuery(
  organizationId: string,
  branchId: string,
  page = 1,
  validity: DocumentValidityFilter = 'ALL',
): DocumentListQueryV1 {
  if (!organizationId || !branchId)
    throw new Error('سازمان و شعبه الزامی است.');
  return {
    sourceModule: 'master-data',
    sourceEntityType: 'organizations',
    sourceEntityId: organizationId,
    branchId,
    domain: 'ORGANIZATION',
    archiveStatus: 'ACTIVE',
    validity,
    sortBy: 'createdAt',
    sortDirection: 'desc',
    page,
    pageSize: 20,
  };
}

export function canReadOrganizationDocuments(
  permissions: readonly IamPermissionCode[],
) {
  return (
    permissions.includes('documents.list') &&
    permissions.includes('documents.organization.read')
  );
}

/** Linking a proof uses the stricter B2B public reference service. */
export function canAttachOrganizationDocument(
  permissions: readonly IamPermissionCode[],
) {
  return (
    canReadOrganizationDocuments(permissions) &&
    permissions.includes('documents.metadata.read')
  );
}

export function isEligibleOrganizationSignatoryProof(
  document: DocumentListItemV1,
  asOf: number,
) {
  const expiry = document.validUntil
    ? Date.parse(document.validUntil)
    : undefined;
  return (
    document.currentVersion.scanStatus === 'CLEAN' &&
    !document.isIncomplete &&
    (expiry === undefined || (Number.isFinite(expiry) && expiry > asOf))
  );
}

export function resolveOrganizationSignatoryProof(
  documents: readonly DocumentListItemV1[],
  documentId: string,
  asOf: number,
) {
  if (!documentId)
    return {
      documentId: null,
      documentVersionId: null,
      isActive: false,
    } as const;
  const document = documents.find((item) => item.id === documentId);
  if (!document || !isEligibleOrganizationSignatoryProof(document, asOf))
    return {
      documentId: null,
      documentVersionId: null,
      isActive: false,
    } as const;
  return {
    documentId: document.id,
    documentVersionId: document.currentVersion.id,
  } as const;
}

export async function loadOrganizationSignatoryProofs(
  organizationId: string,
  branchId: string,
  page: number,
  permissions: readonly IamPermissionCode[],
  list: (query: DocumentListQueryV1) => Promise<DocumentListResponseV1>,
) {
  if (!canAttachOrganizationDocument(permissions)) return null;
  return list({
    ...organizationDocumentQuery(organizationId, branchId, page),
    pageSize: 100,
  });
}

export interface OrganizationDocumentInput {
  title: string;
  description?: string;
  documentTypeId: string;
  categoryId: string;
  branchId: string;
  validUntil: string;
  requiresStepUpVerification: boolean;
  confidentialAccessCode?: string;
}

export interface StagedOrganizationDocument {
  input: OrganizationDocumentInput;
  file: File;
}

export function validateOrganizationDocumentInput(
  input: OrganizationDocumentInput,
  file: File,
  options: OrganizationDocumentOptions,
  permissions: readonly IamPermissionCode[],
) {
  if (
    !permissions.includes('documents.upload') ||
    !canReadOrganizationDocuments(permissions)
  )
    throw new Error('مجوز بارگذاری اسناد سازمان را ندارید.');
  if (!options.branches.some((branch) => branch.id === input.branchId))
    throw new Error('شعبه در دسترسی فعلی شما نیست.');
  if (
    !options.currentUserId ||
    !options.owners.some((owner) => owner.id === options.currentUserId)
  )
    throw new Error('مالک سند در گزینه‌های مجاز موجود نیست.');
  const type = options.documentTypes.find(
    (item) =>
      item.id === input.documentTypeId && item.domain === 'ORGANIZATION',
  );
  if (!type) throw new Error('نوع سند سازمان را انتخاب کنید.');
  if (!options.categories.some((item) => item.id === input.categoryId))
    throw new Error('دسته‌بندی معتبر را انتخاب کنید.');
  if (input.title.trim().length < 2 || input.title.trim().length > 240)
    throw new Error('عنوان سند باید بین ۲ تا ۲۴۰ حرف باشد.');
  if ((input.description?.trim().length ?? 0) > 1000)
    throw new Error('توضیحات سند نباید بیشتر از ۱۰۰۰ حرف باشد.');
  if (
    file.size === 0 ||
    file.size >
      Math.min(type.maxFileSizeBytes, options.uploadPolicy.maxFileSizeBytes)
  )
    throw new Error('اندازه فایل خارج از محدوده مجاز است.');
  if (
    !type.allowedMimeTypes.includes(file.type) ||
    !options.uploadPolicy.allowedMimeTypes.includes(file.type)
  )
    throw new Error('نوع فایل برای این سند مجاز نیست.');
  if (type.requiresExpiry && !input.validUntil)
    throw new Error('تاریخ انقضای این نوع سند الزامی است.');
  if (
    type.defaultConfidentiality === 'CONFIDENTIAL' &&
    !/^\d{6}$/u.test(input.confidentialAccessCode ?? '')
  )
    throw new Error('برای سند محرمانه، کد شش‌رقمی تعیین کنید.');
  if (input.validUntil) {
    const parsed = new Date(`${input.validUntil}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== input.validUntil
    )
      throw new Error('تاریخ انقضا معتبر نیست.');
  }
  return type;
}

/** The canonical identity, owner and classification never come from editable inputs. */
export function organizationDocumentForm(
  organization: MasterDataRecord,
  input: OrganizationDocumentInput,
  file: File,
  options: OrganizationDocumentOptions,
  permissions: readonly IamPermissionCode[],
): FormData {
  if (!organization.id || organization.resource !== 'organizations')
    throw new Error('هویت ذخیره‌شده سازمان معتبر نیست.');
  const type = validateOrganizationDocumentInput(
    input,
    file,
    options,
    permissions,
  );
  const form = new FormData();
  form.set('file', file);
  form.set('title', input.title.trim());
  if (input.description?.trim())
    form.set('description', input.description.trim());
  form.set('documentTypeId', type.id);
  form.set('categoryId', input.categoryId);
  form.set('branchId', input.branchId);
  form.set('ownerUserId', options.currentUserId);
  form.set('confidentiality', type.defaultConfidentiality);
  if (type.defaultConfidentiality === 'CONFIDENTIAL')
    form.set('confidentialAccessCode', input.confidentialAccessCode!);
  form.set('sourceModule', 'master-data');
  form.set('sourceEntityType', 'organizations');
  form.set('sourceEntityId', organization.id);
  form.set('sourceDisplayLabel', organization.code);
  form.set(
    'requiresStepUpVerification',
    String(input.requiresStepUpVerification),
  );
  if (input.validUntil)
    form.set('validUntil', dossierDateBoundary(input.validUntil, true));
  return form;
}

export const ORGANIZATION_SIGNATORY_PROOF_POLL_DELAYS = [
  2_000, 4_000, 8_000, 15_000, 15_000,
] as const;

export type OrganizationSignatoryProofPollResult =
  | {
      state: 'ready';
      documentId: string;
      documentVersionId: string;
    }
  | { state: 'pending' }
  | { state: 'rejected'; message: string }
  | { state: 'denied' }
  | { state: 'aborted' };

export function mergeOrganizationSignatoryProof<T extends object>(
  current: T,
  proof: { documentId: string; documentVersionId: string },
) {
  return { ...current, ...proof };
}

function waitForProofPoll(delay: number, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(true);
    }, delay);
    const abort = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Polls only the existing exact-source list and never weakens proof eligibility. */
export async function awaitOrganizationSignatoryProof(
  organizationId: string,
  branchId: string,
  documentId: string,
  permissions: readonly IamPermissionCode[],
  list: (query: DocumentListQueryV1) => Promise<DocumentListResponseV1>,
  signal: AbortSignal,
  delays: readonly number[] = ORGANIZATION_SIGNATORY_PROOF_POLL_DELAYS,
  wait: (
    delay: number,
    signal: AbortSignal,
  ) => Promise<boolean> = waitForProofPoll,
): Promise<OrganizationSignatoryProofPollResult> {
  if (!canAttachOrganizationDocument(permissions)) return { state: 'denied' };
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (signal.aborted) return { state: 'aborted' };
    let page = 1;
    let totalPages = 1;
    let document: DocumentListItemV1 | undefined;
    do {
      const response = await list({
        ...organizationDocumentQuery(organizationId, branchId, page),
        pageSize: 100,
      });
      if (signal.aborted) return { state: 'aborted' };
      document = response.data.find((item) => item.id === documentId);
      totalPages = Math.min(response.meta.totalPages, 10);
      page += 1;
    } while (!document && page <= totalPages);
    if (document) {
      if (
        document.branchId !== branchId ||
        document.type.domain !== 'ORGANIZATION' ||
        document.archiveStatus !== 'ACTIVE'
      )
        return {
          state: 'rejected',
          message: 'مدرک بارگذاری‌شده با پرونده و شعبه جاری هم‌خوان نیست.',
        };
      if (document.currentVersion.scanStatus === 'CLEAN') {
        if (!isEligibleOrganizationSignatoryProof(document, Date.now()))
          return {
            state: 'rejected',
            message:
              'مدرک بارگذاری‌شده کامل یا دارای اعتبار قابل استفاده نیست.',
          };
        return {
          state: 'ready',
          documentId: document.id,
          documentVersionId: document.currentVersion.id,
        };
      }
      if (
        ['INFECTED', 'QUARANTINED', 'SCAN_FAILED'].includes(
          document.currentVersion.scanStatus,
        )
      )
        return {
          state: 'rejected',
          message: 'بررسی امنیتی مدرک بارگذاری‌شده موفق نبود.',
        };
    }
    if (attempt === delays.length) return { state: 'pending' };
    if (!(await wait(delays[attempt]!, signal))) return { state: 'aborted' };
  }
  return { state: 'pending' };
}
