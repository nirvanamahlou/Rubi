import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as Joi from 'joi';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
  TicketOfferCreateV1,
  TicketOfferSearchV1,
  TicketOfferV1,
  TicketStandaloneSalePriceUpdateV1,
  TicketOfferManagedPriceV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';

const uuid = Joi.string().guid();
const createSchema = Joi.object({
  originId: uuid.required(),
  destinationId: uuid.invalid(Joi.ref('originId')).required(),
  departureAt: Joi.string().isoDate().required(),
  arrivalAt: Joi.string().isoDate().required(),
  carrierName: Joi.string().trim().max(160).required(),
  serviceNumber: Joi.string().trim().max(80).required(),
  cabinClassCode: Joi.string().valid('ECONOMY', 'BUSINESS', 'FIRST').required(),
  totalCapacity: Joi.number().integer().min(0).max(100000).required(),
  standaloneSalePrice: Joi.object({
    amount: Joi.string()
      .pattern(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
      .required(),
    currencyCode: Joi.string()
      .pattern(/^[A-Z]{3}$/)
      .required(),
  }).allow(null),
});

export function validateTicketOffer(input: unknown): TicketOfferCreateV1 {
  const result = createSchema.validate(input, { convert: false });
  if (result.error) throw new BadRequestException('اطلاعات بلیت معتبر نیست.');
  const value = result.value as TicketOfferCreateV1;
  if (
    value.standaloneSalePrice &&
    new Prisma.Decimal(value.standaloneSalePrice.amount).lte(0)
  )
    throw new BadRequestException('قیمت فروش تکی باید بیشتر از صفر باشد.');
  if (new Date(value.arrivalAt) <= new Date(value.departureAt))
    throw new BadRequestException('زمان رسیدن باید پس از حرکت باشد.');
  return value;
}

@Injectable()
export class TicketPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProcurementPublicService)
    private readonly purchases: ProcurementPublicService,
  ) {}

  private require(
    actor: AuthenticatedActor,
    permission: 'ticket_catalog.read' | 'ticket_catalog.manage',
  ) {
    if (!actor.permissions.includes(permission))
      throw new ForbiddenException('مجوز بلیت وجود ندارد.');
  }

  async search(input: TicketOfferSearchV1, actor: AuthenticatedActor) {
    this.require(actor, 'ticket_catalog.read');
    const result = Joi.object({
      originId: uuid.required(),
      destinationId: uuid.required(),
      departureFrom: Joi.string().isoDate().required(),
      departureTo: Joi.string().isoDate(),
      cabinClassCode: Joi.string().valid('ECONOMY', 'BUSINESS', 'FIRST'),
      page: Joi.number().integer().min(1).max(10000).default(1),
    }).validate(input);
    if (result.error)
      throw new BadRequestException('فیلتر مسیر و تاریخ معتبر لازم است.');
    const query = result.value as TicketOfferSearchV1;
    const from = new Date(query.departureFrom);
    const to = query.departureTo
      ? new Date(`${query.departureTo.slice(0, 10)}T23:59:59.999Z`)
      : undefined;
    if (to && to < from)
      throw new BadRequestException('بازه تاریخ نامعتبر است.');
    const rows = await this.database.client.ticketPublishedOffer.findMany({
      where: {
        branchId: { in: actor.branchIds },
        status: 'ACTIVE',
        originId: query.originId,
        destinationId: query.destinationId,
        departureAt: { gte: from, ...(to ? { lte: to } : {}) },
        ...(query.cabinClassCode
          ? { cabinClassCode: query.cabinClassCode }
          : {}),
        totalCapacity: { gt: 0 },
      },
      include: {
        capacityAllocations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true },
        },
        standaloneSalePrices: { orderBy: { revision: 'desc' }, take: 1 },
      },
      orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
      skip: ((query.page ?? 1) - 1) * 50,
      take: 51,
    });
    return {
      version: 1 as const,
      data: rows.slice(0, 50).map((row): TicketOfferV1 => ({
        id: row.id,
        version: row.version,
        branchId: row.branchId,
        originId: row.originId,
        destinationId: row.destinationId,
        departureAt: row.departureAt.toISOString(),
        arrivalAt: row.arrivalAt.toISOString(),
        carrierName: row.carrierName,
        serviceNumber: row.serviceNumber,
        cabinClassCode: row.cabinClassCode as TicketOfferV1['cabinClassCode'],
        totalCapacity: row.totalCapacity,
        remainingCapacity:
          row.totalCapacity -
          row.capacityAllocations.reduce(
            (sum, allocation) => sum + allocation.quantity,
            0,
          ),
        status: row.status as TicketOfferV1['status'],
        standaloneSalePrice: row.standaloneSalePrices[0]
          ? {
              revision: row.standaloneSalePrices[0].revision,
              amount: row.standaloneSalePrices[0].amount.toString(),
              currencyCode: row.standaloneSalePrices[0].currencyCode,
            }
          : null,
      })),
      hasMore: rows.length > 50,
    };
  }

  async publish(
    input: TicketOfferCreateV1,
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ) {
    this.require(actor, 'ticket_catalog.manage');
    if (!branchId || !actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه مجاز لازم است.');
    if (!key?.trim() || key.length > 160)
      throw new BadRequestException('کلید درخواست معتبر لازم است.');
    const value = validateTicketOffer(input);
    const { standaloneSalePrice, ...offerFacts } = value;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ branchId, ...value }))
      .digest('hex');
    const row = await this.database.client.ticketPublishedOffer.upsert({
      where: {
        createdByUserId_createKey: {
          createdByUserId: actor.userId,
          createKey: key,
        },
      },
      update: {},
      create: {
        ...offerFacts,
        branchId,
        departureAt: new Date(value.departureAt),
        arrivalAt: new Date(value.arrivalAt),
        createdByUserId: actor.userId,
        createKey: key,
        fingerprint,
        audit: {
          create: {
            actorUserId: actor.userId,
            action: 'ticket.offer.published',
            version: 1,
          },
        },
        ...(standaloneSalePrice
          ? {
              standaloneSalePrices: {
                create: {
                  revision: 1,
                  amount: new Prisma.Decimal(standaloneSalePrice.amount),
                  currencyCode: standaloneSalePrice.currencyCode,
                  actorUserId: actor.userId,
                  commandKey: key,
                  fingerprint: createHash('sha256')
                    .update(JSON.stringify(standaloneSalePrice))
                    .digest('hex'),
                },
              },
            }
          : {}),
      },
    });
    // Legacy fingerprints depended on JSON field order. Compare stored offer facts
    // before rejecting a retried key so semantically identical requests remain safe.
    const sameOffer =
      row.branchId === branchId &&
      row.originId === value.originId &&
      row.destinationId === value.destinationId &&
      row.departureAt.getTime() === new Date(value.departureAt).getTime() &&
      row.arrivalAt.getTime() === new Date(value.arrivalAt).getTime() &&
      row.carrierName === value.carrierName &&
      row.serviceNumber === value.serviceNumber &&
      row.cabinClassCode === value.cabinClassCode &&
      row.totalCapacity === value.totalCapacity;
    // Compare the initial fare for replay; later legitimate revisions must not invalidate the publication key.
    const initialFare =
      await this.database.client.ticketOfferStandaloneSalePrice.findUnique({
        where: { offerId_commandKey: { offerId: row.id, commandKey: key } },
      });
    const sameFare = standaloneSalePrice
      ? !!initialFare &&
        initialFare.amount.equals(
          new Prisma.Decimal(standaloneSalePrice.amount),
        ) &&
        initialFare.currencyCode === standaloneSalePrice.currencyCode
      : !initialFare;
    if ((!sameFare || row.fingerprint !== fingerprint) && !sameOffer)
      throw new ConflictException(
        'کلید درخواست قبلاً با اطلاعات متفاوت استفاده شده است.',
      );
    if (!sameFare)
      throw new ConflictException(
        'کلید ثبت بلیط با قیمت فروش متفاوت استفاده شده است.',
      );
    // A failed public-producer call makes this command retriable with the same key.
    await this.purchases.ensureOfferPurchaseRequest(row);
    return { data: { id: row.id, version: row.version } };
  }

  async managedPrices(actor: AuthenticatedActor) {
    this.require(actor, 'ticket_catalog.manage');
    const rows = await this.database.client.ticketPublishedOffer.findMany({
      where: { branchId: { in: actor.branchIds } },
      include: {
        standaloneSalePrices: { orderBy: { revision: 'desc' }, take: 1 },
      },
      orderBy: [{ departureAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return {
      data: rows.map((row): TicketOfferManagedPriceV1 => ({
        id: row.id,
        carrierName: row.carrierName,
        serviceNumber: row.serviceNumber,
        departureAt: row.departureAt.toISOString(),
        originId: row.originId,
        destinationId: row.destinationId,
        standaloneSalePrice: row.standaloneSalePrices[0]
          ? {
              revision: row.standaloneSalePrices[0].revision,
              amount: row.standaloneSalePrices[0].amount.toString(),
              currencyCode: row.standaloneSalePrices[0].currencyCode,
            }
          : null,
      })),
    };
  }

  /** Appends a new list-price revision; published package prices remain independent. */
  async updateStandaloneSalePrice(
    offerId: string,
    input: TicketStandaloneSalePriceUpdateV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    this.require(actor, 'ticket_catalog.manage');
    if (!key?.trim() || key.length > 160)
      throw new BadRequestException('کلید درخواست معتبر لازم است.');
    const validation = Joi.object({
      expectedRevision: Joi.number().integer().min(0).required(),
      amount: Joi.string()
        .pattern(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/)
        .required(),
      currencyCode: Joi.string()
        .pattern(/^[A-Z]{3}$/)
        .required(),
      reason: Joi.string().trim().max(500).allow('').optional(),
    }).validate(input, { convert: false });
    if (validation.error || new Prisma.Decimal(input.amount).lte(0))
      throw new BadRequestException('قیمت فروش تکی یا ارز آن معتبر نیست.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ offerId, ...input }))
      .digest('hex');
    try {
      return await this.database.client.$transaction(
        async (transaction) => {
          const offer = await transaction.ticketPublishedOffer.findFirst({
            where: { id: offerId, branchId: { in: actor.branchIds } },
            select: { id: true },
          });
          if (!offer)
            throw new ForbiddenException('بلیط در شعبه مجاز یافت نشد.');
          const previousCommand =
            await transaction.ticketOfferStandaloneSalePrice.findUnique({
              where: { offerId_commandKey: { offerId, commandKey: key } },
            });
          if (previousCommand) {
            if (previousCommand.fingerprint !== fingerprint)
              throw new ConflictException(
                'کلید قبلاً با قیمت متفاوت استفاده شده است.',
              );
            return {
              data: {
                revision: previousCommand.revision,
                amount: previousCommand.amount.toString(),
                currencyCode: previousCommand.currencyCode,
              },
            };
          }
          const latest =
            await transaction.ticketOfferStandaloneSalePrice.findFirst({
              where: { offerId },
              orderBy: { revision: 'desc' },
            });
          if ((latest?.revision ?? 0) !== input.expectedRevision)
            throw new ConflictException(
              'قیمت بلیط تغییر کرده است؛ دوباره بارگذاری کنید.',
            );
          const row = await transaction.ticketOfferStandaloneSalePrice.create({
            data: {
              offerId,
              revision: input.expectedRevision + 1,
              amount: new Prisma.Decimal(input.amount),
              currencyCode: input.currencyCode,
              actorUserId: actor.userId,
              commandKey: key,
              fingerprint,
            },
          });
          return {
            data: {
              revision: row.revision,
              amount: row.amount.toString(),
              currencyCode: row.currencyCode,
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      )
        throw new ConflictException(
          'قیمت بلیط هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      throw error;
    }
  }

  /** Public module service; caller supplies the contract's authorized branch. This is revalidation, not a capacity hold. */
  async revalidate(
    offerIds: readonly string[],
    branchId: string,
    selections: readonly SalesTicketSelectionInput[] = [],
  ) {
    const available = await this.database.client.ticketPublishedOffer.findMany({
      where: {
        id: { in: [...offerIds] },
        branchId,
        status: 'ACTIVE',
        totalCapacity: { gt: 0 },
        departureAt: { gt: new Date() },
      },
    });
    const found = new Set(
      available
        .filter((offer) =>
          selections
            .filter((selection) => selection.offerId === offer.id)
            .every(
              (selection) =>
                selection.originId === offer.originId &&
                selection.destinationId === offer.destinationId &&
                new Date(selection.departureAt).getTime() ===
                  offer.departureAt.getTime() &&
                new Date(selection.arrivalAt).getTime() ===
                  offer.arrivalAt.getTime() &&
                selection.cabinClassCode === offer.cabinClassCode &&
                selection.carrierNameSnapshot === offer.carrierName &&
                selection.serviceNumberSnapshot === offer.serviceNumber,
            ),
        )
        .map(({ id }) => id),
    );
    const unavailableOfferIds = offerIds.filter((id) => !found.has(id));
    return { available: unavailableOfferIds.length === 0, unavailableOfferIds };
  }

  /** Atomically reserves one seat per non-infant passenger for every selected direction. */
  async reserve(
    selections: readonly SalesTicketSelectionInput[],
    branchId: string,
    contractId: string,
    seatCount: number,
  ) {
    if (!selections.length)
      return {
        available: true,
        unavailableOfferIds: [] as string[],
        createdAllocationIds: [] as string[],
      };
    const validation = Joi.object({
      branchId: uuid.required(),
      contractId: uuid.required(),
      seatCount: Joi.number().integer().min(1).max(100000).required(),
      selections: Joi.array()
        .items(
          Joi.object({
            offerId: uuid.required(),
            direction: Joi.string().valid('OUTBOUND', 'RETURN').required(),
          }).unknown(true),
        )
        .min(1)
        .max(2)
        .required(),
    }).validate(
      { branchId, contractId, seatCount, selections },
      { convert: false },
    );
    if (validation.error)
      throw new BadRequestException('تعداد مسافر یا انتخاب بلیت معتبر نیست.');
    if (
      new Set(selections.map(({ direction }) => direction)).size !==
      selections.length
    )
      throw new BadRequestException('برای هر جهت فقط یک بلیت قابل رزرو است.');

    return this.database.client.$transaction(async (transaction) => {
      const offerIds = [
        ...new Set(selections.map(({ offerId }) => offerId)),
      ].sort();
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "TicketPublishedOffer" WHERE "id" IN (${Prisma.join(
          offerIds,
        )}) ORDER BY "id" FOR UPDATE`,
      );
      const offers = await transaction.ticketPublishedOffer.findMany({
        where: {
          id: { in: offerIds },
          branchId,
          status: 'ACTIVE',
          departureAt: { gt: new Date() },
        },
        include: {
          capacityAllocations: {
            where: { status: 'ACTIVE' },
            select: { contractId: true, direction: true, quantity: true },
          },
        },
      });
      const byId = new Map(offers.map((offer) => [offer.id, offer]));
      const existing = await transaction.ticketOfferCapacityAllocation.findMany(
        {
          where: { contractId },
        },
      );
      const existingByDirection = new Map(
        existing.map((allocation) => [allocation.direction, allocation]),
      );
      const unavailableOfferIds = selections
        .filter((selection) => {
          const offer = byId.get(selection.offerId);
          const replay = existingByDirection.get(selection.direction);
          if (
            !offer ||
            selection.originId !== offer.originId ||
            selection.destinationId !== offer.destinationId ||
            new Date(selection.departureAt).getTime() !==
              offer.departureAt.getTime() ||
            new Date(selection.arrivalAt).getTime() !==
              offer.arrivalAt.getTime() ||
            selection.cabinClassCode !== offer.cabinClassCode ||
            selection.carrierNameSnapshot !== offer.carrierName ||
            selection.serviceNumberSnapshot !== offer.serviceNumber
          )
            return true;
          if (replay)
            return (
              replay.status !== 'ACTIVE' ||
              replay.offerId !== offer.id ||
              replay.quantity !== seatCount
            );
          const allocated = offer.capacityAllocations.reduce(
            (sum, allocation) => sum + allocation.quantity,
            0,
          );
          return offer.totalCapacity - allocated < seatCount;
        })
        .map(({ offerId }) => offerId);
      if (unavailableOfferIds.length)
        return {
          available: false,
          unavailableOfferIds,
          createdAllocationIds: [] as string[],
        };
      const createdAllocationIds: string[] = [];
      for (const selection of selections) {
        if (existingByDirection.has(selection.direction)) continue;
        const created = await transaction.ticketOfferCapacityAllocation.create({
          data: {
            offerId: selection.offerId,
            contractId,
            direction: selection.direction,
            quantity: seatCount,
          },
          select: { id: true },
        });
        createdAllocationIds.push(created.id);
      }
      return { available: true, unavailableOfferIds: [], createdAllocationIds };
    });
  }

  async release(allocationIds: readonly string[]) {
    if (!allocationIds.length) return;
    await this.database.client.ticketOfferCapacityAllocation.updateMany({
      where: { id: { in: [...allocationIds] }, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
  async releaseContract(contractId: string) {
    await this.database.client.ticketOfferCapacityAllocation.updateMany({
      where: { contractId, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
}
