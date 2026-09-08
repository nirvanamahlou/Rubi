import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import type { MasterDataLogoChange } from '@/modules/master-data/api/client';
import { documentsApi } from '@/modules/documents/api/client';
import { saveOrganizationChanges } from './record-mutations';

export const ORGANIZATION_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export function canViewOrganizationLogo(
  permissions: readonly IamPermissionCode[],
): boolean {
  return (
    [
      'documents.metadata.read',
      'documents.brand.read',
      'documents.file.read',
    ] as const
  ).every((permission) => permissions.includes(permission));
}

export function canUploadOrganizationLogo(
  permissions: readonly IamPermissionCode[],
): boolean {
  return (
    [
      'master_data.update',
      'documents.upload',
      'documents.list',
      'documents.brand.read',
    ] as const
  ).every((permission) => permissions.includes(permission));
}

export function organizationLogoFileIssue(file: File): string | undefined {
  if (!['image/png', 'image/jpeg'].includes(file.type))
    return 'تصویر لوگو باید PNG یا JPEG باشد.';
  if (file.size === 0 || file.size > ORGANIZATION_LOGO_MAX_BYTES)
    return 'فایل لوگو باید غیرخالی و حداکثر ۵ مگابایت باشد.';
  return undefined;
}

export function saveOrganizationLogo(
  organization: MasterDataRecord,
  change: MasterDataLogoChange,
  permissions: readonly IamPermissionCode[],
) {
  if (
    organization.resource !== 'organizations' ||
    !organization.id ||
    !Number.isSafeInteger(organization.version) ||
    organization.version < 1
  )
    throw new Error('ابتدا پرونده سازمان را ذخیره یا تازه‌سازی کنید.');
  if (change.kind === 'replace') {
    if (!canUploadOrganizationLogo(permissions))
      throw new Error('مجوز بارگذاری لوگو را ندارید.');
    const issue = organizationLogoFileIssue(change.file);
    if (issue) throw new Error(issue);
  }
  return saveOrganizationChanges({
    record: organization,
    values: {},
    permissions,
    defaultRole: 'AGENCY',
    logoChange: change,
  });
}

export async function organizationLogoPreview(
  documentId: string,
  permissions: readonly IamPermissionCode[],
  signal: AbortSignal,
): Promise<{ blob: Blob } | { reason: string }> {
  if (!canViewOrganizationLogo(permissions))
    return { reason: 'مجوز نمایش تصویر لوگو را ندارید.' };
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const { data } = await documentsApi.detail(documentId);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (
    data.type.domain !== 'BRAND' ||
    data.archiveStatus !== 'ACTIVE' ||
    !data.capabilities.viewFile ||
    data.currentVersion.scanStatus !== 'CLEAN'
  )
    return {
      reason:
        'لوگو ثبت شده است؛ نمایش آن به وضعیت و بررسی امنیتی فایل بستگی دارد.',
    };
  if (
    data.requiresStepUpVerification ||
    !['PUBLIC', 'INTERNAL'].includes(data.confidentiality)
  )
    return {
      reason: 'برای مشاهده این لوگو، اعتبارسنجی را در آرشیو اسناد انجام دهید.',
    };
  const response = await documentsApi.preview(documentId, undefined, signal);
  if (
    !['image/png', 'image/jpeg'].includes(response.blob.type) ||
    response.blob.size === 0 ||
    response.blob.size > ORGANIZATION_LOGO_MAX_BYTES
  )
    return { reason: 'قالب یا اندازه تصویر برای نمایش لوگو مناسب نیست.' };
  return { blob: response.blob };
}
