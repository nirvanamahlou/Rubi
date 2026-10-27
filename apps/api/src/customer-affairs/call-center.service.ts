import type { CallAnswerRecipient } from '../hr/hr-call-answer-directory';
import { callSearchMetadata } from './call-center-search';
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
  type AuthenticatedActor,
  type IamPermissionCode,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { CallCenterCrypto } from './call-center.crypto';
import { CallCenterAccessService } from './call-center-access.service';
import { HrCallAnswerDirectory } from '../hr/hr-call-answer-directory';
import type { TelephonyTechnical } from './telephony-state';
import type {
  CallCenterCallDto,
  CallCenterListDto,
  CallCenterNoteDto,
} from './call-center.dto';

export function normalizedCallPhone(value: string) {
  let phone = value
    .trim()
    .replace(/[۰-۹]/g, (n) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)))
    .replace(/[٠-٩]/g, (n) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n)))
    .replace(/[\s()-]/g, '');
  if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  if (/^98\d{10}$/.test(phone)) phone = '0' + phone.slice(2);
  if (/^9\d{9}$/.test(phone)) phone = '0' + phone;
  if (!/^(?:\d{1,15}|\+[1-9]\d{1,14})$/.test(phone))
    throw new BadRequestException('شماره تماس معتبر نیست.');
  return phone;
}
type PrivateCall = Pick<
  CallCenterCallDto,
  'phone' | 'name' | 'subject' | 'source' | 'operator' | 'note'
> & { answerRecipient?: CallAnswerRecipient };
type StoredCall = Prisma.CallCenterCallGetPayload<Record<string, never>>;
type StoredNote = Prisma.CallCenterNoteGetPayload<Record<string, never>>;

