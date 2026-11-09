import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { contractIntakeReferences } from '../reservations/contract-references.public';

/** Contract ownership is independent of user context and branch membership. */
@Injectable()
export class ContractCompanyScope {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LegalEntitiesService)
    private readonly entities: LegalEntitiesService,
  ) {}

  async selected(actor: AuthenticatedActor, requireSingle = false) {
    const { data } = await this.entities.current(actor);
    if (data.isAggregate) {
      if (!actor.permissions.includes('legal-entity.aggregate.read'))
        throw new ForbiddenException();
      if (requireSingle)
        throw new BadRequestException(
          'برای ثبت قرارداد، یک شرکت را از بالای صفحه انتخاب کنید.',
        );
      return null;
    }
    if (!data.legalEntity)
      throw new BadRequestException('ابتدا شرکت فعال را انتخاب کنید.');
    return data.legalEntity.id;
  }

  async where(
    actor: AuthenticatedActor,
    hidden = false,
  ): Promise<Prisma.SalesContractWhereInput> {
    const legalEntityId = await this.selected(actor);
    return {
      hiddenAt: hidden ? { not: null } : null,
      ...(legalEntityId ? { legalEntityId } : {}),
    };
  }

  async ids(actor: AuthenticatedActor) {
    const rows = await this.db.client.salesContract.findMany({
      where: await this.where(actor),
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  /** Shared operational queue; issuer selection is not an authorization scope. */
  async reservationInboxIds(branchIds: readonly string[]) {
    const rows = await this.db.client.salesContract.findMany({
      where: { hiddenAt: null, branchId: { in: [...branchIds] } },
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  async excludedReferences(actor: AuthenticatedActor) {
    const rows = await this.db.client.salesContract.findMany({
      where: { NOT: await this.where(actor) },
      select: { id: true, contractNumber: true },
    });
    return {
      ids: rows.map((row) => row.id),
      numbers: rows.map((row) => row.contractNumber),
    };
  }

  async operationalWhere(
    actor: AuthenticatedActor,
  ): Promise<Prisma.FinanceOperationalRequestWhereInput> {
    const excluded = await this.excludedReferences(actor);
    return {
      AND: [
        { reference: { notIn: [...excluded.ids, ...excluded.numbers] } },
        {
          OR: [
            { refundReceiptId: null },
            { refundReceipt: { contractId: { notIn: excluded.ids } } },
          ],
        },
      ],
    };
  }

  async eventWhere(
    actor: AuthenticatedActor,
  ): Promise<Prisma.FinanceAccountingEventWhereInput> {
    const excluded = await this.excludedReferences(actor);
    const intakes = await contractIntakeReferences(
      this.db.client,
      excluded.ids,
    );
    return {
      AND: [
        {
          requestId: {
            notIn: [
              ...excluded.ids,
              ...intakes.flatMap((row) => [
                row.id,
                row.requestId,
                ...row.servicePurchases.map((purchase) => purchase.id),
              ]),
            ],
          },
        },
        {
          OR: [
            { trackingNumber: null },
            { trackingNumber: { notIn: excluded.numbers } },
          ],
        },
      ],
    };
  }

  async assertVisible(contractId: string, actor: AuthenticatedActor) {
    const row = await this.db.client.salesContract.findFirst({
      where: { AND: [{ id: contractId }, await this.where(actor)] },
      select: { id: true },
    });
    if (!row)
      throw new NotFoundException('قرارداد در شرکت انتخاب‌شده یافت نشد.');
  }

  /** Callers must first authorize access to the individual contract/intake. */
  async owner(contractId: string) {
    const row = await this.db.client.salesContract.findUnique({
      where: { id: contractId },
      select: { legalEntity: true },
    });
    if (!row?.legalEntity)
      throw new NotFoundException('شرکت قرارداد یافت نشد.');
    return row.legalEntity;
  }

  async hidden(actor: AuthenticatedActor, search: unknown, page: unknown) {
    this.authorizeArchive(actor, false);
    const term = typeof search === 'string' ? search.trim() : '';
    const index = page === undefined ? 1 : Number(page);
    if (
      term.length > 100 ||
      !Number.isSafeInteger(index) ||
      index < 1 ||
      index > 100000
    )
      throw new BadRequestException('جست‌وجو یا شماره صفحه معتبر نیست.');
    const where: Prisma.SalesContractWhereInput = {
      AND: [
        await this.where(actor, true),
        { branchId: { in: actor.branchIds } },
        ...(term
          ? [
              {
                OR: [
                  { contractNumber: { contains: term } },
                  {
                    customerNameSnapshot: {
                      contains: term,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [total, data] = await this.db.client.$transaction([
      this.db.client.salesContract.count({ where }),
      this.db.client.salesContract.findMany({
        where,
        skip: (index - 1) * 50,
        take: 50,
        orderBy: [{ departureDate: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          contractNumber: true,
          customerNameSnapshot: true,
          departureDate: true,
          hiddenAt: true,
          legalEntity: { select: { persianName: true } },
        },
      }),
    ]);
    return { data, total, page: index };
  }

  async restore(actor: AuthenticatedActor, body: unknown) {
    this.authorizeArchive(actor, true);
    const ids = (body as { ids?: unknown })?.ids;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 100 ||
      ids.some(
        (id) =>
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          ),
      )
    )
      throw new BadRequestException('قراردادهای موردنظر را انتخاب کنید.');
    const unique = [...new Set(ids)] as string[];
    const scope = await this.where(actor, true);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sales_contracts WHERE id IN (${Prisma.join(unique.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
      );
      const rows = await tx.salesContract.findMany({
        where: {
          AND: [
            scope,
            { id: { in: unique }, branchId: { in: actor.branchIds } },
          ],
        },
      });
      if (rows.length !== unique.length)
        throw new NotFoundException(
          'قرارداد پنهان‌شده در شرکت و شعبه انتخاب‌شده یافت نشد.',
        );
      await tx.salesContract.updateMany({
        where: { id: { in: unique } },
        data: { hiddenAt: null },
      });
      await tx.salesContractAuditEvent.createMany({
        data: rows.map((row) => ({
          contractId: row.id,
          actorUserId: actor.userId,
          actorBranchId: row.branchId,
          action: 'sales.contract.restored',
          outcome: 'SUCCESS' as const,
          beforeSnapshot: {
            hiddenAt: row.hiddenAt!.toISOString(),
            legalEntityId: row.legalEntityId,
          },
          afterSnapshot: { hiddenAt: null, legalEntityId: row.legalEntityId },
        })),
      });
      return { restored: rows.length };
    });
  }

  private authorizeArchive(actor: AuthenticatedActor, write: boolean) {
    if (
      !actor.permissions.includes(
        write ? 'system.settings.manage' : 'system.settings.read',
      )
    )
      throw new ForbiddenException();
  }
}
