import type { Prisma } from '@nora/database';
import type { ProtectedMasterContact } from './master-data-contact.crypto';

const office = 'PARTNER_OFFICE';
const mobile = 'PARTNER_MOBILE';
const shared = `${office}+${mobile}`;
export const partnerPhoneMarkers = [office, mobile, shared];
export function hasPartnerPhoneRole(
  marker: unknown,
  role: 'office' | 'mobile',
) {
  return String(marker ?? '')
    .split('+')
    .includes(role === 'office' ? office : mobile);
}
function fields(value: ProtectedMasterContact | null) {
  return {
    phoneEncrypted: value?.encrypted ?? null,
    phoneEncryptionIv: value?.encryptionIv ?? null,
    phoneEncryptionAuthTag: value?.encryptionAuthTag ?? null,
    phoneEncryptionKeyVersion: value?.encryptionKeyVersion ?? null,
    phoneMasked: value?.masked ?? null,
    phoneFingerprint: value?.fingerprint ?? null,
  };
}

/** Same organization/partner transaction; no uniqueness constraint is disabled. */
export async function persistPartnerPhones(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  input: Record<string, unknown>,
  actorUserId: string,
  makeCode: () => string,
  audit: (resource: string, id: string, action: string) => Promise<void>,
) {
  if (!Object.hasOwn(input, 'office') && !Object.hasOwn(input, 'mobile'))
    return;
  const existing = await tx.masterOrganizationContact.findMany({
    where: { organizationId, jobTitle: { in: partnerPhoneMarkers } },
    orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
  });
  const groups = new Map<
    string,
    { value: ProtectedMasterContact; roles: string[]; id?: string }
  >();
  for (const role of ['office', 'mobile'] as const) {
    const old = existing.find(
      (row) => row.isActive && hasPartnerPhoneRole(row.jobTitle, role),
    );
    const retained: ProtectedMasterContact | null =
      old?.phoneEncrypted && old.phoneFingerprint
        ? {
            encrypted: old.phoneEncrypted,
            encryptionIv: old.phoneEncryptionIv!,
            encryptionAuthTag: old.phoneEncryptionAuthTag!,
            encryptionKeyVersion: old.phoneEncryptionKeyVersion!,
            masked: old.phoneMasked!,
            fingerprint: old.phoneFingerprint,
          }
        : null;
    const value = Object.hasOwn(input, role)
      ? (input[role] as ProtectedMasterContact | null)
      : retained;
    if (!value) continue;
    const group = groups.get(value.fingerprint) ?? { value, roles: [] };
    group.roles.push(role === 'office' ? office : mobile);
    groups.set(value.fingerprint, group);
  }
  const used = new Set<string>();
  // Keep matching contact identities first, including when the two roles swap.
  for (const [fingerprint, group] of groups) {
    const match = existing.find((row) => row.phoneFingerprint === fingerprint);
    if (match) {
      group.id = match.id;
      used.add(match.id);
    }
  }
  for (const group of groups.values()) {
    if (group.id) continue;
    const match = existing.find(
      (row) =>
        !used.has(row.id) &&
        group.roles.some((role) =>
          String(row.jobTitle).split('+').includes(role),
        ),
    );
    if (match) {
      group.id = match.id;
      used.add(match.id);
    }
  }
  // Release only our own slots inside the transaction before merge/split/swap.
  // Unrelated organization contacts and their fingerprints are never touched.
  if (existing.length)
    await tx.masterOrganizationContact.updateMany({
      where: { organizationId, id: { in: existing.map((row) => row.id) } },
      data: { phoneFingerprint: null },
    });
  for (const group of groups.values()) {
    const data = {
      ...fields(group.value),
      jobTitle: group.roles.join('+'),
      isActive: true,
      updatedByUserId: actorUserId,
    };
    if (group.id) {
      await tx.masterOrganizationContact.update({
        where: { id: group.id },
        data: { ...data, version: { increment: 1 } },
      });
      await audit('organization-contacts', group.id, 'master_data.update');
    } else {
      const row = await tx.masterOrganizationContact.create({
        data: {
          ...data,
          organizationId,
          code: makeCode(),
          fullName: name,
          preferredChannel: 'PHONE',
          isPrimary: false,
          createdByUserId: actorUserId,
        },
      });
      await audit('organization-contacts', row.id, 'master_data.create');
    }
  }
  for (const row of existing) {
    if (used.has(row.id)) continue;
    await tx.masterOrganizationContact.update({
      where: { id: row.id },
      data: {
        ...fields(null),
        isActive: false,
        updatedByUserId: actorUserId,
        version: { increment: 1 },
      },
    });
    await audit('organization-contacts', row.id, 'master_data.update');
  }
}
