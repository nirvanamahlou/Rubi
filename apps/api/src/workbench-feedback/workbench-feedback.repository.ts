import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { WorkbenchFeedbackReceiptV1 } from '@rubi/contracts';
import type { Prisma } from '@rubi/database';

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

  async create(
    input: CreateFeedbackRecord,
  ): Promise<WorkbenchFeedbackReceiptV1> {
    return this.database.client.$transaction(async (transaction) => {
      const existing = await transaction.workbenchFeedback.findUnique({
        where: { id: input.id },
      });
      if (existing) {
        if (
          existing.submittedByUserId !== input.submittedByUserId ||
          existing.requestHash !== input.requestHash
        ) {
          throw new ConflictException(
            'شناسه این ارسال قبلاً برای نظرسنجی دیگری استفاده شده است.',
          );
        }
        return {
          id: existing.id,
          trackingNumber: existing.trackingNumber,
          branchId: existing.branchId,
          department: input.departmentCode,
          subject: existing.subject,
          anonymous: existing.isAnonymous,
          attachmentCount: existing.attachmentCount,
          recipientCount: input.recipientUserIds.length,
          submittedAt: existing.submittedAt.toISOString(),
        };
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
      return {
        id: created.id,
        trackingNumber: created.trackingNumber,
        branchId: created.branchId,
        department: input.departmentCode,
        subject: created.subject,
        anonymous: created.isAnonymous,
        attachmentCount: created.attachmentCount,
        recipientCount: input.recipientUserIds.length,
        submittedAt: created.submittedAt.toISOString(),
      };
    });
  }
}
