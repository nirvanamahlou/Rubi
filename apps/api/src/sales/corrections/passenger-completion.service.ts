import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  readLegacyServiceParties,
  readPassengerHotelStays,
} from '@nora/contracts';
import type {
  AuthenticatedActor,
  CustomerMutationRequest,
  SalesPassengerCompletionCommandV1,
  SalesPassengerCompletionFormV1,
  SalesServiceInput,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import Joi from 'joi';
import { isDeepStrictEqual } from 'node:util';
import { DatabaseService } from '../../database/database.service';
import { CustomerService } from '../../customers/customer.service';
import { IamReservationsDirectory } from '../../iam/iam-reservations-directory';
import { NotificationsService } from '../../notifications/notifications.service';
import { PassengerCorrectionService } from './passenger-correction.service';
import { passengerAgeCategory } from '../sales.domain';

const action = 'SALES_PASSENGER_COMPLETION';
const schema = Joi.object({
  operationId: Joi.string().uuid().required(),
  expectedVersion: Joi.number().integer().min(1).required(),
  passengers: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        customerId: Joi.string().uuid().required(),
        ageCategory: Joi.string().valid('ADT', 'CHD', 'INF'),
        serviceClientKeys: Joi.array()
          .min(1)
          .max(100)
          .unique()
          .items(Joi.string().max(80))
          .required(),
        hotelStay: Joi.object({
          checkInDate: Joi.string().required(),
          checkOutDate: Joi.string().required(),
          different: Joi.boolean().required(),
        }),
      }),
    )
    .unique('customerId')
    .required(),
});
const metadata = (value: Prisma.JsonValue | null) =>
  (value ?? {}) as NonNullable<SalesServiceInput['metadata']>;

