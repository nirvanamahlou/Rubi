import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { MasterDataContactCrypto } from './master-data-contact.crypto';
import type { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '99999999-9999-4999-8999-999999999999',
  branchIds: ['22222222-2222-4222-8222-222222222222'],
  permissions: ['master_data.create', 'master_data.sensitive_contact.unmask'],
};

const organization = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'ORG_TEST',
  displayName: 'سازمان آزمون',
  legalName: 'شرکت آزمون',
  isActive: true,
  roles: [{ roleCode: 'SUPPLIER' }],
};

describe('MasterDataService supplier contacts', () => {
  it('sends only protected contact values to persistence', async () => {
    const create = vi
      .fn()
      .mockImplementation(
        async (
          _resource: string,
          data: Record<string, unknown>,
          _userId: string,
          _branchId: string,
        ) => {
          void _userId;
          void _branchId;
          return {
            id: '44444444-4444-4444-8444-444444444444',
            code: 'CONTACT_TEST',
            fullName: 'مخاطب آزمون',
            isActive: true,
            version: 1,
            createdAt: new Date('2026-08-29T00:00:00.000Z'),
            updatedAt: new Date('2026-08-29T00:00:00.000Z'),
            organization,
            ...data,
          };
        },
      );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue(organization),
      create,
    } as unknown as MasterDataRepository;
    const contactCrypto = {
      protect: vi.fn().mockReturnValue({
        encrypted: 'ciphertext',
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
        encryptionKeyVersion: 1,
        masked: '+98••••4567',
        fingerprint: 'a'.repeat(64),
      }),
    } as unknown as MasterDataContactCrypto;
    const service = new MasterDataService(repository, contactCrypto);

    await service.create(
      'organization-contacts',
      {
        organizationId: organization.id,
        fullName: 'مخاطب آزمون',
        preferredChannel: 'PHONE',
        phone: '+989121234567',
        email: null,
      },
      actor,
    );

    const persisted = create.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(persisted).not.toHaveProperty('phone');
    expect(persisted).not.toHaveProperty('email');
    expect(persisted).toMatchObject({
      phoneEncrypted: 'ciphertext',
      phoneMasked: '+98••••4567',
    });
  });

  it('audits permission-gated unmask without returning persistence metadata', async () => {
    const recordSensitiveContactRead = vi.fn().mockResolvedValue(undefined);
    const repository = {
      find: vi.fn().mockResolvedValue({
        id: '44444444-4444-4444-8444-444444444444',
        isActive: true,
        phoneEncrypted: 'phone-cipher',
        phoneEncryptionIv: 'phone-iv',
        phoneEncryptionAuthTag: 'phone-tag',
        phoneEncryptionKeyVersion: 1,
        emailEncrypted: null,
        emailEncryptionIv: null,
        emailEncryptionAuthTag: null,
        emailEncryptionKeyVersion: null,
      }),
      recordSensitiveContactRead,
    } as unknown as MasterDataRepository;
    const contactCrypto = {
      decrypt: vi
        .fn()
        .mockReturnValueOnce('+989121234567')
        .mockReturnValueOnce(null),
    } as unknown as MasterDataContactCrypto;
    const service = new MasterDataService(repository, contactCrypto);

    const response = await service.unmaskOrganizationContact(
      '44444444-4444-4444-8444-444444444444',
      actor,
    );

    expect(response).toEqual({
      data: {
        id: '44444444-4444-4444-8444-444444444444',
        phone: '+989121234567',
        email: null,
      },
    });
    expect(recordSensitiveContactRead).toHaveBeenCalledTimes(1);
  });
});
