import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { WorkbenchFeedbackReceiptV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateFeedbackRecord {
  id: string;
  trackingNumber: string;
  requestHash: string;
  branchId: string;
  department: string;
  departmentCode: WorkbenchFeedbackReceiptV1['department'];
  departmentLabel: string;
  subject: string;
  body: string;
  anonymous: boolean;
  attachmentCount: number;
  submittedByUserId: string;
  recipientUserIds: readonly string[];
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class WorkbenchFeedbackRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  findById(id: string) {
    return this.database.client.workbenchFeedback.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, displayName: true } },
      },
    });
  }

  listHr(branchIds: readonly string[], page: number, pageSize: number) {
    return this.database.client.workbenchFeedback.findMany({
      where: {
        branchId: { in: [...branchIds] },
        department: 'HUMAN_RESOURCES',
      },
      include: { submittedBy: { select: { id: true, displayName: true } } },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  countHr(branchIds: readonly string[]) {
    return this.database.client.workbenchFeedback.count({
      where: {
        branchId: { in: [...branchIds] },
        department: 'HUMAN_RESOURCES',
      },
    });
  }

  async create(
    input: CreateFeedbackRecord,
  ): Promise<WorkbenchFeedbackReceiptV1> {
    const receipt = (row: {
      id: string;
      trackingNumber: string;
      branchId: string;
      subject: string;
      isAnonymous: boolean;
      attachmentCount: number;
      submittedAt: Date;
    }): WorkbenchFeedbackReceiptV1 => ({
      id: row.id,
      trackingNumber: row.trackingNumber,
      branchId: row.branchId,
      department: input.departmentCode,
      subject: row.subject,
      anonymous: row.isAnonymous,
      attachmentCount: row.attachmentCount,
      recipientCount: input.recipientUserIds.length,
      submittedAt: row.submittedAt.toISOString(),
    });
    const verifyReplay = (row: {
      submittedByUserId: string;
      requestHash: string;
    }) => {
      if (
        row.submittedByUserId !== input.submittedByUserId ||
        row.requestHash !== input.requestHash
      ) {
        throw new ConflictException(
          'شناسه این ارسال قبلاً برای نظرسنجی دیگری استفاده شده است.',
        );
      }
    };
    try {
      return await this.database.client.$transaction(async (transaction) => {
        const existing = await transaction.workbenchFeedback.findUnique({
          where: { id: input.id },
        });
        if (existing) {
          verifyReplay(existing);
          return receipt(existing);
        }

        const created = await transaction.workbenchFeedback.create({
          data: {
            id: input.id,
            trackingNumber: input.trackingNumber,
            requestHash: input.requestHash,
            branchId: input.branchId,
            department: input.department as never,
            subject: input.subject,
            body: input.body,
            isAnonymous: input.anonymous,
            attachmentCount: input.attachmentCount,
            submittedByUserId: input.submittedByUserId,
          },
        });
        await this.notifications.createWithinTransaction(
          transaction as Prisma.TransactionClient,
          {
            recipientUserIds: input.recipientUserIds,
            actorUserId: input.anonymous ? null : input.submittedByUserId,
            sourceModule: 'workbench',
            eventType: 'FEEDBACK_SUBMITTED',
            title: `نظرسنجی جدید برای ${input.departmentLabel}`,
            message: `${input.subject} — ${input.body}`,
            entityType: 'workbench_feedback',
            entityId: input.id,
            href: `/workbench?tab=today&feedback=${encodeURIComponent(input.id)}#workbench-feedback`,
          },
        );
        return receipt(created);
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // A concurrent request may have committed the same id while this
      // transaction was creating it. Read only after rollback/commit.
      const existing = await this.database.client.workbenchFeedback.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw error;
      verifyReplay(existing);
      return receipt(existing);
    }
  }
}
