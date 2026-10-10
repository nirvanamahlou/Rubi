import { createHash, randomUUID } from 'node:crypto';
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
  reservationServicePurchaseTotal,
  type AuthenticatedActor,
  type ReservationServicePurchaseInputV1,
  type ReservationPurchaseBatchInputV1,
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
          'coveredServiceClientKeys',
          'transferUnitAmount',
          'pricingCalculation',
        ].includes(key),
    ) ||
    (input.coveredServiceClientKeys !== undefined &&
      (!Array.isArray(input.coveredServiceClientKeys) ||
        !input.coveredServiceClientKeys.length ||
        input.coveredServiceClientKeys.length > 100 ||
        input.coveredServiceClientKeys.some(
          (key) => typeof key !== 'string' || !key.trim() || key.length > 160,
        ))) ||
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
  if (input.pricingCalculation !== undefined) {
    const calculation = input.pricingCalculation;
    if (
      !calculation ||
      typeof calculation !== 'object' ||
      Object.keys(calculation).some(
        (key) =>
          !['baseAmount', 'factor', 'chargeablePassengerCount'].includes(key),
      ) ||
      (calculation.chargeablePassengerCount !== undefined &&
        (!Number.isSafeInteger(calculation.chargeablePassengerCount) ||
          calculation.chargeablePassengerCount <= 0)) ||
      input.passengerPrices !== undefined ||
      input.transferUnitAmount !== undefined
    )
      throw new BadRequestException('فرمول خرید خدمت معتبر نیست.');
    try {
      if (
        moneyUnits(calculation.baseAmount) <= 0n ||
        moneyUnits(calculation.factor) <= 0n
      )
        throw new Error();
    } catch {
      throw new BadRequestException('قیمت پایه و ضریب خرید معتبر نیست.');
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

  async recordBatch(
    intakeId: string,
    input: ReservationPurchaseBatchInputV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.permissions.includes('reservations.hotel_purchase.write')
    )
      throw new ForbiddenException('مجوز ثبت خرید خدمات وجود ندارد.');
    if (!UUID.test(intakeId) || !key?.trim() || key.length > 140)
      throw new BadRequestException('شناسه درخواست و کلید ثبت معتبر لازم است.');
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !Array.isArray(input.purchases) ||
      input.purchases.length < 1 ||
      input.purchases.length > 100 ||
      Object.keys(input).some(
        (field) => !['version', 'expectedVersion', 'purchases'].includes(field),
      )
    )
      throw new BadRequestException('درخواست خرید قرارداد معتبر نیست.');
    const intake = await this.database.client.reservationIntake.findUnique({
      where: { id: intakeId },
      include: { workflowRevisions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!intake || !actor.branchIds.includes(intake.branchId))
      throw new NotFoundException('درخواست رزرواسیون در دسترس نیست.');
    const snapshot = intake.snapshot as unknown as SalesReservationRequestV1;
    const hotelKey = snapshot.hotelSelection?.serviceClientKey;
    const transferKeys = snapshot.serviceSelections
      .filter((service) => service.kind === 'TRANSFER')
      .map((service) => service.clientKey);
    const expectedKeys = [hotelKey, ...transferKeys].filter(
      (value): value is string => Boolean(value),
    );
    const rows = input.purchases.map((purchase) => {
      const full = {
        ...purchase,
        version: 1 as const,
        expectedVersion: input.expectedVersion,
      };
      validateServicePurchase(full);
      return full;
    });
    const covered = rows.flatMap((row) => row.coveredServiceClientKeys ?? []);
    if (
      !expectedKeys.length ||
      covered.length !== expectedKeys.length ||
      new Set(covered).size !== covered.length ||
      expectedKeys.some((serviceKey) => !covered.includes(serviceKey)) ||
      rows.some(
        (row) => !row.coveredServiceClientKeys?.includes(row.serviceClientKey),
      ) ||
      rows.filter((row) => row.serviceClientKey === hotelKey).length !==
        Number(Boolean(hotelKey)) ||
      rows.some((row) =>
        row.coveredServiceClientKeys?.some((key: string) =>
          row.serviceClientKey === hotelKey
            ? key !== hotelKey
            : !transferKeys.includes(key),
        ),
      )
    )
      throw new BadRequestException(
        'خدمات خرید باید دقیقاً با هتل و ترانسفرهای قرارداد منطبق باشند.',
      );
    const state = intake.workflowRevisions[0]?.state as
      | { sentSupplierFormSettings?: { text?: Record<string, string> } }
      | undefined;
    const dates = {
      ...(state?.sentSupplierFormSettings?.text?.checkIn
        ? { checkIn: state.sentSupplierFormSettings.text.checkIn }
        : {}),
      ...(state?.sentSupplierFormSettings?.text?.checkOut
        ? { checkOut: state.sentSupplierFormSettings.text.checkOut }
        : {}),
    };
    const prepared = await Promise.all(
      rows.map(async (row) => {
        const service = purchasableReservationService(
          snapshot,
          row.serviceClientKey,
        );
        if (!service || !['HOTEL', 'TRANSFER'].includes(service.kind))
          throw new BadRequestException('خدمت خرید متعلق به قرارداد نیست.');
        const [broker] = await Promise.all([
          this.directory.brokerReference(row.supplierOrganizationId),
          this.directory.currencyReference(row.currencyCode),
        ]);
        let amount: string;
        let passengerPrices: Prisma.InputJsonValue | undefined;
        if (row.pricingCalculation) {
          if (
            service.kind === 'HOTEL' &&
            (row.coveredServiceClientKeys?.length !== 1 ||
              row.pricingCalculation.chargeablePassengerCount !== undefined)
          )
            throw new BadRequestException('خدمات فرمول خرید معتبر نیست.');
          try {
            const count =
              service.kind === 'TRANSFER'
                ? (row.pricingCalculation.chargeablePassengerCount ??
                  Number(row.pricingCalculation.factor))
                : undefined;
            if (
              count !== undefined &&
              (!Number.isSafeInteger(count) || count <= 0)
            )
              throw new Error();
            const nights =
              service.kind === 'HOTEL'
                ? hotelNights(
                    snapshot.hotelSelection?.checkInDate ?? '',
                    snapshot.hotelSelection?.checkOutDate ?? '',
                  )
                : 1;
            amount = reservationServicePurchaseTotal(
              row.pricingCalculation.baseAmount,
              count !== undefined
                ? String(count)
                : row.pricingCalculation.factor,
              nights,
            );
            passengerPrices = {
              calculation: {
                ...row.pricingCalculation,
                ...(count !== undefined
                  ? { chargeablePassengerCount: count, factor: String(count) }
                  : {}),
                nights,
                totalAmount: amount,
              },
            };
          } catch {
            throw new BadRequestException(
              'قیمت یا تعداد نفرات ترانسفر یا فرمول هتل معتبر نیست.',
            );
          }
        } else if (service.kind === 'HOTEL') {
          if (
            row.coveredServiceClientKeys?.length !== 1 ||
            row.transferUnitAmount
          )
            throw new BadRequestException('ردیف خرید هتل معتبر نیست.');
          const pricing = hotelPassengerPurchase(
            snapshot,
            row.serviceClientKey,
            row.passengerPrices ?? [],
            dates,
          );
          amount = pricing.amount;
          passengerPrices = pricing.passengerPrices as Prisma.InputJsonValue;
        } else {
          if (
            row.passengerPrices ||
            row.coveredServiceClientKeys?.length !== transferKeys.length ||
            transferKeys.some(
              (serviceKey) =>
                !row.coveredServiceClientKeys?.includes(serviceKey),
            ) ||
            typeof row.transferUnitAmount !== 'string'
          )
            throw new BadRequestException('ردیف خرید ترانسفر معتبر نیست.');
          const passengers = snapshot.passengerAssignments?.length
            ? snapshot.passengerAssignments.filter((passenger) =>
                passenger.serviceClientKeys.some((serviceKey) =>
                  transferKeys.includes(serviceKey),
                ),
              )
            : snapshot.passengerIds.map((customerId) => ({
                customerId,
                displayNameSnapshot: customerId,
              }));
          if (!passengers.length)
            throw new BadRequestException(
              'مسافر ترانسفر در قرارداد ثبت نشده است.',
            );
          let unit: bigint;
          try {
            unit = moneyUnits(row.transferUnitAmount);
            if (unit <= 0n) throw new Error();
          } catch {
            throw new BadRequestException('قیمت ترانسفر هر مسافر معتبر نیست.');
          }
          amount = moneyDecimal(unit * BigInt(passengers.length));
          passengerPrices = passengers.map((passenger) => ({
            customerId: passenger.customerId,
            passengerName:
              passenger.displayNameSnapshot || passenger.customerId,
            unitAmount: moneyDecimal(unit),
            totalAmount: moneyDecimal(unit),
          }));
        }
        if (moneyUnits(row.amount) !== moneyUnits(amount))
          throw new BadRequestException(
            'مبلغ کل خرید با محاسبهٔ خدمت یکسان نیست.',
          );
        return { row, service, broker, amount, passengerPrices };
      }),
    );
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ intakeId, ...input }))
      .digest('hex');
    const firstKey = `${key}:0`;
    const unique = {
      actorUserId_idempotencyKey: {
        actorUserId: actor.userId,
        idempotencyKey: firstKey,
      },
    };
    const replay =
      await this.database.client.reservationServicePurchase.findUnique({
        where: unique,
      });
    if (replay) {
      if (replay.fingerprint !== fingerprint)
        throw new ConflictException(
          'کلید ثبت قبلاً برای اطلاعات دیگری استفاده شده است.',
        );
      return { version: 1 as const, data: { batchId: replay.batchId } };
    }
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
          data: { purchaseVersion: { increment: prepared.length } },
        });
        if (updated.count !== 1)
          throw new ConflictException(
            'خرید قرارداد هم‌زمان تغییر کرده است؛ اطلاعات را تازه کنید.',
          );
        const batchId = randomUUID();
        for (const [index, item] of prepared.entries()) {
          await tx.reservationServicePurchase.create({
            data: {
              intakeId,
              batchId,
              coveredServiceClientKeys: item.row
                .coveredServiceClientKeys as Prisma.InputJsonValue,
              serviceClientKey: item.service.clientKey,
              serviceKind: item.service.kind,
              serviceTitleSnapshot:
                item.service.kind === 'HOTEL'
                  ? snapshot.hotelSelection!.hotelNameSnapshot
                  : (item.row.coveredServiceClientKeys?.length ?? 0) > 1
                    ? 'ترانسفر رفت‌وبرگشت'
                    : item.service.titleSnapshot,
              supplierOrganizationId:
                item.broker.source === 'BROKER' ? null : item.broker.id,
              supplierBrokerId:
                item.broker.source === 'BROKER' ? item.broker.id : null,
              supplierNameSnapshot: item.broker.name,
              version: input.expectedVersion + index + 1,
              amount: item.amount,
              currencyCode: item.row.currencyCode,
              passengerPrices: item.passengerPrices!,
              actorUserId: actor.userId,
              idempotencyKey: `${key}:${index}`,
              fingerprint,
            },
          });
        }
        return { version: 1 as const, data: { batchId } };
      });
    } catch (error) {
      const saved =
        await this.database.client.reservationServicePurchase.findUnique({
          where: unique,
        });
      if (saved && saved.fingerprint === fingerprint)
        return { version: 1 as const, data: { batchId: saved.batchId } };
      throw error;
    }
  }

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
    if (
      input.coveredServiceClientKeys ||
      input.transferUnitAmount ||
      input.pricingCalculation
    )
      throw new BadRequestException(
        'خرید مشترک فقط از مسیر درخواست خرید قرارداد ثبت می‌شود.',
      );
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
    if (!['HOTEL', 'TRANSFER', 'INSURANCE'].includes(service.kind))
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
    if (service.kind !== 'HOTEL' && input.passengerPrices)
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
            supplierOrganizationId:
              broker.source === 'BROKER' ? null : broker.id,
            supplierBrokerId: broker.source === 'BROKER' ? broker.id : null,
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
