import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { B2bRepository } from './b2b.repository';

function setup(before: Record<string, unknown> | null) {
  const table = {
    findUnique: vi.fn().mockResolvedValue(before),
    create: vi.fn().mockResolvedValue({ id: 'profile' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'profile' }),
  };
  const audit = vi.fn();
  const transaction = {
    agencyOperationalProfile: table,
    $queryRaw: vi.fn(),
    b2bAuditEvent: { create: audit },
  };
  const database = {
    client: {
      $transaction: async (
        operation: (tx: typeof transaction) => Promise<unknown>,
      ) => operation(transaction),
    },
  };
  return {
    table,
    audit,
    repository: new B2bRepository(database as unknown as DatabaseService),
  };
}
const input = {
  organizationId: 'organization',
  branchId: 'branch',
  actorUserId: 'user',
  displayOrder: 0,
  status: 'UNDER_REVIEW' as const,
};
describe('B2B profile workflow guard under the write lock', () => {
  it.each(['ACTIVE', 'SUSPENDED', 'ENDED'] as const)(
    'rejects creation directly in %s without write or audit',
    async (status) => {
      const { repository, table, audit } = setup(null);
      await expect(
        repository.upsertProfile({ ...input, status }),
      ).rejects.toThrow('گردش تأیید');
      expect(table.create).not.toHaveBeenCalled();
      expect(audit).not.toHaveBeenCalled();
    },
  );
  it('creates a review profile with an audit', async () => {
    const { repository, table, audit } = setup(null);
    await repository.upsertProfile(input);
    expect(table.create).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'b2b.agency.create' }),
      }),
    );
  });
  it.each(['ACTIVE', 'SUSPENDED', 'ENDED'] as const)(
    'preserves stored %s lifecycle and rejects unapproved changes',
    async (status) => {
      const { repository, table } = setup({
        id: 'profile',
        version: 1,
        status,
      });
      await expect(
        repository.upsertProfile({ ...input, expectedVersion: 1 }),
      ).rejects.toThrow('گردش تأیید');
      expect(table.updateMany).not.toHaveBeenCalled();
    },
  );
  it('preserves an omitted manager and supports same-status metadata updates with optimistic version', async () => {
    const { repository, table, audit } = setup({
      id: 'profile',
      version: 2,
      status: 'ACTIVE',
      accountManagerUserId: 'manager',
    });
    await repository.upsertProfile({
      ...input,
      status: 'ACTIVE',
      expectedVersion: 2,
      displayOrder: 4,
    });
    expect(table.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'profile', version: 2 },
      data: { displayOrder: 4 },
    });
    expect(table.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      'accountManagerUserId',
    );
    expect(audit).toHaveBeenCalledOnce();
    expect(table.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      'status',
    );
    expect(table.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      'isActive',
    );
    expect(table.updateMany.mock.calls[0]?.[0].data).not.toHaveProperty(
      'deactivatedAt',
    );
  });
});
