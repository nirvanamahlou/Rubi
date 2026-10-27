import { canSelfServeSalesContract } from '@nora/contracts';
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
  SalesPassengerCorrectionCommandV1,
  SalesPassengerCorrectionHistoryV1,
  SalesPassengerIdentityV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { CustomerService } from '../../customers/customer.service';
import { IamReservationsDirectory } from '../../iam/iam-reservations-directory';
import { NotificationsService } from '../../notifications/notifications.service';
import { PassengerCorrectionCrypto } from './passenger-correction.crypto';
import { passengerAgeCategory } from '../sales.domain';

export const PASSENGER_CORRECTION = 'SALES_PASSENGER_CORRECTION';
const fields = ['birthDate', 'passportNumber', 'passportExpiryDate'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Evidence = {
  version: number;
  command: SalesPassengerCorrectionCommandV1;
  state: SalesPassengerIdentityV1[];
  changes: SalesPassengerCorrectionHistoryV1['changes'];
  actorName: string;
};
type Contract = Awaited<ReturnType<PassengerCorrectionService['contract']>>;

export function correctionDay(value: unknown, required = false): string | null {
  if (value === null || value === '') {
    if (!required) return null;
    throw new BadRequestException('تاریخ تولد الزامی است.');
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('تاریخ معتبر نیست.');
  const date = new Date(value + 'T00:00:00Z');
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('تاریخ معتبر نیست.');
  return value;
}

@Injectable()
export class PassengerCorrectionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(IamReservationsDirectory)
    private readonly directory: IamReservationsDirectory,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(PassengerCorrectionCrypto)
    private readonly crypto: PassengerCorrectionCrypto,
  ) {}
  private canWrite(
    row: {
      ownerUserId: string;
      assignedUserId: string | null;
      branchId: string;
    },
    actor: AuthenticatedActor,
  ) {
    return (
      canSelfServeSalesContract(actor, row) ||
      actor.permissions.includes('sales.contracts.update.branch') ||
      (actor.permissions.includes('sales.contracts.update.own') &&
        row.ownerUserId === actor.userId)
    );
  }
  async contract(id: string, actor: AuthenticatedActor, write = false) {
    const row = await this.database.client.salesContract.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
      include: { passengers: true },
    });
    if (!row) throw new NotFoundException('قرارداد یافت نشد.');
    const readable =
      canSelfServeSalesContract(actor, row) ||
      actor.permissions.includes('reservations.read') ||
      actor.permissions.includes('sales.contracts.read.all') ||
      actor.permissions.includes('sales.contracts.read.branch') ||
      (actor.permissions.includes('sales.contracts.read.own') &&
        row.ownerUserId === actor.userId);
    if (write ? !this.canWrite(row, actor) : !readable)
      throw new ForbiddenException('مجوز ویرایش یا مشاهده قرارداد لازم است.');
    return row;
  }
  private async latest(id: string) {
    const event = await this.database.client.salesContractAuditEvent.findFirst({
      where: {
        contractId: id,
        action: PASSENGER_CORRECTION,
        outcome: 'SUCCESS',
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    return event
      ? this.crypto.decrypt<Evidence>(id, event.afterSnapshot)
      : null;
  }
  private async state(row: Contract, actor: AuthenticatedActor) {
    const readActor =
      !actor.permissions.includes('customers.sensitive.read') &&
      actor.permissions.includes('sales.contracts.create')
        ? this.customers.salesEntryActor(actor)
        : actor;
    if (!readActor.permissions.includes('customers.sensitive.read'))
      throw new ForbiddenException(
        'مجوز مشاهده اطلاعات حساس مشتری وجود ندارد.',
      );
    const latest = await this.latest(row.id);
    const overrides = new Map(
      latest?.state.map((p) => [p.customerId, p]) ?? [],
    );
    return Promise.all(
      row.passengers.map(async (passenger) => {
        const previous = overrides.get(passenger.customerId);
        if (previous)
          return {
            ...previous,
            name: passenger.displayNameSnapshot,
            birthDate: passenger.birthDate?.toISOString().slice(0, 10) ?? '',
          };
        const { data } = await this.customers.detail(
          passenger.customerId,
          readActor,
          undefined,
          'customer-verification',
        );
        return {
          customerId: passenger.customerId,
          name: passenger.displayNameSnapshot,
          birthDate: passenger.birthDate?.toISOString().slice(0, 10) ?? '',
          passportNumber: data.passportNumber ?? null,
          passportExpiryDate: data.passportExpiryDate ?? null,
        };
      }),
    );
  }
  async form(id: string, actor: AuthenticatedActor) {
    const row = await this.contract(id, actor, true);
    if (
      ![
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
      ].includes(row.status)
    )
      throw new ConflictException('اصلاح فقط برای قرارداد بسته‌شده مجاز است.');
    const passengers = await this.state(row, actor);
    await this.auditRead(row, actor);
    return {
      version: row.version,
      contractNumber: row.contractNumber,
      passengers,
    };
  }
  async history(
    id: string,
    actor: AuthenticatedActor,
    cursor?: string,
    eventId?: string,
  ) {
    const row = await this.contract(id, actor);
    if (cursor && !uuid.test(cursor))
      throw new BadRequestException('فیلتر تاریخچه معتبر نیست.');
    if (
      cursor &&
      !(await this.database.client.salesContractAuditEvent.findFirst({
        where: {
          id: cursor,
          contractId: id,
          action: PASSENGER_CORRECTION,
          outcome: 'SUCCESS',
        },
        select: { id: true },
      }))
    )
      throw new BadRequestException('فیلتر تاریخچه معتبر نیست.');
    if (eventId && !uuid.test(eventId))
      throw new BadRequestException('فیلتر تاریخچه معتبر نیست.');
    const events = await this.database.client.salesContractAuditEvent.findMany({
      where: {
        contractId: id,
        action: PASSENGER_CORRECTION,
        outcome: 'SUCCESS',
        ...(eventId ? { id: eventId } : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const sensitive = actor.permissions.includes('customers.sensitive.read');
    const items = events
      .slice(0, 50)
      .map((event): SalesPassengerCorrectionHistoryV1 => {
        const evidence = this.crypto.decrypt<Evidence>(id, event.afterSnapshot);
        return {
          id: event.id,
          occurredAt: event.occurredAt.toISOString(),
          actorUserId: event.actorUserId,
          actorName: evidence.actorName,
          version: evidence.version,
          note: evidence.command.note,
          changes: evidence.changes.map((change) => ({
            ...change,
            before: sensitive ? change.before : null,
            after: sensitive ? change.after : null,
            masked: !sensitive,
          })),
        };
      });
    await this.auditRead(row, actor);
    return { items, nextCursor: events.length > 50 ? events[49]!.id : null };
  }
  private auditRead(row: Contract, actor: AuthenticatedActor) {
    return this.database.client.salesContractAuditEvent.create({
      data: {
        contractId: row.id,
        actorUserId: actor.userId,
        actorBranchId: row.branchId,
        action: 'SALES_PASSENGER_CORRECTION_READ',
        outcome: 'SUCCESS',
        reason: 'customer-verification',
      },
    });
  }
  async correct(
    id: string,
    input: SalesPassengerCorrectionCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (
      !input ||
      !uuid.test(input.operationId ?? '') ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      typeof input.note !== 'string' ||
      input.note.trim().length > 2000 ||
      !Array.isArray(input.passengers) ||
      input.passengers.length > 200
    )
      throw new BadRequestException('اطلاعات اصلاح قرارداد معتبر نیست.');
    const row = await this.contract(id, actor, true);
    if (!actor.permissions.includes('customers.sensitive.read'))
      throw new ForbiddenException(
        'مجوز مشاهده اطلاعات حساس مشتری وجود ندارد.',
      );
    const command: SalesPassengerCorrectionCommandV1 = {
      operationId: input.operationId,
      expectedVersion: input.expectedVersion,
      note: input.note.trim(),
      passengers: input.passengers
        .map((person) => {
          if (
            !person ||
            !uuid.test(person.customerId) ||
            (person.passportNumber !== null &&
              typeof person.passportNumber !== 'string')
          )
            throw new BadRequestException('اطلاعات مسافر معتبر نیست.');
          const passport = person.passportNumber?.trim().toUpperCase() || null;
          if (passport && !/^[A-Z0-9]{3,24}$/.test(passport))
            throw new BadRequestException('شماره پاسپورت معتبر نیست.');
          return {
            customerId: person.customerId,
            birthDate: correctionDay(person.birthDate, true)!,
            passportNumber: passport,
            passportExpiryDate: correctionDay(person.passportExpiryDate),
          };
        })
        .sort((a, b) => a.customerId.localeCompare(b.customerId)),
    };
    if (
      new Set(command.passengers.map((p) => p.customerId)).size !==
      command.passengers.length
    )
      throw new BadRequestException('مسافر تکراری در اصلاح قرارداد مجاز نیست.');
    const replay =
      await this.database.client.salesContractAuditEvent.findUnique({
        where: { id: command.operationId },
      });
    if (replay) {
      if (
        replay.contractId !== id ||
        replay.actorUserId !== actor.userId ||
        replay.action !== PASSENGER_CORRECTION ||
        JSON.stringify(
          this.crypto.decrypt<Evidence>(id, replay.afterSnapshot).command,
        ) !== JSON.stringify(command)
      )
        throw new ConflictException(
          'شناسه عملیات قبلاً برای تغییر دیگری استفاده شده است.',
        );
      return {
        version: this.crypto.decrypt<Evidence>(id, replay.afterSnapshot)
          .version,
        id: replay.id,
      };
    }
    if (
      row.version !== command.expectedVersion ||
      ![
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
      ].includes(row.status)
    )
      throw new ConflictException('نسخه یا وضعیت قرارداد تغییر کرده است.');
    const state = await this.state(row, actor);
    const changes: Array<SalesPassengerCorrectionHistoryV1['changes'][number]> =
      [];
    const travelDay = row.departureDate.toISOString().slice(0, 10);
    for (const person of command.passengers) {
      const previous = state.find((p) => p.customerId === person.customerId);
      if (!previous)
        throw new BadRequestException('مسافر باید متعلق به همین قرارداد باشد.');
      const booked = row.passengers.find(
        (p) => p.customerId === person.customerId,
      )!;
      if (
        previous.birthDate !== person.birthDate &&
        passengerAgeCategory(person.birthDate, travelDay) !== booked.ageCategory
      )
        throw new BadRequestException(
          'اصلاح تاریخ تولد رده سنی قرارداد را تغییر می‌دهد؛ اصلاح مفاد قرارداد لازم است.',
        );
      if (
        person.birthDate > travelDay ||
        person.birthDate > new Date().toISOString().slice(0, 10)
      )
        throw new BadRequestException('تاریخ تولد معتبر نیست.');
      if (
        (previous.passportNumber !== person.passportNumber ||
          previous.passportExpiryDate !== person.passportExpiryDate) &&
        ((person.passportNumber && !person.passportExpiryDate) ||
          (person.passportExpiryDate && person.passportExpiryDate < travelDay))
      )
        throw new BadRequestException(
          'انقضای پاسپورت باید برای تاریخ سفر معتبر باشد.',
        );
      for (const field of fields)
        if (previous[field] !== person[field])
          changes.push({
            customerId: person.customerId,
            name: previous.name,
            field,
            before: previous[field],
            after: person[field],
            masked: false,
          });
      Object.assign(previous, person);
    }
    const passports = state.flatMap((p) =>
      p.passportNumber ? [p.passportNumber] : [],
    );
    if (
      changes.some((c) => c.field === 'passportNumber') &&
      new Set(passports).size !== passports.length
    )
      throw new BadRequestException(
        'شماره پاسپورت مسافران قرارداد نباید تکراری باشد.',
      );
    if (!changes.length && !command.note)
      throw new BadRequestException('تغییری برای ثبت وجود ندارد.');
    const names = await this.directory.names([actor.userId]);
    const evidence: Evidence = {
      version: row.version + 1,
      command,
      state,
      changes,
      actorName: names.get(actor.userId) ?? actor.userId,
    };
    try {
      return await this.database.client.$transaction(
        async (tx) => {
          const changed = await tx.salesContract.updateMany({
            where: { id, version: command.expectedVersion, status: row.status },
            data: { version: { increment: 1 } },
          });
          if (changed.count !== 1)
            throw new ConflictException('قرارداد هم‌زمان تغییر کرد.');
          for (const person of command.passengers)
            await tx.salesContractPassenger.update({
              where: {
                contractId_customerId: {
                  contractId: id,
                  customerId: person.customerId,
                },
              },
              data: { birthDate: new Date(person.birthDate + 'T00:00:00Z') },
            });
          // Preserve correction order even if two successful saves share a millisecond.
          const prior = await tx.salesContractAuditEvent.findFirst({
            where: {
              contractId: id,
              action: PASSENGER_CORRECTION,
              outcome: 'SUCCESS',
            },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: { occurredAt: true },
          });
          await tx.salesContractAuditEvent.create({
            data: {
              id: command.operationId,
              contractId: id,
              actorUserId: actor.userId,
              actorBranchId: row.branchId,
              action: PASSENGER_CORRECTION,
              outcome: 'SUCCESS',
              occurredAt: new Date(
                Math.max(Date.now(), (prior?.occurredAt.getTime() ?? 0) + 1),
              ),
              reason: 'اصلاح مشخصات مسافر و یادداشت رزرواسیون',
              afterSnapshot: this.crypto.protect(
                id,
                evidence,
              ) as unknown as Prisma.InputJsonValue,
            },
          });
          const recipients = await this.directory.recipients(row.branchId, tx);
          await this.notifications.createWithinTransaction(tx, {
            recipientUserIds: recipients,
            actorUserId: actor.userId,
            sourceModule: 'sales',
            eventType: 'sales.passenger-corrected',
            title: 'اصلاح قرارداد',
            message:
              'قرارداد ' +
              row.contractNumber +
              ' اصلاح شده است؛ برای مشاهده تغییرات وارد سوابق شوید.',
            entityType: 'sales_contract',
            entityId: id,
            href:
              '/reservations?correctionContract=' +
              encodeURIComponent(id) +
              '&correctionEvent=' +
              command.operationId,
          });
          return { version: evidence.version, id: command.operationId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        ['P2002', 'P2034'].includes(String(error.code))
      )
        throw new ConflictException(
          'قرارداد هم‌زمان تغییر کرد؛ نتیجه عملیات را با همان شناسه دوباره بررسی کنید.',
        );
      throw error;
    }
  }
  /** Public contract-specific overlay; never changes Customer or original issued snapshots. */
  async effective(id: string, actor: AuthenticatedActor) {
    const row = await this.contract(id, actor);
    if (!actor.permissions.includes('customers.sensitive.read'))
      return new Map<string, SalesPassengerIdentityV1>();
    const evidence = await this.latest(id);
    if (evidence) await this.auditRead(row, actor);
    const current = new Map(
      row.passengers.map((p) => [
        p.customerId,
        p.birthDate?.toISOString().slice(0, 10) ?? '',
      ]),
    );
    return new Map(
      evidence?.state
        .filter((p) => current.has(p.customerId))
        .map((p) => [
          p.customerId,
          { ...p, birthDate: current.get(p.customerId)! },
        ]) ?? [],
    );
  }
}
