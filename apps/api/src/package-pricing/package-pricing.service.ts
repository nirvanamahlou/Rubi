import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  PackageBannerTemplateCreateInputV1,
  PackageCreateInputV1,
  PackageListQueryV1,
  PackagePriceVersionCreateInputV1,
  PackagePricingRuleInputV1,
  PackagePublishInputV1,
  PackageQuoteCreateInputV1,
  PackageRenderCreateInputV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import * as Joi from 'joi';

import { DatabaseService } from '../database/database.service';
import { HotelPurchaseRatesPublicService } from '../reservations/hotel-purchase-rates.public';
import { TourPublicService } from '../ticket-catalog/tour-public.service';
import { FinanceTicketCostService } from '../finance/ticket-cost/finance-ticket-cost.service';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import {
  calculatePackagePrice,
  calculatePassengerPrice,
  PackagePricingDomainError,
} from './package-pricing.domain';
import {
  PACKAGE_PRICING_SOURCE_PORT,
  type PackagePricingResolvedSource,
  type PackagePricingSourcePort,
} from './package-pricing-source.port';

const uuid = Joi.string().guid();
const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const decimal = Joi.string().pattern(/^(0|[1-9]\d{0,17})(\.\d{1,10})?$/);
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function key(value?: string) {
  if (!value?.trim() || value.length > 160)
    throw new BadRequestException({
      code: 'PACKAGE_VALIDATION_FAILED',
      message: 'Idempotency-Key معتبر لازم است.',
    });
  return value.trim();
}
function branch(actor: AuthenticatedActor, value?: string) {
  if (!value || !actor.branchIds.includes(value))
    throw new ForbiddenException({ code: 'PACKAGE_FORBIDDEN' });
  return value;
}
const source = Joi.object({
  owner: Joi.string()
    .valid(
      'MASTER_DATA',
      'TICKET_CATALOG',
      'RESERVATIONS',
      'FINANCE',
      'PROCUREMENT',
    )
    .required(),
  kind: Joi.string().trim().max(80).required(),
  id: uuid.required(),
  version: Joi.number().integer().min(1).required(),
}).required();
function validateCreate(raw: unknown): PackageCreateInputV1 {
  const result = Joi.object({
    code: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9_-]{3,40}$/)
      .required(),
    titleFa: Joi.string().trim().max(200).required(),
    titleEn: Joi.string().trim().max(200).required(),
    issuerLegalEntityId: uuid.required(),
    issuerLegalEntityVersion: Joi.number().integer().min(1).required(),
    destinationId: uuid.required(),
    destinationNameSnapshot: Joi.string().trim().max(200).required(),
    departureDate: dateOnly.required(),
    returnDate: dateOnly.required(),
    nights: Joi.number().integer().min(1).max(365).required(),
    days: Joi.number().integer().min(1).max(366).required(),
    capacity: Joi.number().integer().min(1).max(100000).required(),
    priceValidUntil: Joi.string().isoDate().required(),
    description: Joi.string().trim().max(2000).allow(null, ''),
    terms: Joi.string().trim().max(4000).allow(null, ''),
    components: Joi.array()
      .items(
        Joi.object({
          clientKey: Joi.string().trim().max(80).required(),
          kind: Joi.string()
            .valid(
              'OUTBOUND_TICKET',
              'RETURN_TICKET',
              'HOTEL',
              'VISA',
              'INSURANCE',
              'TRANSFER',
              'TOUR',
              'LEADER',
              'OTHER',
            )
            .required(),
          source,
          titleSnapshot: Joi.string().trim().max(240).required(),
          quantity: Joi.number().integer().min(1).max(100000).required(),
          capacity: Joi.number().integer().min(0).max(100000).allow(null),
          metadata: Joi.object().max(40),
        }),
      )
      .min(1)
      .max(100)
      .required(),
    hotelOptions: Joi.array()
      .items(
        Joi.object({
          hotel: source,
          hotelNameSnapshot: Joi.string().trim().max(200).required(),
          roomType: source,
          roomTypeNameSnapshot: Joi.string().trim().max(160).required(),
          mealService: source,
          mealServiceNameSnapshot: Joi.string().trim().max(160).required(),
          checkInDate: dateOnly.required(),
          checkOutDate: dateOnly.required(),
        }),
      )
      .max(50)
      .required(),
  }).validate(raw, { convert: false, abortEarly: false });
  if (result.error)
    throw new BadRequestException({
      code: 'PACKAGE_VALIDATION_FAILED',
      message: 'اطلاعات پکیج معتبر نیست.',
    });
  const value = result.value as PackageCreateInputV1;
  if (
    value.returnDate <= value.departureDate ||
    new Set(value.components.map(({ clientKey }) => clientKey)).size !==
      value.components.length ||
    value.hotelOptions.some((item) => item.checkOutDate <= item.checkInDate)
  )
    throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
  return value;
}

