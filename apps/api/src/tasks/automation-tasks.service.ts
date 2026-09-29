import { Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';

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
  async syncProcurementWithinTransaction(
    tx: Prisma.TransactionClient,
    input: ProcurementTaskInput,
  ) {
    const terminal = ['REJECTED', 'CANCELLED', 'CLOSED'].includes(input.status);
    const assigneeUserId = input.approverUserId ?? input.ownerUserId;
    await tx.automationTask.updateMany({
      where: {
        sourceModule: 'PROCUREMENT',
        sourceReference: input.requestId,
        status: 'OPEN',
        ...(assigneeUserId ? { assigneeUserId: { not: assigneeUserId } } : {}),
      },
      data: {
        status: terminal ? 'CANCELLED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });
    if (terminal || !assigneeUserId) return null;
    const approval = Boolean(input.approverUserId);
    const dueAt = new Date(Date.now() + (approval ? 24 : 48) * 60 * 60 * 1000);
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
  }
}
