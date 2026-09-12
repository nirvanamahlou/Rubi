import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

export const customerAffairsLeadInclude = {
  timeline: { orderBy: { occurredAt: 'desc' as const } },
  handoffs: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.CustomerAffairsLeadInclude;

export const customerAffairsTicketInclude = {
  timeline: { orderBy: { occurredAt: 'desc' as const } },
  referrals: { orderBy: { createdAt: 'desc' as const } },
  satisfactions: { orderBy: { createdAt: 'desc' as const } },
  correctiveActions: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.CustomerAffairsTicketInclude;

export type CustomerAffairsLeadRow = Prisma.CustomerAffairsLeadGetPayload<{
  include: typeof customerAffairsLeadInclude;
}>;
export type CustomerAffairsTicketRow = Prisma.CustomerAffairsTicketGetPayload<{
  include: typeof customerAffairsTicketInclude;
}>;

@Injectable()
export class CustomerAffairsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.database.client.$transaction(work);
  }

  findLead(id: string): Promise<CustomerAffairsLeadRow | null> {
    return this.database.client.customerAffairsLead.findUnique({
      where: { id },
      include: customerAffairsLeadInclude,
    });
  }

  findLeadBySource(branchId: string, sourceReference: string) {
    return this.database.client.customerAffairsLead.findUnique({
      where: { branchId_sourceReference: { branchId, sourceReference } },
      include: customerAffairsLeadInclude,
    });
  }

  findLeadCommand(actorUserId: string, key: string) {
    return this.database.client.customerAffairsCommand.findUnique({
      where: {
        actorUserId_scope_idempotencyKey: {
          actorUserId,
          scope: 'lead.create',
          idempotencyKey: key,
        },
      },
    });
  }

  async listLeads(
    where: Prisma.CustomerAffairsLeadWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [data, total] = await Promise.all([
      this.database.client.customerAffairsLead.findMany({
        where,
        include: customerAffairsLeadInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.customerAffairsLead.count({ where }),
    ]);
    return { data, total };
  }

  duplicateLeads(
    branchIds: string[],
    contactFingerprint: string,
    excludeId?: string,
  ) {
    return this.database.client.customerAffairsLead.findMany({
      where: {
        branchId: { in: branchIds },
        contactFingerprint,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        stage: { notIn: ['LOST', 'HANDED_OFF'] },
      },
      select: { id: true, trackingNumber: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  findTicket(id: string): Promise<CustomerAffairsTicketRow | null> {
    return this.database.client.customerAffairsTicket.findUnique({
      where: { id },
      include: customerAffairsTicketInclude,
    });
  }

  findTicketCommand(actorUserId: string, key: string) {
    return this.database.client.customerAffairsCommand.findUnique({
      where: {
        actorUserId_scope_idempotencyKey: {
          actorUserId,
          scope: 'ticket.create',
          idempotencyKey: key,
        },
      },
    });
  }

  async listTickets(
    where: Prisma.CustomerAffairsTicketWhereInput,
    page: number,
    pageSize: number,
  ) {
    const [data, total] = await Promise.all([
      this.database.client.customerAffairsTicket.findMany({
        where,
        include: customerAffairsTicketInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.customerAffairsTicket.count({ where }),
    ]);
    return { data, total };
  }

  workbenchReferrals(userId: string, branchIds: string[]) {
    return this.database.client.customerAffairsReferral.findMany({
      where: {
        ticket: { branchId: { in: branchIds } },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        OR: [{ assignedUserId: userId }, { assignedUserId: null }],
      },
      include: { ticket: { select: { trackingNumber: true, subject: true } } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
  }

  findReferralByKey(ticketId: string, idempotencyKey: string) {
    return this.database.client.customerAffairsReferral.findUnique({
      where: { ticketId_idempotencyKey: { ticketId, idempotencyKey } },
    });
  }

  audit(entityType: 'LEAD' | 'TICKET', entityId: string, branchIds: string[]) {
    return this.database.client.customerAffairsAuditEvent.findMany({
      where: { entityType, entityId, branchId: { in: branchIds } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      take: 200,
    });
  }

  async dashboard(branchIds: string[]) {
    const now = new Date();
    const [
      openLeads,
      overdueLeads,
      waitingSales,
      openTickets,
      overdueTickets,
      breached,
      correctiveActions,
    ] = await Promise.all([
      this.database.client.customerAffairsLead.count({
        where: {
          branchId: { in: branchIds },
          stage: { notIn: ['LOST', 'HANDED_OFF'] },
        },
      }),
      this.database.client.customerAffairsLead.count({
        where: {
          branchId: { in: branchIds },
          stage: { notIn: ['LOST', 'HANDED_OFF'] },
          nextActionAt: { lt: now },
        },
      }),
      this.database.client.customerAffairsHandoff.count({
        where: {
          lead: { branchId: { in: branchIds } },
          status: 'WAITING_SALES',
        },
      }),
      this.database.client.customerAffairsTicket.count({
        where: {
          branchId: { in: branchIds },
          status: { notIn: ['CLOSED', 'CANCELLED'] },
        },
      }),
      this.database.client.customerAffairsTicket.count({
        where: {
          branchId: { in: branchIds },
          status: { notIn: ['CLOSED', 'CANCELLED'] },
          nextActionAt: { lt: now },
        },
      }),
      this.database.client.customerAffairsTicket.count({
        where: {
          branchId: { in: branchIds },
          OR: [
            { firstResponseBreachedAt: { not: null } },
            { resolutionBreachedAt: { not: null } },
            { firstRespondedAt: null, firstResponseDueAt: { lt: now } },
            { resolvedAt: null, resolutionDueAt: { lt: now } },
          ],
        },
      }),
      this.database.client.customerAffairsCorrectiveAction.count({
        where: {
          ticket: { branchId: { in: branchIds } },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);
    return {
      leads: { open: openLeads, overdue: overdueLeads, waitingSales },
      tickets: {
        open: openTickets,
        overdue: overdueTickets,
        breached,
        correctiveActions,
      },
    };
  }

  async report(branchIds: string[]) {
    const [
      leadStages,
      ticketStatuses,
      ticketPriorities,
      ticketCategories,
      satisfaction,
      correctiveActions,
    ] = await Promise.all([
      this.database.client.customerAffairsLead.groupBy({
        by: ['stage'],
        where: { branchId: { in: branchIds } },
        _count: { _all: true },
      }),
      this.database.client.customerAffairsTicket.groupBy({
        by: ['status'],
        where: { branchId: { in: branchIds } },
        _count: { _all: true },
      }),
      this.database.client.customerAffairsTicket.groupBy({
        by: ['priority'],
        where: { branchId: { in: branchIds } },
        _count: { _all: true },
      }),
      this.database.client.customerAffairsTicket.groupBy({
        by: ['category'],
        where: { branchId: { in: branchIds } },
        _count: { _all: true },
      }),
      this.database.client.customerAffairsSatisfaction.aggregate({
        where: {
          submittedByCustomer: true,
          ticket: { branchId: { in: branchIds } },
        },
        _avg: { score: true },
        _count: { score: true },
      }),
      this.database.client.customerAffairsCorrectiveAction.groupBy({
        by: ['status'],
        where: { ticket: { branchId: { in: branchIds } } },
        _count: { _all: true },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      leadStages,
      ticketStatuses,
      ticketPriorities,
      ticketCategories,
      satisfaction: {
        average: satisfaction._avg.score,
        count: satisfaction._count.score,
      },
      correctiveActions,
    };
  }
}
