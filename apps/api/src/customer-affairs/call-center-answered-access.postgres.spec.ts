import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  type ExecutionContext,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  CALL_CENTER_SALES_EXPERT,
  CALL_CENTER_SALES_MANAGER,
  type AuthenticatedActor,
  type TelephonyEventV1,
} from '@nora/contracts';
import { HrUserUnitDirectory } from '../hr/hr-user-unit-directory';
import { HrCallAnswerDirectory } from '../hr/hr-call-answer-directory';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { callCenterSourceActor } from '../iam/call-center-answer-policy';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { IamService } from '../iam/iam.service';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { CallCenterAccessService } from './call-center-access.service';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService } from './call-center.service';
import { CallCenterController } from './call-center.controller';
import { CallCenterReadService } from './call-center-read.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import { TelephonyIntegrationService } from '../integrations/telephony.service';
import { IssabelRecordingsService } from '../integrations/issabel/recordings.service';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'trusted answered responsibility (disposable PostgreSQL)',
  () => {
    let db: DatabaseClient,
      calls: CallCenterService,
      access: CallCenterAccessService,
      directory: IamCallCenterDirectory,
      events: TelephonyIntegrationService,
      domain: CallCenterTelephonyService,
      read: CallCenterReadService,
      crypto: CallCenterCrypto,
      app: INestApplication,
      currentActor: AuthenticatedActor;
    const branchId = randomUUID(),
      foreignBranch = randomUUID(),
      unitId = randomUUID(),
      otherUnit = randomUUID();
    const expert = randomUUID(),
      peer = randomUUID(),
      manager = randomUUID(),
      other = randomUUID(),
      noUnit = randomUUID(),
      ceo = randomUUID(),
      demo = randomUUID(),
      admin = randomUUID();
    const past = new Date('2026-01-01T00:00:00Z');
    let connectionId: string;
    let phoneCounter = 1000;
    const actors = new Map<string, AuthenticatedActor>();
    const actor = (id: string) => actors.get(id)!;
    const makeEvent = (
      extension: string,
      kind: TelephonyEventV1['kind'] = 'ANSWERED',
      root = randomUUID(),
    ): TelephonyEventV1 => ({
      schemaVersion: 1,
      connectionId,
      externalEventId: randomUUID(),
      externalCallId: root,
      rootCallId: root,
      legId: extension,
      kind,
      direction: 'IN',
      caller: {
        kind: 'KNOWN',
        value: '+1202555' + phoneCounter++,
      },
      destination: { kind: 'UNKNOWN', value: null },
      companyLine: null,
      extension,
      queue: null,
      occurredAt: new Date(Date.now() - 200).toISOString(),
      sequence: null,
      terminalForCall: false,
      endReason: null,
      recordingReference: null,
    });
    async function emit(event: TelephonyEventV1) {
      const receipt = await events.receive(event, 'ISSABEL');
      await events.process(receipt.id);
      const session = await db.callCenterTelephonySession.findUniqueOrThrow({
        where: {
          connectionId_rootFingerprint: {
            connectionId: event.connectionId,
            rootFingerprint: crypto.fingerprint(
              `telephony:root:${event.connectionId}:${event.rootCallId}`,
            ),
          },
        },
        include: { call: true },
      });
      return {
        receipt,
        session,
        contactId: session.call.contactId,
        callId: session.callId,
      };
    }
    async function visible(id: string, contactId: string, branch = branchId) {
      return !!(await db.callCenterContact.findFirst({
        where: { id: contactId, ...(await access.where(actor(id), branch)) },
      }));
    }
    async function reprojectOne(id: string, apply = false) {
      const previous = await db.integrationTelephonyInbox.findFirst({
        where: { connectionId, status: 'DONE', id: { lt: id } },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      return events.reprojectAnsweredAccess(actor(admin), {
        ...(previous ? { after: previous.id } : {}),
        limit: 1,
        apply,
      });
    }
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.pathname !== '/nora_ci' ||
        !['127.0.0.1', 'localhost'].includes(url.hostname)
      )
        throw Error('Disposable nora_ci only');
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
      vi.stubEnv('CALL_CENTER_GLOBAL_USER_IDS', `${ceo},${demo}`);
      db = createDatabaseClient(url.toString());
      const database = { client: db } as never;
      await db.branch.createMany({
        data: [branchId, foreignBranch].map((id) => ({
          id,
          code: id,
          name: 'Synthetic branch',
        })),
      });
      await db.hrRecord.createMany({
        data: [unitId, otherUnit].map((id) => ({
          id,
          code: id,
          branchId,
          section: 'organization',
          tab: 'units',
          values: ['فروش'],
          status: 'فعال',
        })),
      });
      for (const id of [
        expert,
        peer,
        manager,
        other,
        noUnit,
        ceo,
        demo,
        admin,
      ]) {
        const permissions = [
          ...(id === manager || id === noUnit || id === other
            ? CALL_CENTER_SALES_MANAGER
            : CALL_CENTER_SALES_EXPERT),
          'customer_affairs.call_center.recordings.read' as const,
        ];
        const global = [ceo, demo].includes(id);
        actors.set(id, {
          userId: id,
          branchIds: global ? [] : [branchId],
          permissions: global ? [] : permissions,
        } as AuthenticatedActor);
        await db.user.create({
          data: {
            id,
            username: id,
            displayName: 'Synthetic operator',
            passwordHash: 'not-a-login',
            status: 'ACTIVE',
            ...(global ? {} : { branches: { create: { branchId } } }),
            ...([ceo, demo, noUnit].includes(id)
              ? {}
              : {
                  profile: {
                    create: {
                      organizationUnitId: id === other ? otherUnit : unitId,
                    },
                  },
                }),
          },
        });
        const role = await db.role.create({
          data: {
            code: id,
            name: 'Synthetic role (label grants no authority)',
            users: { create: { userId: id } },
          },
        });
        for (const code of permissions) {
          const permission = await db.permission.upsert({
            where: { code },
            create: { code, module: 'customer_affairs', name: code },
            update: {},
          });
          await db.rolePermission.create({
            data: { roleId: role.id, permissionId: permission.id },
          });
        }
      }
      const hr = new HrUserUnitDirectory(database);
      directory = new IamCallCenterDirectory(database, hr);
      const teams = new IamWorkbenchRequestDirectory(
        database,
        new HrWorkbenchRequestUnits(database),
        directory,
      );
      access = new CallCenterAccessService(database, teams, directory);
      crypto = new CallCenterCrypto(
        new ConfigService({
          CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
          CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
            'base64',
          ),
          CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: Buffer.alloc(32, 9).toString(
            'base64',
          ),
        }),
      );
      calls = new CallCenterService(
        database,
        crypto,
        access,
        new HrCallAnswerDirectory(database),
      );
      domain = new CallCenterTelephonyService(
        database,
        crypto,
        calls,
        directory,
        new HrCallAnswerDirectory(database),
      );
      connectionId = randomUUID();
      await db.integrationTelephonyConnection.create({
        data: {
          id: connectionId,
          branchId,
          createdByUserId: admin,
          name: 'Synthetic real-provider adapter',
          synthetic: false,
          active: true,
        },
      });
      const config = new ConfigService({
        ISSABEL_ENABLED: 'true',
        ISSABEL_CONNECTION_ID: connectionId,
        ISSABEL_EVENT_MODE: 'NATIVE_QUEUE_CAPTURE',
        TELEPHONY_EVENTS_PER_MINUTE: '6000',
      });
      events = new TelephonyIntegrationService(
        database,
        config,
        domain,
        { canManage: (a: AuthenticatedActor) => a.userId === admin } as never,
        directory,
        teams,
      );
      const workflow = new CallCenterWorkflowService(
        database,
        crypto,
        directory,
        {} as never,
        {} as never,
        access,
      );
      read = new CallCenterReadService(
        database,
        workflow,
        calls,
        crypto,
        teams,
      );
      for (const [id, extensions] of [
        [expert, ['404', '105', '115']],
        [peer, ['501', '105']],
        [other, ['301']],
        [manager, ['701']],
        [noUnit, ['601']],
      ] as [string, string[]][]) {
        const employee = await db.hrEmployee.create({
          data: {
            branchId,
            userId: id,
            personnelCode: randomUUID(),
            name: 'Synthetic employee',
            kind: 'staff',
            unit: 'فروش',
            position: 'کارشناس',
            grade: 'test',
            startedAt: past,
            createdAt: past,
            updatedAt: past,
          },
        });
        for (const extension of extensions)
          await db.hrRecord.create({
            data: {
              code: randomUUID(),
              branchId,
              employeeId: employee.id,
              section: 'employee',
              tab: 'internalContact',
              values: [extension],
              status: 'فعال',
              createdAt: past,
              updatedAt: past,
            },
          });
      }
      const module = await Test.createTestingModule({
        controllers: [CallCenterController],
        providers: [
          PermissionGuard,
          { provide: CallCenterService, useValue: calls },
          { provide: IamCallCenterDirectory, useValue: directory },
          {
            provide: IamService,
            useValue: {
              assertPermissions(a: AuthenticatedActor, codes: string[]) {
                if (
                  !codes.every((code) =>
                    (a.permissions as readonly string[]).includes(code),
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
          canActivate(c: ExecutionContext) {
            c.switchToHttp().getRequest().actor = currentActor;
            return true;
          },
        })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await app.init();
    }, 60000);
    afterAll(async () => {
      await app?.close();
      await db?.$disconnect();
      vi.unstubAllEnvs();
    });

    it('grants only the actual answering account; creator, ring, offer, manual owner and claim grant nothing', async () => {
      const ring = makeEvent('404', 'RINGING');
      const before = await emit(ring);
      await db.callCenterContact.update({
        where: { id: before.contactId },
        data: { ownerUserId: peer, ownerVersion: 1 },
      });
      await db.callCenterTelephonyOffer.create({
        data: { sessionId: before.session.id, userId: peer, mappingVersion: 1 },
      });
      await db.callCenterTelephonySession.update({
        where: { id: before.session.id },
        data: { claimUserId: peer },
      });
      expect(await visible(expert, before.contactId)).toBe(false);
      expect(await visible(peer, before.contactId)).toBe(false);
      const answer = {
        ...ring,
        externalEventId: randomUUID(),
        kind: 'ANSWERED' as const,
      };
      await emit(answer);
      expect(await visible(expert, before.contactId)).toBe(true);
      expect(await visible(peer, before.contactId)).toBe(false);
      expect(await visible(admin, before.contactId)).toBe(false);
      expect(
        (
          await db.callCenterContact.findUniqueOrThrow({
            where: { id: before.contactId },
          })
        ).ownerUserId,
      ).toBe(peer);
    });
    it('retains every answering employee after transfer, late/end events and duplicate receipts', async () => {
      const first = makeEvent('404');
      const record = await emit(first);
      await emit({
        ...first,
        externalEventId: randomUUID(),
        kind: 'ENDED',
        terminalForCall: true,
        endReason: 'COMPLETED',
      });
      const second = {
        ...first,
        externalEventId: randomUUID(),
        extension: '501',
        legId: '501',
      };
      await emit(second);
      await emit(second);
      expect(await visible(expert, record.contactId)).toBe(true);
      expect(await visible(peer, record.contactId)).toBe(true);
      expect(
        await db.callCenterAnswerResponsibility.count({
          where: { callId: record.callId },
        }),
      ).toBe(2);
    });
    it('resolves all linked employees on a shared extension and supports two own extensions', async () => {
      const shared = await emit(makeEvent('105'));
      expect(await visible(expert, shared.contactId)).toBe(true);
      expect(await visible(peer, shared.contactId)).toBe(true);
      const second = await emit(makeEvent('115'));
      expect(await visible(expert, second.contactId)).toBe(true);
      const unknown = await emit(makeEvent('999'));
      expect(await visible(expert, unknown.contactId)).toBe(false);
      expect(
        await db.callCenterAnswerResponsibility.count({
          where: { callId: unknown.callId },
        }),
      ).toBe(0);
    });
    it('uses current unit IDs rather than matching titles, does not infer managers and rejects foreign branches', async () => {
      const own = await emit(makeEvent('404')),
        foreign = await emit(makeEvent('301'));
      expect(await visible(manager, own.contactId)).toBe(true);
      expect(await visible(manager, foreign.contactId)).toBe(false);
      expect(await visible(other, foreign.contactId)).toBe(true);
      expect(await visible(other, own.contactId)).toBe(false);
      expect(await visible(noUnit, own.contactId)).toBe(false);
      const noUnitOwn = await emit(makeEvent('601'));
      expect(await visible(noUnit, noUnitOwn.contactId)).toBe(true);
      const managerOwn = await emit(makeEvent('701'));
      await db.iamUserProfile.update({
        where: { userId: manager },
        data: { organizationUnitId: null },
      });
      expect(await visible(manager, managerOwn.contactId)).toBe(true);
      expect(await visible(manager, own.contactId)).toBe(false);
      await db.iamUserProfile.update({
        where: { userId: manager },
        data: { organizationUnitId: unitId },
      });
      await expect(
        access.where(actor(expert), foreignBranch),
      ).rejects.toThrow();
      await db.iamUserProfile.update({
        where: { userId: expert },
        data: { organizationUnitId: otherUnit },
      });
      expect(await visible(manager, own.contactId)).toBe(false);
      expect(await visible(expert, own.contactId)).toBe(true);
      await db.iamUserProfile.update({
        where: { userId: expert },
        data: { organizationUnitId: unitId },
      });
    });
    it('uses receipt-time identity even if an extension changes before Worker processing', async () => {
      const event = makeEvent('404'),
        receipt = await events.receive(event, 'ISSABEL');
      const employee = await db.hrEmployee.findUniqueOrThrow({
        where: { userId: expert },
      });
      await db.hrRecord.updateMany({
        where: {
          employeeId: employee.id,
          values: { path: ['0'], equals: '404' },
        },
        data: { values: ['888'] },
      });
      await events.process(receipt.id);
      const row = await db.callCenterAnswerResponsibility.findFirstOrThrow({
        where: { inboxId: receipt.id },
      });
      expect(row.userId).toBe(expert);
      await db.hrRecord.updateMany({
        where: {
          employeeId: employee.id,
          values: { path: ['0'], equals: '888' },
        },
        data: { values: ['404'], updatedAt: past },
      });
    });
    it('gives configured executive/demo all active branches only inside Call Center, never mutates original actor', async () => {
      const record = await emit(makeEvent('301'));
      for (const id of [ceo, demo]) {
        const scoped = await directory.callCenterActor(actor(id));
        expect(actor(id).branchIds).toEqual([]);
        expect(actor(id).permissions).toEqual([]);
        expect(callCenterSourceActor(scoped)).toBe(actor(id));
        expect(scoped.branchIds).toContain(foreignBranch);
        expect(
          await access.contact(scoped, branchId, record.contactId),
        ).toBeTruthy();
        expect(
          scoped.permissions.some((code) => code.startsWith('system.')),
        ).toBe(false);
        expect(await directory.canManageRequest(scoped, branchId, other)).toBe(
          true,
        );
        const foreignContact = await db.callCenterContact.create({
          data: {
            branchId: foreignBranch,
            phoneFingerprint: randomUUID().replaceAll('-', '').padEnd(64, '0'),
            latestOccurredAt: new Date(),
          },
        });
        expect(
          await access.contact(scoped, foreignBranch, foreignContact.id),
        ).toBeTruthy();
        currentActor = actor(id);
        expect(
          (
            await request(app.getHttpServer())
              .get('/customer-affairs/call-center')
              .set('x-branch-id', foreignBranch)
          ).status,
        ).toBe(200);
      }
      await db.user.update({
        where: { id: demo },
        data: { status: 'INACTIVE' },
      });
      expect(await directory.callCenterActor(actor(demo))).toBe(actor(demo));
      await db.user.update({ where: { id: demo }, data: { status: 'ACTIVE' } });
      currentActor = actor(expert);
      expect(
        (
          await request(app.getHttpServer())
            .get('/customer-affairs/call-center')
            .set('x-branch-id', foreignBranch)
            .set('x-forwarded-host', 'localhost:3000')
            .set('x-call-center-user-id', ceo)
        ).status,
      ).toBe(403);
    });
    it('applies contact policy to search, KPIs, dossier, history, direct call and recording reads', async () => {
      const a = makeEvent('404'),
        own = await emit(a),
        foreign = await emit(makeEvent('301'));
      expect(
        (
          await read.search(actor(expert), branchId, {
            page: 1,
            pageSize: 50,
            scope: 'LATEST',
          } as never)
        ).data.some((row) => row.id === foreign.contactId),
      ).toBe(false);
      expect(
        (
          await read.history(actor(expert), branchId, own.contactId, 'calls', {
            pageSize: 20,
          } as never)
        ).data.length,
      ).toBeGreaterThan(0);
      await expect(
        read.history(actor(expert), branchId, foreign.contactId, 'calls', {
          pageSize: 20,
        } as never),
      ).rejects.toThrow();
      await expect(
        calls.getCall(foreign.callId, actor(expert), branchId),
      ).rejects.toThrow();
      await expect(
        domain.callRecordingContext(actor(expert), foreign.callId),
      ).rejects.toThrow();
      const report = await read.kpis(actor(expert), branchId);
      expect(report).toBeTruthy();
      const provider = new IssabelRecordingsService(
        { client: db } as never,
        new ConfigService({}),
        domain,
        events,
      );
      const technical = crypto.decrypt<{ recordings: string[] }>(
        own.session.encryptedTechnical,
        own.session.keyVersion,
        `telephony:${own.session.id}`,
      );
      const ref = `issabel-recording:${randomUUID()}`;
      technical.recordings.push(ref);
      await db.callCenterTelephonySession.update({
        where: { id: own.session.id },
        data: {
          encryptedTechnical: crypto.encrypt(
            technical,
            `telephony:${own.session.id}`,
          ),
        },
      });
      expect(
        await domain.authorizeRecording(
          actor(expert),
          connectionId,
          own.session.rootFingerprint,
          ref,
        ),
      ).toBeTruthy();
      await expect(
        domain.authorizeRecording(
          actor(other),
          connectionId,
          own.session.rootFingerprint,
          ref,
        ),
      ).rejects.toThrow();
      expect(await provider.forCall(actor(expert), own.callId)).toEqual({
        data: [],
      });
    });
    it('serves actual encrypted recording bytes only to answering accounts, their manager and configured global accounts', async () => {
      const event = makeEvent('105'),
        row = await emit(event),
        id = randomUUID();
      const media = new IssabelRecordingsService(
        { client: db } as never,
        new ConfigService({
          ISSABEL_ENABLED: 'true',
          ISSABEL_CONNECTION_ID: connectionId,
          ISSABEL_RECORDING_RETENTION_DAYS: '90',
        }),
        domain,
        events,
      );
      const audio = Buffer.alloc(44);
      audio.write('RIFF');
      audio.writeUInt32LE(36, 4);
      audio.write('WAVE', 8);
      const startedAt = Date.now();
      await media.start({
        id,
        rootCallId: event.rootCallId!,
        externalCallId: event.externalCallId,
        direction: 'IN',
        sha256: createHash('sha256').update(audio).digest('hex'),
        sizeBytes: audio.length,
      });
      const startedThrough = Date.now();
      await media.chunk(id, 0, audio.toString('base64'));
      await media.finish(id);
      const receipt = await db.integrationTelephonyInbox.findUniqueOrThrow({
        where: {
          connectionId_externalFingerprint: {
            connectionId,
            externalFingerprint: crypto.fingerprint(
              `telephony:event:${connectionId}:recording:${id}`,
            ),
          },
        },
      });
      await events.process(receipt.id);
      for (const userId of [expert, peer, manager, ceo, demo]) {
        const scoped = await directory.callCenterActor(actor(userId));
        expect(
          (await media.read(scoped, id, undefined, row.callId)).audio.equals(
            audio,
          ),
        ).toBe(true);
        expect((await media.read(scoped, id)).audio.equals(audio)).toBe(true);
      }
      for (const userId of [other, noUnit]) {
        await expect(
          media.read(actor(userId), id, undefined, row.callId),
        ).rejects.toThrow();
        await expect(media.read(actor(userId), id)).rejects.toThrow();
      }
      await expect(
        media.read(
          {
            ...actor(expert),
            permissions: actor(expert).permissions.filter(
              (p) => p !== 'customer_affairs.call_center.recordings.read',
            ),
          },
          id,
        ),
      ).rejects.toThrow();
      const stored = await db.integrationTelephonyRecording.findUniqueOrThrow({
        where: { id },
      });
      expect(stored.expiresAt.getTime()).toBeGreaterThanOrEqual(
        startedAt + 90 * 86400000,
      );
      expect(stored.expiresAt.getTime()).toBeLessThanOrEqual(
        startedThrough + 90 * 86400000,
      );
    });
    it('preserves exact manual-create retry receipts without granting dossier access or accepting another creator', async () => {
      const input = {
        id: randomUUID(),
        phone: '+1202555' + phoneCounter++,
        name: 'Synthetic manual caller',
        subject: 'Synthetic manual registration',
        source: 'گوگل',
        operator: 'Synthetic expert',
        note: 'Only supplied text',
        direction: 'INBOUND' as const,
        status: 'جدید' as const,
        occurredAt: new Date().toISOString(),
      };
      const created = await calls.create(input, actor(expert), branchId);
      expect((await calls.create(input, actor(expert), branchId)).data.id).toBe(
        created.data.id,
      );
      await expect(
        calls.getCall(created.data.id, actor(expert), branchId),
      ).rejects.toThrow();
      await expect(
        calls.create(input, actor(peer), branchId),
      ).rejects.toThrow();
      expect(await visible(expert, created.data.contactId)).toBe(false);
    });
    it('keeps SQL KPIs and all KPI modal rows within the same answered-contact scope', async () => {
      const allowed = await db.callCenterCall.count({
        where: { contact: await access.where(actor(expert), branchId) },
      });
      const kpis = await read.kpis(actor(expert), branchId);
      expect(kpis.data.today).toBe(allowed);
      for (const period of [undefined, 'today', 'week'] as const) {
        const result = await read.withoutOutcome(
          actor(expert),
          branchId,
          { page: 1, pageSize: 100 } as never,
          period,
        );
        expect(result.meta.total).toBe(allowed);
        for (const entry of result.data)
          expect(await visible(expert, entry.call.contactId)).toBe(true);
      }
      const report = await read.report(actor(expert), branchId, {
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date(Date.now() + 1000).toISOString(),
      } as never);
      expect(report.data.calls).toBe(allowed);
    });
    it('does not trust role labels, legacy global usernames, manual completion or synthetic evidence', async () => {
      await db.user.update({
        where: { id: expert },
        data: { username: 'demo' },
      });
      vi.stubEnv('CALL_CENTER_REQUEST_GLOBAL_USERNAMES', 'demo');
      expect(await directory.globalCallCenter(actor(expert))).toBe(false);
      expect(
        await directory.canManageRequest(actor(expert), branchId, other),
      ).toBe(false);
      await db.user.update({
        where: { id: expert },
        data: { username: expert },
      });
      const event = makeEvent('404', 'ENDED');
      event.endReason = 'COMPLETED';
      event.terminalForCall = true;
      const row = await emit(event);
      expect(await visible(expert, row.contactId)).toBe(false);
      await db.callCenterCall.update({
        where: { id: row.callId },
        data: { outcome: 'ANSWERED', needsCompletion: false },
      });
      expect(await visible(expert, row.contactId)).toBe(false);
      await db.$transaction((tx) =>
        domain.recordAnswer(
          tx,
          row.callId,
          { ...event, kind: 'ANSWERED' },
          true,
          { inboxId: row.receipt.id, userIds: [expert] },
        ),
      );
      expect(await visible(expert, row.contactId)).toBe(false);
    });
    it('backfills retained answers idempotently without changing business payloads, manual ownership, offers or commands', async () => {
      const event = makeEvent('105'),
        row = await emit(event);
      const before = await db.callCenterCall.findUniqueOrThrow({
        where: { id: row.callId },
      });
      await db.callCenterAnswerResponsibility.deleteMany({
        where: { callId: row.callId },
      });
      const commands = await db.integrationTelephonyCommand.count();
      const dry = await reprojectOne(row.receipt.id);
      expect(dry.applied).toBe(false);
      expect(
        await db.callCenterAnswerResponsibility.count({
          where: { callId: row.callId },
        }),
      ).toBe(0);
      await reprojectOne(row.receipt.id, true);
      await reprojectOne(row.receipt.id, true);
      expect(
        await db.callCenterAnswerResponsibility.count({
          where: { callId: row.callId },
        }),
      ).toBe(2);
      expect(
        await db.callCenterCall.findUniqueOrThrow({
          where: { id: row.callId },
        }),
      ).toEqual(before);
      expect(await db.integrationTelephonyCommand.count()).toBe(commands);
      await expect(
        events.reprojectAnsweredAccess(actor(expert), { apply: true }),
      ).rejects.toThrow();
    });
    it('backfills older retained answer receipts only when the authoritative HR mapping is unchanged, and reports missing payloads', async () => {
      const event = makeEvent('404'),
        row = await emit(event);
      const inbox = await db.integrationTelephonyInbox.findUniqueOrThrow({
        where: { id: row.receipt.id },
      });
      const envelope = crypto.decrypt<Record<string, unknown>>(
        inbox.encryptedPayload!,
        inbox.keyVersion,
        `telephony:inbox:${inbox.id}`,
      );
      delete envelope.answerRecipients;
      await db.integrationTelephonyInbox.update({
        where: { id: inbox.id },
        data: {
          encryptedPayload: crypto.encrypt(
            envelope,
            `telephony:inbox:${inbox.id}`,
          ),
        },
      });
      await db.callCenterAnswerResponsibility.deleteMany({
        where: { callId: row.callId },
      });
      await reprojectOne(inbox.id, true);
      expect(await visible(expert, row.contactId)).toBe(true);
      const employee = await db.hrEmployee.findUniqueOrThrow({
        where: { userId: expert },
      });
      await db.hrRecord.updateMany({
        where: {
          employeeId: employee.id,
          values: { path: ['0'], equals: '404' },
        },
        data: { values: ['880'] },
      });
      await db.callCenterAnswerResponsibility.deleteMany({
        where: { callId: row.callId },
      });
      await reprojectOne(inbox.id, true);
      expect(await visible(expert, row.contactId)).toBe(false);
      await db.hrRecord.updateMany({
        where: {
          employeeId: employee.id,
          values: { path: ['0'], equals: '880' },
        },
        data: { values: ['404'], updatedAt: past },
      });
      await db.integrationTelephonyInbox.update({
        where: { id: inbox.id },
        data: { encryptedPayload: null },
      });
      expect(
        (await reprojectOne(inbox.id, true)).payloadUnavailable,
      ).toBeGreaterThan(0);
      expect(await visible(expert, row.contactId)).toBe(false);
    });
    it('grants no account for an unlinked extension and keeps earliest durable answer through concurrent/out-of-order receipts', async () => {
      const employee = await db.hrEmployee.create({
        data: {
          branchId,
          personnelCode: randomUUID(),
          name: 'Unlinked synthetic employee',
          kind: 'staff',
          unit: 'فروش',
          position: 'کارشناس',
          grade: 'test',
          startedAt: past,
          createdAt: past,
          updatedAt: past,
        },
      });
      await db.hrRecord.create({
        data: {
          code: randomUUID(),
          branchId,
          employeeId: employee.id,
          section: 'employee',
          tab: 'internalContact',
          values: ['909'],
          createdAt: past,
          updatedAt: past,
        },
      });
      const users = await db.user.count(),
        unlinked = await emit(makeEvent('909'));
      expect(
        await db.callCenterAnswerResponsibility.count({
          where: { callId: unlinked.callId },
        }),
      ).toBe(0);
      expect(await db.user.count()).toBe(users);
      const event = makeEvent('115'),
        earlier = {
          ...event,
          externalEventId: randomUUID(),
          occurredAt: new Date(
            Date.parse(event.occurredAt) - 1000,
          ).toISOString(),
        };
      const a = await events.receive(event, 'ISSABEL'),
        b = await events.receive(earlier, 'ISSABEL');
      await Promise.all([events.process(a.id), events.process(b.id)]);
      const responsibilities = await db.callCenterAnswerResponsibility.findMany(
        { where: { inboxId: { in: [a.id, b.id] } } },
      );
      expect(responsibilities).toHaveLength(1);
      expect(responsibilities[0]!.answeredAt.toISOString()).toBe(
        earlier.occurredAt,
      );
      expect(responsibilities[0]!.inboxId).toBe(b.id);
    });
    it('does not silently grant from historical labels or unknown snapshots; localhost legacy policy stays available', async () => {
      const unknown = await emit(makeEvent('999'));
      expect(
        (await reprojectOne(unknown.receipt.id, true)).unresolved,
      ).toBeGreaterThan(0);
      expect(await visible(expert, unknown.contactId)).toBe(false);
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'LEGACY');
      const legacy = {
        ...actor(expert),
        permissions: ['customer_affairs.call_center.read'],
      } as AuthenticatedActor;
      expect(await access.where(legacy, branchId)).toEqual({ branchId });
      vi.stubEnv('NODE_ENV', 'production');
      expect(await access.where(legacy, branchId)).not.toEqual({ branchId });
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'LOCAL_TEST');
      expect(await access.where(legacy, branchId)).toEqual({ branchId });
      await expect(
        events.reprojectAnsweredAccess(actor(admin), { apply: true }),
      ).rejects.toThrow('local legacy');
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    });
  },
);
