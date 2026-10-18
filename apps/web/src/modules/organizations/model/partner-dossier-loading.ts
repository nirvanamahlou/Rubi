import type { IamPermissionCode, MasterDataRecord } from '@nora/contracts';

/** A token refresh is not a new identity. Child panels refresh the same session. */
export function partnerDossierScope(input: {
  ready: boolean;
  actorUserId: string;
  branchId: string;
  permissions: readonly IamPermissionCode[];
}) {
  return input.ready
    ? JSON.stringify([
        input.actorUserId,
        input.branchId,
        [...input.permissions].sort(),
      ])
    : '';
}

export async function resolvePartnerOrganization(
  source: MasterDataRecord,
  branchId: string,
  connect: (
    resource: 'suppliers' | 'brokers',
    id: string,
    version: number,
    branchId: string,
  ) => Promise<{ organizationId: string }>,
) {
  const linked = String(source.attributes.organizationId ?? '');
  if (linked) return linked;
  if (source.resource !== 'suppliers' && source.resource !== 'brokers')
    throw new Error('نوع طرف همکاری معتبر نیست.');
  const result = await connect(
    source.resource,
    source.id,
    source.version,
    branchId,
  );
  if (!result.organizationId) throw new Error('اتصال ناموفق بود.');
  return result.organizationId;
}
