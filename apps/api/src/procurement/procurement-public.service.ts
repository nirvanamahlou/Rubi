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
        status: { in: ['NOT_CONNECTED', 'PENDING'] },
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
        status: 'BLOCKED',
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
