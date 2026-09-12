import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerAffairsDashboard,
  CustomerAffairsLeadInput,
  CustomerAffairsLeadStage,
  CustomerAffairsLeadView,
  CustomerAffairsTicketInput,
  CustomerAffairsTicketView,
  CustomerAffairsTimelineInput,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';

import { CustomerService } from '../customers/customer.service';
import { DocumentsService } from '../documents/documents.service';
import { SalesService } from '../sales/sales.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import {
  canTransitionLead,
  canTransitionTicket,
  evaluateQualification,
} from './customer-affairs.domain';
import {
  type CustomerAffairsLeadRow,
  CustomerAffairsRepository,
  type CustomerAffairsTicketRow,
} from './customer-affairs.repository';
import type {
  CorrectiveActionDto,
  HandoffResponseDto,
  LeadTransitionDto,
  ListQueryDto,
  QualificationDto,
  ReferralDto,
  ReferralResponseDto,
  SatisfactionDto,
  TicketActionDto,
  TicketTransitionDto,
} from './customer-affairs.dto';

const ACTIVE_LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFYING',
  'NURTURE',
  'QUALIFIED',
  'HANDOFF_PROPOSED',
];
const ACTIVE_TICKET_STATUSES = [
  'NEW',
  'TRIAGED',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_EXTERNAL',
  'REOPENED',
];
const SLA_POLICY_VERSION = 'customer-affairs.elapsed-clock.v1';
const SLA_MINUTES: Record<string, { first: number; resolution: number }> = {
  LOW: { first: 480, resolution: 7200 },
  NORMAL: { first: 240, resolution: 4320 },
  HIGH: { first: 60, resolution: 1440 },
  URGENT: { first: 30, resolution: 480 },
  CRITICAL: { first: 15, resolution: 240 },
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function requiredIdempotencyKey(value?: string): string {
  const key = value?.trim();
  if (!key || key.length > 160)
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Idempotency-Key معتبر الزامی است.',
    });
  return key;
}

function branchScope(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException({
      code: 'CUSTOMER_AFFAIRS_BRANCH_FORBIDDEN',
      message: 'شعبه خارج از دامنه دسترسی است.',
    });
  return branchId;
}

function assertRowBranch(actor: AuthenticatedActor, branchId: string): void {
  if (!actor.branchIds.includes(branchId))
    throw new NotFoundException({
      code: 'CUSTOMER_AFFAIRS_NOT_FOUND',
      message: 'رکورد پیدا نشد.',
    });
}

function conflict(): ConflictException {
  return new ConflictException({
    code: 'CONCURRENT_MODIFICATION',
    message: 'رکورد هم‌زمان تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.',
  });
}

function cleanDate(
  value: string | null | undefined,
  label: string,
): Date | null {
  if (!value) return null;
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()))
    throw new BadRequestException(`${label} معتبر نیست.`);
  return result;
}

function presentTimeline(
  row:
    | CustomerAffairsLeadRow['timeline'][number]
    | CustomerAffairsTicketRow['timeline'][number],
) {
  return {
    id: row.id,
    type: row.type,
    outcome: row.outcome,
    summary: row.summary,
    customerVisible: row.customerVisible,
    channel: row.channel,
    recipientReference: row.recipientReference,
    templateVersion: row.templateVersion,
    deliveryStatus: row.deliveryStatus,
    deliveryKey: row.deliveryKey,
    documentVersionIds: row.documentVersionIds,
    actorUserId: row.actorUserId,
    occurredAt: row.occurredAt.toISOString(),
  };
}

function leadInput(row: CustomerAffairsLeadRow): CustomerAffairsLeadInput {
  return {
    title: row.title,
    sourceReference: row.sourceReference,
    inboundChannel:
      row.inboundChannel as CustomerAffairsLeadInput['inboundChannel'],
    contactOccurredAt: row.contactOccurredAt.toISOString(),
    travelNeed: row.travelNeed,
    originReference: row.originReference,
    destinationReference: row.destinationReference,
    travelStart: row.travelStart?.toISOString() ?? null,
    travelEnd: row.travelEnd?.toISOString() ?? null,
    datePrecision: row.datePrecision as NonNullable<
      CustomerAffairsLeadInput['datePrecision']
    >,
    dateFlexibility: row.dateFlexibility,
    passengerCount: row.passengerCount,
    passengerComposition: row.passengerComposition as NonNullable<
      CustomerAffairsLeadInput['passengerComposition']
    >,
    requestedServices: row.requestedServices as string[],
    budget:
      row.currencyCode || row.budgetUnknownReason
        ? {
            minimum: row.budgetMinimum?.toString() ?? null,
            maximum: row.budgetMaximum?.toString() ?? null,
            currencyCode: row.currencyCode,
            basis: row.budgetBasis as 'TOTAL' | 'PER_PERSON' | null,
            unknownReason: row.budgetUnknownReason,
          }
        : null,
    specialPreferences: row.specialPreferences,
    contactFingerprint: row.contactFingerprint,
    customerId: row.customerId,
    priority: row.priority as CustomerAffairsLeadInput['priority'],
    assigneeUserId: row.assigneeUserId,
    queueCode: row.queueCode,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt.toISOString(),
  };
}

function ticketInput(
  row: CustomerAffairsTicketRow,
): CustomerAffairsTicketInput {
  return {
    subject: row.subject,
    description: row.description,
    channel: row.channel as CustomerAffairsTicketInput['channel'],
    contactOccurredAt: row.contactOccurredAt.toISOString(),
    category: row.category,
    serviceType: row.serviceType,
    impact: row.impact as CustomerAffairsTicketInput['impact'],
    urgency: row.urgency as CustomerAffairsTicketInput['urgency'],
    priority: row.priority as CustomerAffairsTicketInput['priority'],
    customerId: row.customerId,
    customerOwnerUserId: row.customerOwnerUserId,
    executionOwnerUserId: row.executionOwnerUserId,
    executionUnit: row.executionUnit,
    references: row.references as unknown as NonNullable<
      CustomerAffairsTicketInput['references']
    >,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt.toISOString(),
  };
}

