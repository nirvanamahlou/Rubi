import type { IamPermissionCode, MasterDataRecord } from '@nora/contracts';
import type { MasterDataLogoChange } from '@/modules/master-data/api/client';
import { documentsApi } from '@/modules/documents/api/client';
import { saveOrganizationChanges } from './record-mutations';

export const ORGANIZATION_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const ORGANIZATION_LOGO_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000] as const;
const ORGANIZATION_LOGO_UNAVAILABLE_NOTICE =
  'تصویر لوگو اکنون قابل دریافت نیست؛ وضعیت فایل را در آرشیو بررسی کنید.';

export type OrganizationLogoPreviewResult =
  | { blob: Blob }
  | { reason: string; retryable?: true };

export type OrganizationLogoLoadState =
  | { imageUrl: string }
  | { reason: string };

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
): Promise<OrganizationLogoPreviewResult> {
  if (!canViewOrganizationLogo(permissions))
    return { reason: 'مجوز نمایش تصویر لوگو را ندارید.' };
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const { data } = await documentsApi.detail(documentId);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (
    data.type.domain !== 'BRAND' ||
    data.archiveStatus !== 'ACTIVE' ||
    !data.capabilities.viewFile
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
  if (
    !['image/png', 'image/jpeg'].includes(
      data.currentVersion.detectedMimeType,
    ) ||
    data.currentVersion.sizeBytes === 0 ||
    data.currentVersion.sizeBytes > ORGANIZATION_LOGO_MAX_BYTES
  )
    return { reason: 'قالب یا اندازه تصویر برای نمایش لوگو مناسب نیست.' };
  if (data.currentVersion.scanStatus !== 'CLEAN')
    return {
      reason:
        'لوگو ثبت شده است؛ نمایش آن به وضعیت و بررسی امنیتی فایل بستگی دارد.',
      ...(['PENDING_SCAN', 'AWAITING_ANTIVIRUS_ADAPTER'].includes(
        data.currentVersion.scanStatus,
      )
        ? { retryable: true as const }
        : {}),
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

export function watchOrganizationLogoPreview({
  documentId,
  permissions,
  onState,
}: {
  documentId: string;
  permissions: readonly IamPermissionCode[];
  onState: (state: OrganizationLogoLoadState) => void;
}): () => void {
  const controller = new AbortController();
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let objectUrl: string | undefined;

  const load = async (attempt: number) => {
    try {
      const result = await organizationLogoPreview(
        documentId,
        permissions,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if ('blob' in result) {
        objectUrl = URL.createObjectURL(result.blob);
        onState({ imageUrl: objectUrl });
        return;
      }
      onState({ reason: result.reason });
      const retryDelay = result.retryable
        ? ORGANIZATION_LOGO_RETRY_DELAYS_MS[attempt]
        : undefined;
      if (retryDelay !== undefined)
        retryTimer = setTimeout(() => void load(attempt + 1), retryDelay);
    } catch {
      if (!controller.signal.aborted)
        onState({ reason: ORGANIZATION_LOGO_UNAVAILABLE_NOTICE });
    }
  };

  void load(0);
  return () => {
    controller.abort();
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}
