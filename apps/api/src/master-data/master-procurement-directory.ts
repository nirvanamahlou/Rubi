import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '@nora/database';

/** Public owner projection. Procurement never reads Master Data tables itself. */
@Injectable()
export class MasterProcurementDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  /** Finance-owned accounts reference this canonical bank, never duplicate it. */
  async assertBank(id: string, transaction?: Prisma.TransactionClient) {
    const row = await (
      transaction ?? this.database.client
    ).masterBank.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!row) throw new BadRequestException('بانک انتخاب‌شده معتبر نیست.');
  }
  /** Approved operational reference only; never journal-posting authority. */
  bankNames(ids: string[], transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.database.client).masterBank.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }
  /** Approved operational reference only; never journal-posting authority. */
  async purchaseRateToIrr(
    currencyCode: string,
    at = new Date(),
    transaction?: Prisma.TransactionClient,
  ) {
    for (const rateType of ['SELL', 'REFERENCE'] as const) {
      const row = await (
        transaction ?? this.database.client
      ).masterDraftExchangeRate.findFirst({
        where: {
          fromCurrency: { code: currencyCode, isActive: true },
          toCurrency: { code: 'IRR', isActive: true },
          rateType,
          status: 'APPROVED',
          isActive: true,
          validFrom: { lte: at },
          observedAt: { lte: at },
          approvedAt: { lte: at },
          OR: [{ validTo: null }, { validTo: { gt: at } }],
        },
        orderBy: [{ validFrom: 'desc' }, { approvedAt: 'desc' }, { id: 'asc' }],
        select: { rate: true, observedAt: true },
      });
      if (row)
        return {
          rateToIrr: row.rate.toDecimalPlaces(8).toString(),
          source: 'SYSTEM_' + rateType,
          observedAt: row.observedAt.toISOString(),
        };
    }
    return null;
  }
  branches(ids: string[], transaction?: Prisma.TransactionClient) {
    return (transaction ?? this.database.client).branch.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true },
      take: 100,
    });
  }
  currencies() {
    return this.database.client.masterCurrency.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 250,
    });
  }
  async assertCurrency(code: string, transaction?: Prisma.TransactionClient) {
    if (
      !(await (transaction ?? this.database.client).masterCurrency.findFirst({
        where: { code, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('ارز باید در اطلاعات پایه فعال باشد.');
  }
  /** Master Data-owned validation of a referenced outgoing method. */
  activeOutgoingPaymentMethod(
    id: string,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.database.client).masterPaymentMethod.findFirst({
      where: { id, isActive: true, direction: { in: ['PAYMENT', 'BOTH'] } },
      select: { id: true, name: true },
    });
  }
  /** Public validator for manually confirmed incoming treasury receipts. */
  activeIncomingPaymentMethod(
    id: string,
    transaction?: Prisma.TransactionClient,
  ) {
    return (transaction ?? this.database.client).masterPaymentMethod.findFirst({
      where: { id, isActive: true, direction: { in: ['RECEIPT', 'BOTH'] } },
      select: { id: true, name: true },
    });
  }
  async suppliers(
    search: string,
    page: number,
    dates: { start: Date | null; endExclusive: Date | null } = {
      start: null,
      endExclusive: null,
    },
  ) {
    const rows = await this.database.client.masterSupplier.findMany({
      where: {
        ...(dates.start || dates.endExclusive
          ? {
              createdAt: {
                ...(dates.start ? { gte: dates.start } : {}),
                ...(dates.endExclusive ? { lt: dates.endExclusive } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        version: true,
        isActive: true,
        collaborationStatus: true,
      },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      items: rows.slice(0, 50),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
  async supplier(id: string, transaction?: Prisma.TransactionClient) {
    const row = await (
      transaction ?? this.database.client
    ).masterSupplier.findFirst({
      where: { id, isActive: true, collaborationStatus: 'ACTIVE' },
      select: { id: true, name: true, code: true, version: true },
    });
    if (!row)
      throw new BadRequestException(
        'تأمین‌کننده فعال و مجاز برای خرید پیدا نشد.',
      );
    return { id: row.id, version: row.version, label: row.name ?? row.code };
  }
  async supplierLabels(ids: readonly string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.database.client.masterSupplier.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true, code: true },
      take: 100,
    });
    return new Map(
      rows.map((row) => [
        row.id,
        row.name?.trim() || `تأمین‌کننده ${row.code}`,
      ]),
    );
  }
}
