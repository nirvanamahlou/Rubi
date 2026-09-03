import { Inject, Injectable } from '@nestjs/common';
import type {
  SalesContractCreateRequest,
  SalesContractListQuery,
  SalesPaymentCreateRequest,
} from '@rubi/contracts';
import { AuditOutcome, Prisma, type SalesContractStatus } from '@rubi/database';

import { DatabaseService } from '../database/database.service';
import { calculateSalesBalances, passengerAgeCategory } from './sales.domain';

export const salesDetailInclude = {
  passengers: {
    include: { allocations: { include: { service: true } } },
    orderBy: { createdAt: 'asc' },
  },
  services: { orderBy: { createdAt: 'asc' } },
  ticketSelections: { orderBy: { departureAt: 'asc' } },
  hotelSelection: true,
  priceComponents: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
  reservationRequests: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.SalesContractInclude;

export type SalesContractRow = Prisma.SalesContractGetPayload<{
  include: typeof salesDetailInclude;
}>;

export interface SalesActorContext {
  userId: string;
  branchId: string;
  traceId?: string;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfDay(value: string): Date {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value,
  );
}

function endOfDay(value: string): Date {
  return new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value,
  );
}

@Injectable()
export class SalesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  findById(id: string): Promise<SalesContractRow | null> {
    return this.database.client.salesContract.findUnique({
      where: { id },
      include: salesDetailInclude,
    });
  }

  findByCreateKey(
    ownerUserId: string,
    createIdempotencyKey: string,
  ): Promise<SalesContractRow | null> {
    return this.database.client.salesContract.findUnique({
      where: {
        ownerUserId_createIdempotencyKey: { ownerUserId, createIdempotencyKey },
      },
      include: salesDetailInclude,
    });
  }

  async list(
    query: SalesContractListQuery,
    whereScope: Prisma.SalesContractWhereInput,
  ) {
    const where: Prisma.SalesContractWhereInput = {
      AND: [
        whereScope,
        query.search
          ? {
              OR: [
                {
                  contractNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                {
                  customerNameSnapshot: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {},
        query.branchId ? { branchId: query.branchId } : {},
        query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
        query.originId ? { originId: query.originId } : {},
        query.destinationId ? { destinationId: query.destinationId } : {},
        query.status ? { status: query.status } : {},
        query.settlementStatus
          ? { settlementStatus: query.settlementStatus }
          : {},
        query.reservationStatus
          ? { reservationStatus: query.reservationStatus }
          : {},
        query.serviceKind
          ? { services: { some: { kind: query.serviceKind } } }
          : {},
        query.currencyCode
          ? {
              priceComponents: {
                some: { currencyCode: query.currencyCode.toUpperCase() },
              },
            }
          : {},
        query.createdFrom || query.createdTo
          ? {
              createdAt: {
                ...(query.createdFrom
                  ? { gte: startOfDay(query.createdFrom) }
                  : {}),
                ...(query.createdTo ? { lte: endOfDay(query.createdTo) } : {}),
              },
            }
          : {},
        query.travelFrom || query.travelTo
          ? {
              departureDate: {
                ...(query.travelFrom
                  ? { gte: startOfDay(query.travelFrom) }
                  : {}),
                ...(query.travelTo ? { lte: endOfDay(query.travelTo) } : {}),
              },
            }
          : {},
      ],
    };
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [data, total] = await Promise.all([
      this.database.client.salesContract.findMany({
        where,
        include: salesDetailInclude,
        orderBy: { [sortBy]: sortDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.client.salesContract.count({ where }),
    ]);
    return { data, page, pageSize, total };
  }

  dashboardRows(
    where: Prisma.SalesContractWhereInput,
  ): Promise<SalesContractRow[]> {
    return this.database.client.salesContract.findMany({
      where,
      include: salesDetailInclude,
    });
  }

  async create(
    input: SalesContractCreateRequest,
    customerNameSnapshot: string,
    idempotencyKey: string,
    fingerprint: string,
    actor: SalesActorContext,
  ): Promise<SalesContractRow> {
    const id = await this.database.client.$transaction(
      async (tx) => {
        const [sequence] = await tx.$queryRaw<
          Array<{ value: bigint }>
        >`SELECT nextval('sales_contract_number_seq') AS value`;
        if (!sequence)
          throw new Error('Sales contract sequence did not return a value.');
        const contractNumber = `SC-${new Date().getUTCFullYear()}-${sequence.value.toString().padStart(6, '0')}`;
        const contract = await tx.salesContract.create({
          data: {
            contractNumber,
            branchId: actor.branchId,
            ownerUserId: actor.userId,
            assignedUserId: input.assignedUserId ?? null,
            customerId: input.customerId,
            payerCustomerId: input.payerCustomerId ?? input.customerId,
            customerNameSnapshot,
            tripType: input.tripType,
            originId: input.originId,
            destinationId: input.destinationId,
            departureDate: startOfDay(input.departureDate),
            returnNotBefore: input.returnNotBefore
              ? startOfDay(input.returnNotBefore)
              : null,
            fxRate: input.fxSnapshot?.rate ?? null,
            fxSource: input.fxSnapshot?.source ?? null,
            fxObservedAt: input.fxSnapshot
              ? new Date(input.fxSnapshot.observedAt)
              : null,
            pricingNotes: input.pricingNotes ?? null,
            createIdempotencyKey: idempotencyKey,
            createRequestFingerprint: fingerprint,
          },
        });
        const serviceIds = new Map<string, string>();
        for (const service of input.services) {
          const created = await tx.salesContractService.create({
            data: {
              contractId: contract.id,
              clientKey: service.clientKey,
              kind: service.kind,
              referenceId: service.referenceId ?? null,
              titleSnapshot: service.titleSnapshot,
              status: service.status ?? 'SELECTED',
              metadata: service.metadata
                ? json(service.metadata)
                : Prisma.JsonNull,
            },
          });
          serviceIds.set(service.clientKey, created.id);
        }
        for (const passenger of input.passengers) {
          const created = await tx.salesContractPassenger.create({
            data: {
              contractId: contract.id,
              customerId: passenger.customerId,
              displayNameSnapshot: passenger.displayNameSnapshot,
              birthDate: startOfDay(passenger.birthDate),
              ageCategory: passengerAgeCategory(
                passenger.birthDate,
                input.departureDate,
              ),
            },
          });
          await tx.salesPassengerServiceAllocation.createMany({
            data: passenger.serviceClientKeys.map((key) => ({
              passengerId: created.id,
              serviceId: serviceIds.get(key)!,
            })),
          });
        }
        for (const ticket of input.ticketSelections ?? [])
          await tx.salesContractTicketSelection.create({
            data: {
              contractId: contract.id,
              serviceId: serviceIds.get(ticket.serviceClientKey)!,
              direction: ticket.direction,
              offerId: ticket.offerId,
              originId: ticket.originId,
              destinationId: ticket.destinationId,
              departureAt: new Date(ticket.departureAt),
              arrivalAt: new Date(ticket.arrivalAt),
              carrierNameSnapshot: ticket.carrierNameSnapshot,
              serviceNumberSnapshot: ticket.serviceNumberSnapshot,
              cabinClassCode: ticket.cabinClassCode,
              quotedAmount: ticket.quotedPrice.amount,
              quotedCurrencyCode: ticket.quotedPrice.currencyCode.toUpperCase(),
            },
          });
        if (input.hotelSelection) {
          const hotel = input.hotelSelection;
          await tx.salesContractHotelSelection.create({
            data: {
              contractId: contract.id,
              serviceId: serviceIds.get(hotel.serviceClientKey)!,
              hotelId: hotel.hotelId,
              hotelNameSnapshot: hotel.hotelNameSnapshot,
              cityId: hotel.cityId,
              checkInDate: startOfDay(hotel.checkInDate),
              checkOutDate: startOfDay(hotel.checkOutDate),
              roomCount: hotel.roomCount,
              roomTypeId: hotel.roomTypeId,
              mealServiceId: hotel.mealServiceId ?? null,
              occupancy: hotel.occupancy,
              inventoryStatus: hotel.inventoryStatus,
            },
          });
        }
        await tx.salesContractPriceComponent.createMany({
          data: input.priceComponents.map((item) => ({
            contractId: contract.id,
            type: item.type,
            title: item.title,
            amount: item.amount,
            currencyCode: item.currencyCode.toUpperCase(),
          })),
        });
        for (const [index, payment] of (input.payments ?? []).entries())
          await tx.salesContractPaymentEntry.create({
            data: {
              contractId: contract.id,
              amount: payment.amount,
              currencyCode: payment.currencyCode.toUpperCase(),
              dueAt: new Date(payment.dueAt),
              method: payment.method,
              status:
                payment.dueAt > new Date().toISOString()
                  ? 'SCHEDULED'
                  : 'PENDING_FINANCE_CONFIRMATION',
              description: payment.description ?? null,
              paymentReference: payment.paymentReference ?? null,
              bankId: payment.check?.bankId ?? null,
              checkSecureIdentifier: payment.check?.secureIdentifier ?? null,
              checkOwnerName: payment.check?.ownerName ?? null,
              checkDueDate: payment.check
                ? startOfDay(payment.check.dueDate)
                : null,
              idempotencyKey: `${idempotencyKey}:payment:${index}`,
              requestFingerprint: fingerprint,
              createdByUserId: actor.userId,
            },
          });
        await tx.salesContractStatusHistory.create({
          data: {
            contractId: contract.id,
            toStatus: 'DRAFT',
            reason: 'ایجاد قرارداد',
            changedByUserId: actor.userId,
          },
        });
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: contract.id,
            actorUserId: actor.userId,
            actorBranchId: actor.branchId,
            action: 'sales.contract.created',
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: json({
              contractNumber,
              customerId: input.customerId,
              serviceKinds: input.services.map(({ kind }) => kind),
            }),
            traceId: actor.traceId ?? null,
          },
        });
        return contract.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return (await this.findById(id))!;
  }

  async updateDraft(
    id: string,
    input: SalesContractCreateRequest,
    version: number,
    customerNameSnapshot: string,
    actor: SalesActorContext,
  ): Promise<boolean> {
    return this.database.client.$transaction(
      async (tx) => {
        const changed = await tx.salesContract.updateMany({
          where: {
            id,
            version,
            status: { in: ['DRAFT', 'PENDING_CONFIRMATION'] },
          },
          data: {
            customerId: input.customerId,
            payerCustomerId: input.payerCustomerId ?? input.customerId,
            customerNameSnapshot,
            assignedUserId: input.assignedUserId ?? null,
            tripType: input.tripType,
            originId: input.originId,
            destinationId: input.destinationId,
            departureDate: startOfDay(input.departureDate),
            returnNotBefore: input.returnNotBefore
              ? startOfDay(input.returnNotBefore)
              : null,
            fxRate: input.fxSnapshot?.rate ?? null,
            fxSource: input.fxSnapshot?.source ?? null,
            fxObservedAt: input.fxSnapshot
              ? new Date(input.fxSnapshot.observedAt)
              : null,
            pricingNotes: input.pricingNotes ?? null,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) return false;
        await tx.salesContractHotelSelection.deleteMany({
          where: { contractId: id },
        });
        await tx.salesContractTicketSelection.deleteMany({
          where: { contractId: id },
        });
        await tx.salesPassengerServiceAllocation.deleteMany({
          where: { passenger: { contractId: id } },
        });
        await tx.salesContractPassenger.deleteMany({
          where: { contractId: id },
        });
        await tx.salesContractService.deleteMany({ where: { contractId: id } });
        await tx.salesContractPriceComponent.deleteMany({
          where: { contractId: id },
        });
        const serviceIds = new Map<string, string>();
        for (const service of input.services) {
          const created = await tx.salesContractService.create({
            data: {
              contractId: id,
              clientKey: service.clientKey,
              kind: service.kind,
              referenceId: service.referenceId ?? null,
              titleSnapshot: service.titleSnapshot,
              status: service.status ?? 'SELECTED',
              metadata: service.metadata
                ? json(service.metadata)
                : Prisma.JsonNull,
            },
          });
          serviceIds.set(service.clientKey, created.id);
        }
        for (const passenger of input.passengers) {
          const created = await tx.salesContractPassenger.create({
            data: {
              contractId: id,
              customerId: passenger.customerId,
              displayNameSnapshot: passenger.displayNameSnapshot,
              birthDate: startOfDay(passenger.birthDate),
              ageCategory: passengerAgeCategory(
                passenger.birthDate,
                input.departureDate,
              ),
            },
          });
          await tx.salesPassengerServiceAllocation.createMany({
            data: passenger.serviceClientKeys.map((key) => ({
              passengerId: created.id,
              serviceId: serviceIds.get(key)!,
            })),
          });
        }
        for (const ticket of input.ticketSelections ?? [])
          await tx.salesContractTicketSelection.create({
            data: {
              contractId: id,
              serviceId: serviceIds.get(ticket.serviceClientKey)!,
              direction: ticket.direction,
              offerId: ticket.offerId,
              originId: ticket.originId,
              destinationId: ticket.destinationId,
              departureAt: new Date(ticket.departureAt),
              arrivalAt: new Date(ticket.arrivalAt),
              carrierNameSnapshot: ticket.carrierNameSnapshot,
              serviceNumberSnapshot: ticket.serviceNumberSnapshot,
              cabinClassCode: ticket.cabinClassCode,
              quotedAmount: ticket.quotedPrice.amount,
              quotedCurrencyCode: ticket.quotedPrice.currencyCode.toUpperCase(),
            },
          });
        if (input.hotelSelection) {
          const hotel = input.hotelSelection;
          await tx.salesContractHotelSelection.create({
            data: {
              contractId: id,
              serviceId: serviceIds.get(hotel.serviceClientKey)!,
              hotelId: hotel.hotelId,
              hotelNameSnapshot: hotel.hotelNameSnapshot,
              cityId: hotel.cityId,
              checkInDate: startOfDay(hotel.checkInDate),
              checkOutDate: startOfDay(hotel.checkOutDate),
              roomCount: hotel.roomCount,
              roomTypeId: hotel.roomTypeId,
              mealServiceId: hotel.mealServiceId ?? null,
              occupancy: hotel.occupancy,
              inventoryStatus: hotel.inventoryStatus,
            },
          });
        }
        await tx.salesContractPriceComponent.createMany({
          data: input.priceComponents.map((item) => ({
            contractId: id,
            type: item.type,
            title: item.title,
            amount: item.amount,
            currencyCode: item.currencyCode.toUpperCase(),
          })),
        });
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: actor.branchId,
            action: 'sales.contract.updated',
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: json({
              version: version + 1,
              customerId: input.customerId,
            }),
            traceId: actor.traceId ?? null,
          },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async addPayment(
    contractId: string,
    input: SalesPaymentCreateRequest,
    idempotencyKey: string,
    fingerprint: string,
    actor: SalesActorContext,
  ): Promise<'created' | 'replayed' | 'conflict' | 'concurrent'> {
    return this.database.client.$transaction(
      async (tx) => {
        const existing = await tx.salesContractPaymentEntry.findUnique({
          where: { contractId_idempotencyKey: { contractId, idempotencyKey } },
        });
        if (existing)
          return existing.requestFingerprint === fingerprint
            ? 'replayed'
            : 'conflict';
        const changed = await tx.salesContract.updateMany({
          where: {
            id: contractId,
            version: input.version,
            status: { not: 'CANCELLED' },
          },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1) return 'concurrent';
        await tx.salesContractPaymentEntry.create({
          data: {
            contractId,
            amount: input.amount,
            currencyCode: input.currencyCode.toUpperCase(),
            dueAt: new Date(input.dueAt),
            method: input.method,
            status:
              input.dueAt > new Date().toISOString()
                ? 'SCHEDULED'
                : 'PENDING_FINANCE_CONFIRMATION',
            description: input.description ?? null,
            paymentReference: input.paymentReference ?? null,
            bankId: input.check?.bankId ?? null,
            checkSecureIdentifier: input.check?.secureIdentifier ?? null,
            checkOwnerName: input.check?.ownerName ?? null,
            checkDueDate: input.check ? startOfDay(input.check.dueDate) : null,
            idempotencyKey,
            requestFingerprint: fingerprint,
            createdByUserId: actor.userId,
          },
        });
        await tx.salesContractAuditEvent.create({
          data: {
            contractId,
            actorUserId: actor.userId,
            actorBranchId: actor.branchId,
            action: 'sales.payment.submitted_to_finance',
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: json({
              amount: input.amount,
              currencyCode: input.currencyCode,
              method: input.method,
            }),
            traceId: actor.traceId ?? null,
          },
        });
        return 'created';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transition(
    id: string,
    version: number,
    fromStatuses: SalesContractStatus[],
    toStatus: SalesContractStatus,
    reason: string,
    actor: SalesActorContext,
    idempotencyKey?: string,
    fingerprint?: string,
    reservationSnapshot?: Prisma.InputJsonValue,
    reservationRequestId?: string,
  ): Promise<boolean> {
    return this.database.client.$transaction(
      async (tx) => {
        const changed = await tx.salesContract.updateMany({
          where: { id, version, status: { in: fromStatuses } },
          data: {
            status: toStatus,
            ...(toStatus === 'SENT_TO_RESERVATIONS'
              ? {
                  reservationStatus: 'QUEUED' as const,
                  confirmedAt: new Date(),
                }
              : {}),
            ...(toStatus === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
            ...(idempotencyKey
              ? { confirmIdempotencyKey: idempotencyKey }
              : {}),
            ...(fingerprint ? { confirmRequestFingerprint: fingerprint } : {}),
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) return false;
        if (reservationSnapshot && idempotencyKey && fingerprint)
          await tx.salesReservationRequest.create({
            data: {
              ...(reservationRequestId ? { id: reservationRequestId } : {}),
              contractId: id,
              contractVersion: version + 1,
              idempotencyKey,
              requestFingerprint: fingerprint,
              snapshot: reservationSnapshot,
              createdByUserId: actor.userId,
            },
          });
        await tx.salesContractStatusHistory.create({
          data: {
            contractId: id,
            fromStatus: fromStatuses[0] ?? null,
            toStatus,
            reason,
            changedByUserId: actor.userId,
          },
        });
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: actor.branchId,
            action:
              toStatus === 'CANCELLED'
                ? 'sales.contract.cancelled'
                : 'sales.reservation_request.queued',
            outcome: AuditOutcome.SUCCESS,
            afterSnapshot: json({ status: toStatus, version: version + 1 }),
            traceId: actor.traceId ?? null,
          },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async applyFinanceConfirmation(event: {
    contractId: string;
    paymentId: string;
    financePaymentReference: string;
    financeConfirmationId: string;
    confirmedAt: string;
  }): Promise<'confirmed' | 'replayed' | 'not-found'> {
    return this.database.client.$transaction(
      async (tx) => {
        const payment = await tx.salesContractPaymentEntry.findFirst({
          where: { id: event.paymentId, contractId: event.contractId },
        });
        if (!payment) return 'not-found';
        if (payment.financeConfirmedByRef) return 'replayed';
        await tx.salesContractPaymentEntry.update({
          where: { id: payment.id },
          data: {
            status: 'FINANCE_CONFIRMED',
            financePaymentReference: event.financePaymentReference,
            financeConfirmedByRef: event.financeConfirmationId,
            financeConfirmedAt: new Date(event.confirmedAt),
          },
        });
        const [components, payments] = await Promise.all([
          tx.salesContractPriceComponent.findMany({
            where: { contractId: event.contractId },
          }),
          tx.salesContractPaymentEntry.findMany({
            where: { contractId: event.contractId },
          }),
        ]);
        const balances = calculateSalesBalances(
          components.map((item) => ({
            type: item.type,
            title: item.title,
            amount: item.amount.toString(),
            currencyCode: item.currencyCode,
          })),
          payments.map((item) => ({
            amount: item.amount.toString(),
            currencyCode: item.currencyCode,
            status: item.status,
          })),
        );
        const hasPaid = balances.some(
          ({ confirmedPaid }) => confirmedPaid !== '0',
        );
        const hasOutstanding = balances.some(
          ({ outstanding }) =>
            outstanding !== '0' && !outstanding.startsWith('-'),
        );
        const hasOverpaid = balances.some(({ outstanding }) =>
          outstanding.startsWith('-'),
        );
        await tx.salesContract.update({
          where: { id: event.contractId },
          data: {
            settlementStatus: hasOverpaid
              ? 'OVERPAID'
              : !hasOutstanding
                ? 'SETTLED'
                : hasPaid
                  ? 'PARTIALLY_SETTLED'
                  : 'UNPAID',
            version: { increment: 1 },
          },
        });
        return 'confirmed';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  audit(contractId: string) {
    return this.database.client.salesContractAuditEvent.findMany({
      where: { contractId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  history(contractId: string) {
    return this.database.client.salesContractStatusHistory.findMany({
      where: { contractId },
      orderBy: { changedAt: 'desc' },
    });
  }
}
