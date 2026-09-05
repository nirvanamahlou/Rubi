import { randomUUID } from 'node:crypto';

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
  SalesContractCreateRequest,
  SalesContractDetail,
  SalesContractListQuery,
  SalesContractSummary,
  SalesPaymentCreateRequest,
  SalesReservationRequestV1,
} from '@rubi/contracts';
import type { Prisma } from '@rubi/database';

import {
  SALES_TICKET_AVAILABILITY_PORT,
  SalesCustomersPublicAdapter,
  type SalesTicketAvailabilityPort,
} from './sales.adapters';
import {
  calculateSalesBalances,
  SalesDomainError,
  salesFingerprint,
  sumSalesDecimals,
  validateSalesContract,
  validateSalesPayment,
} from './sales.domain';
import {
  SalesRepository,
  type SalesActorContext,
  type SalesContractRow,
} from './sales.repository';

function has(actor: AuthenticatedActor, permission: string): boolean {
  return actor.permissions.includes(permission as never);
}

function branch(actor: AuthenticatedActor, requested?: string): string {
  const selected = requested ?? actor.branchIds[0];
  if (!selected || !actor.branchIds.includes(selected))
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'شعبه مجاز مشخص نشده است.',
    });
  return selected;
}

function domainCall(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (error instanceof SalesDomainError)
      throw new BadRequestException({
        code: error.code,
        message: error.message,
      });
    throw error;
  }
}