@Injectable()
export class CustomerAffairsService {
  constructor(
    @Inject(CustomerAffairsRepository)
    private readonly repository: CustomerAffairsRepository,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  async dashboard(
    actor: AuthenticatedActor,
  ): Promise<{ data: CustomerAffairsDashboard }> {
    return { data: await this.repository.dashboard(actor.branchIds) };
  }

  async report(actor: AuthenticatedActor) {
    return { data: await this.repository.report(actor.branchIds) };
  }

  async audit(
    entityType: 'LEAD' | 'TICKET',
    id: string,
    actor: AuthenticatedActor,
  ) {
    if (entityType === 'LEAD') await this.requireLead(id, actor);
    else await this.requireTicket(id, actor);
    const rows = await this.repository.audit(entityType, id, actor.branchIds);
    return {
      data: rows.map((row) => ({
        ...row,
        occurredAt: row.occurredAt.toISOString(),
      })),
    };
  }

  async listLeads(query: ListQueryDto, actor: AuthenticatedActor) {
    const branchIds = query.branchId
      ? [branchScope(actor, query.branchId)]
      : actor.branchIds;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const now = new Date();
    const where: Prisma.CustomerAffairsLeadWhereInput = {
      branchId: { in: branchIds },
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.overdueOnly
        ? { stage: { in: ACTIVE_LEAD_STAGES }, nextActionAt: { lt: now } }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                trackingNumber: { contains: query.search, mode: 'insensitive' },
              },
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                sourceReference: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const result = await this.repository.listLeads(where, page, pageSize);
    return {
      data: await Promise.all(
        result.data.map((row) => this.presentLead(row, actor)),
      ),
      meta: { total: result.total, page, pageSize },
    };
  }

  async getLead(id: string, actor: AuthenticatedActor) {
    const row = await this.requireLead(id, actor);
    return { data: await this.presentLead(row, actor) };
  }

  async createLead(
    input: CustomerAffairsLeadInput,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    idempotencyValue: string | undefined,
    traceId?: string,
  ) {
    const branchId = branchScope(actor, requestedBranch);
    const key = requiredIdempotencyKey(idempotencyValue);
    const hash = fingerprint(input);
    const prior = await this.repository.findLeadCommand(actor.userId, key);
    if (prior) {
      if (prior.requestFingerprint !== hash) throw conflict();
      return this.getLead(prior.resultEntityId, actor);
    }
    if (!input.assigneeUserId && !input.queueCode?.trim())
      throw new BadRequestException({
        code: 'LEAD_ASSIGNMENT_REQUIRED',
        message: 'مالک یا صف سرنخ الزامی است.',
      });
    await this.assertCustomer(input.customerId, actor, traceId);
    this.validateLead(input);
    const trackingNumber = `CA-L-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const id = await this.repository.transaction(async (tx) => {
        const row = await tx.customerAffairsLead.create({
          data: {
            ...this.leadData(input),
            branchId,
            trackingNumber,
            createdByUserId: actor.userId,
            updatedByUserId: actor.userId,
          },
        });
        await tx.customerAffairsTimeline.create({
          data: {
            leadId: row.id,
            type: 'STATUS_CHANGE',
            outcome: 'NEW',
            summary: 'درخواست ثبت شد.',
            actorUserId: actor.userId,
            documentVersionIds: [],
          },
        });
        await tx.customerAffairsCommand.create({
          data: {
            actorUserId: actor.userId,
            scope: 'lead.create',
            idempotencyKey: key,
            requestFingerprint: hash,
            resultEntityId: row.id,
          },
        });
        if (row.assigneeUserId)
          await this.notifications.createWithinTransaction(tx, {
            recipientUserIds: [row.assigneeUserId],
            actorUserId: actor.userId,
            sourceModule: 'customer-affairs',
            eventType: 'lead.assigned',
            title: 'سرنخ جدید',
            message: `${trackingNumber} به شما تخصیص یافت.`,
            entityType: 'customer-affairs-lead',
            entityId: row.id,
            href: `/customer-affairs?lead=${row.id}`,
          });
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId,
            actorUserId: actor.userId,
            entityType: 'LEAD',
            entityId: row.id,
            action: 'CREATE',
            traceId: traceId ?? null,
            version: row.version,
            afterSnapshot: json({
              trackingNumber,
              stage: row.stage,
              assigneeUserId: row.assigneeUserId,
              queueCode: row.queueCode,
            }),
          },
        });
        return row.id;
      });
      return this.getLead(id, actor);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.repository.findLeadBySource(
          branchId,
          input.sourceReference,
        );
        if (existing)
          return {
            data: await this.presentLead(existing, actor),
            meta: { idempotentReplay: true },
          };
      }
      throw error;
    }
  }

  async updateLead(
    id: string,
    input: CustomerAffairsLeadInput,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    const current = await this.requireLead(id, actor);
    const expectedVersion = input.expectedVersion;
    if (!expectedVersion)
      throw new BadRequestException('expectedVersion الزامی است.');
    if (!input.assigneeUserId && !input.queueCode?.trim())
      throw new BadRequestException('مالک یا صف سرنخ الزامی است.');
    await this.assertCustomer(input.customerId, actor, traceId);
    this.validateLead(input);
    const changed = await this.repository.transaction(async (tx) => {
      const result = await tx.customerAffairsLead.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...this.leadData(input),
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw conflict();
      const row = await tx.customerAffairsLead.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'LEAD',
          entityId: id,
          action: 'UPDATE',
          traceId: traceId ?? null,
          version: row.version,
          beforeSnapshot: json({ version: current.version }),
          afterSnapshot: json({ version: row.version }),
        },
      });
      return row;
    });
    return this.getLead(changed.id, actor);
  }

  async addLeadTimeline(
    id: string,
    input: CustomerAffairsTimelineInput,
    actor: AuthenticatedActor,
  ) {
    await this.requireLead(id, actor);
    this.validateTimeline(input);
    const row = await this.repository.transaction(async (tx) =>
      tx.customerAffairsTimeline.create({
        data: this.timelineData(input, actor.userId, { leadId: id }),
      }),
    );
    return { data: presentTimeline(row) };
  }

  async qualify(
    id: string,
    input: QualificationDto,
    actor: AuthenticatedActor,
  ) {
    const current = await this.requireLead(id, actor);
    const qualification = evaluateQualification(
      input,
      new Date().toISOString(),
    );
    const result = await this.repository.transaction(async (tx) => {
      const changed = await tx.customerAffairsLead.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          qualification: json(qualification),
          stage:
            qualification.state === 'QUALIFIED' ? 'QUALIFIED' : 'QUALIFYING',
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      const row = await tx.customerAffairsLead.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          leadId: id,
          type: 'STATUS_CHANGE',
          outcome: row.stage,
          summary: `ارزیابی با امتیاز ${qualification.score} ثبت شد.`,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'LEAD',
          entityId: id,
          action: 'QUALIFY',
          version: row.version,
          afterSnapshot: json(qualification),
        },
      });
      return row;
    });
    return this.getLead(result.id, actor);
  }

  async transitionLead(
    id: string,
    input: LeadTransitionDto,
    actor: AuthenticatedActor,
  ) {
    const current = await this.requireLead(id, actor);
    if (!canTransitionLead(current.stage as never, input.stage as never))
      throw new BadRequestException({
        code: 'LEAD_TRANSITION_INVALID',
        message: 'تغییر مرحله مجاز نیست.',
      });
    if (input.stage === 'LOST' && !input.lostReason)
      throw new BadRequestException('دلیل از دست رفتن الزامی است.');
    const result = await this.repository.transaction(async (tx) => {
      const changed = await tx.customerAffairsLead.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          stage: input.stage,
          lostReason:
            input.stage === 'LOST' ? (input.lostReason ?? null) : null,
          lostNote: input.stage === 'LOST' ? input.reason : null,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      const row = await tx.customerAffairsLead.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          leadId: id,
          type: 'STATUS_CHANGE',
          outcome: input.stage,
          summary: input.reason,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'LEAD',
          entityId: id,
          action: 'TRANSITION',
          reason: input.reason,
          version: row.version,
          beforeSnapshot: json({ stage: current.stage }),
          afterSnapshot: json({ stage: row.stage }),
        },
      });
      return row;
    });
    return this.getLead(result.id, actor);
  }

  async proposeHandoff(
    id: string,
    expectedVersion: number,
    actor: AuthenticatedActor,
    idempotencyValue?: string,
  ) {
    const current = await this.requireLead(id, actor);
    if (current.stage !== 'QUALIFIED' && current.stage !== 'HANDOFF_PROPOSED')
      throw new BadRequestException({
        code: 'LEAD_NOT_QUALIFIED',
        message: 'فقط سرنخ واجد شرایط قابل ارسال است.',
      });
    const key = requiredIdempotencyKey(idempotencyValue);
    const existing = current.handoffs.find(
      (item) => item.idempotencyKey === key,
    );
    if (existing)
      return {
        data: this.presentHandoff(existing),
        meta: { idempotentReplay: true },
      };
    const packageVersion = (current.handoffs[0]?.packageVersion ?? 0) + 1;
    const snapshot = {
      contractVersion: 'customer-affairs.v1',
      lead: leadInput(current),
      qualification: current.qualification,
      sourceLeadVersion: current.version,
    };
    const row = await this.repository.transaction(async (tx) => {
      const changed = await tx.customerAffairsLead.updateMany({
        where: { id, version: expectedVersion },
        data: {
          stage: 'HANDOFF_PROPOSED',
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      const handoff = await tx.customerAffairsHandoff.create({
        data: {
          leadId: id,
          packageVersion,
          idempotencyKey: key,
          requestFingerprint: fingerprint(snapshot),
          payloadSnapshot: json(snapshot),
          dispatchedAt: new Date(),
          createdByUserId: actor.userId,
        },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          leadId: id,
          type: 'REFERRAL',
          outcome: 'WAITING_SALES',
          summary: `بسته نسخه ${packageVersion} برای فروش ارسال شد.`,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'HANDOFF',
          entityId: handoff.id,
          action: 'PROPOSE',
          version: packageVersion,
          afterSnapshot: json({ status: handoff.status }),
        },
      });
      return handoff;
    });
    return { data: this.presentHandoff(row) };
  }

  async respondHandoff(
    handoffId: string,
    input: HandoffResponseDto,
    actor: AuthenticatedActor,
  ) {
    const lead = await this.repository.transaction(async (tx) => {
      const handoff = await tx.customerAffairsHandoff.findUnique({
        where: { id: handoffId },
        include: { lead: true },
      });
      if (!handoff || !actor.branchIds.includes(handoff.lead.branchId))
        throw new NotFoundException('ارجاع فروش پیدا نشد.');
      if (handoff.status !== 'WAITING_SALES') {
        if (
          handoff.status === input.status &&
          handoff.salesContractId === (input.salesContractId ?? null)
        )
          return handoff.lead;
        throw conflict();
      }
      if (input.status === 'ACCEPTED' && !input.salesContractId)
        throw new BadRequestException({
          code: 'SALES_CONTRACT_REQUIRED',
          message: 'پذیرش فروش بدون قرارداد واقعی مجاز نیست.',
        });
      if (input.status === 'ACCEPTED') {
        const contract = await this.sales.detail(input.salesContractId!, actor);
        if (
          handoff.lead.customerId &&
          contract.data.customerId !== handoff.lead.customerId
        )
          throw new BadRequestException({
            code: 'SALES_CONTRACT_CUSTOMER_MISMATCH',
            message: 'مشتری قرارداد فروش با سرنخ یکسان نیست.',
          });
      }
      await tx.customerAffairsHandoff.update({
        where: { id: handoffId },
        data: {
          status: input.status,
          salesContractId:
            input.status === 'ACCEPTED'
              ? (input.salesContractId ?? null)
              : null,
          responseReason: input.reason,
          respondedAt: new Date(),
          respondedByUserId: actor.userId,
        },
      });
      const stage = input.status === 'ACCEPTED' ? 'HANDED_OFF' : 'QUALIFIED';
      const updated = await tx.customerAffairsLead.update({
        where: { id: handoff.leadId },
        data: {
          stage,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          leadId: handoff.leadId,
          type: 'REFERRAL',
          outcome: input.status,
          summary: input.reason,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: handoff.lead.branchId,
          actorUserId: actor.userId,
          entityType: 'HANDOFF',
          entityId: handoffId,
          action: input.status,
          reason: input.reason,
          version: handoff.packageVersion,
          afterSnapshot: json({
            status: input.status,
            salesContractId: input.salesContractId ?? null,
          }),
        },
      });
      return updated;
    });
    return this.getLead(lead.id, actor);
  }

  async listTickets(query: ListQueryDto, actor: AuthenticatedActor) {
    const branchIds = query.branchId
      ? [branchScope(actor, query.branchId)]
      : actor.branchIds;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.CustomerAffairsTicketWhereInput = {
      branchId: { in: branchIds },
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.overdueOnly
        ? {
            status: { in: ACTIVE_TICKET_STATUSES },
            nextActionAt: { lt: new Date() },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                trackingNumber: { contains: query.search, mode: 'insensitive' },
              },
              { subject: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const result = await this.repository.listTickets(where, page, pageSize);
    return {
      data: result.data.map((row) => this.presentTicket(row)),
      meta: { total: result.total, page, pageSize },
    };
  }

  async getTicket(id: string, actor: AuthenticatedActor) {
    return { data: this.presentTicket(await this.requireTicket(id, actor)) };
  }

  async createTicket(
    input: CustomerAffairsTicketInput,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    idempotencyValue: string | undefined,
    traceId?: string,
  ) {
    const branchId = branchScope(actor, requestedBranch);
    const key = requiredIdempotencyKey(idempotencyValue);
    const hash = fingerprint(input);
    const prior = await this.repository.findTicketCommand(actor.userId, key);
    if (prior) {
      if (prior.requestFingerprint !== hash) throw conflict();
      return this.getTicket(prior.resultEntityId, actor);
    }
    await this.assertCustomer(input.customerId, actor, traceId);
    await this.validateReferences(input, actor);
    this.validateTicket(input);
    const owner = input.customerOwnerUserId ?? actor.userId;
    const now = new Date();
    const policy = SLA_MINUTES[input.priority] ?? SLA_MINUTES.NORMAL!;
    const trackingNumber = `CA-T-${now.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      const id = await this.repository.transaction(async (tx) => {
        const row = await tx.customerAffairsTicket.create({
          data: {
            ...this.ticketData(input),
            branchId,
            trackingNumber,
            customerOwnerUserId: owner,
            slaPolicyVersion: SLA_POLICY_VERSION,
            firstResponseDueAt: new Date(now.getTime() + policy.first * 60_000),
            resolutionDueAt: new Date(
              now.getTime() + policy.resolution * 60_000,
            ),
            createdByUserId: actor.userId,
            updatedByUserId: actor.userId,
          },
        });
        await tx.customerAffairsTimeline.create({
          data: {
            ticketId: row.id,
            type: 'STATUS_CHANGE',
            outcome: 'NEW',
            summary: 'تیکت ثبت شد.',
            actorUserId: actor.userId,
            documentVersionIds: [],
          },
        });
        await tx.customerAffairsCommand.create({
          data: {
            actorUserId: actor.userId,
            scope: 'ticket.create',
            idempotencyKey: key,
            requestFingerprint: hash,
            resultEntityId: row.id,
          },
        });
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [owner],
          actorUserId: actor.userId,
          sourceModule: 'customer-affairs',
          eventType: 'ticket.assigned',
          title: 'تیکت جدید',
          message: `${trackingNumber} به شما تخصیص یافت.`,
          entityType: 'customer-affairs-ticket',
          entityId: row.id,
          href: `/customer-affairs?ticket=${row.id}`,
        });
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId,
            actorUserId: actor.userId,
            entityType: 'TICKET',
            entityId: row.id,
            action: 'CREATE',
            traceId: traceId ?? null,
            version: row.version,
            afterSnapshot: json({ trackingNumber, status: row.status, owner }),
          },
        });
        return row.id;
      });
      return this.getTicket(id, actor);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.repository.findTicketCommand(
          actor.userId,
          key,
        );
        if (replay) {
          if (replay.requestFingerprint !== hash) throw conflict();
          return {
            ...(await this.getTicket(replay.resultEntityId, actor)),
            meta: { idempotentReplay: true },
          };
        }
      }
      throw error;
    }
  }

  async updateTicket(
    id: string,
    input: CustomerAffairsTicketInput,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    const current = await this.requireTicket(id, actor);
    const expectedVersion = input.expectedVersion;
    if (!expectedVersion)
      throw new BadRequestException('expectedVersion الزامی است.');
    await this.assertCustomer(input.customerId, actor, traceId);
    await this.validateReferences(input, actor);
    this.validateTicket(input);
    await this.repository.transaction(async (tx) => {
      const changed = await tx.customerAffairsTicket.updateMany({
        where: { id, version: expectedVersion },
        data: {
          ...this.ticketData(input),
          customerOwnerUserId:
            input.customerOwnerUserId ?? current.customerOwnerUserId,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      const row = await tx.customerAffairsTicket.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'TICKET',
          entityId: id,
          action: 'UPDATE',
          traceId: traceId ?? null,
          version: row.version,
          beforeSnapshot: json({ version: current.version }),
          afterSnapshot: json({ version: row.version }),
        },
      });
    });
    return this.getTicket(id, actor);
  }

  async addTicketTimeline(
    id: string,
    input: CustomerAffairsTimelineInput,
    actor: AuthenticatedActor,
  ) {
    const ticket = await this.requireTicket(id, actor);
    this.validateTimeline(input);
    const now = new Date();
    const firstResponse =
      input.type === 'MESSAGE' &&
      input.customerVisible === true &&
      input.deliveryStatus === 'DELIVERED' &&
      !ticket.firstRespondedAt;
    const row = await this.repository.transaction(async (tx) => {
      const timeline = await tx.customerAffairsTimeline.create({
        data: this.timelineData(input, actor.userId, { ticketId: id }),
      });
      if (firstResponse)
        await tx.customerAffairsTicket.update({
          where: { id },
          data: {
            firstRespondedAt: now,
            firstResponseBreachedAt:
              now > ticket.firstResponseDueAt ? now : null,
            updatedByUserId: actor.userId,
            version: { increment: 1 },
          },
        });
      return timeline;
    });
    return { data: presentTimeline(row) };
  }

  async transitionTicket(
    id: string,
    input: TicketTransitionDto,
    actor: AuthenticatedActor,
  ) {
    const current = await this.requireTicket(id, actor);
    if (!canTransitionTicket(current.status as never, input.status as never))
      throw new BadRequestException({
        code: 'TICKET_TRANSITION_INVALID',
        message: 'تغییر وضعیت مجاز نیست.',
      });
    await this.repository.transaction(async (tx) => {
      const changed = await tx.customerAffairsTicket.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          status: input.status,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      const updated = await tx.customerAffairsTicket.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          ticketId: id,
          type: 'STATUS_CHANGE',
          outcome: input.status,
          summary: input.reason,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'TICKET',
          entityId: id,
          action: 'TRANSITION',
          reason: input.reason,
          version: updated.version,
          beforeSnapshot: json({ status: current.status }),
          afterSnapshot: json({ status: updated.status }),
        },
      });
    });
    return this.getTicket(id, actor);
  }

  async createReferral(
    id: string,
    input: ReferralDto,
    actor: AuthenticatedActor,
    idempotencyValue?: string,
  ) {
    const ticket = await this.requireTicket(id, actor);
    const key = requiredIdempotencyKey(idempotencyValue);
    const hash = fingerprint(input);
    if (!input.assignedUserId && !input.destinationUnit)
      throw new BadRequestException('کاربر یا واحد مقصد الزامی است.');
    let row: NonNullable<
      Awaited<ReturnType<CustomerAffairsRepository['findReferralByKey']>>
    >;
    try {
      row = await this.repository.transaction(async (tx) => {
        const prior = await tx.customerAffairsReferral.findUnique({
          where: {
            ticketId_idempotencyKey: { ticketId: id, idempotencyKey: key },
          },
        });
        if (prior) {
          if (prior.requestFingerprint !== hash) throw conflict();
          return prior;
        }
        const referral = await tx.customerAffairsReferral.create({
          data: {
            ticketId: id,
            destinationModule: input.destinationModule,
            destinationUnit: input.destinationUnit ?? null,
            assignedUserId: input.assignedUserId ?? null,
            title: input.title,
            description: input.description,
            dueAt: new Date(input.dueAt),
            idempotencyKey: key,
            requestFingerprint: hash,
            createdByUserId: actor.userId,
          },
        });
        await tx.customerAffairsTimeline.create({
          data: {
            ticketId: id,
            type: 'REFERRAL',
            outcome: input.destinationModule,
            summary: input.title,
            actorUserId: actor.userId,
            documentVersionIds: [],
          },
        });
        if (referral.assignedUserId)
          await this.notifications.createWithinTransaction(tx, {
            recipientUserIds: [referral.assignedUserId],
            actorUserId: actor.userId,
            sourceModule: 'customer-affairs',
            eventType: 'ticket.referred',
            title: input.title,
            message: `${ticket.trackingNumber}: ${input.description}`,
            entityType: 'customer-affairs-referral',
            entityId: referral.id,
            href: `/workbench?customerAffairsReferral=${referral.id}`,
          });
        await tx.customerAffairsAuditEvent.create({
          data: {
            branchId: ticket.branchId,
            actorUserId: actor.userId,
            entityType: 'REFERRAL',
            entityId: referral.id,
            action: 'CREATE',
            version: 1,
            afterSnapshot: json({
              destinationModule: referral.destinationModule,
              dueAt: referral.dueAt,
            }),
          },
        });
        return referral;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.repository.findReferralByKey(id, key);
        if (replay) {
          if (replay.requestFingerprint !== hash) throw conflict();
          row = replay;
        } else throw error;
      } else throw error;
    }
    return {
      data: {
        id: row.id,
        ticketId: row.ticketId,
        destinationModule: row.destinationModule,
        destinationUnit: row.destinationUnit,
        assignedUserId: row.assignedUserId,
        title: row.title,
        description: row.description,
        status: row.status,
        responseSummary: row.responseSummary,
        dueAt: row.dueAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async workbench(actor: AuthenticatedActor) {
    const rows = await this.repository.workbenchReferrals(
      actor.userId,
      actor.branchIds,
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        ticketId: row.ticketId,
        trackingNumber: row.ticket.trackingNumber,
        ticketSubject: row.ticket.subject,
        title: row.title,
        destinationModule: row.destinationModule,
        destinationUnit: row.destinationUnit,
        status: row.status,
        dueAt: row.dueAt.toISOString(),
      })),
    };
  }

  async respondReferral(
    id: string,
    input: ReferralResponseDto,
    actor: AuthenticatedActor,
  ) {
    const row = await this.repository.transaction(async (tx) => {
      const current = await tx.customerAffairsReferral.findUnique({
        where: { id },
        include: { ticket: true },
      });
      if (!current || !actor.branchIds.includes(current.ticket.branchId))
        throw new NotFoundException('ارجاع پیدا نشد.');
      if (
        current.assignedUserId &&
        current.assignedUserId !== actor.userId &&
        !actor.permissions.includes('customer_affairs.ticket.assign')
      )
        throw new ForbiddenException(
          'این ارجاع به کاربر دیگری تخصیص یافته است.',
        );
      if (['DONE', 'CANCELLED'].includes(current.status)) {
        if (
          current.status === input.status &&
          current.responseSummary === input.responseSummary
        )
          return current;
        throw conflict();
      }
      const updated = await tx.customerAffairsReferral.update({
        where: { id },
        data: {
          status: input.status,
          responseSummary: input.responseSummary,
          respondedByUserId: actor.userId,
        },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          ticketId: current.ticketId,
          type: 'REFERRAL',
          outcome: input.status,
          summary: input.responseSummary,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      await this.notifications.createWithinTransaction(tx, {
        recipientUserIds: [current.ticket.customerOwnerUserId],
        actorUserId: actor.userId,
        sourceModule: 'customer-affairs',
        eventType: 'referral.responded',
        title: `پاسخ ارجاع ${current.ticket.trackingNumber}`,
        message: input.responseSummary,
        entityType: 'customer-affairs-referral',
        entityId: id,
        href: `/customer-affairs?ticket=${current.ticketId}`,
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.ticket.branchId,
          actorUserId: actor.userId,
          entityType: 'REFERRAL',
          entityId: id,
          action: input.status,
          reason: input.responseSummary,
          version: 1,
          beforeSnapshot: json({ status: current.status }),
          afterSnapshot: json({ status: input.status }),
        },
      });
      return updated;
    });
    return {
      data: {
        ...row,
        dueAt: row.dueAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async ticketAction(
    id: string,
    action: 'ESCALATE' | 'RESOLVE' | 'CLOSE' | 'REOPEN',
    input: TicketActionDto,
    actor: AuthenticatedActor,
  ) {
    const current = await this.requireTicket(id, actor);
    let target = current.status;
    if (action === 'ESCALATE') target = current.status;
    if (action === 'RESOLVE') target = 'RESOLVED';
    if (action === 'CLOSE') target = 'CLOSED';
    if (action === 'REOPEN') target = 'REOPENED';
    if (
      action !== 'ESCALATE' &&
      !canTransitionTicket(current.status as never, target as never)
    )
      throw new BadRequestException({
        code: 'TICKET_TRANSITION_INVALID',
        message: 'تغییر وضعیت مجاز نیست.',
      });
    if (
      (action === 'RESOLVE' || action === 'CLOSE') &&
      !input.resolutionOutcome?.trim()
    )
      throw new BadRequestException('نتیجه رسیدگی الزامی است.');
    if (action === 'CLOSE' && !input.closeReason?.trim())
      throw new BadRequestException('دلیل بستن الزامی است.');
    const now = new Date();
    await this.repository.transaction(async (tx) => {
      const data: Prisma.CustomerAffairsTicketUncheckedUpdateManyInput = {
        updatedByUserId: actor.userId,
        version: { increment: 1 },
      };
      if (action === 'ESCALATE')
        data.escalationLevel =
          input.level ?? Math.min(3, (current.escalationLevel ?? 0) + 1);
      if (action === 'RESOLVE') {
        data.status = 'RESOLVED';
        data.resolvedAt = now;
        data.resolutionOutcome = input.resolutionOutcome ?? null;
        data.resolutionBreachedAt = now > current.resolutionDueAt ? now : null;
      }
      if (action === 'CLOSE') {
        data.status = 'CLOSED';
        data.closedAt = now;
        data.closeReason = input.closeReason ?? null;
        data.resolutionOutcome = input.resolutionOutcome ?? null;
      }
      if (action === 'REOPEN') {
        data.status = 'REOPENED';
        data.closedAt = null;
        data.resolvedAt = null;
        data.reopenCount = { increment: 1 };
        data.nextAction = 'بازبینی علت بازگشایی';
        data.nextActionAt = new Date(now.getTime() + 60 * 60_000);
      }
      const changed = await tx.customerAffairsTicket.updateMany({
        where: { id, version: input.expectedVersion },
        data,
      });
      if (!changed.count) throw conflict();
      const updated = await tx.customerAffairsTicket.findUniqueOrThrow({
        where: { id },
      });
      await tx.customerAffairsTimeline.create({
        data: {
          ticketId: id,
          type: action === 'ESCALATE' ? 'ESCALATION' : 'STATUS_CHANGE',
          outcome:
            action === 'ESCALATE' ? String(data.escalationLevel) : target,
          summary: input.reason,
          actorUserId: actor.userId,
          documentVersionIds: [],
        },
      });
      if (action === 'ESCALATE')
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [current.customerOwnerUserId],
          actorUserId: actor.userId,
          sourceModule: 'customer-affairs',
          eventType: 'ticket.escalated',
          title: 'تصعید تیکت',
          message: `${current.trackingNumber}: ${input.reason}`,
          entityType: 'customer-affairs-ticket',
          entityId: id,
          href: `/customer-affairs?ticket=${id}`,
        });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.branchId,
          actorUserId: actor.userId,
          entityType: 'TICKET',
          entityId: id,
          action,
          reason: input.reason,
          version: updated.version,
          beforeSnapshot: json({
            status: current.status,
            reopenCount: current.reopenCount,
          }),
          afterSnapshot: json({
            status: updated.status,
            reopenCount: updated.reopenCount,
            escalationLevel: updated.escalationLevel,
          }),
        },
      });
    });
    return this.getTicket(id, actor);
  }

  async createSatisfactionInvitation(id: string, actor: AuthenticatedActor) {
    const ticket = await this.requireTicket(id, actor);
    const token = randomBytes(32).toString('base64url');
    const invitationReference = fingerprint(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const row = await this.repository.transaction(async (tx) => {
      const existing = await tx.customerAffairsSatisfaction.findUnique({
        where: { ticketId: id },
      });
      if (existing?.score !== null && existing?.score !== undefined)
        throw new ConflictException({
          code: 'SATISFACTION_ALREADY_SUBMITTED',
          message: 'رضایت این تیکت قبلاً ثبت شده است.',
        });
      const survey = await tx.customerAffairsSatisfaction.upsert({
        where: { ticketId: id },
        update: { invitationReference, expiresAt },
        create: { ticketId: id, invitationReference, expiresAt },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: ticket.branchId,
          actorUserId: actor.userId,
          entityType: 'TICKET',
          entityId: id,
          action: 'SATISFACTION_INVITATION_CREATED',
          version: ticket.version,
          afterSnapshot: json({ expiresAt }),
        },
      });
      return survey;
    });
    return {
      data: {
        token,
        expiresAt: row.expiresAt.toISOString(),
      },
    };
  }

  async submitSatisfaction(token: string, input: SatisfactionDto) {
    if (token.length < 32 || token.length > 160)
      throw new BadRequestException({
        code: 'SATISFACTION_INVITATION_INVALID',
        message: 'دعوت‌نامه رضایت‌سنجی معتبر نیست یا منقضی شده است.',
      });
    const invitationReference = fingerprint(token);
    const now = new Date();
    const survey = await this.repository.transaction(async (tx) => {
      const current = await tx.customerAffairsSatisfaction.findUnique({
        where: { invitationReference },
        include: { ticket: true },
      });
      if (!current || current.expiresAt < now)
        throw new BadRequestException({
          code: 'SATISFACTION_INVITATION_INVALID',
          message: 'دعوت‌نامه رضایت‌سنجی معتبر نیست یا منقضی شده است.',
        });
      const claimed = await tx.customerAffairsSatisfaction.updateMany({
        where: {
          id: current.id,
          invitationReference,
          score: null,
          expiresAt: { gte: now },
        },
        data: {
          score: input.score,
          comment: input.comment ?? null,
          submittedByCustomer: true,
          submittedAt: now,
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException({
          code: 'SATISFACTION_ALREADY_SUBMITTED',
          message: 'پاسخ این رضایت‌سنجی قبلاً ثبت شده است.',
        });
      if (input.score <= 2) {
        const existing = await tx.customerAffairsCorrectiveAction.findFirst({
          where: { satisfactionId: current.id },
        });
        if (!existing) {
          const action = await tx.customerAffairsCorrectiveAction.create({
            data: {
              ticketId: current.ticketId,
              satisfactionId: current.id,
              title: 'پیگیری رضایت پایین مشتری',
              ownerUserId: current.ticket.customerOwnerUserId,
              dueAt: new Date(Date.now() + 24 * 60 * 60_000),
            },
          });
          await this.notifications.createWithinTransaction(tx, {
            recipientUserIds: [current.ticket.customerOwnerUserId],
            actorUserId: null,
            sourceModule: 'customer-affairs',
            eventType: 'corrective-action.created',
            title: 'اقدام اصلاحی رضایت پایین',
            message: `${current.ticket.trackingNumber} نیازمند پیگیری سرپرست است.`,
            entityType: 'customer-affairs-corrective-action',
            entityId: action.id,
            href: `/customer-affairs?ticket=${current.ticketId}`,
          });
        }
      }
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId: current.ticket.branchId,
          actorUserId: null,
          entityType: 'TICKET',
          entityId: current.ticketId,
          action: 'SATISFACTION_SUBMITTED_BY_CUSTOMER',
          reason: 'PUBLIC_SURVEY_RESPONSE',
          version: current.ticket.version,
          afterSnapshot: json({ score: input.score, submittedAt: now }),
        },
      });
      return { score: input.score, submittedAt: now };
    });
    return {
      data: {
        score: survey.score,
        submittedAt: survey.submittedAt.toISOString(),
      },
    };
  }

  async updateCorrectiveAction(
    id: string,
    input: CorrectiveActionDto,
    actor: AuthenticatedActor,
  ) {
    const row = await this.repository.transaction(async (tx) => {
      const current = await tx.customerAffairsCorrectiveAction.findUnique({
        where: { id },
        include: { ticket: true },
      });
      if (!current || !actor.branchIds.includes(current.ticket.branchId))
        throw new NotFoundException('اقدام اصلاحی پیدا نشد.');
      const changed = await tx.customerAffairsCorrectiveAction.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          status: input.status,
          result: input.result,
          effectivenessReview: input.effectivenessReview ?? null,
          version: { increment: 1 },
        },
      });
      if (!changed.count) throw conflict();
      return tx.customerAffairsCorrectiveAction.findUniqueOrThrow({
        where: { id },
      });
    });
    return {
      data: {
        ...row,
        dueAt: row.dueAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  private async requireLead(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<CustomerAffairsLeadRow> {
    const row = await this.repository.findLead(id);
    if (!row) throw new NotFoundException('سرنخ پیدا نشد.');
    assertRowBranch(actor, row.branchId);
    return row;
  }

  private async requireTicket(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<CustomerAffairsTicketRow> {
    const row = await this.repository.findTicket(id);
    if (!row) throw new NotFoundException('تیکت پیدا نشد.');
    assertRowBranch(actor, row.branchId);
    return row;
  }

  private async presentLead(
    row: CustomerAffairsLeadRow,
    actor: AuthenticatedActor,
  ): Promise<
    CustomerAffairsLeadView & {
      timeline: ReturnType<typeof presentTimeline>[];
      handoffs: ReturnType<CustomerAffairsService['presentHandoff']>[];
    }
  > {
    const duplicateWarnings = row.contactFingerprint
      ? await this.repository.duplicateLeads(
          actor.branchIds,
          row.contactFingerprint,
          row.id,
        )
      : [];
    return {
      ...leadInput(row),
      id: row.id,
      trackingNumber: row.trackingNumber,
      branchId: row.branchId,
      stage: row.stage as CustomerAffairsLeadStage,
      qualification: row.qualification as Record<string, unknown> | null,
      lostReason: row.lostReason,
      lostNote: row.lostNote,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      duplicateWarnings,
      timeline: row.timeline.map(presentTimeline),
      handoffs: row.handoffs.map((item) => this.presentHandoff(item)),
    };
  }

  private presentTicket(
    row: CustomerAffairsTicketRow,
  ): CustomerAffairsTicketView & {
    timeline: ReturnType<typeof presentTimeline>[];
    referrals: unknown[];
    satisfactions: unknown[];
    correctiveActions: unknown[];
  } {
    return {
      ...ticketInput(row),
      id: row.id,
      trackingNumber: row.trackingNumber,
      branchId: row.branchId,
      status: row.status as CustomerAffairsTicketView['status'],
      slaPolicyVersion: row.slaPolicyVersion,
      firstResponseDueAt: row.firstResponseDueAt.toISOString(),
      resolutionDueAt: row.resolutionDueAt.toISOString(),
      firstRespondedAt: row.firstRespondedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      firstResponseBreachedAt:
        row.firstResponseBreachedAt?.toISOString() ?? null,
      resolutionBreachedAt: row.resolutionBreachedAt?.toISOString() ?? null,
      escalationLevel: row.escalationLevel,
      resolutionOutcome: row.resolutionOutcome,
      closeReason: row.closeReason,
      closedAt: row.closedAt?.toISOString() ?? null,
      reopenCount: row.reopenCount,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      timeline: row.timeline.map(presentTimeline),
      referrals: row.referrals.map((item) => ({
        id: item.id,
        ticketId: item.ticketId,
        destinationModule: item.destinationModule,
        destinationUnit: item.destinationUnit,
        assignedUserId: item.assignedUserId,
        title: item.title,
        description: item.description,
        status: item.status,
        responseSummary: item.responseSummary,
        dueAt: item.dueAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      satisfactions: row.satisfactions.map((item) => ({
        id: item.id,
        score: item.score,
        comment: item.comment,
        submittedByCustomer: item.submittedByCustomer,
        submittedAt: item.submittedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
      correctiveActions: row.correctiveActions.map((item) => ({
        ...item,
        dueAt: item.dueAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  private presentHandoff(row: CustomerAffairsLeadRow['handoffs'][number]) {
    return {
      id: row.id,
      leadId: row.leadId,
      packageVersion: row.packageVersion,
      status: row.status,
      salesContractId: row.salesContractId,
      responseReason: row.responseReason,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
    };
  }

  private async assertCustomer(
    id: string | null | undefined,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    if (id) await this.customers.detail(id, actor, traceId);
  }

  private validateLead(input: CustomerAffairsLeadInput): void {
    const start = cleanDate(input.travelStart, 'تاریخ شروع');
    const end = cleanDate(input.travelEnd, 'تاریخ پایان');
    if (start && end && end < start)
      throw new BadRequestException('پایان سفر پیش از شروع است.');
    if (input.passengerComposition) {
      const total =
        input.passengerComposition.adults +
        input.passengerComposition.children +
        input.passengerComposition.infants;
      if (total !== input.passengerCount)
        throw new BadRequestException('ترکیب مسافران با تعداد کل یکسان نیست.');
    }
    const minimum = input.budget?.minimum ? Number(input.budget.minimum) : null;
    const maximum = input.budget?.maximum ? Number(input.budget.maximum) : null;
    if (minimum !== null && maximum !== null && maximum < minimum)
      throw new BadRequestException('حداکثر بودجه از حداقل کمتر است.');
    if ((minimum !== null || maximum !== null) && !input.budget?.currencyCode)
      throw new BadRequestException('واحد پول بودجه الزامی است.');
  }

  private leadData(input: CustomerAffairsLeadInput) {
    return {
      title: input.title.trim(),
      sourceReference: input.sourceReference.trim(),
      inboundChannel: input.inboundChannel,
      contactOccurredAt: new Date(input.contactOccurredAt),
      travelNeed: input.travelNeed.trim(),
      originReference: input.originReference?.trim() || null,
      destinationReference: input.destinationReference?.trim() || null,
      travelStart: cleanDate(input.travelStart, 'تاریخ شروع'),
      travelEnd: cleanDate(input.travelEnd, 'تاریخ پایان'),
      datePrecision: input.datePrecision ?? 'UNKNOWN',
      dateFlexibility: input.dateFlexibility?.trim() || null,
      passengerCount: input.passengerCount,
      passengerComposition: json(
        input.passengerComposition ?? {
          adults: input.passengerCount,
          children: 0,
          infants: 0,
        },
      ),
      requestedServices: json(input.requestedServices ?? []),
      budgetMinimum: input.budget?.minimum
        ? new Prisma.Decimal(input.budget.minimum)
        : null,
      budgetMaximum: input.budget?.maximum
        ? new Prisma.Decimal(input.budget.maximum)
        : null,
      currencyCode: input.budget?.currencyCode?.toUpperCase() || null,
      budgetBasis: input.budget?.basis ?? null,
      budgetUnknownReason: input.budget?.unknownReason?.trim() || null,
      specialPreferences: input.specialPreferences?.trim() || null,
      contactFingerprint: input.contactFingerprint ?? null,
      customerId: input.customerId ?? null,
      priority: input.priority,
      assigneeUserId: input.assigneeUserId ?? null,
      queueCode: input.queueCode?.trim() || null,
      nextAction: input.nextAction.trim(),
      nextActionAt: new Date(input.nextActionAt),
    };
  }

  private validateTicket(input: CustomerAffairsTicketInput): void {
    if (
      new Date(input.nextActionAt).getTime() <=
      new Date(input.contactOccurredAt).getTime()
    )
      throw new BadRequestException(
        'موعد اقدام بعدی باید پس از زمان تماس باشد.',
      );
  }

  private ticketData(input: CustomerAffairsTicketInput) {
    return {
      subject: input.subject.trim(),
      description: input.description.trim(),
      channel: input.channel,
      contactOccurredAt: new Date(input.contactOccurredAt),
      category: input.category,
      serviceType: input.serviceType?.trim() || null,
      impact: input.impact,
      urgency: input.urgency,
      priority: input.priority,
      customerId: input.customerId ?? null,
      executionOwnerUserId: input.executionOwnerUserId ?? null,
      executionUnit: input.executionUnit?.trim() || null,
      references: json(input.references ?? []),
      nextAction: input.nextAction.trim(),
      nextActionAt: new Date(input.nextActionAt),
    };
  }

  private validateTimeline(input: CustomerAffairsTimelineInput): void {
    if (input.type === 'NOTE' && input.customerVisible)
      throw new BadRequestException({
        code: 'INTERNAL_NOTE_CANNOT_BE_SENT',
        message: 'یادداشت داخلی قابل ارسال به مشتری نیست.',
      });
    if (input.deliveryStatus === 'DELIVERED' && !input.recipientReference)
      throw new BadRequestException({
        code: 'DELIVERY_RECIPIENT_REQUIRED',
        message: 'تحویل بدون گیرنده معتبر ثبت نمی‌شود.',
      });
  }

  private timelineData(
    input: CustomerAffairsTimelineInput,
    actorUserId: string,
    parent: { leadId: string } | { ticketId: string },
  ): Prisma.CustomerAffairsTimelineUncheckedCreateInput {
    return {
      ...parent,
      type: input.type,
      outcome: input.outcome?.trim() || null,
      summary: input.summary.trim(),
      customerVisible:
        input.type === 'NOTE' ? false : (input.customerVisible ?? false),
      channel: input.channel?.trim() || null,
      recipientReference: input.recipientReference?.trim() || null,
      templateVersion: input.templateVersion?.trim() || null,
      deliveryStatus: input.deliveryStatus ?? null,
      deliveryKey: input.deliveryKey?.trim() || null,
      documentVersionIds: input.documentVersionIds ?? [],
      actorUserId,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    };
  }

  private async validateReferences(
    input: CustomerAffairsTicketInput,
    actor: AuthenticatedActor,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const reference of input.references ?? []) {
      const key = `${reference.type}:${reference.id}`;
      if (seen.has(key))
        throw new BadRequestException({
          code: 'DUPLICATE_REFERENCE',
          message: 'مرجع تکراری است.',
        });
      seen.add(key);
      if (reference.type === 'SALES_CONTRACT') {
        await this.sales.detail(reference.id, actor);
        continue;
      }
      if (reference.type === 'RESERVATION') {
        if (!actor.permissions.includes('reservations.read'))
          throw new ForbiddenException({
            code: 'REFERENCE_FORBIDDEN',
            message: 'مجوز مشاهده مرجع رزرواسیون وجود ندارد.',
          });
        await this.reservations.purchaseContext(reference.id, actor.branchIds);
        continue;
      }
      if (
        reference.type === 'TICKET_DOCUMENT' ||
        reference.type === 'VOUCHER_DOCUMENT'
      ) {
        await this.documents.detail(reference.id, actor, {});
        continue;
      }
      throw new BadRequestException({
        code: 'REFERENCE_ADAPTER_UNAVAILABLE',
        message: 'برای این نوع مرجع، اعتبارسنج عمومی و امن فعال نیست.',
      });
    }
  }
}
