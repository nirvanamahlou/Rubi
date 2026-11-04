import 'reflect-metadata';
import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { IamService } from '../iam/iam.service';
import { CallCenterOwnerController } from './call-center-owner.controller';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import { NotificationsService } from '../notifications/notifications.service';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  CALL_CENTER_SALES_EXPERT,
  CALL_CENTER_SALES_MANAGER,
  type AuthenticatedActor,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';
import { CallCenterAccessService } from './call-center-access.service';
import { CallCenterOwnerService } from './call-center-owner.service';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService } from './call-center.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterReadService } from './call-center-read.service';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import type { CallCenterSearchDto } from './call-center-search.dto';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'Call Center explicit scope and legacy compatibility (PostgreSQL)',
  () => {
    let app: INestApplication;
    let telephony: CallCenterTelephonyService;
    let db: DatabaseClient,
      access: CallCenterAccessService,
      owners: CallCenterOwnerService,
      calls: CallCenterService,
      read: CallCenterReadService,
      workflow: CallCenterWorkflowService;
    const branchId = randomUUID(),
      otherBranch = randomUUID(),
      unitId = randomUUID(),
      otherUnit = randomUUID();
    const expertId = randomUUID(),
      peerId = randomUUID(),
      managerId = randomUUID(),
      outsiderId = randomUUID();
    const expert = {
      userId: expertId,
      branchIds: [branchId],
      permissions: [...CALL_CENTER_SALES_EXPERT],
    } as AuthenticatedActor;
    const manager = {
      userId: managerId,
      branchIds: [branchId],
      permissions: [...CALL_CENTER_SALES_MANAGER],
    } as AuthenticatedActor;
    const legacy = {
      ...expert,
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.calls.create',
        'customer_affairs.call_center.notes.create',
        'customer_affairs.call_center.workflow.manage',
      ],
    } as AuthenticatedActor;
    const contactIds: string[] = [];
    const query = {
      page: 1,
      pageSize: 50,
      scope: 'LATEST',
    } as CallCenterSearchDto;
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw Error('Disposable nora_ci only');
      db = createDatabaseClient(url.toString());
      const database = { client: db } as never;
      await db.branch.createMany({
        data: [branchId, otherBranch].map((id) => ({
          id,
          code: id,
          name: 'Synthetic access branch',
        })),
      });
      await db.hrRecord.createMany({
        data: [unitId, otherUnit].map((id) => ({
          id,
          code: id,
          branchId,
          section: 'organization',
          tab: 'units',
          values: ['Synthetic team'],
          status: 'فعال',
        })),
      });
      for (const id of [expertId, peerId, managerId, outsiderId]) {
        await db.user.create({
          data: {
            id,
            username: id,
            displayName: 'Synthetic operator',
            passwordHash: 'not-a-login',
            status: 'ACTIVE',
            branches: { create: { branchId } },
            profile: {
              create: {
                organizationUnitId: id === outsiderId ? otherUnit : unitId,
              },
            },
          },
        });
        const codes =
          id === managerId
            ? CALL_CENTER_SALES_MANAGER
            : CALL_CENTER_SALES_EXPERT;
        const role = await db.role.create({
          data: {
            code: id,
            name: 'Synthetic arbitrary display title',
            permissions: {
              create: await Promise.all(
                codes.map(async (code) => ({
                  permission: {
                    connect: {
                      id: (
                        await db.permission.upsert({
                          where: { code },
                          update: {},
                          create: {
                            code,
                            module: 'customer_affairs',
                            name: code,
                          },
                        })
                      ).id,
                    },
                  },
                })),
              ),
            },
            users: { create: { userId: id } },
          },
        });
        expect(role.isActive).toBe(true);
      }
      const directory = new IamWorkbenchRequestDirectory(
        database,
        new HrWorkbenchRequestUnits(database),
      );
      access = new CallCenterAccessService(database, directory);
      owners = new CallCenterOwnerService(
        database,
        access,
        new IamCallCenterDirectory(database),
        directory,
      );
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
      calls = new CallCenterService(database, crypto, access);
      telephony = new CallCenterTelephonyService(
        database,
        crypto,
        calls,
        new IamCallCenterDirectory(database),
      );
      workflow = new CallCenterWorkflowService(
        database,
        crypto,
        new IamCallCenterDirectory(database),
        new CallCenterTasksService(database),
        new NotificationsService({} as never),
        access,
      );
      read = new CallCenterReadService(
        database,
        workflow,
        calls,
        crypto,
        directory,
      );
      for (const [index, userId] of [expertId, peerId, outsiderId].entries()) {
        const actor = { ...expert, userId };
        const result = await calls.create(
          {
            id: randomUUID(),
            phone: `0912111111${index}`,
            name: 'Synthetic scoped caller',
            subject: 'Synthetic call',
            source: 'گوگل',
            operator: 'Synthetic',
            note: '',
            direction: 'INBOUND',
            status: 'جدید',
            occurredAt: new Date().toISOString(),
          },
          actor,
          branchId,
        );
        contactIds.push(result.data.contactId);
      }
      const module = await Test.createTestingModule({
        controllers: [CallCenterOwnerController],
        providers: [
          PermissionGuard,
          { provide: CallCenterOwnerService, useValue: owners },
          {
            provide: IamService,
            useValue: {
              assertPermissions(actor: AuthenticatedActor, required: string[]) {
                if (
                  !required.every((p) =>
                    (actor.permissions as readonly string[]).includes(p),
                  )
                )
                  throw new ForbiddenException();
              },
            },
          },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest();
            if (!req.headers['x-test-actor']) throw new UnauthorizedException();
            req.actor =
              req.headers['x-test-actor'] === 'manager' ? manager : expert;
            return true;
          },
        })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();
    }, 180_000);
    afterAll(async () => {
      await app?.close();
      await db?.$disconnect();
    });

    it('enforces real ownership writes through the authenticated HTTP/validation boundary', async () => {
      const row = await db.callCenterContact.create({
        data: {
          branchId,
          phoneFingerprint: randomUUID().replaceAll('-', '').repeat(2),
          latestOccurredAt: new Date(),
        },
      });
      const path = `/customer-affairs/call-center/contacts/${row.id}/owner`;
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .patch(path)
        .set('x-test-actor', 'expert')
        .set('x-branch-id', branchId)
        .send({ ownerUserId: expertId, expectedVersion: 0 })
        .expect(403);
      await request(app.getHttpServer())
        .patch(path)
        .set('x-test-actor', 'manager')
        .set('x-branch-id', branchId)
        .send({ ownerUserId: outsiderId, expectedVersion: 0 })
        .expect(403);
      await request(app.getHttpServer())
        .patch(path)
        .set('x-test-actor', 'manager')
        .set('x-branch-id', branchId)
        .send({
          ownerUserId: expertId,
          expectedVersion: 0,
          actorUserId: managerId,
        })
        .expect(400);
      await request(app.getHttpServer())
        .patch(path)
        .set('x-test-actor', 'manager')
        .set('x-branch-id', otherBranch)
        .send({ ownerUserId: expertId, expectedVersion: 0 })
        .expect(403);
      await request(app.getHttpServer())
        .patch(path)
        .set('x-test-actor', 'manager')
        .set('x-branch-id', branchId)
        .send({ ownerUserId: expertId, expectedVersion: 0 })
        .expect(200);
      await request(app.getHttpServer())
        .get(path + '-history')
        .set('x-test-actor', 'expert')
        .set('x-branch-id', branchId)
        .expect(403);
      await request(app.getHttpServer())
        .get(path + '-history')
        .set('x-test-actor', 'manager')
        .set('x-branch-id', branchId)
        .expect('Cache-Control', 'private, no-store')
        .expect(200);
      await db.customerAffairsAuditEvent.deleteMany({
        where: { entityType: 'CALL_CENTER_CONTACT', entityId: row.id },
      });
      await db.callCenterContact.delete({ where: { id: row.id } });
    });

    it('reads own contacts, not same-branch peers', async () => {
      const result = await calls.list(expert, branchId, {
        page: 1,
        pageSize: 50,
      });
      expect(result.data.map((r) => r.id)).toEqual([contactIds[0]]);
      await expect(
        access.contact(expert, branchId, contactIds[1]!),
      ).rejects.toThrow();
    });
    it('manager sees own current HR team but not another team in the same branch', async () => {
      const result = await calls.list(manager, branchId, {
        page: 1,
        pageSize: 50,
      });
      expect(result.data.map((r) => r.id).sort()).toEqual(
        contactIds.slice(0, 2).sort(),
      );
      await expect(
        access.contact(manager, branchId, contactIds[2]!),
      ).rejects.toThrow();
    });
    it('keeps inactive colleagues within unit-owned history without permitting them as assignment recipients', async () => {
      await db.user.update({
        where: { id: peerId },
        data: { status: 'INACTIVE' },
      });
      try {
        expect(
          (await access.contact(manager, branchId, contactIds[1]!)).id,
        ).toBe(contactIds[1]);
        await expect(
          owners.save(manager, branchId, contactIds[0]!, {
            ownerUserId: peerId,
            expectedVersion: 1,
          }),
        ).rejects.toThrow();
      } finally {
        await db.user.update({
          where: { id: peerId },
          data: { status: 'ACTIVE' },
        });
      }
    });

    it('checks server branch scope even for a manager', async () => {
      await expect(
        calls.list(manager, otherBranch, { page: 1, pageSize: 50 }),
      ).rejects.toThrow();
    });
    it('search/history/note endpoints cannot bypass ownership', async () => {
      expect(
        (await read.search(expert, branchId, query)).data.map((r) => r.id),
      ).toEqual([contactIds[0]]);
      await expect(
        read.history(expert, branchId, contactIds[1]!, 'calls', {
          pageSize: 20,
        }),
      ).rejects.toThrow();
      await expect(
        calls.note(
          contactIds[1]!,
          { id: randomUUID(), text: 'forbidden' },
          expert,
          branchId,
        ),
      ).rejects.toThrow();
      expect(
        (
          await calls.note(
            contactIds[0]!,
            { id: randomUUID(), text: 'allowed' },
            expert,
            branchId,
          )
        ).data.text,
      ).toBe('allowed');
    });
    it('scopes real SQL KPI/report counts independently from forged team/agent filters', async () => {
      expect((await read.kpis(expert, branchId)).data.today).toBe(1);
      expect((await read.kpis(manager, branchId)).data.today).toBe(2);
      expect(
        (await read.report(expert, branchId, { ...query, agentId: outsiderId }))
          .data.calls,
      ).toBe(0);
    });
    it('does not let removing all granular ticks regain legacy read', async () => {
      const actor = {
        ...expert,
        permissions: [
          'customer_affairs.call_center.scope.v1',
          'customer_affairs.call_center.read',
        ],
      } as AuthenticatedActor;
      await expect(
        calls.list(actor, branchId, { page: 1, pageSize: 50 }),
      ).rejects.toThrow();
    });

    it('uses a real persisted offer for this call only, never foreign contact history or expert routing authority', async () => {
      const connection = await db.integrationTelephonyConnection.create({
        data: {
          branchId,
          createdByUserId: managerId,
          name: 'Synthetic trusted-port fixture',
          active: true,
          synthetic: false,
        },
      });
      const root = randomUUID();
      const id = await db.$transaction((tx) =>
        telephony.project(
          tx,
          {
            schemaVersion: 1,
            connectionId: connection.id,
            externalEventId: randomUUID(),
            externalCallId: root,
            rootCallId: root,
            legId: 'one',
            kind: 'RINGING',
            direction: 'IN',
            caller: { kind: 'KNOWN', value: '09121111111' },
            destination: { kind: 'UNKNOWN', value: null },
            companyLine: null,
            extension: '101',
            queue: null,
            occurredAt: new Date().toISOString(),
            sequence: 1,
            terminalForCall: false,
            endReason: null,
            recordingReference: null,
          },
          {
            branchId,
            creatorId: managerId,
            synthetic: false,
            receivedAt: new Date(),
            recipient: { userId: expertId, version: 1, teamId: unitId },
          },
        ),
      );
      let offered = (await telephony.snapshot(expert)).data.find(
        (row) => row.id === id,
      )!;
      expect(offered.call.contactId).toBe(contactIds[1]);
      expect(
        (await telephony.snapshot({ ...expert, userId: outsiderId })).data,
      ).toHaveLength(0);
      await expect(telephony.history(expert, id)).rejects.toThrow();
      await expect(
        read.history(expert, branchId, contactIds[1]!, 'calls', {
          pageSize: 20,
        }),
      ).rejects.toThrow();
      const tabId = randomUUID();
      await telephony.lease(expert, tabId);
      await telephony.action(expert, id, {
        action: 'CLAIM',
        version: offered.version,
        tabId,
      });
      offered = (await telephony.snapshot(expert)).data.find(
        (row) => row.id === id,
      )!;
      await expect(
        telephony.action(expert, id, {
          action: 'TRANSFER',
          version: offered.version,
          tabId,
          targetUserId: peerId,
        }),
      ).rejects.toThrow();
      await telephony.action(expert, id, {
        action: 'SAVE',
        version: offered.version,
        tabId,
        subject: 'Completed offered call',
      });
      const partial = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: { id },
      });
      expect(partial.completed).toBe(false);
      await expect(
        access.contact(expert, branchId, contactIds[1]!),
      ).rejects.toThrow();
      await telephony.action(expert, id, {
        action: 'SAVE',
        version: partial.version,
        tabId,
        name: 'Synthetic offered caller',
        subject: 'Completed offered call',
        source: 'Synthetic source',
        operator: 'Synthetic unit',
        outcome: 'ANSWERED',
      });
      expect(
        (
          await db.callCenterTelephonySession.findUniqueOrThrow({
            where: { id },
          })
        ).completed,
      ).toBe(true);
      await expect(
        access.contact(expert, branchId, contactIds[1]!),
      ).rejects.toThrow();
    });

    it('installs the additive owner FK, owner CAS and scoped/FK indexes', async () => {
      const indexes = await db.$queryRaw<
        Array<{ indexname: string }>
      >`SELECT indexname FROM pg_indexes WHERE tablename='customer_affairs_call_contacts'`;
      expect(indexes.map((row) => row.indexname)).toContain(
        'call_contact_owner_idx',
      );
      expect(indexes.map((row) => row.indexname)).toContain(
        'call_contact_owner_user_idx',
      );
      await expect(
        db.callCenterContact.update({
          where: { id: contactIds[0]! },
          data: { ownerUserId: randomUUID() },
        }),
      ).rejects.toThrow();
      await expect(
        db.callCenterContact.update({
          where: { id: contactIds[0]! },
          data: { ownerVersion: -1 },
        }),
      ).rejects.toThrow();
    });

    it('persists and replays own requests/follow-ups, checks revisions and rejects forged recipients', async () => {
      const input = {
        id: randomUUID(),
        commandId: randomUUID(),
        expectedVersion: 0,
        title: 'Synthetic own request',
        status: 'NEW',
        priority: 'NORMAL',
        reason: 'Synthetic request reason',
        ownerId: expertId,
      };
      const first = await workflow.saveRequest(
        expert,
        branchId,
        contactIds[0]!,
        input,
      );
      expect(first.data[0]!.title).toBe(input.title);
      await workflow.saveRequest(expert, branchId, contactIds[0]!, input);
      expect(
        await db.customerAffairsTicket.count({ where: { id: input.id } }),
      ).toBe(1);
      await expect(
        workflow.saveRequest(expert, branchId, contactIds[0]!, {
          ...input,
          commandId: randomUUID(),
          title: 'Stale edit',
        }),
      ).rejects.toThrow();
      await expect(
        workflow.saveRequest(expert, branchId, contactIds[0]!, {
          ...input,
          commandId: randomUUID(),
          expectedVersion: 1,
          ownerId: outsiderId,
        }),
      ).rejects.toThrow();
      const follow = {
        id: randomUUID(),
        commandId: randomUUID(),
        expectedVersion: 0,
        ownerId: expertId,
        dueAt: new Date(Date.now() + 3600000).toISOString(),
        action: 'Synthetic next action',
        priority: 'NORMAL',
        status: 'OPEN',
        result: '',
      };
      expect(
        (await workflow.followUp(expert, branchId, input.id, follow)).data[0]!
          .followUps[0]!.status,
      ).toBe('OPEN');
      await workflow.followUp(expert, branchId, input.id, {
        ...follow,
        commandId: randomUUID(),
        expectedVersion: 1,
        status: 'COMPLETED',
        result: 'Synthetic complete',
      });
      await expect(
        workflow.saveRequest(expert, branchId, contactIds[0]!, {
          ...input,
          commandId: randomUUID(),
          expectedVersion: 1,
          status: 'CLOSED',
          reason: 'Completed',
        }),
      ).rejects.toThrow('فقط برای مدیر واحد');
      expect(
        (
          await workflow.saveRequest(manager, branchId, contactIds[0]!, {
            ...input,
            commandId: randomUUID(),
            expectedVersion: 1,
            status: 'CLOSED',
            reason: 'Completed',
          })
        ).data[0]!.status,
      ).toBe('CLOSED');
      expect(
        (
          await workflow.queue(
            { ...expert, userId: outsiderId },
            branchId,
            'ALL',
            1,
          )
        ).data.some((r) => r.id === input.id),
      ).toBe(false);
    });

    it('rechecks native outbound authority independently from the role name', async () => {
      const directory = new IamCallCenterDirectory({ client: db } as never);
      expect(await directory.canOriginate(branchId, expertId)).toBe(true);
      const role = await db.role.findUniqueOrThrow({
        where: { code: expertId },
      });
      const permission = await db.permission.findUniqueOrThrow({
        where: { code: 'customer_affairs.call_center.outbound.own' },
      });
      await db.rolePermission.delete({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
      });
      expect(await directory.canOriginate(branchId, expertId)).toBe(false);
      await db.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
      expect(await directory.canOriginate(otherBranch, expertId)).toBe(false);
    });
    it('does not infer authority from a display title and retains old native access', async () => {
      const actor = { ...expert, permissions: [] } as AuthenticatedActor;
      await expect(
        calls.list(actor, branchId, { page: 1, pageSize: 50 }),
      ).rejects.toThrow();
      expect(
        (await calls.list(legacy, branchId, { page: 1, pageSize: 50 })).data
          .length,
      ).toBeGreaterThanOrEqual(3);
    });
    it('refuses own workflow operations on a peer contact and recipients outside the unit', async () => {
      await expect(
        workflow.list(expert, branchId, contactIds[1]!),
      ).rejects.toThrow();
      await db.$transaction(async (tx) => {
        await expect(
          access.recipient(manager, branchId, outsiderId, tx),
        ).rejects.toThrow();
      });
    });
    it('serializes owner changes, records history and prevents expert/foreign-team reassignment', async () => {
      await expect(
        owners.save(expert, branchId, contactIds[0]!, {
          ownerUserId: peerId,
          expectedVersion: 0,
        }),
      ).rejects.toThrow();
      await expect(
        owners.save(manager, branchId, contactIds[2]!, {
          ownerUserId: peerId,
          expectedVersion: 0,
        }),
      ).rejects.toThrow();
      const results = await Promise.allSettled(
        [expertId, peerId].map((ownerUserId) =>
          owners.save(manager, branchId, contactIds[0]!, {
            ownerUserId: ownerUserId === expertId ? managerId : ownerUserId,
            expectedVersion: 1,
          }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        (await owners.history(manager, branchId, contactIds[0]!)).data,
      ).toHaveLength(2);
    });
    it('assigns an unowned contact only to an active member of the same team', async () => {
      const contact = await db.callCenterContact.create({
        data: {
          branchId,
          phoneFingerprint: 'f'.repeat(64),
          latestOccurredAt: new Date(),
        },
      });
      await expect(
        owners.save(manager, branchId, contact.id, {
          ownerUserId: outsiderId,
          expectedVersion: 0,
        }),
      ).rejects.toThrow();
      expect(
        (
          await owners.save(manager, branchId, contact.id, {
            ownerUserId: expertId,
            expectedVersion: 0,
          })
        ).data.version,
      ).toBe(1);
      await expect(
        owners.save(
          {
            ...manager,
            permissions: manager.permissions.filter(
              (p) => p !== 'customer_affairs.call_center.owner.change',
            ),
          },
          branchId,
          contact.id,
          { ownerUserId: peerId, expectedVersion: 1 },
        ),
      ).rejects.toThrow();
    });
    it('resolves changed or absent units on the server, not from actor-supplied fields', async () => {
      await db.iamUserProfile.update({
        where: { userId: managerId },
        data: { organizationUnitId: null },
      });
      expect(await access.users(manager, branchId, 'contacts')).toEqual([
        managerId,
      ]);
      await db.iamUserProfile.update({
        where: { userId: managerId },
        data: { organizationUnitId: otherUnit },
      });
      expect(await access.users(manager, branchId, 'contacts')).toContain(
        outsiderId,
      );
      expect(await access.users(manager, branchId, 'contacts')).not.toContain(
        peerId,
      );
    });
  },
);
