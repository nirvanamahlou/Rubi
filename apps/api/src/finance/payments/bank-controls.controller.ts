import { FinanceSourceReferences } from '../source-read/finance-source-references.service';
import { brokerBalances } from './broker-balances';
import {
  currentFinanceFiscalRequest,
  financeFiscalUtcRange,
} from '../fiscal-context/finance-fiscal-storage';
import type { Prisma } from '@nora/database';
import {
  NotFoundException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { bankScope, fundBroker, sourceKey } from './broker-transfer';
import { readBankObligation } from './obligation-read';
import * as v from '../accounting/accounting.validation';
@Controller('finance/bank-controls')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.payment.create')
export class BankControlsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(FinanceSourceReferences)
    private readonly refs: FinanceSourceReferences,
  ) {}
  @Post('designations')
  @RequirePermissions('finance.read', 'finance.account.manage')
  assign(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.db.client.$transaction(async (tx) => {
      const { book } = await bankScope(tx, req.actor),
        p = v.object(body),
        id = v.uuid(p.sourceId)!,
        ownerId = v.uuid(p.ownerId)!;
      const src =
        p.kind === 'OPERATIONAL'
          ? { operationalId: id }
          : p.kind === 'TICKET'
            ? { costId: id }
            : p.kind === 'RESERVATIONS'
              ? { purchaseId: id }
              : v.invalid('نوع خرید معتبر نیست.');
      if ('operationalId' in src) {
        if (
          !(await tx.financeOperationalRequest.count({
            where: {
              id: src.operationalId,
              branchId: book.branchId,
              OR: [
                { fiscalPeriodId: null },
                { fiscalPeriod: { bookId: book.id } },
              ],
              counterpartyOrganizationId: null,
            },
          }))
        )
          throw new NotFoundException();
      } else {
        const bill = await readBankObligation(tx, src, book.branchId);
        if (bill.brokerId || bill.organizationId)
          v.rule('طرف این خرید از قبل مشخص است.');
      }
      if (
        !(await tx.financeBeneficiary.count({
          where: {
            bookId: book.id,
            ownerId,
            blacklisted: false,
            owner: { active: true },
          },
        }))
      )
        v.rule('ذی‌نفع ثبت‌شده را انتخاب کنید.');
      return tx.financePayeeDesignation.create({
        data: { ...src, bookId: book.id, ownerId, createdBy: req.actor.userId },
        select: { id: true },
      });
    });
  }
  @Post('advances') fund(@Body() p: unknown, @Req() req: AuthenticatedRequest) {
    return this.db.client.$transaction((tx) =>
      fundBroker(tx, req.actor, v.object(p)),
    );
  }
  @Get('options') @Header('Cache-Control', 'private, no-store') options(
    @Query() q: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.db.client.$transaction(async (tx) => {
      const { book } = await bankScope(tx, req.actor);
      if (q.kind === 'OPERATIONAL') {
        const operationalId = v.uuid(q.sourceId)!,
          active = await tx.financeOperationalRequest.findFirst({
            where: {
              id: operationalId,
              branchId: book.branchId,
              OR: [
                { fiscalPeriodId: null },
                { fiscalPeriod: { bookId: book.id } },
              ],
            },
          });
        if (!active) throw new NotFoundException();
        const designated = await tx.financePayeeDesignation.findFirst({
          where: { bookId: book.id, operationalId },
        });
        const payees = await tx.financeBeneficiary.findMany({
          where: {
            bookId: book.id,
            blacklisted: false,
            direction: { in: ['ALL', 'PAYMENT'] },
            owner: {
              active: true,
              ...(active.counterpartyOrganizationId
                ? {
                    customer: {
                      organizationId: active.counterpartyOrganizationId,
                    },
                  }
                : {}),
            },
            ...(designated ? { ownerId: designated.ownerId } : {}),
          },
          select: {
            id: true,
            ownerId: true,
            owner: { select: { title: true } },
            account: { select: { maskedAccountNumber: true } },
          },
        });
        return {
          brokers: [],
          pending: [],
          receipts: [],
          payees,
          designate:
            !designated &&
            !active.counterpartyOrganizationId &&
            !active.refundReceiptId,
        };
      }
      const source = sourceKey(q.kind, q.sourceId),
        bill = await readBankObligation(tx, source, book.branchId);
      const brokers = await tx.masterBroker.findMany({
        where: {
          isActive: true,
          collaborationStatus: 'ACTIVE',
          ...(bill.brokerId
            ? { id: bill.brokerId }
            : bill.organizationId
              ? { organizationId: bill.organizationId }
              : {}),
          ...(q.search
            ? { name: { contains: v.text(q.search, 100), mode: 'insensitive' } }
            : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 100,
      });
      const pending = await tx.financeBrokerTransfer.findMany({
        where: { bookId: book.id, ...source, receiptId: null },
        orderBy: { sentAt: 'asc' },
        select: {
          id: true,
          amount: true,
          rate: true,
          currency: true,
          officeId: true,
          sentAt: true,
          broker: { select: { name: true } },
          office: { select: { title: true } },
        },
      });
      const designated =
        'invoiceId' in source
          ? null
          : await tx.financePayeeDesignation.findFirst({
              where: { bookId: book.id, ...source },
            });
      const payees = await tx.financeBeneficiary.findMany({
        where: {
          bookId: book.id,
          ...(designated ? { ownerId: designated.ownerId } : {}),
          blacklisted: false,
          direction: { in: ['ALL', 'PAYMENT'] },
          owner: { active: true },
          account: { isActive: true, isExternal: true, deletedAt: null },
          ...(bill.brokerId
            ? { brokerId: bill.brokerId }
            : bill.organizationId
              ? {
                  owner: {
                    active: true,
                    customer: { organizationId: bill.organizationId },
                  },
                }
              : {}),
        },
        select: {
          id: true,
          ownerId: true,
          owner: { select: { title: true } },
          account: { select: { maskedAccountNumber: true } },
        },
        orderBy: { owner: { title: 'asc' } },
      });
      const receipts = await tx.document.findMany({
        where: {
          branchId: book.branchId,
          sourceModule: 'FINANCE',
          sourceEntityType: 'FinanceBrokerTransfer',
          sourceEntityId: { in: pending.map((x) => x.id) },
          archiveStatus: 'ACTIVE',
          deletedAt: null,
          currentVersion: { scanStatus: 'CLEAN' },
        },
        select: { id: true, archiveCode: true, sourceEntityId: true },
      });
      return {
        pending,
        brokers,
        payees,
        bill,
        receipts,
        designate:
          !('invoiceId' in source) &&
          !bill.brokerId &&
          !bill.organizationId &&
          !designated,
      };
    });
  }
  @Get('ledger')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  async ledger(
    @Query() q: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.db.client.$transaction(async (tx) => {
      const { book, period } = await bankScope(tx, req.actor),
        search = v.text(q.search, 120),
        brokerId = v.uuid(q.brokerId, true);
      const page = Number(q.page ?? 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
        v.invalid('صفحه معتبر نیست.');
      const window = financeFiscalUtcRange(period.startDate, period.endDate);
      const where: Prisma.FinanceBrokerTransferWhereInput = {
        bookId: book.id,
        sentAt: { lt: window.lt },
        AND: [
          {
            OR: [
              { periodId: period.id },
              { receivedAt: null },
              { receivedAt: { gte: window.gte } },
            ],
          },
        ],
        ...(brokerId ? { brokerId } : {}),
        ...(search
          ? {
              OR: [
                { broker: { name: { contains: search, mode: 'insensitive' } } },
                {
                  purchase: {
                    intake: {
                      snapshot: {
                        path: ['contractNumber'],
                        string_contains: search,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      const rows = await tx.financeBrokerTransfer.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 40,
        take: 41,
        include: {
          broker: { select: { id: true, name: true } },
          office: { select: { title: true } },
          receipt: { select: { archiveCode: true } },
          cost: { select: { requestId: true } },
        },
      });
      const memo = new Map<
        string,
        Awaited<ReturnType<typeof readBankObligation>>
      >();
      const entries = [];
      for (const r of rows.slice(0, 40)) {
        const source = r.purchaseId
          ? { purchaseId: r.purchaseId }
          : r.costId
            ? { costId: r.costId }
            : { invoiceId: r.invoiceId! };
        const id = r.purchaseId ?? r.costId ?? r.invoiceId!;
        let bill = memo.get(id);
        if (!bill) {
          bill = await readBankObligation(
            tx,
            source,
            book.branchId,
            true,
            window.lt,
          );
          memo.set(id, bill);
        }
        const received = r.receivedAt && r.receivedAt < window.lt;
        entries.push({
          purchaseId: r.purchaseId,
          costId: r.costId,
          invoiceId: r.invoiceId,
          requestId: r.cost?.requestId ?? null,
          id: r.id,
          sourceId: id,
          broker: r.broker,
          office: r.office.title,
          currency: r.currency,
          amount: r.amount,
          sentAt: r.sentAt,
          receivedAt: received ? r.receivedAt : null,
          receiptId: received ? r.receiptId : null,
          receiptNumber: received ? r.receipt?.archiveCode : null,
          bill,
        });
      }
      const issuer = currentFinanceFiscalRequest()?.issuerCompanyId ?? null;
      const pattern = '%' + (v.text(q.brokerSearch, 120) || '') + '%';
      const brokers = await tx.$queryRaw<
        { id: string; name: string }[]
      >`SELECT b.id,b.name FROM master_brokers b WHERE (b.id=${brokerId}::uuid OR b.name ILIKE ${pattern}) AND
         (EXISTS(SELECT 1 FROM finance_broker_transfers t WHERE t."brokerId"=b.id AND t."bookId"=${book.id}::uuid AND t."sentAt"<${window.lt})
          OR EXISTS(SELECT 1 FROM "ReservationServicePurchase" p JOIN "ReservationIntake" i ON i.id=p."intakeId" WHERE p."supplierBrokerId"=b.id AND i."branchId"=${book.branchId}::uuid AND p."createdAt"<${window.lt}
            AND (${issuer}::uuid IS NULL OR EXISTS(SELECT 1 FROM sales_contracts c WHERE c.id=i."contractId" AND c.legal_entity_id=${issuer}::uuid AND c.finance_hidden_at IS NULL)))) ORDER BY (b.id=${brokerId}::uuid) DESC NULLS LAST,b.name,b.id LIMIT 80`;
      const balances = brokerId
        ? await brokerBalances(
            tx,
            book,
            brokerId,
            currentFinanceFiscalRequest()?.issuerCompanyId ?? null,
            window.lt,
          )
        : [];
      return { rows: entries, brokers, balances, hasNext: rows.length > 40 };
    });
    const refs = await this.refs.brokerTransfers(result.rows, req.actor);
    return {
      ...result,
      rows: result.rows.map((r, i) => ({ ...r, references: refs[i] })),
    };
  }
}
