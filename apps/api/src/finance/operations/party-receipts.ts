import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
  Header,
  Inject,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AuthenticatedActor,
  FinancePartyReceiptCommandV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { DatabaseService } from '../../database/database.service';
import * as v from '../accounting/accounting.validation';
import {
  lockPartyContracts,
  contractParties,
  partyContractBalance,
  partyReceiptReplay,
  persistPartyReceipt,
} from '../../sales/party-receipts.public';
import {
  financialDate,
  recordFinancialEvent,
} from '../accounting/financial-event.public';
import { captureSalesContractAccounting } from '../accounting/sales-contract-accounting.public';

function receiptWriteConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    code?: string;
    meta?: {
      code?: string;
      driverAdapterError?: { cause?: { originalCode?: string } };
    };
  };
  return (
    ['P2034', 'P2002'].includes(value.code ?? '') ||
    (value.code === 'P2010' &&
      ['40001', '40P01'].includes(
        value.meta?.code ??
          value.meta?.driverAdapterError?.cause?.originalCode ??
          '',
      ))
  );
}

@Injectable()
export class FinancePartyReceipts {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private authorize(
    actor: AuthenticatedActor,
    branchId?: string,
    write = false,
  ) {
    if (
      !actor.permissions.includes('finance.read') ||
      (write && !actor.permissions.includes('finance.receipt.approve')) ||
      (branchId && !actor.branchIds.includes(branchId))
    )
      throw new ForbiddenException(
        'مجوز دریافت یا مشاهده حساب این شعبه وجود ندارد.',
      );
  }
  async search(search: unknown, actor: AuthenticatedActor) {
    this.authorize(actor);
    const term = v.text(search, 80, true);
    if (term.length < 2) return [];
    return this.db.client.$transaction((tx) =>
      contractParties(tx, actor.branchIds, term),
    );
  }
  async balance(branch: unknown, payer: unknown, actor: AuthenticatedActor) {
    const branchId = v.uuid(branch)!,
      payerId = v.uuid(payer)!;
    this.authorize(actor, branchId);
    return this.db.client.$transaction(
      (tx) => partyContractBalance(tx, branchId, payerId),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async receive(body: unknown, actor: AuthenticatedActor) {
    const raw = v.object(body);
    const keys = [
      'operationId',
      'branchId',
      'payerId',
      'revision',
      'currencyCode',
      'amount',
      'accountId',
      'reference',
    ];
    if (Object.keys(raw).some((k) => !keys.includes(k)))
      throw new BadRequestException('فیلد دریافت ناشناخته است.');
    const input: FinancePartyReceiptCommandV1 = {
      operationId: v.uuid(raw.operationId)!.toLowerCase(),
      branchId: v.uuid(raw.branchId)!.toLowerCase(),
      payerId: v.uuid(raw.payerId)!.toLowerCase(),
      accountId: v.uuid(raw.accountId)!.toLowerCase(),
      revision: v.text(raw.revision, 64, true),
      currencyCode: v.text(raw.currencyCode, 3, true).toUpperCase(),
      amount: v.text(raw.amount, 25, true),
      reference: v.text(raw.reference, 160),
    };
    this.authorize(actor, input.branchId, true);
    if (
      !/^[A-Z]{3}$/.test(input.currencyCode) ||
      !/^[a-f0-9]{64}$/.test(input.revision) ||
      !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/.test(input.amount) ||
      !new Prisma.Decimal(input.amount).gt(0)
    )
      throw new BadRequestException('مبلغ مثبت، ارز و نسخه معتبر لازم است.');
    input.amount = new Prisma.Decimal(input.amount).toString();
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, actorId: actor.userId }))
      .digest('hex');
    try {
      return await this.db.client.$transaction(
        async (tx) => {
          // Operation lock prevents retry races even if the selected party was changed.
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`party-receipt:${input.operationId}`},0))`;
          const replay = await partyReceiptReplay(tx, input, fingerprint);
          if (replay) return replay;
          await lockPartyContracts(tx, input.branchId, input.payerId);
          const context = await partyContractBalance(
            tx,
            input.branchId,
            input.payerId,
          );
          if (context.revision !== input.revision)
            throw new ConflictException(
              'مانده قراردادها تغییر کرده است؛ اطلاعات را تازه کنید.',
            );
          const account = await tx.financeSettlementAccount.findFirst({
            where: {
              id: input.accountId,
              branchId: input.branchId,
              currencyCode: input.currencyCode,
              isActive: true,
            },
            select: { title: true, kind: true },
          });
          if (!account)
            throw new BadRequestException(
              'حساب مقصد باید فعال و متعلق به همین شعبه و ارز باشد.',
            );
          return persistPartyReceipt(
            tx,
            input,
            fingerprint,
            actor.userId,
            context,
            account.title,
            async (part) => {
              await recordFinancialEvent(tx, {
                source: 'SALES',
                recordId: part.paymentId,
                requestId: part.contractId,
                trackingNumber: part.contractId,
                trackingDate: financialDate(part.createdAt),
                kind: 'CUSTOMER_RECEIPT',
                branchId: input.branchId,
                actorId: actor.userId,
                occurredAt: new Date(),
                amount: part.amount,
                currency: input.currencyCode,
                settlementAccountId: input.accountId,
                partyId: input.payerId,
                reference: input.reference || `PARTY:${input.operationId}`,
              });
              await captureSalesContractAccounting(
                tx,
                part.contractId,
                actor.userId,
                true,
              );
            },
            account.kind === 'CASH' ? 'CASH' : 'BANK_TRANSFER',
          );
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000,
        },
      );
    } catch (error) {
      if (receiptWriteConflict(error)) {
        const replay = await this.db.client.$transaction((tx) =>
          partyReceiptReplay(tx, input, fingerprint),
        );
        if (replay) return replay;
        throw new ConflictException(
          'دریافت هم‌زمان تغییر کرده است؛ همان عملیات را دوباره ارسال کنید.',
        );
      }
      throw error;
    }
  }
}

@Controller('finance/party-receipts')
@UseGuards(AuthGuard, PermissionGuard)
export class FinancePartyReceiptsController {
  constructor(
    @Inject(FinancePartyReceipts)
    private readonly service: FinancePartyReceipts,
  ) {}
  @Get('parties')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read')
  async search(
    @Query('search') search: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.service.search(search, req.actor) };
  }
  @Get('balance')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read')
  async balance(
    @Query('branchId') branch: unknown,
    @Query('payerId') payer: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.service.balance(branch, payer, req.actor) };
  }
  @Post()
  @RequirePermissions('finance.read', 'finance.receipt.approve')
  async receive(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return { data: await this.service.receive(body, req.actor) };
  }
}
