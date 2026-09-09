import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ReservationArrangementUpdateV1,
  ReservationIntakeV1,
  SalesReservationRequestV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';

const intakeInclude = {
  arrangements: { orderBy: { version: 'desc' }, take: 1 },
  hotelPurchases: {
    orderBy: { version: 'desc' },
    distinct: ['currencyCode'],
    select: {
      id: true,
      version: true,
      amount: true,
      currencyCode: true,
      actorUserId: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReservationIntakeInclude;

function present(
  row: Prisma.ReservationIntakeGetPayload<{ include: typeof intakeInclude }>,
): ReservationIntakeV1 {
  const arrangement = row.arrangements[0];
  return {
    purchaseVersion: row.purchaseVersion,
    hotelPurchases: row.hotelPurchases.map((cost) => ({
      ...cost,
      amount: cost.amount.toString(),
      createdAt: cost.createdAt.toISOString(),
    })),
    id: row.id,
    requestId: row.requestId,
    contractId: row.contractId,
    contractVersion: row.contractVersion,
    branchId: row.branchId,
    status: row.status as 'QUEUED',
    receivedAt: row.receivedAt.toISOString(),
    snapshot: row.snapshot as unknown as SalesReservationRequestV1,
    arrangement: arrangement
      ? {
          version: arrangement.version,
          roomCount: arrangement.roomCount,
          singleRoomCount: arrangement.singleRoomCount,
          doubleRoomCount: arrangement.doubleRoomCount,
          extraBedCount: arrangement.extraBedCount,
          hotelGuestCustomerIds: Array.isArray(
            arrangement.hotelGuestCustomerIds,
          )
            ? arrangement.hotelGuestCustomerIds.filter(
                (value): value is string => typeof value === 'string',
              )
            : [],
          reason: arrangement.reason,
          updatedAt: arrangement.updatedAt.toISOString(),
          updatedByUserId: arrangement.updatedByUserId,
        }
      : null,
  };
}

/** Public module boundary. Only the trusted Sales outbox invokes intake, never a browser payload. */
@Injectable()
export class ReservationsPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async receive(snapshot: SalesReservationRequestV1, branchId: string) {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ branchId, snapshot }))
      .digest('hex');
    let row;
    try {
      row = await this.database.client.reservationIntake.upsert({
        where: { requestId: snapshot.requestId },
        update: {},
        create: {
          requestId: snapshot.requestId,
          contractId: snapshot.contractId,
          contractVersion: snapshot.contractVersion,
          branchId,
          fingerprint,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      row = await this.database.client.reservationIntake.findUniqueOrThrow({
        where: { requestId: snapshot.requestId },
      });
    }
    if (row.fingerprint !== fingerprint)
      throw new ConflictException(
        'نسخه درخواست رزرو با اطلاعات قبلی متفاوت است.',
      );
    return { id: row.id, requestId: row.requestId, status: row.status };
  }

  async list(
    branchIds: readonly string[],
    options: {
      page?: string | undefined;
      contractNumber?: string | undefined;
    } = {},
  ) {
    if (
      options.contractNumber !== undefined &&
      typeof options.contractNumber !== 'string'
    )
      throw new BadRequestException('جست‌وجوی قرارداد باید متن باشد.');
    const page = options.page === undefined ? 1 : Number(options.page);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      (options.contractNumber?.length ?? 0) > 100
    )
      throw new BadRequestException(
        'شماره صفحه یا جست‌وجوی قرارداد معتبر نیست.',
      );
    const contractNumber = options.contractNumber?.trim();
    const rows = await this.database.client.reservationIntake.findMany({
      where: {
        branchId: { in: [...branchIds] },
        ...(contractNumber
          ? {
              snapshot: {
                path: ['contractNumber'],
                string_contains: contractNumber,
              },
            }
          : {}),
      },
      include: intakeInclude,
      orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
      take: 100,
      skip: (page - 1) * 100,
    });
    return rows.map(present);
  }

  async updateArrangement(
    id: string,
    input: ReservationArrangementUpdateV1,
    branchIds: readonly string[],
    userId: string,
  ) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new NotFoundException('درخواست رزرواسیون یافت نشد.');
    const counts = [
      input.roomCount,
      input.singleRoomCount,
      input.doubleRoomCount,
      input.extraBedCount,
    ];
    if (
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !counts.every((value) => Number.isInteger(value) && value >= 0) ||
      input.roomCount < 1 ||
      input.singleRoomCount + input.doubleRoomCount > input.roomCount ||
      !Array.isArray(input.hotelGuestCustomerIds) ||
      !input.hotelGuestCustomerIds.every(
        (value) => typeof value === 'string',
      ) ||
      !input.reason?.trim() ||
      input.reason.trim().length > 500
    )
      throw new BadRequestException('ترکیب اتاق یا دلیل تغییر معتبر نیست.');
    const guestIds = [...new Set(input.hotelGuestCustomerIds)];
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "ReservationIntake" WHERE "id" = ${id}::uuid FOR UPDATE`,
      );
      const row = await transaction.reservationIntake.findUnique({
        where: { id },
        include: intakeInclude,
      });
      if (!row || !branchIds.includes(row.branchId))
        throw new NotFoundException('درخواست رزرواسیون یافت نشد.');
      const snapshot = row.snapshot as unknown as SalesReservationRequestV1;
      if (!snapshot.hotelSelection)
        throw new BadRequestException('این درخواست خدمت هتل ندارد.');
      const allowed = new Set(snapshot.passengerIds);
      if (!guestIds.length || guestIds.some((guestId) => !allowed.has(guestId)))
        throw new BadRequestException(
          'اعضای هتل باید از مسافران همین قرارداد انتخاب شوند.',
        );
      const currentVersion = row.arrangements[0]?.version ?? 0;
      if (currentVersion !== input.expectedVersion)
        throw new ConflictException('چیدمان هم‌زمان تغییر کرده است.');
      await transaction.reservationArrangementRevision.create({
        data: {
          intakeId: row.id,
          version: currentVersion + 1,
          roomCount: input.roomCount,
          singleRoomCount: input.singleRoomCount,
          doubleRoomCount: input.doubleRoomCount,
          extraBedCount: input.extraBedCount,
          hotelGuestCustomerIds: guestIds,
          reason: input.reason.trim(),
          updatedByUserId: userId,
        },
      });
      const updated = await transaction.reservationIntake.findUniqueOrThrow({
        where: { id },
        include: intakeInclude,
      });
      return present(updated);
    });
  }
}