@Injectable()
export class PackagePricingService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LegalEntitiesService)
    private readonly legalEntities: LegalEntitiesService,
    @Inject(PACKAGE_PRICING_SOURCE_PORT)
    private readonly sources: PackagePricingSourcePort,
    @Inject(TourPublicService)
    private readonly tours: TourPublicService,
    @Inject(HotelPurchaseRatesPublicService)
    private readonly hotelPurchases: HotelPurchaseRatesPublicService,
    @Inject(FinanceTicketCostService)
    private readonly flightCosts: FinanceTicketCostService,
  ) {}

  async pricingTourDepartures(actor: AuthenticatedActor) {
    return this.tours.pricingDepartures(actor.branchIds);
  }

  async tourCostGrid(tourDepartureId: string, actor: AuthenticatedActor) {
    const tour = await this.tours.pricingDeparture(
      tourDepartureId,
      actor.branchIds,
    );
    const offerIds = [tour.outboundOfferId, tour.returnOfferId].filter(
      (id): id is string => !!id,
    );
    const [purchaseBatches, flightPurchaseCosts] = await Promise.all([
      this.hotelPurchases.forTour(
        tour.branchId,
        tour.package.hotelIds,
        tour.startsOn,
        tour.endsOn,
        tour.id,
        tour.package.destinationId,
      ),
      this.flightCosts.paidCostsForOffers(offerIds, tour.branchId),
    ]);
    const nights =
      (Date.parse(`${tour.endsOn}T00:00:00.000Z`) -
        Date.parse(`${tour.startsOn}T00:00:00.000Z`)) /
      86_400_000;
    return {
      version: 1 as const,
      tour,
      nights,
      purchaseBatches,
      flightPurchaseCosts,
      missingFlightOfferIds: offerIds.filter(
        (id) =>
          !flightPurchaseCosts.some(
            (cost) =>
              cost.offerId === id &&
              cost.offerVersion ===
                (id === tour.outboundOfferId
                  ? tour.outbound.version
                  : tour.returning?.version),
          ),
      ),
      missingHotelIds: tour.package.hotelIds.filter(
        (hotelId) =>
          !purchaseBatches.some((batch) =>
            batch.rows.some((row) => row.hotelId === hotelId),
          ),
      ),
    };
  }

  async list(query: PackageListQueryV1, actor: AuthenticatedActor) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const where: Prisma.PackagePricingPackageWhereInput = {
      branchId: {
        in: query.branchId ? [branch(actor, query.branchId)] : actor.branchIds,
      },
      ...(query.status ? { status: query.status } : {}),
      ...(query.destinationId ? { destinationId: query.destinationId } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { code: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                titleFa: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                titleEn: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(query.departureFrom || query.departureTo
        ? {
            departures: {
              some: {
                departureDate: {
                  ...(query.departureFrom
                    ? { gte: new Date(query.departureFrom) }
                    : {}),
                  ...(query.departureTo
                    ? { lte: new Date(query.departureTo) }
                    : {}),
                },
              },
            },
          }
        : {}),
    };
    const sortBy =
      query.sortBy === 'code' || query.sortBy === 'titleFa'
        ? query.sortBy
        : 'updatedAt';
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.packagePricingPackage.findMany({
        where,
        include: {
          departures: {
            where: { isArchived: false },
            orderBy: { departureDate: 'asc' },
            include: {
              priceVersions: {
                where: { status: 'PUBLISHED' },
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { [sortBy]: query.sortDirection ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.packagePricingPackage.count({ where }),
    ]);
    return {
      version: 1 as const,
      data: rows.map((row) => {
        const departure = row.departures[0];
        const price = departure?.priceVersions[0];
        return {
          id: row.id,
          code: row.code,
          titleFa: row.titleFa,
          titleEn: row.titleEn,
          destinationId: row.destinationId,
          destinationNameSnapshot: row.destinationNameSnapshot,
          departureDate:
            departure?.departureDate.toISOString().slice(0, 10) ?? '',
          returnDate: departure?.returnDate.toISOString().slice(0, 10) ?? '',
          nights: departure?.nights ?? 0,
          days: departure?.days ?? 0,
          capacity: departure?.capacity ?? 0,
          status: row.status,
          version: row.version,
          latestPrice: price
            ? {
                amount: price.finalAmount.toString(),
                currencyCode: price.currencyCode,
                version: price.version,
                marginAmount: price.profitAmount.toString(),
                marginPercent: price.marginPercent.toString(),
              }
            : null,
          updatedAt: row.updatedAt.toISOString(),
          updatedByUserId: row.updatedByUserId,
        };
      }),
      meta: { page, pageSize, total },
    };
  }

  async detail(id: string, actor: AuthenticatedActor) {
    const row = await this.database.client.packagePricingPackage.findUnique({
      where: { id },
      include: {
        departures: {
          include: {
            components: true,
            hotelOptions: true,
            periods: { include: { rules: true } },
            priceVersions: { include: { passengerPrices: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    if (!actor.branchIds.includes(row.branchId))
      throw new ForbiddenException({ code: 'PACKAGE_FORBIDDEN' });
    return { version: 1 as const, data: row };
  }

  async create(
    raw: unknown,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    rawKey: string | undefined,
    traceId?: string,
  ) {
    const input = validateCreate(raw);
    const branchId = branch(actor, requestedBranch);
    const idempotencyKey = key(rawKey);
    const requestFingerprint = hash({ branchId, input });
    const prior = await this.database.client.packagePricingPackage.findUnique({
      where: {
        createdByUserId_createIdempotencyKey: {
          createdByUserId: actor.userId,
          createIdempotencyKey: idempotencyKey,
        },
      },
    });
    if (prior) {
      if (prior.createRequestFingerprint !== requestFingerprint)
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return {
        data: { id: prior.id, version: prior.version },
        meta: { idempotentReplay: true },
      };
    }
    const issuer = await this.legalEntities.find(
      input.issuerLegalEntityId,
      actor,
    );
    if (
      !issuer.data.isActive ||
      issuer.data.version !== input.issuerLegalEntityVersion
    )
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    const created = await this.database.client.$transaction(async (tx) => {
      const packageRow = await tx.packagePricingPackage.create({
        data: {
          branchId,
          code: input.code,
          titleFa: input.titleFa,
          titleEn: input.titleEn,
          issuerLegalEntityId: input.issuerLegalEntityId,
          issuerLegalEntityVersion: input.issuerLegalEntityVersion,
          destinationId: input.destinationId,
          destinationNameSnapshot: input.destinationNameSnapshot,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
          createIdempotencyKey: idempotencyKey,
          createRequestFingerprint: requestFingerprint,
          departures: {
            create: {
              departureDate: new Date(input.departureDate),
              returnDate: new Date(input.returnDate),
              nights: input.nights,
              days: input.days,
              capacity: input.capacity,
              priceValidUntil: new Date(input.priceValidUntil),
              description: input.description || null,
              terms: input.terms || null,
              createdByUserId: actor.userId,
              components: {
                create: input.components.map((item) => ({
                  clientKey: item.clientKey,
                  kind: item.kind,
                  sourceOwner: item.source.owner,
                  sourceKind: item.source.kind,
                  sourceReferenceId: item.source.id,
                  sourceReferenceVersion: item.source.version,
                  titleSnapshot: item.titleSnapshot,
                  quantity: item.quantity,
                  capacity: item.capacity ?? null,
                  metadata: item.metadata
                    ? json(item.metadata)
                    : Prisma.JsonNull,
                })),
              },
              hotelOptions: {
                create: input.hotelOptions.map((item) => ({
                  hotelReferenceId: item.hotel.id,
                  hotelReferenceVersion: item.hotel.version,
                  hotelNameSnapshot: item.hotelNameSnapshot,
                  roomTypeReferenceId: item.roomType.id,
                  roomTypeReferenceVersion: item.roomType.version,
                  roomTypeNameSnapshot: item.roomTypeNameSnapshot,
                  mealServiceReferenceId: item.mealService.id,
                  mealServiceReferenceVersion: item.mealService.version,
                  mealServiceNameSnapshot: item.mealServiceNameSnapshot,
                  checkInDate: new Date(item.checkInDate),
                  checkOutDate: new Date(item.checkOutDate),
                })),
              },
              periods: {
                create: {
                  title: 'بازه اولیه',
                  validFrom: new Date(),
                  validTo: new Date(input.priceValidUntil),
                  createdByUserId: actor.userId,
                },
              },
            },
          },
        },
      });
      await tx.packagePricingAuditEvent.create({
        data: {
          packageId: packageRow.id,
          actorUserId: actor.userId,
          actorBranchId: branchId,
          action: 'package_pricing.package.created',
          outcome: 'SUCCESS',
          entityType: 'PackagePricingPackage',
          entityId: packageRow.id,
          entityVersion: 1,
          afterSnapshot: json({
            code: packageRow.code,
            titleFa: packageRow.titleFa,
            issuerLegalEntityId: packageRow.issuerLegalEntityId,
          }),
          traceId: traceId ?? null,
        },
      });
      return packageRow;
    });
    return {
      data: { id: created.id, version: created.version },
      meta: { idempotentReplay: false },
    };
  }

  async replaceRules(
    packageId: string,
    periodId: string,
    rawRules: unknown,
    expectedVersion: number,
    actor: AuthenticatedActor,
    reason: string,
    traceId?: string,
  ) {
    const result = Joi.array()
      .items(
        Joi.object({
          sequence: Joi.number().integer().min(1).required(),
          title: Joi.string().trim().max(160).required(),
          operation: Joi.string()
            .valid(
              'ADD_FIXED',
              'SUBTRACT_FIXED',
              'ADD_PERCENT',
              'SUBTRACT_PERCENT',
              'MULTIPLY',
              'DIVIDE',
              'FEE',
              'COMMISSION',
              'TAX',
              'PROFIT',
              'ROUND',
              'MINIMUM_PROFIT',
              'MINIMUM_SALE_PRICE',
            )
            .required(),
          value: decimal.required(),
          appliesToComponentKey: Joi.string().trim().max(80).allow(null, ''),
        }),
      )
      .min(1)
      .max(100)
      .validate(rawRules, { convert: false });
    if (result.error || !reason.trim())
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const rules = result.value as PackagePricingRuleInputV1[];
    return this.database.client.$transaction(async (tx) => {
      const period = await tx.packagePricingPeriod.findFirst({
        where: {
          id: periodId,
          departure: {
            packageId,
            package: { branchId: { in: actor.branchIds } },
          },
        },
      });
      if (!period) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
      if (period.version !== expectedVersion)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      const changed = await tx.packagePricingPeriod.updateMany({
        where: { id: periodId, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      const version = expectedVersion + 1;
      await tx.packagePricingRule.createMany({
        data: rules.map((rule) => ({
          periodId,
          version,
          sequence: rule.sequence,
          title: rule.title.trim(),
          operation: rule.operation,
          value: new Prisma.Decimal(rule.value),
          appliesToComponentKey: rule.appliesToComponentKey || null,
          createdByUserId: actor.userId,
        })),
      });
      await tx.packagePricingAuditEvent.create({
        data: {
          packageId,
          actorUserId: actor.userId,
          actorBranchId: actor.branchIds[0]!,
          action: 'package_pricing.rules.replaced',
          outcome: 'SUCCESS',
          entityType: 'PackagePricingPeriod',
          entityId: periodId,
          entityVersion: version,
          reason: reason.trim(),
          afterSnapshot: json(rules),
          traceId: traceId ?? null,
        },
      });
      return { data: { id: periodId, version } };
    });
  }

  async createPriceVersion(
    packageId: string,
    departureId: string,
    input: PackagePriceVersionCreateInputV1,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    const packageRow =
      await this.database.client.packagePricingPackage.findFirst({
        where: {
          id: packageId,
          branchId: { in: actor.branchIds },
          archivedAt: null,
        },
        include: {
          departures: {
            where: { id: departureId, isArchived: false },
            include: { components: true, periods: true },
          },
        },
      });
    const departure = packageRow?.departures[0];
    if (!packageRow || !departure)
      throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    if (packageRow.version !== input.expectedPackageVersion)
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    if (!/^[A-Z]{3}$/.test(input.outputCurrencyCode) || !input.reason.trim())
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const period = departure.periods.find(
      ({ id }) => id === input.pricingPeriodId,
    );
    if (!period)
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const references = departure.components.map((component) => ({
      owner: component.sourceOwner as 'MASTER_DATA',
      kind: component.sourceKind,
      id: component.sourceReferenceId,
      version: component.sourceReferenceVersion,
    }));
    const resolved = await this.sources.resolve(
      references,
      packageRow.branchId,
      input.outputCurrencyCode,
    );
    if (
      resolved.sources.length !== references.length ||
      resolved.sources.some((item) => !item.approved)
    )
      throw new UnprocessableEntityException({
        code: 'SOURCE_REFERENCE_REJECTED',
      });
    const base = resolved.sources.reduce(
      (sum, item, index) =>
        sum.add(
          new Prisma.Decimal(item.amount).mul(
            departure.components[index]!.quantity,
          ),
        ),
      new Prisma.Decimal(0),
    );
    let breakdown;
    try {
      breakdown = calculatePackagePrice(
        base.toString(),
        input.outputCurrencyCode,
        input.rules,
      );
    } catch (error) {
      if (error instanceof PackagePricingDomainError)
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
        });
      throw error;
    }
    return this.database.client.$transaction(async (tx) => {
      const latest = await tx.packagePricingPriceVersion.aggregate({
        where: { departureId },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      const price = await tx.packagePricingPriceVersion.create({
        data: {
          departureId,
          periodId: period.id,
          version,
          currencyCode: input.outputCurrencyCode,
          baseAmount: breakdown.baseAmount,
          adjustmentAmount: breakdown.adjustments,
          feeAmount: breakdown.fee,
          taxAmount: breakdown.tax,
          profitAmount: breakdown.profit,
          finalAmount: breakdown.finalAmount,
          marginPercent: breakdown.marginPercent,
          minimumProfitAmount: breakdown.minimumProfitAmount,
          minimumSaleAmount: breakdown.minimumSaleAmount,
          sourceSnapshot: json(resolved.sources),
          ruleSnapshot: json(input.rules),
          breakdown: json(breakdown),
          fxSnapshot: resolved.fxSnapshot
            ? json(resolved.fxSnapshot)
            : Prisma.JsonNull,
          createdByUserId: actor.userId,
          reason: input.reason.trim(),
          passengerPrices: {
            create: input.passengerMultipliers.map((item) => ({
              category: item.category,
              amount: calculatePassengerPrice(
                breakdown.finalAmount,
                item.multiplier,
              ),
              currencyCode: input.outputCurrencyCode,
            })),
          },
        },
      });
      const changed = await tx.packagePricingPackage.updateMany({
        where: { id: packageId, version: input.expectedPackageVersion },
        data: {
          version: { increment: 1 },
          updatedByUserId: actor.userId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      await tx.packagePricingAuditEvent.create({
        data: {
          packageId,
          actorUserId: actor.userId,
          actorBranchId: packageRow.branchId,
          action: 'package_pricing.price_version.created',
          outcome: 'SUCCESS',
          entityType: 'PackagePricingPriceVersion',
          entityId: price.id,
          entityVersion: version,
          reason: input.reason.trim(),
          afterSnapshot: json(breakdown),
          traceId: traceId ?? null,
        },
      });
      return {
        version: 1 as const,
        data: { id: price.id, version, breakdown },
      };
    });
  }

  async publish(
    packageId: string,
    departureId: string,
    priceVersionId: string,
    input: PackagePublishInputV1,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    if (!input.reason.trim())
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const record =
      await this.database.client.packagePricingPriceVersion.findFirst({
        where: {
          id: priceVersionId,
          departureId,
          departure: {
            packageId,
            package: {
              branchId: { in: actor.branchIds },
              version: input.expectedPackageVersion,
            },
          },
        },
        include: { departure: { include: { package: true } } },
      });
    if (!record) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    if (record.version !== input.expectedPriceVersion)
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    if (record.status === 'PUBLISHED')
      throw new ConflictException({ code: 'PUBLISHED_PRICE_IMMUTABLE' });
    if (record.createdByUserId === actor.userId)
      throw new ForbiddenException({ code: 'MAKER_CHECKER_VIOLATION' });
    await this.sources.recheck(
      record.sourceSnapshot as unknown as PackagePricingResolvedSource[],
      record.departure.package.branchId,
      record.departure.capacity,
    );
    return this.database.client.$transaction(async (tx) => {
      const changed = await tx.packagePricingPriceVersion.updateMany({
        where: {
          id: priceVersionId,
          version: input.expectedPriceVersion,
          status: { not: 'PUBLISHED' },
        },
        data: {
          status: 'PUBLISHED',
          reviewedByUserId: actor.userId,
          publishedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      const packageChanged = await tx.packagePricingPackage.updateMany({
        where: { id: packageId, version: input.expectedPackageVersion },
        data: {
          version: { increment: 1 },
          status: 'PUBLISHED',
          updatedByUserId: actor.userId,
        },
      });
      if (packageChanged.count !== 1)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      await tx.packagePricingAuditEvent.create({
        data: {
          packageId,
          actorUserId: actor.userId,
          actorBranchId: record.departure.package.branchId,
          action: 'package_pricing.price_version.published',
          outcome: 'SUCCESS',
          entityType: 'PackagePricingPriceVersion',
          entityId: priceVersionId,
          entityVersion: input.expectedPriceVersion,
          reason: input.reason.trim(),
          traceId: traceId ?? null,
        },
      });
      return {
        data: { id: priceVersionId, status: 'PUBLISHED' as const },
      };
    });
  }

  async archive(
    packageId: string,
    expectedVersion: number,
    actor: AuthenticatedActor,
    reason: string,
  ) {
    if (!reason.trim())
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const row = await this.database.client.packagePricingPackage.findFirst({
      where: { id: packageId, branchId: { in: actor.branchIds } },
    });
    if (!row) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    const changed = await this.database.client.packagePricingPackage.updateMany(
      {
        where: { id: packageId, version: expectedVersion, archivedAt: null },
        data: {
          version: { increment: 1 },
          status: 'ARCHIVED',
          archivedAt: new Date(),
          updatedByUserId: actor.userId,
        },
      },
    );
    if (changed.count !== 1)
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    return {
      data: {
        id: packageId,
        version: expectedVersion + 1,
        status: 'ARCHIVED' as const,
      },
    };
  }

  async stop(
    packageId: string,
    expectedVersion: number,
    actor: AuthenticatedActor,
    reason: string,
    traceId?: string,
  ) {
    if (!reason.trim())
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const row = await this.database.client.packagePricingPackage.findFirst({
      where: { id: packageId, branchId: { in: actor.branchIds } },
    });
    if (!row) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    if (row.status !== 'PUBLISHED' && row.status !== 'APPROVED')
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    return this.database.client.$transaction(async (tx) => {
      const changed = await tx.packagePricingPackage.updateMany({
        where: { id: packageId, version: expectedVersion, archivedAt: null },
        data: {
          version: { increment: 1 },
          status: 'STOPPED',
          updatedByUserId: actor.userId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
      await tx.packagePricingAuditEvent.create({
        data: {
          packageId,
          actorUserId: actor.userId,
          actorBranchId: row.branchId,
          action: 'package_pricing.package.stopped',
          outcome: 'SUCCESS',
          entityType: 'PackagePricingPackage',
          entityId: packageId,
          entityVersion: expectedVersion + 1,
          reason: reason.trim(),
          beforeSnapshot: json({ status: row.status, version: row.version }),
          afterSnapshot: json({
            status: 'STOPPED',
            version: expectedVersion + 1,
          }),
          traceId: traceId ?? null,
        },
      });
      return {
        data: {
          id: packageId,
          version: expectedVersion + 1,
          status: 'STOPPED' as const,
        },
      };
    });
  }

  async listTemplates(actor: AuthenticatedActor, requestedBranch?: string) {
    const branchIds = requestedBranch
      ? [branch(actor, requestedBranch)]
      : actor.branchIds;
    const data =
      await this.database.client.packagePricingBannerTemplate.findMany({
        where: { branchId: { in: branchIds }, isActive: true },
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      });
    return { version: 1 as const, data };
  }

  async createTemplate(
    raw: PackageBannerTemplateCreateInputV1,
    actor: AuthenticatedActor,
  ) {
    const validation = Joi.object({
      branchId: uuid.required(),
      issuerLegalEntityId: uuid.required(),
      code: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9_-]{3,40}$/)
        .required(),
      title: Joi.string().trim().max(160).required(),
      format: Joi.string()
        .valid('SQUARE_POST', 'STORY', 'HORIZONTAL', 'WEBSITE', 'A4')
        .required(),
      width: Joi.number().integer().min(100).max(10000).required(),
      height: Joi.number().integer().min(100).max(10000).required(),
      templateDefinition: Joi.object().max(100).required(),
    }).validate(raw, { convert: false, abortEarly: false });
    if (validation.error)
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const input = validation.value as PackageBannerTemplateCreateInputV1;
    branch(actor, input.branchId);
    const issuer = await this.legalEntities.find(
      input.issuerLegalEntityId,
      actor,
    );
    if (!issuer.data.isActive)
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    return this.database.client.$transaction(async (tx) => {
      const latest = await tx.packagePricingBannerTemplate.aggregate({
        where: { branchId: input.branchId, code: input.code },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      const data = await tx.packagePricingBannerTemplate.create({
        data: {
          branchId: input.branchId,
          issuerLegalEntityId: input.issuerLegalEntityId,
          code: input.code,
          title: input.title,
          format: input.format,
          version,
          width: input.width,
          height: input.height,
          templateDefinition: json(input.templateDefinition),
          createdByUserId: actor.userId,
        },
      });
      return { version: 1 as const, data };
    });
  }

  async createQuote(
    input: PackageQuoteCreateInputV1,
    actor: AuthenticatedActor,
    rawKey?: string,
  ) {
    const idempotencyKey = key(rawKey);
    const requestFingerprint = hash(input);
    const prior = await this.database.client.packagePricingQuote.findUnique({
      where: {
        createdByUserId_createIdempotencyKey: {
          createdByUserId: actor.userId,
          createIdempotencyKey: idempotencyKey,
        },
      },
    });
    if (prior) {
      if (prior.createRequestFingerprint !== requestFingerprint)
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return { data: prior, meta: { idempotentReplay: true } };
    }
    const price =
      await this.database.client.packagePricingPriceVersion.findFirst({
        where: {
          id: input.priceVersionId,
          departureId: input.departureId,
          departure: {
            packageId: input.packageId,
            package: { branchId: { in: actor.branchIds } },
          },
          status: 'PUBLISHED',
          publishedAt: { not: null },
        },
        include: {
          passengerPrices: true,
          departure: { include: { package: true } },
        },
      });
    if (!price)
      throw new UnprocessableEntityException({
        code: 'PUBLISHED_PRICE_IMMUTABLE',
        message: 'نسخه قیمت منتشرشده معتبر یافت نشد.',
      });
    const items = price.passengerPrices
      .map((passengerPrice) => {
        const quantity = input.counts[passengerPrice.category] ?? 0;
        return {
          category: passengerPrice.category,
          quantity,
          unitAmount: passengerPrice.amount,
          totalAmount: passengerPrice.amount.mul(quantity),
          currencyCode: price.currencyCode,
        };
      })
      .filter(({ quantity }) => quantity > 0);
    if (!items.length)
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const subtotal = items.reduce(
      (sum, item) => sum.add(item.totalAmount),
      new Prisma.Decimal(0),
    );
    const discount = input.discount
      ? new Prisma.Decimal(input.discount.amount)
      : new Prisma.Decimal(0);
    if (
      input.discount &&
      (input.discount.currencyCode !== price.currencyCode ||
        discount.lt(0) ||
        discount.gte(subtotal))
    )
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    if (
      discount.gt(0) &&
      !actor.permissions.includes('package_pricing.discount.override')
    )
      throw new ForbiddenException({ code: 'PACKAGE_FORBIDDEN' });
    const finalAmount = subtotal.sub(discount);
    if (price.minimumSaleAmount && finalAmount.lt(price.minimumSaleAmount))
      throw new UnprocessableEntityException({
        code: 'MINIMUM_MARGIN_VIOLATION',
      });
    if (
      !Number.isFinite(new Date(input.validUntil).getTime()) ||
      new Date(input.validUntil) <= new Date()
    )
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const quote = await this.database.client.packagePricingQuote.create({
      data: {
        branchId: price.departure.package.branchId,
        packageId: input.packageId,
        departureId: input.departureId,
        priceVersionId: input.priceVersionId,
        customerReference: input.customerReference || null,
        agencyReference: input.agencyReference || null,
        passengerCounts: json(input.counts),
        subtotalAmount: subtotal,
        discountAmount: discount,
        finalAmount,
        currencyCode: price.currencyCode,
        validUntil: new Date(input.validUntil),
        notes: input.notes || null,
        createdByUserId: actor.userId,
        createIdempotencyKey: idempotencyKey,
        createRequestFingerprint: requestFingerprint,
        items: { create: items },
      },
      include: { items: true },
    });
    return { data: quote, meta: { idempotentReplay: false } };
  }

  async createRender(
    input: PackageRenderCreateInputV1,
    actor: AuthenticatedActor,
    rawKey?: string,
  ) {
    const context = await this.legalEntities.current(actor);
    if (context.data.isAggregate || !context.data.legalEntity)
      throw new UnprocessableEntityException({
        code: 'LEGAL_ENTITY_REQUIRED',
        message: 'در Context برابر ALL صدور خروجی ممنوع است.',
      });
    const idempotencyKey = key(rawKey);
    const requestFingerprint = hash(input);
    const prior =
      await this.database.client.packagePricingRenderRequest.findUnique({
        where: {
          createdByUserId_createIdempotencyKey: {
            createdByUserId: actor.userId,
            createIdempotencyKey: idempotencyKey,
          },
        },
      });
    if (prior) {
      if (prior.createRequestFingerprint !== requestFingerprint)
        throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
      return { data: prior, meta: { idempotentReplay: true } };
    }
    const price =
      await this.database.client.packagePricingPriceVersion.findFirst({
        where: {
          id: input.priceVersionId,
          departureId: input.departureId,
          departure: {
            packageId: input.packageId,
            package: {
              branchId: { in: actor.branchIds },
              issuerLegalEntityId: context.data.legalEntity.id,
            },
          },
          status: 'PUBLISHED',
        },
        include: { departure: { include: { package: true } } },
      });
    const template =
      await this.database.client.packagePricingBannerTemplate.findFirst({
        where: {
          id: input.templateId,
          version: input.templateVersion,
          branchId: { in: actor.branchIds },
          issuerLegalEntityId: context.data.legalEntity.id,
          isActive: true,
        },
      });
    const branding = await this.legalEntities.branding(
      context.data.legalEntity.id,
      actor,
    );
    if (
      !price ||
      !template ||
      branding.data.version !== input.brandingSnapshotVersion
    )
      throw new ConflictException({ code: 'CONCURRENT_MODIFICATION' });
    const render =
      await this.database.client.packagePricingRenderRequest.create({
        data: {
          branchId: price.departure.package.branchId,
          packageId: input.packageId,
          departureId: input.departureId,
          priceVersionId: input.priceVersionId,
          templateId: input.templateId,
          templateVersion: input.templateVersion,
          brandingSnapshotId: input.brandingSnapshotId,
          brandingSnapshotVersion: input.brandingSnapshotVersion,
          outputFormat: input.format,
          status: 'AWAITING_RENDERER',
          failureCode: 'RENDERER_UNAVAILABLE',
          createdByUserId: actor.userId,
          createIdempotencyKey: idempotencyKey,
          createRequestFingerprint: requestFingerprint,
        },
      });
    return { data: render, meta: { idempotentReplay: false } };
  }

  async audit(packageId: string, actor: AuthenticatedActor, page = 1) {
    const packageRow =
      await this.database.client.packagePricingPackage.findFirst({
        where: { id: packageId, branchId: { in: actor.branchIds } },
        select: { id: true },
      });
    if (!packageRow) throw new NotFoundException({ code: 'PACKAGE_NOT_FOUND' });
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException({ code: 'PACKAGE_VALIDATION_FAILED' });
    const [data, total] = await this.database.client.$transaction([
      this.database.client.packagePricingAuditEvent.findMany({
        where: { packageId },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.database.client.packagePricingAuditEvent.count({
        where: { packageId },
      }),
    ]);
    return { data, meta: { page, pageSize: 50, total } };
  }
}
