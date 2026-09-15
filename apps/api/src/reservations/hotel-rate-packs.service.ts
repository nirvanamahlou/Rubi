import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import {
  roomPrices,
  validateRatePack,
  type RatePackInput,
  type RoomKind,
} from './hotel-rates.validation';

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const requestKey = (value: string | undefined) => {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('کلید ثبت نامعتبر است.');
  return value;
};
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class HotelRatePacksService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
  ) {}

  require(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes(
        write ? 'reservations.hotel_purchase.write' : 'reservations.read',
      )
    )
      throw new ForbiddenException();
  }

  private async references(input: RatePackInput) {
    await this.directory.cityReference(input.cityId);
    return Promise.all(
      input.rows.map(async (row) => ({
        ...row,
        ...(await this.directory.hotelRatePackReference(
          input.cityId,
          row.hotelId,
          row.brokerId,
        )),
      })),
    );
  }

  private async replay(
    actor: AuthenticatedActor,
    key: string,
    hash: string,
    packId?: string,
  ) {
    const prior = await this.db.client.reservationHotelRateBatch.findUnique({
      where: { actorId_requestKey: { actorId: actor.userId, requestKey: key } },
    });
    if (!prior) return null;
    if (
      prior.fingerprint !== hash ||
      !prior.packId ||
      (packId && prior.packId !== packId)
    )
      throw new ConflictException(
        'این کلید ثبت برای اطلاعات دیگری استفاده شده است.',
      );
    return {
      id: prior.packId,
      version: prior.version,
      batchId: prior.id,
      idempotentReplay: true,
    };
  }

  async create(
    raw: unknown,
    rawKey: string | undefined,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, true);
    const input = validateRatePack(raw);
    if (input.expectedVersion !== undefined)
      throw new BadRequestException('برای بستهٔ جدید نسخهٔ قبلی نفرستید.');
    if (!actor.branchIds.includes(input.branchId))
      throw new ForbiddenException();
    const key = requestKey(rawKey);
    const hash = fingerprint({ action: 'create-pack', input });
    const prior = await this.replay(actor, key, hash);
    if (prior) return prior;
    const rows = await this.references(input);
    const id = randomUUID();
    try {
      return await this.db.client.$transaction(async (tx) => {
        await tx.reservationHotelRatePack.create({
          data: {
            id,
            branchId: input.branchId,
            cityId: input.cityId,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            currency: input.currency,
            method: input.method,
          },
        });
        const batch = await tx.reservationHotelRateBatch.create({
          data: {
            branchId: input.branchId,
            actorId: actor.userId,
            requestKey: key,
            fingerprint: hash,
            packId: id,
            cityId: input.cityId,
            version: 1,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            currency: input.currency,
            method: input.method,
            rows: { create: rows },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'reservations.hotel_rate_pack.create',
            entityType: 'ReservationHotelRatePack',
            entityId: id,
            outcome: 'SUCCESS',
            metadata: {
              branchId: input.branchId,
              cityId: input.cityId,
              version: 1,
              batchId: batch.id,
              count: rows.length,
            },
          },
        });
        return { id, version: 1, batchId: batch.id, idempotentReplay: false };
      });
    } catch (error) {
      const saved = await this.replay(actor, key, hash);
      if (saved) return saved;
      throw error;
    }
  }

  async update(
    id: string,
    raw: unknown,
    rawKey: string | undefined,
    actor: AuthenticatedActor,
  ) {
    this.require(actor, true);
    const input = validateRatePack(raw);
    const expectedVersion = input.expectedVersion;
    if (!expectedVersion)
      throw new BadRequestException('نسخهٔ فعلی بسته را مشخص کنید.');
    if (!actor.branchIds.includes(input.branchId))
      throw new ForbiddenException();
    const key = requestKey(rawKey);
    const hash = fingerprint({ action: 'update-pack', id, input });
    const prior = await this.replay(actor, key, hash, id);
    if (prior) return prior;
    const pack = await this.db.client.reservationHotelRatePack.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
    });
    if (!pack) throw new NotFoundException('بستهٔ نرخ پیدا نشد.');
    if (pack.branchId !== input.branchId) throw new ForbiddenException();
    if (pack.currentVersion !== expectedVersion)
      throw new ConflictException(
        'این بسته هم‌زمان تغییر کرده است؛ نسخهٔ تازه را باز کنید.',
      );
    const rows = await this.references(input);
    try {
      return await this.db.client.$transaction(async (tx) => {
        const changed = await tx.reservationHotelRatePack.updateMany({
          where: { id, currentVersion: expectedVersion },
          data: {
            cityId: input.cityId,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            currency: input.currency,
            method: input.method,
            currentVersion: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new ConflictException(
            'این بسته هم‌زمان تغییر کرده است؛ نسخهٔ تازه را باز کنید.',
          );
        const version = expectedVersion + 1;
        const batch = await tx.reservationHotelRateBatch.create({
          data: {
            branchId: input.branchId,
            actorId: actor.userId,
            requestKey: key,
            fingerprint: hash,
            packId: id,
            cityId: input.cityId,
            version,
            checkIn: new Date(input.checkIn),
            checkOut: new Date(input.checkOut),
            currency: input.currency,
            method: input.method,
            rows: { create: rows },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'reservations.hotel_rate_pack.update',
            entityType: 'ReservationHotelRatePack',
            entityId: id,
            outcome: 'SUCCESS',
            metadata: {
              branchId: input.branchId,
              cityId: input.cityId,
              version,
              batchId: batch.id,
              count: rows.length,
            },
          },
        });
        return { id, version, batchId: batch.id, idempotentReplay: false };
      });
    } catch (error) {
      const saved = await this.replay(actor, key, hash, id);
      if (saved) return saved;
      throw error;
    }
  }

  async list(actor: AuthenticatedActor, branchId?: string, page = 1) {
    this.require(actor);
    if (branchId && !actor.branchIds.includes(branchId))
      throw new ForbiddenException();
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException();
    const where = { branchId: { in: branchId ? [branchId] : actor.branchIds } };
    const [packs, total] = await this.db.client.$transaction([
      this.db.client.reservationHotelRatePack.findMany({
        where,
        include: { city: { select: { name: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.db.client.reservationHotelRatePack.count({ where }),
    ]);
    if (!packs.length) return { data: [], total, page };
    const batches = await this.db.client.reservationHotelRateBatch.findMany({
      where: {
        OR: packs.map((pack) => ({
          packId: pack.id,
          version: pack.currentVersion,
        })),
      },
      select: { packId: true, _count: { select: { rows: true } } },
    });
    const counts = new Map(
      batches.map((batch) => [batch.packId, batch._count.rows]),
    );
    return {
      data: packs.map((pack) => ({
        id: pack.id,
        branchId: pack.branchId,
        cityId: pack.cityId,
        cityName: pack.city.name,
        checkIn: dateOnly(pack.checkIn),
        checkOut: dateOnly(pack.checkOut),
        currency: pack.currency,
        method: pack.method,
        version: pack.currentVersion,
        hotelCount: counts.get(pack.id) ?? 0,
        updatedAt: pack.updatedAt.toISOString(),
      })),
      total,
      page,
    };
  }

  async detail(id: string, actor: AuthenticatedActor) {
    this.require(actor);
    const pack = await this.db.client.reservationHotelRatePack.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
      include: {
        city: { select: { name: true } },
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { rows: { orderBy: { hotelName: 'asc' } } },
        },
      },
    });
    if (!pack) throw new NotFoundException('بستهٔ نرخ پیدا نشد.');
    const batch = pack.versions[0];
    if (!batch || batch.version !== pack.currentVersion)
      throw new ConflictException('نسخهٔ بسته ناقص است.');
    return {
      id: pack.id,
      branchId: pack.branchId,
      cityId: batch.cityId,
      cityName: pack.city.name,
      checkIn: dateOnly(batch.checkIn),
      checkOut: dateOnly(batch.checkOut),
      currency: batch.currency,
      method: batch.method,
      version: batch.version,
      batchId: batch.id,
      rows: batch.rows.map((row) => ({
        id: row.id,
        hotelId: row.hotelId,
        hotelName: row.hotelName,
        brokerId: row.brokerId,
        brokerName: row.brokerName,
        base: row.base.toString(),
        factors: row.factors as Record<RoomKind, string>,
        prices: roomPrices(
          row.base.toString(),
          row.factors as Record<RoomKind, string>,
          batch.currency,
        ),
      })),
    };
  }
}
