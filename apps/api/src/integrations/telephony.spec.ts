import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor, TelephonyEventV1 } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CallCenterCrypto } from '../customer-affairs/call-center.crypto';
import { CallCenterService } from '../customer-affairs/call-center.service';
import { CallCenterTelephonyService } from '../customer-affairs/call-center-telephony.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { TelephonyIntegrationService } from './telephony.service';
import { validateTelephonyEvent } from './telephony.validation';
export function event(
  connectionId: string = randomUUID(),
  root: string = randomUUID(),
): TelephonyEventV1 {
  return {
    schemaVersion: 1,
    connectionId,
    externalEventId: randomUUID(),
    externalCallId: root,
    rootCallId: root,
    legId: 'one',
    kind: 'RINGING',
    direction: 'IN',
    caller: { kind: 'KNOWN', value: '+12025550123' },
    destination: { kind: 'UNKNOWN', value: null },
    companyLine: null,
    extension: '101',
    queue: null,
    occurredAt: new Date().toISOString(),
    sequence: 1,
    terminalForCall: false,
    endReason: null,
    recordingReference: null,
  };
}
describe('internal telephony validation', () => {
  it('accepts optional bounded caller names without requiring them on old events', () => {
    const policy = { maxAgeSeconds: 3600, maxFutureSeconds: 120 };
    const input = { ...event(), callerName: 'شرکت نمونه' };
    expect(validateTelephonyEvent(input, policy)).toEqual(input);
    for (const callerName of [
      '',
      'x'.repeat(161),
      'bad\nname',
      'bad\u202ename',
      123,
    ])
      expect(() =>
        validateTelephonyEvent({ ...event(), callerName }, policy),
      ).toThrow();
  });
  it('rejects missing explicit nulls, raw provider fields, excessive payloads and clock skew', () => {
    const e = event(),
      policy = { maxAgeSeconds: 3600, maxFutureSeconds: 120 };
    expect(validateTelephonyEvent(e, policy)).toEqual(e);
    for (const invalid of [
      { ...e, queue: undefined },
      { ...e, raw: 'private' },
      { ...e, externalCallId: 'x'.repeat(17000) },
      { ...e, occurredAt: '2000-01-01T00:00:00Z' },
      { ...e, occurredAt: new Date(Date.now() + 600000).toISOString() },
      { ...e, caller: { kind: 'WITHHELD', value: '123' } },
    ])
      expect(() => validateTelephonyEvent(invalid, policy)).toThrow();
  });
  it('rejects recording/end facts attached to an unrelated event', () => {
    expect(() =>
      validateTelephonyEvent(
        { ...event(), terminalForCall: true },
        { maxAgeSeconds: 3600, maxFutureSeconds: 120 },
      ),
    ).toThrow();
  });
});
describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'telephony real durable pipeline',
  () => {
    let db: DatabaseClient,
      service: TelephonyIntegrationService,
      domain: CallCenterTelephonyService,
      connectionId: string;
    const branchId = randomUUID(),
      userId = randomUUID(),
      otherId = randomUUID();
    const actor = {
      userId,
      branchIds: [branchId],
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.calls.create',
        'customer_affairs.call_center.workflow.manage',
      ],
    } as AuthenticatedActor;
    const config = new ConfigService({
      NODE_ENV: 'test',
      TELEPHONY_SYNTHETIC_ENABLED: 'true',
      CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
        'base64',
      ),
      CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
    });
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        !['/nora_call_center_package_one_test_1019', '/nora_ci'].includes(
          url.pathname,
        )
      )
        throw Error('Disposable database required');
      db = createDatabaseClient(url.toString());
      await db.branch.create({
        data: { id: branchId, code: branchId, name: 'Synthetic telephony' },
      });
      const role = await db.role.create({
        data: {
          code: randomUUID(),
          name: 'Synthetic phone role',
          isActive: true,
          isSystem: false,
        },
      });
      for (const code of actor.permissions) {
        const p = await db.permission.upsert({
          where: { code },
          update: {},
          create: { code, module: 'customer_affairs', name: code },
        });
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
      }
      for (const id of [userId, otherId]) {
        await db.user.create({
          data: {
            id,
            username: id,
            displayName: 'Synthetic phone operator',
            passwordHash: 'not-a-login',
            status: 'ACTIVE',
          },
        });
        await db.userBranch.create({ data: { userId: id, branchId } });
        await db.userRole.create({ data: { userId: id, roleId: role.id } });
      }
      const database = { client: db } as never,
        crypto = new CallCenterCrypto(config),
        directory = new IamCallCenterDirectory(database);
      domain = new CallCenterTelephonyService(
        database,
        crypto,
        new CallCenterService(database, crypto),
        directory,
      );
      service = new TelephonyIntegrationService(
        database,
        config,
        domain,
        { canManage: () => true } as never,
        directory,
        { options: async () => ({ units: [] }) } as never,
      );
      const connection = await db.integrationTelephonyConnection.create({
        data: {
          branchId,
          createdByUserId: userId,
          name: 'Synthetic connection',
          active: true,
          synthetic: true,
        },
      });
      connectionId = connection.id;
      await db.integrationTelephonyMapping.create({
        data: { connectionId, extension: '101', userId },
      });
    }, 30000);
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function send(e: TelephonyEventV1) {
      const row = await service.receive(e);
      await service.process(row.id);
      return row;
    }
    it('persists before dispatch; duplicates and concurrent processing create one call', async () => {
      const e = event(connectionId),
        received = await service.receive(e);
      expect(
        await db.integrationTelephonyOutbox.count({
          where: { inboxId: received.id },
        }),
      ).toBe(1);
      expect((await service.receive(e)).duplicate).toBe(true);
      expect(
        await db.callCenterTelephonySession.count({ where: { connectionId } }),
      ).toBe(0);
      await Promise.all([
        service.process(received.id),
        service.process(received.id),
      ]);
      expect(
        await db.callCenterTelephonySession.count({ where: { connectionId } }),
      ).toBe(1);
      expect((await domain.snapshot(actor)).data).toHaveLength(1);
      expect(
        (await domain.snapshot({ ...actor, userId: otherId })).data,
      ).toHaveLength(0);
      expect(
        (await domain.snapshot({ ...actor, branchIds: [] })).data,
      ).toHaveLength(0);
      await expect(
        service.receive({ ...e, kind: 'ANSWERED' }),
      ).rejects.toThrow();
      const stored = await db.integrationTelephonyInbox.findUniqueOrThrow({
        where: { id: received.id },
      });
      expect(stored.encryptedPayload).not.toContain('12025550123');
    });
    it('preserves terminal state through out-of-order rings and late recording; one business call for multiple legs', async () => {
      const e = event(connectionId);
      await send({
        ...e,
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'NO_ANSWER',
        sequence: 8,
      });
      await send({
        ...e,
        externalEventId: randomUUID(),
        legId: 'second',
        sequence: 2,
      });
      await send({
        ...e,
        externalEventId: randomUUID(),
        kind: 'RECORDING_READY',
        recordingReference: 'synthetic-reference',
        sequence: 9,
      });
      const snapshot = await domain.snapshot(actor);
      const call = snapshot.data.find((r) => r.technical.recordingCount === 1)!;
      expect(call.state).toBe('ENDED');
      expect(call.technical.recordingCount).toBe(1);
      expect(
        await db.callCenterCall.count({ where: { id: call.callId } }),
      ).toBe(1);
    });
    it('snapshots mapping at receipt; later changes do not reassign pending history', async () => {
      const e = event(connectionId);
      const row = await service.receive(e);
      await db.integrationTelephonyMapping.update({
        where: { connectionId_extension: { connectionId, extension: '101' } },
        data: { userId: otherId, version: { increment: 1 } },
      });
      await service.process(row.id);
      const session = await db.callCenterTelephonySession.findFirstOrThrow({
        where: {
          rootFingerprint: domain.crypto.fingerprint(
            `telephony:root:${connectionId}:${e.rootCallId}`,
          ),
        },
      });
      expect(
        await db.callCenterTelephonyOffer.findUnique({
          where: { sessionId_userId: { sessionId: session.id, userId } },
        }),
      ).not.toBeNull();
      expect(
        await db.callCenterTelephonyOffer.findUnique({
          where: {
            sessionId_userId: { sessionId: session.id, userId: otherId },
          },
        }),
      ).toBeNull();
      await db.integrationTelephonyMapping.update({
        where: { connectionId_extension: { connectionId, extension: '101' } },
        data: { userId, version: { increment: 1 } },
      });
    });
    it('unknown extension is retained for authorized review without broadcast', async () => {
      await send({ ...event(connectionId), extension: 'unmapped' });
      const review = await domain.review([branchId]);
      expect(review.length).toBe(1);
      await service.routeReview(
        actor,
        review[0]!.id,
        userId,
        review[0]!.version,
      );
      expect((await domain.review([branchId])).length).toBe(0);
    });
    it('enforces server tab lease, claim version, deferred recovery and business completion after end', async () => {
      const e = event(connectionId);
      await send(e);
      const tabId = randomUUID(),
        tab2 = randomUUID();
      expect((await domain.lease(actor, tabId)).leader).toBe(true);
      expect((await domain.lease(actor, tab2)).leader).toBe(false);
      let row = (await domain.snapshot(actor)).data.find(
        (r) => r.technical.occurredAt === e.occurredAt,
      )!;
      await expect(
        domain.action(actor, row.id, {
          tabId: tab2,
          action: 'CLAIM',
          version: row.version,
        }),
      ).rejects.toThrow();
      await domain.action(actor, row.id, {
        tabId,
        action: 'CLAIM',
        version: row.version,
      });
      await expect(
        domain.action(actor, row.id, {
          tabId,
          action: 'CLAIM',
          version: row.version,
        }),
      ).rejects.toThrow();
      await send({
        ...e,
        externalEventId: randomUUID(),
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'COMPLETED',
        sequence: 9,
      });
      row = (await domain.snapshot(actor)).data.find((r) => r.id === row.id)!;
      await domain.action(actor, row.id, {
        tabId,
        action: 'DEFER',
        version: row.version,
      });
      expect(
        (await domain.snapshot(actor)).data.find((r) => r.id === row.id)
          ?.deferred,
      ).toBe(true);
      await domain.action(actor, row.id, {
        tabId,
        action: 'SAVE',
        version: row.version,
        subject: 'Synthetic completed call',
        name: '',
        note: 'Synthetic note',
      });
      expect(
        (await domain.snapshot(actor)).data.some((r) => r.id === row.id),
      ).toBe(true);
      expect(
        await db.callCenterCall.findUnique({ where: { id: row.callId } }),
      ).toMatchObject({ needsCompletion: true });
      expect(
        await db.callCenterTelephonySession.findUnique({
          where: { id: row.id },
        }),
      ).toMatchObject({ completed: false });
      await expect(
        domain.snapshot({ ...actor, permissions: [] }),
      ).rejects.toThrow();
    });
    it('serializes two agents and preserves access history on an explicit transfer', async () => {
      await db.callCenterTelephonyLease.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
      await db.integrationTelephonyMapping.upsert({
        where: { connectionId_extension: { connectionId, extension: '202' } },
        create: { connectionId, extension: '202', userId: otherId },
        update: { userId: otherId },
      });
      const e = event(connectionId);
      await send(e);
      await send({
        ...e,
        externalEventId: randomUUID(),
        legId: 'two',
        extension: '202',
        sequence: 2,
      });
      const session = await db.callCenterTelephonySession.findFirstOrThrow({
        where: {
          rootFingerprint: domain.crypto.fingerprint(
            `telephony:root:${connectionId}:${e.rootCallId}`,
          ),
        },
      });
      const other = { ...actor, userId: otherId },
        tabs = [randomUUID(), randomUUID()];
      await domain.lease(actor, tabs[0]!);
      await domain.lease(other, tabs[1]!);
      const claims = await Promise.allSettled([
        domain.action(actor, session.id, {
          action: 'CLAIM',
          tabId: tabs[0]!,
          version: session.version,
        }),
        domain.action(other, session.id, {
          action: 'CLAIM',
          tabId: tabs[1]!,
          version: session.version,
        }),
      ]);
      expect(claims.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const claimed = await db.callCenterTelephonySession.findUniqueOrThrow({
          where: { id: session.id },
        }),
        winner = claimed.claimUserId === userId ? actor : other,
        loser = claimed.claimUserId === userId ? other : actor;
      await domain.action(winner, session.id, {
        action: 'TRANSFER',
        tabId: tabs[winner.userId === userId ? 0 : 1]!,
        version: claimed.version,
        targetUserId: loser.userId,
      });
      expect(
        (await domain.snapshot(winner)).data.some((r) => r.id === session.id),
      ).toBe(false);
      expect(
        (await domain.snapshot(loser)).data.some((r) => r.id === session.id),
      ).toBe(true);
      expect(
        await db.callCenterTelephonyOffer.count({
          where: { sessionId: session.id },
        }),
      ).toBe(2);
    });
    it('disables synthetic harness in production even when explicitly switched on', async () => {
      config.set('NODE_ENV', 'production');
      expect(service.syntheticEnabled()).toBe(false);
      await expect(
        service.synthetic(actor, branchId, 'RINGING', null, randomUUID()),
      ).rejects.toThrow();
      config.set('NODE_ENV', 'test');
    });
    it('retains recoverable failures and permits audited replay of dead letters', async () => {
      const row = await service.receive(event(connectionId));
      const original = domain.project.bind(domain);
      domain.project = async () => {
        throw new Error('temporary synthetic failure');
      };
      try {
        for (let i = 0; i < 6; i++) {
          await db.integrationTelephonyOutbox.update({
            where: { inboxId: row.id },
            data: { availableAt: new Date(0) },
          });
          await service.process(row.id);
        }
      } finally {
        domain.project = original;
      }
      expect(
        (
          await db.integrationTelephonyInbox.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).status,
      ).toBe('DEAD');
      await service.replay(actor, row.id);
      await service.process(row.id);
      expect(
        (
          await db.integrationTelephonyInbox.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).status,
      ).toBe('DONE');
      expect(
        await db.integrationTelephonyAudit.count({
          where: { entityId: row.id, action: 'REPLAY' },
        }),
      ).toBe(1);
    });
  },
);
