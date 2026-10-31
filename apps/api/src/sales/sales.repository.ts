import { captureSalesContractAccounting } from '../finance/accounting/sales-contract-accounting.public';
import {
  SalesReceiptAccountsPublic,
  salesReceiptDestination,
} from '../finance/payments/sales-receipt-accounts.public';
import { assertRevenueEditable } from '../finance/accounting/accounting-workflows.public';
import { recalculateSalesSettlement } from './sales-financial-settlement';
import {
  recordFinancialEvent,
  financialDate,
} from '../finance/accounting/financial-event.public';
import { salesHotelRoomSummary } from '@nora/contracts';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import type {
  SalesContractCreateRequest,
  SalesContractListQuery,
  SalesPaymentCreateRequest,
} from '@nora/contracts';
import { AuditOutcome, Prisma, type SalesContractStatus } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { salesFingerprint, contractPassengerAgeCategory } from './sales.domain';
import {
  allocateSalesContractNumber,
  retrySalesContractCreate,
} from './sales-contract-number';

export const salesDetailInclude = {
  passengers: {
    include: {
      agreedPrices: { orderBy: { currencyCode: 'asc' } },
      allocations: { include: { service: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  services: { orderBy: { createdAt: 'asc' } },
  ticketSelections: { orderBy: { departureAt: 'asc' } },
  hotelSelection: {
    include: {
      rooms: { orderBy: { ordinal: 'asc' } },
      additionalStays: {
        orderBy: { ordinal: 'asc' },
        include: { rooms: { orderBy: { ordinal: 'asc' } } },
      },
    },
  },
  priceComponents: { orderBy: { createdAt: 'asc' } },
  payments: {
    include: { refunds: true, allocations: true },
    orderBy: { createdAt: 'asc' },
  },
  receiptAllocations: true,
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
    @Optional()
    @Inject(SalesBuyerContactCrypto)
    private readonly buyerCrypto?: SalesBuyerContactCrypto,
    @Optional()
    @Inject(SalesReceiptAccountsPublic)
    private readonly receiptAccounts?: SalesReceiptAccountsPublic,
  ) {}

  findById(id: string): Promise<SalesContractRow | null> {
    return this.database.client.salesContract.findUnique({
      where: { id },
      include: salesDetailInclude,
    });
  }

  assistantConfirmedContracts(
    ids: readonly string[],
    branchIds: readonly string[],
    now: Date,
  ) {
    return this.database.client.salesContract.findMany({
      where: {
        id: { in: [...ids] },
        branchId: { in: [...branchIds] },
        confirmedAt: { not: null, lte: now },
        status: {
          in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
        },
      },
      select: { id: true, confirmedAt: true, updatedAt: true },
    });
  }

  findUserDisplayNames(userIds: readonly string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return this.database.client.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, displayName: true },
    });
  }

  amendedContractIds(contractIds: readonly string[]) {
    if (!contractIds.length) return Promise.resolve([]);
    return this.database.client.salesContractAuditEvent.findMany({
      where: {
        contractId: { in: [...contractIds] },
        outcome: 'SUCCESS',
        OR: [
          { action: 'OPERATIONAL_FORM_AMENDMENT' },
          {
            action: 'sales.contract.updated',
            afterSnapshot: { path: ['correction'], equals: 'CONTRACT' },
          },
          {
            action: 'sales.contract.updated',
            afterSnapshot: { path: ['correction'], equals: 'PARTY' },
          },
        ],
      },
      select: { contractId: true },
      distinct: ['contractId'],
    });
  }

  confirmedFinancePayments(
    branchIds: readonly string[],
    after: object,
    take: number,
    requestId?: string,
  ) {
    return this.database.client.salesContractPaymentEntry.findMany({
      where: {
        status: 'FINANCE_CONFIRMED',
        financeConfirmedAt: { not: null },
        contract: { branchId: { in: [...branchIds] } },
        ...(requestId ? { id: requestId } : {}),
        ...after,
      },
      include: {
        contract: {
          select: { contractNumber: true, customerId: true, createdAt: true },
        },
      },
      orderBy: [{ financeConfirmedAt: 'desc' }, { id: 'desc' }],
      take,
    });
  }

  financeReceipt(
    paymentId: string,
    contractId: string,
    branchIds: readonly string[],
  ) {
    return this.database.client.salesContractPaymentEntry.findFirst({
      where: {
        id: paymentId,
        contractId,
        contract: { branchId: { in: [...branchIds] } },
      },
      select: {
        id: true,
        contractId: true,
        status: true,
        dueAt: true,
        currencyCode: true,
        financeReceiptAccountId: true,
        destinationAccountId: true,
        contract: { select: { branchId: true } },
      },
    });
  }

  pendingFinancePayments(branchIds: readonly string[]) {
    if (!branchIds.length) return Promise.resolve([]);
    return this.database.client.salesContractPaymentEntry.findMany({
      where: {
        OR: [
          { status: 'PENDING_FINANCE_CONFIRMATION' },
          { status: 'SCHEDULED', dueAt: { lte: new Date() } },
        ],
        contract: { branchId: { in: [...branchIds] } },
      },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            customerId: true,
            customerNameSnapshot: true,
            branchId: true,
            version: true,
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
  }

  customerDocumentDeliveryCandidates(
    branchIds: readonly string[],
    contractNumber?: string,
  ) {
    if (!branchIds.length) return Promise.resolve([]);
    const query = contractNumber?.trim();
    return this.database.client.salesContract.findMany({
      where: {
        branchId: { in: [...branchIds] },
        ...(query
          ? {
              contractNumber: {
                contains: query,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      select: {
        id: true,
        contractNumber: true,
        branchId: true,
        ownerUserId: true,
        customerNameSnapshot: true,
        receiptAllocations: {
          select: { amount: true, currencyCode: true, reversalOfId: true },
        },
        settlementStatus: true,
        payments: {
          where: { status: 'FINANCE_CONFIRMED' },
          select: {
            id: true,
            amount: true,
            refunds: { select: { amount: true } },
            allocations: { select: { amount: true, reversalOfId: true } },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
  }

  financeCustomerDocumentDeliveryFacts(
    contractId: string,
    branchIds: readonly string[],
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.database.client).salesContract.findFirst({
      where: { id: contractId, branchId: { in: [...branchIds] } },
      select: {
        id: true,
        branchId: true,
        ownerUserId: true,
        receiptAllocations: {
          select: { amount: true, currencyCode: true, reversalOfId: true },
        },
        settlementStatus: true,
        status: true,
        payments: {
          where: { status: 'FINANCE_CONFIRMED' },
          select: {
            id: true,
            amount: true,
            refunds: { select: { amount: true } },
            allocations: { select: { amount: true, reversalOfId: true } },
          },
        },
      },
    });
  }
  pendingReservationRequests() {
    return this.database.client.salesReservationRequest.findMany({
      where: {
        dispatchedAt: null,
        contract: { status: 'SENT_TO_RESERVATIONS' },
      },
      include: { contract: { select: { branchId: true, ownerUserId: true } } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  acknowledgeReservationRequest(id: string, externalReference: string) {
    return this.database.client.$transaction(async (tx) => {
      const request = await tx.salesReservationRequest.findUniqueOrThrow({
        where: { id },
      });
      const changed = await tx.salesReservationRequest.updateMany({
        where: { id, dispatchedAt: null },
        data: {
          dispatchedAt: new Date(),
          status: 'ACCEPTED',
          externalReference,
        },
      });
      if (changed.count)
        await tx.salesContract.updateMany({
          where: { id: request.contractId, status: 'SENT_TO_RESERVATIONS' },
          data: { reservationStatus: 'ACCEPTED', version: { increment: 1 } },
        });
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
    searchPaymentReferences = false,
    exportLimit?: number,
  ) {
    const where: Prisma.SalesContractWhereInput = {
      AND: [
        whereScope,
        query.search
          ? {
              OR: [
                ...(searchPaymentReferences
                  ? [
                      {
                        payments: {
                          some: {
                            paymentReference: {
                              contains: query.search.trim(),
                              mode: 'insensitive' as const,
                            },
                          },
                        },
                      },
                    ]
                  : []),
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
                {
                  services: {
                    some: {
                      metadata: {
                        path: ['contractNotice'],
                        string_contains: query.search,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
            }
          : {},
        query.branchId ? { branchId: query.branchId } : {},
        query.ownerUserId ? { ownerUserId: query.ownerUserId } : {},
        query.originId ? { originId: query.originId } : {},
        query.destinationId ? { destinationId: query.destinationId } : {},
        query.status
          ? { status: query.status }
          : { status: { not: 'CANCELLED' } },
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
    // Date-filtered contract lists are intentionally expanded for operational review.
    // The regular list remains capped to keep the default dashboard responsive.
    const pageSize = Math.min(
      query.createdFrom || query.createdTo || query.travelFrom || query.travelTo
        ? 10_000
        : 100,
      Math.max(1, query.pageSize ?? 20),
    );
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    if (exportLimit) {
      const data = await this.database.client.salesContract.findMany({
        where,
        include: salesDetailInclude,
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        take: exportLimit + 1,
      });
      return { data, total: data.length, page: 1, pageSize: exportLimit };
    }
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

  private buyerContactJson(
    input: NonNullable<SalesContractCreateRequest['buyerContact']>,
  ): Prisma.InputJsonValue {
    if (!this.buyerCrypto)
      throw new InternalServerErrorException(
        'Buyer contact encryption is unavailable.',
      );
    return json(this.buyerCrypto.protect(input));
  }

  async create(
    input: SalesContractCreateRequest,
    customerNameSnapshot: string,
    idempotencyKey: string,
    fingerprint: string,
    actor: SalesActorContext,
  ): Promise<SalesContractRow> {
    const id = await retrySalesContractCreate(() =>
      this.database.client.$transaction(
        async (tx) => {
          const contractNumber = await allocateSalesContractNumber(tx);
          const contract = await tx.salesContract.create({
            data: {
              contractNumber,
              branchId: actor.branchId,
              ownerUserId: actor.userId,
              assignedUserId: input.assignedUserId ?? null,
              customerId: input.customerId,
              payerCustomerId: input.payerCustomerId ?? input.customerId,
              customerNameSnapshot:
                input.buyerContact?.name.trim() ?? customerNameSnapshot,
              buyerContact: input.buyerContact
                ? this.buyerContactJson(input.buyerContact)
                : Prisma.DbNull,
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
              paymentTerms: input.paymentTerms
                ? json(input.paymentTerms)
                : Prisma.DbNull,
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
                pricing: service.pricing
                  ? json(service.pricing)
                  : Prisma.DbNull,
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
                accommodationKind: passenger.accommodationKind ?? null,
                childAgeBand: passenger.childAgeBand ?? null,
                agreedPrices: { create: [...(passenger.agreedPrices ?? [])] },
                displayNameSnapshot: passenger.displayNameSnapshot,
                birthDate: passenger.birthDate
                  ? startOfDay(passenger.birthDate)
                  : null,
                ageCategory: contractPassengerAgeCategory(
                  passenger,
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
                quotedAmount: ticket.quotedPrice?.amount ?? null,
                quotedCurrencyCode:
                  ticket.quotedPrice?.currencyCode.toUpperCase() ?? null,
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
                singleRoomCount: hotel.singleRoomCount ?? 0,
                doubleRoomCount: hotel.doubleRoomCount ?? hotel.roomCount,
                extraBedCount: hotel.extraBedCount ?? 0,
                ...(hotel.rooms?.length
                  ? salesHotelRoomSummary(hotel.rooms)
                  : {}),
                roomTypeId: hotel.roomTypeId,
                ...(hotel.rooms?.length
                  ? {
                      rooms: {
                        create: hotel.rooms.map((room) => ({
                          ordinal: room.ordinal,
                          roomTypeId: room.roomTypeId,
                          roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                          ...(room.roomCategory
                            ? { roomCategory: room.roomCategory }
                            : {}),
                          adults: room.adults,
                          childAges: [...room.childAges],
                          ...(room.agreedPrice
                            ? { agreedPrice: { ...room.agreedPrice } }
                            : {}),
                        })),
                      },
                    }
                  : {}),
                mealServiceId: hotel.mealServiceId ?? null,
                occupancy: hotel.occupancy,
                inventoryStatus: hotel.inventoryStatus,
                additionalStays: {
                  create: (hotel.additionalStays ?? []).map((stay, index) => ({
                    ordinal: index + 2,
                    hotelId: stay.hotelId,
                    cityId: stay.cityId,
                    hotelNameSnapshot: stay.hotelNameSnapshot,
                    rooms: {
                      create: (stay.rooms ?? []).map((room) => ({
                        ordinal: room.ordinal,
                        roomTypeId: room.roomTypeId,
                        roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                        adults: room.adults,
                        childAges: [...room.childAges],
                        roomCategory: room.roomCategory ?? null,
                      })),
                    },
                    checkInDate: startOfDay(stay.checkInDate),
                    checkOutDate: startOfDay(stay.checkOutDate),
                  })),
                },
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
          for (const [index, payment] of (input.payments ?? []).entries()) {
            const destination = await salesReceiptDestination(
              tx,
              payment,
              actor.branchId,
            );
            await tx.salesContractPaymentEntry.create({
              data: {
                ...destination,
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
          }
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
      ),
    );
    return (await this.findById(id))!;
  }

  async updateDraft(
    id: string,
    input: SalesContractCreateRequest,
    version: number,
    customerNameSnapshot: string,
    actor: SalesActorContext,
    amendment?: {
      categories: Readonly<Record<string, 'ADT' | 'CHD' | 'INF'>>;
      previousStatus?: SalesContractStatus;
      snapshot: Prisma.InputJsonValue | undefined;
      requestId: string;
      reason: string;
      before: Prisma.InputJsonValue;
      reserve: (tx: Prisma.TransactionClient) => Promise<void>;
    },
  ): Promise<boolean> {
    return this.database.client.$transaction(
      async (tx) => {
        await assertRevenueEditable(tx, id, [actor.branchId]);
        const changed = await tx.salesContract.updateMany({
          where: {
            id,
            version,
            OR: [
              { customerId: input.customerId },
              {
                receiptAllocations: {
                  none: { reversalOfId: null, reversal: null },
                },
                payments: {
                  none: {
                    allocations: {
                      some: { reversalOfId: null, reversal: null },
                    },
                  },
                },
              },
            ],
            status: amendment
              ? { not: 'CANCELLED' }
              : { in: ['DRAFT', 'PENDING_CONFIRMATION'] },
          },
          data: {
            ...(amendment?.snapshot
              ? {
                  reservationStatus: 'QUEUED' as const,
                  status: 'SENT_TO_RESERVATIONS' as const,
                }
              : {}),
            customerId: input.customerId,
            payerCustomerId: input.payerCustomerId ?? input.customerId,
            customerNameSnapshot:
              input.buyerContact?.name.trim() ?? customerNameSnapshot,
            ...(input.buyerContact !== undefined
              ? {
                  buyerContact: input.buyerContact
                    ? this.buyerContactJson(input.buyerContact)
                    : Prisma.DbNull,
                }
              : {}),
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
            ...(input.paymentTerms !== undefined
              ? {
                  paymentTerms: input.paymentTerms
                    ? json(input.paymentTerms)
                    : Prisma.DbNull,
                }
              : {}),
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) return false;
        if (amendment) await amendment.reserve(tx);
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
              pricing: service.pricing ? json(service.pricing) : Prisma.DbNull,
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
              accommodationKind: passenger.accommodationKind ?? null,
              childAgeBand: passenger.childAgeBand ?? null,
              agreedPrices: { create: [...(passenger.agreedPrices ?? [])] },
              displayNameSnapshot: passenger.displayNameSnapshot,
              birthDate: passenger.birthDate
                ? startOfDay(passenger.birthDate)
                : null,
              ageCategory:
                amendment?.categories[passenger.customerId] ??
                contractPassengerAgeCategory(passenger, input.departureDate),
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
              quotedAmount: ticket.quotedPrice?.amount ?? null,
              quotedCurrencyCode:
                ticket.quotedPrice?.currencyCode.toUpperCase() ?? null,
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
              singleRoomCount: hotel.singleRoomCount ?? 0,
              doubleRoomCount: hotel.doubleRoomCount ?? hotel.roomCount,
              extraBedCount: hotel.extraBedCount ?? 0,
              ...(hotel.rooms?.length
                ? salesHotelRoomSummary(hotel.rooms)
                : {}),
              roomTypeId: hotel.roomTypeId,
              ...(hotel.rooms?.length
                ? {
                    rooms: {
                      create: hotel.rooms.map((room) => ({
                        ordinal: room.ordinal,
                        roomTypeId: room.roomTypeId,
                        roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                        ...(room.roomCategory
                          ? { roomCategory: room.roomCategory }
                          : {}),
                        adults: room.adults,
                        childAges: [...room.childAges],
                        ...(room.agreedPrice
                          ? { agreedPrice: { ...room.agreedPrice } }
                          : {}),
                      })),
                    },
                  }
                : {}),
              mealServiceId: hotel.mealServiceId ?? null,
              occupancy: hotel.occupancy,
              inventoryStatus: hotel.inventoryStatus,
              additionalStays: {
                create: (hotel.additionalStays ?? []).map((stay, index) => ({
                  ordinal: index + 2,
                  hotelId: stay.hotelId,
                  cityId: stay.cityId,
                  hotelNameSnapshot: stay.hotelNameSnapshot,
                  rooms: {
                    create: (stay.rooms ?? []).map((room) => ({
                      ordinal: room.ordinal,
                      roomTypeId: room.roomTypeId,
                      roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                      adults: room.adults,
                      childAges: [...room.childAges],
                      roomCategory: room.roomCategory ?? null,
                    })),
                  },
                  checkInDate: startOfDay(stay.checkInDate),
                  checkOutDate: startOfDay(stay.checkOutDate),
                })),
              },
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
        if (amendment?.snapshot && amendment.previousStatus)
          await tx.salesContractStatusHistory.create({
            data: {
              contractId: id,
              fromStatus: amendment.previousStatus,
              toStatus: 'SENT_TO_RESERVATIONS',
              reason: amendment.reason,
              changedByUserId: actor.userId,
            },
          });
        if (amendment?.snapshot)
          await tx.salesReservationRequest.create({
            data: {
              id: amendment.requestId,
              contractId: id,
              contractVersion: version + 1,
              idempotencyKey: 'amend-' + amendment.requestId,
              requestFingerprint: salesFingerprint(amendment.snapshot),
              snapshot: amendment.snapshot,
              createdByUserId: actor.userId,
            },
          });
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: actor.branchId,
            action: 'sales.contract.updated',
            outcome: AuditOutcome.SUCCESS,
            ...(amendment ? { beforeSnapshot: amendment.before } : {}),
            afterSnapshot: json({
              version: version + 1,
              ...(amendment
                ? {
                    reason: amendment.reason,
                    correction: 'CONTRACT',
                    requestId: amendment.requestId,
                  }
                : {}),
              customerId: input.customerId,
            }),
            traceId: actor.traceId ?? null,
          },
        });
        await recalculateSalesSettlement(tx, id, actor.userId, false);
        await captureSalesContractAccounting(tx, id, actor.userId);
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  paymentAccounts(branchId: string, actorUserId: string) {
    if (!this.receiptAccounts)
      throw new InternalServerErrorException(
        'Payment account provider is unavailable.',
      );
    return this.receiptAccounts.list(branchId, actorUserId);
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
        const destination = await salesReceiptDestination(
          tx,
          input,
          actor.branchId,
        );
        await tx.salesContractPaymentEntry.create({
          data: {
            ...destination,
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
              destinationAccountId: destination.destinationAccountId ?? null,
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
        if (toStatus === 'CANCELLED')
          await assertRevenueEditable(tx, id, [actor.branchId]);
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
        await recalculateSalesSettlement(tx, id, actor.userId, false);
        if (toStatus === 'SENT_TO_RESERVATIONS')
          await captureSalesContractAccounting(tx, id, actor.userId, true);
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Public financial command: only a confirmed outgoing refund reduces settlement. */
  async applyFinanceRefund(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      operationId: string;
      actorId: string;
      amount: string;
      currency: string;
      branchId: string;
    },
  ) {
    const payment = await tx.salesContractPaymentEntry.findFirst({
      where: {
        id: input.paymentId,
        status: 'FINANCE_CONFIRMED',
        currencyCode: input.currency,
        contract: { branchId: input.branchId },
      },
    });
    if (!payment)
      throw new InternalServerErrorException(
        'Confirmed refund source unavailable.',
      );
    await tx.$queryRaw`SELECT id FROM sales_contracts WHERE id=${payment.contractId}::uuid FOR UPDATE`;
    const previous = await tx.salesPaymentRefund.findUnique({
      where: { id: input.operationId },
    });
    if (previous) {
      if (
        previous.paymentId !== input.paymentId ||
        !previous.amount.eq(input.amount)
      )
        throw new InternalServerErrorException('Refund source conflict.');
      return;
    }
    const total = await tx.salesPaymentRefund.aggregate({
      where: { paymentId: payment.id },
      _sum: { amount: true },
    });
    const allocation = await tx.salesReceiptAllocation.aggregate({
      where: {
        sourcePaymentId: payment.id,
        reversalOfId: null,
        reversal: null,
      },
      _sum: { amount: true },
    });
    if (
      (total._sum.amount ?? new Prisma.Decimal(0))
        .add(input.amount)
        .add(allocation._sum.amount ?? 0)
        .gt(payment.amount)
    )
      throw new InternalServerErrorException(
        'Refund exceeds confirmed receipt.',
      );
    await tx.salesPaymentRefund.create({
      data: {
        id: input.operationId,
        paymentId: payment.id,
        amount: input.amount,
      },
    });
    await recalculateSalesSettlement(tx, payment.contractId, input.actorId);
  }

  async applyFinanceConfirmation(event: {
    contractId: string;
    paymentId: string;
    financePaymentReference: string;
    receiptAccountId: string;
    financeConfirmationId: string;
    confirmedAt: string;
    reviewedByUserId?: string;
    reason?: string;
  }): Promise<'confirmed' | 'replayed' | 'not-found'> {
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM sales_contracts WHERE id=${event.contractId}::uuid FOR UPDATE`;
        const payment = await tx.salesContractPaymentEntry.findFirst({
          where: { id: event.paymentId, contractId: event.contractId },
          include: {
            contract: {
              select: { branchId: true, customerId: true, createdAt: true },
            },
          },
        });
        if (!payment) return 'not-found';
        if (
          payment.destinationAccountId &&
          payment.destinationAccountId !== event.receiptAccountId
        )
          throw new BadRequestException(
            'حساب مقصد ثبت‌شده در پرداخت قابل تغییر نیست.',
          );
        if (payment.financeConfirmedByRef) {
          if (payment.financeReceiptAccountId !== event.receiptAccountId)
            throw new ConflictException(
              'این دریافت قبلاً در حساب دیگری تأیید شده است.',
            );
          return 'replayed';
        }
        if (
          payment.status !== 'PENDING_FINANCE_CONFIRMATION' &&
          !(payment.status === 'SCHEDULED' && payment.dueAt <= new Date())
        )
          throw new ConflictException('دریافت در وضعیت بررسی مالی نیست.');
        await tx.salesContractPaymentEntry.update({
          where: { id: payment.id },
          data: {
            status: 'FINANCE_CONFIRMED',
            financePaymentReference: event.financePaymentReference,
            financeReceiptAccountId: event.receiptAccountId,
            financeConfirmedByRef: event.financeConfirmationId,
            financeConfirmedAt: new Date(event.confirmedAt),
            financeDecisionReason: event.reason?.trim() || null,
            financeReviewedByUserId: event.reviewedByUserId ?? null,
            financeReviewedAt: new Date(event.confirmedAt),
          },
        });
        await recalculateSalesSettlement(
          tx,
          event.contractId,
          event.reviewedByUserId ?? payment.createdByUserId,
        );
        if (event.reviewedByUserId)
          await tx.salesContractAuditEvent.create({
            data: {
              contractId: event.contractId,
              actorUserId: event.reviewedByUserId,
              actorBranchId: payment.contract.branchId,
              action: 'sales.payment.finance_confirmed',
              outcome: 'SUCCESS',
              reason: event.reason?.trim() || null,
              afterSnapshot: {
                paymentId: event.paymentId,
                financePaymentReference: event.financePaymentReference,
                receiptAccountId: event.receiptAccountId,
              },
            },
          });
        await recordFinancialEvent(tx, {
          source: 'SALES',
          recordId: payment.id,
          requestId: payment.contractId,
          trackingNumber: payment.contractId,
          trackingDate: financialDate(payment.contract.createdAt),
          kind: 'CUSTOMER_RECEIPT',
          branchId: payment.contract.branchId,
          actorId: event.reviewedByUserId ?? payment.createdByUserId,
          occurredAt: new Date(event.confirmedAt),
          amount: payment.amount.toString(),
          currency: payment.currencyCode,
          settlementAccountId: event.receiptAccountId,
          partyId: payment.contract.customerId,
          reference: payment.paymentReference,
        });
        await captureSalesContractAccounting(
          tx,
          payment.contractId,
          event.reviewedByUserId ?? payment.createdByUserId,
          true,
        );
        return 'confirmed';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async applyFinanceCorrection(event: {
    contractId: string;
    paymentId: string;
    reason: string;
    reviewedByUserId: string;
    reviewedAt: string;
    branchId: string;
    traceId?: string;
  }): Promise<'corrected' | 'replayed' | 'not-found' | 'conflict'> {
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sales_contracts WHERE id=${event.contractId}::uuid FOR UPDATE`;
      const payment = await tx.salesContractPaymentEntry.findFirst({
        where: { id: event.paymentId, contractId: event.contractId },
        include: { contract: { select: { branchId: true } } },
      });
      if (!payment || payment.contract.branchId !== event.branchId)
        return 'not-found';
      if (payment.status === 'FINANCE_REJECTED') return 'replayed';
      if (
        payment.status !== 'PENDING_FINANCE_CONFIRMATION' &&
        !(payment.status === 'SCHEDULED' && payment.dueAt <= new Date())
      )
        return 'conflict';
      await tx.salesContractPaymentEntry.update({
        where: { id: payment.id },
        data: {
          status: 'FINANCE_REJECTED',
          financeDecisionReason: (event.reason ?? '').trim(),
          financeReviewedByUserId: event.reviewedByUserId,
          financeReviewedAt: new Date(event.reviewedAt),
        },
      });
      await tx.salesContractAuditEvent.create({
        data: {
          contractId: event.contractId,
          actorUserId: event.reviewedByUserId,
          actorBranchId: event.branchId,
          action: 'sales.payment.finance_correction_required',
          outcome: 'SUCCESS',
          reason: (event.reason ?? '').trim(),
          afterSnapshot: {
            paymentId: event.paymentId,
            status: 'FINANCE_REJECTED',
          },
          traceId: event.traceId ?? null,
        },
      });
      return 'corrected';
    });
  }

  recordOutputPreview(
    contractId: string,
    actor: SalesActorContext,
    snapshot: Prisma.InputJsonValue,
  ) {
    return this.database.client.salesContractAuditEvent.create({
      data: {
        contractId,
        actorUserId: actor.userId,
        actorBranchId: actor.branchId,
        action: 'sales.contract.output_preview',
        outcome: AuditOutcome.SUCCESS,
        afterSnapshot: snapshot,
        traceId: actor.traceId ?? null,
      },
    });
  }

  recordListExport(
    records: readonly { id: string; branchId: string; version: number }[],
    userId: string,
  ) {
    return this.database.client.salesContractAuditEvent.createMany({
      data: records.map((record) => ({
        contractId: record.id,
        actorUserId: userId,
        actorBranchId: record.branchId,
        action: 'sales.contract.xlsx_export',
        outcome: AuditOutcome.SUCCESS,
        afterSnapshot: { format: 'xlsx', contractVersion: record.version },
      })),
    });
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
