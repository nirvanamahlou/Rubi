import type {
  DocumentListQueryV1,
  DocumentOptionsResponseV1,
  DocumentValidityFilter,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';

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

export interface OrganizationDocumentInput {
  title: string;
  documentTypeId: string;
  categoryId: string;
  branchId: string;
  validUntil: string;
  requiresStepUpVerification: boolean;
}

/** The canonical identity, owner and classification never come from editable inputs. */
export function organizationDocumentForm(
  organization: MasterDataRecord,
  input: OrganizationDocumentInput,
  file: File,
  options: OrganizationDocumentOptions,
  permissions: readonly IamPermissionCode[],
): FormData {
  if (
    !permissions.includes('documents.upload') ||
    !canReadOrganizationDocuments(permissions)
  )
    throw new Error('مجوز بارگذاری اسناد سازمان را ندارید.');
  if (!organization.id || organization.resource !== 'organizations')
    throw new Error('هویت ذخیره‌شده سازمان معتبر نیست.');
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
  if (input.validUntil) {
    const parsed = new Date(`${input.validUntil}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.validUntil) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== input.validUntil
    )
      throw new Error('تاریخ انقضا معتبر نیست.');
  }
  const form = new FormData();
  form.set('file', file);
  form.set('title', input.title.trim());
  form.set('documentTypeId', type.id);
  form.set('categoryId', input.categoryId);
  form.set('branchId', input.branchId);
  form.set('ownerUserId', options.currentUserId);
  form.set('confidentiality', type.defaultConfidentiality);
  form.set('sourceModule', 'master-data');
  form.set('sourceEntityType', 'organizations');
  form.set('sourceEntityId', organization.id);
  form.set('sourceDisplayLabel', organization.code);
  form.set(
    'requiresStepUpVerification',
    String(input.requiresStepUpVerification),
  );
  if (input.validUntil)
    form.set('validUntil', `${input.validUntil}T23:59:59.999Z`);
  return form;
}
