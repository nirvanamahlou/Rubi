import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  isMasterTransportFormResource,
  type AuthenticatedActor,
} from '@rubi/contracts';

export function transportStatusData(
  resource: string,
  values: Record<string, unknown>,
  actor: AuthenticatedActor,
) {
  if (
    !isMasterTransportFormResource(resource) ||
    !Object.hasOwn(values, 'transportStatus')
  )
    return {};
  const status = values.transportStatus;
  if (
    typeof status !== 'string' ||
    !['ACTIVE', 'INACTIVE', 'UNDER_REVIEW'].includes(status)
  )
    throw new BadRequestException('وضعیت حمل‌ونقل معتبر نیست.');
  if (!actor.permissions.includes('master_data.status.manage'))
    throw new ForbiddenException('مجوز مدیریت وضعیت لازم است.');
  return {
    isActive: status === 'ACTIVE',
    isUnderReview: status === 'UNDER_REVIEW',
    deactivatedAt: status === 'ACTIVE' ? null : new Date(),
    deactivatedByUserId: status === 'ACTIVE' ? null : actor.userId,
  };
}
