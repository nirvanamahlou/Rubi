import { randomUUID } from 'node:crypto';
import type { Prisma } from '@nora/database';
import { persistPartnerPhones } from './partner-phone.persistence';

type ProtectedContact = {
  encrypted: string;
  encryptionIv: string;
  encryptionAuthTag: string;
  encryptionKeyVersion: number;
  masked: string;
  fingerprint: string;
};
const contactFields = (
  kind: 'phone' | 'email',
  value: ProtectedContact | null,
) => ({
  [`${kind}Encrypted`]: value?.encrypted ?? null,
  [`${kind}EncryptionIv`]: value?.encryptionIv ?? null,
  [`${kind}EncryptionAuthTag`]: value?.encryptionAuthTag ?? null,
  [`${kind}EncryptionKeyVersion`]: value?.encryptionKeyVersion ?? null,
  [`${kind}Masked`]: value?.masked ?? null,
  [`${kind}Fingerprint`]: value?.fingerprint ?? null,
});

/** Runs inside the same transaction as the partner write: no orphan dossier on failure. */
export async function persistPartnerDossier(
  tx: Prisma.TransactionClient,
  resource: 'suppliers' | 'brokers',
  source: Record<string, unknown>,
  input: Record<string, unknown>,
  actorUserId: string,
  actorBranchId: string,
) {
  const audit = async (resource: string, entityId: string, action: string) => {
    await tx.masterDataAuditEvent.create({
      data: {
        actorUserId,
        actorBranchId,
        resource,
        entityId,
        action,
        outcome: 'SUCCESS',
        afterSnapshot: {
          source: 'partner-dossier',
          partnerResource: resource === 'organizations' ? roleCode : resource,
        },
      },
    });
  };
  const roleCode = resource === 'suppliers' ? 'SUPPLIER' : 'BROKER';
  let organizationId =
    typeof source.organizationId === 'string' ? source.organizationId : null;
  const name = String(source.name ?? '').trim();
  if (!organizationId) {
    const org = await tx.masterOrganization.create({
      data: {
        code: `ORG_${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`,
        legalName: name,
        displayName: name,
        personType: 'LEGAL',
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
        roles: { create: { roleCode, assignedByUserId: actorUserId } },
      },
    });
    organizationId = org.id;
    await tx.masterDataAuditEvent.create({
      data: {
        actorUserId,
        actorBranchId,
        action: 'master_data.create',
        resource: 'organizations',
        entityId: org.id,
        outcome: 'SUCCESS',
        afterSnapshot: { legalName: name, roleCodes: roleCode },
      },
    });
  } else {
    await tx.masterOrganization.update({
      where: { id: organizationId },
      data: {
        legalName: name,
        displayName: name,
        updatedByUserId: actorUserId,
        version: { increment: 1 },
        roles: {
          upsert: {
            where: { organizationId_roleCode: { organizationId, roleCode } },
            create: { roleCode, assignedByUserId: actorUserId },
            update: {},
          },
        },
      },
    });
    await audit('organizations', organizationId, 'master_data.update');
  }
  const common = {
    organizationId,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  };
  if (source.primaryPhoneEncrypted !== undefined) {
    input.office = source.primaryPhoneEncrypted
      ? {
          encrypted: source.primaryPhoneEncrypted,
          encryptionIv: source.primaryPhoneEncryptionIv,
          encryptionAuthTag: source.primaryPhoneEncryptionAuthTag,
          encryptionKeyVersion: source.primaryPhoneEncryptionKeyVersion,
          masked: source.primaryPhoneMasked,
          fingerprint: source.primaryPhoneFingerprint,
        }
      : null;
  }
  await persistPartnerPhones(
    tx,
    organizationId,
    name,
    input,
    actorUserId,
    () =>
      `CONTACT_${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`,
    audit,
  );
  for (const [key, marker, kind] of [
    ['email', 'PARTNER_EMAIL', 'email'],
  ] as const) {
    if (!Object.hasOwn(input, key)) continue;
    const fields = contactFields(kind, input[key] as ProtectedContact | null);
    const existing = await tx.masterOrganizationContact.findFirst({
      where: { organizationId, jobTitle: marker },
    });
    if (existing) {
      await tx.masterOrganizationContact.update({
        where: { id: existing.id },
        data: {
          ...fields,
          isActive: Boolean(input[key]),
          updatedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });
      await audit('organization-contacts', existing.id, 'master_data.update');
    } else if (input[key]) {
      const contact = await tx.masterOrganizationContact.create({
        data: {
          ...common,
          ...fields,
          code: `CONTACT_${randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase()}`,
          fullName: name,
          jobTitle: marker,
          preferredChannel: kind === 'email' ? 'EMAIL' : 'PHONE',
          isPrimary: false,
        },
      });
      await audit('organization-contacts', contact.id, 'master_data.create');
    }
  }
  if (Object.hasOwn(input, 'address') || source.cityId || source.countryId) {
    const existing = await tx.masterOrganizationAddress.findFirst({
      where: { organizationId, isPrimary: true },
    });
    const addressLine = Object.hasOwn(input, 'address')
      ? String(input.address ?? '')
      : String(source.address ?? existing?.addressLine ?? '');
    const location = {
      countryId: (source.countryId as string | null) ?? null,
      cityId: (source.cityId as string | null) ?? null,
    };
    if (existing) {
      await tx.masterOrganizationAddress.update({
        where: { id: existing.id },
        data: {
          addressLine,
          ...location,
          updatedByUserId: actorUserId,
          version: { increment: 1 },
        },
      });
      await audit('organization-addresses', existing.id, 'master_data.update');
    } else {
      const address = await tx.masterOrganizationAddress.create({
        data: {
          ...common,
          label: 'نشانی دفتر مرکزی',
          addressLine,
          ...location,
          isPrimary: true,
        },
      });
      await audit('organization-addresses', address.id, 'master_data.create');
    }
  }
  return organizationId;
}
