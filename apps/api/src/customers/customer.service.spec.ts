import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerMutationRequest,
} from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerContactCrypto } from './customer-contact.crypto';
import type { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: [
    'customers.read',
    'customers.create',
    'customers.update',
    'customers.merge',
    'customers.consent.manage',
  ],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};

const protectedContact = {
  encryptedValue: 'encrypted-contact',
  encryptionIv: 'iv-base64-value',
  encryptionAuthTag: 'auth-tag-base64-value',
  encryptionKeyVersion: 1,
  maskedValue: '0000•••000',
  valueFingerprint: 'f'.repeat(64),
  valueHash: 'f'.repeat(64),
};

function createService(
  repository: CustomerRepository,
  cryptoOverrides: Partial<CustomerContactCrypto> = {},
) {
  const contactCrypto = {
    protect: vi.fn().mockReturnValue(protectedContact),
    decrypt: vi.fn().mockReturnValue('0000000000'),
    fingerprint: vi.fn().mockReturnValue('f'.repeat(64)),
    ...cryptoOverrides,
  } as unknown as CustomerContactCrypto;
  return {
    service: new CustomerService(repository, contactCrypto),
    contactCrypto,
  };
}
const mutation: CustomerMutationRequest = {
  kind: 'person',
  firstName: 'نمونه',
  lastName: 'آزمایشی',
  displayName: 'مشتری ساختگی',
  roles: ['customer', 'passenger'],
};

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  kind: 'PERSON',
  organizationId: null,
  firstName: 'نمونه',
  lastName: 'آزمایشی',
  displayName: 'مشتری ساختگی',
  birthDate: new Date('1990-01-01T00:00:00.000Z'),
  isActive: true,
  isCustomer: true,
  isPassenger: true,
  acquaintanceMethodId: null,
  ownerBranchId: actor.branchIds[0],
  version: 1,
  createdAt: new Date('2026-08-24T00:00:00.000Z'),
  updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  contacts: [],
  addresses: [],
  consents: [],
  relationships: [],
  _count: { relationships: 0 },
};

describe('CustomerService', () => {
  it('enforces branch context on mutations', async () => {
    const repository = { create: vi.fn() } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(
      service.create(mutation, { ...actor, branchIds: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns coded optimistic concurrency conflicts', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(null),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const operation = service.update(
      row.id,
      { ...mutation, version: 1 },
      actor,
    );
    await expect(operation).rejects.toBeInstanceOf(ConflictException);
    await expect(operation).rejects.toMatchObject({
      response: { code: 'CONCURRENT_MODIFICATION' },
      status: 409,
    });
  });

  it('hashes and masks contacts without passing the raw value to persistence', async () => {
    const repository = {
      addContact: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await service.addContact(
      row.id,
      { type: 'phone', value: '0000000000', isPrimary: true, version: 1 },
      actor,
    );
    const persisted = vi.mocked(repository.addContact).mock.calls[0]?.[2];
    expect(persisted).toMatchObject({ maskedValue: '0000•••000' });
    expect(persisted?.valueFingerprint).toHaveLength(64);
    expect(persisted?.valueHash).toHaveLength(64);
    expect(persisted?.encryptedValue).toBe('encrypted-contact');
    expect(persisted).not.toHaveProperty('value');
  });

  it('masks birth date without sensitive permission and never auto-merges', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      duplicateInputs: vi.fn().mockResolvedValue({
        source: { ...row, contacts: [{ valueFingerprint: 'same' }] },
        candidates: [
          {
            ...row,
            id: '55555555-5555-4555-8555-555555555555',
            contacts: [{ valueFingerprint: 'same' }],
          },
        ],
      }),
      saveDuplicateCandidate: vi.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
        sourceCustomerId: row.id,
        candidateCustomerId: '55555555-5555-4555-8555-555555555555',
        score: 100,
        reasons: ['تماس یکسان'],
        reviewStatus: 'PENDING',
        reviewReason: null,
        version: 1,
        reviewedAt: null,
        createdAt: row.createdAt,
        candidateCustomer: { displayName: 'کاندیدای ساختگی' },
      }),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(service.detail(row.id, actor)).resolves.toMatchObject({
      data: { birthDate: null, birthDateMasked: true },
    });
    await expect(
      service.detectDuplicates(row.id, actor),
    ).resolves.toMatchObject({
      data: [{ score: 100, reviewStatus: 'pending' }],
      meta: { autoMergePerformed: false },
    });
  });
  it('decrypts contacts and audits access only with sensitive permission', async () => {
    const encryptedRow = {
      ...row,
      contacts: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: 'PHONE',
          label: null,
          maskedValue: '0000•••000',
          encryptedValue: 'encrypted-contact',
          encryptionIv: 'iv-base64-value',
          encryptionAuthTag: 'auth-tag-base64-value',
          encryptionKeyVersion: 1,
          valueFingerprint: 'f'.repeat(64),
          isPrimary: true,
          verifiedAt: null,
          createdAt: row.createdAt,
        },
      ],
    };
    const repository = {
      find: vi.fn().mockResolvedValue(encryptedRow),
      auditSensitiveRead: vi.fn().mockResolvedValue(undefined),
    } as unknown as CustomerRepository;
    const { service, contactCrypto } = createService(repository);

    const masked = await service.detail(row.id, actor);
    expect(masked.data.contacts[0]).toMatchObject({
      maskedValue: '0000•••000',
      value: null,
    });
    expect(contactCrypto.decrypt).not.toHaveBeenCalled();
    expect(repository.auditSensitiveRead).not.toHaveBeenCalled();

    const sensitive = await service.detail(row.id, {
      ...actor,
      permissions: [...actor.permissions, 'customers.sensitive.read'],
    });
    expect(sensitive.data.contacts[0]?.value).toBe('0000000000');
    expect(contactCrypto.decrypt).toHaveBeenCalledTimes(1);
    expect(repository.auditSensitiveRead).toHaveBeenCalledWith(
      row.id,
      actor.userId,
      row.ownerBranchId,
      undefined,
    );
  });
});
