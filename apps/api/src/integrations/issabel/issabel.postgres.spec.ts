import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CallCenterCrypto } from '../../customer-affairs/call-center.crypto';
import { recoverStoredCaller } from '../../customer-affairs/call-center-recover-caller';
import { CallCenterService } from '../../customer-affairs/call-center.service';
import type { CallCenterCallDto } from '../../customer-affairs/call-center.dto';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';
import { TelephonyIntegrationService } from '../telephony.service';
import { IssabelService } from './issabel.service';
import { IssabelRecordingsService } from './recordings.service';
import { normalizeIssabelEvent } from './events';
import { issabelOptions, type IssabelOptions } from './config';
import type { AmiMessage } from './ami';
import { AmiContinuity } from './continuity';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'Issabel actual PostgreSQL delivery',
  () => {
    let db: DatabaseClient,
      service: IssabelService,
      media: IssabelRecordingsService,
      events: TelephonyIntegrationService,
      domain: CallCenterTelephonyService,
      crypto: CallCenterCrypto;
    const connectionId = randomUUID(),
      branchId = randomUUID(),
      userId = randomUUID();
    const actor = {
      userId,
      branchIds: [branchId],
      permissions: [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.workflow.manage',
        'customer_affairs.call_center.calls.create',
      ],
    } as AuthenticatedActor;
    const config = new ConfigService({
      NODE_ENV: 'test',
      ISSABEL_ENABLED: 'true',
      ISSABEL_CONNECTION_ID: connectionId,
      ISSABEL_AMI_HOST: '127.0.0.1',
      ISSABEL_AMI_PORT: '1',
      ISSABEL_AMI_TLS: 'false',
      ISSABEL_AMI_USERNAME: 'synthetic',
      ISSABEL_AMI_SECRET: 'not-a-real-pbx',
      ISSABEL_ALLOWED_PREFIXES: '09',
      ISSABEL_RECORDING_RETENTION_DAYS: '7',
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
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        !['/nora_ci', '/nora_outbound_first_contact_1025'].includes(
          url.pathname,
        )
      )
        throw Error('Disposable nora_ci database required.');
      db = createDatabaseClient(url.toString());
      await db.branch.create({
        data: { id: branchId, code: branchId, name: 'Synthetic Issabel test' },
      });
      const role = await db.role.create({
        data: {
          code: randomUUID(),
          name: 'Synthetic Issabel operator',
          isSystem: false,
          isActive: true,
        },
      });
      for (const code of actor.permissions) {
        const p = await db.permission.upsert({
          where: { code },
          update: {},
          create: { code, name: code, module: 'customer_affairs' },
        });
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
      }
      await db.user.create({
        data: {
          id: userId,
          username: userId,
          displayName: 'Synthetic Issabel operator',
          passwordHash: 'not-a-login',
          status: 'ACTIVE',
        },
      });
      await db.userBranch.create({ data: { userId, branchId } });
      await db.userRole.create({ data: { userId, roleId: role.id } });
      await db.integrationTelephonyConnection.create({
        data: {
          id: connectionId,
          branchId,
          createdByUserId: userId,
          name: 'Synthetic real-adapter test',
          active: true,
          synthetic: false,
        },
      });
      await db.integrationTelephonyMapping.create({
        data: { connectionId, userId, extension: '101' },
      });
      const database = { client: db } as never;
      crypto = new CallCenterCrypto(config);
      const directory = new IamCallCenterDirectory(database);
      domain = new CallCenterTelephonyService(
        database,
        crypto,
        new CallCenterService(database, crypto),
        directory,
      );
      events = new TelephonyIntegrationService(
        database,
        config,
        domain,
        { canManage: () => true } as never,
        directory,
        { options: async () => ({ units: [] }) } as never,
      );
      service = new IssabelService(
        database,
        config,
        domain,
        directory,
        events,
        { canManage: () => true } as never,
      );
      media = new IssabelRecordingsService(database, config, domain, events);
    }, 30000);
    afterAll(async () => {
      await service?.onModuleDestroy();
      media?.onModuleDestroy();
      await db?.$disconnect();
    });
    const root = String(Date.now());
    const fact = (kind: string, leg = 'one', terminal = '0') =>
      normalizeIssabelEvent(connectionId, {
        event: 'UserEvent',
        userevent: 'NoraCall',
        schemaversion: '1',
        kind,
        direction: 'IN',
        externalcallid: `${root}.${leg}`,
        rootcallid: root,
        occurredat: String(Math.floor(Date.now() / 1000)),
        caller: '+12025550123',
        destination: '02100000000',
        extension: '101',
        terminalforcall: terminal,
        ...(kind === 'ENDED' ? { endreason: 'COMPLETED' } : {}),
      })!;
    it('real-provider path stays closed to synthetic/public receive, deduplicates facts, persists and projects real inbound calls without terminating other legs', async () => {
      const ringing = fact('RINGING');
      await expect(events.receive(ringing)).rejects.toThrow();
      const first = await events.receive(ringing, 'ISSABEL');
      expect((await events.receive(ringing, 'ISSABEL')).duplicate).toBe(true);
      await events.process(first.id);
      for (const input of [
        fact('RINGING', 'two'),
        fact('ANSWERED', 'two'),
        fact('ENDED', 'one'),
      ]) {
        const row = await events.receive(input, 'ISSABEL');
        await events.process(row.id);
      }
      const session = await db.callCenterTelephonySession.findFirstOrThrow({
        where: { connectionId },
      });
      expect(session.state).toBe('ANSWERED');
      expect(session.completed).toBe(false);
      const terminal = await events.receive(
        fact('ENDED', 'root', '1'),
        'ISSABEL',
      );
      await events.process(terminal.id);
      expect(
        (
          await db.callCenterTelephonySession.findUniqueOrThrow({
            where: { id: session.id },
          })
        ).state,
      ).toBe('ENDED');
      expect(
        (
          await db.integrationTelephonyInbox.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).encryptedPayload,
      ).not.toContain('+12025550123');
      const earlier = {
        ...fact('RINGING', 'late-ring'),
        occurredAt: new Date(Date.now() - 3600000).toISOString(),
      };
      const receipt = await events.receive(earlier, 'ISSABEL');
      await events.process(receipt.id);
      const corrected = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: { id: session.id },
        include: { call: { include: { contact: true } } },
      });
      expect(corrected.state).toBe('ENDED');
      expect(corrected.call.occurredAt.toISOString()).toBe(earlier.occurredAt);
      expect(corrected.call.contact.latestOccurredAt.toISOString()).toBe(
        earlier.occurredAt,
      );
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(Date.now() + 2 * 86400000));
      try {
        expect((await events.receive(ringing, 'ISSABEL')).duplicate).toBe(true);
        await expect(
          events.receive(
            { ...ringing, externalEventId: randomUUID() },
            'ISSABEL',
          ),
        ).rejects.toThrow();
        await expect(
          events.receive({ ...ringing, queue: 'different' }, 'ISSABEL'),
        ).rejects.toThrow('collision');
      } finally {
        vi.useRealTimers();
      }
    });
    it('enforces branch/permissions, stable commands, live authorization, extension ownership, rate budget and no duplicate dispatch', async () => {
      const input = { id: randomUUID(), connectionId, number: '09120000001' };
      await expect(
        service.originate({ ...actor, branchIds: [] }, input),
      ).rejects.toThrow();
      await expect(
        service.originate(
          { ...actor, permissions: ['customer_affairs.call_center.read'] },
          input,
        ),
      ).rejects.toThrow();
      await expect(
        service.originate(actor, { ...input, number: '009900000000' }),
      ).rejects.toThrow();
      const pair = await Promise.all([
        service.originate(actor, input),
        service.originate(actor, input),
      ]);
      expect(pair[0]!.id).toBe(pair[1]!.id);
      expect(
        await db.integrationTelephonyCommand.count({ where: { id: input.id } }),
      ).toBe(1);
      expect(
        (
          await db.integrationTelephonyCommand.findUniqueOrThrow({
            where: { id: input.id },
          })
        ).encryptedDestination,
      ).not.toContain(input.number);
      await expect(
        service.originate(actor, { ...input, number: '09120000002' }),
      ).rejects.toThrow();
      await expect(
        service.command({ ...actor, userId: randomUUID() }, input.id),
      ).rejects.toThrow();
      // Private test seam injects a fake socket port; no actual PBX/network call occurs.
      const internals = service as unknown as {
        options: unknown;
        client: unknown;
        dispatch: () => Promise<void>;
      };
      internals.options = {
        connectionId,
        prefixes: ['09'],
        context: 'nora-erp-outbound',
        technology: 'PJSIP',
      };
      const originate = vi.fn().mockRejectedValue(Error('AMI_OUTCOME_UNKNOWN'));
      internals.client = { originate, close: vi.fn() };
      await internals.dispatch();
      await internals.dispatch();
      expect(originate).toHaveBeenCalledTimes(1);
      expect((await service.command(actor, input.id)).state).toBe('UNKNOWN');
      const revoked = await service.originate(actor, {
        ...input,
        id: randomUUID(),
      });
      await db.user.update({
        where: { id: userId },
        data: { status: 'INACTIVE' },
      });
      await internals.dispatch();
      expect((await service.command(actor, revoked.id)).state).toBe('EXPIRED');
      expect(originate).toHaveBeenCalledTimes(1);
      await db.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });
      await service.originate(actor, { ...input, id: randomUUID() });
      await expect(
        service.originate(actor, { ...input, id: randomUUID() }),
      ).rejects.toThrow('rate limit');
    });
    it('stores actual encrypted audio with replay/collision, completeness/checksum and retention enforcement, then publishes one recording reference', async () => {
      const audio = Buffer.alloc(65540, 3);
      audio.write('RIFF', 0);
      audio.writeUInt32LE(audio.length - 8, 4);
      audio.write('WAVE', 8);
      const id = randomUUID(),
        input = {
          id,
          rootCallId: root,
          externalCallId: `${root}.two`,
          direction: 'IN' as const,
          sha256: createHash('sha256').update(audio).digest('hex'),
          sizeBytes: audio.length,
        };
      await media.start(input);
      await media.start(input);
      await expect(
        media.start({ ...input, sha256: 'a'.repeat(64) }),
      ).rejects.toThrow();
      await media.chunk(id, 0, audio.subarray(0, 32768).toString('base64'));
      await expect(media.finish(id)).rejects.toThrow('incomplete');
      await expect(
        media.chunk(id, 0, Buffer.alloc(32768).toString('base64')),
      ).rejects.toThrow();
      for (let offset = 0; offset < audio.length; offset += 32768)
        await media.chunk(
          id,
          offset / 32768,
          audio.subarray(offset, offset + 32768).toString('base64'),
        );
      const receive = vi
        .spyOn(events, 'receive')
        .mockRejectedValueOnce(Error('temporary outage'));
      await expect(media.finish(id)).rejects.toThrow('temporary outage');
      expect(
        (
          await db.integrationTelephonyRecording.findUniqueOrThrow({
            where: { id },
          })
        ).state,
      ).toBe('COMPLETE');
      receive.mockRestore();
      await media.maintain();
      await media.finish(id);
      const chunks = await db.integrationTelephonyRecordingChunk.findMany({
        where: { recordingId: id },
        orderBy: { index: 'asc' },
      });
      const restored = Buffer.concat(
        chunks.map((c) =>
          Buffer.from(
            crypto.decrypt<string>(
              c.encryptedAudio,
              c.keyVersion,
              `issabel:audio:${id}:${c.index}`,
            ),
            'base64',
          ),
        ),
      );
      expect(restored.equals(audio)).toBe(true);
      expect(chunks[0]!.encryptedAudio).not.toContain(
        audio.subarray(0, 32768).toString('base64'),
      );
      const publication = await db.integrationTelephonyInbox.findUniqueOrThrow({
        where: {
          connectionId_externalFingerprint: {
            connectionId,
            externalFingerprint: crypto.fingerprint(
              `telephony:event:${connectionId}:recording:${id}`,
            ),
          },
        },
      });
      expect((await events.process(publication.id)).processed).toBe(true);
      const listener: AuthenticatedActor = {
        ...actor,
        permissions: [
          ...actor.permissions,
          'customer_affairs.call_center.recordings.read',
        ],
      };
      await expect(media.read(actor, id)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        media.read({ ...listener, branchIds: [] }, id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        media.read({ ...listener, userId: randomUUID() }, id),
      ).rejects.toMatchObject({ status: 404 });
      const partial = await media.read(listener, id, 'bytes=32760-32780');
      expect(partial.partial).toBe(true);
      expect(partial.audio.equals(audio.subarray(32760, 32781))).toBe(true);
      expect((await media.read(listener, id)).audio.equals(audio)).toBe(true);
      const session = await db.callCenterTelephonySession.findFirstOrThrow({
        where: {
          connectionId,
          rootFingerprint: crypto.fingerprint(
            `telephony:root:${connectionId}:${root}`,
          ),
        },
      });
      const offers = await db.callCenterTelephonyOffer.findMany({
        where: { sessionId: session.id, active: true },
        select: { id: true },
      });
      await db.callCenterTelephonyOffer.updateMany({
        where: { id: { in: offers.map((o) => o.id) } },
        data: { active: false },
      });
      try {
        await expect(media.read(listener, id)).rejects.toMatchObject({
          status: 404,
        });
        expect(await media.forCall(listener, session.callId)).toEqual({
          data: [{ id, sizeBytes: audio.length }],
        });
        expect(
          (
            await media.read(listener, id, undefined, session.callId)
          ).audio.equals(audio),
        ).toBe(true);
        await expect(
          media.forCall(actor, session.callId),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          media.forCall({ ...listener, branchIds: [] }, session.callId),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          media.read(listener, id, undefined, randomUUID()),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          media.read(
            { ...listener, branchIds: [] },
            id,
            undefined,
            session.callId,
          ),
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        await db.callCenterTelephonyOffer.updateMany({
          where: { id: { in: offers.map((o) => o.id) } },
          data: { active: true },
        });
      }
      await expect(
        media.read(listener, id, 'bytes=999999-'),
      ).rejects.toMatchObject({ status: 416 });
      expect(
        await db.integrationTelephonyAudit.count({
          where: { entityId: id, action: 'RECORDING_PUBLISHED' },
        }),
      ).toBe(1);
      expect(
        await db.integrationTelephonyAudit.count({
          where: { entityId: id, action: 'RECORDING_READ' },
        }),
      ).toBe(3);
      const health = await events.health(actor);
      expect(health.unpublishedRecordings).toBe(0);
      expect(health.unknownCommands).toBe(1);
      expect(health.alerts).toContain('COMMAND_OUTCOME_UNKNOWN');
      expect(
        (await events.health({ ...actor, branchIds: [] })).unknownCommands,
      ).toBe(0);
      await expect(
        events.health({ ...actor, permissions: [] }),
      ).rejects.toMatchObject({ status: 403 });
      await db.integrationTelephonyAudit.createMany({
        data: Array.from({ length: 56 }, () => ({
          connectionId,
          entityId: id,
          actorUserId: userId,
          action: 'RECORDING_READ',
          metadata: {},
        })),
      });
      const competingReads = await Promise.allSettled([
        media.read(listener, id),
        media.read(listener, id),
      ]);
      expect(
        competingReads.filter((r) => r.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(competingReads.find((r) => r.status === 'rejected')).toMatchObject(
        { reason: { status: 429 } },
      );
      await db.integrationTelephonyRecording.update({
        where: { id },
        data: { expiresAt: new Date(0) },
      });
      await expect(media.read(listener, id)).rejects.toMatchObject({
        status: 404,
      });
      expect(await media.forCall(listener, session.callId)).toEqual({
        data: [],
      });
      await media.prune();
      expect(
        await db.integrationTelephonyRecordingChunk.count({
          where: { recordingId: id },
        }),
      ).toBe(0);
      expect(
        await db.integrationTelephonyRecording.count({ where: { id } }),
      ).toBe(0);
      await expect(media.start(input)).rejects.toThrow('retention');
    });
    it('offers outbound calls only to the mapped user and prefills contact identity without old notes', async () => {
      const calls = new CallCenterService({ client: db } as never, crypto);
      const saved = await calls.create(
        {
          id: randomUUID(),
          phone: '+12025550088',
          name: 'Existing test contact',
          subject: 'Previous conversation',
          source: 'Website',
          operator: 'Test operator',
          note: 'Do not copy this note',
          direction: 'INBOUND',
          status: 'جدید',
          occurredAt: new Date(Date.now() - 60000).toISOString(),
        },
        actor,
        branchId,
      );
      config.set('ISSABEL_EVENT_MODE', 'NATIVE_QUEUE_CAPTURE');
      config.set('ISSABEL_USER_NOTIFICATIONS_ENABLED', 'true');
      try {
        const event = {
          ...fact('RINGING', 'outbound-popup'),
          externalEventId: randomUUID(),
          externalCallId: randomUUID(),
          rootCallId: null,
          direction: 'OUT' as const,
          extension: '101',
          caller: { kind: 'KNOWN' as const, value: '101' },
          destination: { kind: 'KNOWN' as const, value: '+12025550088' },
        };
        const receipt = await events.receive(event, 'ISSABEL');
        await events.process(receipt.id);
        const snapshot = await domain.snapshot(actor);
        const offered = snapshot.incoming.find(
          (r) => r.call.contactId === saved.data.contactId,
        );
        expect(offered).toBeDefined();
        expect(offered!.call).toMatchObject({
          direction: 'OUTBOUND',
          phone: '+12025550088',
          name: 'Existing test contact',
          source: 'Website',
          subject: '',
          note: '',
        });
        const other = await domain.snapshot({ ...actor, userId: randomUUID() });
        expect(other.incoming.some((r) => r.id === offered!.id)).toBe(false);
        await expect(
          domain.read({ ...actor, userId: randomUUID() }, offered!.id),
        ).rejects.toThrow();
        const tabId = randomUUID();
        await domain.lease(actor, tabId);
        await domain.action(actor, offered!.id, {
          action: 'CLAIM',
          tabId,
          version: offered!.version,
        });
        expect(
          (await domain.snapshot(actor)).incoming.find(
            (r) => r.id === offered!.id,
          )?.claimed,
        ).toBe(true);
        const detail = await domain.read(actor, offered!.id);
        await domain.action(actor, offered!.id, {
          action: 'SAVE',
          tabId,
          version: detail.version,
          name: 'Existing test contact',
          source: 'Website',
          operator: 'Test operator',
          subject: 'New outbound conversation',
          note: 'New note',
          outcome: 'ANSWERED',
        });
        const updated = await domain.read(actor, offered!.id);
        expect(updated.call).toMatchObject({
          phone: '+12025550088',
          name: 'Existing test contact',
          subject: 'New outbound conversation',
          note: 'New note',
          outcome: 'ANSWERED',
          origin: 'TELEPHONY',
        });
      } finally {
        config.set('ISSABEL_USER_NOTIFICATIONS_ENABLED', 'false');
        config.set('ISSABEL_EVENT_MODE', 'CUSTOM_FACTS');
      }
    });
    it('persists native sales queue calls across retries/restart and out-of-order projection with zero offers even with mappings', async () => {
      config.set('ISSABEL_EVENT_MODE', 'NATIVE_QUEUE_CAPTURE');
      config.set('ISSABEL_INBOUND_QUEUES', 'sales-test');
      const native = new IssabelService(
        { client: db } as never,
        config,
        domain,
        new IamCallCenterDirectory({ client: db } as never),
        events,
        { canManage: () => true } as never,
      );
      const internal = native as unknown as {
        options: IssabelOptions;
        incoming(message: AmiMessage): Promise<void>;
      };
      internal.options = issabelOptions(config)!;
      const nativeRoot = 'native-' + randomUUID();
      const base = {
        uniqueid: nativeRoot,
        linkedid: nativeRoot,
        queue: 'sales-test',
        calleridnum: '+12025550199',
      };
      const before = await db.integrationTelephonyInbox.findMany({
        where: { connectionId },
        select: { id: true },
      });
      try {
        await internal.incoming({
          ...base,
          event: 'QueueCallerJoin',
          queue: 'support-test',
        });
        expect(
          await db.integrationTelephonyInbox.count({ where: { connectionId } }),
        ).toBe(before.length);
        await internal.incoming({ ...base, event: 'QueueCallerJoin' });
        // Retry on a fresh adapter object, with correlation reloaded from encrypted DB receipts.
        const restarted = new IssabelService(
          { client: db } as never,
          config,
          domain,
          new IamCallCenterDirectory({ client: db } as never),
          events,
          {} as never,
        );
        const restartedInternal = restarted as unknown as typeof internal;
        restartedInternal.options = issabelOptions(config)!;
        await restartedInternal.incoming({ ...base, event: 'QueueCallerJoin' });
        for (const destuniqueid of [nativeRoot + '.2', nativeRoot + '.3'])
          await restartedInternal.incoming({
            ...base,
            event: 'AgentCalled',
            destuniqueid,
          });
        await restartedInternal.incoming({
          ...base,
          event: 'Hangup',
          uniqueid: nativeRoot + '.2',
        });
        await restartedInternal.incoming({
          ...base,
          event: 'AgentConnect',
          destuniqueid: nativeRoot + '.3',
        });
        await restartedInternal.incoming({ ...base, event: 'Hangup' });
        const rows = await db.integrationTelephonyInbox.findMany({
          where: { connectionId, id: { notIn: before.map((r) => r.id) } },
          orderBy: { receivedAt: 'desc' },
        });
        expect(rows).toHaveLength(5);
        for (const row of rows) {
          expect(row.encryptedPayload).not.toContain(base.calleridnum);
          expect((await events.process(row.id)).processed).toBe(true);
          expect((await events.process(row.id)).processed).toBe(false);
        }
        const rootFingerprint = crypto.fingerprint(
          `telephony:root:${connectionId}:${nativeRoot}`,
        );
        const sessions = await db.callCenterTelephonySession.findMany({
          where: { connectionId, rootFingerprint },
          include: { call: true },
        });
        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
          state: 'ENDED',
          completed: false,
          call: { origin: 'TELEPHONY', needsCompletion: true },
        });
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { sessionId: sessions[0]!.id },
          }),
        ).toBe(0);
        // Defense in depth: even an extension-bearing canonical input cannot resolve a recipient in capture mode.
        const defensive = {
          ...fact('RINGING', 'native-defensive'),
          rootCallId: 'defensive-' + nativeRoot,
          externalEventId: randomUUID(),
        };
        const receipt = await events.receive(defensive, 'ISSABEL');
        await events.process(receipt.id);
        const session = await db.callCenterTelephonySession.findFirstOrThrow({
          where: {
            connectionId,
            rootFingerprint: crypto.fingerprint(
              `telephony:root:${connectionId}:${defensive.rootCallId}`,
            ),
          },
        });
        expect(
          await db.callCenterTelephonyOffer.count({
            where: { sessionId: session.id },
          }),
        ).toBe(0);
        await expect(
          native.originate(actor, {
            id: randomUUID(),
            connectionId,
            number: '09120000001',
          }),
        ).rejects.toMatchObject({ status: 403 });
      } finally {
        config.set('ISSABEL_EVENT_MODE', 'CUSTOM_FACTS');
        await native.onModuleDestroy();
      }
    });
    it('retains continuity gaps across restart without exposing another branch or private facts', async () => {
      const journal = new AmiContinuity({ client: db } as never, connectionId);
      await journal.start();
      expect((await journal.snapshot()).reconciliationRequired).toBe(true);
      await journal.connected();
      await Promise.all([
        journal.gap('DISCONNECTED'),
        journal.gap('DISCONNECTED'),
      ]);
      expect(
        await db.integrationTelephonyAudit.count({
          where: { connectionId, action: 'AMI_GAP' },
        }),
      ).toBe(2);
      await journal.stop();
      const restarted = new AmiContinuity(
        { client: db } as never,
        connectionId,
      );
      await restarted.start();
      await restarted.connected();
      expect((await restarted.snapshot()).reconciliationRequired).toBe(true);
      (service as unknown as { options: IssabelOptions }).options =
        issabelOptions(config)!;
      expect((await service.status(actor)).eventCoverage).toBe('GAP');
      expect(await service.status({ ...actor, branchIds: [] })).toMatchObject({
        state: 'NOT_CONFIGURED',
        continuity: null,
        eventCoverage: 'NOT_CONFIGURED',
        pendingFrames: null,
      });
      await expect(
        service.status({ ...actor, permissions: [] }),
      ).rejects.toMatchObject({ status: 403 });
    });
    it('isolates concurrent abandoned and answered roots with duplicate delivery and no offers', async () => {
      config.set('ISSABEL_EVENT_MODE', 'NATIVE_QUEUE_CAPTURE');
      config.set('ISSABEL_INBOUND_QUEUES', 'sales-test');
      const native = new IssabelService(
        { client: db } as never,
        config,
        domain,
        {} as never,
        events,
        {} as never,
      );
      const internal = native as unknown as {
        options: IssabelOptions;
        incoming(message: AmiMessage): Promise<void>;
      };
      internal.options = issabelOptions(config)!;
      const roots = [randomUUID(), randomUUID(), randomUUID()];
      const before = await db.integrationTelephonyInbox.findMany({
        where: { connectionId },
        select: { id: true },
      });
      const message = (
        root: string,
        event: string,
        patch: Record<string, string> = {},
      ) => ({
        event,
        linkedid: root,
        uniqueid: root,
        queue: 'sales-test',
        calleridnum: 'anonymous',
        ...patch,
      });
      try {
        await Promise.all(
          roots.map((root) =>
            internal.incoming(message(root, 'QueueCallerJoin')),
          ),
        );
        await Promise.all(
          roots.map((root) =>
            internal.incoming(message(root, 'QueueCallerJoin')),
          ),
        );
        await internal.incoming(
          message(roots[0]!, 'AgentConnect', { destuniqueid: 'agent-first' }),
        );
        await internal.incoming(
          message(roots[0]!, 'Hangup', { uniqueid: 'agent-first' }),
        );
        await internal.incoming(
          message(roots[0]!, 'AgentCalled', { destuniqueid: 'agent-transfer' }),
        );
        await Promise.all(
          roots.map((root) => internal.incoming(message(root, 'Hangup'))),
        );
        const rows = await db.integrationTelephonyInbox.findMany({
          where: { connectionId, id: { notIn: before.map((r) => r.id) } },
          orderBy: { receivedAt: 'desc' },
        });
        expect(rows).toHaveLength(8);
        await Promise.all(rows.map((row) => events.process(row.id)));
        for (const row of rows)
          expect((await events.process(row.id)).processed).toBe(false);
        const sessions = await db.callCenterTelephonySession.findMany({
          where: {
            connectionId,
            rootFingerprint: {
              in: roots.map((root) =>
                crypto.fingerprint(`telephony:root:${connectionId}:${root}`),
              ),
            },
          },
          include: { call: true, _count: { select: { offers: true } } },
        });
        expect(sessions).toHaveLength(3);
        expect(
          sessions.every(
            (s) =>
              s.state === 'ENDED' &&
              s.call.needsCompletion &&
              s._count.offers === 0 &&
              s.claimUserId === null,
          ),
        ).toBe(true);
      } finally {
        config.set('ISSABEL_EVENT_MODE', 'CUSTOM_FACTS');
        await native.onModuleDestroy();
      }
    });
    it('stores private answer history atomically and selects the latest eligible agent without routing or offers', async () => {
      const previousAnswers = await db.integrationTelephonyAnswer.findMany({
        where: { connectionId },
        select: { id: true },
      });
      await db.integrationTelephonyMapping.create({
        data: { connectionId, userId, extension: '105', active: true },
      });
      config.set('ISSABEL_EVENT_MODE', 'NATIVE_QUEUE_CAPTURE');
      config.set('ISSABEL_INBOUND_QUEUES', 'sales-test');
      const native = new IssabelService(
        { client: db } as never,
        config,
        domain,
        {} as never,
        events,
        {} as never,
      );
      const internal = native as unknown as {
        options: IssabelOptions;
        incoming(m: AmiMessage): Promise<void>;
      };
      internal.options = issabelOptions(config)!;
      const now = Date.now();
      const phone = '+12025550188';
      const roots = [randomUUID(), randomUUID(), randomUUID()];
      const emit = async (
        root: string,
        event: string,
        extension: string,
        at: number,
        caller = phone,
        leg = root + '-agent',
      ) =>
        internal.incoming({
          event,
          uniqueid: root,
          linkedid: root,
          queue: 'sales-test',
          calleridnum: caller,
          destuniqueid: leg,
          interface: `Local/${extension}@from-queue/n`,
          timestamp: String(at / 1000),
        });
      const snapshot = () => ({
        queue: 'sales-test',
        observedAt: new Date(),
        members: ['105', '110', '115'].map((extension) => ({
          extension,
          active: true,
          paused: false,
          available: true,
        })),
      });
      const choose = (raw = phone, s = snapshot()) =>
        events.preferredAgent(actor, connectionId, 'sales-test', raw, s);
      try {
        await emit(roots[0]!, 'QueueCallerJoin', '105', now - 10000);
        await emit(roots[0]!, 'AgentCalled', '105', now - 9000);
        expect(await choose()).toMatchObject({
          kind: 'FALLBACK',
          reason: 'NO_ANSWER_HISTORY',
        });
        await emit(roots[0]!, 'AgentConnect', '105', now - 8000);
        await emit(roots[0]!, 'AgentConnect', '105', now - 8000);
        expect(await choose()).toMatchObject({
          kind: 'PREFER',
          extension: '105',
          ringSeconds: 10,
          fallbackQueue: 'sales-test',
        });
        await emit(roots[1]!, 'QueueCallerJoin', '115', now - 15000);
        await emit(roots[1]!, 'AgentConnect', '115', now - 14000);
        expect(await choose()).toMatchObject({ extension: '105' });
        await emit(
          roots[0]!,
          'AgentConnect',
          '110',
          now - 7000,
          phone,
          'transferred-agent',
        );
        expect(await choose()).toMatchObject({ extension: '110' });
        expect(
          await choose(phone, {
            ...snapshot(),
            members: snapshot().members.filter((m) => m.extension !== '110'),
          }),
        ).toMatchObject({ reason: 'NOT_A_CURRENT_MEMBER' });
        expect(
          await choose(phone, {
            ...snapshot(),
            members: snapshot().members.map((m) => ({ ...m, paused: true })),
          }),
        ).toMatchObject({ reason: 'AGENT_UNAVAILABLE' });
        expect(
          await choose(phone, {
            ...snapshot(),
            observedAt: new Date(now - 6000),
          }),
        ).toMatchObject({ reason: 'AVAILABILITY_UNKNOWN' });
        expect(await choose('anonymous')).toMatchObject({
          reason: 'UNKNOWN_NUMBER',
        });
        await expect(
          events.preferredAgent(
            { ...actor, branchIds: [] },
            connectionId,
            'sales-test',
            phone,
            snapshot(),
          ),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
          events.preferredAgent(
            { ...actor, permissions: [] },
            connectionId,
            'sales-test',
            phone,
            snapshot(),
          ),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          events.preferredAgent(
            actor,
            connectionId,
            'other-queue',
            phone,
            snapshot(),
          ),
        ).rejects.toMatchObject({ status: 403 });
        const iranRoot = randomUUID();
        await emit(
          iranRoot,
          'QueueCallerJoin',
          '115',
          now - 6000,
          '+989120000001',
        );
        await emit(
          iranRoot,
          'AgentConnect',
          '115',
          now - 5000,
          '+989120000001',
        );
        for (const number of [
          '09120000001',
          '۰۹۱۲۰۰۰۰۰۰۱',
          '٠٩١٢٠٠٠٠٠٠١',
          '00989120000001',
          '+98 (912) 000-0001',
        ])
          expect(await choose(number)).toMatchObject({ extension: '115' });
        const ties = [randomUUID(), randomUUID()];
        await Promise.all(
          ties.map((r) => emit(r, 'QueueCallerJoin', '105', now - 4000)),
        );
        await Promise.all(
          ties.map((r, i) =>
            emit(r, 'AgentConnect', i ? '115' : '105', now - 3000),
          ),
        );
        expect(await choose()).toMatchObject({
          reason: 'AMBIGUOUS_ANSWER_ORDER',
        });
        const unknown = randomUUID();
        await emit(unknown, 'QueueCallerJoin', '105', now - 2000, 'anonymous');
        await emit(unknown, 'AgentConnect', '105', now - 1000, 'anonymous');
        const answers = await db.integrationTelephonyAnswer.findMany({
          where: {
            connectionId,
            id: { notIn: previousAnswers.map((a) => a.id) },
          },
        });
        expect(answers).toHaveLength(7);
        expect(answers.filter((a) => a.phoneFingerprint === null)).toHaveLength(
          1,
        );
        expect(JSON.stringify(answers)).not.toContain(phone);
        expect(
          answers.every((a) => !a.encryptedAnswer.includes('extension')),
        ).toBe(true);
        const inbox = await db.integrationTelephonyInbox.findMany({
          where: { id: { in: answers.map((a) => a.inboxId) } },
        });
        for (const row of inbox) {
          expect(
            crypto.decrypt<{ recipient: unknown }>(
              row.encryptedPayload!,
              row.keyVersion,
              `telephony:inbox:${row.id}`,
            ).recipient,
          ).toBeNull();
          await events.process(row.id);
        }
        const sessions = await db.callCenterTelephonySession.findMany({
          where: {
            connectionId,
            rootFingerprint: {
              in: [...roots, iranRoot, ...ties, unknown].map((r) =>
                crypto.fingerprint(`telephony:root:${connectionId}:${r}`),
              ),
            },
          },
          include: { _count: { select: { offers: true } } },
        });
        expect(sessions.every((s) => s._count.offers === 0)).toBe(true);
        const beforeCount = await db.integrationTelephonyInbox.count({
          where: { connectionId },
        });
        const atomic = {
          ...fact('ANSWERED'),
          externalEventId: randomUUID(),
          rootCallId: randomUUID(),
          queue: 'sales-test',
          extension: '105',
        };
        const encrypt = crypto.encrypt.bind(crypto);
        const failing = vi
          .spyOn(crypto, 'encrypt')
          .mockImplementation((value, context) => {
            if (context.startsWith('telephony:answer:'))
              throw Error('TEST_ENCRYPTION_FAILURE');
            return encrypt(value, context);
          });
        try {
          await expect(events.receive(atomic, 'ISSABEL')).rejects.toThrow(
            'TEST_ENCRYPTION_FAILURE',
          );
        } finally {
          failing.mockRestore();
        }
        expect(
          await db.integrationTelephonyInbox.count({ where: { connectionId } }),
        ).toBe(beforeCount);
        expect(
          await db.integrationTelephonyAnswer.count({
            where: { connectionId },
          }),
        ).toBe(previousAnswers.length + 7);
        const recovered = await events.receive(atomic, 'ISSABEL');
        expect((await events.receive(atomic, 'ISSABEL')).duplicate).toBe(true);
        expect(
          await db.integrationTelephonyAnswer.count({
            where: { inboxId: recovered.id },
          }),
        ).toBe(1);
        const uncertainRoot = randomUUID();
        await emit(uncertainRoot, 'QueueCallerJoin', '', now - 500, phone);
        await emit(uncertainRoot, 'AgentConnect', '', now - 100, phone);
        expect(await choose()).toMatchObject({
          reason: 'UNKNOWN_ANSWERING_EXTENSION',
        });
      } finally {
        config.set('ISSABEL_EVENT_MODE', 'CUSTOM_FACTS');
        await native.onModuleDestroy();
      }
    });
    it('accepts only the configured relay connection and uses the same durable processing path', async () => {
      const relay = {
        ...fact('RINGING', 'relay'),
        externalEventId: randomUUID(),
        rootCallId: 'relay-' + root,
      };
      await expect(events.receive(relay, 'RELAY')).rejects.toMatchObject({
        status: 403,
      });
      config.set('TELEPHONY_RELAY_ENABLED', 'true');
      config.set('TELEPHONY_RELAY_CONNECTION_ID', connectionId);
      const receipt = await events.receive(relay, 'RELAY');
      expect((await events.receive(relay, 'RELAY')).duplicate).toBe(true);
      expect((await events.process(receipt.id)).processed).toBe(true);
      expect((await events.process(receipt.id)).processed).toBe(false);
      config.set('TELEPHONY_RELAY_ENABLED', 'false');
      await expect(events.receive(relay, 'RELAY')).rejects.toMatchObject({
        status: 403,
      });
    });
    it('preserves local caller and safely recovers legacy blank caller once', async () => {
      const calls = new CallCenterService({ client: db } as never, crypto);
      const root = randomUUID();
      const e = {
        ...fact('RINGING'),
        rootCallId: root,
        externalCallId: root,
        caller: { kind: 'KNOWN' as const, value: '22334455' },
      };
      const sid = await db.$transaction((tx) =>
        domain.project(tx, e, {
          branchId,
          creatorId: userId,
          synthetic: false,
          receivedAt: new Date(),
          recipient: null,
        }),
      );
      const session = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: { id: sid },
      });
      const c = (await calls.getCall(session.callId, actor, branchId)).data;
      expect(c.phone).toBe('22334455');
      const row = await db.callCenterCall.findUniqueOrThrow({
        where: { id: c.id },
      });
      const payload = crypto.decrypt<Record<string, string>>(
        row.encryptedPayload,
        row.keyVersion,
        `call:${row.id}:${row.contactId}`,
      );
      payload.phone = '';
      await db.callCenterCall.update({
        where: { id: c.id },
        data: {
          encryptedPayload: crypto.encrypt(
            payload,
            `call:${row.id}:${row.contactId}`,
          ),
        },
      });
      expect((await recoverStoredCaller(db, crypto, c.id)).changed).toBe(true);
      expect((await recoverStoredCaller(db, crypto, c.id)).changed).toBe(false);
      expect((await calls.getCall(c.id, actor, branchId)).data.phone).toBe(
        '22334455',
      );
    });
    it('completes one durable call with retry/CAS, scoped access and no offers; preserves operator data after late facts', async () => {
      const calls = new CallCenterService({ client: db } as never, crypto);
      const rootId = randomUUID();
      const event = {
        ...fact('RINGING'),
        rootCallId: rootId,
        externalCallId: rootId,
        legId: rootId,
        externalEventId: randomUUID(),
        extension: null,
      };
      const project = (e: typeof event) =>
        db.$transaction((tx) =>
          domain.project(tx, e, {
            branchId,
            creatorId: userId,
            synthetic: false,
            receivedAt: new Date(),
            recipient: null,
          }),
        );
      const sessionId = await project(event);
      const session = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      await project({
        ...event,
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'UNKNOWN',
      });
      expect(
        (await calls.getCall(session.callId, actor, branchId)).data.outcome,
      ).toBeNull();
      await project({
        ...event,
        kind: 'ENDED',
        terminalForCall: false,
        endReason: 'NO_ANSWER',
      });
      let stored = (await calls.getCall(session.callId, actor, branchId)).data;
      expect(stored).toMatchObject({
        outcome: 'NO_ANSWER',
        needsCompletion: true,
        status: 'بدون پاسخ',
      });
      await project({ ...event, kind: 'ANSWERED', endReason: null });
      stored = (await calls.getCall(session.callId, actor, branchId)).data;
      expect(stored.outcome).toBeNull();
      const input = {
        id: stored.id,
        phone: stored.phone,
        occurredAt: stored.occurredAt,
        completionToken: stored.completionToken,
        direction: 'INBOUND' as const,
        name: 'Synthetic caller',
        subject: 'Synthetic completion',
        source: 'نامشخص',
        operator: 'فروش داخلی',
        note: 'Retain this draft',
        outcome: 'ANSWERED',
        status: 'جدید' as const,
      };
      const before = await db.callCenterCall.count();
      await expect(
        calls.create({ ...input, phone: '+12025550166' }, actor, branchId),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        calls.create(input, { ...actor, branchIds: [] }, branchId),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        calls.create(
          input,
          {
            ...actor,
            permissions: [
              'customer_affairs.call_center.read',
              'customer_affairs.call_center.calls.create',
            ],
          },
          branchId,
        ),
      ).rejects.toMatchObject({ status: 403 });
      const partial = await calls.create(input, actor, branchId);
      expect(partial.data).toMatchObject({
        id: session.callId,
        needsCompletion: true,
        note: 'Retain this draft',
        origin: 'TELEPHONY',
      });
      expect((await calls.create(input, actor, branchId)).data.id).toBe(
        session.callId,
      );
      await expect(
        calls.create({ ...input, subject: 'Concurrent edit' }, actor, branchId),
      ).rejects.toMatchObject({ status: 409 });
      const completed = await calls.create(
        {
          ...input,
          completionToken: partial.data.completionToken,
          source: 'سایت',
        },
        actor,
        branchId,
      );
      expect(completed.data.needsCompletion).toBe(false);
      const edited = await calls.create(
        {
          ...input,
          completionToken: completed.data.completionToken,
          source: 'سایت',
          subject: 'Updated completed call',
        },
        actor,
        branchId,
      );
      expect(edited.data.id).toBe(session.callId);
      expect(edited.data.subject).toBe('Updated completed call');
      await expect(
        calls.create(
          {
            ...input,
            completionToken: completed.data.completionToken,
            subject: 'Stale overwrite',
          },
          actor,
          branchId,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await project({
        ...event,
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'NO_ANSWER',
      });
      expect(
        (await calls.getCall(session.callId, actor, branchId)).data,
      ).toMatchObject({
        outcome: 'ANSWERED',
        note: 'Retain this draft',
        needsCompletion: false,
      });
      expect(await db.callCenterCall.count()).toBe(before);
      expect(
        await db.callCenterTelephonyOffer.count({ where: { sessionId } }),
      ).toBe(0);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: session.callId, action: 'COMPLETE_CALL' },
        }),
      ).toBe(3);
      const pendingRoot = randomUUID();
      const pendingEvent = {
        ...event,
        rootCallId: pendingRoot,
        externalCallId: pendingRoot,
        legId: pendingRoot,
      };
      const pendingId = await project(pendingEvent);
      const pending = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: { id: pendingId },
      });
      const pendingCall = (await calls.getCall(pending.callId, actor, branchId))
        .data;
      const pendingInput: CallCenterCallDto = {
        ...input,
        id: pending.callId,
        completionToken: pendingCall.completionToken,
      };
      delete pendingInput.outcome;
      await calls.create(pendingInput, actor, branchId);
      await project({
        ...pendingEvent,
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'NO_ANSWER',
      });
      expect(
        (await calls.getCall(pending.callId, actor, branchId)).data,
      ).toMatchObject({ outcome: 'NO_ANSWER', needsCompletion: true });
    });

    it('persists first outbound contact immediately, assigns its mapped originator once and isolates shared extensions', async () => {
      const e = {
        ...fact('RINGING'),
        externalEventId: randomUUID(),
        externalCallId: randomUUID(),
        rootCallId: null,
        direction: 'OUT' as const,
        extension: '101',
        caller: { kind: 'KNOWN' as const, value: '101' },
        destination: { kind: 'KNOWN' as const, value: '+12025550991' },
      };
      config.set('ISSABEL_EVENT_MODE', 'NATIVE_QUEUE_CAPTURE');
      config.set('ISSABEL_USER_NOTIFICATIONS_ENABLED', 'false');
      config.set('ISSABEL_OUTBOUND_NOTIFICATIONS_ENABLED', 'true');
      try {
        const receipt = await events.receive(e, 'ISSABEL');
        await events.process(receipt.id);
        await events.process(receipt.id);
        const row = await db.callCenterTelephonySession.findFirstOrThrow({
          where: {
            connectionId,
            call: {
              direction: 'OUTBOUND',
              contact: { phoneFingerprint: crypto.fingerprint('+12025550991') },
            },
          },
          include: { call: { include: { contact: true } }, offers: true },
        });
        expect(row.call.needsCompletion).toBe(true);
        expect(row.completed).toBe(false);
        expect(row.call.contact.ownerUserId).toBe(userId);
        expect(row.offers.map((x) => x.userId)).toEqual([userId]);
        expect(
          await db.callCenterCall.count({
            where: { contactId: row.call.contactId },
          }),
        ).toBe(1);
        expect(
          await db.customerAffairsAuditEvent.count({
            where: { entityId: row.call.contactId, action: 'OWNER_ASSIGNED' },
          }),
        ).toBe(1);
        const sharedDomain = new CallCenterTelephonyService(
          { client: db } as never,
          crypto,
          new CallCenterService({ client: db } as never, crypto),
          new IamCallCenterDirectory({ client: db } as never),
          { resolve: async () => ({ shared: true }) } as never,
        );
        const sid = await db.$transaction((tx) =>
          sharedDomain.project(
            tx,
            {
              ...e,
              externalEventId: randomUUID(),
              externalCallId: randomUUID(),
              extension: '203',
              destination: { kind: 'KNOWN', value: '+12025550992' },
            },
            {
              branchId,
              creatorId: userId,
              synthetic: false,
              receivedAt: new Date(),
              recipient: { userId, version: 1 },
            },
          ),
        );
        const shared = await db.callCenterTelephonySession.findUniqueOrThrow({
          where: { id: sid },
          include: { offers: true, call: { include: { contact: true } } },
        });
        expect(shared.offers).toHaveLength(0);
        expect(shared.call.contact.ownerUserId).toBeNull();
        expect(shared.call.needsCompletion).toBe(true);
      } finally {
        config.set('ISSABEL_OUTBOUND_NOTIFICATIONS_ENABLED', 'false');
        config.set('ISSABEL_EVENT_MODE', 'CUSTOM_FACTS');
      }
    });
  },
);
