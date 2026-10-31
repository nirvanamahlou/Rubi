import { grossAccrualCovers } from '../accounting/accounting.workflows';
import { lockCustomerSettlement } from '../../sales/customer-purchase-settlement.public';
import {
  lockReceiptFunds,
  reservedReceiptRefunds,
} from '../accounting/receipt-funds.public';
import {
  receiptAllocationSource,
  unallocatedReceiptAmount,
} from '../../sales/sales-receipt-allocation.public';
import { financialDate } from '../accounting/accounting.financial-events';
import { assertFinancialProofVersion } from '../../documents/financial-proof.public';
import { PETTY_KINDS, pettyBalance, lockPettyFund } from './finance.petty-cash';
import {
  recordFinancialEvent,
  isNewAccountingSource,
} from '../accounting/financial-event.public';
import { isOptionalOperationReason } from '@nora/contracts';
import { createHash } from 'node:crypto';
import { paymentSource } from '../payments/payment-source';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { HrPayrollFinancePublicService } from '../../hr/hr-payroll-finance-public.service';
import * as validate from '../../hr/hr.validation';
import { SalesService } from '../../sales/sales.service';
import { DocumentsService } from '../../documents/documents.service';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { MasterOrganizationDirectory } from '../../master-data/master-organization-directory';
import { PAYROLL_WORKSHEET_KIND } from './payroll-worksheet.public';
import { payrollWorksheetPaymentSource } from '../../hr/hr-payroll-worksheet.public';

