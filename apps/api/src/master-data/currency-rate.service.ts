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
  MasterCurrencyRateQuoteRequest,
} from '@rubi/contracts';
import { AuditOutcome, MasterCurrencyRateStatus } from '@rubi/database';
import type { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';
import type { CurrencyRateListDto } from './currency-rate.dto';

function branchOf(actor: AuthenticatedActor, requested?: string): string {
  const branchId = requested ?? actor.branchIds[0];
  if (!branchId || !actor.branchIds.includes(branchId))
    throw new ForbiddenException('شعبه مجاز برای این عملیات مشخص نشده است.');
  return branchId;
}

function redactedRate(row: Record<string, unknown>) {
  return {
    id: row.id,
    fromCurrencyId: row.fromCurrencyId,
    toCurrencyId: row.toCurrencyId,
    rate: String(row.rate),
    rateType: row.rateType,
    source: row.source,
    observedAt: row.observedAt,
    validFrom: row.validFrom,
    validTo: row.validTo,
    status: row.status,
    version: row.version,
    isAuthoritative: false,
  };
}

@Injectable()
export class CurrencyRateService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async createQuote(
    input: MasterCurrencyRateQuoteRequest,
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    if (
      !actor.permissions.includes('master_data.create') ||
      !actor.permissions.includes('master_data.currency_rate.create')
    )
      throw new ForbiddenException('مجوز ثبت نرخ ارز وجود ندارد.');
    const actorBranchId = branchOf(actor, requestedBranch);
    const fromCode = input.fromCurrencyCode.trim().toUpperCase();
    const toCode = input.toCurrencyCode.trim().toUpperCase();
    if (
      !/^[A-Z]{3}$/.test(fromCode) ||
      !/^[A-Z]{3}$/.test(toCode) ||
      fromCode === toCode
    )
      throw new BadRequestException(
        'ارز مبدأ و مقصد باید معتبر و متفاوت باشند.',
      );
    const sides = [
      { rateType: 'BUY' as const, rate: input.buyRate },
      { rateType: 'SELL' as const, rate: input.sellRate },
    ].filter(
      (side): side is { rateType: 'BUY' | 'SELL'; rate: string } =>
        side.rate !== undefined,
    );
    if (
      !sides.length ||
      sides.some(
        ({ rate }) =>
          typeof rate !== 'string' ||
          !/^\d{1,14}(\.\d{1,10})?$/.test(rate) ||
          !/[1-9]/.test(rate),
      )
    )
      throw new BadRequestException(
        'حداقل یک نرخ مثبت با حداکثر ۱۴ رقم صحیح و ۱۰ رقم اعشار لازم است.',
      );
    const source = input.source.trim();
    if (!source || source.length > 160)
      throw new BadRequestException('منبع نرخ الزامی و حداکثر ۱۶۰ نویسه است.');
    const observedAt = new Date(input.observedAt);
    const validFrom = new Date(input.validFrom ?? input.observedAt);
    const validTo = input.validTo ? new Date(input.validTo) : null;
    if (
      [input.observedAt, input.validFrom, input.validTo].some(
        (value) =>
          value !== undefined &&
          (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
            Number.isNaN(new Date(value).getTime())),
      ) ||
      (validTo && validTo <= validFrom)
    )
      throw new BadRequestException(
        'زمان دارای منطقه زمانی و بازه اعتبار صحیح لازم است.',
      );
    const correctionReason = input.correctionReason?.trim() || null;
    if (correctionReason && correctionReason.length > 500)
      throw new BadRequestException('دلیل اصلاح حداکثر ۵۰۰ نویسه است.');

    return this.database.client.$transaction(async (tx) => {
      const currencies = await tx.masterCurrency.findMany({
        where: { code: { in: [fromCode, toCode] }, isActive: true },
      });
      const from = currencies.find((currency) => currency.code === fromCode);
      const to = currencies.find((currency) => currency.code === toCode);
      if (!from || !to)
        throw new BadRequestException('ارز فعال مبدأ یا مقصد یافت نشد.');
      const rows = [];
      for (const side of sides) {
        const row = await tx.masterDraftExchangeRate.create({
          data: {
            fromCurrencyId: from.id,
            toCurrencyId: to.id,
            rate: side.rate,
            rateType: side.rateType,
            source,
            observedAt,
            validFrom,
            validTo,
            correctionReason,
            status: 'DRAFT',
            isAuthoritative: false,
            createdByUserId: actor.userId,
            updatedByUserId: actor.userId,
          },
        });
        await tx.masterDataAuditEvent.create({
          data: {
            actorUserId: actor.userId,
            actorBranchId,
            action: 'master_data.create',
            resource: 'exchange-rates',
            entityId: row.id,
            outcome: AuditOutcome.SUCCESS,
            entityVersion: row.version,
            afterSnapshot: JSON.parse(
              JSON.stringify(redactedRate(row)),
            ) as Prisma.InputJsonValue,
            reason: correctionReason,
          },
        });
        rows.push({
          ...redactedRate(row),
          fromCurrencyCode: from.code,
          toCurrencyCode: to.code,
          createdByUserId: row.createdByUserId,
          approvedByUserId: null,
          approvedAt: null,
        });
      }
      return { data: rows };
    });
  }

  async history(query: CurrencyRateListDto) {
    const observedFrom = query.observedFrom
      ? new Date(query.observedFrom)
      : undefined;
    const observedTo = query.observedTo
      ? new Date(query.observedTo)
      : undefined;
    if (observedFrom && observedTo && observedFrom > observedTo)
      throw new BadRequestException(
        'ابتدای بازه تاریخچه باید قبل از انتهای آن باشد.',
      );
    const where = {
      ...(query.search?.trim()
        ? {
            OR: [
              {
                source: {
                  contains: query.search.trim(),
                  mode: 'insensitive' as const,
                },
              },
              {
                fromCurrency: {
                  code: {
                    contains: query.search.trim().toUpperCase(),
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                toCurrency: {
                  code: {
                    contains: query.search.trim().toUpperCase(),
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.fromCurrencyId ? { fromCurrencyId: query.fromCurrencyId } : {}),
      ...(query.toCurrencyId ? { toCurrencyId: query.toCurrencyId } : {}),
      ...(query.rateType ? { rateType: query.rateType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(observedFrom || observedTo
        ? {
            observedAt: {
              ...(observedFrom ? { gte: observedFrom } : {}),
              ...(observedTo ? { lte: observedTo } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.database.client.masterDraftExchangeRate.findMany({
        where,
        include: { fromCurrency: true, toCurrency: true },
        orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: Math.min(query.pageSize, 100),
      }),
      this.database.client.masterDraftExchangeRate.count({ where }),
    ]);
    return {
      data: data.map((row) => ({
        ...redactedRate(row),
        fromCurrencyCode: row.fromCurrency.code,
        toCurrencyCode: row.toCurrency.code,
        createdByUserId: row.createdByUserId,
        approvedByUserId: row.approvedByUserId,
        approvedAt: row.approvedAt,
      })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async current(
    fromCurrencyId: string,
    toCurrencyId: string,
    rateType: 'BUY' | 'SELL' | 'REFERENCE',
  ) {
    const now = new Date();
    const row = await this.database.client.masterDraftExchangeRate.findFirst({
      where: {
        fromCurrencyId,
        toCurrencyId,
        rateType,
        status: MasterCurrencyRateStatus.APPROVED,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      include: { fromCurrency: true, toCurrency: true },
      orderBy: [{ validFrom: 'desc' }, { approvedAt: 'desc' }],
    });
    return {
      data: row
        ? {
            ...redactedRate(row),
            fromCurrencyCode: row.fromCurrency.code,
            toCurrencyCode: row.toCurrency.code,
          }
        : null,
    };
  }

  decide(
    id: string,
    expectedVersion: number,
    reason: string,
    decision: 'approve' | 'reject',
    actor: AuthenticatedActor,
    requestedBranch?: string,
  ) {
    const normalizedReason = reason.trim();
    if (!normalizedReason)
      throw new BadRequestException('دلیل تصمیم الزامی است.');
    return this.database.client.$transaction(async (tx) => {
      const before = await tx.masterDraftExchangeRate.findUnique({
        where: { id },
      });
      if (!before) throw new NotFoundException('نرخ ارز یافت نشد.');
      if (before.status !== MasterCurrencyRateStatus.DRAFT)
        throw new ConflictException({
          code: 'CURRENCY_RATE_IMMUTABLE',
          message: 'فقط نرخ Draft قابل تصمیم‌گیری است.',
        });
      if (before.createdByUserId === actor.userId)
        throw new ForbiddenException(
          'ثبت‌کننده نرخ نمی‌تواند تأییدکننده یا ردکننده همان نرخ باشد.',
        );
      const nextStatus =
        decision === 'approve'
          ? MasterCurrencyRateStatus.APPROVED
          : MasterCurrencyRateStatus.REJECTED;
      const changed = await tx.masterDraftExchangeRate.updateMany({
        where: {
          id,
          version: expectedVersion,
          status: MasterCurrencyRateStatus.DRAFT,
        },
        data: {
          status: nextStatus,
          decisionReason: normalizedReason,
          approvedByUserId: decision === 'approve' ? actor.userId : null,
          approvedAt: decision === 'approve' ? new Date() : null,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: 'CONCURRENT_MODIFICATION',
          message: 'نرخ هم‌زمان تغییر کرده است.',
        });
      const row = await tx.masterDraftExchangeRate.findUniqueOrThrow({
        where: { id },
      });
      await tx.masterDataAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          actorBranchId: branchOf(actor, requestedBranch),
          action: `master_data.currency_rate.${decision}`,
          resource: 'exchange-rates',
          entityId: id,
          outcome: AuditOutcome.SUCCESS,
          beforeSnapshot: JSON.parse(
            JSON.stringify(redactedRate(before)),
          ) as Prisma.InputJsonValue,
          afterSnapshot: JSON.parse(
            JSON.stringify(redactedRate(row)),
          ) as Prisma.InputJsonValue,
          entityVersion: row.version,
          reason: normalizedReason,
        },
      });
      return { data: redactedRate(row) };
    });
  }

  async audit(resource: string, entityId: string, page = 1) {
    const pageSize = 25;
    const [data, total] = await Promise.all([
      this.database.client.masterDataAuditEvent.findMany({
        where: { resource, entityId },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.masterDataAuditEvent.count({
        where: { resource, entityId },
      }),
    ]);
    return { data, meta: { page, pageSize, total } };
  }
}
