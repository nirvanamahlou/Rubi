import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as Joi from 'joi';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
  TicketOfferCreateV1,
  TicketOfferSearchV1,
  TicketOfferV1,
} from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';

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
        status: row.status as TicketOfferV1['status'],
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
    if (row.fingerprint !== fingerprint)
      throw new ConflictException(
        'کلید درخواست قبلاً با اطلاعات متفاوت استفاده شده است.',
      );
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
}
