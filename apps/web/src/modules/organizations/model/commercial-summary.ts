import type {
  B2bAgreementCaseV1,
  B2bCooperationRole,
  IamPermissionCode,
} from '@rubi/contracts';
import { agencyClient } from '../api/agency-client';

export function isCurrentAgreement(record: B2bAgreementCaseV1, today: string) {
  const revision = record.revisions.find(
    (item) => item.id === record.activeRevisionId,
  );
  return (
    record.status === 'ACTIVE' &&
    revision?.status === 'APPROVED' &&
    revision.startsAt <= today &&
    (!revision.endsAt || revision.endsAt >= today)
  );
}

export async function loadCommercialSummary(
  organizationId: string,
  branchId: string,
  role: B2bCooperationRole,
  permissions: readonly IamPermissionCode[],
  isCurrent: () => boolean = () => true,
  client = agencyClient,
  today = new Date().toISOString().slice(0, 10),
) {
  const allowed = (...codes: IamPermissionCode[]) =>
    codes.every((code) => permissions.includes(code));
  const [manager, agreements] = await Promise.allSettled([
    role !== 'AGENCY'
      ? Promise.resolve('برای این نقش تعریف نشده')
      : !allowed('b2b.agency.read')
        ? Promise.resolve('نیاز به دسترسی')
        : client
            .profileDetails(organizationId, branchId)
            .then(
              ({ data }) =>
                data.accountManagers.find(
                  (user) => user.id === data.profile?.accountManagerUserId,
                )?.displayName ?? 'تعیین نشده',
            ),
    (async () => {
      if (!allowed('b2b.agreement.read', 'b2b.credit.read'))
        return 'نیاز به دسترسی';
      const active = new Set<string>();
      let page = 1;
      let totalPages = 1;
      do {
        if (!isCurrent()) throw new Error('Superseded request');
        const response = await client.agreements(
          organizationId,
          branchId,
          role,
          page,
        );
        if (!isCurrent()) throw new Error('Superseded request');
        response.data
          .filter((item) => isCurrentAgreement(item, today))
          .forEach((item) => active.add(item.id));
        totalPages = response.meta.totalPages;
        page++;
      } while (page <= totalPages);
      return active.size.toLocaleString('fa-IR');
    })(),
  ]);
  return {
    manager: manager.status === 'fulfilled' ? manager.value : 'دریافت ناموفق',
    agreements:
      agreements.status === 'fulfilled' ? agreements.value : 'دریافت ناموفق',
  };
}
