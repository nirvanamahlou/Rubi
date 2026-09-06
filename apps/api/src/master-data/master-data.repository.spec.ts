import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';

import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';

const baseRow = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'ORG_LOCK',
  legalName: 'شرکت آزمون',
  displayName: 'سازمان آزمون',
  isActive: true,
  version: 1,
  createdAt: new Date('2026-08-23T00:00:00.000Z'),
  updatedAt: new Date('2026-08-23T00:00:00.000Z'),
  roles: [{ roleCode: 'AGENCY' }],
};

describe('MasterDataRepository code allocation', () => {
  it('checks generated codes against the target resource', async () => {
    const findFirst = vi.fn().mockResolvedValue(baseRow);
    const database = {
      client: { masterBank: { findFirst } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await expect(repository.codeExists('banks', 'BANK_AUTO')).resolves.toBe(
      true,
    );
    expect(findFirst).toHaveBeenCalledWith({ where: { code: 'BANK_AUTO' } });
  });
});

describe('MasterDataRepository geography listing', () => {
  it('applies an inclusive UTC creation-date range before pagination', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterCountry: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.list('countries', {
      createdFrom: '2026-08-01',
      createdTo: '2026-08-31',
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-08-01T00:00:00.000Z'),
            lt: new Date('2026-09-01T00:00:00.000Z'),
          },
        },
        skip: 0,
        take: 25,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lt: new Date('2026-09-01T00:00:00.000Z'),
        },
      },
    });
  });

  it('applies relational filters, search, sorting and pagination to airports', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterAirport: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.list('airports', {
      search: 'thr',
      status: 'active',
      countryId: '11111111-1111-4111-8111-111111111111',
      regionId: '22222222-2222-4222-8222-222222222222',
      cityId: '33333333-3333-4333-8333-333333333333',
      sortBy: 'code',
      sortDirection: 'desc',
      page: 2,
      pageSize: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          cityId: '33333333-3333-4333-8333-333333333333',
          city: {
            is: {
              countryId: '11111111-1111-4111-8111-111111111111',
              regionId: '22222222-2222-4222-8222-222222222222',
            },
          },
          OR: expect.arrayContaining([
            { iataCode: { contains: 'thr', mode: 'insensitive' } },
            { icaoCode: { contains: 'thr', mode: 'insensitive' } },
          ]),
        }),
        orderBy: { iataCode: 'desc' },
        skip: 10,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        cityId: '33333333-3333-4333-8333-333333333333',
      }),
    });
  });
});

describe('MasterDataRepository organization role listing', () => {
  it('filters the shared Organization entity by its canonical AGENCY role', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterOrganization: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.list('organizations', {
      search: '',
      status: 'active',
      organizationRole: 'AGENCY',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: 1,
      pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          roles: { some: { roleCode: 'AGENCY' } },
        },
        include: { roles: true },
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        isActive: true,
        roles: { some: { roleCode: 'AGENCY' } },
      },
    });
  });
});

describe('MasterDataRepository financial reference listing', () => {
  it('filters bank branches by bank/city and eager-loads display references', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { masterBankBranch: { findMany, count } },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);
    const bankId = '11111111-1111-4111-8111-111111111111';
    const cityId = '22222222-2222-4222-8222-222222222222';

    await repository.list('bank-branches', {
      search: '',
      status: 'active',
      bankId,
      cityId,
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, bankId, cityId },
        include: { bank: true, city: true },
        orderBy: { name: 'asc' },
      }),
    );
  });
});

