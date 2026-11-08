import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  hasAccessControl,
  type AuthenticatedActor,
  type ExchangeOfficeInputV1,
  type ExchangeOfficeListV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import {
  bankUuid,
  bankVersion,
} from '../bank-accounts/bank-account.validation';

@Injectable()
export class ExchangeOfficeService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterProcurementDirectory)
    private readonly directory: MasterProcurementDirectory,
  ) {}
  private require(actor: AuthenticatedActor, manage = false) {
    const directoryAccess =
      actor.permissions.includes('master_data.read') &&
      hasAccessControl(actor.permissions, 'master-data.resource.banks');
    if (
      !actor.permissions.includes('finance.read') ||
      (manage
        ? !directoryAccess ||
          !actor.permissions.includes('finance.account.manage')
        : !directoryAccess &&
          !actor.permissions.includes('finance.payment.create'))
    )
      throw new ForbiddenException('دسترسی به صندوق‌های ارزی مجاز نیست.');
  }
  async options(actor: AuthenticatedActor) {
    this.require(actor);
    const [countries, currencies] = await Promise.all([
      this.directory.exchangeCountries(),
      this.directory.currencies(),
    ]);
    return {
      countries,
      currencies: currencies.map(({ code, name }) => ({ code, name })),
      canManage:
        actor.permissions.includes('finance.account.manage') &&
        actor.permissions.includes('master_data.read') &&
        hasAccessControl(actor.permissions, 'master-data.resource.banks'),
    };
  }
  async list(
    query: Record<string, string | undefined>,
    actor: AuthenticatedActor,
  ): Promise<ExchangeOfficeListV1> {
    this.require(actor);
    const page = Number(query.page ?? 1);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000 ||
      (query.search?.length ?? 0) > 200
    )
      throw new BadRequestException('فیلتر صرافی معتبر نیست.');
    const where: Prisma.FinanceExchangeOfficeWhereInput = {
      deletedAt: null,
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: 'insensitive' } },
              { phone: { contains: query.search.trim() } },
            ],
          }
        : {}),
      ...(query.countryId ? { countryId: bankUuid(query.countryId) } : {}),
      ...(query.status === 'active'
        ? { isActive: true }
        : query.status === 'inactive'
          ? { isActive: false }
          : {}),
      ...(query.currencyCode
        ? { balances: { some: { currencyCode: query.currencyCode } } }
        : {}),
    };
    return this.db.client.$transaction(
      async (tx) => {
        const [rows, total, active, sums] = await Promise.all([
          tx.financeExchangeOffice.findMany({
            where,
            include: { balances: { orderBy: { currencyCode: 'asc' } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 26,
            skip: (page - 1) * 25,
          }),
          tx.financeExchangeOffice.count({ where: { deletedAt: null } }),
          tx.financeExchangeOffice.count({
            where: { deletedAt: null, isActive: true },
          }),
          tx.financeExchangeBalance.groupBy({
            by: ['currencyCode'],
            where: {
              office: { deletedAt: null },
              currencyCode: { in: ['USD', 'EUR'] },
            },
            _sum: { amount: true },
          }),
        ]);
        return {
          page,
          hasMore: rows.length > 25,
          items: rows.slice(0, 25).map((row) => ({
            id: row.id,
            title: row.title,
            countryId: row.countryId,
            address: row.address,
            phone: row.phone,
            isActive: row.isActive,
            version: row.version,
            balances: row.balances.map((b) => ({
              currencyCode: b.currencyCode,
              amount: b.amount.toString(),
            })),
          })),
          kpis: {
            total,
            active,
            usd:
              sums
                .find((s) => s.currencyCode === 'USD')
                ?._sum.amount?.toString() ?? '0',
            eur:
              sums
                .find((s) => s.currencyCode === 'EUR')
                ?._sum.amount?.toString() ?? '0',
          },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async save(
    id: string | null,
    input: ExchangeOfficeInputV1,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, true);
    if (
      !input ||
      typeof input !== 'object' ||
      typeof input.title !== 'string' ||
      !input.title.trim() ||
      input.title.trim().length > 200 ||
      (input.isActive !== undefined && typeof input.isActive !== 'boolean')
    )
      throw new BadRequestException('اطلاعات صرافی معتبر نیست.');
    for (const [key, limit] of [
      ['address', 1000],
      ['phone', 80],
    ] as const)
      if (
        input[key] != null &&
        (typeof input[key] !== 'string' || input[key]!.length > limit)
      )
        throw new BadRequestException('اطلاعات صرافی معتبر نیست.');
    const officeId = bankUuid(id ?? input.requestId);
    const version = id ? bankVersion(input.expectedVersion) : null;
    const countryId = input.countryId ? bankUuid(input.countryId) : null;
    if (
      input.balances !== undefined &&
      (!Array.isArray(input.balances) || input.balances.length > 50)
    )
      throw new BadRequestException('موجودی صرافی معتبر نیست.');
    const seen = new Set<string>();
    const balances = (input.balances ?? []).map((b) => {
      if (
        !b ||
        typeof b.currencyCode !== 'string' ||
        !/^[A-Z]{3}$/.test(b.currencyCode) ||
        seen.has(b.currencyCode) ||
        typeof b.amount !== 'string' ||
        !/^\d{1,20}(\.\d{1,4})?$/.test(b.amount)
      )
        throw new BadRequestException('موجودی صرافی معتبر نیست.');
      seen.add(b.currencyCode);
      return {
        currencyCode: b.currencyCode,
        amount: new Prisma.Decimal(b.amount),
      };
    });
    return this.db.client.$transaction(async (tx) => {
      if (countryId) await this.directory.assertExchangeCountry(countryId, tx);
      for (const b of balances)
        await this.directory.assertCurrency(b.currencyCode, tx);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exchange-office:${officeId}`}, 0))::text`;
      const previous = await tx.financeExchangeOffice.findUnique({
        where: { id: officeId },
        include: { balances: true },
      });
      const values = {
        title: input.title.trim(),
        countryId,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        isActive: input.isActive ?? true,
      };
      if (!id && previous) {
        if (
          previous.createdByUserId !== actor.userId ||
          previous.deletedAt ||
          previous.version !== 1 ||
          Object.entries(values).some(
            ([k, v]) => previous[k as keyof typeof values] !== v,
          ) ||
          previous.balances.length !== balances.length ||
          balances.some(
            (b) =>
              !previous.balances.some(
                (p) =>
                  p.currencyCode === b.currencyCode &&
                  p.amount.equals(b.amount),
              ),
          )
        )
          throw new ConflictException(
            'این درخواست صرافی قبلاً با اطلاعات دیگری ثبت شده است.',
          );
        return { id: officeId, version: previous.version };
      }
      if (id) {
        if (!previous || previous.deletedAt)
          throw new NotFoundException('صرافی یافت نشد.');
        const result = await tx.financeExchangeOffice.updateMany({
          where: { id: officeId, version: version!, deletedAt: null },
          data: { ...values, version: { increment: 1 } },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'اطلاعات یا موجودی صرافی تغییر کرده است؛ دوباره آن را باز کنید.',
          );
      } else
        await tx.financeExchangeOffice.create({
          data: { id: officeId, ...values, createdByUserId: actor.userId },
        });
      for (const b of balances) {
        const old =
          previous?.balances.find((p) => p.currencyCode === b.currencyCode)
            ?.amount ?? new Prisma.Decimal(0);
        const row = await tx.financeExchangeBalance.upsert({
          where: {
            officeId_currencyCode: { officeId, currencyCode: b.currencyCode },
          },
          create: { officeId, ...b },
          update: { amount: b.amount },
        });
        await tx.financeExchangeMovement.create({
          data: {
            balanceId: row.id,
            delta: b.amount.sub(old),
            afterAmount: b.amount,
            kind: 'ADJUSTMENT',
            actorUserId: actor.userId,
          },
        });
      }
      await tx.financeExchangeAudit.create({
        data: {
          officeId,
          actorUserId: actor.userId,
          action: id ? 'UPDATE' : 'CREATE',
          metadata: {
            ...values,
            version: (version ?? 0) + 1,
            balances: balances.map((b) => ({
              currencyCode: b.currencyCode,
              amount: b.amount.toString(),
            })),
          },
        },
      });
      return { id: officeId, version: (version ?? 0) + 1 };
    });
  }
  async remove(id: string, expectedVersion: number, actor: AuthenticatedActor) {
    this.require(actor, true);
    return this.db.client.$transaction(async (tx) => {
      const changed = await tx.financeExchangeOffice.updateMany({
        where: {
          id: bankUuid(id),
          version: bankVersion(expectedVersion),
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          isActive: false,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'اطلاعات یا موجودی صرافی تغییر کرده است؛ دوباره آن را باز کنید.',
        );
      await tx.financeExchangeAudit.create({
        data: {
          officeId: id,
          actorUserId: actor.userId,
          action: 'DELETE',
          metadata: { version: expectedVersion + 1 },
        },
      });
      return { id };
    });
  }
}
