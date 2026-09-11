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
  type ReservationServicePurchaseInputV1,
  type SalesReservationRequestV1,
} from '@rubi/contracts';
import { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateServicePurchase(
  input: ReservationServicePurchaseInputV1,
) {
  if (
    !input ||
    input.version !== 1 ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    typeof input.serviceClientKey !== 'string' ||
    !input.serviceClientKey.trim() ||
    input.serviceClientKey.length > 160 ||
    typeof input.supplierOrganizationId !== 'string' ||
    !UUID.test(input.supplierOrganizationId) ||
    typeof input.currencyCode !== 'string' ||
    !/^[A-Z]{3}$/.test(input.currencyCode) ||
    Object.keys(input).some(
      (key) =>
        ![
          'version',
          'expectedVersion',
          'serviceClientKey',
          'supplierOrganizationId',
          'amount',
          'currencyCode',
        ].includes(key),
    )
  )
    throw new BadRequestException('اطلاعات خرید خدمت معتبر نیست.');
  try {
    if (moneyUnits(input.amount) <= 0n) throw new Error();
  } catch {
    throw new BadRequestException(
      'هزینه خرید باید مبلغی مثبت با حداکثر چهار رقم اعشار باشد.',
    );
  }
}

@Injectable()
export class ReservationServicePurchaseService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
  ) {}

  async record(
    intakeId: string,
    input: ReservationServicePurchaseInputV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.permissions.includes('reservations.hotel_purchase.write')
    )
      throw new ForbiddenException('مجوز ثبت خرید خدمات وجود ندارد.');
    if (!UUID.test(intakeId) || !key?.trim() || key.length > 160)
      throw new BadRequestException('شناسه درخواست و کلید ثبت معتبر لازم است.');
    validateServicePurchase(input);
    const intake = await this.database.client.reservationIntake.findUnique({
      where: { id: intakeId },
    });
    if (!intake || !actor.branchIds.includes(intake.branchId))
      throw new NotFoundException('درخواست رزرواسیون در دسترس نیست.');
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const service = snapshot.serviceSelections.find(
      ({ clientKey }) => clientKey === input.serviceClientKey,
    );
    if (!service)
      throw new BadRequestException(
        'خدمت انتخاب‌شده متعلق به این قرارداد نیست.',
      );
    if (
      service.pricing?.length &&
      !service.pricing.some(
        ({ currencyCode }) => currencyCode === input.currencyCode,
      )
    )
      throw new BadRequestException(
        'ارز خرید باید با یکی از ارزهای همان خدمت یکسان باشد؛ تبدیل ارز ضمنی مجاز نیست.',
      );
    const broker = await this.directory.brokerReference(
      input.supplierOrganizationId,
    );
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ intakeId, ...input }))
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
      return {
        version: 1 as const,
        data: { id: row.id, version: row.version },
      };
    };
    const previous =
      await this.database.client.reservationServicePurchase.findUnique({
        where: unique,
      });
    if (previous) return replay(previous);
    try {
      return await this.database.client.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${intakeId}, 0))`,
        );
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
            'خرید خدمات هم‌زمان تغییر کرده است؛ اطلاعات را تازه کنید.',
          );
        const row = await tx.reservationServicePurchase.create({
          data: {
            intakeId,
            serviceClientKey: service.clientKey,
            serviceKind: service.kind,
            serviceTitleSnapshot: service.titleSnapshot,
            supplierOrganizationId: broker.id,
            supplierNameSnapshot: broker.name,
            version: input.expectedVersion + 1,
            amount: input.amount,
            currencyCode: input.currencyCode,
            actorUserId: actor.userId,
            idempotencyKey: key,
            fingerprint,
          },
        });
        return {
          version: 1 as const,
          data: { id: row.id, version: row.version },
        };
      });
    } catch (error) {
      const saved =
        await this.database.client.reservationServicePurchase.findUnique({
          where: unique,
        });
      if (saved) return replay(saved);
      throw error;
    }
  }
}
