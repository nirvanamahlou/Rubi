import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CALL_CENTER_SALES_EXPERT,
  CALL_CENTER_SALES_MANAGER,
  type AuthenticatedActor,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import type { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { NotificationsService } from '../notifications/notifications.service';
import { CallCenterTasksService } from '../tasks/call-center-tasks.service';
import { CallCenterAccessService } from './call-center-access.service';
import { recordCallRequestReview } from './call-center-request-review';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import type { CallCenterRequestDto } from './call-center-workflow.dto';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterCrypto } from './call-center.crypto';
import type { CallCenterCallDto } from './call-center.dto';
import { CallCenterService } from './call-center.service';

describe.skipIf(process.env.NORA_RUN_CALL_CENTER_POSTGRES_TESTS !== '1')(
  'Call Center request follow-up review PostgreSQL',
  () => {
    let db: DatabaseClient;
    let crypto: CallCenterCrypto;
    let accounts: IamCallCenterDirectory;
    let access: CallCenterAccessService;
    let workflow: CallCenterWorkflowService;
    let calls: CallCenterService;
    let telephony: CallCenterTelephonyService;
    const branchId = randomUUID();
    const otherBranchId = randomUUID();
    const creatorId = randomUUID();
    const teamManagerId = randomUUID();
    const expertId = randomUUID();
    const outsiderId = randomUUID();
    const managers = new Set<string>([creatorId, teamManagerId]);
    const actor = (
      userId: string,
      branch: string = branchId,
    ): AuthenticatedActor =>
      ({
        userId,
        branchIds: [branch],
        permissions: [
          ...(managers.has(userId)
            ? CALL_CENTER_SALES_MANAGER
            : CALL_CENTER_SALES_EXPERT),
        ],
      }) as AuthenticatedActor;
    const creator = actor(creatorId);
    const expert = actor(expertId);
    const teamManager = actor(teamManagerId);
    const createdAt = new Date('2026-10-01T08:00:00Z');
    const callAt = new Date('2026-10-02T08:00:00Z');

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw Error('Disposable localhost nora_ci database required');
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'LOCAL_TEST');
      vi.stubEnv('CALL_CENTER_CALLBACK_MANAGER_IDS', '');
      db = createDatabaseClient(url.toString());
      await db.branch.createMany({
        data: [branchId, otherBranchId].map((id) => ({
          id,
          code: id,
          name: 'Synthetic request review branch',
        })),
      });
      await db.user.createMany({
        data: [creatorId, teamManagerId, expertId, outsiderId].map((id) => ({
          id,
          username: id,
          displayName: `Synthetic review ${id}`,
          passwordHash: 'not-a-login',
          status: 'ACTIVE',
        })),
      });
      await db.userBranch.createMany({
        data: [creatorId, teamManagerId, expertId, outsiderId].flatMap(
          (userId) =>
            [branchId, otherBranchId].map((branchId) => ({
              userId,
              branchId,
            })),
        ),
      });
      crypto = new CallCenterCrypto(
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
      accounts = new IamCallCenterDirectory(database);
      vi.spyOn(accounts, 'globalCallCenter').mockResolvedValue(false);
      // IAM remains the authority. The creator now manages a different unit,
      // while the current team manager may manage the assigned expert.
      vi.spyOn(accounts, 'canManageRequest').mockImplementation(
        async (user, branch, ownerId, tx) =>
          user.branchIds.includes(branch) &&
          managers.has(user.userId) &&
          (user.userId === ownerId ||
            (user.userId === teamManagerId && ownerId === expertId)) &&
          !!(await (tx ?? db).user.findFirst({
            where: { id: user.userId, status: 'ACTIVE' },
            select: { id: true },
          })),
      );
      vi.spyOn(accounts, 'closureRecipients').mockResolvedValue([]);
      const workbench = {
        callCenterOperator: async (
          user: AuthenticatedActor,
          branch: string,
        ) => {
          if (
            !user.branchIds.includes(branch) ||
            !(await db.user.findFirst({
              where: { id: user.userId, status: 'ACTIVE' },
              select: { id: true },
            }))
          )
            throw new ForbiddenException();
        },
        callCenterTeam: async (user: AuthenticatedActor) =>
          user.userId === teamManagerId ? [expertId] : [],
      } as unknown as IamWorkbenchRequestDirectory;
      access = new CallCenterAccessService(database, workbench, accounts);
      calls = new CallCenterService(database, crypto, access);
      telephony = new CallCenterTelephonyService(
        database,
        crypto,
        calls,
        accounts,
      );
      workflow = new CallCenterWorkflowService(
        database,
        crypto,
        accounts,
        new CallCenterTasksService(database),
        new NotificationsService({} as never),
        access,
      );
    }, 30_000);

    afterAll(async () => {
      workflow?.onModuleDestroy();
      await db?.$disconnect();
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    });

    async function request(
      options: {
        branch?: string;
        creator?: string;
        owner?: string;
        status?: string;
        contactId?: string;
      } = {},
    ) {
      const branch = options.branch ?? branchId;
      const contactId = options.contactId ?? randomUUID();
      const ownerId = options.owner ?? expertId;
      if (!options.contactId)
        await db.callCenterContact.create({
          data: {
            id: contactId,
            branchId: branch,
            phoneFingerprint: crypto.fingerprint(contactId),
            latestOccurredAt: callAt,
            ownerUserId: ownerId,
          },
        });
      const id = randomUUID();
      await db.customerAffairsTicket.create({
        data: {
          id,
          branchId: branch,
          callCenterContactId: contactId,
          callCenterPayload: crypto.encrypt(
            { title: 'Synthetic review request', reason: 'Initial request' },
            `request:${id}:${contactId}`,
          ),
          callCenterKeyVersion: crypto.keyVersion,
          trackingNumber: id.replace(/-/g, ''),
          subject: 'Call Center request',
          description: 'Synthetic encrypted request',
          channel: 'PHONE',
          contactOccurredAt: createdAt,
          category: 'CALL_CENTER_REQUEST',
          impact: 'NORMAL',
          urgency: 'NORMAL',
          priority: 'NORMAL',
          status: options.status ?? 'IN_PROGRESS',
          customerOwnerUserId: options.creator ?? creatorId,
          executionOwnerUserId: ownerId,
          references: [],
          slaPolicyVersion: 'CALL_CENTER_NO_SLA',
          firstResponseDueAt: createdAt,
          resolutionDueAt: createdAt,
          nextAction: 'Synthetic follow-up',
          nextActionAt: createdAt,
          createdByUserId: options.creator ?? creatorId,
          updatedByUserId: options.creator ?? creatorId,
          createdAt,
        },
      });
      return { id, contactId, ownerId, branchId: branch };
    }

    type RequestFixture = Awaited<ReturnType<typeof request>>;

    async function call(
      item: RequestFixture,
      options: {
        subject?: string;
        linked?: boolean;
        occurredAt?: Date;
        outcome?: string | null;
        origin?: string;
      } = {},
    ) {
      const id = randomUUID();
      return db.callCenterCall.create({
        data: {
          id,
          contactId: item.contactId,
          ticketId: options.linked === false ? null : item.id,
          createdByUserId: expertId,
          direction: 'OUTBOUND',
          status: 'جدید',
          outcome:
            options.outcome === undefined ? 'NO_ANSWER' : options.outcome,
          origin: options.origin ?? 'TELEPHONY',
          occurredAt: options.occurredAt ?? callAt,
          keyVersion: crypto.keyVersion,
          requestFingerprint: crypto.fingerprint(id),
          encryptedPayload: crypto.encrypt(
            {
              name: 'Synthetic contact',
              phone: '+12025550127',
              subject: options.subject ?? 'Requested follow-up',
              note: 'Synthetic call description',
              source: 'نامشخص',
              operator: 'Synthetic expert',
            },
            `call:${id}:${item.contactId}`,
          ),
        },
      });
    }

    async function record(
      item: RequestFixture,
      savedCall: Awaited<ReturnType<typeof call>>,
      options: { userId?: string; synthetic?: boolean; branch?: string } = {},
    ) {
      return db.$transaction((tx) =>
        recordCallRequestReview(tx, {
          branchId: options.branch ?? item.branchId,
          actorUserId: options.userId ?? expertId,
          call: savedCall,
          synthetic: options.synthetic ?? false,
        }),
      );
    }

    async function liveSession(savedCall: Awaited<ReturnType<typeof call>>) {
      const connection = await db.integrationTelephonyConnection.create({
        data: {
          branchId,
          createdByUserId: creatorId,
          name: 'Synthetic fixture for real SAVE path',
          active: true,
          synthetic: false,
        },
      });
      const id = randomUUID();
      return db.callCenterTelephonySession.create({
        data: {
          id,
          connectionId: connection.id,
          rootFingerprint: crypto.fingerprint(savedCall.id),
          callId: savedCall.id,
          state: 'ENDED',
          encryptedTechnical: crypto.encrypt({}, `telephony:${id}`),
          keyVersion: crypto.keyVersion,
          claimUserId: expertId,
          synthetic: false,
          offers: {
            create: { userId: expertId, mappingVersion: 0, active: true },
          },
        },
      });
    }

    async function detail(item: RequestFixture, user = creator) {
      const response = await workflow.list(
        user,
        item.branchId,
        item.contactId,
        1,
        1,
        item.id,
      );
      expect(response.data).toHaveLength(1);
      const result = response.data[0];
      if (!result) throw Error('Expected exact request response');
      return result;
    }

    function reviewToken(item: Awaited<ReturnType<typeof detail>>) {
      const token = item.review.token;
      if (!token) throw Error('Expected pending follow-up review token');
      return token;
    }

    async function decision(
      item: RequestFixture,
      user = creator,
      overrides: Partial<CallCenterRequestDto> = {},
      acknowledgeReview = true,
    ) {
      const current = await detail(item, user);
      return workflow.saveRequest(user, item.branchId, item.contactId, {
        id: item.id,
        commandId: randomUUID(),
        expectedVersion: current.version,
        ...(acknowledgeReview
          ? { expectedReviewToken: reviewToken(current) }
          : {}),
        title: current.title,
        reason: 'Manager reviewed the recorded follow-up',
        status: 'IN_PROGRESS',
        ownerId: item.ownerId,
        priority: 'NORMAL',
        ...overrides,
      });
    }

    it('records a review through the actual completion-token call SAVE and keeps retries idempotent', async () => {
      const item = await request();
      const savedCall = await call(item, { outcome: null });
      await liveSession(savedCall);
      const presented = calls.presentCall(savedCall);
      const input: CallCenterCallDto = {
        id: savedCall.id,
        completionToken: presented.completionToken,
        ticketId: item.id,
        phone: presented.phone,
        name: presented.name,
        subject: 'Saved through dossier completion',
        source: presented.source,
        operator: presented.operator,
        direction: 'OUTBOUND',
        status: 'جدید',
        occurredAt: savedCall.occurredAt.toISOString(),
        note: 'Synthetic completed follow-up',
        outcome: 'NO_ANSWER',
      };
      await calls.create(input, expert, branchId);
      expect(
        await db.callCenterRequestReview.findMany({
          where: { ticketId: item.id },
        }),
      ).toEqual([
        expect.objectContaining({
          callId: savedCall.id,
          completedByUserId: expertId,
          reviewedAt: null,
        }),
      ]);
      expect(await detail(item)).toMatchObject({
        ownerId: expertId,
        status: 'IN_PROGRESS',
        version: 1,
        review: { pending: true, subject: input.subject },
      });
      await decision(item);
      await calls.create(input, expert, branchId);
      expect((await detail(item)).review.pending).toBe(false);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: item.id, action: 'REQUEST_FOLLOWUP_RECORDED' },
        }),
      ).toBe(1);
    });

    it('records a review through the actual claimed popup SAVE only after a result is saved', async () => {
      const item = await request();
      const savedCall = await call(item, { outcome: null });
      const session = await liveSession(savedCall);
      const tabId = randomUUID();
      expect(await telephony.lease(expert, tabId)).toEqual({ leader: true });
      try {
        const input = {
          action: 'SAVE' as const,
          tabId,
          ticketId: item.id,
          subject: 'Saved through telephony popup',
          name: 'Synthetic contact',
          source: 'نامشخص',
          operator: 'Synthetic expert',
          note: 'Synthetic completed follow-up',
        };
        await telephony.action(expert, session.id, {
          ...input,
          version: session.version,
        });
        expect(
          await db.callCenterRequestReview.count({
            where: { ticketId: item.id },
          }),
        ).toBe(0);
        await telephony.action(expert, session.id, {
          ...input,
          version: session.version + 1,
          outcome: 'NO_ANSWER',
        });
        expect(await detail(item)).toMatchObject({
          ownerId: expertId,
          status: 'IN_PROGRESS',
          version: 1,
          review: { pending: true, subject: input.subject },
        });
        expect(
          await db.callCenterRequestReview.findMany({
            where: { ticketId: item.id },
          }),
        ).toEqual([
          expect.objectContaining({
            callId: savedCall.id,
            completedByUserId: expertId,
            reviewedAt: null,
          }),
        ]);
        expect(
          await db.customerAffairsAuditEvent.count({
            where: { entityId: item.id, action: 'REQUEST_FOLLOWUP_RECORDED' },
          }),
        ).toBe(1);
      } finally {
        await telephony.lease(expert, tabId, true);
      }
    });

    it.each(['ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'WRONG_NUMBER'])(
      'routes an assigned expert saved %s call to its creating manager without reassignment',
      async (outcome) => {
        const item = await request();
        const before = await workflow.queue(creator, branchId, 'MINE', 1);
        expect(before.data.some((row) => row.id === item.id)).toBe(false);
        const savedCall = await call(item, { outcome });
        expect(await record(item, savedCall)).toBe(true);
        const row = await detail(item);
        expect(row.review).toMatchObject({
          pending: true,
          canReview: true,
          subject: 'Requested follow-up',
        });
        expect(row.review.token).toMatch(/^[a-f0-9]{64}$/);
        expect(row).toMatchObject({
          status: 'IN_PROGRESS',
          ownerId: expertId,
          version: 1,
        });
        const mine = await workflow.queue(creator, branchId, 'MINE', 1);
        expect(mine.data.find((row) => row.id === item.id)?.pendingReview).toBe(
          true,
        );
        const expertMine = await workflow.queue(expert, branchId, 'MINE', 1);
        expect(expertMine.data.some((row) => row.id === item.id)).toBe(true);
      },
    );

    it('records a decision once, preserves ownership and only a different call reopens review', async () => {
      const item = await request();
      const first = await call(item);
      await record(item, first);
      await decision(item);
      const reviewed = await detail(item);
      expect(reviewed.review).toMatchObject({ pending: false });
      expect(reviewed).toMatchObject({
        status: 'IN_PROGRESS',
        ownerId: expertId,
        version: 2,
      });
      expect(
        (await workflow.queue(creator, branchId, 'MINE', 1)).data.some(
          (row) => row.id === item.id,
        ),
      ).toBe(false);
      expect(await record(item, first)).toBe(false);
      expect((await detail(item)).review.pending).toBe(false);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: item.id, action: 'REQUEST_FOLLOWUP_RECORDED' },
        }),
      ).toBe(1);
      expect(
        await db.callCenterRequestReview.findFirst({
          where: { ticketId: item.id, callId: first.id },
        }),
      ).toMatchObject({
        reviewedByUserId: creatorId,
        reviewedAt: expect.any(Date),
      });
      const second = await call(item, { subject: 'Second follow-up' });
      expect(await record(item, second)).toBe(true);
      expect((await detail(item)).review).toMatchObject({
        pending: true,
        subject: 'Second follow-up',
      });
      expect(
        await db.callCenterRequestReview.count({
          where: { ticketId: item.id },
        }),
      ).toBe(2);
    });

    it('keeps one pending receipt when the same completed call is saved concurrently', async () => {
      const item = await request();
      const savedCall = await call(item);
      const results = await Promise.all([
        record(item, savedCall),
        record(item, savedCall),
      ]);
      expect(results.sort()).toEqual([false, true]);
      expect(
        await db.callCenterRequestReview.count({
          where: { ticketId: item.id, callId: savedCall.id, reviewedAt: null },
        }),
      ).toBe(1);
      expect(
        await db.customerAffairsAuditEvent.count({
          where: { entityId: item.id, action: 'REQUEST_FOLLOWUP_RECORDED' },
        }),
      ).toBe(1);
    });

    it('rejects stale approval when another saved call arrived without changing request version', async () => {
      const item = await request();
      await record(item, await call(item));
      const displayed = await detail(item);
      await record(item, await call(item));
      await expect(
        decision(item, creator, {
          expectedVersion: displayed.version,
          expectedReviewToken: reviewToken(displayed),
        }),
      ).rejects.toThrow(ConflictException);
      const current = await detail(item);
      expect(current.version).toBe(displayed.version);
      expect(current.review.pending).toBe(true);
      expect(current.review.token).not.toBe(displayed.review.token);
      expect(
        await db.callCenterRequestReview.count({
          where: { ticketId: item.id, reviewedAt: null },
        }),
      ).toBe(2);
    });

    it('does not acknowledge an unseen follow-up inserted while the request is being read', async () => {
      const item = await request();
      await record(item, await call(item, { subject: 'Visible follow-up' }));
      const before = await detail(item);
      const second = await call(item, { subject: 'Concurrent follow-up' });
      let inserted = false;
      const concurrentClient = db.$extends({
        query: {
          customerAffairsTicket: {
            async findMany({ args, query }) {
              const rows = await query(args);
              if (!inserted && rows.some((row) => row.id === item.id)) {
                inserted = true;
                // A separate connection commits after the editor's ticket/subject
                // read, but before its pending-review token has been assembled.
                expect(await record(item, second)).toBe(true);
              }
              return rows;
            },
          },
        },
      });
      const database = { client: concurrentClient } as never;
      const concurrentWorkflow = new CallCenterWorkflowService(
        database,
        crypto,
        accounts,
        new CallCenterTasksService(database),
        new NotificationsService({} as never),
        access,
      );
      try {
        const response = await concurrentWorkflow.list(
          creator,
          branchId,
          item.contactId,
          1,
          1,
          item.id,
        );
        expect(inserted).toBe(true);
        expect(response.data).toHaveLength(1);
        const displayed = response.data[0];
        if (!displayed) throw Error('Expected exact request snapshot');
        expect(displayed.review.subject).toBe('Visible follow-up');
        expect(displayed.review.token).toBe(before.review.token);
        await expect(
          decision(item, creator, {
            expectedVersion: displayed.version,
            expectedReviewToken: reviewToken(displayed),
          }),
        ).rejects.toThrow(ConflictException);
        expect(
          await db.callCenterRequestReview.count({
            where: { ticketId: item.id, reviewedAt: null },
          }),
        ).toBe(2);
        expect((await detail(item)).review.subject).toBe(
          'Concurrent follow-up',
        );
      } finally {
        concurrentWorkflow.onModuleDestroy();
      }
    });

    it('keeps the database outcome constraint after accepting wrong-number results', async () => {
      const item = await request();
      await expect(
        call(item, { outcome: 'NOT_A_CALL_OUTCOME' }),
      ).rejects.toThrow(/cc_call_outcome_check/);
      expect(
        await db.callCenterCall.count({ where: { ticketId: item.id } }),
      ).toBe(0);
    });

    it('does not let the current team manager or expert clear another manager review', async () => {
      const item = await request();
      await record(item, await call(item));
      for (const user of [teamManager, expert]) {
        expect((await detail(item, user)).review.canReview).toBe(false);
        await expect(decision(item, user)).rejects.toThrow(ForbiddenException);
      }
      expect((await detail(item)).review.pending).toBe(true);
      expect(
        await db.callCenterRequestReview.count({
          where: { ticketId: item.id, reviewedAt: { not: null } },
        }),
      ).toBe(0);
    });

    it('requires an active creating manager and keeps unprivileged creator access unchanged', async () => {
      const item = await request({ creator: outsiderId });
      await record(item, await call(item));
      await expect(detail(item, actor(outsiderId))).rejects.toThrow();
      const managed = await request();
      await record(managed, await call(managed));
      await db.user.update({
        where: { id: creatorId },
        data: { status: 'INACTIVE' },
      });
      try {
        await expect(detail(managed)).rejects.toThrow();
      } finally {
        await db.user.update({
          where: { id: creatorId },
          data: { status: 'ACTIVE' },
        });
      }
    });

    it('exposes a related saved subject and minimal contact header without opening unrelated history', async () => {
      const item = await request();
      const unrelated = await request({
        contactId: item.contactId,
        creator: teamManagerId,
      });
      await call(item, {
        linked: false,
        subject: 'Private unrelated latest subject',
        occurredAt: new Date('2026-10-03T08:00:00Z'),
      });
      expect((await detail(item, teamManager)).review.subject).toBeUndefined();
      await record(
        item,
        await call(item, { subject: 'Saved follow-up subject' }),
      );
      const result = await detail(item);
      expect(result.review.subject).toBe('Saved follow-up subject');
      expect(result.contactSummary).toEqual({
        name: 'Synthetic contact',
        phone: '+12025550127',
      });
      expect(JSON.stringify(result)).not.toContain(
        'Private unrelated latest subject',
      );
      await expect(
        access.contact(creator, branchId, item.contactId),
      ).rejects.toThrow();
      await expect(detail(unrelated)).rejects.toThrow();
      await expect(
        workflow.list(creator, branchId, item.contactId),
      ).rejects.toThrow();
      await decision(item);
      expect((await detail(item)).review.pending).toBe(false);
      await expect(
        access.contact(creator, branchId, item.contactId),
      ).rejects.toThrow();
    });

    it('enforces creator-only request history with the production answered-call policy as well', async () => {
      const item = await request();
      await record(item, await call(item));
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
      try {
        expect((await detail(item)).review.canReview).toBe(true);
        await expect(
          access.contact(creator, branchId, item.contactId),
        ).rejects.toThrow();
        await decision(item);
        expect((await detail(item)).review.pending).toBe(false);
      } finally {
        vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'LOCAL_TEST');
      }
    });

    it('does not silently acknowledge pending review for older clients without a review token', async () => {
      const item = await request();
      await record(item, await call(item));
      await decision(item, teamManager, {}, false);
      expect((await detail(item)).review.pending).toBe(true);
    });

    it('returns an exact-request response after a narrow creator edits without acknowledging review', async () => {
      const item = await request();
      await record(item, await call(item));
      const result = await decision(
        item,
        creator,
        { reason: 'Creator added context before deciding' },
        false,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: item.id,
        version: 2,
        reason: 'Creator added context before deciding',
        review: { pending: true },
      });
      await expect(
        access.contact(creator, branchId, item.contactId),
      ).rejects.toThrow();
    });

    it('isolates receipts, queue rows and decisions by branch', async () => {
      const item = await request({ branch: otherBranchId });
      const savedCall = await call(item);
      expect(await record(item, savedCall, { branch: branchId })).toBe(false);
      expect(await record(item, savedCall)).toBe(true);
      await expect(detail(item)).rejects.toThrow();
      expect(
        (await workflow.queue(creator, branchId, 'MINE', 1)).data.some(
          (row) => row.id === item.id,
        ),
      ).toBe(false);
      const authorized = actor(creatorId, otherBranchId);
      const displayed = await detail(item, authorized);
      await expect(
        workflow.saveRequest(creator, branchId, item.contactId, {
          id: item.id,
          commandId: randomUUID(),
          expectedVersion: displayed.version,
          expectedReviewToken: reviewToken(displayed),
          title: displayed.title,
          reason: 'Wrong branch',
          ownerId: expertId,
          priority: 'NORMAL',
          status: 'IN_PROGRESS',
        }),
      ).rejects.toThrow();
      expect((await detail(item, authorized)).review.pending).toBe(true);
    });

    it('only records a real, linked post-request call saved by its assigned expert', async () => {
      const item = await request();
      const savedCall = await call(item);
      expect(await record(item, savedCall, { userId: outsiderId })).toBe(false);
      expect(await record(item, savedCall, { synthetic: true })).toBe(false);
      for (const invalid of [
        await call(item, { origin: 'MANUAL' }),
        await call(item, { linked: false }),
        await call(item, { outcome: null }),
        await call(item, { occurredAt: new Date('2026-09-30T08:00:00Z') }),
      ])
        expect(await record(item, invalid)).toBe(false);
      const closed = await request({ status: 'CLOSED' });
      expect(await record(closed, await call(closed))).toBe(false);
      expect(
        await db.callCenterRequestReview.count({
          where: { ticketId: { in: [item.id, closed.id] } },
        }),
      ).toBe(0);
    });
  },
);
