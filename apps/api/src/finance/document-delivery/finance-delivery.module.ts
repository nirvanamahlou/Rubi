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
  FinanceCustomerDocumentDeliveryAuthorizationV1,
  FinanceCustomerDocumentDeliveryCommandV1,
  ReservationServicePurchaseV1,
  SalesReservationRequestV1,
  SupplierPurchaseGateV1,
  TravelDeliveryAuthorizationV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { evaluateFinancialRelease } from '../finance.domain';

const brokerPurchaseServices = (snapshot: SalesReservationRequestV1) =>
  snapshot.serviceSelections.filter(
    (service) => service.kind === 'HOTEL' || service.kind === 'TRANSFER',
  );

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
      status: 'PARTIALLY_PAID' | 'PAID' | 'REJECTED';
      bankId: string | null;
      accountId: string | null;
      account: { title: string; bankId: string | null } | null;
      paymentMethodId: string | null;
      paymentMethod: { name: string } | null;
      cumulativePaid: { toString(): string } | null;
      remainingAmount: { toString(): string } | null;
      exchangeRateToIrr: { toString(): string } | null;
      rialEquivalent: { toString(): string } | null;
      transferAt: Date | null;
      paymentReference: string | null;
      reason: string;
      actorUserId: string;
      createdAt: Date;
    }>;
  }): ReservationServicePurchaseV1 {
    const finance = row.financeRevisions[0];
    const legacyPaid = finance?.status === 'PAID' && !finance.cumulativePaid;
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
            bankId: finance.account?.bankId ?? finance.bankId,
            accountId: finance.accountId,
            accountTitle: finance.account?.title ?? null,
            paymentMethodId: finance.paymentMethodId,
            paymentMethodName: finance.paymentMethod?.name ?? null,
            paidAmount: legacyPaid
              ? row.amount.toString()
              : (finance.cumulativePaid?.toString() ?? '0'),
            remainingAmount: legacyPaid
              ? '0'
              : (finance.remainingAmount?.toString() ?? row.amount.toString()),
            exchangeRateToIrr: finance.exchangeRateToIrr?.toString() ?? null,
            rialEquivalent: finance.rialEquivalent?.toString() ?? null,
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
            accountId: null,
            accountTitle: null,
            paymentMethodId: null,
            paymentMethodName: null,
            paidAmount: '0',
            remainingAmount: row.amount.toString(),
            exchangeRateToIrr: null,
            rialEquivalent: null,
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
            financeRevisions: {
              orderBy: { version: 'desc' },
              include: {
                account: { select: { title: true, bankId: true } },
                paymentMethod: { select: { name: true } },
              },
            },
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
    const requiredServices = brokerPurchaseServices(snapshot);
    const requiredKeys = new Set(
      requiredServices.map((service) => service.clientKey),
    );
    const missingServiceTitles = requiredServices
      .filter((service) => !latest.has(service.clientKey))
      .map((service) => service.titleSnapshot);
    const purchases = [...latest.values()].map((row) =>
      this.presentPurchase(row),
    );
    const unpaidServiceTitles = purchases
      .filter(
        (purchase) =>
          requiredKeys.has(purchase.serviceClientKey) &&
          purchase.finance.status !== 'PAID',
      )
      .map((purchase) => purchase.serviceTitle);
    return {
      complete:
        missingServiceTitles.length === 0 && unpaidServiceTitles.length === 0,
      requiredServiceCount: requiredServices.length,
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
    branchIds?: readonly string[],
  ) {
    const paid = command?.status === 'PAID';
    const transferAt = paid ? new Date(command.transferAt ?? '') : null;
    let paidAmount: Prisma.Decimal | null = null;
    let exchangeRate: Prisma.Decimal | null = null;
    try {
      paidAmount = paid ? new Prisma.Decimal(command.paidAmount ?? '') : null;
      exchangeRate = paid
        ? new Prisma.Decimal(command.exchangeRateToIrr || '1')
        : null;
    } catch {
      throw new BadRequestException('مبلغ یا نرخ ارز معتبر نیست.');
    }
    if (
      !command ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      !['PAID', 'REJECTED'].includes(command.status) ||
      (command.reason !== undefined && typeof command.reason !== 'string') ||
      (command.reason?.trim().length ?? 0) > 500 ||
      (!paid && !command.reason?.trim()) ||
      (paid &&
        (!command.accountId ||
          !command.paymentMethodId ||
          !paidAmount ||
          paidAmount.lte(0) ||
          !exchangeRate ||
          exchangeRate.lte(0) ||
          Number.isNaN(transferAt?.getTime()) ||
          (command.paymentReference?.trim().length ?? 0) > 160))
    )
      throw new BadRequestException('اطلاعات پرداخت کارگزار معتبر نیست.');
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${purchaseId}, 0))`,
      );
      const purchase = await tx.reservationServicePurchase.findFirst({
        where: { id: purchaseId, intakeId },
        include: { intake: { select: { branchId: true } } },
      });
      if (!purchase) throw new NotFoundException('خرید خدمت یافت نشد.');
      if (branchIds && !branchIds.includes(purchase.intake.branchId))
        throw new NotFoundException('خرید خدمت در شعب مجاز یافت نشد.');
      let account: {
        id: string;
        title: string;
        bankId: string | null;
        currencyCode: string;
      } | null = null;
      let paymentMethod: { id: string; name: string } | null = null;
      if (paid) {
        account = await tx.financeSettlementAccount.findFirst({
          where: {
            id: command.accountId!,
            branchId: purchase.intake.branchId,
            isActive: true,
          },
          select: { id: true, title: true, bankId: true, currencyCode: true },
        });
        if (!account || account.currencyCode !== purchase.currencyCode)
          throw new BadRequestException(
            'حساب فعال هم‌ارز برای این پرداخت معتبر نیست.',
          );
        paymentMethod = await tx.masterPaymentMethod.findFirst({
          where: {
            id: command.paymentMethodId!,
            isActive: true,
            direction: { in: ['PAYMENT', 'BOTH'] },
          },
          select: { id: true, name: true },
        });
        if (!paymentMethod)
          throw new BadRequestException('روش پرداخت انتخاب‌شده معتبر نیست.');
        if (purchase.currencyCode !== 'IRR' && !command.exchangeRateToIrr)
          throw new BadRequestException(
            'نرخ روز ارز برای پرداخت ارزی الزامی است.',
          );
      }
      const current = await tx.financeSupplierPaymentRevision.findFirst({
        where: { purchaseId },
        orderBy: { version: 'desc' },
      });
      if ((current?.version ?? 0) !== command.expectedVersion)
        throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
      const alreadyPaid = current?.cumulativePaid
        ? new Prisma.Decimal(current.cumulativePaid)
        : current?.status === 'PAID'
          ? new Prisma.Decimal(purchase.amount)
          : new Prisma.Decimal(0);
      if (!paid && alreadyPaid.gt(0))
        throw new ConflictException(
          'خریدی که بخشی از آن پرداخت شده قابل برگشت نیست.',
        );
      const remainingBefore = new Prisma.Decimal(purchase.amount).sub(
        alreadyPaid,
      );
      if (paidAmount?.gt(remainingBefore))
        throw new BadRequestException('مبلغ پرداخت از مانده خرید بیشتر است.');
      const cumulativePaid = paid ? alreadyPaid.add(paidAmount!) : alreadyPaid;
      const remainingAmount = new Prisma.Decimal(purchase.amount).sub(
        cumulativePaid,
      );
      const nextStatus = paid
        ? remainingAmount.eq(0)
          ? 'PAID'
          : 'PARTIALLY_PAID'
        : 'REJECTED';
      const row = await tx.financeSupplierPaymentRevision.create({
        data: {
          purchaseId,
          version: command.expectedVersion + 1,
          status: nextStatus,
          bankId: paid ? account!.bankId : null,
          accountId: paid ? account!.id : null,
          paymentMethodId: paid ? paymentMethod!.id : null,
          paidAmount: paid ? paidAmount : null,
          exchangeRateToIrr: paid ? exchangeRate : null,
          rialEquivalent: paid ? paidAmount!.mul(exchangeRate!) : null,
          cumulativePaid,
          remainingAmount,
          transferAt: paid ? transferAt : null,
          paymentReference: paid
            ? command.paymentReference?.trim() || null
            : null,
          reason: command.reason?.trim() || '',
          actorUserId,
        },
      });
      return {
        version: row.version,
        status: row.status,
        bankId: row.bankId,
        accountId: row.accountId,
        accountTitle: account?.title ?? null,
        paymentMethodId: row.paymentMethodId,
        paymentMethodName: paymentMethod?.name ?? null,
        paidAmount: row.cumulativePaid?.toString() ?? '0',
        remainingAmount:
          row.remainingAmount?.toString() ?? purchase.amount.toString(),
        exchangeRateToIrr: row.exchangeRateToIrr?.toString() ?? null,
        rialEquivalent: row.rialEquivalent?.toString() ?? null,
        transferAt: row.transferAt?.toISOString() ?? null,
        paymentReference: row.paymentReference,
        reason: row.reason,
        updatedAt: row.createdAt.toISOString(),
        updatedByUserId: row.actorUserId,
      };
    });
  }
  async readCustomerContract(
    contractId: string,
  ): Promise<FinanceCustomerDocumentDeliveryAuthorizationV1> {
    const row =
      await this.database.client.financeCustomerDocumentDeliveryRevision.findFirst(
        {
          where: { contractId },
          orderBy: { version: 'desc' },
        },
      );
    return row
      ? {
          version: row.version,
          approved: row.approved,
          basis:
            row.basis as FinanceCustomerDocumentDeliveryAuthorizationV1['basis'],
          reason: row.reason,
          exceptionExpiresAt: row.exceptionExpiresAt?.toISOString() ?? null,
          updatedAt: row.createdAt.toISOString(),
          updatedByUserId: row.actorUserId,
        }
      : {
          version: 0,
          approved: false,
          basis: null,
          reason: '',
          exceptionExpiresAt: null,
          updatedAt: null,
          updatedByUserId: null,
        };
  }

  async updateCustomerContract(
    command: FinanceCustomerDocumentDeliveryCommandV1,
    facts: {
      contractId: string;
      branchId: string;
      salesOwnerUserId: string;
      hasConfirmedPayment: boolean;
      fullySettled: boolean;
    },
    actor: { userId: string; permissions: readonly string[] },
  ): Promise<FinanceCustomerDocumentDeliveryAuthorizationV1> {
    const reason = command?.reason?.trim() ?? '';
    const basis = command?.basis;
    const isUuid = (value: string | null | undefined) =>
      !!value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    if (
      !command ||
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 0 ||
      typeof command.approved !== 'boolean' ||
      !['AFTER_RECEIPT', 'FULL_SETTLEMENT', 'MANAGER_EXCEPTION'].includes(
        basis,
      ) ||
      !reason ||
      reason.length > 500
    )
      throw new BadRequestException('مجوز تحویل مدارک مشتری معتبر نیست.');
    if (
      command.approved &&
      basis === 'AFTER_RECEIPT' &&
      !facts.hasConfirmedPayment
    )
      throw new BadRequestException(
        'ابتدا حداقل یک پرداخت مشتری باید توسط مالی تأیید شود.',
      );
    if (command.approved && basis === 'FULL_SETTLEMENT' && !facts.fullySettled)
      throw new BadRequestException(
        'صدور مجوز بر مبنای تسویه کامل فقط پس از تسویه کامل قرارداد ممکن است.',
      );
    if (command.approved && basis === 'MANAGER_EXCEPTION') {
      if (!isUuid(command.secondApproverReference))
        throw new BadRequestException('تأییدکننده دوم استثنا معتبر نیست.');
      const evaluation = evaluateFinancialRelease(
        {
          fullySettled: facts.fullySettled,
          approvedCreditAvailable: false,
          approvedPaymentPlanActive: false,
          validCheckAvailable: false,
        },
        {
          requestedStatus: 'CONDITIONAL',
          basis: 'MANAGER_EXCEPTION',
          reason,
          makerReference: actor.userId,
          secondApproverReference: command.secondApproverReference ?? null,
          exceptionExpiresAt: command.exceptionExpiresAt ?? null,
          now: new Date().toISOString(),
          makerPermissions: actor.permissions,
        },
      );
      if (!evaluation.allowed)
        throw new BadRequestException(
          'مجوز استثنایی مدیر معتبر نیست: ' + evaluation.reasons.join(' '),
        );
    }
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${facts.contractId}, 0))`,
      );
      const current =
        await tx.financeCustomerDocumentDeliveryRevision.findFirst({
          where: { contractId: facts.contractId },
          orderBy: { version: 'desc' },
        });
      if ((current?.version ?? 0) !== command.expectedVersion)
        throw new ConflictException('مجوز تحویل مدارک هم‌زمان تغییر کرده است.');
      const expiry =
        basis === 'MANAGER_EXCEPTION' && command.exceptionExpiresAt
          ? new Date(command.exceptionExpiresAt)
          : null;
      const row = await tx.financeCustomerDocumentDeliveryRevision.create({
        data: {
          contractId: facts.contractId,
          branchId: facts.branchId,
          version: command.expectedVersion + 1,
          approved: command.approved,
          basis,
          reason,
          secondApproverRef:
            basis === 'MANAGER_EXCEPTION'
              ? (command.secondApproverReference ?? null)
              : null,
          exceptionExpiresAt: expiry,
          actorUserId: actor.userId,
        },
      });
      await this.notifications.createWithinTransaction(tx, {
        recipientUserIds: [facts.salesOwnerUserId],
        actorUserId: actor.userId,
        sourceModule: 'finance',
        eventType: command.approved
          ? 'CUSTOMER_DOCUMENT_DELIVERY_APPROVED'
          : 'CUSTOMER_DOCUMENT_DELIVERY_REVOKED',
        title: command.approved
          ? 'مجوز تحویل مدارک مشتری صادر شد'
          : 'مجوز تحویل مدارک مشتری لغو شد',
        message: reason,
        entityType: 'sales_contract',
        entityId: facts.contractId,
        href: '/sales',
      });
      return {
        version: row.version,
        approved: row.approved,
        basis:
          row.basis as FinanceCustomerDocumentDeliveryAuthorizationV1['basis'],
        reason: row.reason,
        exceptionExpiresAt: row.exceptionExpiresAt?.toISOString() ?? null,
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
        const requiredServices = brokerPurchaseServices(snapshot);
        const requiredKeys = new Set(
          requiredServices.map((service) => service.clientKey),
        );
        const missingServiceTitles = requiredServices
          .filter((service) => !latest.has(service.clientKey))
          .map((service) => service.titleSnapshot);
        const unpaidServiceTitles = [...latest.values()]
          .filter(
            (purchase) =>
              requiredKeys.has(purchase.serviceClientKey) &&
              purchase.financeRevisions[0]?.status !== 'PAID',
          )
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
