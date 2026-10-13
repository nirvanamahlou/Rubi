import { createHash } from 'node:crypto';
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
    };
    const transition = transitions[action];
    if (
      !transition ||
      (['CORRECTION_REQUIRED', 'REJECT', 'RESUBMIT'].includes(action) &&
        !reason)
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
    const source = initial.hrRecordId
      ? await this.hr.approvedSource(initial.hrRecordId, actor.branchIds)
      : {
          id: initial.id,
          version: initial.sourceVersion ?? 1,
          amount: initial.amount.toString(),
          currencyCode: initial.currencyCode,
        };
    if (
      initial.refundReceiptId &&
      !(
        await this.sales?.financeReceiptHistory(
          { ...actor, branchIds: [initial.branchId] },
          { id: initial.refundReceiptId },
          1,
        )
      )?.length
    )
      throw new ConflictException('دریافت مبنای استرداد دیگر تأییدشده نیست.');
    if (
      source.version !== initial.sourceVersion ||
      source.amount !== initial.amount.toString() ||
      source.currencyCode !== initial.currencyCode
    )
      throw new ConflictException('منبع حقوق تغییر کرده است.');
    try {
      await this.database.client.$transaction(async (tx) => {
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
        const last = current.revisions[0]!;
        let paidAmount: Prisma.Decimal | null = null,
          accountId: string | null = null,
          methodId: string | null = null,
          transferAt: Date | null = null;
        let methodName: string | null = null;
        let cumulativePaid = last.cumulativePaid,
          remainingAmount = last.remainingAmount,
          status = transition.to;
        if (action === 'PAY') {
          const text = validate.text(input.paidAmount, 'مبلغ پرداخت', 30);
          if (!/^\d{1,20}(\.\d{1,4})?$/.test(text))
            throw new BadRequestException('مبلغ معتبر نیست.');
          paidAmount = new Prisma.Decimal(text);
          if (!paidAmount.isPositive() || paidAmount.gt(remainingAmount))
            throw new BadRequestException(
              'مبلغ باید مثبت و حداکثر برابر مانده باشد.',
            );
          accountId = validate.uuid(input.accountId);
          methodId = validate.uuid(input.methodId);
          const account = await tx.financeSettlementAccount.findFirst({
            where: {
              id: accountId,
              branchId: current.branchId,
              currencyCode: current.currencyCode,
              isActive: true,
            },
          });
          const method = await this.master?.activeOutgoingPaymentMethod(
            methodId,
            tx,
          );
          if (!account || !method)
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
            },
            paidAmount,
            cumulativePaid,
            remainingAmount,
            accountId,
            methodId,
            transferAt,
            paymentReference:
              validate.text(input.paymentReference, 'شماره رسید', 160, true) ||
              null,
          },
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
    ]);
    const id = validate.uuid(input.operationId),
      branchId = validate.uuid(input.branchId),
      kind = validate.text(input.kind, 'نوع درخواست', 24);
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه خارج از دسترسی است.');
    if (!['REFUND', 'COMMISSION', 'CHECK', 'ADJUSTMENT'].includes(kind))
      throw new BadRequestException(
        'نوع درخواست عملیاتی معتبر نیست؛ حقوق فقط از منابع انسانی ارسال می‌شود.',
      );
    const title = validate.text(input.title, 'عنوان', 200),
      party = validate.text(input.party, 'ذی‌نفع', 200),
      description = validate.text(input.description, 'توضیحات', 2000, true),
      reference = validate.text(
        input.reference,
        'قرارداد، فاکتور یا چک مرجع',
        160,
        true,
      );
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
    if (documentId) {
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
        if (receipt) {
          const total = await tx.financeOperationalRequest.aggregate({
            where: {
              refundReceiptId,
              status: { notIn: ['REJECTED', 'CANCELLED'] },
            },
            _sum: { amount: true },
          });
          if (
            (total._sum.amount ?? new Prisma.Decimal(0))
              .add(amount)
              .gt(receipt.amount)
          )
            throw new BadRequestException(
              'مجموع درخواست‌های استرداد از دریافت تأییدشده بیشتر است.',
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
            refundReceiptId,
            documentId,
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
              refundReceiptId,
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
