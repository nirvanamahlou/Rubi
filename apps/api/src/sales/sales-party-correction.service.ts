import { canSelfServeSalesContract } from '@nora/contracts';
import { assertNoActiveReceiptAllocations } from './sales-receipt-allocation.public';
import { isOptionalOperationReason } from '@nora/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesContractPartyCorrectionV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { SalesCustomersPublicAdapter } from './sales.adapters';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';

@Injectable()
export class SalesPartyCorrectionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SalesCustomersPublicAdapter)
    private readonly customers: SalesCustomersPublicAdapter,
    @Inject(SalesBuyerContactCrypto)
    private readonly crypto: SalesBuyerContactCrypto,
  ) {}
  async correct(
    id: string,
    input: SalesContractPartyCorrectionV1,
    actor: AuthenticatedActor,
  ) {
    if (
      !input ||
      !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      !isOptionalOperationReason(input.reason) ||
      !isOptionalOperationReason(input.reason) ||
      (input.reason ?? '').trim().length > 500 ||
      !/^[0-9a-f-]{36}$/i.test(input.customerId) ||
      input.transferFinancialHistory !== true
    )
      throw new BadRequestException('اطلاعات اصلاح طرف قرارداد معتبر نیست.');
    if (input.buyerContact !== null) {
      const c = input.buyerContact;
      if (
        !c ||
        !['name', 'phone', 'address', 'postalCode'].every(
          (k) => typeof c[k as keyof typeof c] === 'string',
        ) ||
        !c.name.trim() ||
        c.name.length > 200 ||
        !/^\+?[0-9]{10,15}$/.test(c.phone.trim()) ||
        !c.address.trim() ||
        c.address.length > 1000 ||
        (!!c.postalCode.trim() && !/^[0-9]{10}$/.test(c.postalCode.trim()))
      )
        throw new BadRequestException(
          'مشخصات مشتری طرف حساب را کامل و معتبر وارد کنید.',
        );
    }
    return this.database.client.$transaction(
      async (tx) => {
        const row = await tx.salesContract.findUnique({ where: { id } });
        if (!row) throw new NotFoundException('قرارداد یافت نشد.');
        if (
          !actor.branchIds.includes(row.branchId) ||
          !(
            canSelfServeSalesContract(actor, row) ||
            actor.permissions.includes('sales.contracts.update.branch') ||
            (actor.permissions.includes('sales.contracts.update.own') &&
              row.ownerUserId === actor.userId)
          )
        )
          throw new ForbiddenException('مجوز ویرایش قرارداد لازم است.');
        if (row.status === 'CANCELLED' || row.version !== input.version)
          throw new ConflictException(
            'نسخه قرارداد تغییر کرده یا قرارداد ابطال شده است.',
          );
        const transfer =
          row.customerId !== input.customerId ||
          (row.payerCustomerId ?? row.customerId) !== input.customerId;
        if (transfer && !actor.permissions.includes('finance.receipt.approve'))
          throw new ForbiddenException(
            'انتقال طرف حساب قرارداد به مجوز تأیید دریافت مالی نیاز دارد.',
          );
        const customer = await this.customers.resolveSnapshot(
          input.customerId,
          actor,
        );
        const buyerContact = input.buyerContact
          ? this.crypto.protect(input.buyerContact)
          : null;
        const next = {
          customerId: input.customerId,
          payerCustomerId: input.customerId,
          customerNameSnapshot:
            input.buyerContact?.name.trim() || customer.displayName,
          buyerContact: buyerContact
            ? (buyerContact as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
        };
        const result = await tx.salesContract.updateMany({
          where: { id, version: input.version, status: { not: 'CANCELLED' } },
          data: { ...next, version: { increment: 1 } },
        });
        if (result.count !== 1)
          throw new ConflictException('قرارداد هم‌زمان تغییر کرد.');
        if (transfer) await assertNoActiveReceiptAllocations(tx, id);
        // Receipt amounts, currencies, confirmations, bank/check ownership and IDs remain
        // contract-owned. Their current counterparty follows this atomic payer change.
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: row.branchId,
            action: 'sales.contract.updated',
            outcome: 'SUCCESS',
            reason: (input.reason ?? '').trim(),
            beforeSnapshot: {
              customerId: row.customerId,
              payerCustomerId: row.payerCustomerId,
              buyerContact: row.buyerContact,
              version: row.version,
            },
            afterSnapshot: {
              correction: 'PARTY',
              customerId: input.customerId,
              payerCustomerId: input.customerId,
              buyerContact: buyerContact as unknown as Prisma.InputJsonValue,
              version: row.version + 1,
              transferFinancialHistory: transfer,
            },
          },
        });
        return { data: { version: row.version + 1 } };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