@Injectable()
export class CallCenterService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(CallCenterCrypto) private readonly crypto: CallCenterCrypto,
    @Inject(CallCenterAccessService)
    readonly access: CallCenterAccessService = new CallCenterAccessService(
      database,
      undefined as never,
    ),
    @Inject(HrCallAnswerDirectory)
    private readonly answerDirectory: HrCallAnswerDirectory = new HrCallAnswerDirectory(
      database,
    ),
  ) {}

  async destinationOptions(
    actor: AuthenticatedActor,
    requested: string | undefined,
  ) {
    const branchId = this.branch(
      actor,
      requested,
      'customer_affairs.call_center.calls.create',
    );
    await this.access.where(actor, branchId);
    return {
      data: await this.answerDirectory.options(
        branchId,
        process.env.ISSABEL_CONNECTION_ID,
      ),
    };
  }

  private branch(
    actor: AuthenticatedActor,
    requested: string | undefined,
    permission: IamPermissionCode,
  ) {
    if (
      !actor.permissions.includes(permission) ||
      !canViewRoute(actor.permissions, '/customer-affairs/call-center')
    )
      throw new ForbiddenException('دسترسی کال سنتر مجاز نیست.');
    const branch = requested ?? actor.branchIds[0];
    if (!branch || !actor.branchIds.includes(branch))
      throw new ForbiddenException('شعبه خارج از دامنه دسترسی است.');
    return branch;
  }
  presentCall(row: StoredCall) {
    return {
      ...this.crypto.decrypt<PrivateCall>(
        row.encryptedPayload,
        row.keyVersion,
        `call:${row.id}:${row.contactId}`,
      ),
      id: row.id,
      contactId: row.contactId,
      direction: row.direction,
      status: row.status,
      occurredAt: row.occurredAt.toISOString(),
      ticketId: row.ticketId,
      outcome: row.outcome,
      needsCompletion: row.needsCompletion,
      completionToken: this.crypto.fingerprint(
        JSON.stringify([row.id, row.encryptedPayload, row.outcome, row.status]),
      ),
      origin: row.origin,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      recordings: [],
    };
  }
  presentSummary(row: StoredCall) {
    const call = this.presentCall(row);
    return {
      id: call.id,
      contactId: call.contactId,
      name: row.origin === 'SYNTHETIC' ? `آزمایشی · ${call.name}` : call.name,
      phone: call.phone,
      subject: call.subject,
      source: call.source,
      operator: call.operator,
      ...(call.answerRecipient
        ? { answerRecipient: call.answerRecipient }
        : {}),
      direction: call.direction,
      status: call.status,
      outcome: call.outcome,
      needsCompletion: call.needsCompletion,
      completionToken: call.completionToken,
      origin: call.origin,
      occurredAt: call.occurredAt,
      ticketId: call.ticketId,
    };
  }
  /** Read-only repair of legacy outbound display; recorded identity snapshots win. */
  async hydrateDestinations<
    T extends {
      id: string;
      origin: string | null;
      direction: string;
      answerRecipient?: CallAnswerRecipient;
    },
  >(
    branchId: string,
    calls: T[],
    tx?: Prisma.TransactionClient,
  ): Promise<(T & { answerRecipient?: CallAnswerRecipient })[]> {
    const missing = calls.filter(
      (call) =>
        call.origin === 'TELEPHONY' &&
        call.direction === 'OUTBOUND' &&
        (!call.answerRecipient ||
          call.answerRecipient.label ===
            `داخلی ${call.answerRecipient.extension}`),
    );
    if (!missing.length) return calls;
    const sessions = await (
      tx ?? this.database.client
    ).callCenterTelephonySession.findMany({
      where: {
        call: { contact: { branchId } },
        callId: { in: missing.map((call) => call.id) },
      },
    });
    const results = new Map<string, CallAnswerRecipient>();
    const labels = new Map<
      string,
      Awaited<ReturnType<HrCallAnswerDirectory['resolve']>>
    >();
    for (const call of missing) {
      const matches = sessions.filter((session) => session.callId === call.id);
      if (matches.length !== 1) continue;
      const session = matches[0]!;
      const technical = this.crypto.decrypt<TelephonyTechnical>(
        session.encryptedTechnical,
        session.keyVersion,
        `telephony:${session.id}`,
      );
      if (technical.first.direction !== 'OUT') continue;
      const extension =
        call.answerRecipient?.extension ?? technical.first.extension;
      if (!extension || !/^\d{1,16}$/.test(extension)) continue;
      // Never derive a person from an editable operator label or a different call leg.
      if (
        extension !== technical.first.extension &&
        extension !== technical.lastAnswer?.extension
      )
        continue;
      const observedAt = technical.first.occurredAt;
      const key = `${session.connectionId}:${extension}`;
      let recipient = labels.get(key);
      if (!recipient) {
        recipient = await this.answerDirectory.resolve(
          branchId,
          extension,
          observedAt,
          tx,
          session.connectionId,
        );
        labels.set(key, recipient);
      }
      if (recipient.label === `داخلی ${extension}`) continue;
      results.set(call.id, {
        ...recipient,
        answeredAt:
          call.answerRecipient?.answeredAt ??
          (technical.lastAnswer?.extension === extension
            ? technical.lastAnswer.at
            : null),
        observedAt,
        labelSource: 'CURRENT_DIRECTORY',
      });
    }
    return calls.map((call) =>
      results.has(call.id)
        ? { ...call, answerRecipient: results.get(call.id)! }
        : call,
    );
  }
  presentNote(row: StoredNote) {
    return {
      id: row.id,
      contactId: row.contactId,
      text: this.crypto.decrypt<{ text: string }>(
        row.encryptedPayload,
        row.keyVersion,
        `note:${row.id}:${row.contactId}`,
      ).text,
      at: row.createdAt.toISOString(),
      actorUserId: row.createdByUserId,
    };
  }
  async list(
    actor: AuthenticatedActor,
    requested: string | undefined,
    query: CallCenterListDto,
  ) {
    const branchId = this.branch(
      actor,
      requested,
      'customer_affairs.call_center.read',
    );
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 50;
    const where = await this.access.where(actor, branchId);
    const [total, contacts] = await this.database.client.$transaction(
      [
        this.database.client.callCenterContact.count({ where }),
        this.database.client.callCenterContact.findMany({
          where,
          orderBy: [{ latestOccurredAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            calls: {
              orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
              take: 1,
            },
            _count: { select: { calls: true, notes: true } },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      data: contacts.map((contact) => ({
        id: contact.id,
        calls: contact.calls.map((call) => this.presentCall(call)),
        notes: [],
        callCount: contact._count.calls,
        noteCount: contact._count.notes,
      })),
      meta: { branchId, total, page, pageSize },
    };
  }
  async getCall(id: string, actor: AuthenticatedActor, requested?: string) {
    const branchId = this.branch(
      actor,
      requested,
      'customer_affairs.call_center.read',
    );
    const row = await this.database.client.callCenterCall.findFirst({
      where: { id, contact: await this.access.where(actor, branchId) },
    });
    if (!row) throw new NotFoundException();
    return {
      data: (
        await this.hydrateDestinations(branchId, [this.presentCall(row)])
      )[0]!,
    };
  }
  async create(
    input: CallCenterCallDto,
    actor: AuthenticatedActor,
    requested?: string,
  ) {
    const branchId = this.branch(
      actor,
      requested,
      'customer_affairs.call_center.calls.create',
    );
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime()))
      throw new BadRequestException('زمان تماس معتبر نیست.');
    const payload: PrivateCall = {
      phone: input.phone.trim() ? normalizedCallPhone(input.phone) : '',
      name: input.name.trim(),
      subject: input.subject.trim(),
      source: input.source.trim(),
      operator: input.operator.trim(),
      note: input.note.trim(),
    };
    if (!payload.subject || !payload.source || !payload.operator)
      throw new BadRequestException('اطلاعات تماس را کامل کنید.');
    const phoneFingerprint = this.crypto.fingerprint(
      payload.phone || `anonymous:${input.id}`,
    );
    const requestFingerprint = this.crypto.fingerprint(
      JSON.stringify({
        branchId,
        ...(input.outcome ? { outcome: input.outcome } : {}),
        ...(input.ticketId ? { ticketId: input.ticketId } : {}),
        ...payload,
        direction: input.direction,
        status: input.status,
        occurredAt: occurredAt.toISOString(),
      }),
    );
    const row = await this.database.client.$transaction(async (tx) => {
      if (input.completionToken) {
        if (
          !actor.permissions.includes(
            'customer_affairs.call_center.workflow.manage',
          )
        )
          throw new ForbiddenException();
        // Same lock order as the telephony form; preserve technical fields and origin.
        await tx.$queryRaw`SELECT id FROM call_center_telephony_sessions WHERE "callId"=${input.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM customer_affairs_calls WHERE id=${input.id}::uuid FOR UPDATE`;
        const existing = await tx.callCenterCall.findFirst({
          where: {
            id: input.id,
            contact: { branchId },
            origin: { not: 'SYNTHETIC' },
          },
          include: { telephonySession: true },
        });
        if (!existing) throw new NotFoundException();
        if (this.access.scoped(actor))
          await this.access.contact(
            actor,
            branchId,
            existing.contactId,
            'workflow',
            tx,
          );
        const presented = this.presentCall(existing);
        if (
          payload.phone !== presented.phone ||
          input.direction !== existing.direction ||
          occurredAt.getTime() !== existing.occurredAt.getTime()
        )
          throw new BadRequestException('اطلاعات فنی تماس قابل تغییر نیست.');
        const traceId = this.crypto.fingerprint(
          JSON.stringify([input.completionToken, requestFingerprint]),
        );
        const replay = await tx.customerAffairsAuditEvent.findFirst({
          where: {
            entityId: input.id,
            action: 'COMPLETE_CALL',
            actorUserId: actor.userId,
            traceId,
          },
        });
        if (replay) return existing;
        if (presented.completionToken !== input.completionToken)
          throw new ConflictException(
            'اطلاعات تماس تغییر کرده است؛ دوباره بررسی کنید.',
          );
        if (
          existing.telephonySession?.claimUserId &&
          existing.telephonySession.claimUserId !== actor.userId
        )
          throw new ConflictException(
            'کارشناس دیگری مسئول تکمیل این تماس است.',
          );
        if (input.ticketId) {
          if (this.access.scoped(actor))
            await this.access.request(actor, branchId, input.ticketId, tx);
          await tx.$queryRaw`SELECT id FROM customer_affairs_tickets WHERE id=${input.ticketId}::uuid FOR SHARE`;
          const ticket = await tx.customerAffairsTicket.findFirst({
            where: {
              id: input.ticketId,
              branchId,
              callCenterContactId: existing.contactId,
              category: 'CALL_CENTER_REQUEST',
              status: { not: 'CLOSED' },
            },
          });
          if (!ticket)
            throw new BadRequestException(
              'درخواست باز و متعلق به همین مخاطب را انتخاب کنید.',
            );
        }
        if (presented.answerRecipient) {
          payload.operator = presented.operator;
          payload.answerRecipient = presented.answerRecipient;
        }
        const outcome = input.outcome ?? existing.outcome;
        const metadata = callSearchMetadata(
          this.crypto,
          branchId,
          payload,
          outcome,
        );
        const saved = await tx.callCenterCall.update({
          where: { id: input.id },
          data: {
            ...metadata,
            outcome,
            ticketId: input.ticketId ?? existing.ticketId,
            encryptedPayload: this.crypto.encrypt(
              payload,
              `call:${input.id}:${existing.contactId}`,
            ),
            keyVersion: this.crypto.keyVersion,
            status:
              outcome === 'NO_ANSWER'
                ? 'بدون پاسخ'
                : existing.status === 'بدون پاسخ'
                  ? 'جدید'
                  : existing.status,
          },
        });
        await tx.callCenterTelephonySession.updateMany({
          where: { callId: input.id },
          data: {
            completed: !metadata.needsCompletion,
            version: { increment: 1 },
          },
        });
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId,
            actorUserId: actor.userId,
            entityType: 'CALL_CENTER_CALL',
            entityId: input.id,
            action: 'COMPLETE_CALL',
            version: (existing.telephonySession?.version ?? 0) + 1,
            traceId,
          },
        });
        return saved;
      }
      // Serialize the stable event ID, including conflicting retries from another phone/branch.
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'call-center:call:' + input.id},0))`,
      );
      const prior = await tx.callCenterCall.findUnique({
        where: { id: input.id },
        include: { contact: true },
      });
      if (prior) {
        if (
          prior.createdByUserId !== actor.userId ||
          prior.contact.branchId !== branchId ||
          prior.requestFingerprint !== requestFingerprint
        )
          throw new ConflictException(
            'شناسه تماس قبلاً برای اطلاعات دیگری استفاده شده است.',
          );
        if (this.access.scoped(actor))
          await this.access.contact(
            actor,
            branchId,
            prior.contactId,
            'contacts',
            tx,
          );
        return prior;
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'call-center:phone:' + branchId + ':' + phoneFingerprint},0))`,
      );
      const priorContact = await tx.callCenterContact.findUnique({
        where: { branchId_phoneFingerprint: { branchId, phoneFingerprint } },
      });
      const contact = await tx.callCenterContact.upsert({
        where: { branchId_phoneFingerprint: { branchId, phoneFingerprint } },
        create: {
          branchId,
          phoneFingerprint,
          latestOccurredAt: occurredAt,
          ownerUserId: this.access.scoped(actor) ? actor.userId : null,
          ownerVersion: this.access.scoped(actor) ? 1 : 0,
        },
        update: {},
      });
      if (this.access.scoped(actor))
        await this.access.contact(actor, branchId, contact.id, 'contacts', tx);
      if (!priorContact && this.access.scoped(actor))
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId,
            actorUserId: actor.userId,
            entityType: 'CALL_CENTER_CONTACT',
            entityId: contact.id,
            action: 'OWNER_ASSIGNED',
            version: 1,
            afterSnapshot: {
              previousOwnerUserId: null,
              ownerUserId: actor.userId,
            },
          },
        });
      if (occurredAt > contact.latestOccurredAt)
        await tx.callCenterContact.update({
          where: { id: contact.id },
          data: { latestOccurredAt: occurredAt },
        });
      if (input.ticketId) {
        await tx.$queryRaw`SELECT id FROM customer_affairs_tickets WHERE id = ${input.ticketId}::uuid FOR SHARE`;
        const ticket = await tx.customerAffairsTicket.findFirst({
          where: {
            id: input.ticketId,
            branchId,
            callCenterContactId: contact.id,
            category: 'CALL_CENTER_REQUEST',
          },
        });
        if (!ticket)
          throw new NotFoundException('درخواست متعلق به این مخاطب نیست.');
        if (ticket.status === 'CLOSED')
          throw new BadRequestException(
            'درخواست بسته است؛ درخواست جدید بسازید یا آن را بازگشایی کنید.',
          );
      }
      const call = await tx.callCenterCall.create({
        data: {
          id: input.id,
          ...callSearchMetadata(this.crypto, branchId, payload, input.outcome),
          ticketId: input.ticketId ?? null,
          outcome: input.outcome ?? null,
          origin: 'MANUAL',
          contactId: contact.id,
          createdByUserId: actor.userId,
          direction: input.direction,
          status: input.status,
          occurredAt,
          encryptedPayload: this.crypto.encrypt(
            payload,
            `call:${input.id}:${contact.id}`,
          ),
          keyVersion: this.crypto.keyVersion,
          requestFingerprint,
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId,
          actorUserId: actor.userId,
          entityType: 'CALL_CENTER_CALL',
          entityId: call.id,
          action: 'CREATE',
          version: 1,
        },
      });
      return call;
    });
    return { data: this.presentCall(row) };
  }
  async note(
    contactId: string,
    input: CallCenterNoteDto,
    actor: AuthenticatedActor,
    requested?: string,
  ) {
    const branchId = this.branch(
      actor,
      requested,
      'customer_affairs.call_center.notes.create',
    );
    const text = input.text.trim();
    if (!text) throw new BadRequestException('متن یادداشت را وارد کنید.');
    const requestFingerprint = this.crypto.fingerprint(
      JSON.stringify({ branchId, contactId, text }),
    );
    const row = await this.database.client.$transaction(async (tx) => {
      if (this.access.scoped(actor))
        await this.access.contact(actor, branchId, contactId, 'contacts', tx);
      const contact = await tx.callCenterContact.findFirst({
        where: { id: contactId, branchId },
      });
      if (!contact) throw new NotFoundException('پرونده تماس پیدا نشد.');
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'call-center:note:' + input.id},0))`,
      );
      const prior = await tx.callCenterNote.findUnique({
        where: { id: input.id },
      });
      if (prior) {
        if (
          prior.createdByUserId !== actor.userId ||
          prior.contactId !== contactId ||
          prior.requestFingerprint !== requestFingerprint
        )
          throw new ConflictException(
            'شناسه یادداشت قبلاً برای اطلاعات دیگری استفاده شده است.',
          );
        return prior;
      }
      const note = await tx.callCenterNote.create({
        data: {
          id: input.id,
          contactId,
          createdByUserId: actor.userId,
          encryptedPayload: this.crypto.encrypt(
            { text },
            `note:${input.id}:${contactId}`,
          ),
          keyVersion: this.crypto.keyVersion,
          requestFingerprint,
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId,
          actorUserId: actor.userId,
          entityType: 'CALL_CENTER_NOTE',
          entityId: note.id,
          action: 'CREATE',
          version: 1,
        },
      });
      return note;
    });
    return { data: this.presentNote(row) };
  }
}
