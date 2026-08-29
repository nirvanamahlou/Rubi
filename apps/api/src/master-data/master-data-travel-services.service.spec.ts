import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { MasterDataContactCrypto } from './master-data-contact.crypto';
import type { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '99999999-9999-4999-8999-999999999999',
  branchIds: ['22222222-2222-4222-8222-222222222222'],
  permissions: ['master_data.create', 'master_data.read'],
};

const cityId = '33333333-3333-4333-8333-333333333333';

function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    code: 'REFERENCE',
    name: 'مرجع آزمون',
    isActive: true,
    version: 1,
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    ...extra,
  };
}

describe('MasterDataService travel services', () => {
  it('normalizes leader lists and encrypts contact fields before persistence', async () => {
    const create = vi.fn().mockImplementation(
      async (_resource: string, data: Record<string, unknown>) =>
        row('44444444-4444-4444-8444-444444444444', data),
    );
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      find: vi.fn().mockResolvedValue(row(cityId)),
      create,
    } as unknown as MasterDataRepository;
    const contactCrypto = {
      protect: vi.fn().mockReturnValue({
        encrypted: 'ciphertext',
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
        encryptionKeyVersion: 1,
        masked: '+98••••1234',
        fingerprint: 'f'.repeat(64),
      }),
    } as unknown as MasterDataContactCrypto;
    const service = new MasterDataService(repository, contactCrypto);

    await service.create(
      'leaders',
      {
        name: 'لیدر آزمون',
        cityId,
        languages: 'فارسی, انگلیسی,فارسی',
        destinations: 'تهران, شیراز',
        primaryPhone: '+989121231234',
      },
      actor,
    );

    expect(create.mock.calls[0]?.[1]).toMatchObject({
      cityId,
      languages: ['فارسی', 'انگلیسی'],
      destinations: ['تهران', 'شیراز'],
      primaryPhoneEncrypted: 'ciphertext',
      primaryPhoneMasked: '+98••••1234',
    });
    expect(create.mock.calls[0]?.[1]).not.toHaveProperty('primaryPhone');
  });

  it('rejects an invalid transfer capacity before persistence', async () => {
    const repository = {
      codeExists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(
      service.create(
        'transfer-types',
        {
          name: 'ترانسفر آزمون',
          vehicleType: 'ون',
          serviceMode: 'PRIVATE',
          suggestedCapacity: 0,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns the real repository summary without mockup KPI values', async () => {
    const summary = {
      leaders: { total: 0, active: 0, destinations: 0, incompleteDocuments: null },
      tourTypes: { total: 0, active: 0, domestic: 0, international: 0 },
      transferTypes: { total: 0, active: 0, private: 0, shared: 0 },
      cipServices: { total: 0, active: 0, airports: 0, providers: 0 },
      visaServices: { total: 0, active: 0, countries: 0, incompleteGuidance: 0 },
      busCompanies: { total: 0, active: 0, organizations: 0, providers: 0 },
      busTypes: { total: 0, active: 0, amenities: 0, companies: null },
    };
    const repository = {
      travelServicesSummary: vi.fn().mockResolvedValue(summary),
    } as unknown as MasterDataRepository;
    const service = new MasterDataService(repository);

    await expect(service.travelServicesSummary()).resolves.toEqual({
      data: summary,
    });
  });
});
