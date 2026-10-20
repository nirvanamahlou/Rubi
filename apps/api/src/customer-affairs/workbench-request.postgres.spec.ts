import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CustomerAffairsController } from './customer-affairs.controller';
import { CustomerAffairsService } from './customer-affairs.service';
import { CustomerAffairsRepository } from './customer-affairs.repository';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';

const enabled = process.env.NORA_RUN_WORKBENCH_REQUEST_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)(
  'isolated PostgreSQL + HTTP Workbench sender/recipient workflow',
  () => {
    let client: DatabaseClient;
    let app: INestApplication;
    const branchId = randomUUID(),
      otherBranchId = randomUUID();
    const salesUnit = randomUUID(),
      reservationUnit = randomUUID();
    const senderId = randomUUID(),
      recipientId = randomUUID(),
      peerId = randomUUID(),
      outsiderId = randomUUID();
    const actors = new Map<string, AuthenticatedActor>();
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        !['/nora_workbench_test_1018', '/nora_ci'].includes(url.pathname)
      )
        throw new Error(
          'Only a named local disposable Workbench/CI database is allowed.',
        );
      client = createDatabaseClient(url.toString());
      await client.branch.createMany({
        data: [
          {
            id: branchId,
            code: `wb-${branchId}`,
            name: 'Synthetic Workbench branch',
          },
          {
            id: otherBranchId,
            code: `wb-${otherBranchId}`,
            name: 'Synthetic other branch',
          },
        ],
      });
      for (const [id, name] of [
        [salesUnit, 'فروش'],
        [reservationUnit, 'رزرواسیون'],
      ]) {
        await client.hrRecord.create({
          data: {
            id: id!,
            code: `wb-${id}`,
            branchId,
            section: 'organization',
            tab: 'units',
            values: [name!],
            status: 'فعال',
          },
        });
      }
      for (const [id, unitId, accountBranch] of [
        [senderId, salesUnit, branchId],
        [recipientId, reservationUnit, branchId],
        [peerId, reservationUnit, branchId],
        [outsiderId, null, otherBranchId],
      ] as const) {
        await client.user.create({
          data: {
            id,
            username: `wb-${id}`,
            displayName: `Synthetic ${id}`,
            passwordHash: 'synthetic-not-a-usable-login-hash',
            status: 'ACTIVE',
            branches: { create: { branchId: accountBranch } },
            ...(unitId
              ? { profile: { create: { organizationUnitId: unitId } } }
              : {}),
          },
        });
        actors.set(id, {
          userId: id,
          branchIds: [accountBranch],
          permissions: [],
        } as unknown as AuthenticatedActor);
      }
      const database = { client };
      const repository = new CustomerAffairsRepository(database as never);
      const units = new HrWorkbenchRequestUnits(database as never);
      const directory = new IamWorkbenchRequestDirectory(
        database as never,
        units,
      );
      const notifications = new NotificationsService(
        new NotificationsRepository(database as never),
      );
      const service = new CustomerAffairsService(
        repository,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        notifications,
        {} as never,
        undefined,
        directory,
      );
      const module = await Test.createTestingModule({
        controllers: [CustomerAffairsController],
        providers: [{ provide: CustomerAffairsService, useValue: service }],
      })
        .overrideGuard(AuthGuard)
        .useValue({
          canActivate(context: ExecutionContext) {
            const req = context.switchToHttp().getRequest();
            const actor = actors.get(req.headers['x-test-actor']);
            if (!actor) throw new UnauthorizedException();
            req.actor = actor;
            return true;
          },
        })
        .overrideGuard(PermissionGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
    }, 30000);
    afterAll(async () => {
      await app?.close();
      await client?.$disconnect();
    });

    it('delivers exactly once to the selected real unit member; persists file-free request, scoped inbox and Workbench notifications', async () => {
      const http = app.getHttpServer();
      await request(http)
        .get('/customer-affairs/workbench/requests')
        .expect(401);
      const options = await request(http)
        .get('/customer-affairs/workbench/request-options')
        .set('x-test-actor', senderId)
        .set('x-branch-id', branchId)
        .expect(200);
      const unit = options.body.data.units.find(
        (item: { id: string }) => item.id === reservationUnit,
      );
      expect(unit.users.map((item: { id: string }) => item.id).sort()).toEqual(
        [peerId, recipientId].sort(),
      );
      expect(
        unit.users.some((item: { id: string }) => item.id === senderId),
      ).toBe(false);
      const input = {
        subject: 'Synthetic reservation request',
        description: 'Please check this synthetic reservation.',
        priority: 'HIGH',
        organizationUnitId: reservationUnit,
        executionOwnerUserId: recipientId,
      };
      const post = () =>
        request(http)
          .post('/customer-affairs/workbench/requests')
          .set('x-test-actor', senderId)
          .set('x-branch-id', branchId)
          .set('idempotency-key', `test-${senderId}`)
          .send(input);
      const created = await post().expect(201);
      const id = created.body.data.id;
      expect((await post().expect(201)).body.data.id).toBe(id);
      expect(
        await client.customerAffairsTicket.count({
          where: { id, executionOwnerUserId: recipientId },
        }),
      ).toBe(1);
      for (const [userId, count, direction] of [
        [senderId, 1, 'outgoing'],
        [recipientId, 1, 'incoming'],
        [peerId, 0, ''],
        [outsiderId, 0, ''],
      ] as const) {
        const inbox = await request(http)
          .get('/customer-affairs/workbench/requests')
          .set('x-test-actor', userId)
          .expect(200);
        expect(inbox.body.data).toHaveLength(count);
        if (count)
          expect(inbox.body.data[0]).toMatchObject({
            id,
            direction,
            destinationUnit: 'رزرواسیون',
            description: input.description,
          });
      }
      const notices = await client.notification.findMany({
        where: { entityId: id },
        select: { recipientUserId: true, href: true },
      });
      expect(notices.map((notice) => notice.recipientUserId).sort()).toEqual(
        [senderId, recipientId].sort(),
      );
      expect(
        notices.every(
          (notice) => notice.href === `/workbench?tab=requests&request=${id}`,
        ),
      ).toBe(true);
      await request(http)
        .post('/customer-affairs/workbench/requests')
        .set('x-test-actor', senderId)
        .set('x-branch-id', branchId)
        .set('idempotency-key', randomUUID())
        .send({ ...input, executionOwnerUserId: senderId })
        .expect(400);
      await request(http)
        .post('/customer-affairs/workbench/requests')
        .set('x-test-actor', outsiderId)
        .set('x-branch-id', branchId)
        .set('idempotency-key', randomUUID())
        .send(input)
        .expect(403);
      await request(http)
        .get('/customer-affairs/workbench/request-options')
        .set('x-test-actor', outsiderId)
        .set('x-branch-id', branchId)
        .expect(403);
      await client.iamUserProfile.update({
        where: { userId: recipientId },
        data: { organizationUnitId: salesUnit },
      });
      await request(http)
        .post('/customer-affairs/workbench/requests')
        .set('x-test-actor', senderId)
        .set('x-branch-id', branchId)
        .set('idempotency-key', randomUUID())
        .send(input)
        .expect(400);
      await client.iamUserProfile.update({
        where: { userId: recipientId },
        data: { organizationUnitId: reservationUnit },
      });
      await client.hrRecord.update({
        where: { id: reservationUnit },
        data: { status: 'غیرفعال' },
      });
      await request(http)
        .post('/customer-affairs/workbench/requests')
        .set('x-test-actor', senderId)
        .set('x-branch-id', branchId)
        .set('idempotency-key', randomUUID())
        .send(input)
        .expect(400);
      await client.hrRecord.update({
        where: { id: reservationUnit },
        data: { status: 'فعال' },
      });
      await client.user.update({
        where: { id: recipientId },
        data: { status: 'INACTIVE' },
      });
      await request(http)
        .post('/customer-affairs/workbench/requests')
        .set('x-test-actor', senderId)
        .set('x-branch-id', branchId)
        .set('idempotency-key', randomUUID())
        .send(input)
        .expect(400);
      expect(
        await client.customerAffairsTicket.count({ where: { branchId } }),
      ).toBe(1);
    }, 30000);
  },
);
