import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LEGAL_ENTITY_CONTEXT_ALL,
  type IamPermissionCode,
  type LegalEntitySelection,
} from '@rubi/contracts';

export type IssueTargetStrategy = 'prompt' | 'separate';

export function assertLegalEntitySelection(
  selection: LegalEntitySelection,
  permissions: readonly IamPermissionCode[],
): void {
  if (
    selection === LEGAL_ENTITY_CONTEXT_ALL &&
    !permissions.includes('legal-entity.aggregate.read')
  ) {
    throw new ForbiddenException('مجوز مشاهده حالت تجمیعی شرکت‌ها وجود ندارد.');
  }
}

export function resolveIssueTargetIds(
  selection: LegalEntitySelection,
  selectedLegalEntityId: string | null,
  activeLegalEntityIds: readonly string[],
  strategy: IssueTargetStrategy,
): { ids: readonly string[]; requiresExplicitIssuer: boolean } {
  if (selection !== LEGAL_ENTITY_CONTEXT_ALL) {
    if (!selectedLegalEntityId)
      throw new UnprocessableEntityException('شرکت صادرکننده فعال مشخص نیست.');
    return { ids: [selectedLegalEntityId], requiresExplicitIssuer: false };
  }
  if (strategy === 'prompt') return { ids: [], requiresExplicitIssuer: true };
  return { ids: activeLegalEntityIds, requiresExplicitIssuer: false };
}

export function assertRequiredLetterhead(
  requiresLetterhead: boolean | undefined,
  letterheadFileId: string | null,
): void {
  if (requiresLetterhead && !letterheadFileId)
    throw new UnprocessableEntityException({
      code: 'LEGAL_ENTITY_LETTERHEAD_REQUIRED',
      message: 'سربرگ شرکت صادرکننده برای این سند تکمیل نشده است.',
    });
}
export function isSensitiveBrandingAllowed(
  permissions: readonly IamPermissionCode[],
): boolean {
  return (
    permissions.includes('legal-entity.branding.manage') ||
    permissions.includes('legal-entity.document.issue')
  );
}
