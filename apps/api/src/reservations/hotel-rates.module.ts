import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  Injectable,
  Module,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { AuthenticatedActor } from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MasterDataModule } from '../master-data/master-data.module';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import {
  roomPrices,
  validateRateBatch,
  type RoomKind,
} from './hotel-rates.validation';

@Injectable()
export class HotelRatesService {
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
  async save(raw: unknown, key: string | undefined, actor: AuthenticatedActor) {
    this.require(actor, true);
    const input = validateRateBatch(raw);
    if (!actor.branchIds.includes(input.branchId))
      throw new ForbiddenException();
    if (
      !key ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      )
    )
      throw new BadRequestException('کلید ثبت نامعتبر است.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    const where = {
      actorId_requestKey: { actorId: actor.userId, requestKey: key },
    };
    const replay = (row: { id: string; fingerprint: string }) => {
      if (row.fingerprint !== fingerprint)
        throw new ConflictException('اطلاعات این درخواست ثبت تغییر کرده است.');
      return { id: row.id };
    };
    const prior = await this.db.client.reservationHotelRateBatch.findUnique({
      where,
    });
    if (prior) return replay(prior);
    const rows: ((typeof input.rows)[number] & {
      hotelName: string;
      brokerName: string;
    })[] = [];
    for (const row of input.rows)
      rows.push({
        ...row,
        ...(await this.directory.hotelRateReference(row.hotelId, row.brokerId)),
      });
    try {
      return await this.db.client.$transaction(async (tx) => {
        const batch = await tx.reservationHotelRateBatch.create({
          data: {
            branchId: input.branchId,
            actorId: actor.userId,
            requestKey: key,
            fingerprint,
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
            action: 'reservations.hotel_rates.create',
            entityType: 'ReservationHotelRateBatch',
            entityId: batch.id,
            outcome: 'SUCCESS',
            metadata: { branchId: input.branchId, count: rows.length },
          },
        });
        return { id: batch.id };
      });
    } catch (error) {
      const saved = await this.db.client.reservationHotelRateBatch.findUnique({
        where,
      });
      if (saved) return replay(saved);
      throw error;
    }
  }
  async history(
    actor: AuthenticatedActor,
    query: { hotelId?: string; from?: string; to?: string; page?: string },
  ) {
    this.require(actor);
    const page = Number(query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException();
    if (query.hotelId && !/^[0-9a-f-]{36}$/i.test(query.hotelId))
      throw new BadRequestException();
    for (const value of [query.from, query.to])
      if (
        value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(new Date(value).getTime()) ||
          new Date(value).toISOString().slice(0, 10) !== value)
      )
        throw new BadRequestException();
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('بازه فیلتر نامعتبر است.');
    const where: Prisma.ReservationHotelGroupRateWhereInput = {
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
      batch: {
        branchId: { in: actor.branchIds },
        ...(query.from ? { checkOut: { gt: new Date(query.from) } } : {}),
        ...(query.to ? { checkIn: { lte: new Date(query.to) } } : {}),
      },
    };
    const [records, total] = await this.db.client.$transaction([
      this.db.client.reservationHotelGroupRate.findMany({
        where,
        include: { batch: true },
        orderBy: [{ batch: { createdAt: 'desc' } }, { id: 'asc' }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      this.db.client.reservationHotelGroupRate.count({ where }),
    ]);
    return {
      data: records.map((r) => ({
        ...r,
        base: r.base.toString(),
        prices: roomPrices(
          r.base.toString(),
          r.factors as Record<RoomKind, string>,
          r.batch.currency,
        ),
      })),
      total,
      page,
    };
  }
}
@Controller('reservations/hotel-rates')
@UseGuards(AuthGuard)
export class HotelRatesController {
  constructor(
    @Inject(HotelRatesService) private readonly rates: HotelRatesService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
  ) {}
  @Get('options')
  @Header('Cache-Control', 'private, no-store')
  options(
    @Req() req: AuthenticatedRequest,
    @Query('kind') kind: string,
    @Query('search') search = '',
    @Query('page') page = '1',
  ) {
    this.rates.require(req.actor);
    if (
      !['hotels', 'organizations'].includes(kind) ||
      search.length > 100 ||
      !/^\d+$/.test(page) ||
      Number(page) < 1 ||
      Number(page) > 10000
    )
      throw new BadRequestException();
    return this.directory.hotelRateChoices(
      kind as 'hotels' | 'organizations',
      search,
      Number(page),
    );
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  history(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: { hotelId?: string; from?: string; to?: string; page?: string },
  ) {
    return this.rates.history(req.actor, query);
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  save(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.rates.save(body, key, req.actor);
  }
}
@Module({
  imports: [IamModule, MasterDataModule],
  controllers: [HotelRatesController],
  providers: [AuthGuard, HotelRatesService],
})
export class HotelRatesModule {}