@Injectable()
export class FinancePayrollService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(HrPayrollFinancePublicService)
    private readonly hr: HrPayrollFinancePublicService,
    @Optional() @Inject(SalesService) private readonly sales?: SalesService,
    @Optional()
    @Inject(DocumentsService)
    private readonly documents?: DocumentsService,
    @Optional()
    @Inject(MasterProcurementDirectory)
    private readonly master?: MasterProcurementDirectory,
    @Optional()
    @Inject(MasterOrganizationDirectory)
    private readonly partners?: MasterOrganizationDirectory,
  ) {}
  async detail(id: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException('مجوز مشاهده مالی لازم است.');
    const row = await this.database.client.financeOperationalRequest.findFirst({
      where: {
        id: validate.uuid(id),
        branchId: { in: actor.branchIds },
      },
      include: { revisions: { orderBy: { version: 'asc' } } },
    });
    if (!row) throw new NotFoundException('درخواست حقوق یافت نشد.');
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      title: row.title,
      party: row.party,
      description: row.description,
      reference: row.reference,
      requesterId: row.requesterId,
      documentId: row.documentId,
      dueAt: row.dueAt.toISOString(),
      kind: row.kind,
      pettyFundId: row.pettyFundId,
      pettyBalance:
        row.kind === 'PETTY_CASH_ADVANCE'
          ? Object.fromEntries(
              Object.entries(
                await pettyBalance(this.database.client, row.id),
              ).map(([k, v]) => [k, v.toString()]),
            )
          : null,
      remainingAmount: row.revisions.at(-1)!.remainingAmount.toString(),
      revisions: row.revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        action: revision.action,
        reason: revision.reason,
        status: revision.toStatus,
        paidAmount: revision.paidAmount?.toString() ?? null,
        remainingAmount: revision.remainingAmount.toString(),
        createdAt: revision.createdAt.toISOString(),
        actorId: revision.actorId,
      })),
    };
  }
  async action(id: string, body: unknown, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException('مجوز مشاهده مالی لازم است.');
    const input = validate.object(body, [
      'operationId',
      'expectedVersion',
      'action',
      'reason',
      'paidAmount',
      'accountId',
      'payingSupplierId',
      'methodId',
      'transferAt',
      'paymentReference',
    ]);
    const operationId = validate.uuid(input.operationId),
      expectedVersion = validate.version(input.expectedVersion);
    const action = validate.text(input.action, 'عملیات', 24),
      reason = validate.text(input.reason, 'علت', 2000, true);
    const transitions: Record<string, { from: string[]; to: string }> = {
      REVIEW: { from: ['NEW'], to: 'UNDER_REVIEW' },
      APPROVE: { from: ['UNDER_REVIEW'], to: 'APPROVED' },
      CORRECTION_REQUIRED: {
        from: ['NEW', 'UNDER_REVIEW'],
        to: 'CORRECTION_REQUIRED',
      },
      REJECT: { from: ['NEW', 'UNDER_REVIEW'], to: 'REJECTED' },
      RESUBMIT: { from: ['CORRECTION_REQUIRED'], to: 'NEW' },
      PAY: { from: ['APPROVED', 'PAYING'], to: 'PAYING' },
      CLOSE: { from: ['APPROVED', 'PAYING', 'PAID'], to: 'CLOSED' },
    };
    const transition = transitions[action];
    if (
      !transition ||
      (['CORRECTION_REQUIRED', 'REJECT', 'RESUBMIT'].includes(action) &&
        !isOptionalOperationReason(reason))
    )
      throw new BadRequestException('عملیات یا علت معتبر نیست.');
    if (
      !actor.permissions.includes(
        action === 'PAY' ? 'finance.payment.create' : 'finance.request.manage',
      )
    )
      throw new ForbiddenException('مجوز عملیات مالی لازم است.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ id, actor: actor.userId, input }))
      .digest('hex');
    const initial =
      await this.database.client.financeOperationalRequest.findFirst({
        where: {
          id: validate.uuid(id),
          branchId: { in: actor.branchIds },
        },
      });
    if (!initial) throw new NotFoundException('درخواست حقوق یافت نشد.');
    if (initial.kind === PAYROLL_WORKSHEET_KIND && !initial.hrRecordId)
      throw new ConflictException('منبع درخواست مالی حقوق معتبر نیست.');
    if (
      initial.kind === PAYROLL_WORKSHEET_KIND &&
      ['PAY', 'RESUBMIT'].includes(action)
    )
      throw new BadRequestException(
        'جدول حقوق از منابع انسانی اصلاح و ارسال می‌شود؛ این درخواست فقط برای تأیید مالی است.',
      );
    const completed =
      await this.database.client.financeOperationalRevision.findUnique({
        where: { id: operationId },
      });
    if (completed) {
      if (completed.fingerprint !== fingerprint || completed.requestId !== id)
        throw new ConflictException(
          'شناسه عملیات با اطلاعات دیگری استفاده شده است.',
        );
      return this.detail(id, actor);
    }
    if (
      initial.kind === 'PETTY_CASH_RETURN' &&
      action === 'PAY' &&
      !actor.permissions.includes('finance.receipt.approve')
    )
      throw new ForbiddenException('مجوز تأیید دستی دریافت وجه لازم است.');
    const source =
      initial.kind === PAYROLL_WORKSHEET_KIND && initial.hrRecordId
        ? await payrollWorksheetPaymentSource(
            this.database.client,
            initial.hrRecordId,
            actor.branchIds,
          )
        : initial.hrRecordId
          ? await this.hr.approvedSource(initial.hrRecordId, actor.branchIds)
          : {
              id: initial.id,
              version: initial.sourceVersion ?? 1,
              amount: initial.amount.toString(),
              currencyCode: initial.currencyCode,
            };
    const refundReceipt = initial.refundReceiptId
      ? (
          await this.sales?.financeReceiptHistory(
            { ...actor, branchIds: [initial.branchId] },
            { id: initial.refundReceiptId },
            1,
          )
        )?.[0]
      : null;
    if (initial.refundReceiptId && !refundReceipt)
      throw new ConflictException('دریافت مبنای استرداد دیگر تأییدشده نیست.');
    if (
      source.version !== initial.sourceVersion ||
      source.amount !== initial.amount.toString() ||
      source.currencyCode !== initial.currencyCode
    )
      throw new ConflictException('منبع حقوق تغییر کرده است.');
    let expenseVersionId: string | null = null;
    if (initial.kind === 'PETTY_CASH_EXPENSE' && action === 'APPROVE') {
      if (!initial.documentId)
        throw new ConflictException('مدرک هزینه تنخواه الزامی است.');
      const proof = await this.documents?.detail(
        initial.documentId,
        { ...actor, branchIds: [initial.branchId] },
        {},
      );
      if (!proof?.data.currentVersion.id)
        throw new ConflictException('نسخه مدرک هزینه در دسترس نیست.');
      expenseVersionId = proof.data.currentVersion.id;
    }
    try {
      await this.database.client.$transaction(async (tx) => {
        if (initial.kind === 'PAYROLL' && action === 'APPROVE')
          await tx.$queryRaw`SELECT id FROM accounting_books WHERE "branchId"=${initial.branchId}::uuid AND active=true AND "allowsPosting"=true ORDER BY id FOR SHARE`;
        const grossCovered =
          initial.kind === 'PAYROLL' &&
          action === 'APPROVE' &&
          initial.hrRecordId
            ? await grossAccrualCovers(
                tx,
                initial.branchId,
                initial.hrRecordId,
                initial.amount.toString(),
                initial.currencyCode,
              )
            : false;

        const replay = await tx.financeOperationalRevision.findUnique({
          where: { id: operationId },
        });
        if (replay) {
          if (replay.fingerprint !== fingerprint || replay.requestId !== id)
            throw new ConflictException(
              'شناسه عملیات با اطلاعات دیگری استفاده شده است.',
            );
          return;
        }
        if (initial.refundReceiptId) {
          await lockReceiptFunds(tx, initial.refundReceiptId);
          const repeated = await tx.financeOperationalRevision.findUnique({
            where: { id: operationId },
          });
          if (repeated) {
            if (
              repeated.fingerprint !== fingerprint ||
              repeated.requestId !== id
            )
              throw new ConflictException(
                'شناسه عملیات با اطلاعات دیگری استفاده شده است.',
              );
            return;
          }
          const sourceReceipt = await receiptAllocationSource(
            tx,
            initial.refundReceiptId,
            [initial.branchId],
          );
          await lockCustomerSettlement(tx, sourceReceipt.contractId, [
            initial.branchId,
          ]);
        }
        const isPetty = PETTY_KINDS.includes(initial.kind);
        const fundId = initial.pettyFundId ?? initial.id;
        if (isPetty)
          await tx.$queryRaw`SELECT id FROM finance_operational_requests WHERE id=${fundId}::uuid FOR UPDATE`;
        const current = await tx.financeOperationalRequest.findUniqueOrThrow({
          where: { id },
          include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (
          current.version !== expectedVersion ||
          !transition.from.includes(current.status)
        )
          throw new ConflictException('وضعیت یا نسخه درخواست تغییر کرده است.');
        if (action === 'RESUBMIT' && current.requesterId !== actor.userId)
          throw new ForbiddenException(
            'بازارسال فقط توسط درخواست‌کننده مجاز است.',
          );
        if (action === 'APPROVE' && current.requesterId === actor.userId)
          throw new ForbiddenException(
            'تأیید درخواست مالی باید توسط شخص دیگری انجام شود.',
          );
        if (action === 'CLOSE') {
          if (current.kind !== 'PETTY_CASH_ADVANCE')
            throw new BadRequestException(
              'بستن حساب فقط برای تنخواه اصلی است.',
            );
          const balance = await pettyBalance(tx, current.id);
          const pending = await tx.financeOperationalRequest.count({
            where: {
              pettyFundId: current.id,
              status: { notIn: ['PAID', 'REJECTED', 'CANCELLED'] },
            },
          });
          if (!balance.available.isZero() || pending)
            throw new ConflictException(
              'برای بستن تنخواه، مانده باید صفر و درخواست‌های وابسته تعیین تکلیف شده باشند.',
            );
        }
        const referenceSource =
          current.pettyFundId && ['PAY', 'APPROVE'].includes(action)
            ? await lockPettyFund(
                tx,
                current.pettyFundId,
                current.branchId,
                current.currencyCode,
              )
            : current;
        const referenceDate = referenceSource.createdAt
          ? financialDate(referenceSource.createdAt)
          : undefined;
        const last = current.revisions[0]!;
        if (current.refundReceiptId && action === 'RESUBMIT') {
          const sourceReceipt = await receiptAllocationSource(
            tx,
            current.refundReceiptId,
            [current.branchId],
          );
          const reserved = await reservedReceiptRefunds(
            tx,
            current.refundReceiptId,
          );
          const outstanding = Prisma.Decimal.max(
            0,
            current.amount.sub(last.cumulativePaid),
          );
          if (
            outstanding.gt(
              unallocatedReceiptAmount(sourceReceipt).sub(reserved),
            )
          )
            throw new ConflictException(
              'پس از تخصیص و رزرو استرداد، وجه کافی برای بازگشایی درخواست وجود ندارد.',
            );
        }

        let paidAmount: Prisma.Decimal | null = null,
          accountId: string | null = null,
          methodId: string | null = null,
          transferAt: Date | null = null;
        let methodName: string | null = null;
        let payingSupplierId: string | null = null;
        let payingSupplierName: string | null = null;
        let cumulativePaid = last.cumulativePaid,
          remainingAmount = last.remainingAmount,
          status = transition.to;
        if (action === 'APPROVE' && current.kind === 'PETTY_CASH_EXPENSE') {
          const created = await tx.financeOperationalRevision.findFirst({
            where: { requestId: id, action: 'CREATE' },
            orderBy: { version: 'asc' },
          });
          const snapshot = created?.snapshot as
            { documentVersionId?: string } | undefined;
          if (
            !expenseVersionId ||
            snapshot?.documentVersionId !== expenseVersionId
          )
            throw new ConflictException(
              'نسخه مدرک هزینه از زمان ثبت تغییر کرده است؛ درخواست اصلاح‌شده ثبت کنید.',
            );
          await assertFinancialProofVersion(tx, {
            documentId: current.documentId!,
            versionId: expenseVersionId,
            branchId: current.branchId,
          });
          const balance = await pettyBalance(tx, fundId);
          if (current.amount.gt(balance.available))
            throw new ConflictException(
              'هزینه از مانده تأییدشده تنخواه بیشتر است.',
            );
          status = 'PAID';
          cumulativePaid = current.amount;
          remainingAmount = new Prisma.Decimal(0);
        }
        if (action === 'PAY') {
          if (current.kind === 'PETTY_CASH_EXPENSE')
            throw new BadRequestException(
              'هزینه تنخواه با تأیید مدرک ثبت می‌شود و پرداخت بانکی دوباره ندارد.',
            );
          if (isPetty && input.payingSupplierId)
            throw new BadRequestException(
              'عملیات تنخواه باید با حساب واقعی هم‌ارز ثبت شود.',
            );
          const text = validate.text(input.paidAmount, 'مبلغ پرداخت', 30);
          if (!/^\d{1,20}(\.\d{1,4})?$/.test(text))
            throw new BadRequestException('مبلغ معتبر نیست.');
          paidAmount = new Prisma.Decimal(text);
          if (!paidAmount.isPositive() || paidAmount.gt(remainingAmount))
            throw new BadRequestException(
              'مبلغ باید مثبت و حداکثر برابر مانده باشد.',
            );
          methodId = validate.uuid(input.methodId);
          const source = await paymentSource(
            tx,
            this.master,
            {
              accountId: input.accountId
                ? validate.uuid(input.accountId)
                : null,
              payingSupplierId: input.payingSupplierId
                ? validate.uuid(input.payingSupplierId)
                : null,
            },
            current.currencyCode,
            current.branchId,
            isPetty ? 'ACCOUNT_ONLY' : 'SUPPLIER_FOR_FOREIGN',
          );
          accountId = source.account?.id ?? null;
          payingSupplierId = source.payingSupplierId;
          payingSupplierName = source.payingSupplierName;
          const method =
            current.kind === 'PETTY_CASH_RETURN'
              ? await this.master?.activeIncomingPaymentMethod(methodId, tx)
              : await this.master?.activeOutgoingPaymentMethod(methodId, tx);
          if (!method)
            throw new BadRequestException(
              'حساب هم‌ارز فعال یا روش پرداخت معتبر نیست.',
            );
          methodName = method.name;
          const instant = validate.text(input.transferAt, 'زمان UTC', 30);
          if (
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(instant) ||
            !Number.isFinite(Date.parse(instant))
          )
            throw new BadRequestException('زمان UTC معتبر لازم است.');
          transferAt = new Date(instant);
          if (
            transferAt.toISOString().replace('.000Z', 'Z') !==
            instant.replace('.000Z', 'Z')
          )
            throw new BadRequestException('زمان پرداخت معتبر نیست.');
          if (isPetty) {
            const balance = await pettyBalance(tx, fundId);
            if (
              current.kind === 'PETTY_CASH_RETURN' &&
              paidAmount.gt(balance.available)
            )
              throw new ConflictException(
                'مبلغ بازگشت از مانده تنخواه بیشتر است.',
              );
            if (current.kind === 'PETTY_CASH_TOPUP') {
              const fund = await lockPettyFund(
                tx,
                fundId,
                current.branchId,
                current.currencyCode,
              );
              if (balance.available.add(paidAmount).gt(fund.amount))
                throw new ConflictException(
                  'شارژ مجدد از سقف نگهداری مصوب تنخواه بیشتر می‌شود.',
                );
            }
          }
          cumulativePaid = cumulativePaid.add(paidAmount);
          remainingAmount = remainingAmount.sub(paidAmount);
          status = remainingAmount.isZero() ? 'PAID' : 'PAYING';
        }
        const updated = await tx.financeOperationalRequest.updateMany({
          where: { id, version: expectedVersion },
          data: { version: { increment: 1 }, status },
        });
        if (updated.count !== 1)
          throw new ConflictException('درخواست هم‌زمان تغییر کرده است.');
        await tx.financeOperationalRevision.create({
          data: {
            id: operationId,
            requestId: id,
            actorId: actor.userId,
            version: expectedVersion + 1,
            action,
            fromStatus: current.status,
            toStatus: status,
            reason,
            fingerprint,
            snapshot: {
              sourceId: source.id,
              sourceVersion: source.version,
              methodName,
              payingSupplierName,
            },
            paidAmount,
            cumulativePaid,
            remainingAmount,
            accountId,
            payingSupplierId,
            methodId,
            transferAt,
            paymentReference:
              validate.text(input.paymentReference, 'شماره رسید', 160, true) ||
              null,
          },
        });
        if (
          action === 'APPROVE' &&
          !grossCovered &&
          ['PAYROLL', 'COMMISSION', 'ADJUSTMENT'].includes(current.kind) &&
          (await isNewAccountingSource(tx, current.createdAt))
        )
          await recordFinancialEvent(tx, {
            source: 'OPERATIONAL',
            recordId: operationId,
            requestId: id,
            ...(referenceDate ? { trackingDate: referenceDate } : {}),
            kind:
              current.kind === 'PAYROLL'
                ? 'PAYROLL_NET_APPROVED'
                : `${current.kind}_APPROVED`,
            branchId: current.branchId,
            actorId: actor.userId,
            occurredAt: new Date(),
            amount: current.amount.toString(),
            currency: current.currencyCode,
            partyId:
              current.payrollEmployeeId ??
              current.counterpartyOrganizationId ??
              id,
            reference: current.reference,
          });
        if (action === 'APPROVE' && current.kind === 'PETTY_CASH_EXPENSE')
          await recordFinancialEvent(tx, {
            source: 'OPERATIONAL',
            recordId: operationId,
            requestId: id,
            kind: 'PETTY_CASH_EXPENSE_POSTED',
            trackingNumber: fundId,
            ...(referenceDate ? { trackingDate: referenceDate } : {}),
            branchId: current.branchId,
            actorId: actor.userId,
            occurredAt: new Date(),
            amount: current.amount.toString(),
            currency: current.currencyCode,
            partyId: fundId,
            reference: current.reference,
          });
        if (action === 'PAY' && paidAmount && current.refundReceiptId) {
          if (!this.sales)
            throw new ConflictException('سرویس تسویه فروش در دسترس نیست.');
          await this.sales.applyFinanceRefund(tx, {
            paymentId: current.refundReceiptId,
            operationId,
            actorId: actor.userId,
            amount: paidAmount.toString(),
            currency: current.currencyCode,
            branchId: current.branchId,
          });
        }
        const refundBasis = current.refundReceiptId
          ? await tx.financeAccountingEvent.findUnique({
              where: { sourceKey: `SALES:${current.refundReceiptId}` },
            })
          : null;
        if (refundBasis && refundBasis.branchId !== current.branchId)
          throw new ConflictException(
            'مرجع حسابداری استرداد با شعبه درخواست یکسان نیست.',
          );
        if (action === 'PAY' && paidAmount && transferAt)
          await recordFinancialEvent(tx, {
            source: 'OPERATIONAL',
            recordId: operationId,
            requestId: id,
            kind: `${current.kind}_PAYMENT`,
            trackingNumber: isPetty
              ? fundId
              : (refundBasis?.trackingNumber ??
                refundReceipt?.trackingNumber ??
                id),
            ...((refundBasis?.trackingDate ??
            refundReceipt?.trackingDate ??
            referenceDate)
              ? {
                  trackingDate:
                    refundBasis?.trackingDate ??
                    refundReceipt?.trackingDate ??
                    referenceDate!,
                }
              : {}),
            branchId: current.branchId,
            actorId: actor.userId,
            occurredAt: transferAt,
            amount: paidAmount.toString(),
            currency: current.currencyCode,
            settlementAccountId: accountId,
            partyId: isPetty
              ? fundId
              : `${current.payrollEmployeeId ?? current.counterpartyOrganizationId ?? refundBasis?.partyId ?? refundReceipt?.customerId ?? current.refundReceiptId ?? id}:${payingSupplierId ?? ''}`,
            reference:
              validate.text(input.paymentReference, 'شماره رسید', 160, true) ||
              null,
          });
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2002', 'P2034'].includes(String(error.code))
      ) {
        const replay =
          await this.database.client.financeOperationalRevision.findUnique({
            where: { id: operationId },
          });
        if (!replay || replay.fingerprint !== fingerprint)
          throw new ConflictException('عملیات هم‌زمان تغییر کرده است.');
      } else throw error;
    }
    return this.detail(id, actor);
  }
  async createManual(body: unknown, actor: AuthenticatedActor) {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes('finance.request.manage')
    )
      throw new ForbiddenException('مجوز ثبت درخواست مالی لازم است.');
    const input = validate.object(body, [
      'operationId',
      'branchId',
      'kind',
      'title',
      'party',
      'description',
      'reference',
      'amount',
      'currencyCode',
      'dueAt',
      'refundReceiptId',
      'documentId',
      'counterpartyOrganizationId',
      'counterpartyRole',
      'pettyFundId',
    ]);
    const id = validate.uuid(input.operationId),
      branchId = validate.uuid(input.branchId),
      kind = validate.text(input.kind, 'نوع درخواست', 24);
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دسترسی است.');
    if (
      !['REFUND', 'COMMISSION', 'CHECK', 'ADJUSTMENT', ...PETTY_KINDS].includes(
        kind,
      )
    )
      throw new BadRequestException(
        'نوع درخواست عملیاتی معتبر نیست؛ حقوق فقط از منابع انسانی ارسال می‌شود.',
      );
    const pettyFundId = input.pettyFundId
      ? validate.uuid(input.pettyFundId)
      : null;
    if (
      ['PETTY_CASH_TOPUP', 'PETTY_CASH_EXPENSE', 'PETTY_CASH_RETURN'].includes(
        kind,
      ) !== Boolean(pettyFundId)
    )
      throw new BadRequestException(
        'درخواست هزینه، شارژ یا بازگشت تنخواه باید به تنخواه اصلی متصل باشد.',
      );
    if (kind === 'PETTY_CASH_EXPENSE' && !input.documentId)
      throw new BadRequestException('مدرک هزینه تنخواه الزامی است.');
    const counterpartyOrganizationId = input.counterpartyOrganizationId
      ? validate.uuid(input.counterpartyOrganizationId)
      : null;
    const counterpartyRole = input.counterpartyRole;
    let canonicalParty: string | null = null;
    if (Boolean(counterpartyOrganizationId) !== Boolean(counterpartyRole))
      throw new BadRequestException(
        'شناسه و نقش طرف همکاری باید با هم ثبت شوند.',
      );
    if (counterpartyOrganizationId) {
      if (
        kind === 'REFUND' ||
        (counterpartyRole !== 'SUPPLIER' && counterpartyRole !== 'BROKER')
      )
        throw new BadRequestException(
          'نوع درخواست یا نقش طرف همکاری معتبر نیست.',
        );
      const partner = await this.partners?.cooperationReference(
        counterpartyOrganizationId,
        counterpartyRole,
      );
      if (!partner?.isActive)
        throw new BadRequestException(
          'طرف همکاری فعال با نقش انتخاب‌شده یافت نشد.',
        );
      canonicalParty = partner.legalName;
    }
    const title = validate.text(input.title, 'عنوان', 200),
      party = canonicalParty ?? validate.text(input.party, 'ذی‌نفع', 200),
      description = validate.text(input.description, 'توضیحات', 2000, true),
      reference = validate.text(
        input.reference,
        'قرارداد، فاکتور یا چک مرجع',
        160,
        true,
      );
    if (kind === 'CHECK' && !reference.trim())
      throw new BadRequestException('شماره چک الزامی است.');
    const text = validate.text(input.amount, 'مبلغ', 30),
      currencyCode = validate.text(input.currencyCode, 'ارز', 3);
    if (
      !/^\d{1,20}(\.\d{1,4})?$/.test(text) ||
      !/^[A-Z]{3}$/.test(currencyCode)
    )
      throw new BadRequestException('مبلغ یا ارز معتبر نیست.');
    const amount = new Prisma.Decimal(text);
    if (!amount.isPositive())
      throw new BadRequestException('مبلغ درخواست باید مثبت باشد.');
    if (!this.master)
      throw new BadRequestException('سرویس عمومی ارز در دسترس نیست.');
    await this.master.assertCurrency(currencyCode);
    const date = validate.text(input.dueAt, 'سررسید', 10);
    validate.isoDate(date, 'سررسید');
    const dueAt = new Date(`${date}T20:29:59.999Z`);
    const refundReceiptId = input.refundReceiptId
      ? validate.uuid(input.refundReceiptId)
      : null;
    if ((kind === 'REFUND') !== Boolean(refundReceiptId))
      throw new BadRequestException(
        'استرداد باید به یک دریافت تأییدشده متصل باشد.',
      );
    const receipt = refundReceiptId
      ? (
          await this.sales?.financeReceiptHistory(
            { ...actor, branchIds: [branchId] },
            { id: refundReceiptId },
            1,
          )
        )?.[0]
      : null;
    if (refundReceiptId && (!receipt || receipt.currencyCode !== currencyCode))
      throw new BadRequestException(
        'دریافت هم‌ارز تأییدشده در همان شعبه یافت نشد.',
      );
    const documentId = input.documentId
      ? validate.uuid(input.documentId)
      : null;
    let documentVersionId: string | null = null;
    if (documentId) {
      if (counterpartyOrganizationId)
        await this.documents?.assertOrganizationProofReference(
          {
            documentId,
            organizationId: counterpartyOrganizationId,
            branchId,
            allowPendingScan: false,
          },
          actor,
        );
      const document = await this.documents?.detail(
        documentId,
        { ...actor, branchIds: [branchId] },
        {},
      );
      if (
        !document ||
        document.data.branchId !== branchId ||
        document.data.currentVersion.scanStatus !== 'CLEAN' ||
        document.data.archiveStatus !== 'ACTIVE' ||
        document.data.isIncomplete
      )
        throw new BadRequestException(
          'سند کامل و مجاز با نسخه پاک در همان شعبه لازم است.',
        );
      documentVersionId = document.data.currentVersion.id;
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ actor: actor.userId, input }))
      .digest('hex');
    try {
      return await this.database.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`finance-create:${receipt?.id ?? id.toLowerCase()}`}, 0))::text`;
        const existing = await tx.financeOperationalRequest.findUnique({
          where: { id },
        });
        if (existing) {
          if (
            existing.createFingerprint !== fingerprint ||
            existing.requesterId !== actor.userId
          )
            throw new ConflictException(
              'شناسه ثبت با اطلاعات دیگری استفاده شده است.',
            );
          return { requestId: existing.id, status: existing.status };
        }
        if (pettyFundId)
          await lockPettyFund(tx, pettyFundId, branchId, currencyCode);
        if (kind === 'PETTY_CASH_EXPENSE') {
          const duplicate = await tx.financeOperationalRequest.findFirst({
            where: {
              kind,
              documentId,
              status: { notIn: ['REJECTED', 'CANCELLED'] },
            },
          });
          if (duplicate)
            throw new ConflictException(
              'این مدرک قبلاً در یک هزینه تنخواه استفاده شده است.',
            );
          if (!documentVersionId || !documentId)
            throw new ConflictException('نسخه مدرک هزینه در دسترس نیست.');
          await assertFinancialProofVersion(tx, {
            documentId,
            versionId: documentVersionId,
            branchId,
          });
        }
        if (receipt) {
          const sourceReceipt = await receiptAllocationSource(tx, receipt.id, [
            branchId,
          ]);
          await lockCustomerSettlement(tx, sourceReceipt.contractId, [
            branchId,
          ]);
          const reserved = await reservedReceiptRefunds(tx, receipt.id);
          if (
            sourceReceipt.currencyCode !== currencyCode ||
            amount.gt(unallocatedReceiptAmount(sourceReceipt).sub(reserved))
          )
            throw new BadRequestException(
              'مجموع درخواست‌های استرداد از وجه تخصیص‌نیافته دریافت بیشتر است.',
            );
        }
        const row = await tx.financeOperationalRequest.create({
          data: {
            id,
            branchId,
            requesterId: actor.userId,
            kind,
            title,
            party,
            description,
            reference,
            amount,
            currencyCode,
            dueAt,
            createFingerprint: fingerprint,
            sourceVersion: 1,
            ...(counterpartyOrganizationId
              ? {
                  counterpartyOrganizationId,
                  counterpartyRole: counterpartyRole as 'SUPPLIER' | 'BROKER',
                }
              : {}),
            refundReceiptId,
            documentId,
            pettyFundId,
          },
        });
        await tx.financeOperationalRevision.create({
          data: {
            id,
            requestId: id,
            actorId: actor.userId,
            version: 1,
            action: 'CREATE',
            toStatus: 'NEW',
            reason: description,
            fingerprint,
            snapshot: {
              kind,
              title,
              party,
              reference,
              documentId,
              documentVersionId,
              refundReceiptId,
              ...(counterpartyOrganizationId
                ? {
                    counterpartyOrganizationId,
                    counterpartyRole: String(counterpartyRole),
                  }
                : {}),
            },
            remainingAmount: amount,
          },
        });
        return { requestId: row.id, status: row.status };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2002', 'P2034'].includes(String(error.code))
      )
        throw new ConflictException(
          'ثبت هم‌زمان تغییر کرده است؛ همان عملیات را تکرار کنید.',
        );
      throw error;
    }
  }
  async submit(
    body: unknown,
    key: string | undefined,
    actor: AuthenticatedActor,
  ) {
    // HR command is replayable. If Finance fails, retry completes the same approved source.
    const source = await this.hr.submit(body, key, actor);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(source))
      .digest('hex');
    try {
      return await this.database.client.$transaction(async (tx) => {
        const existing = await tx.financeOperationalRequest.findUnique({
          where: { hrRecordId: source.id },
        });
        if (existing) {
          if (existing.createFingerprint !== fingerprint)
            throw new ConflictException(
              'منبع حقوق پس از ارسال تغییر کرده است.',
            );
          return {
            requestId: existing.id,
            sourceId: source.id,
            status: existing.status,
          };
        }
        const previous = await tx.financeOperationalRequest.findUnique({
          where: {
            payrollEmployeeId_payrollPeriod: {
              payrollEmployeeId: source.employeeId,
              payrollPeriod: source.period,
            },
          },
          include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (previous) {
          if (
            previous.status !== 'CORRECTION_REQUIRED' ||
            previous.requesterId !== actor.userId ||
            previous.branchId !== source.branchId ||
            !previous.revisions[0]!.cumulativePaid.isZero()
          )
            throw new ConflictException(
              'حقوق این کارمند در این دوره قبلاً به مالی ارسال شده است.',
            );
          const updated = await tx.financeOperationalRequest.updateMany({
            where: {
              id: previous.id,
              version: previous.version,
              status: 'CORRECTION_REQUIRED',
            },
            data: {
              hrRecordId: source.id,
              sourceVersion: source.version,
              amount: source.amount,
              currencyCode: source.currencyCode,
              dueAt: source.dueAt,
              party: source.employeeName,
              createFingerprint: fingerprint,
              status: 'NEW',
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1)
            throw new ConflictException('حقوق برگشتی هم‌زمان تغییر کرده است.');
          await tx.financeOperationalRevision.create({
            data: {
              id: source.id,
              requestId: previous.id,
              actorId: actor.userId,
              version: previous.version + 1,
              action: 'RESUBMIT',
              fromStatus: 'CORRECTION_REQUIRED',
              toStatus: 'NEW',
              reason: 'اصلاح حقوق برگشتی با ورودی تأییدشده جدید منابع انسانی',
              fingerprint,
              snapshot: { ...source, previousSourceId: previous.hrRecordId },
              remainingAmount: source.amount,
            },
          });
          return { requestId: previous.id, sourceId: source.id, status: 'NEW' };
        }
        const request = await tx.financeOperationalRequest.create({
          data: {
            id: source.id,
            branchId: source.branchId,
            requesterId: actor.userId,
            kind: 'PAYROLL',
            title: `حقوق ${source.period}`,
            party: source.employeeName,
            description:
              'حقوق قابل پرداخت تأییدشده منابع انسانی؛ بدون محاسبه ناخالص و کسورات.',
            reference: source.period,
            amount: source.amount,
            currencyCode: source.currencyCode,
            dueAt: source.dueAt,
            createFingerprint: fingerprint,
            hrRecordId: source.id,
            sourceVersion: source.version,
            payrollEmployeeId: source.employeeId,
            payrollPeriod: source.period,
          },
        });
        await tx.financeOperationalRevision.create({
          data: {
            id: source.id,
            requestId: request.id,
            actorId: actor.userId,
            version: 1,
            action: 'CREATE',
            toStatus: 'NEW',
            reason: 'ارسال حقوق تأییدشده از منابع انسانی',
            fingerprint,
            snapshot: source,
            remainingAmount: source.amount,
          },
        });
        return {
          requestId: request.id,
          sourceId: source.id,
          status: request.status,
        };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const existing =
          await this.database.client.financeOperationalRequest.findUnique({
            where: { hrRecordId: source.id },
          });
        if (existing?.createFingerprint === fingerprint)
          return {
            requestId: existing.id,
            sourceId: source.id,
            status: existing.status,
          };
        throw new ConflictException(
          'حقوق این کارمند در این دوره قبلاً به مالی ارسال شده است.',
        );
      }
      throw error;
    }
  }
}
