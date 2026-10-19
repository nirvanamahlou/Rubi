import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import { persistPartnerDossier } from './partner-dossier.persistence';

function harness() {
  const tx = {
    masterOrganization: {
      create: vi.fn().mockResolvedValue({ id: 'organization' }),
      update: vi.fn().mockResolvedValue({ id: 'organization' }),
    },
    masterOrganizationContact: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'contact' }),
      update: vi.fn().mockResolvedValue({ id: 'contact' }),
    },
    masterOrganizationAddress: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'address' }),
      update: vi.fn().mockResolvedValue({ id: 'address' }),
    },
    masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}
const protectedContact = {
  encrypted: 'cipher',
  encryptionIv: 'iv',
  encryptionAuthTag: 'tag',
  encryptionKeyVersion: 1,
  masked: '***1234',
  fingerprint: 'hash',
};
describe('partner identity persistence', () => {
  it.each(['suppliers', 'brokers'] as const)(
    'preserves canonical contacts and address on unrelated %s edits',
    async (resource) => {
      const { tx, client } = harness();
      tx.masterOrganizationAddress.findFirst.mockResolvedValue({
        id: 'address',
        addressLine: 'Canonical office',
      } as never);
      await persistPartnerDossier(
        client,
        resource,
        {
          name: 'QA',
          organizationId: 'organization',
          countryId: 'country',
          address: 'Stale native office',
          primaryPhoneEncrypted: null,
        },
        {},
        'actor',
        'branch',
        false,
        false,
      );
      expect(tx.masterOrganizationContact.findMany).not.toHaveBeenCalled();
      expect(tx.masterOrganizationAddress.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ addressLine: 'Canonical office' }),
        }),
      );
    },
  );
  it('deactivates a cleared email without creating an empty invalid contact tuple', async () => {
    const { tx, client } = harness();
    tx.masterOrganizationContact.findFirst.mockResolvedValue({
      id: 'email',
    } as never);
    await persistPartnerDossier(
      client,
      'brokers',
      { name: 'QA', organizationId: 'organization' },
      { email: null },
      'actor',
      'branch',
    );
    expect(tx.masterOrganizationContact.update).toHaveBeenCalledWith({
      where: { id: 'email' },
      data: {
        isActive: false,
        updatedByUserId: 'actor',
        version: { increment: 1 },
      },
    });
  });
  it.each([
    ['suppliers', 'SUPPLIER'],
    ['brokers', 'BROKER'],
  ] as const)(
    'creates only the actual %s role, with city/address and protected contacts',
    async (resource, roleCode) => {
      const { tx, client } = harness();
      expect(
        await persistPartnerDossier(
          client,
          resource,
          { name: 'QA Partner', cityId: 'city', countryId: 'country' },
          {
            mobile: protectedContact,
            email: protectedContact,
            address: 'QA Office',
          },
          'actor',
          'branch',
        ),
      ).toBe('organization');
      expect(tx.masterOrganization.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          legalName: 'QA Partner',
          roles: { create: { roleCode, assignedByUserId: 'actor' } },
        }),
      });
      expect(tx.masterOrganizationAddress.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'organization',
          countryId: 'country',
          cityId: 'city',
          addressLine: 'QA Office',
        }),
      });
      expect(tx.masterOrganizationContact.create).toHaveBeenCalledTimes(2);
      const writes = JSON.stringify(
        tx.masterOrganizationContact.create.mock.calls,
      );
      expect(writes).toContain('phoneEncrypted');
      expect(writes).toContain('emailEncrypted');
      expect(
        JSON.stringify(tx.masterDataAuditEvent.create.mock.calls),
      ).not.toContain('cipher');
    },
  );
  it('keeps untouched contact records intact while explicitly clearing only requested values', async () => {
    const { tx, client } = harness();
    tx.masterOrganizationContact.findMany.mockResolvedValue([
      {
        id: 'existing-contact',
        jobTitle: 'PARTNER_MOBILE',
        isActive: true,
      },
    ] as never);
    await persistPartnerDossier(
      client,
      'suppliers',
      { name: 'QA', organizationId: 'organization' },
      { mobile: null },
      'actor',
      'branch',
    );
    expect(tx.masterOrganization.create).not.toHaveBeenCalled();
    expect(tx.masterOrganizationContact.update).toHaveBeenCalledTimes(1);
    expect(tx.masterOrganizationContact.update).toHaveBeenCalledWith({
      where: { id: 'existing-contact' },
      data: expect.objectContaining({
        isActive: false,
      }),
    });
    expect(tx.masterOrganizationAddress.create).not.toHaveBeenCalled();
  });
  it('propagates a contact failure so the enclosing partner transaction can roll back', async () => {
    const { tx, client } = harness();
    tx.masterOrganizationContact.create.mockRejectedValue(
      new Error('write failed'),
    );
    await expect(
      persistPartnerDossier(
        client,
        'brokers',
        { name: 'QA' },
        { mobile: protectedContact },
        'actor',
        'branch',
      ),
    ).rejects.toThrow('write failed');
  });
});
