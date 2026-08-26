import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';

import { MasterDataRepository } from './master-data.repository';

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
