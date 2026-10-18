import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  WorkbenchRequestInputV1,
} from '@nora/contracts';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CustomerAffairsService } from './customer-affairs.service';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { WorkbenchRequestDto } from './customer-affairs.dto';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  branchIds: ['22222222-2222-4222-8222-222222222222'],
  permissions: [],
} as unknown as AuthenticatedActor;
const unitId = '33333333-3333-4333-8333-333333333333';
const recipientId = '44444444-4444-4444-8444-444444444444';
const input: WorkbenchRequestInputV1 = {
  subject: 'بررسی رزرو',
  description: 'لطفاً رزرو بررسی شود.',
  priority: 'HIGH',
  organizationUnitId: unitId,
  executionOwnerUserId: recipientId,
};
const member = {
  id: recipientId,
  displayName: 'گیرنده آزمون',
  username: 'test-recipient',
  profile: { organizationUnitId: unitId },
};

describe('IAM public Workbench request directory', () => {
  function setup() {
    const db = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: actor.userId }),
        findMany: vi.fn().mockResolvedValue([member]),
      },
      $queryRaw: vi.fn(),
    };
    const units = {
      list: vi.fn().mockResolvedValue([{ id: unitId, name: 'رزرواسیون' }]),
      lock: vi.fn(),
    };
    const directory = new IamWorkbenchRequestDirectory(
      { client: db } as never,
      units as never,
    );
    return { db, units, directory };
  }
  it('projects the actual unit association with active internal same-branch accounts and no private account fields', async () => {
    const { db, directory } = setup();
    expect(await directory.options(actor, actor.branchIds[0]!)).toEqual({
      units: [
        {
          id: unitId,
          name: 'رزرواسیون',
          users: [
            {
              id: recipientId,
              displayName: member.displayName,
              username: member.username,
            },
          ],
        },
      ],
    });
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          b2bOrganizationUser: null,
          profile: { organizationUnitId: { in: [unitId] } },
          branches: {
            some: { branchId: actor.branchIds[0], branch: { isActive: true } },
          },
        }),
      }),
    );
    expect(db.user.findMany.mock.calls[0]![0].select).not.toHaveProperty(
      'email',
    );
  });
  it('rejects another branch before querying and rejects an inactive or removed operator', async () => {
    const { directory, db } = setup();
    await expect(directory.options(actor, 'outside')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.user.findFirst).not.toHaveBeenCalled();
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      directory.options(actor, actor.branchIds[0]!),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rechecks membership under locks and rejects stale/mismatched recipients', async () => {
    const { directory, db, units } = setup();
    await expect(
      directory.resolve(
        db as never,
        actor,
        actor.branchIds[0]!,
        unitId,
        recipientId,
      ),
    ).resolves.toMatchObject({ recipient: { id: recipientId } });
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
    expect(units.lock).toHaveBeenCalledWith(db, unitId);
    db.user.findMany.mockResolvedValue([]);
    await expect(
      directory.resolve(
        db as never,
        actor,
        actor.branchIds[0]!,
        unitId,
        recipientId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await directory.options(actor, actor.branchIds[0]!)).toMatchObject({
      units: [{ users: [] }],
    });
  });
  it('reads only active HR organization units and omits invalid labels', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: unitId, values: ['رزرواسیون'] },
      { id: 'invalid', values: [] },
    ]);
    const units = new HrWorkbenchRequestUnits({
      client: { hrRecord: { findMany } },
    } as never);
    expect(await units.list(actor.branchIds[0]!)).toEqual([
      { id: unitId, name: 'رزرواسیون' },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: actor.branchIds[0],
          section: 'organization',
          tab: 'units',
          status: 'فعال',
          deletedAt: null,
        },
      }),
    );
  });
});

