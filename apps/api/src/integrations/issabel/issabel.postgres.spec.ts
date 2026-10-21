import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CallCenterCrypto } from '../../customer-affairs/call-center.crypto';
import { CallCenterService } from '../../customer-affairs/call-center.service';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';
import { TelephonyIntegrationService } from '../telephony.service';
import { IssabelService } from './issabel.service';
import { IssabelRecordingsService } from './recordings.service';
import { normalizeIssabelEvent } from './events';

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
        url.pathname !== '/nora_ci'
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
      service?.onModuleDestroy();
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
      await media.finish(id);
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
      await db.integrationTelephonyRecording.update({
        where: { id },
        data: { expiresAt: new Date(0) },
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
  },
);
