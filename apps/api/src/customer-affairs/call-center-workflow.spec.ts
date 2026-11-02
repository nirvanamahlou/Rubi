import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService } from './call-center.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import type { CallCenterRequestDto } from './call-center-workflow.dto';
import {
  CallCenterFollowUpDto,
  CallCenterRequestDto as RequestInput,
} from './call-center-workflow.dto';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('Call Center workflow input', () => {
  it.each([undefined, '', '   ', '\n\t', 'x'.repeat(501)])(
    'rejects missing, blank or oversized request reasons: %s',
    async (reason) => {
      const errors = await validate(
        plainToInstance(RequestInput, {
          id: randomUUID(),
          commandId: randomUUID(),
          expectedVersion: 0,
          title: 'Synthetic request',
          priority: 'NORMAL',
          reason,
        }),
      );
      expect(errors.some((error) => error.property === 'reason')).toBe(true);
    },
  );
  it('accepts a bounded meaningful request reason', async () => {
    const errors = await validate(
      plainToInstance(RequestInput, {
        id: randomUUID(),
        commandId: randomUUID(),
        expectedVersion: 0,
        title: 'Synthetic request',
        priority: 'NORMAL',
        reason: 'Synthetic reason',
      }),
    );
    expect(errors).toEqual([]);
  });
  it('defaults a new request to waiting for agent action', () => {
    expect(plainToInstance(RequestInput, {}).status).toBe('IN_PROGRESS');
  });
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
      reason: 'Synthetic request reason',
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
          '/nora_call_request_pending_1024',
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
      vi.spyOn(directory, 'canManageRequest').mockResolvedValue(true);
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
    it('rejects a forged request owner even when the other account is active in the same branch', async () => {
      const otherId = randomUUID();
      await db.user.create({
        data: {
          id: otherId,
          username: otherId,
          displayName: 'Synthetic other agent',
          status: 'ACTIVE',
          passwordHash: 'not-a-login',
        },
      });
      await db.userBranch.create({ data: { userId: otherId, branchId } });
      const id = randomUUID();
      await expect(
        workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          id,
          commandId: randomUUID(),
          ownerId: otherId,
        }),
      ).rejects.toThrow('خارج از محدوده');
      expect(await db.customerAffairsTicket.count({ where: { id } })).toBe(0);
      expect(
        (await workflow.requestOptions(actor, branchId)).data.map(
          (row) => row.id,
        ),
      ).toEqual([userId]);
    });
    it('filters closed requests before paging without changing the default dossier history', async () => {
      const contact = (
        await calls.create(
          {
            id: randomUUID(),
            phone: '+12025550067',
            name: 'Test',
            subject: 'Test',
            source: 'Website',
            operator: 'Test',
            direction: 'INBOUND',
            status: 'جدید',
            occurredAt: new Date().toISOString(),
            note: '',
          },
          actor,
          branchId,
        )
      ).data.contactId;
      for (let index = 0; index < 11; index++) {
        const id = randomUUID();
        await workflow.saveRequest(actor, branchId, contact, {
          ...request,
          id,
          commandId: randomUUID(),
          title: `Closed ${index}`,
        });
        await workflow.saveRequest(actor, branchId, contact, {
          ...request,
          id,
          commandId: randomUUID(),
          expectedVersion: 1,
          title: `Closed ${index}`,
          status: 'CLOSED',
          result: 'Resolved',
          reason: 'Resolved',
        });
      }
      await workflow.saveRequest(actor, branchId, contact, {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        title: 'Open test request',
      });
      const open = await workflow.list(
        actor,
        branchId,
        contact,
        1,
        1,
        undefined,
        true,
      );
      expect(open.meta.total).toBe(1);
      expect(open.data.map((row) => row.title)).toEqual(['Open test request']);
      expect((await workflow.list(actor, branchId, contact)).meta.total).toBe(
        12,
      );
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
    it('blocks forged management edits but allows agent reason/result updates without changing protected fields', async () => {
      const input = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        status: 'IN_PROGRESS',
      };
      await workflow.saveRequest(actor, branchId, contactId, input);
      vi.mocked(directory.canManageRequest).mockResolvedValue(false);
      try {
        for (const change of [
          { title: 'Forged title' },
          { priority: 'HIGH' },
          { status: 'CLOSED' },
          { ownerId: null },
        ]) {
          await expect(
            workflow.saveRequest(actor, branchId, contactId, {
              ...input,
              ...change,
              expectedVersion: 1,
              commandId: randomUUID(),
            }),
          ).rejects.toThrow('فقط برای مدیر واحد');
        }
        const unchanged = await db.customerAffairsTicket.findUniqueOrThrow({
          where: { id: input.id },
        });
        expect(unchanged.version).toBe(1);
        const result = await workflow.saveRequest(actor, branchId, contactId, {
          ...input,
          expectedVersion: 1,
          commandId: randomUUID(),
          reason: 'Agent progress',
          result: 'Agent findings',
        });
        expect(result.data.find((row) => row.id === input.id)).toMatchObject({
          canEditManagement: false,
          title: input.title,
          status: 'IN_PROGRESS',
          priority: 'NORMAL',
          ownerId: userId,
          reason: 'Agent progress',
          result: 'Agent findings',
        });
        for (const [index, status] of [
          'WAITING_CUSTOMER',
          'IN_PROGRESS',
        ].entries()) {
          const saved = await workflow.saveRequest(actor, branchId, contactId, {
            ...input,
            status,
            expectedVersion: 2 + index,
            commandId: randomUUID(),
          });
          expect(saved.data.find((row) => row.id === input.id)?.status).toBe(
            status,
          );
        }
      } finally {
        vi.mocked(directory.canManageRequest).mockResolvedValue(true);
        await db.customerAffairsTicket.delete({ where: { id: input.id } });
      }
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
      // Legacy NEW clients retain replay safety but cannot persist NEW anymore.
      expect(row.status).toBe('IN_PROGRESS');
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
    it('creates in waiting-agent state and rejects new waiting-customer or closed requests', async () => {
      const isolatedContact = (
        await calls.create(
          {
            id: randomUUID(),
            phone: '+12025550068',
            name: 'Synthetic',
            subject: 'Synthetic',
            source: 'Website',
            operator: 'Synthetic',
            direction: 'INBOUND',
            status: 'جدید',
            occurredAt: new Date().toISOString(),
            note: '',
          },
          actor,
          branchId,
        )
      ).data.contactId;
      const input = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        status: 'IN_PROGRESS',
      };
      await workflow.saveRequest(actor, branchId, isolatedContact, input);
      expect(
        (
          await db.customerAffairsTicket.findUniqueOrThrow({
            where: { id: input.id },
          })
        ).status,
      ).toBe('IN_PROGRESS');
      for (const status of ['WAITING_CUSTOMER', 'CLOSED']) {
        const id = randomUUID();
        await expect(
          workflow.saveRequest(actor, branchId, isolatedContact, {
            ...input,
            id,
            commandId: randomUUID(),
            status,
            reason: 'Synthetic reason',
          }),
        ).rejects.toMatchObject({ status: 400 });
        expect(await db.customerAffairsTicket.count({ where: { id } })).toBe(0);
      }
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
    it('lists all authorized branches including closed requests independently of selected branch', async () => {
      const multi = { ...actor, branchIds: [branchId, otherBranch] };
      const call = await calls.create(
        {
          id: randomUUID(),
          phone: '09120009999',
          name: 'Synthetic other branch',
          subject: 'Queue scope test',
          source: 'گوگل',
          operator: 'پشتیبانی',
          direction: 'INBOUND',
          status: 'جدید',
          outcome: 'ANSWERED',
          occurredAt: '2026-10-19T10:00:00Z',
          note: '',
        },
        multi,
        otherBranch,
      );
      const template = await db.customerAffairsTicket.findUniqueOrThrow({
        where: { id: request.id },
      });
      const id = randomUUID(),
        contact = call.data.contactId!;
      await db.customerAffairsTicket.create({
        data: {
          ...template,
          references: [],
          id,
          trackingNumber: id.slice(0, 30),
          branchId: otherBranch,
          callCenterContactId: contact,
          status: 'CLOSED',
          callCenterPayload: new CallCenterCrypto(
            new ConfigService({
              CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(
                32,
                7,
              ).toString('base64'),
              CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(
                32,
                9,
              ).toString('base64'),
              CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
            }),
          ).encrypt(
            { title: 'Synthetic closed request' },
            'request:' + id + ':' + contact,
          ),
          callCenterKeyVersion: 1,
        },
      });
      const one = await workflow.queue(multi, branchId, 'ALL', 1);
      const two = await workflow.queue(multi, otherBranch, 'ALL', 1);
      expect(one.meta.counts.ALL).toBe(one.meta.total);
      expect(two.meta.counts).toEqual(one.meta.counts);
      expect(
        (await workflow.queue(actor, branchId, 'ALL', 1)).meta.counts.ALL,
      ).toBeLessThan(one.meta.counts.ALL!);
      expect(one.data.map((r) => r.id)).toEqual(two.data.map((r) => r.id));
      expect(one.data.find((r) => r.id === id)).toMatchObject({
        branchId: otherBranch,
        status: 'CLOSED',
        title: 'Synthetic closed request',
      });
      const closed = await workflow.queue(multi, branchId, 'CLOSED', 1);
      expect(closed.data.some((r) => r.id === id)).toBe(true);
      expect(closed.data.every((r) => r.status === 'CLOSED')).toBe(true);
      expect(closed.meta.total).toBe(one.meta.counts.CLOSED);
      expect(one.meta.counts.ALL).toBe(
        one.meta.counts.OPEN! + one.meta.counts.CLOSED!,
      );
      const restricted = await workflow.queue(actor, otherBranch, 'CLOSED', 1);
      expect(restricted.data.some((r) => r.id === id)).toBe(false);
      expect(restricted.meta.total).toBeLessThan(closed.meta.total);
      expect(
        (await workflow.queue(multi, branchId, 'OPEN', 1)).data.some(
          (r) => r.id === id,
        ),
      ).toBe(false);
      expect(
        (await workflow.queue(actor, otherBranch, 'ALL', 1)).data.some(
          (r) => r.id === id,
        ),
      ).toBe(false);
    });
    it('counts requests once, chooses the earliest open action and excludes waiting/closed requests from missing-action work', async () => {
      const item = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        expectedVersion: 0,
        status: 'NEW',
        ownerId: null,
      };
      await workflow.saveRequest(actor, branchId, contactId, item);
      expect(
        (await workflow.queue(actor, branchId, 'NO_ACTION', 1)).data.some(
          (row) => row.id === item.id,
        ),
      ).toBe(true);
      const first = {
        ...follow,
        id: randomUUID(),
        commandId: randomUUID(),
        expectedVersion: 0,
        dueAt: '2020-01-01T00:00:00Z',
        action: 'Earliest synthetic action',
      };
      await workflow.followUp(actor, branchId, item.id, first);
      await workflow.followUp(actor, branchId, item.id, {
        ...first,
        id: randomUUID(),
        commandId: randomUUID(),
        dueAt: '2020-02-01T00:00:00Z',
      });
      const queue = await workflow.queue(actor, branchId, 'OVERDUE', 1);
      expect(queue.meta.counts.OVERDUE).toBe(queue.meta.total);
      expect(queue.data.filter((row) => row.id === item.id)).toHaveLength(1);
      expect(queue.data.find((row) => row.id === item.id)?.dueAt).toBe(
        '2020-01-01T00:00:00.000Z',
      );
      expect(
        (await workflow.nextAction(actor, branchId, contactId)).data,
      ).toMatchObject({
        id: first.id,
        requestId: item.id,
        action: first.action,
      });
      await expect(
        workflow.nextAction(actor, otherBranch, contactId),
      ).rejects.toMatchObject({ status: 403 });
      expect(
        (await workflow.queue(actor, branchId, 'NO_ACTION', 1)).data.some(
          (row) => row.id === item.id,
        ),
      ).toBe(false);
      const waiting = {
        ...item,
        id: randomUUID(),
        commandId: randomUUID(),
        status: 'NEW',
      };
      await workflow.saveRequest(actor, branchId, contactId, waiting);
      await workflow.saveRequest(actor, branchId, contactId, {
        ...waiting,
        commandId: randomUUID(),
        expectedVersion: 1,
        status: 'WAITING_CUSTOMER',
      });
      expect(
        (await workflow.queue(actor, branchId, 'NO_ACTION', 1)).data.some(
          (row) => row.id === waiting.id,
        ),
      ).toBe(false);
    });
    it('loads a selected request and closes it with encrypted result and one configured manager notification', async () => {
      const previous = process.env.CALL_CENTER_CLOSURE_MANAGER_IDS;
      const item = {
        ...request,
        id: randomUUID(),
        commandId: randomUUID(),
        ownerId: userId,
        expectedVersion: 0,
      };
      try {
        delete process.env.CALL_CENTER_CLOSURE_MANAGER_IDS;
        expect(
          await db.$transaction((tx) =>
            directory.closureRecipients(tx, branchId),
          ),
        ).toEqual([]);
        process.env.CALL_CENTER_CLOSURE_MANAGER_IDS = `${userId},${inactiveId},${randomUUID()},${userId}`;
        expect(
          await db.$transaction((tx) =>
            directory.closureRecipients(tx, otherBranch),
          ),
        ).toEqual([]);
        await workflow.saveRequest(actor, branchId, contactId, item);
        const selected = await workflow.list(
          actor,
          branchId,
          contactId,
          1,
          1,
          item.id,
        );
        expect(selected.data.map((row) => row.id)).toEqual([item.id]);
        expect(selected.meta.total).toBe(1);
        expect(selected.meta.contactCallCount).toBeGreaterThan(0);
        expect(
          (await workflow.list(actor, branchId, contactId, 1, 1, randomUUID()))
            .data,
        ).toEqual([]);
        await expect(
          workflow.list(actor, otherBranch, contactId, 1, 1, item.id),
        ).rejects.toThrow();
        const closed = {
          ...item,
          commandId: randomUUID(),
          expectedVersion: 1,
          status: 'CLOSED',
          reason: 'Synthetic resolution',
          result: 'Synthetic private completion',
        };
        await expect(
          workflow.saveRequest(actor, branchId, contactId, {
            ...closed,
            commandId: randomUUID(),
            result: '',
          }),
        ).rejects.toThrow();
        await workflow.saveRequest(actor, branchId, contactId, closed);
        await workflow.saveRequest(actor, branchId, contactId, closed);
        const refreshed = await workflow.list(
          actor,
          branchId,
          contactId,
          1,
          1,
          item.id,
        );
        expect(refreshed.data[0]).toMatchObject({
          status: 'CLOSED',
          result: closed.result,
        });
        expect(refreshed.data[0]?.privateHistory).toHaveLength(2);
        const notices = await db.notification.findMany({
          where: {
            entityId: item.id,
            title: 'درخواست کال سنتر رسیدگی و بسته شد',
          },
        });
        expect(notices).toHaveLength(1);
        expect(notices[0]?.recipientUserId).toBe(userId);
        expect(JSON.stringify(notices)).not.toContain(closed.result);
        await workflow.saveRequest(actor, branchId, contactId, {
          ...closed,
          commandId: randomUUID(),
          expectedVersion: 2,
        });
        expect(
          await db.notification.count({
            where: {
              entityId: item.id,
              title: 'درخواست کال سنتر رسیدگی و بسته شد',
            },
          }),
        ).toBe(1);
      } finally {
        if (previous === undefined)
          delete process.env.CALL_CENTER_CLOSURE_MANAGER_IDS;
        else process.env.CALL_CENTER_CLOSURE_MANAGER_IDS = previous;
      }
    });
    it('orders queue by creation time with stable ties even after an old request changes', async () => {
      const ids: string[] = [randomUUID(), randomUUID(), randomUUID()].sort();
      for (const id of ids)
        await workflow.saveRequest(actor, branchId, contactId, {
          ...request,
          id,
          commandId: randomUUID(),
          priority: 'HIGH',
        });
      const old = new Date('2020-01-01T00:00:00Z');
      const recent = new Date('2021-01-01T00:00:00Z');
      await db.customerAffairsTicket.update({
        where: { id: ids[0]! },
        data: { createdAt: old, updatedAt: new Date('2030-01-01T00:00:00Z') },
      });
      for (const id of ids.slice(1))
        await db.customerAffairsTicket.update({
          where: { id },
          data: { createdAt: recent, updatedAt: old },
        });
      const rows = (
        await workflow.queue(actor, branchId, 'ALL', 1)
      ).data.filter((row) => ids.includes(row.id));
      expect(rows.map((row) => row.id)).toEqual([ids[1], ids[2], ids[0]]);
      expect(rows[0]).toMatchObject({
        priority: 'HIGH',
        createdAt: recent.toISOString(),
      });
    });
    it('requires a nonblank reason on creation and every request state edit without mutating stored data', async () => {
      const id = randomUUID();
      for (const reason of ['', '   ', '\n\t']) {
        await expect(
          workflow.saveRequest(actor, branchId, contactId, {
            ...request,
            id,
            commandId: randomUUID(),
            reason,
          }),
        ).rejects.toMatchObject({ status: 400 });
      }
      expect(
        await db.customerAffairsTicket.findUnique({ where: { id } }),
      ).toBeNull();
      await workflow.saveRequest(actor, branchId, contactId, {
        ...request,
        id,
        commandId: randomUUID(),
        reason: 'Synthetic creation reason',
      });
      for (const status of ['IN_PROGRESS', 'WAITING_CUSTOMER', 'CLOSED']) {
        await expect(
          workflow.saveRequest(actor, branchId, contactId, {
            ...request,
            id,
            commandId: randomUUID(),
            expectedVersion: 1,
            status,
            reason: ' \t ',
          }),
        ).rejects.toMatchObject({ status: 400 });
      }
      expect(
        await db.customerAffairsTicket.findUnique({ where: { id } }),
      ).toMatchObject({ version: 1, status: 'IN_PROGRESS' });
    });
  },
);
