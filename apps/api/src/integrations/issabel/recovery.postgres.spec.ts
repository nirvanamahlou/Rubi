import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { TelephonyEventV1 } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CallCenterCrypto } from '../../customer-affairs/call-center.crypto';
import { CallCenterService } from '../../customer-affairs/call-center.service';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';
import { TelephonyIntegrationService } from '../telephony.service';
import { DatabaseRecoveryJournal } from './recovery-journal';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'CDR recovery PostgreSQL boundary',
  () => {
    let db: DatabaseClient,
      service: TelephonyIntegrationService,
      journal: DatabaseRecoveryJournal;
    const connectionId = randomUUID(),
      branchId = randomUUID(),
      userId = randomUUID();
    const old = new Date(Date.now() - 6 * 86400000).toISOString();
    const makeEvent = (root = randomUUID()): TelephonyEventV1 => ({
      schemaVersion: 1,
      connectionId,
      externalEventId: randomUUID(),
      externalCallId: root,
      rootCallId: root,
      legId: root,
      kind: 'ENDED',
      direction: 'IN',
      caller: { kind: 'WITHHELD', value: null },
      destination: { kind: 'UNKNOWN', value: null },
      companyLine: null,
      extension: '101',
      queue: null,
      occurredAt: old,
      sequence: null,
      terminalForCall: true,
      endReason: 'NO_ANSWER',
      recordingReference: null,
    });
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw Error('Disposable nora_ci required');
      db = createDatabaseClient(url.toString());
      await db.branch.create({
        data: { id: branchId, code: branchId, name: 'Synthetic recovery' },
      });
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic recovery',
          passwordHash: 'not-a-login',
          status: 'ACTIVE',
        },
      });
      await db.integrationTelephonyConnection.create({
        data: {
          id: connectionId,
          branchId,
          createdByUserId: userId,
          name: 'Synthetic recovery source',
          active: true,
          synthetic: false,
        },
      });
      await db.integrationTelephonyMapping.create({
        data: { connectionId, extension: '101', userId },
      });
      const config = new ConfigService({
        ISSABEL_ENABLED: 'true',
        ISSABEL_CONNECTION_ID: connectionId,
        ISSABEL_RECOVERY_ENABLED: 'true',
        ISSABEL_USER_NOTIFICATIONS_ENABLED: 'true',
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
          'base64',
        ),
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
          'base64',
        ),
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
      });
      const database = { client: db } as never;
      const crypto = new CallCenterCrypto(config),
        directory = new IamCallCenterDirectory(database);
      service = new TelephonyIntegrationService(
        database,
        config,
        new CallCenterTelephonyService(
          database,
          crypto,
          new CallCenterService(database, crypto),
          directory,
        ),
        {} as never,
        directory,
        {} as never,
      );
      journal = new DatabaseRecoveryJournal(database, connectionId);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    it('projects old unanswered history once without an offer, even with mapped notifications', async () => {
      const e = makeEvent();
      await expect(service.receive(e, 'ISSABEL')).rejects.toThrow();
      await service.receiveRecovered(e);
      await service.receiveRecovered(e);
      const sessions = await db.callCenterTelephonySession.findMany({
        where: { connectionId },
        include: { call: true },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.call.outcome).toBe('NO_ANSWER');
      expect(sessions[0]!.call.needsCompletion).toBe(true);
      expect(
        await db.callCenterTelephonyOffer.count({
          where: { sessionId: sessions[0]!.id },
        }),
      ).toBe(0);
      expect(
        await db.integrationTelephonyInbox.count({ where: { connectionId } }),
      ).toBe(1);
      // Tombstone retries still deduplicate after encrypted payload retention expires.
      await db.integrationTelephonyInbox.updateMany({
        where: { connectionId },
        data: { encryptedPayload: null },
      });
      await service.receiveRecovered(e);
      expect(
        await db.callCenterTelephonySession.count({ where: { connectionId } }),
      ).toBe(1);
    });
    it('coalesces live and recovered receipts into the same root call', async () => {
      const e = { ...makeEvent(), extension: null };
      const live = {
        ...e,
        occurredAt: new Date().toISOString(),
        endReason: 'UNKNOWN' as const,
      };
      const receipt = await service.receive(live, 'ISSABEL');
      await service.process(receipt.id);
      const before = await db.callCenterTelephonySession.count({
        where: { connectionId },
      });
      await service.receiveRecovered(e);
      expect(
        await db.callCenterTelephonySession.count({ where: { connectionId } }),
      ).toBe(before);
      expect(
        await db.callCenterTelephonyOffer.count({
          where: { session: { connectionId } },
        }),
      ).toBe(0);
    });
    it('durably initializes once and compares checkpoints under concurrent writers', async () => {
      const states = await Promise.all([
        journal.loadOrStart(old),
        journal.loadOrStart(new Date().toISOString()),
      ]);
      expect(states[0]).toEqual(states[1]);
      const next = new Date(
        Date.parse(states[0]!.through) + 3600000,
      ).toISOString();
      const results = await Promise.all([
        journal.advance(states[0]!.through, next),
        journal.advance(states[0]!.through, next),
      ]);
      expect(results.sort()).toEqual([false, true]);
      const reloaded = await new DatabaseRecoveryJournal(
        { client: db } as never,
        connectionId,
      ).loadOrStart(new Date().toISOString());
      expect(reloaded.through).toBe(next);
      expect(reloaded.start).toBe(states[0]!.start);
    });
  },
);
