import { randomUUID } from 'node:crypto';
import { callContactPrefill } from './call-contact-prefill';
import { HrCallAnswerDirectory } from '../hr/hr-call-answer-directory';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canViewRoute,
  hasScopedCallCenterAccess,
  type AuthenticatedActor,
  type TelephonyEventV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterService, normalizedCallPhone } from './call-center.service';
import { callSearchMetadata } from './call-center-search';
import {
  applyTelephonyEvent,
  type TelephonyTechnical,
} from './telephony-state';

/** Public Customer Affairs port: Integrations supplies canonical events and resolved routing only. */
@Injectable()
export class CallCenterTelephonyService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CallCenterCrypto) readonly crypto: CallCenterCrypto,
    @Inject(CallCenterService) private readonly calls: CallCenterService,
    @Inject(IamCallCenterDirectory)
    private readonly directory: IamCallCenterDirectory,
    @Inject(HrCallAnswerDirectory)
    private readonly answerDirectory?: HrCallAnswerDirectory,
  ) {}
  authorize(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('customer_affairs.call_center.read') ||
      (hasScopedCallCenterAccess(actor.permissions) &&
        !actor.permissions.includes(
          'customer_affairs.call_center.workflow.manage',
        )) ||
      (hasScopedCallCenterAccess(actor.permissions) &&
        !canViewRoute(actor.permissions, '/customer-affairs/call-center')) ||
      (write &&
        !actor.permissions.includes(
          'customer_affairs.call_center.workflow.manage',
        ))
    )
      throw new ForbiddenException();
  }
  async project(
    tx: Prisma.TransactionClient,
    event: TelephonyEventV1,
    context: {
      branchId: string;
      creatorId: string;
      synthetic: boolean;
      receivedAt: Date;
      recipient: {
        userId: string;
        version: number;
        teamId?: string | null;
      } | null;
    },
  ) {
    // Shared physical extensions never identify an individual caller.
    if (event.direction === 'OUT' && context.recipient) {
      const shared =
        event.extension && this.answerDirectory
          ? (
              await this.answerDirectory.resolve(
                context.branchId,
                event.extension,
                event.occurredAt,
                tx,
                event.connectionId,
              )
            ).shared
          : false;
      if (
        shared ||
        !(await this.directory.eligibleMapping(
          context.branchId,
          context.recipient.userId,
          context.recipient.teamId ?? null,
          tx,
        ))
      ) {
        context = { ...context, recipient: null };
      }
    }
    const rootFingerprint = this.crypto.fingerprint(
      `telephony:root:${event.connectionId}:${event.rootCallId ?? event.externalCallId}`,
    );
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${rootFingerprint},0))`;
    let row = await tx.callCenterTelephonySession.findUnique({
      where: {
        connectionId_rootFingerprint: {
          connectionId: event.connectionId,
          rootFingerprint,
        },
      },
    });
    const previous = row
      ? this.crypto.decrypt<TelephonyTechnical>(
          row.encryptedTechnical,
          row.keyVersion,
          `telephony:${row.id}`,
        )
      : null;
    if (previous && previous.first.direction !== event.direction)
      throw new ConflictException('Telephony direction conflict.');
    if (
      previous &&
      !previous.legs[`leg:${event.legId ?? event.externalCallId}`] &&
      Object.keys(previous.legs).length >= 128
    )
      throw new BadRequestException('Telephony leg limit exceeded.');
    const technical = applyTelephonyEvent(previous, event, context.receivedAt);
    if (!row) {
      const id = randomUUID(),
        callId = randomUUID();
      const raw = event.direction === 'IN' ? event.caller : event.destination;
      const phone = raw.kind === 'KNOWN' ? normalizedCallPhone(raw.value!) : '';
      const phoneFingerprint = this.crypto.fingerprint(
        context.synthetic
          ? `synthetic:${phone || id}`
          : phone || `anonymous:${id}`,
      );
      const occurredAt = new Date(event.occurredAt);
      const newContactId = randomUUID();
      const contact = await tx.callCenterContact.upsert({
        where: {
          branchId_phoneFingerprint: {
            branchId: context.branchId,
            phoneFingerprint,
          },
        },
        create: {
          id: newContactId,
          branchId: context.branchId,
          phoneFingerprint,
          latestOccurredAt: occurredAt,
          ...(event.direction === 'OUT' && context.recipient
            ? { ownerUserId: context.recipient.userId, ownerVersion: 1 }
            : {}),
        },
        update: {},
      });
      if (contact.id === newContactId && contact.ownerUserId) {
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId: context.branchId,
            actorUserId: context.creatorId,
            entityType: 'CALL_CENTER_CONTACT',
            entityId: contact.id,
            action: 'OWNER_ASSIGNED',
            version: 1,
            afterSnapshot: {
              previousOwnerUserId: null,
              ownerUserId: contact.ownerUserId,
              reason: 'OUTBOUND_ORIGINATOR',
            },
          },
        });
      }
      await tx.callCenterContact.updateMany({
        where: { id: contact.id, latestOccurredAt: { lt: occurredAt } },
        data: { latestOccurredAt: occurredAt },
      });
      const history =
        phone && !context.synthetic
          ? await tx.callCenterCall.findMany({
              where: { contactId: contact.id, origin: { not: 'SYNTHETIC' } },
              orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
              take: 25,
            })
          : [];
      const profile = callContactPrefill(
        history.map((call) => this.calls.presentCall(call)),
      );
      const payload = {
        phone,
        name: profile.name,
        subject: '',
        source: profile.source,
        operator:
          event.direction === 'OUT' && event.extension
            ? `داخلی ${event.extension}`
            : '',
        note: '',
        ...(event.direction === 'OUT' && event.extension && this.answerDirectory
          ? {
              answerRecipient: {
                ...(await this.answerDirectory.resolve(
                  context.branchId,
                  event.extension,
                  event.occurredAt,
                  tx,
                  event.connectionId,
                )),
                answeredAt: null,
                observedAt: event.occurredAt,
              },
            }
          : {}),
      };
      await tx.callCenterCall.create({
        data: {
          id: callId,
          contactId: contact.id,
          createdByUserId: context.creatorId,
          direction: event.direction === 'IN' ? 'INBOUND' : 'OUTBOUND',
          status: 'جدید',
          origin: context.synthetic ? 'SYNTHETIC' : 'TELEPHONY',
          occurredAt,
          encryptedPayload: this.crypto.encrypt(
            payload,
            `call:${callId}:${contact.id}`,
          ),
          keyVersion: this.crypto.keyVersion,
          requestFingerprint: rootFingerprint,
          ...callSearchMetadata(this.crypto, context.branchId, payload, null),
          needsCompletion: true,
        },
      });
      row = await tx.callCenterTelephonySession.create({
        data: {
          id,
          connectionId: event.connectionId,
          rootFingerprint,
          callId,
          state: technical.state,
          encryptedTechnical: this.crypto.encrypt(technical, `telephony:${id}`),
          keyVersion: this.crypto.keyVersion,
          synthetic: context.synthetic,
        },
      });
    } else {
      if (
        previous &&
        technical.first.occurredAt !== previous.first.occurredAt
      ) {
        const call = await tx.callCenterCall.update({
          where: { id: row.callId },
          data: { occurredAt: new Date(technical.first.occurredAt) },
          select: { contactId: true },
        });
        // Correct the contact ordering after a delayed earlier ring, without
        // rewriting operator-entered business data or inventing a call outcome.
        await tx.$queryRaw`SELECT id FROM customer_affairs_call_contacts WHERE id=${call.contactId}::uuid FOR UPDATE`;
        const latest = await tx.callCenterCall.aggregate({
          where: { contactId: call.contactId },
          _max: { occurredAt: true },
        });
        if (latest._max.occurredAt)
          await tx.callCenterContact.update({
            where: { id: call.contactId },
            data: { latestOccurredAt: latest._max.occurredAt },
          });
      }
      row = await tx.callCenterTelephonySession.update({
        where: { id: row.id },
        data: {
          state: technical.state,
          encryptedTechnical: this.crypto.encrypt(
            technical,
            `telephony:${row.id}`,
          ),
          version: { increment: 1 },
        },
      });
    }
    if (
      this.answerDirectory &&
      technical.lastAnswer &&
      technical.lastAnswer.at !== previous?.lastAnswer?.at
    ) {
      const call = await tx.callCenterCall.findUniqueOrThrow({
        where: { id: row.callId },
      });
      const old = this.calls.presentCall(call);
      const answerRecipient = await this.answerDirectory.resolve(
        context.branchId,
        technical.lastAnswer.extension,
        technical.lastAnswer.at,
        tx,
        event.connectionId,
      );
      const payload = {
        phone: old.phone,
        name: old.name,
        subject: old.subject,
        source: old.source,
        note: old.note,
        operator: `داخلی ${answerRecipient.extension}`,
        answerRecipient,
      };
      await tx.callCenterCall.update({
        where: { id: row.callId },
        data: {
          encryptedPayload: this.crypto.encrypt(
            payload,
            `call:${row.callId}:${call.contactId}`,
          ),
          keyVersion: this.crypto.keyVersion,
        },
      });
    }
    // Only provider-confirmed unanswered facts affect the business list. A late
    // answer retracts our provisional label, but never an operator's saved result.
    const operatorSaved =
      (technical.unanswered || technical.answered) &&
      (await tx.customerAffairsAuditEvent.findFirst({
        where: {
          entityId: { in: [row.id, row.callId] },
          action: { in: ['COMPLETE_CALL', 'SAVE'] },
        },
        select: { id: true },
      }));
    if (
      !row.completed &&
      (!operatorSaved || !technical.answered) &&
      (technical.unanswered || technical.answered)
    ) {
      await tx.callCenterCall.updateMany({
        where: {
          id: row.callId,
          outcome: technical.answered ? 'NO_ANSWER' : null,
        },
        data: technical.answered
          ? { outcome: null, status: 'جدید' }
          : {
              outcome: 'NO_ANSWER',
              status: 'بدون پاسخ',
              needsCompletion: true,
            },
      });
    }
    // Never offer a terminal/stale ring; mapping snapshots are not retroactively rewritten.
    if (
      context.recipient &&
      technical.state !== 'ENDED' &&
      ['RINGING', 'ANSWERED', 'TRANSFERRED'].includes(event.kind)
    ) {
      if (
        await this.directory.eligibleMapping(
          context.branchId,
          context.recipient.userId,
          context.recipient.teamId ?? null,
          tx,
        )
      )
        await tx.callCenterTelephonyOffer.upsert({
          where: {
            sessionId_userId: {
              sessionId: row.id,
              userId: context.recipient.userId,
            },
          },
          create: {
            sessionId: row.id,
            userId: context.recipient.userId,
            mappingVersion: context.recipient.version,
          },
          update: {},
        });
    }
    // End-only events still need authorized business completion.
    if (
      !previous &&
      context.recipient &&
      technical.state === 'ENDED' &&
      (await this.directory.eligibleMapping(
        context.branchId,
        context.recipient.userId,
        context.recipient.teamId ?? null,
        tx,
      ))
    )
      await tx.callCenterTelephonyOffer.create({
        data: {
          sessionId: row.id,
          userId: context.recipient.userId,
          mappingVersion: context.recipient.version,
        },
      });
    return row.id;
  }
  private async reviewScope(
    branchIds: readonly string[],
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.CallCenterTelephonySessionWhereInput> {
    const branches = await Promise.all(
      branchIds.map(async (branchId) => {
        const eligible = (await this.directory.list(branchId, tx)).map(
          (u) => u.id,
        );
        return {
          call: { contact: { branchId } },
          OR: [
            {
              claimUserId: null,
              offers: { none: { active: true, userId: { in: eligible } } },
            },
            { claimUserId: { not: null, notIn: eligible } },
          ],
        };
      }),
    );
    return { completed: false, OR: branches };
  }
  async review(branchIds: readonly string[]) {
    return this.db.client.callCenterTelephonySession.findMany({
      where: await this.reviewScope(branchIds),
      select: {
        id: true,
        version: true,
        state: true,
        synthetic: true,
        call: {
          select: { occurredAt: true, contact: { select: { branchId: true } } },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 50,
    });
  }
  async routeReview(
    actor: AuthenticatedActor,
    id: string,
    userId: string,
    version: number,
  ) {
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM call_center_telephony_sessions WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.callCenterTelephonySession.findFirst({
        where: {
          id,
          version,
          ...(await this.reviewScope(actor.branchIds, tx)),
        },
        include: { call: { include: { contact: true } } },
      });
      if (!row) throw new ConflictException();
      await this.directory.resolve(tx, row.call.contact.branchId, userId);
      await tx.callCenterTelephonyOffer.updateMany({
        where: { sessionId: id },
        data: { active: false },
      });
      await tx.callCenterTelephonyOffer.upsert({
        where: { sessionId_userId: { sessionId: id, userId } },
        create: { sessionId: id, userId, mappingVersion: 0 },
        update: { active: true },
      });
      await tx.callCenterTelephonySession.update({
        where: { id },
        data: { claimUserId: null, version: { increment: 1 } },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: row.call.contact.branchId,
          actorUserId: actor.userId,
          entityType: 'TELEPHONY_CALL',
          entityId: id,
          action: 'ROUTE_REVIEW',
          version: version + 1,
        },
      });
      return { ok: true };
    });
  }
  async history(actor: AuthenticatedActor, id: string) {
    const row = await this.db.client.callCenterTelephonySession.findFirst({
      where: { id, ...this.scope(actor) },
      select: { call: { select: { contactId: true, id: true } } },
    });
    if (!row) throw new NotFoundException();
    // A trusted offer authorizes this call, not the customer's historical dossier.
    if (this.calls.access.scoped(actor))
      await this.calls.access.contact(
        actor,
        (
          await this.db.client.callCenterContact.findUniqueOrThrow({
            where: { id: row.call.contactId },
          })
        ).branchId,
        row.call.contactId,
      );
    const calls = await this.db.client.callCenterCall.findMany({
      where: { contactId: row.call.contactId, id: { not: row.call.id } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
    return { data: calls.map((c) => this.calls.presentSummary(c)) };
  }
  /** Public media authorization: Integrations never queries Customer Affairs tables. */
  async callRecordingContext(
    actor: AuthenticatedActor,
    callId: string,
    tx: Prisma.TransactionClient = this.db.client,
  ) {
    if (
      !actor.permissions.includes(
        'customer_affairs.call_center.recordings.read',
      )
    )
      throw new ForbiddenException();
    const call = await tx.callCenterCall.findFirst({
      where: {
        id: callId,
        contact: { branchId: { in: [...actor.branchIds] } },
      },
      select: {
        id: true,
        contactId: true,
        contact: { select: { branchId: true } },
      },
    });
    if (!call) throw new NotFoundException();
    await this.calls.access.contact(
      actor,
      call.contact.branchId,
      call.contactId,
      'contacts',
      tx,
    );
    const session = await tx.callCenterTelephonySession.findUnique({
      where: { callId },
    });
    if (!session) return null;
    const technical = this.crypto.decrypt<TelephonyTechnical>(
      session.encryptedTechnical,
      session.keyVersion,
      `telephony:${session.id}`,
    );
    return {
      connectionId: session.connectionId,
      rootFingerprint: session.rootFingerprint,
      references: technical.recordings,
    };
  }
  async authorizeRecording(
    actor: AuthenticatedActor,
    connectionId: string,
    rootFingerprint: string,
    reference: string,
    tx: Prisma.TransactionClient = this.db.client,
  ) {
    this.authorize(actor);
    if (
      !actor.permissions.includes(
        'customer_affairs.call_center.recordings.read',
      )
    )
      throw new ForbiddenException();
    const session = await tx.callCenterTelephonySession.findFirst({
      where: { ...this.scope(actor), connectionId, rootFingerprint },
      select: { id: true, encryptedTechnical: true, keyVersion: true },
    });
    if (!session) throw new NotFoundException();
    const technical = this.crypto.decrypt<TelephonyTechnical>(
      session.encryptedTechnical,
      session.keyVersion,
      `telephony:${session.id}`,
    );
    if (!technical.recordings.includes(reference))
      throw new NotFoundException();
    return { sessionId: session.id };
  }
  private scope(
    actor: AuthenticatedActor,
  ): Prisma.CallCenterTelephonySessionWhereInput {
    this.authorize(actor);
    return {
      call: { contact: { branchId: { in: [...actor.branchIds] } } },
      offers: { some: { userId: actor.userId, active: true } },
      OR: [{ claimUserId: null }, { claimUserId: actor.userId }],
    };
  }
  async snapshot(actor: AuthenticatedActor, page = 1) {
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException();
    const where = { ...this.scope(actor), completed: false };
    const [rows, total, incoming] = await this.db.client.$transaction([
      this.db.client.callCenterTelephonySession.findMany({
        where,
        include: {
          call: { include: { contact: true } },
          offers: { where: { userId: actor.userId } },
        },
        orderBy: [{ call: { occurredAt: 'asc' } }, { id: 'asc' }],
        take: 25,
        skip: (page - 1) * 25,
      }),
      this.db.client.callCenterTelephonySession.count({ where }),
      this.db.client.callCenterTelephonySession.findMany({
        where: {
          ...where,
          offers: {
            some: { userId: actor.userId, active: true, deferred: false },
          },
        },
        include: {
          call: { include: { contact: true } },
          offers: { where: { userId: actor.userId } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 25,
      }),
    ]);
    const present = (row: (typeof rows)[number]) => {
      const t = this.crypto.decrypt<TelephonyTechnical>(
        row.encryptedTechnical,
        row.keyVersion,
        `telephony:${row.id}`,
      );
      return {
        id: row.id,
        callId: row.callId,
        branchId: row.call.contact.branchId,
        version: row.version,
        state: row.state,
        synthetic: row.synthetic,
        claimed: row.claimUserId === actor.userId,
        deferred: row.offers[0]?.deferred ?? false,
        call: this.calls.presentCall(row.call),
        technical: {
          caller: t.first.caller,
          callerName:
            t.first.direction === 'IN' ? (t.first.callerName ?? null) : null,
          destination: t.first.destination,
          extension: t.lastAnswer?.extension ?? t.first.extension,
          occurredAt: t.first.occurredAt,
          receivedAt: t.receivedAt,
          legs: Object.keys(t.legs).length,
          recordingCount: t.recordings.length,
        },
      };
    };
    return {
      data: rows.map(present),
      incoming: incoming.map(present),
      meta: {
        total,
        page,
        pageSize: 25,
        receivedAt: new Date().toISOString(),
        delivery: 'AUTHENTICATED_POLLING',
        provider: 'NOT_CONNECTED',
      },
    };
  }
  async read(actor: AuthenticatedActor, id: string) {
    const row = await this.db.client.callCenterTelephonySession.findFirst({
      where: { id, ...this.scope(actor) },
      include: { call: { include: { contact: true } } },
    });
    if (!row) throw new NotFoundException();
    let canLinkRequests = true;
    if (this.calls.access.scoped(actor)) {
      try {
        await this.calls.access.contact(
          actor,
          row.call.contact.branchId,
          row.call.contactId,
          'workflow',
        );
      } catch (error) {
        if (!(
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        ))
          throw error;
        canLinkRequests = false;
      }
    }
    return {
      call: this.calls.presentCall(row.call),
      version: row.version,
      claimed: row.claimUserId === actor.userId,
      canLinkRequests,
    };
  }
  async lease(actor: AuthenticatedActor, tabId: string, release = false) {
    this.authorize(actor, true);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'telephony:lease:' + actor.userId},0))`;
      const current = await tx.callCenterTelephonyLease.findUnique({
        where: { userId: actor.userId },
      });
      const now = new Date();
      if (release) {
        await tx.callCenterTelephonyLease.deleteMany({
          where: { userId: actor.userId, tabId },
        });
        return { leader: false };
      }
      if (current && current.tabId !== tabId && current.expiresAt > now)
        return { leader: false };
      await tx.callCenterTelephonyLease.upsert({
        where: { userId: actor.userId },
        create: {
          userId: actor.userId,
          tabId,
          expiresAt: new Date(now.getTime() + 10000),
        },
        update: { tabId, expiresAt: new Date(now.getTime() + 10000) },
      });
      return { leader: true };
    });
  }
  async action(
    actor: AuthenticatedActor,
    id: string,
    input: {
      version: number;
      action: 'CLAIM' | 'DEFER' | 'SAVE' | 'TRANSFER';
      tabId: string;
      subject?: string;
      name?: string;
      note?: string;
      source?: string;
      operator?: string;
      outcome?: string;
      ticketId?: string;
      targetUserId?: string;
    },
  ) {
    this.authorize(actor, true);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM call_center_telephony_sessions WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.callCenterTelephonySession.findFirst({
        where: { id, ...this.scope(actor) },
        include: { call: { include: { contact: true } } },
      });
      if (!row) throw new NotFoundException();
      if (row.version !== input.version)
        throw new ConflictException(
          'اطلاعات تماس تغییر کرده است؛ دوباره بررسی کنید.',
        );
      const lease = await tx.callCenterTelephonyLease.findUnique({
        where: { userId: actor.userId },
      });
      if (!lease || lease.tabId !== input.tabId || lease.expiresAt < new Date())
        throw new ConflictException('پنجره دیگری مسئول دریافت تماس است.');
      if (input.action === 'CLAIM') {
        await tx.callCenterTelephonySession.update({
          where: { id },
          data: { claimUserId: actor.userId, version: { increment: 1 } },
        });
      } else if (input.action === 'DEFER') {
        await tx.callCenterTelephonyOffer.update({
          where: { sessionId_userId: { sessionId: id, userId: actor.userId } },
          data: { deferred: true },
        });
      } else {
        if (row.claimUserId !== actor.userId)
          throw new ConflictException('ابتدا رسیدگی به تماس را بپذیرید.');
        if (input.action === 'TRANSFER') {
          // New expert access is not a routing/assignment authority.
          if (
            hasScopedCallCenterAccess(actor.permissions) &&
            !actor.permissions.includes(
              'customer_affairs.call_center.workflow.manage.team',
            )
          )
            throw new ForbiddenException();
          if (!input.targetUserId || input.targetUserId === actor.userId)
            throw new BadRequestException();
          await this.directory.resolve(
            tx,
            row.call.contact.branchId,
            input.targetUserId,
          );
          if (hasScopedCallCenterAccess(actor.permissions))
            await this.calls.access.recipient(
              actor,
              row.call.contact.branchId,
              input.targetUserId,
              tx,
            );
          await tx.callCenterTelephonyOffer.updateMany({
            where: { sessionId: id },
            data: { active: false },
          });
          await tx.callCenterTelephonyOffer.upsert({
            where: {
              sessionId_userId: { sessionId: id, userId: input.targetUserId },
            },
            create: {
              sessionId: id,
              userId: input.targetUserId,
              mappingVersion: 0,
            },
            update: { active: true, deferred: false },
          });
          await tx.callCenterTelephonySession.update({
            where: { id },
            data: { claimUserId: null, version: { increment: 1 } },
          });
        } else {
          if (
            !actor.permissions.includes(
              'customer_affairs.call_center.calls.create',
            )
          )
            throw new ForbiddenException();
          if (!input.subject?.trim())
            throw new BadRequestException('موضوع را وارد کنید.');
          const old = this.calls.presentCall(row.call);
          if (
            (input.source !== undefined && !input.source.trim()) ||
            (input.operator !== undefined && !input.operator.trim())
          )
            throw new BadRequestException('اطلاعات تماس را کامل کنید.');
          if (input.ticketId) {
            if (this.calls.access.scoped(actor))
              await this.calls.access.request(
                actor,
                row.call.contact.branchId,
                input.ticketId,
                tx,
              );
            await tx.$queryRaw`SELECT id FROM customer_affairs_tickets WHERE id=${input.ticketId}::uuid FOR SHARE`;
            if (
              !(await tx.customerAffairsTicket.findFirst({
                where: {
                  id: input.ticketId,
                  branchId: row.call.contact.branchId,
                  callCenterContactId: row.call.contactId,
                  category: 'CALL_CENTER_REQUEST',
                  status: { not: 'CLOSED' },
                },
              }))
            )
              throw new BadRequestException(
                'درخواست باز و متعلق به همین مخاطب را انتخاب کنید.',
              );
          }
          const outcome = input.outcome ?? row.call.outcome;
          const payload = {
            phone: old.phone,
            name: input.name?.trim() ?? '',
            subject: input.subject.trim(),
            source: input.source?.trim() ?? old.source,
            operator: old.answerRecipient
              ? old.operator
              : (input.operator?.trim() ?? old.operator),
            ...(old.answerRecipient
              ? { answerRecipient: old.answerRecipient }
              : {}),
            note: input.note?.trim() ?? '',
          };
          await tx.callCenterCall.update({
            where: { id: row.callId },
            data: {
              outcome,
              ticketId: input.ticketId ?? row.call.ticketId,
              status:
                outcome === 'NO_ANSWER'
                  ? 'بدون پاسخ'
                  : row.call.status === 'بدون پاسخ'
                    ? 'جدید'
                    : row.call.status,
              encryptedPayload: this.crypto.encrypt(
                payload,
                `call:${row.callId}:${row.call.contactId}`,
              ),
              ...callSearchMetadata(
                this.crypto,
                row.call.contact.branchId,
                payload,
                outcome,
              ),
            },
          });
          await tx.callCenterTelephonySession.update({
            where: { id },
            data: {
              completed: !callSearchMetadata(
                this.crypto,
                row.call.contact.branchId,
                payload,
                outcome,
              ).needsCompletion,
              version: { increment: 1 },
            },
          });
        }
      }
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: row.call.contact.branchId,
          actorUserId: actor.userId,
          entityType: 'TELEPHONY_CALL',
          entityId: id,
          action: input.action,
          version: row.version + 1,
        },
      });
      return { ok: true };
    });
  }
}
