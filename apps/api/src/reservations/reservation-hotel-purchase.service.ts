import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  moneyUnits,
  type AuthenticatedActor,
  type ReservationHotelPurchaseInputV1,
  type SalesReservationRequestV1,
} from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';

export function validateHotelPurchase(input: ReservationHotelPurchaseInputV1) {
  if (
    !input ||
    input.version !== 1 ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    typeof input.currencyCode !== 'string' ||
    !/^[A-Z]{3}$/.test(input.currencyCode) ||
    Object.keys(input).some(
      (key) =>
        !['version', 'expectedVersion', 'amount', 'currencyCode'].includes(key),
    )
  )
    throw new BadRequestException('اطلاعات هزینه خرید هتل معتبر نیست.');
  try {
    if (moneyUnits(input.amount) <= 0n) throw new Error();
  } catch {
    throw new BadRequestException(
      'هزینه خرید باید مبلغی مثبت با حداکثر چهار رقم اعشار باشد.',
    );
  }
}
@Injectable()
export class ReservationHotelPurchaseService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async record(
    intakeId: string,
    input: ReservationHotelPurchaseInputV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.permissions.includes('reservations.hotel_purchase.write')
    )
      throw new ForbiddenException('مجوز ثبت هزینه خرید هتل وجود ندارد.');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        intakeId,
      ) ||
      !key?.trim() ||
      key.length > 160
    )
      throw new BadRequestException('شناسه درخواست و کلید ثبت معتبر لازم است.');
    validateHotelPurchase(input);
    const intake = await this.database.client.reservationIntake.findUnique({
      where: { id: intakeId },
    });
    if (!intake || !actor.branchIds.includes(intake.branchId))
      throw new NotFoundException('درخواست رزرواسیون در دسترس نیست.');
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    if (!snapshot.hotelSelection)
      throw new BadRequestException('این درخواست، اقامت هتل ندارد.');
    const pricing = snapshot.serviceSelections.find(
      (service) =>
        service.clientKey === snapshot.hotelSelection?.serviceClientKey,
    )?.pricing;
    if (
      pricing?.length &&
      !pricing.some((price) => price.currencyCode === input.currencyCode)
    )
      throw new BadRequestException(
        'ارز خرید باید با یکی از ارزهای قیمت هتل یکسان باشد؛ تبدیل ارز ضمنی مجاز نیست.',
      );
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          intakeId,
          version: input.version,
          expectedVersion: input.expectedVersion,
          amount: input.amount,
          currencyCode: input.currencyCode,
        }),
      )
      .digest('hex');
    const unique = {
      actorUserId_idempotencyKey: {
        actorUserId: actor.userId,
        idempotencyKey: key,
      },
    };
    const replay = (row: {
      fingerprint: string;
      id: string;
      version: number;
    }) => {
      if (row.fingerprint !== fingerprint)
        throw new ConflictException(
          'این کلید ثبت قبلاً برای اطلاعات دیگری استفاده شده است.',
        );
      return { version: 1, data: { id: row.id, version: row.version } };
    };
    const previous =
      await this.database.client.reservationHotelPurchase.findUnique({
        where: unique,
      });
    if (previous) return replay(previous);
    try {
      return await this.database.client.$transaction(async (tx) => {
        const updated = await tx.reservationIntake.updateMany({
          where: {
            id: intakeId,
            branchId: { in: actor.branchIds },
            purchaseVersion: input.expectedVersion,
          },
          data: { purchaseVersion: { increment: 1 } },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'هزینه خرید هم‌زمان تغییر کرده است؛ اطلاعات را تازه کنید.',
          );
        const row = await tx.reservationHotelPurchase.create({
          data: {
            intakeId,
            version: input.expectedVersion + 1,
            amount: input.amount,
            currencyCode: input.currencyCode,
            actorUserId: actor.userId,
            idempotencyKey: key,
            fingerprint,
          },
        });
        return { version: 1, data: { id: row.id, version: row.version } };
      });
    } catch (error) {
      const saved =
        await this.database.client.reservationHotelPurchase.findUnique({
          where: unique,
        });
      if (saved) return replay(saved);
      throw error;
    }
  }
}