describe('MasterDataRepository optimistic locking', () => {
  it('allows only one concurrent mutation for the same expected version', async () => {
    let persistedVersion = 1;
    const model = {
      findUnique: vi.fn().mockResolvedValue(baseRow),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { version: number } }) => {
            if (where.version !== persistedVersion) return { count: 0 };
            persistedVersion += 1;
            return { count: 1 };
          },
        ),
      update: vi.fn().mockImplementation(async () => ({
        ...baseRow,
        version: persistedVersion,
        roles: [{ roleCode: 'CORPORATE_CUSTOMER' }],
      })),
    };
    const audit = { create: vi.fn().mockResolvedValue({ id: 'audit-id' }) };
    const transaction = {
      masterOrganization: model,
      masterDataAuditEvent: audit,
    };
    const database = {
      client: {
        $transaction: async <T>(
          callback: (client: typeof transaction) => Promise<T>,
        ) => callback(transaction),
      },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);
    const nestedRoles = {
      roles: {
        deleteMany: {},
        create: [
          {
            roleCode: 'CORPORATE_CUSTOMER',
            assignedByUserId: '11111111-1111-4111-8111-111111111111',
          },
        ],
      },
    };

    const results = await Promise.all([
      repository.update(
        'organizations',
        baseRow.id,
        nestedRoles,
        1,
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
      ),
      repository.update(
        'organizations',
        baseRow.id,
        nestedRoles,
        1,
        '11111111-1111-4111-8111-111111111111',
        '33333333-3333-4333-8333-333333333333',
      ),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(model.updateMany).toHaveBeenCalledWith({
      where: { id: baseRow.id, version: 1 },
      data: {
        updatedByUserId: '11111111-1111-4111-8111-111111111111',
        version: { increment: 1 },
      },
    });
    expect(model.update).toHaveBeenCalledTimes(1);
    expect(model.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: nestedRoles }),
    );
    expect(audit.create).toHaveBeenCalledTimes(1);
  });
});
describe('MasterDataRepository direct export audit', () => {
  it('stores a completed request and a downloaded audit event', async () => {
    const exportCreate = vi.fn().mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'COMPLETED',
    });
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-id' });
    const transaction = {
      masterDataExportRequest: { create: exportCreate },
      masterDataAuditEvent: { create: auditCreate },
    };
    const database = {
      client: {
        $transaction: async <T>(
          callback: (client: typeof transaction) => Promise<T>,
        ) => callback(transaction),
      },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.createExport({
      resource: 'countries',
      format: 'XLSX',
      filterSnapshot: { status: 'all' },
      columns: ['code', 'name'],
      permissionSnapshot: ['master_data.export'],
      actorUserId: '11111111-1111-4111-8111-111111111111',
      actorBranchId: '33333333-3333-4333-8333-333333333333',
      locale: 'fa-IR',
      timezone: 'Asia/Tehran',
      status: 'COMPLETED',
    });

    expect(exportCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'master_data.export.downloaded',
        outcome: 'SUCCESS',
      }),
    });
  });
});

describe('MasterDataRepository protected organization contacts', () => {
  const contactRow = {
    id: '55555555-5555-4555-8555-555555555555',
    organizationId: baseRow.id,
    code: 'CONTACT_TEST',
    fullName: 'مخاطب آزمون',
    jobTitle: 'مدیر فروش',
    preferredChannel: 'PHONE',
    hasWhatsapp: true,
    isPrimary: true,
    phoneEncrypted: 'ciphertext',
    phoneEncryptionIv: 'iv',
    phoneEncryptionAuthTag: 'tag',
    phoneEncryptionKeyVersion: 1,
    phoneMasked: '+98••••4567',
    phoneFingerprint: 'a'.repeat(64),
    emailEncrypted: 'ciphertext-email',
    emailEncryptionIv: 'iv-email',
    emailEncryptionAuthTag: 'tag-email',
    emailEncryptionKeyVersion: 1,
    emailMasked: 'n•••@example.com',
    emailFingerprint: 'b'.repeat(64),
    isActive: true,
    version: 1,
    createdAt: new Date('2026-08-29T00:00:00.000Z'),
    updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    organization: baseRow,
  };

  it('returns masks but never protected payloads in the public record', () => {
    const record = toMasterDataRecord('organization-contacts', contactRow);

    expect(record.attributes.phoneMasked).toBe('+98••••4567');
    expect(record.attributes.emailMasked).toBe('n•••@example.com');
    expect(record.attributes).not.toHaveProperty('phoneEncrypted');
    expect(record.attributes).not.toHaveProperty('phoneFingerprint');
    expect(record.attributes).not.toHaveProperty('emailEncrypted');
  });

  it('redacts encrypted values and fingerprints from audit snapshots', async () => {
    const create = vi.fn().mockResolvedValue(contactRow);
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-id' });
    const transaction = {
      masterOrganizationContact: { create },
      masterDataAuditEvent: { create: auditCreate },
    };
    const database = {
      client: {
        $transaction: async <T>(
          callback: (client: typeof transaction) => Promise<T>,
        ) => callback(transaction),
      },
    } as unknown as DatabaseService;
    const repository = new MasterDataRepository(database);

    await repository.create(
      'organization-contacts',
      { fullName: 'مخاطب آزمون' },
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    );

    const snapshot = auditCreate.mock.calls[0]?.[0].data.afterSnapshot;
    expect(snapshot).toMatchObject({ phoneMasked: '+98••••4567' });
    expect(snapshot).not.toHaveProperty('phoneEncrypted');
    expect(snapshot).not.toHaveProperty('phoneFingerprint');
    expect(snapshot).not.toHaveProperty('emailEncrypted');
  });
});