/** Fill identities for already-booked aggregate services; never reserve capacity again. */
@Injectable()
export class PassengerCompletionService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(PassengerCorrectionService)
    private readonly access: PassengerCorrectionService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(IamReservationsDirectory)
    private readonly directory: IamReservationsDirectory,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}
  private async load(id: string, actor: AuthenticatedActor) {
    const contract = await this.access.contract(id, actor, true);
    if (
      ![
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
      ].includes(contract.status)
    )
      throw new ConflictException(
        'تکمیل مسافران فقط برای قرارداد تأییدشده مجاز است.',
      );
    const row = await this.database.client.salesContract.findUniqueOrThrow({
      where: { id },
      include: {
        services: true,
        ticketSelections: true,
        hotelSelection: { include: { service: true } },
        passengers: true,
      },
    });
    const services = row.services.map((s) => ({
      ...s,
      metadata: metadata(s.metadata),
    }));
    // The marker belongs to the first service in the original request, not database row order.
    services.sort(
      (a, b) =>
        Number(b.metadata.legacyServicePartiesV2 !== undefined) -
        Number(a.metadata.legacyServicePartiesV2 !== undefined),
    );
    return { row, services, parties: readLegacyServiceParties(services) };
  }
  async form(
    id: string,
    actor: AuthenticatedActor,
  ): Promise<SalesPassengerCompletionFormV1> {
    const { row, services, parties } = await this.load(id, actor);
    return {
      version: row.version,
      departureDate: row.departureDate.toISOString().slice(0, 10),
      available: !!parties && row.passengers.length === 0,
      services: parties
        ? services.map((s) => ({
            key: s.clientKey,
            title: s.titleSnapshot,
            kind: s.kind,
            direction:
              row.ticketSelections.find((t) => t.serviceId === s.id)
                ?.direction ?? null,
            party: parties[s.clientKey]!,
          }))
        : [],
      hotel: row.hotelSelection
        ? {
            serviceKey: row.hotelSelection.service.clientKey,
            checkInDate: row.hotelSelection.checkInDate
              .toISOString()
              .slice(0, 10),
            checkOutDate: row.hotelSelection.checkOutDate
              .toISOString()
              .slice(0, 10),
          }
        : null,
    };
  }
  async createPerson(
    id: string,
    input: CustomerMutationRequest,
    actor: AuthenticatedActor,
  ) {
    // Profile creation is also used by the versioned contract amendment editor.
    // Membership/capacity changes still go through Sales.amend; completion.save
    // retains its aggregate-only guards and never reserves capacity twice.
    await this.load(id, actor);
    return this.customers.createForSalesCompletion(input, actor);
  }
  async save(
    id: string,
    input: SalesPassengerCompletionCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (schema.validate(input, { convert: false }).error)
      throw new BadRequestException('اطلاعات مسافران معتبر نیست.');
    const { row, services, parties } = await this.load(id, actor);
    const command = {
      ...input,
      passengers: [...input.passengers]
        .map((p) => ({
          ...p,
          serviceClientKeys: [...p.serviceClientKeys].sort(),
        }))
        .sort((a, b) => a.customerId.localeCompare(b.customerId)),
    };
    const prior = await this.database.client.salesContractAuditEvent.findUnique(
      { where: { id: command.operationId } },
    );
    if (prior) {
      const evidence = prior.afterSnapshot as {
        command?: unknown;
        version?: number;
      } | null;
      if (
        prior.contractId !== id ||
        prior.actorUserId !== actor.userId ||
        prior.action !== action ||
        !isDeepStrictEqual(evidence?.command, command)
      )
        throw new ConflictException('شناسه عملیات قبلاً استفاده شده است.');
      return { version: evidence!.version! };
    }
    if (
      !parties ||
      row.passengers.length ||
      row.version !== input.expectedVersion
    )
      throw new ConflictException(
        'نسخه یا فهرست مسافران قرارداد تغییر کرده است.',
      );
    const people: Array<
      SalesPassengerCompletionCommandV1['passengers'][number] & {
        birthDate: string | null;
        name: string;
        category: 'ADT' | 'CHD' | 'INF';
      }
    > = [];
    const readActor =
      !actor.permissions.includes('customers.sensitive.read') &&
      actor.permissions.includes('sales.contracts.create')
        ? this.customers.salesEntryActor(actor)
        : actor;
    for (const person of command.passengers) {
      const { data } = await this.customers.detail(
        person.customerId,
        readActor,
        undefined,
        'customer-verification',
      );
      if (
        data.kind !== 'person' ||
        data.status !== 'active' ||
        !(data.passportFirstName?.trim() || data.firstName?.trim()) ||
        !(data.passportLastName?.trim() || data.lastName?.trim())
      )
        throw new BadRequestException('نام و نام خانوادگی شخص الزامی است.');
      const day = row.departureDate.toISOString().slice(0, 10);
      if (
        (data.birthDate &&
          (data.birthDate > day ||
            data.birthDate > new Date().toISOString().slice(0, 10))) ||
        (data.passportExpiryDate && data.passportExpiryDate < day)
      )
        throw new BadRequestException(
          'تاریخ تولد یا انقضای پاسپورت برای سفر معتبر نیست.',
        );
      if (person.serviceClientKeys.some((key) => !parties[key]))
        throw new BadRequestException('خدمت باید متعلق به همین قرارداد باشد.');
      if (person.hotelStay) {
        const hotel = row.hotelSelection;
        if (
          !hotel ||
          !person.serviceClientKeys.includes(
            services.find((s) => s.id === hotel.serviceId)!.clientKey,
          )
        )
          throw new BadRequestException(
            'اقامت مسافر بدون تخصیص هتل مجاز نیست.',
          );
        try {
          readPassengerHotelStays([
            {
              kind: 'HOTEL',
              metadata: {
                passengerHotelStaysV1: JSON.stringify({
                  [person.customerId]: person.hotelStay,
                }),
              },
            },
          ]);
        } catch {
          throw new BadRequestException('تاریخ اقامت مسافر معتبر نیست.');
        }
      }
      people.push({
        ...person,
        birthDate: data.birthDate || null,
        name: `${data.passportFirstName?.trim() || data.firstName!.trim()} ${data.passportLastName?.trim() || data.lastName!.trim()}`,
        category: data.birthDate
          ? passengerAgeCategory(data.birthDate, day)
          : person.ageCategory!,
      });
      if (!data.birthDate && !person.ageCategory)
        throw new BadRequestException('اطلاعات مسافران معتبر نیست.');
      if (
        data.birthDate &&
        person.ageCategory &&
        person.ageCategory !== people[people.length - 1]!.category
      )
        throw new BadRequestException('اطلاعات مسافران معتبر نیست.');
    }
    for (const service of services) {
      const expected = parties[service.clientKey]!;
      const assigned = people.filter((p) =>
        p.serviceClientKeys.includes(service.clientKey),
      );
      if (
        assigned.filter((p) => p.category === 'ADT').length !==
          expected.adults ||
        assigned.filter((p) => p.category === 'CHD').length !==
          expected.children ||
        assigned.filter((p) => p.category === 'INF').length !== expected.infants
      )
        throw new BadRequestException(
          `تعداد و رده سنی مسافران ${service.titleSnapshot} باید مطابق قرارداد باشد.`,
        );
    }
    return this.database.client.$transaction(
      async (tx) => {
        const changed = await tx.salesContract.updateMany({
          where: { id, version: input.expectedVersion, status: row.status },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'قرارداد هم‌زمان تغییر کرد؛ آخرین نسخه را دریافت کنید.',
          );
        for (const person of people) {
          await tx.salesContractPassenger.create({
            data: {
              contractId: id,
              customerId: person.customerId,
              displayNameSnapshot: person.name,
              birthDate: person.birthDate
                ? new Date(person.birthDate + 'T00:00:00Z')
                : null,
              ageCategory: person.category,
              allocations: {
                create: person.serviceClientKeys.map((key) => ({
                  serviceId: services.find((s) => s.clientKey === key)!.id,
                })),
              },
            },
          });
        }
        for (const service of services) {
          const next = { ...service.metadata };
          if (next.legacyServicePartiesV2 !== undefined) {
            next.completedLegacyServicePartiesV2 = next.legacyServicePartiesV2;
            delete next.legacyServicePartiesV2;
          }
          if (service.kind === 'HOTEL' && row.hotelSelection)
            next.passengerHotelStaysV1 = JSON.stringify(
              Object.fromEntries(
                people
                  .filter((p) =>
                    p.serviceClientKeys.includes(service.clientKey),
                  )
                  .map((p) => [
                    p.customerId,
                    p.hotelStay?.different
                      ? p.hotelStay
                      : {
                          different: false,
                          checkInDate: row
                            .hotelSelection!.checkInDate.toISOString()
                            .slice(0, 10),
                          checkOutDate: row
                            .hotelSelection!.checkOutDate.toISOString()
                            .slice(0, 10),
                        },
                  ]),
              ),
            );
          await tx.salesContractService.update({
            where: { id: service.id },
            data: { metadata: next as Prisma.InputJsonValue },
          });
        }
        await tx.salesContractAuditEvent.create({
          data: {
            id: input.operationId,
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: row.branchId,
            action,
            outcome: 'SUCCESS',
            reason: 'تکمیل مسافران قرارداد مطابق تعداد ثبت‌شده',
            afterSnapshot: {
              command,
              version: row.version + 1,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: await this.directory.recipients(row.branchId, tx),
          actorUserId: actor.userId,
          sourceModule: 'sales',
          eventType: 'sales.passenger-completed',
          title: 'تکمیل مسافران قرارداد',
          message: `اسامی مسافران قرارداد ${row.contractNumber} ثبت شد.`,
          entityType: 'sales_contract',
          entityId: id,
          href: '/reservations?correctionContract=' + encodeURIComponent(id),
        });
        return { version: row.version + 1 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
