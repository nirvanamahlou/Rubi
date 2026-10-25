import { captureSalesContractAccounting } from '../../finance/accounting/sales-contract-accounting.public';
import { assertRevenueEditable } from '../../finance/accounting/accounting-workflows.public';
import {
  canSelfServeSalesContract,
  hasSalesContractSelfService,
} from '@nora/contracts';
import { recalculateSalesSettlement } from '../sales-financial-settlement';
import { isOptionalOperationReason } from '@nora/contracts';
import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { IamReservationsDirectory } from '../../iam/iam-reservations-directory';

export function contractCurrencyTotals(
  rows: readonly {
    type: string;
    amount: { toString(): string };
    currencyCode: string;
  }[],
) {
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows)
    totals.set(
      row.currencyCode,
      (totals.get(row.currencyCode) ?? new Prisma.Decimal(0)).add(
        new Prisma.Decimal(row.amount.toString()).mul(
          row.type === 'DISCOUNT' ? -1 : 1,
        ),
      ),
    );
  return [...totals].map(([currencyCode, amount]) => ({
    currencyCode,
    amount: amount.toFixed(),
  }));
}
@Injectable()
export class ContractPriceCorrectionService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(IamReservationsDirectory)
    private readonly directory: IamReservationsDirectory,
  ) {}
  private async authorize(actor: AuthenticatedActor) {
    const native = await this.directory.canCorrectContractPrice(actor.userId);
    if (!native && !hasSalesContractSelfService(actor.permissions))
      throw new ForbiddenException('مجوز ویرایش قیمت قرارداد وجود ندارد.');
    return native;
  }
  async form(id: string, actor: AuthenticatedActor) {
    const native = await this.authorize(actor);
    const row = await this.db.client.salesContract.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
      include: { priceComponents: true },
    });
    if (!row) throw new NotFoundException('قرارداد یافت نشد.');
    if (!native && !canSelfServeSalesContract(actor, row))
      throw new ForbiddenException('مجوز ویرایش قیمت قرارداد وجود ندارد.');
    return {
      version: row.version,
      totals: contractCurrencyTotals(row.priceComponents),
    };
  }
  async save(id: string, input: unknown, actor: AuthenticatedActor) {
    const native = await this.authorize(actor);
    if (!input || typeof input !== 'object') throw new BadRequestException();
    const value = input as {
      expectedVersion: number;
      totals: { currencyCode: string; amount: string }[];
      reason: string;
    };
    if (
      !Number.isInteger(value.expectedVersion) ||
      value.expectedVersion < 1 ||
      !Array.isArray(value.totals) ||
      !value.totals.length ||
      value.totals.length > 10 ||
      !isOptionalOperationReason(value.reason) ||
      !isOptionalOperationReason(value.reason) ||
      (value.reason ?? '').length > 500 ||
      value.totals.some(
        (t) =>
          !t ||
          typeof t.amount !== 'string' ||
          typeof t.currencyCode !== 'string' ||
          !/^\d{1,18}(?:\.\d{1,4})?$/.test(t.amount) ||
          !/^[A-Z]{3}$/.test(t.currencyCode) ||
          !Intl.supportedValuesOf('currency').includes(t.currencyCode),
      ) ||
      new Set(value.totals.map((t) => t.currencyCode)).size !==
        value.totals.length
    )
      throw new BadRequestException('مبلغ و ارز معتبر وارد کنید.');
    return this.db.client.$transaction(async (tx) => {
      await assertRevenueEditable(tx, id, actor.branchIds);
      const row = await tx.salesContract.findFirst({
        where: { id, branchId: { in: actor.branchIds } },
        include: { priceComponents: true },
      });
      if (!row) throw new NotFoundException('قرارداد یافت نشد.');
      if (!native && !canSelfServeSalesContract(actor, row))
        throw new ForbiddenException('مجوز ویرایش قیمت قرارداد وجود ندارد.');
      if (
        ![
          'CONFIRMED',
          'SENT_TO_RESERVATIONS',
          'IN_PROGRESS',
          'COMPLETED',
        ].includes(row.status) ||
        row.version !== value.expectedVersion
      )
        throw new ConflictException(
          'نسخه قرارداد تغییر کرده؛ آخرین نسخه را دریافت کنید.',
        );
      const before = contractCurrencyTotals(row.priceComponents);
      const adjustments = value.totals
        .map((t) => ({
          currencyCode: t.currencyCode,
          delta: new Prisma.Decimal(t.amount).sub(
            before.find((b) => b.currencyCode === t.currencyCode)?.amount ??
              '0',
          ),
        }))
        .filter((t) => !t.delta.isZero());
      if (!adjustments.length) return { version: row.version, totals: before };
      const changed = await tx.salesContract.updateMany({
        where: { id, version: row.version },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'نسخه قرارداد تغییر کرده؛ آخرین نسخه را دریافت کنید.',
        );
      // Keep one current correction per currency; immutable audit retains every edit.
      for (const adjustment of adjustments) {
        const currencyCode = adjustment.currencyCode;
        const previous = row.priceComponents.filter(
          (p) =>
            p.currencyCode === currencyCode &&
            p.title === 'اصلاح مبلغ کل قرارداد',
        );
        const existing = contractCurrencyTotals(previous)[0]?.amount ?? '0';
        const delta = new Prisma.Decimal(existing).add(adjustment.delta);
        const data = {
          type: delta.isNegative() ? ('DISCOUNT' as const) : ('BASE' as const),
          amount: delta.abs().toFixed(),
        };
        if (previous[0]) {
          await tx.salesContractPriceComponent.update({
            where: { id: previous[0].id },
            data,
          });
          if (previous.length > 1)
            await tx.salesContractPriceComponent.deleteMany({
              where: {
                contractId: id,
                id: { in: previous.slice(1).map((p) => p.id) },
              },
            });
        } else {
          await tx.salesContractPriceComponent.createMany({
            data: [
              {
                contractId: id,
                currencyCode,
                title: 'اصلاح مبلغ کل قرارداد',
                ...data,
              },
            ],
          });
        }
      }
      await tx.salesContractAuditEvent.create({
        data: {
          contractId: id,
          actorUserId: actor.userId,
          actorBranchId: row.branchId,
          action: 'FINANCE_CONTRACT_PRICE_CORRECTION',
          outcome: 'SUCCESS',
          reason: (value.reason ?? '').trim(),
          beforeSnapshot: { totals: before },
          afterSnapshot: { totals: value.totals, version: row.version + 1 },
        },
      });
      await recalculateSalesSettlement(tx, id, actor.userId, false);
      await captureSalesContractAccounting(tx, id, actor.userId);
      return { version: row.version + 1, totals: value.totals };
    });
  }
}
