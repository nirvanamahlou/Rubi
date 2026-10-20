import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import * as v from '../accounting/accounting.validation';
import {
  unallocatedReceiptAmount,
  receiptAllocationSource,
  receiptAllocationRows,
  receiptAllocationTargets,
  receiptAllocationReplay,
  prepareReceiptAllocation,
  persistReceiptAllocation,
} from '../../sales/sales-receipt-allocation.public';
import {
  allocationCarryingAmount,
  lockReceiptFunds,
  postedReceiptBasis,
  reservedReceiptRefunds,
} from '../accounting/receipt-funds.public';
import {
  financialDate,
  recordFinancialEvent,
} from '../accounting/financial-event.public';

@Injectable()
export class FinanceReceiptAllocationService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private authorize(actor: AuthenticatedActor, write = false) {
    const needed = [
      'finance.read',
      ...(write
        ? ['finance.receipt.approve', 'finance.journal.create']
        : ['finance.journal.read']),
    ];
    if (
      !needed.every((permission) =>
        actor.permissions.includes(permission as never),
      )
    )
      throw new ForbiddenException('مجوز تخصیص یا مشاهده دریافت وجود ندارد.');
  }
  private async event(eventId: string, actor: AuthenticatedActor) {
    const event = await this.db.client.financeAccountingEvent.findFirst({
      where: {
        id: v.uuid(eventId)!,
        source: 'SALES',
        kind: 'CUSTOMER_RECEIPT',
        branchId: { in: [...actor.branchIds] },
      },
    });
    if (!event)
      throw new NotFoundException('رویداد دریافت در شعبه مجاز یافت نشد.');
    return event;
  }
  async context(eventId: string, actor: AuthenticatedActor, before?: string) {
    this.authorize(actor);
    const event = await this.event(eventId, actor);
    if (before) v.uuid(before)!;
    return this.db.client.$transaction(async (tx) => {
      const source = await receiptAllocationSource(
        tx,
        event.recordId,
        actor.branchIds,
      );
      const reserved = await reservedReceiptRefunds(tx, source.id);
      const page = await receiptAllocationRows(
        tx,
        source.id,
        actor.branchIds,
        before,
      );
      let accountingReady = true,
        accountingIssue: string | null = null;
      try {
        const basis = await postedReceiptBasis(
          tx,
          source.id,
          source.contract.branchId,
        );
        if (basis.event.partyId !== source.contract.customerId)
          throw new ConflictException(
            'طرف حساب دریافت تغییر کرده است؛ ابتدا تطبیق انجام شود.',
          );
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        accountingReady = false;
        accountingIssue = error.message;
      }
      return {
        version: 1 as const,
        eventId,
        sourcePaymentId: source.id,
        sourceContractId: source.contractId,
        sourceContractNumber: source.contract.contractNumber,
        sourceVersion: source.contract.version,
        currency: source.currencyCode,
        availableAmount: Prisma.Decimal.max(
          0,
          unallocatedReceiptAmount(source).sub(reserved),
        ).toString(),
        reservedRefunds: reserved.toString(),
        accountingReady,
        accountingIssue,
        allocations: page.rows.map((row) => ({
          id: row.id,
          targetContractId: row.targetContractId,
          targetContractNumber: row.targetContract.contractNumber,
          targetVersion: row.targetContract.version,
          amount: row.amount.toString(),
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
          reversed: !!row.reversal,
        })),
        nextCursor: page.nextCursor,
      };
    });
  }
  async targets(
    eventId: string,
    search: string | undefined,
    actor: AuthenticatedActor,
  ) {
    this.authorize(actor);
    if (
      search !== undefined &&
      (typeof search !== 'string' || search.length > 80)
    )
      throw new BadRequestException('شماره قرارداد مقصد معتبر نیست.');
    const event = await this.event(eventId, actor);
    return this.db.client.$transaction((tx) =>
      receiptAllocationTargets(
        tx,
        event.recordId,
        actor.branchIds,
        search?.trim() ?? '',
      ),
    );
  }
  async command(
    eventId: string,
    body: unknown,
    actor: AuthenticatedActor,
    reversalOfId?: string,
  ) {
    this.authorize(actor, true);
    const event = await this.event(eventId, actor);
    const value = v.object(body);
    const allowed = [
      'operationId',
      'reason',
      'expectedSourceVersion',
      'expectedTargetVersion',
      ...(!reversalOfId ? ['targetContractId', 'amount'] : []),
    ];
    if (Object.keys(value).some((key) => !allowed.includes(key)))
      throw new BadRequestException('فیلد تخصیص شناخته‌شده نیست.');
    const operationId = v.uuid(value.operationId)!;
    const targetContractId = reversalOfId
      ? undefined
      : v.uuid(value.targetContractId)!;
    if (reversalOfId) v.uuid(reversalOfId)!;
    const amount = reversalOfId ? undefined : v.text(value.amount, 30, true);
    if (
      amount !== undefined &&
      !/^(?:0|[1-9]\d{0,19})(?:\.\d{1,4})?$/.test(amount)
    )
      throw new BadRequestException('مبلغ تخصیص معتبر نیست.');
    const reason = v.text(value.reason, 500, true);
    if (reason.trim().length < 10)
      throw new BadRequestException(
        'علت تخصیص یا برگشت را با حداقل ده حرف ثبت کنید.',
      );
    const expectedSourceVersion = value.expectedSourceVersion,
      expectedTargetVersion = value.expectedTargetVersion;
    if (
      typeof expectedSourceVersion !== 'number' ||
      !Number.isSafeInteger(expectedSourceVersion) ||
      expectedSourceVersion < 1 ||
      typeof expectedTargetVersion !== 'number' ||
      !Number.isSafeInteger(expectedTargetVersion) ||
      expectedTargetVersion < 1
    )
      throw new BadRequestException('نسخه قراردادهای مبدأ و مقصد لازم است.');
    const input = {
      paymentId: event.recordId,
      targetContractId,
      reversalOfId,
      amount,
      expectedSourceVersion,
      expectedTargetVersion,
    };
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({ actorId: actor.userId, eventId, ...input, reason }),
      )
      .digest('hex');
    try {
      return await this.db.client.$transaction(
        async (tx) => {
          await lockReceiptFunds(tx, event.recordId);
          const replay = await receiptAllocationReplay(
            tx,
            operationId,
            actor.branchIds,
            actor.userId,
            fingerprint,
          );
          if (replay)
            return {
              id: replay.id,
              status: replay.reversalOfId
                ? ('REVERSED' as const)
                : ('ALLOCATED' as const),
            };
          const basis = await postedReceiptBasis(
            tx,
            event.recordId,
            event.branchId,
          );
          const reserved = await reservedReceiptRefunds(tx, event.recordId);
          const prepared = await prepareReceiptAllocation(
            tx,
            input,
            actor.branchIds,
            basis.event.partyId,
            reserved,
          );
          const carrying = await allocationCarryingAmount(
            tx,
            basis,
            prepared.amount,
            prepared.reversalOfId ?? undefined,
          );
          await recordFinancialEvent(tx, {
            source: 'SALES',
            recordId: operationId,
            requestId: prepared.target.id,
            kind: prepared.reversalOfId
              ? 'RECEIPT_ALLOCATION_REVERSAL'
              : 'RECEIPT_ALLOCATION',
            branchId: event.branchId,
            actorId: actor.userId,
            occurredAt: new Date(),
            amount: prepared.amount.toString(),
            currency: event.currency,
            partyId: basis.event.partyId,
            basisEventId: basis.event.id,
            carryingAmount: carrying.toString(),
            carryingCurrency: basis.journal.book.baseCurrency,
            trackingNumber: prepared.target.id,
            trackingDate: financialDate(prepared.target.createdAt),
            reference: `ALLOC:${event.recordId}:${prepared.target.contractNumber}`,
          });
          const row = await persistReceiptAllocation(
            tx,
            prepared,
            operationId,
            actor.userId,
            fingerprint,
            reason,
          );
          return {
            id: row.id,
            status: row.reversalOfId
              ? ('REVERSED' as const)
              : ('ALLOCATED' as const),
          };
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2002', 'P2034'].includes(String(error.code))
      )
        throw new ConflictException(
          'تخصیص هم‌زمان تغییر کرده است؛ همان عملیات را دوباره بفرستید.',
        );
      throw error;
    }
  }
}
