import { createHash } from 'node:crypto';
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
  MasterHotelRatePeriodDetailV1,
  MasterHotelRatePeriodSaveV1,
  PackageSourceReferenceV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { validateHotelRatePeriod } from './hotel-base-rates.validation';

const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function idempotencyKey(value?: string) {
  if (!value?.trim() || value.length > 160)
    throw new BadRequestException({ code: 'HOTEL_RATE_IDEMPOTENCY_REQUIRED' });
  return value.trim();
}

function assertBranch(actor: AuthenticatedActor, branchId: string) {
  if (!actor.branchIds.includes(branchId))
    throw new ForbiddenException({ code: 'HOTEL_RATE_FORBIDDEN' });
}

@Injectable()
export class MasterHotelBaseRatesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async options(kind: 'cities' | 'hotels', search: string, cityId?: string) {
    if (!['cities', 'hotels'].includes(kind) || search.length > 100)
      throw new BadRequestException({ code: 'HOTEL_RATE_VALIDATION_FAILED' });
    if (kind === 'cities') {
      const data = await this.database.client.masterCity.findMany({
        where: {
          isActive: true,
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  {
                    englishName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 200,
      });
      return {
        data: data.map((item) => ({
          id: item.id,
          name: item.name,
          englishName: item.englishName,
          version: item.version,
        })),
      };
    }
    if (!cityId)
      throw new BadRequestException({ code: 'HOTEL_RATE_CITY_REQUIRED' });
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        cityId,
      )
    )
      throw new BadRequestException({ code: 'HOTEL_RATE_CITY_INVALID' });
    const data = await this.database.client.masterHotel.findMany({
      where: {
        cityId,
        isActive: true,
        isSaleableReference: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                {
                  englishName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      take: 500,
    });
    return {
      data: data.map((item) => ({
        id: item.id,
        name: item.name,
        englishName: item.englishName,
        version: item.version,
        starRating: item.starRating,
      })),
    };
  }

  async list(actor: AuthenticatedActor, branchId?: string) {
    const branchIds = branchId
      ? (assertBranch(actor, branchId), [branchId])
      : actor.branchIds;
    const periods =
      await this.database.client.masterHotelRatePeriod.findMany({
        where: { branchId: { in: branchIds }, archivedAt: null },
        include: {
          city: { select: { name: true } },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { rows: { select: { included: true } } },
          },
        },
        orderBy: [{ checkIn: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
      });
    return {
      version: 1 as const,
      data: periods.map((period) => {
        const current = period.versions[0]!;
        return {
          id: period.id,
          branchId: period.branchId,
          cityId: period.cityId,
          cityName: period.city.name,
          title: period.title,
          checkIn: period.checkIn.toISOString().slice(0, 10),
          checkOut: period.checkOut.toISOString().slice(0, 10),
          nights: period.nights,
          currentVersion: period.currentVersion,
          currencyCode: current.currencyCode,
          includedHotels: current.rows.filter((row) => row.included).length,
          totalHotels: current.rows.length,
          updatedAt: period.updatedAt.toISOString(),
          updatedByUserId: period.updatedByUserId,
        };
      }),
    };
  }

  async detail(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<{ version: 1; data: MasterHotelRatePeriodDetailV1 }> {
    const period =
      await this.database.client.masterHotelRatePeriod.findFirst({
        where: { id, branchId: { in: actor.branchIds }, archivedAt: null },
        include: {
          city: { select: { name: true } },
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { rows: { orderBy: { hotelNameSnapshot: 'asc' } } },
          },
        },
      });
    if (!period)
      throw new NotFoundException({ code: 'HOTEL_RATE_PERIOD_NOT_FOUND' });
    const current = period.versions[0]!;
    return {
      version: 1,
      data: {
        id: period.id,
        branchId: period.branchId,
        cityId: period.cityId,
        cityName: period.city.name,
        title: period.title,
        checkIn: period.checkIn.toISOString().slice(0, 10),
        checkOut: period.checkOut.toISOString().slice(0, 10),
        nights: period.nights,
        currentVersion: period.currentVersion,
        currencyCode: current.currencyCode,
        pricingBasis: 'ROOM_PER_NIGHT',
        reason: current.reason,
        includedHotels: current.rows.filter((row) => row.included).length,
        totalHotels: current.rows.length,
        updatedAt: period.updatedAt.toISOString(),
        updatedByUserId: period.updatedByUserId,
        rows: current.rows.map((row) => ({
          id: row.id,
          hotelId: row.hotelId,
          hotelVersion: row.hotelVersion,
          hotelName: row.hotelNameSnapshot,
          starRating: row.starRatingSnapshot,
          included: row.included,
          baseAmount: row.baseAmount?.toString() ?? null,
          factors:
            row.factors as MasterHotelRatePeriodDetailV1['rows'][number]['factors'],
        })),
      },
    };
  }

  private async canonical(input: MasterHotelRatePeriodSaveV1) {
    const city = await this.database.client.masterCity.findFirst({
      where: { id: input.cityId, isActive: true },
    });
    if (!city)
      throw new BadRequestException({ code: 'HOTEL_RATE_CITY_INVALID' });
    const hotels = await this.database.client.masterHotel.findMany({
      where: {
        id: { in: input.rows.map((row) => row.hotelId) },
        cityId: input.cityId,
        isActive: true,
        isSaleableReference: true,
      },
    });
    if (hotels.length !== input.rows.length)
      throw new BadRequestException({
        code: 'HOTEL_RATE_HOTEL_CITY_MISMATCH',
      });
    const byId = new Map(hotels.map((hotel) => [hotel.id, hotel]));
    return {
      city,
      rows: input.rows.map((row) => {
        const hotel = byId.get(row.hotelId)!;
        if (hotel.version !== row.hotelVersion)
          throw new ConflictException({ code: 'HOTEL_RATE_REFERENCE_CHANGED' });
        return {
          hotelId: hotel.id,
          hotelVersion: hotel.version,
          hotelNameSnapshot: hotel.name,
          starRatingSnapshot: hotel.starRating,
          included: row.included,
          baseAmount: row.included ? row.baseAmount : null,
          factors: json(row.factors),
        };
      }),
    };
  }

  async create(raw: unknown, actor: AuthenticatedActor, rawKey?: string) {
    const { input, nights } = validateHotelRatePeriod(raw);
    assertBranch(actor, input.branchId);
    const key = idempotencyKey(rawKey);
    const requestFingerprint = fingerprint(input);
    const prior = await this.database.client.masterHotelRatePeriod.findUnique({
      where: {
        createdByUserId_createKey: {
          createdByUserId: actor.userId,
          createKey: key,
        },
      },
    });
    if (prior) {
      if (prior.fingerprint !== requestFingerprint)
        throw new ConflictException({
          code: 'HOTEL_RATE_IDEMPOTENCY_CONFLICT',
        });
      return {
        data: { id: prior.id, version: prior.currentVersion },
        meta: { idempotentReplay: true },
      };
    }
    const canonical = await this.canonical(input);
    const period = await this.database.client.$transaction(async (tx) => {
      const created = await tx.masterHotelRatePeriod.create({
        data: {
          branchId: input.branchId,
          cityId: input.cityId,
          title: input.title,
          checkIn: date(input.checkIn),
          checkOut: date(input.checkOut),
          nights,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
          createKey: key,
          fingerprint: requestFingerprint,
          versions: {
            create: {
              version: 1,
              title: input.title,
              cityIdSnapshot: input.cityId,
              cityNameSnapshot: canonical.city.name,
              checkIn: date(input.checkIn),
              checkOut: date(input.checkOut),
              nights,
              currencyCode: input.currencyCode,
              reason: input.reason,
              requestKey: key,
              fingerprint: requestFingerprint,
              createdByUserId: actor.userId,
              rows: { create: canonical.rows },
            },
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'master_data.hotel_rate_period.created',
          entityType: 'MasterHotelRatePeriod',
          entityId: created.id,
          outcome: 'SUCCESS',
          metadata: {
            branchId: input.branchId,
            cityId: input.cityId,
            version: 1,
          },
        },
      });
      return created;
    });
    return {
      data: { id: period.id, version: 1 },
      meta: { idempotentReplay: false },
    };
  }

  async update(
    id: string,
    raw: unknown,
    actor: AuthenticatedActor,
    rawKey?: string,
  ) {
    const { input, nights } = validateHotelRatePeriod(raw);
    assertBranch(actor, input.branchId);
    if (!input.expectedVersion)
      throw new BadRequestException({
        code: 'HOTEL_RATE_EXPECTED_VERSION_REQUIRED',
      });
    const expectedVersion = input.expectedVersion;
    const key = idempotencyKey(rawKey);
    const requestFingerprint = fingerprint({ id, input });
    const replay =
      await this.database.client.masterHotelRatePeriodVersion.findUnique({
        where: {
          createdByUserId_requestKey: {
            createdByUserId: actor.userId,
            requestKey: key,
          },
        },
      });
    if (replay) {
      if (
        replay.fingerprint !== requestFingerprint ||
        replay.periodId !== id
      )
        throw new ConflictException({
          code: 'HOTEL_RATE_IDEMPOTENCY_CONFLICT',
        });
      return {
        data: { id, version: replay.version },
        meta: { idempotentReplay: true },
      };
    }
    const period = await this.database.client.masterHotelRatePeriod.findFirst({
      where: { id, branchId: { in: actor.branchIds }, archivedAt: null },
    });
    if (!period)
      throw new NotFoundException({ code: 'HOTEL_RATE_PERIOD_NOT_FOUND' });
    const canonical = await this.canonical(input);
    const nextVersion = expectedVersion + 1;
    await this.database.client.$transaction(async (tx) => {
      const changed = await tx.masterHotelRatePeriod.updateMany({
        where: {
          id,
          branchId: input.branchId,
          currentVersion: expectedVersion,
          archivedAt: null,
        },
        data: {
          cityId: input.cityId,
          title: input.title,
          checkIn: date(input.checkIn),
          checkOut: date(input.checkOut),
          nights,
          currentVersion: nextVersion,
          updatedByUserId: actor.userId,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: 'HOTEL_RATE_CONCURRENT_MODIFICATION',
        });
      await tx.masterHotelRatePeriodVersion.create({
        data: {
          periodId: id,
          version: nextVersion,
          title: input.title,
          cityIdSnapshot: input.cityId,
          cityNameSnapshot: canonical.city.name,
          checkIn: date(input.checkIn),
          checkOut: date(input.checkOut),
          nights,
          currencyCode: input.currencyCode,
          reason: input.reason,
          requestKey: key,
          fingerprint: requestFingerprint,
          createdByUserId: actor.userId,
          rows: { create: canonical.rows },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: actor.userId,
          action: 'master_data.hotel_rate_period.version_created',
          entityType: 'MasterHotelRatePeriod',
          entityId: id,
          outcome: 'SUCCESS',
          metadata: {
            branchId: input.branchId,
            fromVersion: expectedVersion,
            toVersion: nextVersion,
          },
        },
      });
    });
    return {
      data: { id, version: nextVersion },
      meta: { idempotentReplay: false },
    };
  }
}

@Injectable()
export class MasterHotelBaseRatePublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async resolveRateReferences(
    references: readonly PackageSourceReferenceV1[],
    branchId: string,
    currencyCode: string,
  ) {
    const rows = await this.database.client.masterHotelBaseRateRow.findMany({
      where: {
        id: { in: references.map((reference) => reference.id) },
        included: true,
      },
      include: { periodVersion: { include: { period: true } } },
    });
    if (rows.length !== references.length)
      throw new BadRequestException({ code: 'SOURCE_REFERENCE_REJECTED' });
    return rows.map((row) => {
      const reference = references.find((item) => item.id === row.id)!;
      const version = row.periodVersion;
      if (
        version.version !== reference.version ||
        version.period.currentVersion !== reference.version ||
        version.period.branchId !== branchId ||
        !row.baseAmount
      )
        throw new ConflictException({ code: 'SOURCE_REFERENCE_REJECTED' });
      if (version.currencyCode !== currencyCode)
        throw new ConflictException({ code: 'FX_SNAPSHOT_NOT_APPROVED' });
      return {
        reference,
        amount: row.baseAmount.toString(),
        currencyCode,
        observedAt: version.createdAt.toISOString(),
        snapshot: {
          hotelId: row.hotelId,
          hotelVersion: row.hotelVersion,
          hotelName: row.hotelNameSnapshot,
          factors: row.factors,
          periodId: version.periodId,
          periodVersion: version.version,
        },
      };
    });
  }

  async recheckRateReferences(ids: readonly string[], branchId: string) {
    const rows = await this.database.client.masterHotelBaseRateRow.findMany({
      where: {
        id: { in: [...ids] },
        included: true,
        periodVersion: { period: { branchId, archivedAt: null } },
      },
      include: { periodVersion: { include: { period: true } } },
    });
    if (
      rows.length !== ids.length ||
      rows.some(
        (row) =>
          row.periodVersion.version !== row.periodVersion.period.currentVersion,
      )
    )
      throw new ConflictException({ code: 'CAPACITY_RECHECK_FAILED' });
  }
}
