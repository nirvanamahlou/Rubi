import { MasterDataApiError } from '@/modules/master-data/api/client';

export interface OrganizationDeleteFailure {
  message: string;
  requiresRefresh: boolean;
}

export function organizationDeleteFailure(
  failure: unknown,
): OrganizationDeleteFailure {
  if (failure instanceof MasterDataApiError)
    return {
      message: failure.message,
      // A received HTTP rejection proves the owner did not report a successful
      // delete, so retrying is safe. Status 0 means no authoritative response.
      requiresRefresh: failure.status === 0,
    };
  return {
    message: failure instanceof Error ? failure.message : 'حذف تأیید نشد.',
    requiresRefresh: true,
  };
}