function date(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function money(value: { toString(): string }): string {
  return value.toString();
}

function paymentInput(row: SalesContractRow['payments'][number]) {
  const check =
    row.bankId &&
    row.checkSecureIdentifier &&
    row.checkOwnerName &&
    row.checkDueDate
      ? {
          bankId: row.bankId,
          secureIdentifier: row.checkSecureIdentifier,
          ownerName: row.checkOwnerName,
          dueDate: row.checkDueDate.toISOString().slice(0, 10),
        }
      : null;
  return {
    amount: money(row.amount),
    currencyCode: row.currencyCode,
    dueAt: row.dueAt.toISOString(),
    method: row.method,
    description: row.description,
    paymentReference: row.paymentReference,
    check,
  };
}

export function presentSalesContract(
  row: SalesContractRow,
): SalesContractDetail {
  const priceComponents = row.priceComponents.map((item) => ({
    type: item.type,
    title: item.title,
    amount: money(item.amount),
    currencyCode: item.currencyCode,
  }));
  const payments = row.payments.map((item) => ({
    ...paymentInput(item),
    id: item.id,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    financeConfirmedAt: date(item.financeConfirmedAt),
  }));
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    customerId: row.customerId,
    customerNameSnapshot: row.customerNameSnapshot,
    passengerNames: row.passengers.map(
      ({ displayNameSnapshot }) => displayNameSnapshot,
    ),
    ownerUserId: row.ownerUserId,
    assignedUserId: row.assignedUserId,
    branchId: row.branchId,
    originId: row.originId,
    destinationId: row.destinationId,
    departureDate: row.departureDate.toISOString().slice(0, 10),
    returnNotBefore: row.returnNotBefore?.toISOString().slice(0, 10) ?? null,
    services: [...new Set(row.services.map(({ kind }) => kind))],
    status: row.status,
    settlementStatus: row.settlementStatus,
    reservationStatus: row.reservationStatus,
    balances: calculateSalesBalances(priceComponents, payments),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tripType: row.tripType,
    payerCustomerId: row.payerCustomerId,
    servicesDetail: row.services.map((service) => ({
      clientKey: service.clientKey,
      kind: service.kind,
      referenceId: service.referenceId,
      titleSnapshot: service.titleSnapshot,
      status: service.status,
      ...(service.metadata &&
      typeof service.metadata === 'object' &&
      !Array.isArray(service.metadata)
        ? {
            metadata: service.metadata as Record<
              string,
              string | number | boolean | null
            >,
          }
        : {}),
    })),
    passengersDetail: row.passengers.map((passenger) => ({
      id: passenger.id,
      customerId: passenger.customerId,
      displayNameSnapshot: passenger.displayNameSnapshot,
      birthDate: passenger.birthDate.toISOString().slice(0, 10),
      ageCategory: passenger.ageCategory,
      serviceClientKeys: passenger.allocations.map(
        ({ service }) => service.clientKey,
      ),
    })),
    ticketSelections: row.ticketSelections.map((ticket) => ({
      serviceClientKey:
        row.services.find(({ id }) => id === ticket.serviceId)?.clientKey ?? '',
      direction: ticket.direction,
      offerId: ticket.offerId,
      originId: ticket.originId,
      destinationId: ticket.destinationId,
      departureAt: ticket.departureAt.toISOString(),
      arrivalAt: ticket.arrivalAt.toISOString(),
      carrierNameSnapshot: ticket.carrierNameSnapshot,
      serviceNumberSnapshot: ticket.serviceNumberSnapshot,
      cabinClassCode: ticket.cabinClassCode,
      ...(ticket.quotedAmount !== null && ticket.quotedCurrencyCode
        ? {
            quotedPrice: {
              amount: money(ticket.quotedAmount),
              currencyCode: ticket.quotedCurrencyCode,
            },
          }
        : {}),
    })),
    hotelSelection: row.hotelSelection
      ? {
          serviceClientKey:
            row.services.find(({ id }) => id === row.hotelSelection?.serviceId)
              ?.clientKey ?? '',
          hotelId: row.hotelSelection.hotelId,
          hotelNameSnapshot: row.hotelSelection.hotelNameSnapshot,
          cityId: row.hotelSelection.cityId,
          checkInDate: row.hotelSelection.checkInDate
            .toISOString()
            .slice(0, 10),
          checkOutDate: row.hotelSelection.checkOutDate
            .toISOString()
            .slice(0, 10),
          roomCount: row.hotelSelection.roomCount,
          roomTypeId: row.hotelSelection.roomTypeId,
          mealServiceId: row.hotelSelection.mealServiceId,
          occupancy: row.hotelSelection.occupancy,
          inventoryStatus: row.hotelSelection.inventoryStatus as
            'AVAILABLE' | 'NEEDS_RESERVATION_CONFIRMATION',
        }
      : null,
    priceComponents,
    payments,
    fxSnapshot:
      row.fxRate && row.fxSource && row.fxObservedAt
        ? {
            rate: money(row.fxRate),
            source: row.fxSource,
            observedAt: row.fxObservedAt.toISOString(),
          }
        : null,
    pricingNotes: row.pricingNotes,
  };
}

