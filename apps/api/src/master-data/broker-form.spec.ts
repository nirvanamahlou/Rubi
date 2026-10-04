import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { MasterDataContactCrypto } from './master-data-contact.crypto';
import { MasterDataService } from './master-data.service';
import {
  applyBrokerLeaders,
  toMasterDataRecord,
  type MasterDataRepository,
} from './master-data.repository';
import { brokerCityIds, brokerLeaderDrafts } from './broker-form.policy';

const brokerId = '11111111-1111-4111-8111-111111111111';
const cityId = '22222222-2222-4222-8222-222222222222';
const otherCityId = '22222222-2222-4222-8222-222222222223';
const countryId = '33333333-3333-4333-8333-333333333333';
const leaderId = '44444444-4444-4444-8444-444444444444';
const actor = {
  userId: brokerId,
  branchIds: [cityId],
  permissions: [],
} as unknown as AuthenticatedActor;
function fixture() {
  const row = {
    id: brokerId,
    name: 'آزمایشی',
    code: 'BROKER_TEST',
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    countryId,
    leaders: [{ id: leaderId, version: 2 }],
  };
  const repository = {
    find: vi.fn(async (resource: string): Promise<Record<string, unknown>> =>
      resource === 'cities'
        ? { isActive: true, countryId }
        : resource === 'countries'
          ? { isActive: true }
          : row,
    ),
    codeExists: vi.fn().mockResolvedValue(false),
    create: vi
      .fn<(...args: unknown[]) => Promise<typeof row>>()
      .mockResolvedValue(row),
    update: vi
      .fn<(...args: unknown[]) => Promise<typeof row>>()
      .mockResolvedValue(row),
    recordLeaderContactRead: vi.fn(),
  };
  const crypto = new MasterDataContactCrypto(
    new ConfigService({
      MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
    }),
  );
  const service = new MasterDataService(
    repository as unknown as MasterDataRepository,
    crypto,
  );
  return { repository, service, crypto, row };
}
describe('broker form aggregate', () => {
  it('deduplicates valid cities and rejects malformed, duplicate or phone-less leader drafts', () => {
    expect(brokerCityIds(`${cityId},${otherCityId},${cityId}`)).toEqual([
      cityId,
      otherCityId,
    ]);
    expect(() => brokerCityIds('bad')).toThrow();
    expect(() => brokerLeaderDrafts('{')).toThrow();
    expect(() =>
      brokerLeaderDrafts(
        JSON.stringify({ items: [{ name: 'Test' }], removed: [] }),
      ),
    ).toThrow();
    expect(() =>
      brokerLeaderDrafts(
        JSON.stringify({
          items: [{ id: leaderId, version: 2, name: 'Test' }],
          removed: [{ id: leaderId, version: 2 }],
        }),
      ),
    ).toThrow();
  });
  it('encrypts broker and each leader phone, preserving scalar API compatibility and real city relations', async () => {
    const { service, repository, crypto } = fixture();
    await service.create(
      'brokers',
      {
        name: 'کارگزار آزمایشی',
        countryId,
        cityIds: `${cityId},${otherCityId}`,
        boardText: '  TEST BOARD  ',
        primaryPhone: '+989121234567',
        leaderDrafts: JSON.stringify({
          items: [
            { name: 'Leader A', phone: '+905551234567' },
            { name: 'Leader B', phone: '+905551234568' },
          ],
          removed: [],
        }),
      },
      actor,
    );
    const data = repository.create.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(data.primaryPhone).toBeUndefined();
    expect(data.primaryPhoneEncrypted).not.toContain('9121234567');
    expect(data.boardText).toBe('TEST BOARD');
    expect(data.cities).toEqual({
      create: [{ cityId }, { cityId: otherCityId }],
    });
    const changes = data.brokerLeaderChanges as {
      items: { data: Record<string, unknown> }[];
    };
    expect(changes.items).toHaveLength(2);
    expect(changes.items[0]?.data.code).not.toBe(changes.items[1]?.data.code);
    expect(
      crypto.decrypt('phone', {
        encrypted: String(changes.items[0]?.data.primaryPhoneEncrypted),
        encryptionIv: String(changes.items[0]?.data.primaryPhoneEncryptionIv),
        encryptionAuthTag: String(
          changes.items[0]?.data.primaryPhoneEncryptionAuthTag,
        ),
        encryptionKeyVersion: 1,
      }),
    ).toBe('+905551234567');
  });
  it('rejects a city from another country, foreign/stale leaders and oversized Board before writing', async () => {
    const { service, repository } = fixture();
    await expect(
      service.create(
        'brokers',
        { name: 'Test', countryId: otherCityId, cityIds: cityId },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.update(
        'brokers',
        brokerId,
        {
          leaderDrafts: JSON.stringify({
            items: [{ id: leaderId, version: 1, name: 'Changed' }],
            removed: [],
          }),
        },
        1,
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.create(
        'brokers',
        { name: 'Test', boardText: 'x'.repeat(301) },
        actor,
      ),
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('does not replace existing encrypted phones when inputs are omitted', async () => {
    const { service, repository } = fixture();
    await service.update(
      'brokers',
      brokerId,
      {
        name: 'Updated',
        leaderDrafts: JSON.stringify({
          items: [{ id: leaderId, version: 2, name: 'Updated leader' }],
          removed: [],
        }),
      },
      1,
      actor,
    );
    const data = repository.update.mock.calls[0]?.[2] as Record<
      string,
      unknown
    >;
    expect(data).not.toHaveProperty('primaryPhoneEncrypted');
    expect(
      (data.brokerLeaderChanges as { items: { data: unknown }[] }).items[0]
        ?.data,
    ).toEqual({ name: 'Updated leader' });
  });
  it('projects only masked contacts and city/name metadata', () => {
    const { row } = fixture();
    const result = toMasterDataRecord('brokers', {
      ...row,
      primaryPhoneEncrypted: 'DO_NOT_EXPOSE',
      primaryPhoneMasked: '***4567',
      cities: [{ cityId, city: { name: 'Antalya' } }],
      leaders: [
        {
          id: leaderId,
          name: 'Test',
          version: 2,
          primaryPhoneMasked: '***4568',
        },
      ],
    });
    expect(result.attributes.cityNames).toBe('Antalya');
    expect(result.attributes.primaryPhoneMasked).toBe('***4567');
    expect(JSON.stringify(result)).not.toContain('DO_NOT_EXPOSE');
  });
  it('returns broker Board through the existing audited voucher contact boundary', async () => {
    const { service, repository, crypto } = fixture();
    const phone = crypto.protect('phone', '+905551234567');
    repository.find.mockImplementation(async (resource: string) =>
      resource === 'brokers'
        ? { isActive: true, boardText: 'AIRPORT BOARD' }
        : ({
            isActive: true,
            brokerId,
            name: 'Test leader',
            primaryPhoneEncrypted: phone.encrypted,
            primaryPhoneEncryptionIv: phone.encryptionIv,
            primaryPhoneEncryptionAuthTag: phone.encryptionAuthTag,
            primaryPhoneEncryptionKeyVersion: 1,
          } as never),
    );
    await expect(
      service.voucherLeaderContact(brokerId, leaderId, actor),
    ).resolves.toEqual({
      data: {
        id: leaderId,
        name: 'Test leader',
        phone: '+905551234567',
        board: 'AIRPORT BOARD',
      },
    });
    expect(repository.recordLeaderContactRead).toHaveBeenCalledOnce();
  });
  it('checks broker membership/version in every transaction write and deactivates removed identities', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      masterLeader: { updateMany },
      masterDataAuditEvent: { create: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    await applyBrokerLeaders(
      tx,
      brokerId,
      {
        items: [{ id: leaderId, version: 2, data: { name: 'Updated' } }],
        removed: [{ id: otherCityId, version: 3 }],
      },
      actor.userId,
      cityId,
    );
    expect(updateMany.mock.calls[0]?.[0].where).toEqual({
      id: leaderId,
      brokerId,
      isActive: true,
      version: 2,
    });
    expect(updateMany.mock.calls[1]?.[0].data.isActive).toBe(false);
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      applyBrokerLeaders(
        tx,
        brokerId,
        {
          items: [{ id: leaderId, version: 2, data: { name: 'Updated' } }],
          removed: [],
        },
        actor.userId,
        cityId,
      ),
    ).rejects.toThrow();
  });
});
