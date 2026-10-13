import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

type ProcurementTaskInput = {
  eventId: string;
  requestId: string;
  requestNumber: string;
  branchId: string;
  status: string;
  ownerUserId: string | null;
  approverUserId: string | null;
  action: string;
};

@Injectable()
export class AutomationTasksService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async assignedProcurementFollowUps(actor: AuthenticatedActor) {
    if (!actor.branchIds.length) return { items: [] };
    const rows = await this.database.client.automationTask.findMany({
      where: {
        sourceModule: 'PROCUREMENT',
        kind: 'PROCUREMENT_FOLLOW_UP',
        status: 'OPEN',
        assigneeUserId: actor.userId,
        branchId: { in: actor.branchIds },
      },
      select: {
        id: true,
        sourceReference: true,
        title: true,
        dueAt: true,
        createdAt: true,
      },
      orderBy: [
        { dueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 100,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        requestId: row.sourceReference,
        title: row.title,
        dueAt: row.dueAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async syncProcurementWithinTransaction(
    tx: Prisma.TransactionClient,
    input: ProcurementTaskInput,
  ) {
    const terminal = ['REJECTED', 'CANCELLED', 'CLOSED'].includes(input.status);
    const assignments = new Map<string, { approval: boolean }>();
    if (input.ownerUserId)
      assignments.set(input.ownerUserId, { approval: false });
    if (input.approverUserId)
      assignments.set(input.approverUserId, { approval: true });
    // A freshly saved, unassigned draft has no actionable task. Skipping the
    // projection is also important while a local database is being upgraded:
    // its absence must not roll back the Procurement request itself.
    if (input.action === 'CREATE' && !terminal && !assignments.size)
      return null;
    await tx.automationTask.updateMany({
      where: {
        sourceModule: 'PROCUREMENT',
        sourceReference: input.requestId,
        status: 'OPEN',
        ...(terminal || !assignments.size
          ? {}
          : { assigneeUserId: { notIn: [...assignments.keys()] } }),
      },
      data: {
        status: terminal ? 'CANCELLED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });
    if (terminal) return null;
    const tasks = await Promise.all(
      [...assignments].map(async ([assigneeUserId, { approval }]) => {
        const dueAt = new Date(
          Date.now() + (approval ? 24 : 48) * 60 * 60 * 1000,
        );
        return tx.automationTask.upsert({
          where: {
            sourceModule_sourceEventId_assigneeUserId: {
              sourceModule: 'PROCUREMENT',
              sourceEventId: input.eventId,
              assigneeUserId,
            },
          },
          create: {
            sourceModule: 'PROCUREMENT',
            sourceEventId: input.eventId,
            sourceReference: input.requestId,
            branchId: input.branchId,
            assigneeUserId,
            kind: approval ? 'PROCUREMENT_APPROVAL' : 'PROCUREMENT_FOLLOW_UP',
            title: approval
              ? `تصمیم درباره درخواست خرید ${input.requestNumber}`
              : `پیگیری درخواست خرید ${input.requestNumber}`,
            dueAt,
            payload: {
              requestId: input.requestId,
              requestNumber: input.requestNumber,
              action: input.action,
              status: input.status,
            },
          },
          update: {
            status: 'OPEN',
            completedAt: null,
            dueAt,
            payload: {
              requestId: input.requestId,
              requestNumber: input.requestNumber,
              action: input.action,
              status: input.status,
            },
          },
        });
      }),
    );
    return tasks[0] ?? null;
  }
}