describe('Workbench request assignment and delivery', () => {
  function setup() {
    const tx = {
      customerAffairsTicket: {
        create: vi
          .fn()
          .mockImplementation(({ data }) => ({
            ...data,
            id: 'request',
            status: 'NEW',
            version: 1,
          })),
      },
      customerAffairsTimeline: { create: vi.fn() },
      customerAffairsCommand: { create: vi.fn() },
      customerAffairsAuditEvent: { create: vi.fn() },
    };
    const repository = {
      findTicketCommand: vi.fn().mockResolvedValue(null),
      transaction: vi.fn(async (fn) => fn(tx)),
      workbenchRequests: vi.fn(),
    };
    const notifications = { createWithinTransaction: vi.fn() };
    const directory = {
      resolve: vi
        .fn()
        .mockResolvedValue({
          unit: { id: unitId, name: 'رزرواسیون' },
          recipient: member,
        }),
      options: vi.fn(),
    };
    const service = new CustomerAffairsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
      {} as never,
      undefined,
      directory as never,
    );
    vi.spyOn(service, 'getTicket').mockResolvedValue({
      data: { id: 'request', trackingNumber: 'tracking' },
    } as never);
    return { service, tx, repository, notifications, directory };
  }
  it('creates an actual executor FK and atomically notifies that user with a Workbench link', async () => {
    const { service, tx, notifications, directory } = setup();
    await service.createWorkbenchRequest(
      input,
      actor,
      actor.branchIds[0],
      'request-key',
    );
    expect(directory.resolve).toHaveBeenCalledWith(
      tx,
      actor,
      actor.branchIds[0],
      unitId,
      recipientId,
    );
    expect(tx.customerAffairsTicket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByUserId: actor.userId,
        customerOwnerUserId: actor.userId,
        executionOwnerUserId: recipientId,
        executionUnit: 'رزرواسیون',
        category: 'WORKBENCH_INTERNAL',
        branchId: actor.branchIds[0],
        description: input.description,
      }),
    });
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        recipientUserIds: [actor.userId, recipientId],
        href: '/workbench?tab=requests&request=request',
        title: 'درخواست جدید میزکار',
      }),
    );
  });
  it('writes nothing and sends no notification for a mismatched recipient', async () => {
    const { service, directory, tx, notifications } = setup();
    directory.resolve.mockRejectedValue(new BadRequestException());
    await expect(
      service.createWorkbenchRequest(input, actor, actor.branchIds[0], 'key'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.customerAffairsTicket.create).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('requires recipient and rejects combined overlong description/reference before a write', async () => {
    const { service, repository } = setup();
    await expect(
      service.createWorkbenchRequest(
        { ...input, executionOwnerUserId: '' },
        actor,
        undefined,
        'key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createWorkbenchRequest(
        { ...input, description: 'x'.repeat(2000), reference: 'ref' },
        actor,
        undefined,
        'key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.transaction).not.toHaveBeenCalled();
  });
  it('retains a stable idempotency fingerprint on retry despite changing server timestamps', async () => {
    const { service, tx } = setup();
    await service.createWorkbenchRequest(input, actor, undefined, 'key');
    await new Promise((resolve) => setTimeout(resolve, 3));
    await service.createWorkbenchRequest(input, actor, undefined, 'key');
    const hashes = tx.customerAffairsCommand.create.mock.calls.map(
      (call) => call[0].data.requestFingerprint,
    );
    expect(hashes[0]).toBe(hashes[1]);
    await service.createWorkbenchRequest(
      { ...input, executionOwnerUserId: actor.userId },
      actor,
      undefined,
      'key-2',
    );
    expect(
      tx.customerAffairsCommand.create.mock.calls[2]![0].data
        .requestFingerprint,
    ).not.toBe(hashes[0]);
  });
  it('projects incoming/outgoing identity without querying another user inbox', async () => {
    const { service, repository } = setup();
    repository.workbenchRequests.mockResolvedValue([
      {
        id: 'request',
        trackingNumber: 'tracking',
        subject: input.subject,
        description: input.description,
        executionUnit: 'رزرواسیون',
        status: 'NEW',
        priority: 'HIGH',
        createdByUserId: actor.userId,
        executionOwnerUserId: recipientId,
        createdBy: { displayName: 'فرستنده' },
        executionOwner: member,
        nextActionAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    expect((await service.workbenchRequests(actor)).data[0]).toMatchObject({
      direction: 'outgoing',
      recipientName: member.displayName,
      senderName: 'فرستنده',
    });
    expect(
      (await service.workbenchRequests({ ...actor, userId: recipientId }))
        .data[0],
    ).toMatchObject({ direction: 'incoming' });
  });
  it('limits persistent inbox queries to sender/recipient in authorized branches and protects personalized requests from department-wide HR lists', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new CustomerAffairsRepository({
      client: { customerAffairsTicket: { findMany } },
    } as never);
    await repository.workbenchRequests(recipientId, actor.branchIds);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { createdByUserId: recipientId },
            { executionOwnerUserId: recipientId },
          ],
          branchId: { in: actor.branchIds },
          category: { startsWith: 'WORKBENCH_' },
        },
      }),
    );
    await repository.hrWorkbenchRequests(actor.branchIds);
    expect(findMany.mock.calls[1]![0].where.category.not).toBe(
      'WORKBENCH_INTERNAL',
    );
  });
  it('validates required real UUIDs and supported priorities in the HTTP DTO', async () => {
    expect(await validate(plainToInstance(WorkbenchRequestDto, input))).toEqual(
      [],
    );
    const errors = await validate(
      plainToInstance(WorkbenchRequestDto, {
        ...input,
        organizationUnitId: 'reservation',
        executionOwnerUserId: null,
        priority: 'unknown',
      }),
    );
    expect(errors.map((error) => error.property).sort()).toEqual([
      'executionOwnerUserId',
      'organizationUnitId',
      'priority',
    ]);
  });
});
