import type { InsurancePolicyRowV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';

export function InsurancePolicyPdfLink({
  policy,
}: {
  policy: Pick<
    InsurancePolicyRowV1,
    'id' | 'intakeId' | 'standalone' | 'status'
  >;
}) {
  if (policy.status !== 'ISSUED' || (!policy.standalone && !policy.intakeId))
    return null;
  const id = encodeURIComponent(policy.id);
  const path = policy.standalone
    ? `/reservations/insurance/standalone/${id}/pdf`
    : `/reservations/requests/${encodeURIComponent(policy.intakeId!)}/insurance/pdf/${id}`;
  return (
    <a href={getPublicApiBaseUrl() + path} target="_blank" rel="noreferrer">
      دانلود PDF بیمه‌نامه
    </a>
  );
}