function summary(detail: SalesContractDetail): SalesContractSummary {
  return {
    id: detail.id,
    contractNumber: detail.contractNumber,
    customerId: detail.customerId,
    customerNameSnapshot: detail.customerNameSnapshot,
    passengerNames: detail.passengerNames,
    ownerUserId: detail.ownerUserId,
    assignedUserId: detail.assignedUserId,
    branchId: detail.branchId,
    originId: detail.originId,
    destinationId: detail.destinationId,
    departureDate: detail.departureDate,
    returnNotBefore: detail.returnNotBefore,
    services: detail.services,
    status: detail.status,
    settlementStatus: detail.settlementStatus,
    reservationStatus: detail.reservationStatus,
    balances: detail.balances,
    version: detail.version,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(SalesRepository) private readonly repository: SalesRepository,
    @Inject(SalesCustomersPublicAdapter)
    private readonly customers: SalesCustomersPublicAdapter,
    @Inject(SALES_TICKET_AVAILABILITY_PORT)
    private readonly tickets: SalesTicketAvailabilityPort,
  ) {}

  private assertRead(row: SalesContractRow, actor: AuthenticatedActor): void {
    if (has(actor, 'sales.contracts.read.all')) return;
    if (
      has(actor, 'sales.contracts.read.branch') &&
      actor.branchIds.includes(row.branchId)
    )
      return;
    if (
      has(actor, 'sales.contracts.read.own') &&
      actor.branchIds.includes(row.branchId) &&
      (row.ownerUserId === actor.userId || row.assignedUserId === actor.userId)
    )
      return;
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'قرارداد خارج از دامنه دسترسی است.',
    });
  }

  private assertUpdate(row: SalesContractRow, actor: AuthenticatedActor): void {
    if (
      has(actor, 'sales.contracts.update.branch') &&
      actor.branchIds.includes(row.branchId)
    )
      return;
    if (
      has(actor, 'sales.contracts.update.own') &&
      actor.branchIds.includes(row.branchId) &&
      (row.ownerUserId === actor.userId || row.assignedUserId === actor.userId)
    )
      return;
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'ویرایش فقط برای مالک/کانتر مجاز قرارداد ممکن است.',
    });
  }

  private context(
    actor: AuthenticatedActor,
    branchId: string,
    traceId?: string,
  ): SalesActorContext {
    return { userId: actor.userId, branchId, ...(traceId ? { traceId } : {}) };
  }

  async list(query: SalesContractListQuery, actor: AuthenticatedActor) {
    let scope: Prisma.SalesContractWhereInput;
    if (has(actor, 'sales.contracts.read.all')) scope = {};
    else if (has(actor, 'sales.contracts.read.branch'))
      scope = { branchId: { in: actor.branchIds } };
    else if (has(actor, 'sales.contracts.read.own'))
      scope = {
        branchId: { in: actor.branchIds },
        OR: [{ ownerUserId: actor.userId }, { assignedUserId: actor.userId }],
      };
    else
      throw new ForbiddenException({
        code: 'SALES_CONTRACT_FORBIDDEN',
        message: 'مجوز مشاهده قرارداد وجود ندارد.',
      });
    const result = await this.repository.list(query, scope);
    return {
      data: result.data.map((row) => summary(presentSalesContract(row))),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    };
  }

  async detail(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    const detail = presentSalesContract(row);
    return {
      data: has(actor, 'sales.payments.read')
        ? detail
        : { ...detail, payments: [] },
    };
  }

  async create(
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    if (!has(actor, 'sales.contracts.create'))
      throw new ForbiddenException('مجوز ایجاد قرارداد وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    domainCall(() => validateSalesContract(input));
    const fingerprint = salesFingerprint(input);
    const existing = await this.repository.findByCreateKey(
      actor.userId,
      idempotencyKey,
    );
    if (existing) {
      if (existing.createRequestFingerprint !== fingerprint)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'این کلید با درخواست متفاوت استفاده شده است.',
        });
      return {
        data: presentSalesContract(existing),
        meta: { idempotentReplay: true },
      };
    }
    const branchId = branch(actor, requestedBranch);
    const customer = await this.customers.resolveSnapshot(
      input.customerId,
      actor,
    );
    const row = await this.repository.create(
      input,
      customer.displayName,
      idempotencyKey,
      fingerprint,
      this.context(actor, branchId, traceId),
    );
    return {
      data: presentSalesContract(row),
      meta: { idempotentReplay: false },
    };
  }

  async update(
    id: string,
    input: SalesContractCreateRequest & {
      version: number;
      reason?: string | null;
    },
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    domainCall(() => validateSalesContract(input));
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertUpdate(row, actor);
    const customer = await this.customers.resolveSnapshot(
      input.customerId,
      actor,
    );
    const changed = await this.repository.updateDraft(
      id,
      input,
      input.version,
      customer.displayName,
      this.context(actor, row.branchId, traceId),
    );
    if (!changed)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده یا دیگر قابل ویرایش نیست.',
      });
    return this.detail(id, actor);
  }

  async addPayment(
    id: string,
    input: SalesPaymentCreateRequest,
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    if (!has(actor, 'sales.payments.create'))
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    domainCall(() => validateSalesPayment(input));
    const fingerprint = salesFingerprint(input);
    const result = await this.repository.addPayment(
      id,
      input,
      idempotencyKey,
      fingerprint,
      this.context(actor, row.branchId, traceId),
    );
    if (result === 'conflict')
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'کلید پرداخت با درخواست متفاوت استفاده شده است.',
      });
    if (result === 'concurrent')
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده است.',
      });
    return {
      ...(await this.detail(id, actor)),
      meta: { idempotentReplay: result === 'replayed' },
    };
  }

  async confirm(
    id: string,
    version: number,
    reason: string | null | undefined,
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    if (
      !has(actor, 'sales.contracts.confirm') ||
      !has(actor, 'sales.reservation_request.create')
    )
      throw new ForbiddenException('مجوز تأیید و ارسال رزرو وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    const fingerprint = salesFingerprint({ id, version });
    if (row.confirmIdempotencyKey === idempotencyKey) {
      if (row.confirmRequestFingerprint !== fingerprint)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'کلید تأیید با درخواست متفاوت استفاده شده است.',
        });
      return {
        data: presentSalesContract(row),
        meta: { idempotentReplay: true },
      };
    }
    const ticketCheck = await this.tickets.revalidate(
      row.ticketSelections.map(({ offerId }) => offerId),
      row.branchId,
      presentSalesContract(row).ticketSelections,
    );
    if (!ticketCheck.available)
      throw new ConflictException({
        code: 'TICKET_NOT_AVAILABLE',
        message:
          'Public API کاتالوگ بلیت در دسترس نیست یا پیشنهاد منقضی شده است.',
        unavailableOfferIds: ticketCheck.unavailableOfferIds,
      });
    const requestId = randomUUID();
    const snapshot: SalesReservationRequestV1 = {
      passengerAssignments: presentSalesContract(row).passengersDetail.map(
        (passenger) => ({
          customerId: passenger.customerId,
          ageCategory: passenger.ageCategory,
          serviceClientKeys: passenger.serviceClientKeys,
        }),
      ),
      ticketSelections: presentSalesContract(row).ticketSelections,
      version: 1,
      requestId,
      contractId: row.id,
      contractNumber: row.contractNumber,
      contractVersion: version + 1,
      customerId: row.customerId,
      passengerIds: row.passengers.map(({ customerId }) => customerId),
      serviceSelections: presentSalesContract(row).servicesDetail,
      selectedTicketOfferIds: row.ticketSelections.map(
        ({ offerId }) => offerId,
      ),
      hotelSelection: presentSalesContract(row).hotelSelection,
      createdAt: new Date().toISOString(),
    };
    const changed = await this.repository.transition(
      id,
      version,
      ['DRAFT', 'PENDING_CONFIRMATION'],
      'SENT_TO_RESERVATIONS',
      reason?.trim() || 'تأیید و ارسال خودکار درخواست رزرو',
      this.context(actor, row.branchId, traceId),
      idempotencyKey,
      fingerprint,
      snapshot as unknown as Prisma.InputJsonValue,
      requestId,
    );
    if (!changed)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده است.',
      });
    return {
      ...(await this.detail(id, actor)),
      meta: { reservationRequest: snapshot, idempotentReplay: false },
    };
  }

  async cancel(
    id: string,
    version: number,
    reason: string | null | undefined,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    if (!has(actor, 'sales.contracts.cancel'))
      throw new ForbiddenException('مجوز لغو قرارداد وجود ندارد.');
    if (!reason?.trim()) throw new BadRequestException('دلیل لغو الزامی است.');
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    const changed = await this.repository.transition(
      id,
      version,
      ['DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SENT_TO_RESERVATIONS'],
      'CANCELLED',
      reason.trim(),
      this.context(actor, row.branchId, traceId),
    );
    if (!changed)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده یا قابل لغو نیست.',
      });
    return this.detail(id, actor);
  }

  async audit(id: string, actor: AuthenticatedActor) {
    if (!has(actor, 'sales.audit.read'))
      throw new ForbiddenException('مجوز مشاهده Audit وجود ندارد.');
    await this.detail(id, actor);
    return { data: await this.repository.audit(id) };
  }

  async history(id: string, actor: AuthenticatedActor) {
    await this.detail(id, actor);
    return { data: await this.repository.history(id) };
  }

  async dashboard(actor: AuthenticatedActor) {
    let scope: Prisma.SalesContractWhereInput;
    if (has(actor, 'sales.contracts.read.all')) scope = {};
    else if (has(actor, 'sales.contracts.read.branch'))
      scope = { branchId: { in: actor.branchIds } };
    else if (has(actor, 'sales.contracts.read.own'))
      scope = {
        branchId: { in: actor.branchIds },
        OR: [{ ownerUserId: actor.userId }, { assignedUserId: actor.userId }],
      };
    else
      throw new ForbiddenException({
        code: 'SALES_CONTRACT_FORBIDDEN',
        message: 'مجوز داشبورد فروش وجود ندارد.',
      });
    const rows = await this.repository.dashboardRows(scope);
    const details = rows.map(presentSalesContract);
    const today = new Date().toISOString().slice(0, 10);
    const balances = details.flatMap((item) => item.balances);
    const currencyCodes = [
      ...new Set(balances.map(({ currencyCode }) => currencyCode)),
    ];
    const byOwner = new Map<string, string[]>();
    for (const detail of details)
      for (const balance of detail.balances) {
        const key = `${detail.ownerUserId}:${balance.currencyCode}`;
        byOwner.set(key, [...(byOwner.get(key) ?? []), balance.amount]);
      }
    return {
      data: {
        todayContracts: details.filter(({ createdAt }) =>
          createdAt.startsWith(today),
        ).length,
        activeContracts: details.filter(
          ({ status }) => !['COMPLETED', 'CANCELLED'].includes(status),
        ).length,
        unpaidContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'UNPAID',
        ).length,
        partiallySettledContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'PARTIALLY_SETTLED',
        ).length,
        settledContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'SETTLED',
        ).length,
        rialSales: sumSalesDecimals(
          balances
            .filter(({ currencyCode }) => currencyCode === 'IRR')
            .map(({ amount }) => amount),
        ),
        foreignCommitments: currencyCodes
          .filter((code) => code !== 'IRR')
          .map((currencyCode) => ({
            currencyCode,
            amount: sumSalesDecimals(
              balances
                .filter((item) => item.currencyCode === currencyCode)
                .map(({ amount }) => amount),
            ),
          })),
        outstanding: currencyCodes.map((currencyCode) => ({
          currencyCode,
          amount: sumSalesDecimals(
            balances
              .filter((item) => item.currencyCode === currencyCode)
              .map(({ outstanding }) => outstanding),
          ),
        })),
        pendingFinancePayments: details
          .flatMap(({ payments }) => payments)
          .filter(({ status }) => status === 'PENDING_FINANCE_CONFIRMATION')
          .length,
        pendingReservationActions: details.filter(({ reservationStatus }) =>
          ['QUEUED', 'NEEDS_REVIEW', 'PARTIALLY_FULFILLED'].includes(
            reservationStatus,
          ),
        ).length,
        salesByCounter: [...byOwner.entries()].map(([key, amounts]) => {
          const separator = key.lastIndexOf(':');
          return {
            ownerUserId: key.slice(0, separator),
            currencyCode: key.slice(separator + 1),
            amount: sumSalesDecimals(amounts),
          };
        }),
        conversionRate: null,
        conversionRateStatus:
          'AWAITING_CUSTOMER_AFFAIRS_PUBLIC_CONTRACT' as const,
      },
    };
  }

  applyFinancePaymentConfirmed(event: {
    version: 1;
    eventId: string;
    contractId: string;
    paymentId: string;
    financePaymentReference: string;
    confirmedAt: string;
  }) {
    return this.repository.applyFinanceConfirmation({
      contractId: event.contractId,
      paymentId: event.paymentId,
      financePaymentReference: event.financePaymentReference,
      financeConfirmationId: event.eventId,
      confirmedAt: event.confirmedAt,
    });
  }
}
