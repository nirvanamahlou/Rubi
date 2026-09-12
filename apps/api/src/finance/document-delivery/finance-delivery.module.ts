import { NotificationsModule } from '../../notifications/notifications.module';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Module,
  NotFoundException,
} from '@nestjs/common';
import type {
  FinanceSupplierPaymentCommandV1,
  ReservationServicePurchaseV1,
  SalesReservationRequestV1,
  SupplierPurchaseGateV1,
  TravelDeliveryAuthorizationV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FinanceDeliveryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  private presentPurchase(row: {
    id: string;
    version: number;
    serviceClientKey: string;
    serviceKind: string;
    serviceTitleSnapshot: string;
    supplierOrganizationId: string;
    supplierNameSnapshot: string;
    amount: { toString(): string };
    currencyCode: string;
    actorUserId: string;
    createdAt: Date;
    financeRevisions: Array<{
      version: number;
      status: 'PAID' | 'REJECTED';
      bankId: string | null;
      transferAt: Date | null;
      paymentReference: string | null;
      reason: string;
      actorUserId: string;
      createdAt: Date;
    }>;
  }): ReservationServicePurchaseV1 {
    const finance = row.financeRevisions[0];
    return {
      id: row.id,
      version: row.version,
      serviceClientKey: row.serviceClientKey,
      serviceKind: row.serviceKind,
      serviceTitle: row.serviceTitleSnapshot,
      supplierOrganizationId: row.supplierOrganizationId,
      supplierName: row.supplierNameSnapshot,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      actorUserId: row.actorUserId,
      createdAt: row.createdAt.toISOString(),
      finance: finance
        ? {
            version: finance.version,
            status: finance.status,
            bankId: finance.bankId,
            transferAt: finance.transferAt?.toISOString() ?? null,
            paymentReference: finance.paymentReference,
            reason: finance.reason,
            updatedAt: finance.createdAt.toISOString(),
            updatedByUserId: finance.actorUserId,
          }
        : {
            version: 0,
            status: 'PENDING',
            bankId: null,
            transferAt: null,
            paymentReference: null,
            reason: '',
            updatedAt: null,
            updatedByUserId: null,
          },
    };
  }

  async supplierPurchaseGate(
    intakeId: string,
  ): Promise<SupplierPurchaseGateV1> {
    const intake = await this.database.client.reservationIntake.findUnique({
      where: { id: intakeId },
      include: {
        servicePurchases: {
          orderBy: { version: 'desc' },
          include: {
            financeRevisions: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
      },
    });
    if (!intake) throw new NotFoundException('درخواست رزرواسیون یافت نشد.');
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const latest = new Map<string, (typeof intake.servicePurchases)[number]>();
    for (const purchase of intake.servicePurchases)
      if (!latest.has(purchase.serviceClientKey))
        latest.set(purchase.serviceClientKey, purchase);
    const missingServiceTitles = snapshot.serviceSelections
      .filter((service) => !latest.has(service.clientKey))
      .map((service) => service.titleSnapshot);
    const purchases = [...latest.values()].map((row) =>
      this.presentPurchase(row),
    );
    const unpaidServiceTitles = purchases
      .filter((purchase) => purchase.finance.status !== 'PAID')
      .map((purchase) => purchase.serviceTitle);
    return {
      complete:
        missingServiceTitles.length === 0 && unpaidServiceTitles.length === 0,
      requiredServiceCount: snapshot.serviceSelections.length,
      missingServiceTitles,
      unpaidServiceTitles,
      purchases,
    };
  }

  async updateSupplierPayment(
    intakeId: string,
    purchaseId: string,
    command: FinanceSupplierPaymentCommandV1,
    actorUserId: string,
  ) {
    const paid = command?.status === 'PAID';
    const transferAt = paid ? new Date(command.transferAt ?? '') : null;
    if (
      !command ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      !['PAID', 'REJECTED'].includes(command.status) ||
      typeof command.reason !== 'string' ||
      !command.reason.trim() ||
      command.reason.trim().length > 500 ||
      (paid &&
        (!command.bankId ||
          Number.isNaN(transferAt?.getTime()) ||
          !command.paymentReference?.trim() ||
          command.paymentReference.trim().length > 160))
    )
      throw new BadRequestException('اطلاعات پرداخت کارگزار معتبر نیست.');
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${purchaseId}, 0))`,
      );
      const purchase = await tx.reservationServicePurchase.findFirst({
        where: { id: purchaseId, intakeId },
      });
      if (!purchase) throw new NotFoundException('خرید خدمت یافت نشد.');
      if (paid) {
        const bank = await tx.masterBank.findFirst({
          where: { id: command.bankId!, isActive: true },
        });
        if (!bank)
          throw new BadRequestException('بانک فعال انتخاب‌شده معتبر نیست.');
      }
      const current = await tx.financeSupplierPaymentRevision.findFirst({
        where: { purchaseId },
        orderBy: { version: 'desc' },
      });
      if ((current?.version ?? 0) !== command.expectedVersion)
        throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
      const row = await tx.financeSupplierPaymentRevision.create({
        data: {
          purchaseId,
          version: command.expectedVersion + 1,
          status: command.status,
          bankId: paid ? command.bankId! : null,
          transferAt: paid ? transferAt : null,
          paymentReference: paid ? command.paymentReference!.trim() : null,
          reason: command.reason.trim(),
          actorUserId,
        },
      });
      return {
        version: row.version,
        status: row.status,
        bankId: row.bankId,
        transferAt: row.transferAt?.toISOString() ?? null,
        paymentReference: row.paymentReference,
        reason: row.reason,
        updatedAt: row.createdAt.toISOString(),
        updatedByUserId: row.actorUserId,
      };
    });
  }
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
      if (command.approved) {
        const intake = await tx.reservationIntake.findUnique({
          where: { id: intakeId },
          include: {
            servicePurchases: {
              orderBy: { version: 'desc' },
              include: {
                financeRevisions: { orderBy: { version: 'desc' }, take: 1 },
              },
            },
          },
        });
        if (!intake) throw new NotFoundException('درخواست رزرواسیون یافت نشد.');
        const snapshot =
          intake.snapshot as unknown as SalesReservationRequestV1;
        const latest = new Map<
          string,
          (typeof intake.servicePurchases)[number]
        >();
        for (const purchase of intake.servicePurchases)
          if (!latest.has(purchase.serviceClientKey))
            latest.set(purchase.serviceClientKey, purchase);
        const missingServiceTitles = snapshot.serviceSelections
          .filter((service) => !latest.has(service.clientKey))
          .map((service) => service.titleSnapshot);
        const unpaidServiceTitles = [...latest.values()]
          .filter((purchase) => purchase.financeRevisions[0]?.status !== 'PAID')
          .map((purchase) => purchase.serviceTitleSnapshot);
        if (missingServiceTitles.length || unpaidServiceTitles.length) {
          const details = [
            missingServiceTitles.length
              ? `خرید ثبت‌نشده: ${missingServiceTitles.join('، ')}`
              : '',
            unpaidServiceTitles.length
              ? `پرداخت‌نشده: ${unpaidServiceTitles.join('، ')}`
              : '',
          ]
            .filter(Boolean)
            .join('؛ ');
          throw new BadRequestException(
            `تحویل مدارک پس از ثبت و پرداخت خرید همه خدمات ممکن است. ${details}`,
          );
        }
      }
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
