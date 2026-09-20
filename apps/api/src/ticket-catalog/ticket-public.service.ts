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
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';

const uuid = Joi.string().guid();
const capacityHoldSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(100000).required(),
  expiresAt: Joi.string().isoDate().required(),
});
type CapacityHoldInput = { quantity: number; expiresAt: string };
const createSchema = Joi.object({
  originId: uuid.required(),
  destinationId: uuid.invalid(Joi.ref('originId')).required(),
  departureAt: Joi.string().isoDate().required(),
  arrivalAt: Joi.string().isoDate().required(),
  carrierName: Joi.string().trim().max(160).required(),
  serviceNumber: Joi.string().trim().max(80).required(),
  cabinClassCode: Joi.string().valid('ECONOMY', 'BUSINESS', 'FIRST').required(),
  totalCapacity: Joi.number().integer().min(0).max(100000).required(),
});

export function validateTicketOffer(input: unknown): TicketOfferCreateV1 {
  const result = createSchema.validate(input, { convert: false });
  if (result.error) throw new BadRequestException('اطلاعات بلیت معتبر نیست.');
  const value = result.value as TicketOfferCreateV1;
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

  private offerView(row: {
    id: string;
    version: number;
    branchId: string;
    originId: string;
    destinationId: string;
    departureAt: Date;
    arrivalAt: Date;
    carrierName: string;
    serviceNumber: string;
    cabinClassCode: string;
    totalCapacity: number;
    status: string;
    capacityAllocations: readonly { quantity: number }[];
    capacityHolds: readonly { quantity: number }[];
  }): TicketOfferV1 {
    return {
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
        ) -
        row.capacityHolds.reduce((sum, hold) => sum + hold.quantity, 0),
      status: row.status as TicketOfferV1['status'],
    };
  }

  private async pauseExpiredOffers(
    actor: AuthenticatedActor,
    now = new Date(),
  ) {
    if (!actor.branchIds.length) return;
    await this.database.client.$transaction(async (tx) => {
      const expired = await tx.ticketPublishedOffer.findMany({
        where: {
          branchId: { in: actor.branchIds },
          status: 'ACTIVE',
          departureAt: { lte: now },
        },
        select: { id: true, version: true },
        take: 500,
      });
      for (const offer of expired) {
        const updated = await tx.ticketPublishedOffer.updateMany({
          where: {
            id: offer.id,
            status: 'ACTIVE',
            version: offer.version,
          },
          data: { status: 'PAUSED', version: { increment: 1 } },
        });
        if (updated.count === 1)
          await tx.ticketOfferAudit.create({
            data: {
              offerId: offer.id,
              actorUserId: actor.userId,
              action: 'ticket.offer.expired',
              version: offer.version + 1,
            },
          });
      }
    });
  }

  /** Management and Sales deliberately read the same published offer rows. */
  async managed(actor: AuthenticatedActor) {
    this.require(actor, 'ticket_catalog.manage');
    await this.pauseExpiredOffers(actor);
    const rows = await this.database.client.ticketPublishedOffer.findMany({
      where: { branchId: { in: actor.branchIds } },
      include: {
        capacityAllocations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true },
        },
        capacityHolds: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          select: { quantity: true },
        },
      },
      orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
    return {
      version: 1 as const,
      data: rows.map((row) => this.offerView(row)),
    };
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
    const now = new Date();
    await this.pauseExpiredOffers(actor, now);
    const effectiveFrom = from > now ? from : now;
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
        departureAt: { gte: effectiveFrom, ...(to ? { lte: to } : {}) },
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
        capacityHolds: {
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          select: { quantity: true },
        },
      },
      orderBy: [{ departureAt: 'asc' }, { id: 'asc' }],
      skip: ((query.page ?? 1) - 1) * 50,
      take: 51,
    });
    return {
      version: 1 as const,
      data: rows.slice(0, 50).map((row) => this.offerView(row)),
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
        ...value,
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
    if (row.fingerprint !== fingerprint && !sameOffer)
      throw new ConflictException(
        'کلید درخواست قبلاً با اطلاعات متفاوت استفاده شده است.',
      );
    // A failed public-producer call makes this command retriable with the same key.
    await this.purchases.ensureOfferPurchaseRequest(row);
    return { data: { id: row.id, version: row.version } };
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
          capacityHolds: {
            where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
            select: { quantity: true },
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
          const allocated =
            offer.capacityAllocations.reduce(
              (sum, allocation) => sum + allocation.quantity,
              0,
            ) +
            offer.capacityHolds.reduce((sum, hold) => sum + hold.quantity, 0);
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

  async holdTemporary(
    offerId: string,
    input: CapacityHoldInput,
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ) {
    this.require(actor, 'ticket_catalog.manage');
    if (
      !uuid.validate(offerId).error &&
      branchId &&
      actor.branchIds.includes(branchId) &&
      key?.trim() &&
      key.length <= 160
    ) {
      // Valid envelope; detailed input validation and transaction follow.
    } else throw new ForbiddenException('شعبه یا کلید درخواست معتبر لازم است.');
    const validation = capacityHoldSchema.validate(input, { convert: false });
    if (validation.error)
      throw new BadRequestException('تعداد یا زمان انقضای رزرو معتبر نیست.');
    const value = validation.value as CapacityHoldInput;
    const expiresAt = new Date(value.expiresAt);
    const now = new Date();
    if (
      expiresAt <= now ||
      expiresAt.getTime() > now.getTime() + 30 * 86_400_000
    )
      throw new BadRequestException(
        'انقضای رزرو باید حداکثر تا ۳۰ روز آینده باشد.',
      );
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          offerId,
          branchId,
          quantity: value.quantity,
          expiresAt: expiresAt.toISOString(),
        }),
      )
      .digest('hex');
    return this.database.client.$transaction(async (transaction) => {
      const replay = await transaction.ticketOfferCapacityHold.findUnique({
        where: {
          createdByUserId_idempotencyKey: {
            createdByUserId: actor.userId,
            idempotencyKey: key!,
          },
        },
      });
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          throw new ConflictException(
            'کلید درخواست قبلاً با اطلاعات متفاوت استفاده شده است.',
          );
        return {
          data: {
            id: replay.id,
            quantity: replay.quantity,
            expiresAt: replay.expiresAt.toISOString(),
            status: replay.status,
          },
        };
      }
      await transaction.ticketOfferCapacityHold.updateMany({
        where: { offerId, status: 'ACTIVE', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', releasedAt: now },
      });
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "TicketPublishedOffer" WHERE "id" = ${offerId} FOR UPDATE`,
      );
      const offer = await transaction.ticketPublishedOffer.findFirst({
        where: {
          id: offerId,
          branchId,
          status: 'ACTIVE',
          departureAt: { gt: now },
        },
        include: {
          capacityAllocations: {
            where: { status: 'ACTIVE' },
            select: { quantity: true },
          },
          capacityHolds: {
            where: { status: 'ACTIVE', expiresAt: { gt: now } },
            select: { quantity: true },
          },
        },
      });
      if (!offer) throw new BadRequestException('بلیط قابل رزرو نیست.');
      const used =
        offer.capacityAllocations.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ) + offer.capacityHolds.reduce((sum, item) => sum + item.quantity, 0);
      if (offer.totalCapacity - used < value.quantity)
        throw new ConflictException(
          'ظرفیت باقی‌مانده برای این تعداد نفر کافی نیست.',
        );
      const hold = await transaction.ticketOfferCapacityHold.create({
        data: {
          offerId,
          branchId: branchId!,
          quantity: value.quantity,
          expiresAt,
          createdByUserId: actor.userId,
          idempotencyKey: key!,
          fingerprint,
        },
      });
      return {
        data: {
          id: hold.id,
          quantity: hold.quantity,
          expiresAt: hold.expiresAt.toISOString(),
          status: hold.status,
        },
      };
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
