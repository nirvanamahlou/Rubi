import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as Joi from 'joi';
import type {
  AuthenticatedActor,
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
    .allow(null)
    .optional(),
  supplierDisplaySnapshot: Joi.string().trim().max(160).allow(null),
  amount: Joi.string()
    .pattern(/^(0*[1-9]\d*)(\.\d{1,6})?$/)
    .allow(null)
    .optional(),
  currencyCode: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .allow(null)
    .optional(),
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
    if (Boolean(value.amount) !== Boolean(value.currencyCode))
      throw new BadRequestException('مبلغ برآوردی و ارز باید با هم ثبت شوند.');
    const serviceDate = value.serviceDate
      ? new Date(value.serviceDate + 'T00:00:00.000Z')
      : null;
    if (serviceDate && (
      Number.isNaN(serviceDate.getTime()) ||
      serviceDate.toISOString().slice(0, 10) !== value.serviceDate
    ))
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
      if (existing?.offerId)
        throw new ConflictException('درخواست بلیت تور از تعریف پرواز مدیریت می‌شود.');
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
            amount: value.amount ? new Prisma.Decimal(value.amount) : existing.amount,
            currencyCode: value.currencyCode ?? existing.currencyCode,
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
          amount: value.amount ? new Prisma.Decimal(value.amount) : null,
          currencyCode: value.currencyCode ?? null,
          createdByUserId: actor.userId,
          createKey: key,
          fingerprint,
        },
      });
    });
    return this.toTicketPurchase(row);
  }

  /** Public Ticket boundary: only a real persisted offer may create this pending envelope. */
  async ensureOfferPurchaseRequest(input: {
    id: string;
    version: number;
    branchId: string;
    departureAt: Date;
    carrierName: string;
    serviceNumber: string;
    createdByUserId: string;
  }): Promise<TicketCatalogPurchaseV1> {
    const serviceDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(input.departureAt);
    const reference = 'offer:' + input.id;
    const row = await this.database.client.procurementTicketPurchaseRequest.upsert({
      where: { offerId: input.id },
      update: {},
      create: {
        branchId: input.branchId,
        catalogProductReference: reference,
        title: (input.carrierName + ' ' + input.serviceNumber).slice(0, 160),
        serviceDate: new Date(serviceDate + 'T00:00:00.000Z'),
        supplierDisplaySnapshot: input.carrierName,
        amount: null,
        currencyCode: null,
        offerId: input.id,
        offerVersion: input.version,
        createdByUserId: input.createdByUserId,
        createKey: reference,
        fingerprint: createHash('sha256').update(reference).digest('hex'),
      },
    });
    if (row.branchId !== input.branchId || row.offerVersion !== input.version)
      throw new ConflictException('مرجع درخواست خرید پرواز تغییر کرده است.');
    return this.toTicketPurchase(row);
  }

  async forFinance(requestId: string, branchIds: readonly string[]) {
    const row = await this.database.client.procurementTicketPurchaseRequest.findFirst({
      where: { id: requestId, branchId: { in: [...branchIds] }, status: 'PENDING' },
    });
    if (!row) throw new NotFoundException('درخواست خرید بلیت در شعب مجاز یافت نشد.');
    return this.toTicketPurchase(row);
  }

  /** Finance passes its transaction; only this producer mutates its envelope. */
  async markFinancePaid(
    transaction: Prisma.TransactionClient,
    requestId: string,
    branchId: string,
    expectedVersion: number,
  ) {
    const changed = await transaction.procurementTicketPurchaseRequest.updateMany({
      where: { id: requestId, branchId, version: expectedVersion, status: 'PENDING' },
      data: { status: 'PAID', version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException('نسخه درخواست خرید بلیت تغییر کرده است.');
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

  private toTicketPurchase(row: {
    id: string;
    version: number;
    branchId: string;
    catalogProductReference: string;
    title: string;
    serviceDate: Date | null;
    supplierDisplaySnapshot: string | null;
    amount: Prisma.Decimal | null;
    currencyCode: string | null;
    offerId: string | null;
    offerVersion: number | null;
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
      serviceDate: row.serviceDate?.toISOString().slice(0, 10) ?? null,
      supplierDisplaySnapshot: row.supplierDisplaySnapshot,
      amount: row.amount?.toString() ?? null,
      currencyCode: row.currencyCode,
      offerId: row.offerId,
      offerVersion: row.offerVersion,
      requestVersion: row.version,
      status: row.status as TicketCatalogPurchaseV1['status'],
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
