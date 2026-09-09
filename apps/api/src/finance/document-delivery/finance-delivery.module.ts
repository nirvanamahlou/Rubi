import { NotificationsModule } from '../../notifications/notifications.module';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import type { TravelDeliveryAuthorizationV1 } from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FinanceDeliveryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  async read(intakeId: string): Promise<TravelDeliveryAuthorizationV1> {
    const row = await this.database.client.financeDeliveryRevision.findFirst({
      where: { intakeId },
      orderBy: { version: 'desc' },
    });
    return row
      ? {
          version: row.version,
          approved: row.approved,
          reason: row.reason,
          updatedAt: row.createdAt.toISOString(),
          updatedByUserId: row.actorUserId,
        }
      : {
          version: 0,
          approved: false,
          reason: '',
          updatedAt: null,
          updatedByUserId: null,
        };
  }
  /** Called only after the requesting module verifies branch and finance authorization. */
  async update(
    intakeId: string,
    command: { expectedVersion: number; approved: boolean; reason: string },
    actorUserId: string,
    salesOwnerUserId: string | null,
    contractId: string,
  ) {
    if (
      !command ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      typeof command.approved !== 'boolean' ||
      typeof command.reason !== 'string' ||
      !command.reason.trim() ||
      command.reason.trim().length > 500
    )
      throw new BadRequestException(
        'وضعیت، نسخه و دلیل تحویل مدارک معتبر نیست.',
      );
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${intakeId}, 0))`,
      );
      const current = await tx.financeDeliveryRevision.findFirst({
        where: { intakeId },
        orderBy: { version: 'desc' },
      });
      if ((current?.version ?? 0) !== command.expectedVersion)
        throw new ConflictException('مجوز مالی هم‌زمان تغییر کرده است.');
      const row = await tx.financeDeliveryRevision.create({
        data: {
          intakeId,
          version: command.expectedVersion + 1,
          approved: command.approved,
          reason: command.reason.trim(),
          actorUserId,
        },
      });
      if (salesOwnerUserId)
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [salesOwnerUserId],
          actorUserId,
          sourceModule: 'finance',
          eventType: command.approved
            ? 'DOCUMENT_DELIVERY_APPROVED'
            : 'DOCUMENT_DELIVERY_REVOKED',
          title: command.approved
            ? 'مجوز تحویل مدارک صادر شد'
            : 'مجوز تحویل مدارک لغو شد',
          message: command.reason.trim(),
          entityType: 'sales_contract',
          entityId: contractId,
          href: '/sales',
        });
      return {
        version: row.version,
        approved: row.approved,
        reason: row.reason,
        updatedAt: row.createdAt.toISOString(),
        updatedByUserId: row.actorUserId,
      };
    });
  }
}
@Module({
  imports: [NotificationsModule],
  providers: [FinanceDeliveryService],
  exports: [FinanceDeliveryService],
})
export class FinanceDeliveryModule {}
