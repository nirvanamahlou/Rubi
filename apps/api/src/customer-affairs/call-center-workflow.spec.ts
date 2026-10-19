import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService } from './call-center.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import type { CallCenterRequestDto } from './call-center-workflow.dto';
import { CallCenterFollowUpDto } from './call-center-workflow.dto';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('Call Center workflow input', () => {
  it('requires canonical identifiers, bounded priority and a real date', async () => {
    expect(
      (
        await validate(
          plainToInstance(CallCenterFollowUpDto, {
            id: 'bad',
            commandId: 'bad',
            expectedVersion: -1,
            ownerId: 'bad',
            dueAt: 'yesterday',
            action: '',
            priority: 'custom',
            status: 'done',
            result: '',
          }),
        )
      ).length,
    ).toBeGreaterThan(5);
  });
});

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'Call Center package one PostgreSQL',
  () => {
    let db: DatabaseClient,
      calls: CallCenterService,
      workflow: CallCenterWorkflowService,
      directory: IamCallCenterDirectory;
    const branchId = randomUUID(),
      otherBranch = randomUUID(),
      userId = randomUUID(),
      inactiveId = randomUUID();
    const actor = {
      userId,
      branchIds: [branchId],
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.calls.create',
        'customer_affairs.call_center.notes.create',
        'customer_affairs.call_center.workflow.manage',
      ],
    } as AuthenticatedActor;
    let contactId = '',
      callId = '';
    const request: CallCenterRequestDto = {
      commandId: randomUUID(),
      id: randomUUID(),
      expectedVersion: 0,
      title: 'Synthetic request',
      status: 'NEW',
      ownerId: userId,
      priority: 'NORMAL',
      reason: '',
    };
    const follow: CallCenterFollowUpDto = {
      commandId: randomUUID(),
      id: randomUUID(),
      expectedVersion: 0,
      ownerId: userId,
      dueAt: '2026-01-01T10:00:00Z',
      action: 'Synthetic follow-up',
      priority: 'HIGH',
      status: 'OPEN',
      result: '',
    };
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        ![
          '/nora_call_center_package_one_test_1019',
          '/nora_call_center_test_1018',
          '/nora_ci',
        ].includes(url.pathname)
      )
        throw Error('Disposable database required');
      db = createDatabaseClient(url.toString());
      await db.branch.createMany({
        data: [branchId, otherBranch].map((id) => ({
          id,
          code: id,
          name: 'Synthetic workflow branch',
        })),
      });
      await db.user.createMany({
        data: [
          {
            id: userId,
            username: userId,
            displayName: 'Synthetic operator',
            passwordHash: 'not-a-login',
            status: 'ACTIVE',
          },
          {
            id: inactiveId,
            username: inactiveId,
            displayName: 'Synthetic inactive',
            passwordHash: 'not-a-login',
            status: 'INACTIVE',
          },
        ],
      });
      await db.userBranch.create({ data: { userId, branchId } });
      const role = await db.role.create({
        data: {
          code: randomUUID(),
          name: 'Synthetic workflow role',
          isActive: true,
          isSystem: false,
        },
      });
      for (const code of actor.permissions) {
        const permission = await db.permission.upsert({
          where: { code },
          update: {},
          create: { code, module: 'customer_affairs', name: code },
        });
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
      await db.userRole.create({ data: { userId, roleId: role.id } });
      const crypto = new CallCenterCrypto(
        new ConfigService({
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
        }),
      );
      const database = { client: db } as never;
      calls = new CallCenterService(database, crypto);
      directory = new IamCallCenterDirectory(database);
      workflow = new CallCenterWorkflowService(
        database,
        crypto,
        directory,
        new CallCenterTasksService(database),
        new NotificationsService({} as never),
      );
      const call = await calls.create(
        {
          id: randomUUID(),
          phone: '09120000004',
          name: '',
          subject: 'Synthetic subject',
          source: 'نامشخص',
          operator: 'نامشخص',
          direction: 'INBOUND',
          outcome: 'ANSWERED',
          status: 'جدید',
          occurredAt: '2026-10-19T10:00:00Z',
          note: '',
        },
        actor,
        branchId,
      );
      contactId = call.data.contactId;
      callId = call.data.id;
    }, 30000);
    afterAll(async () => {
      workflow?.onModuleDestroy();
      await db?.$disconnect();
    });
    it('publishes active authorized same-branch identities only', async () => {
      expect(await directory.list(branchId)).toEqual([
        { id: userId, displayName: 'Synthetic operator' },
      ]);
      await expect(
        db.$transaction((tx) => directory.resolve(tx, branchId, inactiveId)),
      ).rejects.toThrow();
      expect(await directory.list(otherBranch)).toEqual([]);
    });
    it('isolates anonymous callers while preserving an identical replay', async () => {
      const input = {
        id: randomUUID(),
        phone: '',
        name: '',
        subject: 'Unknown caller',
        source: 'نامشخص',
        operator: 'نامشخص',
        direction: 'INBOUND' as const,
        status: 'جدید' as const,
        occurredAt: '2026-10-19T10:00:00Z',
        note: '',
      };
      const first = await calls.create(input, actor, branchId),
        replay = await calls.create(input, actor, branchId),
        second = await calls.create(
          { ...input, id: randomUUID() },
          actor,
          branchId,
        );
      expect(first.data.contactId).toBe(replay.data.contactId);
      expect(first.data.contactId).not.toBe(second.data.contactId);
    });
    it('creates exactly one request under concurrent retries without plaintext private content', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          workflow.saveRequest(actor, branchId, contactId, request),
        ),
      );
      expect(results.every((result) => result.data.length === 1)).toBe(true);
      const row = await db.customerAffairsTicket.findUniqueOrThrow({
        where: { id: request.id },
      });
      expect(row.callCenterPayload).not.toContain(request.title);
      expect(row.subject).not.toBe(request.title);
      expect(
        (await workflow.queue(actor, branchId, 'MINE', 1)).data.map(
          (item) => item.id,
        ),
      ).toContain(request.id);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: request.id, action: 'REQUEST_CREATED' },
        }),
      ).toBe(1);
      await expect(
        workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          title: 'Changed retry',
        }),
      ).rejects.toThrow();
    });
    it('enforces resource branch, workflow permission and optimistic request versions', async () => {
      await expect(
        workflow.list(actor, otherBranch, contactId),
      ).rejects.toThrow();
      await expect(
        workflow.saveRequest(
          {
            ...actor,
            permissions: ['customer_affairs.call_center.read'],
          } as AuthenticatedActor,
          branchId,
          contactId,
          request,
        ),
      ).rejects.toThrow();
      await expect(
        workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          commandId: randomUUID(),
        }),
      ).rejects.toThrow();
      const updated = await workflow.saveRequest(actor, branchId, contactId, {
        ...request,
        commandId: randomUUID(),
        expectedVersion: 1,
        status: 'IN_PROGRESS',
      });
      expect(updated.data[0]?.version).toBe(2);
    });
    it('links a saved call to its own contact request with replay safety', async () => {
      const input = {
        commandId: randomUUID(),
        ticketId: request.id,
        expectedTicketId: null,
      };
      await workflow.link(actor, branchId, callId, input);
      await workflow.link(actor, branchId, callId, input);
      expect(
        (await db.callCenterCall.findUniqueOrThrow({ where: { id: callId } }))
          .ticketId,
      ).toBe(request.id);
      await expect(
        workflow.link(actor, branchId, callId, {
          ...input,
          commandId: randomUUID(),
        }),
      ).rejects.toThrow();
    });
    it('stores a single Tasks-owned follow-up under retries and rejects stale edits', async () => {
      await Promise.all(
        Array.from({ length: 5 }, () =>
          workflow.followUp(actor, branchId, request.id, follow),
        ),
      );
      expect(await db.automationTask.count({ where: { id: follow.id } })).toBe(
        1,
      );
      const stored = await db.automationTask.findUniqueOrThrow({
        where: { id: follow.id },
      });
      expect(JSON.stringify(stored.payload)).not.toContain(follow.action);
      await expect(
        workflow.followUp(actor, branchId, request.id, {
          ...follow,
          commandId: randomUUID(),
        }),
      ).rejects.toThrow();
      expect(
        (await workflow.queue(actor, branchId, 'MINE', 1)).data.map(
          (item) => item.id,
        ),
      ).toContain(request.id);
      expect(
        (await workflow.queue(actor, branchId, 'OVERDUE', 1)).data.map(
          (item) => item.id,
        ),
      ).toContain(request.id);
    });
    it('deduplicates due reminders and invalidates the old schedule on rescheduling', async () => {
      await workflow.remind(new Date('2026-10-20T10:00:00Z'));
      await workflow.remind(new Date('2026-10-20T10:00:00Z'));
      const where = {
        entityId: follow.id,
        title: 'موعد پیگیری کال سنتر رسیده است',
      };
      expect(await db.notification.count({ where })).toBe(1);
      await workflow.followUp(actor, branchId, request.id, {
        ...follow,
        commandId: randomUUID(),
        expectedVersion: 1,
        dueAt: '2027-01-01T10:00:00Z',
      });
      await workflow.remind(new Date('2026-10-20T10:00:00Z'));
      expect(await db.notification.count({ where })).toBe(1);
    });
    it('requires a result, prevents closing with open work and preserves final actions', async () => {
      await expect(
        workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          commandId: randomUUID(),
          expectedVersion: 2,
          status: 'CLOSED',
          reason: 'Resolved',
        }),
      ).rejects.toThrow();
      await expect(
        workflow.followUp(actor, branchId, request.id, {
          ...follow,
          commandId: randomUUID(),
          expectedVersion: 2,
          status: 'COMPLETED',
        }),
      ).rejects.toThrow();
      await workflow.followUp(actor, branchId, request.id, {
        ...follow,
        commandId: randomUUID(),
        expectedVersion: 2,
        status: 'COMPLETED',
        result: 'Synthetic result',
      });
      await expect(
        workflow.followUp(actor, branchId, request.id, {
          ...follow,
          commandId: randomUUID(),
          expectedVersion: 3,
        }),
      ).rejects.toThrow();
      const closed = await workflow.saveRequest(actor, branchId, contactId, {
        ...request,
        commandId: randomUUID(),
        expectedVersion: 2,
        status: 'CLOSED',
        reason: 'Resolved',
      });
      expect(closed.data[0]?.status).toBe('CLOSED');
      await expect(
        workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          commandId: randomUUID(),
          expectedVersion: 3,
          reason: '',
        }),
      ).rejects.toThrow();
      const reopened = await workflow.saveRequest(actor, branchId, contactId, {
        ...request,
        commandId: randomUUID(),
        expectedVersion: 3,
        reason: 'New information',
      });
      expect(reopened.data[0]?.version).toBe(4);
      expect(reopened.data[0]?.followUps[0]?.result).toBe('Synthetic result');
    });
    it('serializes a reused task ID across two different requests', async () => {
      const one = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        title: 'Synthetic collision one',
      };
      const two = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        title: 'Synthetic collision two',
      };
      await workflow.saveRequest(actor, branchId, contactId, one);
      await workflow.saveRequest(actor, branchId, contactId, two);
      const taskId = randomUUID();
      const attempts = await Promise.allSettled(
        [one, two].map((item) =>
          workflow.followUp(actor, branchId, item.id, {
            ...follow,
            id: taskId,
            commandId: randomUUID(),
          }),
        ),
      );
      expect(
        attempts.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((item) => item.status === 'rejected'),
      ).toHaveLength(1);
      const stored = await db.automationTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      expect(stored.callCenterTicketId).toBe(stored.sourceReference);
      await db.automationTask.update({
        where: { id: taskId },
        data: { status: 'CANCELLED' },
      });
    });
    it('requires destination permission and keeps referrals replay-safe without duplicate cases', async () => {
      const item = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        title: 'Synthetic referral',
      };
      await workflow.saveRequest(actor, branchId, contactId, item);
      const input = {
        commandId: randomUUID(),
        expectedVersion: 1,
        ownerId: userId,
        destination: 'SUPPORT' as const,
        dueAt: '2026-11-01T10:00:00Z',
      };
      await expect(
        workflow.refer(actor, branchId, item.id, input),
      ).rejects.toThrow();
      const role = await db.userRole.findFirstOrThrow({ where: { userId } });
      const permission = await db.permission.upsert({
        where: { code: 'customer_affairs.ticket.read' },
        update: {},
        create: {
          code: 'customer_affairs.ticket.read',
          module: 'customer_affairs',
          name: 'Synthetic support read',
        },
      });
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.roleId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: role.roleId, permissionId: permission.id },
      });
      await Promise.all(
        Array.from({ length: 5 }, () =>
          workflow.refer(actor, branchId, item.id, input),
        ),
      );
      expect(
        await db.customerAffairsReferral.count({
          where: { ticketId: item.id },
        }),
      ).toBe(1);
      await expect(
        workflow.refer(actor, branchId, item.id, {
          ...input,
          commandId: randomUUID(),
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await db.customerAffairsTicket.count({ where: { id: item.id } }),
      ).toBe(1);
    });
  },
);
