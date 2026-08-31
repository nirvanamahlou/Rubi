import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  MASTER_DATA_RESOURCES,
  type AuthenticatedActor,
  type MasterDataResource,
} from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import {
  isMasterDataDependencyError,
  removeOwnedMasterDataLinks,
} from './master-data-deletion.policy';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const id = '44444444-4444-4444-8444-444444444444';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.delete'],
};

function serviceFixture() {
  const remove = vi.fn().mockResolvedValue(undefined);
  const service = new MasterDataService({
    remove,
  } as unknown as MasterDataRepository);
  return { service, remove };
}

describe('Master Data safe deletion service', () => {
  it.each(MASTER_DATA_RESOURCES)(
    'supports authorized deletion of %s through its own repository',
    async (resource) => {
      const { service, remove } = serviceFixture();
      await expect(service.remove(resource, id, 2, actor)).resolves.toEqual({
        data: { id, resource, deleted: true },
      });
      expect(remove).toHaveBeenCalledWith(
        resource,
        id,
        2,
        actor.userId,
        actor.branchIds[0],
      );
    },
  );

  it('requires the dedicated delete permission before accessing data', async () => {
    const { service, remove } = serviceFixture();
    await expect(
      service.remove('banks', id, 1, {
        ...actor,
        permissions: ['master_data.update', 'master_data.status.manage'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  it('rejects a forged audit branch and a session with no permitted branch', async () => {
    const { service, remove } = serviceFixture();
    await expect(
      service.remove('banks', id, 1, actor, 'other-branch'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove('banks', id, 1, { ...actor, branchIds: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, undefined, '1', 2147483647])(
    'rejects invalid or missing version %s',
    async (version) => {
      const { service, remove } = serviceFixture();
      await expect(
        service.remove('banks', id, version as number, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown resource or invalid id', async () => {
    const { service, remove } = serviceFixture();
    await expect(service.remove('users', id, 1, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.remove('banks', 'invalid-id', 1, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'P2003', meta: { constraint: 'internal_fk' } },
    ...['23001', '23503'].map((originalCode) => ({
      code: 'P2039',
      meta: {
        driverAdapterError: {
          cause: { kind: 'postgres', originalCode, constraint: 'internal_fk' },
        },
      },
    })),
  ])(
    'returns a safe dependency conflict without exposing database internals (%j)',
    async (error) => {
      const { service, remove } = serviceFixture();
      remove.mockRejectedValue(error);
      const failure = await service
        .remove('banks', id, 1, actor)
        .catch((error: ConflictException) => error);
      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as ConflictException).getResponse()).toMatchObject({
        code: 'MASTER_DATA_IN_USE',
      });
      expect(JSON.stringify(failure)).not.toContain('internal_fk');
    },
  );

  it.each([
    new Error('audit unavailable'),
    {
      code: 'P2039',
      meta: {
        driverAdapterError: {
          cause: { kind: 'postgres', originalCode: 'P0001' },
        },
      },
    },
  ])(
    'does not disguise an audit or infrastructure failure as a dependency conflict (%j)',
    async (error) => {
      const { service, remove } = serviceFixture();
      remove.mockRejectedValue(error);
      await expect(service.remove('banks', id, 1, actor)).rejects.toBe(error);
    },
  );

  it.each([
    undefined,
    null,
    'P2003',
    {},
    { code: 'P2039' },
    { code: 'P2039', meta: { driverAdapterError: '23001' } },
    { code: 'P2010', meta: { code: '23001' } },
    {
      code: 'P2039',
      meta: {
        driverAdapterError: { cause: { kind: 'other', originalCode: '23001' } },
      },
    },
  ])(
    'does not classify unrelated or malformed errors as dependencies (%j)',
    (error) => {
      expect(isMasterDataDependencyError(error)).toBe(false);
    },
  );
});

function repositoryFixture(delegateName = 'masterBank', status = 'DRAFT') {
  const before = {
    id,
    version: 3,
    isActive: true,
    status,
    name: 'private fixture',
    phoneEncrypted: 'not-for-audit',
  };
  const model = {
    findUnique: vi.fn().mockResolvedValue(before),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const audit = vi.fn().mockResolvedValue({ id: 'audit-id' });
  const tx = { [delegateName]: model, masterDataAuditEvent: { create: audit } };
  const transaction = vi.fn(
    async (callback: (client: unknown) => Promise<unknown>) => callback(tx),
  );
  const repository = new MasterDataRepository({
    client: { $transaction: transaction },
  } as unknown as DatabaseService);
  return { repository, before, model, audit, transaction };
}

describe('Master Data deletion transaction', () => {
  it('claims the expected version before deleting and appending minimal audit metadata', async () => {
    const { repository, model, audit, transaction } = repositoryFixture();
    await repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(model.updateMany).toHaveBeenCalledWith({
      where: { id, version: 3 },
      data: { updatedByUserId: actor.userId, version: { increment: 1 } },
    });
    expect(model.deleteMany).toHaveBeenCalledWith({
      where: { id, version: 4 },
    });
    expect(audit).toHaveBeenCalledWith({
      data: {
        actorUserId: actor.userId,
        actorBranchId: actor.branchIds[0],
        action: 'master_data.delete',
        resource: 'banks',
        entityId: id,
        outcome: 'SUCCESS',
        beforeSnapshot: { id, version: 3 },
      },
    });
    expect(model.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      model.deleteMany.mock.invocationCallOrder[0]!,
    );
    expect(model.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      audit.mock.invocationCallOrder[0]!,
    );
  });

  it('returns not-found without mutation for a missing record', async () => {
    const { repository, model, audit } = repositoryFixture();
    model.findUnique.mockResolvedValue(null);
    await expect(
      repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(model.updateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects a stale version before claiming or deleting', async () => {
    const { repository, model, audit } = repositoryFixture();
    await expect(
      repository.remove('banks', id, 2, actor.userId, actor.branchIds[0]!),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.updateMany).not.toHaveBeenCalled();
    expect(model.deleteMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('does not delete if another operation wins the version claim', async () => {
    const { repository, model, audit } = repositoryFixture();
    model.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.deleteMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('throws inside the transaction if deletion loses its claimed record', async () => {
    const { repository, model, audit } = repositoryFixture();
    model.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit).not.toHaveBeenCalled();
  });

  it('propagates FK and audit failures so the transaction rolls back', async () => {
    const { repository, model, audit } = repositoryFixture();
    const foreignKeyError = { code: 'P2003' };
    model.deleteMany.mockRejectedValueOnce(foreignKeyError);
    await expect(
      repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!),
    ).rejects.toBe(foreignKeyError);
    expect(audit).not.toHaveBeenCalled();
    audit.mockRejectedValueOnce(new Error('audit failed'));
    await expect(
      repository.remove('banks', id, 3, actor.userId, actor.branchIds[0]!),
    ).rejects.toThrow('audit failed');
  });

  it.each(['APPROVED', 'REJECTED', 'EXPIRED'])(
    'preserves %s exchange-rate history',
    async (status) => {
      const { repository, model } = repositoryFixture(
        'masterDraftExchangeRate',
        status,
      );
      await expect(
        repository.remove(
          'exchange-rates',
          id,
          3,
          actor.userId,
          actor.branchIds[0]!,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(model.updateMany).not.toHaveBeenCalled();
      expect(model.deleteMany).not.toHaveBeenCalled();
    },
  );

  it('claims a Draft rate with a status predicate to guard concurrent approval', async () => {
    const { repository, model } = repositoryFixture('masterDraftExchangeRate');
    await repository.remove(
      'exchange-rates',
      id,
      3,
      actor.userId,
      actor.branchIds[0]!,
    );
    expect(model.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, version: 3, status: 'DRAFT' } }),
    );
  });
});

describe('owned association cleanup', () => {
  it.each([
    ['organizations', 'masterOrganizationRole', 'organizationId'],
    ['suppliers', 'masterSupplierService', 'supplierId'],
    ['brokers', 'masterBrokerService', 'brokerId'],
    ['composite-hotels', 'masterCompositeHotelMember', 'compositeHotelId'],
    ['insurance-plans', 'masterInsurancePlanCoverage', 'planId'],
    ['bus-types', 'masterBusTypeFacility', 'busTypeId'],
  ] as const)(
    'removes only associations owned by %s',
    async (resource, delegate, key) => {
      const deleteMany = vi.fn();
      const tx = {
        [delegate]: { deleteMany },
      } as unknown as Prisma.TransactionClient;
      await removeOwnedMasterDataLinks(tx, resource, id);
      expect(deleteMany).toHaveBeenCalledWith({ where: { [key]: id } });
    },
  );

  it('removes hotel associations but never the referenced facilities, meals or rooms', async () => {
    const models = [
      'masterHotelFacility',
      'masterHotelMealService',
      'masterHotelRoomType',
    ];
    const tx = Object.fromEntries(
      models.map((model) => [model, { deleteMany: vi.fn() }]),
    );
    await removeOwnedMasterDataLinks(
      tx as unknown as Prisma.TransactionClient,
      'hotels',
      id,
    );
    for (const model of models)
      expect(tx[model]!.deleteMany).toHaveBeenCalledWith({
        where: { hotelId: id },
      });
  });

  it.each([
    'countries',
    'banks',
    'facilities',
    'travel-services',
    'currencies',
  ] as MasterDataResource[])(
    'never cascades consumer references for %s',
    async (resource) => {
      await expect(
        removeOwnedMasterDataLinks(
          {} as Prisma.TransactionClient,
          resource,
          id,
        ),
      ).resolves.toBeUndefined();
    },
  );
});
