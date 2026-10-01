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
  hotelNights,
  moneyDecimal,
  moneyUnits,
  type AuthenticatedActor,
  type ReservationServicePurchaseInputV1,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function purchasableReservationService(
  snapshot: SalesReservationRequestV1,
  serviceClientKey: string,
) {
  const selected = snapshot.serviceSelections.find(
    ({ clientKey }) => clientKey === serviceClientKey,
  );
  if (selected) return selected;
  const hotel = snapshot.hotelSelection;
  if (hotel?.serviceClientKey !== serviceClientKey) return undefined;
  return {
    clientKey: hotel.serviceClientKey,
    kind: 'HOTEL' as const,
    titleSnapshot: hotel.hotelNameSnapshot,
  } as SalesReservationRequestV1['serviceSelections'][number];
}

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
          'passengerPrices',
        ].includes(key),
    ) ||
    (input.passengerPrices !== undefined &&
      (!Array.isArray(input.passengerPrices) ||
        input.passengerPrices.length === 0 ||
        input.passengerPrices.some(
          (price) =>
            !price ||
            !UUID.test(price.customerId) ||
            typeof price.nightlyAmount !== 'string' ||
            Object.keys(price).some(
              (key) => !['customerId', 'nightlyAmount'].includes(key),
            ),
        )))
  )
    throw new BadRequestException('اطلاعات خرید خدمت معتبر نیست.');
  try {
    if (moneyUnits(input.amount) <= 0n) throw new Error();
  } catch {
    throw new BadRequestException(
      'هزینه خرید باید مبلغی مثبت با حداکثر چهار رقم اعشار باشد.',
    );
  }
  for (const price of input.passengerPrices ?? []) {
    try {
      if (moneyUnits(price.nightlyAmount) <= 0n) throw new Error();
    } catch {
      throw new BadRequestException(
        'قیمت هر شب هر مسافر باید مبلغی مثبت باشد.',
      );
    }
  }
}

export function hotelPassengerPurchase(
  snapshot: SalesReservationRequestV1,
  serviceClientKey: string,
  prices: NonNullable<ReservationServicePurchaseInputV1['passengerPrices']>,
  dates?: { checkIn?: string; checkOut?: string },
) {
  const hotel = snapshot.hotelSelection;
  if (!hotel || hotel.serviceClientKey !== serviceClientKey)
    throw new BadRequestException('اقامت هتل انتخاب‌شده معتبر نیست.');
  const assigned = (
    snapshot.passengerAssignments?.length
      ? snapshot.passengerAssignments.filter((passenger) =>
          passenger.serviceClientKeys.includes(serviceClientKey),
        )
      : snapshot.passengerIds.map((customerId) => ({
          customerId,
          displayNameSnapshot: customerId,
        }))
  ) as readonly {
    customerId: string;
    displayNameSnapshot?: string;
  }[];
  const unique = new Map(prices.map((price) => [price.customerId, price]));
  if (
    unique.size !== prices.length ||
    assigned.length !== prices.length ||
    assigned.some((passenger) => !unique.has(passenger.customerId))
  )
    throw new BadRequestException(
      'برای تمام مسافران هتل دقیقاً یک قیمت شبانه وارد کنید.',
    );
  let nights: number;
  try {
    nights = hotelNights(
      dates?.checkIn || hotel.checkInDate,
      dates?.checkOut || hotel.checkOutDate,
    );
  } catch {
    throw new BadRequestException('تاریخ ورود و خروج هتل معتبر نیست.');
  }
  const passengerPrices = assigned.map((passenger) => {
    const nightlyAmount = moneyDecimal(
      moneyUnits(unique.get(passenger.customerId)!.nightlyAmount),
    );
    return {
      customerId: passenger.customerId,
      passengerName:
        passenger.displayNameSnapshot?.trim() || passenger.customerId,
      nightlyAmount,
      nights,
      totalAmount: moneyDecimal(moneyUnits(nightlyAmount) * BigInt(nights)),
    };
  });
  return {
    passengerPrices,
    amount: moneyDecimal(
      passengerPrices.reduce(
        (sum, price) => sum + moneyUnits(price.totalAmount),
        0n,
      ),
    ),
  };
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
      include: { workflowRevisions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!intake || !actor.branchIds.includes(intake.branchId))
      throw new NotFoundException('درخواست رزرواسیون در دسترس نیست.');
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const service = purchasableReservationService(
      snapshot,
      input.serviceClientKey,
    );
    if (!service)
      throw new BadRequestException(
        'خدمت انتخاب‌شده متعلق به این قرارداد نیست.',
      );
    if (service.kind !== 'HOTEL' && service.kind !== 'TRANSFER')
      throw new BadRequestException(
        'قیمت خرید بلیط هنگام تعریف بلیط در مدیریت بلیط ثبت و برای مالی ارسال می‌شود.',
      );
    const [broker] = await Promise.all([
      this.directory.brokerReference(input.supplierOrganizationId),
      this.directory.currencyReference(input.currencyCode),
    ]);
    const state = intake.workflowRevisions[0]?.state as
      | { sentSupplierFormSettings?: { text?: Record<string, string> } }
      | undefined;
    const hotelPricing =
      service.kind === 'HOTEL'
        ? hotelPassengerPurchase(
            snapshot,
            service.clientKey,
            input.passengerPrices ?? [],
            {
              ...(state?.sentSupplierFormSettings?.text?.checkIn
                ? {
                    checkIn: state.sentSupplierFormSettings.text.checkIn,
                  }
                : {}),
              ...(state?.sentSupplierFormSettings?.text?.checkOut
                ? {
                    checkOut: state.sentSupplierFormSettings.text.checkOut,
                  }
                : {}),
            },
          )
        : null;
    if (
      hotelPricing &&
      moneyUnits(input.amount) !== moneyUnits(hotelPricing.amount)
    )
      throw new BadRequestException(
        'جمع قیمت مسافران هتل با مبلغ خرید یکسان نیست.',
      );
    if (service.kind === 'TRANSFER' && input.passengerPrices)
      throw new BadRequestException(
        'قیمت مسافری فقط برای خرید هتل ثبت می‌شود.',
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
            amount: hotelPricing?.amount ?? input.amount,
            currencyCode: input.currencyCode,
            ...(hotelPricing
              ? {
                  passengerPrices:
                    hotelPricing.passengerPrices as Prisma.InputJsonValue,
                }
              : {}),
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
