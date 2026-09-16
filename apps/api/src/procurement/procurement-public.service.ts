import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as Joi from 'joi';
import type {
  AuthenticatedActor,
  ProcurementFinanceSourceV1,
  ProcurementFinanceCorrectionResultV1,
  ProcurementFinanceCorrectionSourceV1,
  ProcurementFinanceResultV1,
  ProcurementSupplierInboundEventV1,
  TicketCatalogPurchaseCreateV1,
  TicketCatalogPurchaseV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';

const purchaseSchema = Joi.object({
  version: Joi.number().valid(1).required(),
  catalogProductReference: Joi.string().trim().max(160).required(),
  title: Joi.string().trim().max(160).required(),
  serviceDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  supplierDisplaySnapshot: Joi.string().trim().max(160).allow(null),
  amount: Joi.string()
    .pattern(/^(0*[1-9]\d*)(\.\d{1,6})?$/)
    .required(),
  currencyCode: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .required(),
});

@Injectable()
export class ProcurementPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async registerTicketPurchase(
    input: TicketCatalogPurchaseCreateV1,
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ): Promise<TicketCatalogPurchaseV1> {
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException('مجوز مدیریت بلیط وجود ندارد.');
    if (!branchId || !actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه مجاز لازم است.');
    if (!key?.trim() || key.length > 160)
      throw new BadRequestException('کلید درخواست معتبر لازم است.');
    const validation = purchaseSchema.validate(input, { convert: false });
    if (validation.error)
      throw new BadRequestException('اطلاعات قیمت خرید بلیط معتبر نیست.');
    const value = validation.value as TicketCatalogPurchaseCreateV1;
    const serviceDate = new Date(value.serviceDate + 'T00:00:00.000Z');
    if (
      Number.isNaN(serviceDate.getTime()) ||
      serviceDate.toISOString().slice(0, 10) !== value.serviceDate
    )
      throw new BadRequestException('تاریخ اولین بلیط معتبر نیست.');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ branchId, ...value }))
      .digest('hex');
    const row = await this.database.client.$transaction(async (transaction) => {
      const existing =
        await transaction.procurementTicketPurchaseRequest.findUnique({
          where: {
            branchId_catalogProductReference: {
              branchId,
              catalogProductReference: value.catalogProductReference,
            },
          },
        });
      if (existing?.fingerprint === fingerprint) return existing;
      if (existing && existing.status !== 'PENDING')
        throw new ConflictException(
          'قیمت خرید پس از رسیدگی مالی قابل ویرایش نیست.',
        );
      if (existing)
        return transaction.procurementTicketPurchaseRequest.update({
          where: { id: existing.id },
          data: {
            version: { increment: 1 },
            title: value.title,
            serviceDate,
            supplierDisplaySnapshot: value.supplierDisplaySnapshot,
            amount: new Prisma.Decimal(value.amount),
            currencyCode: value.currencyCode,
            createKey: key,
            fingerprint,
          },
        });
      return transaction.procurementTicketPurchaseRequest.create({
        data: {
          branchId,
          catalogProductReference: value.catalogProductReference,
          title: value.title,
          serviceDate,
          supplierDisplaySnapshot: value.supplierDisplaySnapshot,
          amount: new Prisma.Decimal(value.amount),
          currencyCode: value.currencyCode,
          createdByUserId: actor.userId,
          createKey: key,
          fingerprint,
        },
      });
    });
    return this.toTicketPurchase(row);
  }

  async listFinanceTicketPurchases(
    branchIds: readonly string[],
  ): Promise<readonly TicketCatalogPurchaseV1[]> {
    const rows =
      await this.database.client.procurementTicketPurchaseRequest.findMany({
        where: { branchId: { in: [...branchIds] }, status: 'PENDING' },
        orderBy: [{ serviceDate: 'asc' }, { createdAt: 'asc' }],
      });
    return rows.map((row) => this.toTicketPurchase(row));
  }

  /** Finance reads the immutable, already-matched invoice source via this boundary. */
  async listFinanceInvoiceSources(
    branchIds: readonly string[],
  ): Promise<
    readonly (ProcurementFinanceSourceV1 & { handoffCreatedAt: string })[]
  > {
    if (!branchIds.length) return [];
    const rows = await this.database.client.procurementFinanceHandoff.findMany({
      where: {
        status: {
          in: ['NOT_CONNECTED', 'PENDING', 'ACCEPTED', 'PARTIALLY_PAID'],
        },
        procurementFinanceHandoffRequestid: {
          branchId: { in: [...branchIds] },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: { payload: true, createdAt: true },
    });
    return rows.map((row) => ({
      ...(row.payload as unknown as ProcurementFinanceSourceV1),
      handoffCreatedAt: row.createdAt.toISOString(),
    }));
  }

  async financeInvoiceSource(sourceId: string, branchIds: readonly string[]) {
    const row = await this.database.client.procurementFinanceHandoff.findFirst({
      where: {
        invoiceId: sourceId,
        procurementFinanceHandoffRequestid: {
          branchId: { in: [...branchIds] },
        },
      },
      orderBy: [{ invoiceVersion: 'desc' }, { createdAt: 'desc' }],
      select: { payload: true, createdAt: true, status: true, version: true },
    });
    return row
      ? {
          ...(row.payload as unknown as ProcurementFinanceSourceV1),
          handoffCreatedAt: row.createdAt.toISOString(),
          handoffStatus: row.status,
          handoffVersion: row.version,
        }
      : null;
  }

  /** Finance reads accepted-return corrections without accessing Procurement tables. */
  async listFinanceCorrections(
    branchIds: readonly string[],
  ): Promise<readonly ProcurementFinanceCorrectionSourceV1[]> {
    if (!branchIds.length) return [];
    const rows = await this.database.client.procurementOutbox.findMany({
      where: {
        eventType: 'procurement.finance-correction.v1',
        status: { in: ['PENDING', 'RETRY'] },
        procurementOutboxRequestid: { branchId: { in: [...branchIds] } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: { payload: true },
    });
    return rows.map(
      (row) => row.payload as unknown as ProcurementFinanceCorrectionSourceV1,
    );
  }

  /** Finance returns its decision through the public contract; Procurement remains owner. */
  async applyFinanceCorrectionResult(
    result: ProcurementFinanceCorrectionResultV1,
    branchIds: readonly string[],
  ) {
    return this.database.client.$transaction(async (tx) => {
      const event = await tx.procurementOutbox.findFirst({
        where: {
          eventId: result.eventId,
          eventType: 'procurement.finance-correction.v1',
          procurementOutboxRequestid: { branchId: { in: [...branchIds] } },
        },
      });
      if (!event) return 'not-found' as const;
      if (!['PENDING', 'RETRY'].includes(event.status))
        return 'conflict' as const;
      const source =
        event.payload as unknown as ProcurementFinanceCorrectionSourceV1;
      if (source.sourceVersion !== result.sourceVersion)
        return 'conflict' as const;
      const returned = await tx.procurementReturn.findUnique({
        where: { id: source.returnId },
      });
      if (!returned) return 'not-found' as const;
      await tx.procurementReturn.update({
        where: { id: returned.id },
        data: {
          data: {
            ...(returned.data as Prisma.JsonObject),
            financeCorrectionStatus: result.status,
            financeCorrection: result,
          },
        },
      });
      await tx.procurementOutbox.update({
        where: { id: event.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(result.occurredAt),
          payload: {
            ...(event.payload as Prisma.JsonObject),
            financeResult: result,
          },
        },
      });
      return 'applied' as const;
    });
  }

  async applyFinanceResult(
    result: ProcurementFinanceResultV1,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      const handoff = await tx.procurementFinanceHandoff.findFirst({
        where: {
          invoiceId: result.sourceId,
          invoiceVersion: result.sourceVersion,
        },
      });
      if (!handoff) return 'not-found' as const;
      const allowed: Record<string, readonly string[]> = {
        PENDING: ['APPROVED', 'CORRECTION_REQUIRED'],
        NOT_CONNECTED: ['APPROVED', 'CORRECTION_REQUIRED'],
        ACCEPTED: ['PARTIALLY_PAID', 'PAID'],
        PARTIALLY_PAID: ['PARTIALLY_PAID', 'PAID'],
      };
      if (!(allowed[handoff.status] ?? []).includes(result.status))
        return 'conflict' as const;
      await tx.procurementFinanceHandoff.update({
        where: { id: handoff.id },
        data: {
          status: result.status === 'APPROVED' ? 'ACCEPTED' : result.status,
          version: { increment: 1 },
          acceptedSourceId: result.financeReference,
          lastErrorCode:
            result.status === 'CORRECTION_REQUIRED'
              ? 'FINANCE_CORRECTION_REQUIRED'
              : null,
        },
      });
      await tx.procurementInvoice.update({
        where: { id: handoff.invoiceId },
        data: {
          status:
            result.status === 'APPROVED' || result.status === 'PARTIALLY_PAID'
              ? 'ACCEPTED'
              : result.status,
          data: {
            ...((
              await tx.procurementInvoice.findUniqueOrThrow({
                where: { id: handoff.invoiceId },
                select: { data: true },
              })
            ).data as Prisma.JsonObject),
            finance: result,
          },
        },
      });
      await tx.procurementOutbox.updateMany({
        where: {
          handoffId: handoff.id,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      return 'applied' as const;
    };
    return transaction
      ? work(transaction)
      : this.database.client.$transaction((tx) => work(tx));
  }

  /** Owner-scoped outbox projections for Tasks and Integrations adapters. */
  async listPendingConnectionEvents(
    branchIds: readonly string[],
    contract:
      'procurement.workflow-event.v1' | 'procurement.supplier-order-intent.v1',
  ) {
    if (!branchIds.length) return [];
    const rows = await this.database.client.procurementOutbox.findMany({
      where: {
        eventType: contract,
        status: { in: ['PENDING', 'RETRY'] },
        availableAt: { lte: new Date() },
        procurementOutboxRequestid: { branchId: { in: [...branchIds] } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: { eventId: true, payload: true, createdAt: true },
    });
    return rows.map((row) => ({
      eventId: row.eventId,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async claimConnectionEvents(
    branchIds: readonly string[],
    contract: 'procurement.supplier-order-intent.v1',
    limit = 25,
  ) {
    if (!branchIds.length) return [];
    return this.database.client.$transaction(async (tx) => {
      const candidates = await tx.procurementOutbox.findMany({
        where: {
          eventType: contract,
          status: { in: ['PENDING', 'RETRY'] },
          availableAt: { lte: new Date() },
          procurementOutboxRequestid: { branchId: { in: [...branchIds] } },
        },
        orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
        take: Math.max(1, Math.min(limit, 100)),
      });
      const claimed = [];
      for (const event of candidates) {
        const update = await tx.procurementOutbox.updateMany({
          where: {
            id: event.id,
            status: { in: ['PENDING', 'RETRY'] },
            availableAt: { lte: new Date() },
          },
          data: { status: 'PROCESSING', attempts: { increment: 1 } },
        });
        if (update.count === 1)
          claimed.push({
            eventId: event.eventId,
            payload: event.payload,
            attempts: event.attempts + 1,
          });
      }
      return claimed;
    });
  }

  async settleConnectionEvent(
    eventId: string,
    result: { delivered: boolean; errorCode?: string },
  ) {
    const event = await this.database.client.procurementOutbox.findUnique({
      where: { eventId },
    });
    if (!event || event.eventType !== 'procurement.supplier-order-intent.v1')
      return 'not-found' as const;
    if (event.status !== 'PROCESSING') return 'conflict' as const;
    const terminal = !result.delivered && event.attempts >= 8;
    await this.database.client.procurementOutbox.update({
      where: { id: event.id },
      data: result.delivered
        ? { status: 'DELIVERED', deliveredAt: new Date() }
        : {
            status: terminal ? 'FAILED' : 'RETRY',
            availableAt: new Date(
              Date.now() + Math.min(60, 2 ** event.attempts) * 60_000,
            ),
            payload: {
              ...(event.payload as Prisma.JsonObject),
              lastErrorCode: result.errorCode ?? 'SUPPLIER_DELIVERY_FAILED',
            },
          },
    });
    return result.delivered ? ('delivered' as const) : ('retry' as const);
  }

  async applySupplierInboundEvent(event: ProcurementSupplierInboundEventV1) {
    const order = await this.database.client.procurementOrder.findUnique({
      where: { id: event.orderReference },
    });
    if (!order) return 'not-found' as const;
    const data = order.data as Prisma.JsonObject;
    const status =
      event.eventType === 'ORDER_REJECTED' ? 'SUPPLIER_REJECTED' : order.status;
    await this.database.client.procurementOrder.update({
      where: { id: order.id },
      data: {
        status,
        data: {
          ...data,
          supplierConnection: {
            eventType: event.eventType,
            externalMessageId: event.externalMessageId,
            occurredAt: event.occurredAt,
            payload: event.payload,
          },
        } as Prisma.InputJsonValue,
      },
    });
    return 'applied' as const;
  }

  private toTicketPurchase(row: {
    id: string;
    version: number;
    branchId: string;
    catalogProductReference: string;
    title: string;
    serviceDate: Date;
    supplierDisplaySnapshot: string | null;
    amount: Prisma.Decimal;
    currencyCode: string;
    status: string;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }): TicketCatalogPurchaseV1 {
    return {
      version: 1,
      id: row.id,
      branchId: row.branchId,
      catalogProductReference: row.catalogProductReference,
      title: row.title,
      serviceDate: row.serviceDate.toISOString().slice(0, 10),
      supplierDisplaySnapshot: row.supplierDisplaySnapshot,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      requestVersion: row.version,
      status: row.status as TicketCatalogPurchaseV1['status'],
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
