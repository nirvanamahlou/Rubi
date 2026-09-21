import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedActor,
  ProcurementDraftV1,
  ProcurementFinanceSourceV1,
  ProcurementReferenceV1,
  ProcurementDocumentReferenceV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DocumentsService } from '../documents/documents.service';
import { IamProcurementDirectory } from '../iam/iam-procurement-directory';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { MasterProcurementDirectory } from '../master-data/master-procurement-directory';
import {
  assertReceipt,
  decimal,
  decimalString,
  documentTotal,
  lineTotal,
  matchInvoice,
  normalizeInvoiceNumber,
  requireRule,
  validatePolicy,
  type ApprovalPolicy,
  type CommercialLine,
} from './domain/procurement.rules';
import { ProcurementPolicyPort } from './procurement.ports';
import type { ProcurementRow, ProcurementTx } from './procurement.service';
import * as v from './procurement.validation';

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
type Order = Prisma.ProcurementOrderGetPayload<null>;
type Commitment = {
  orderId: string;
  version: number;
  supplierId: string;
  amount: string;
  currencyCode: string;
};
export type CommitmentPolicy = ApprovalPolicy & { commitment?: Commitment };
const linesOf = (value: unknown): CommercialLine[] =>
  v.array(value, 'lines').map((value) => {
    const line = v.object(value, [
      'itemId',
      'quantity',
      'unitPrice',
      'discount',
      'tax',
      'extraCost',
    ]);
    return {
      itemId: v.uuid(line.itemId),
      quantity: v.money(line.quantity, 'quantity'),
      unitPrice: v.money(line.unitPrice, 'unitPrice'),
      discount: v.money(line.discount ?? '0', 'discount'),
      tax: v.money(line.tax ?? '0', 'tax'),
      extraCost: v.money(line.extraCost ?? '0', 'extraCost'),
    };
  });
const storedLine = (line: CommercialLine) => ({
  quantity: line.quantity,
  unitPrice: line.unitPrice,
  taxAmount: line.tax,
  discountAmount: line.discount,
  extraCostAmount: line.extraCost,
  totalAmount: lineTotal(line),
});
const commercial = (line: {
  id: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  extraCostAmount: Prisma.Decimal;
}): CommercialLine => ({
  itemId: line.id,
  quantity: line.quantity.toString(),
  unitPrice: line.unitPrice.toString(),
  tax: line.taxAmount.toString(),
  discount: line.discountAmount.toString(),
  extraCost: line.extraCostAmount.toString(),
});
const signed = (value: string) =>
  value.startsWith('-') ? -decimal(value.slice(1)) : decimal(value);

@Injectable()
export class ProcurementOperations {
  constructor(
    @Inject(MasterProcurementDirectory)
    private readonly master: MasterProcurementDirectory,
    @Inject(IamProcurementDirectory)
    private readonly iam: IamProcurementDirectory,
    @Inject(LegalEntitiesService) private readonly legal: LegalEntitiesService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(ProcurementPolicyPort)
    private readonly policy: ProcurementPolicyPort,
  ) {}
  private async documentsFor(
    value: unknown,
    branchId: string,
    actor: AuthenticatedActor,
    required = false,
  ) {
    const references = v.array(value ?? [], 'documents', 20).map((value) => {
      const ref = v.object(value, ['id', 'versionId']);
      return { id: v.uuid(ref.id), versionId: v.uuid(ref.versionId) };
    });
    requireRule(
      !required || references.length > 0,
      'DOCUMENT_REQUIRED',
      'مدرک این عملیات لازم است.',
    );
    if (references.length)
      requireRule(
        actor.permissions.includes('documents.metadata.read') &&
          actor.permissions.includes('documents.procurement.read'),
        'FORBIDDEN',
        'دسترسی مدرک خرید ندارید.',
      );
    for (const ref of references) {
      const { data } = await this.documents.detail(ref.id, actor, {});
      const version = data.versions.find(
        (version) => version.id === ref.versionId,
      );
      requireRule(
        data.branchId === branchId &&
          data.type.domain === 'PROCUREMENT' &&
          data.archiveStatus !== 'DELETED' &&
          version?.scanStatus === 'CLEAN' &&
          !data.isIncomplete,
        'DOCUMENTS_UNAVAILABLE',
        'نسخه مدرک سالم و مجاز خرید لازم است.',
      );
    }
    return references;
  }
  private async order(
    tx: ProcurementTx,
    requestId: string,
    input: unknown,
  ): Promise<Order> {
    const order = await tx.procurementOrder.findFirst({
      where: { id: v.uuid(input, 'orderId'), requestId },
    });
    requireRule(order, 'INVALID_REFERENCE', 'سفارش متعلق به این درخواست نیست.');
    return order;
  }
  private async orderItems(tx: ProcurementTx, order: Order) {
    const version = await tx.procurementOrderVersion.findUniqueOrThrow({
      where: { orderId_version: { orderId: order.id, version: order.version } },
    });
    const items = await tx.procurementOrderItem.findMany({
      where: { orderVersionId: version.id },
      take: 101,
    });
    requireRule(
      items.length <= 100,
      'LIMIT_EXCEEDED',
      'تعداد اقلام سفارش از سقف پردازش بیشتر است.',
    );
    return { version, items };
  }
  private issued(order: Order) {
    requireRule(
      order.status === 'ISSUED',
      'INVALID_STATE',
      'سفارش باید صادرشده و باز باشد.',
    );
  }
  private async approvedVersion(tx: ProcurementTx, requestId: string) {
    const snapshot = await tx.procurementApprovalSnapshot.findFirst({
      where: { requestId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    requireRule(snapshot, 'POLICY_NOT_CONFIGURED', 'نسخه تأیید خرید یافت نشد.');
    return snapshot;
  }
  private async requestOrderApproval(
    tx: ProcurementTx,
    row: ProcurementRow,
    order: Order,
    actor: AuthenticatedActor,
  ) {
    const draft = row.data as unknown as ProcurementDraftV1;
    const commitmentDraft = {
      ...draft,
      estimatedAmount: order.totalAmount.toString(),
      currencyCode: order.currencyCode,
    };
    const policy = await this.policy.resolve(commitmentDraft);
    validatePolicy(policy, commitmentDraft, row.requesterUserId);
    const candidates = await this.iam.authorizedUsers(
      policy.steps.map((step) => step.userId),
      row.branchId,
      'procurement.approve',
    );
    requireRule(
      candidates.length === policy.steps.length,
      'NO_VALID_APPROVER',
      'تأییدکننده فعال و مجاز وجود ندارد.',
    );
    requireRule(
      policy.steps.every((step) => step.userId !== actor.userId),
      'NO_VALID_APPROVER',
      'تنظیم‌کننده سفارش نمی‌تواند آن را تأیید کند.',
    );
    const version = await tx.procurementRequestVersion.findFirstOrThrow({
      where: { requestId: row.id },
      orderBy: { version: 'desc' },
    });
    const payload: CommitmentPolicy = {
      ...policy,
      commitment: {
        orderId: order.id,
        version: order.version,
        supplierId: order.supplierId,
        amount: order.totalAmount.toString(),
        currencyCode: order.currencyCode,
      },
    };
    const snapshot = await tx.procurementApprovalSnapshot.create({
      data: {
        requestId: row.id,
        requestVersionId: version.id,
        policyReference: policy.id,
        policyVersion: String(policy.version),
        payload: json(payload),
      },
    });
    await tx.procurementApprovalStep.createMany({
      data: policy.steps.map((step, index) => ({
        snapshotId: snapshot.id,
        position: index + 1,
        approverUserId: step.userId,
        data: json(step),
      })),
    });
    await tx.procurementRequest.update({
      where: { id: row.id },
      data: { status: 'IN_REVIEW' },
    });
  }
  async execute(
    tx: ProcurementTx,
    row: ProcurementRow,
    action: string,
    input: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    requireRule(
      !['CANCELLED', 'REJECTED'].includes(row.status) &&
        (row.status !== 'CLOSED' ||
          [
            'RETURN',
            'ADJUST_RECEIPT',
            'DISCREPANCY',
            'RESOLVE_DISCREPANCY',
            'MATCH_INVOICE',
            'SUBMIT_FINANCE',
          ].includes(action)),
      'INVALID_STATE',
      'پرونده نهایی است.',
    );
    const requestId = row.id;
    const draft = row.data as unknown as ProcurementDraftV1;
    if (action === 'CLOSE_REQUEST') {
      v.text(input.reason, 'reason', 1000);
      const [orders, openOrders, discrepancies, invoices] = await Promise.all([
        tx.procurementOrder.count({ where: { requestId } }),
        tx.procurementOrder.count({
          where: { requestId, status: { notIn: ['CLOSED', 'CANCELLED'] } },
        }),
        tx.procurementDiscrepancy.count({
          where: { requestId, status: 'OPEN' },
        }),
        tx.procurementInvoice.count({
          where: {
            requestId,
            status: { notIn: ['WAITING_FINANCE', 'ACCEPTED', 'PAID'] },
          },
        }),
      ]);
      requireRule(
        orders > 0 && openOrders === 0 && discrepancies === 0 && invoices === 0,
        'OPEN_COMMITMENTS',
        'ابتدا سفارش‌ها، مغایرت‌ها و ارجاع فاکتورها را تعیین تکلیف کنید.',
      );
      // Closing the request disables further invoicing. Account for the net
      // accepted quantity, including append-only corrections and returns,
      // rather than treating absence of an invoice as absence of an obligation.
      const outstanding = await tx.$queryRaw<
        { exists: boolean; pendingDisposition: boolean }[]
      >(Prisma.sql`
          SELECT EXISTS (
            SELECT 1 FROM procurement_order_item oi
            JOIN procurement_order o ON o.id = oi."orderId"
            WHERE o."requestId" = ${requestId}::uuid AND o.status <> 'CANCELLED'
              AND (
                COALESCE((SELECT SUM(ri."acceptedQuantity") FROM procurement_receipt_item ri
                  WHERE ri."orderItemId" = oi.id), 0)
                + COALESCE((SELECT SUM(a."acceptedDelta") FROM procurement_receipt_adjustment a
                  JOIN procurement_receipt_item ri ON ri.id = a."receiptItemId"
                  WHERE ri."orderItemId" = oi.id), 0)
                + COALESCE((SELECT SUM(sa.quantity) FROM procurement_service_acceptance sa
                  WHERE sa."orderItemId" = oi.id), 0)
                - COALESCE((SELECT SUM(rt.quantity) FROM procurement_return rt
                  JOIN procurement_receipt_item ri ON ri.id = rt."receiptItemId"
                  WHERE ri."orderItemId" = oi.id
                    AND COALESCE(rt.data->>'disposition', 'ACCEPTED') = 'ACCEPTED'), 0)
              ) > COALESCE((SELECT SUM(ii.quantity) FROM procurement_invoice_item ii
                JOIN procurement_invoice i ON i.id = ii."invoiceId"
                WHERE ii."orderItemId" = oi.id AND i.status IN ('WAITING_FINANCE', 'ACCEPTED', 'PAID')), 0)
          ) AS exists,
          EXISTS (
            SELECT 1 FROM procurement_receipt_item ri
            JOIN procurement_receipt r ON r.id = ri."receiptId"
            WHERE r."requestId" = ${requestId}::uuid
              AND ri.quantity - ri."acceptedQuantity" - ri."rejectedQuantity"
                + COALESCE((SELECT SUM(a."receivedDelta" - a."acceptedDelta" - a."rejectedDelta")
                  FROM procurement_receipt_adjustment a WHERE a."receiptItemId" = ri.id), 0) <> 0
          ) AS "pendingDisposition"`);
      requireRule(
        outstanding[0]?.exists === false,
        'OPEN_COMMITMENTS',
        'برای مقدار پذیرفته‌شده باقیمانده، فاکتور معتبر و ارجاع مالی لازم است.',
      );
      requireRule(
        outstanding[0]?.pendingDisposition === false,
        'OPEN_COMMITMENTS',
        'پیش از بستن درخواست، مقدار دریافت‌شده در انتظار پذیرش یا رد را تعیین تکلیف کنید.',
      );
      await tx.procurementRequest.update({
        where: { id: requestId },
        data: { status: 'CLOSED' },
      });
      return;
    }
    if (action === 'QUOTE') {
      requireRule(
        ['APPROVED', 'SOURCING'].includes(row.status),
        'INVALID_STATE',
        'درخواست باید تأیید شده باشد.',
      );
      const supplier = await this.master.supplier(v.uuid(input.supplierId));
      const currencyCode = v.currency(input.currencyCode);
      await this.master.assertCurrency(currencyCode);
      const lines = linesOf(input.lines);
      const totalAmount = documentTotal(lines);
      const validUntil = v.date(input.validUntil, 'validUntil');
      const quotedAt = v.date(input.quotedAt, 'quotedAt');
      requireRule(
        Date.parse(validUntil) > Date.parse(quotedAt),
        'INVALID_VALIDITY',
        'اعتبار پیشنهاد باید پس از تاریخ آن باشد.',
      );
      const references = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      const quotedRequestVersion =
        await tx.procurementRequestVersion.findFirstOrThrow({
          where: { requestId },
          orderBy: { version: 'desc' },
        });
      for (const line of lines) {
        const requested = draft.items.find((item) => item.id === line.itemId);
        requireRule(
          requested &&
            requested.quantity &&
            decimal(line.quantity) <= decimal(requested.quantity),
          'QUANTITY_EXCEEDS_REQUEST',
          'مقدار پیشنهاد از قلم مصوب بیشتر است.',
        );
      }
      const quotation = await tx.procurementQuotation.create({
        data: {
          requestId,
          supplierId: supplier.id,
          currencyCode,
          totalAmount,
          validUntil: new Date(validUntil),
          status: 'VALID',
          data: json({
            supplier,
            requestVersionId: quotedRequestVersion.id,
            quotedAt,
            deliveryAt: v.date(input.deliveryAt, 'deliveryAt'),
            paymentTerms: v.text(input.paymentTerms, 'paymentTerms', 2000),
            warranty: v.text(input.warranty, 'warranty', 2000, true),
            qualityNote: v.text(input.qualityNote, 'qualityNote', 2000, true),
            documents: references,
          }),
        },
      });
      await tx.procurementQuotationItem.createMany({
        data: lines.map((line) => ({
          requestId,
          quotationId: quotation.id,
          requestItemId: line.itemId,
          ...storedLine(line),
        })),
      });
      await tx.procurementRequest.update({
        where: { id: requestId },
        data: { status: 'SOURCING' },
      });
      return;
    }
    if (action === 'SELECT_QUOTE') {
      requireRule(
        ['APPROVED', 'SOURCING'].includes(row.status),
        'INVALID_STATE',
        'انتخاب پیشنهاد در این وضعیت مجاز نیست.',
      );
      const quotation = await tx.procurementQuotation.findFirst({
        where: { id: v.uuid(input.quotationId), requestId },
      });
      requireRule(
        quotation &&
          quotation.status === 'VALID' &&
          quotation.validUntil &&
          quotation.validUntil > new Date(),
        'QUOTATION_EXPIRED',
        'پیشنهاد معتبر و تمدیدشده لازم است.',
      );
      await this.master.supplier(quotation.supplierId);
      const snapshot = await this.approvedVersion(tx, requestId);
      requireRule(
        v.object(quotation.data).requestVersionId === snapshot.requestVersionId,
        'STALE_QUOTATION',
        'پس از تغییر دامنه درخواست، پیشنهاد باید برای نسخه جدید ثبت شود.',
      );
      const policy = snapshot.payload as unknown as ApprovalPolicy;
      validatePolicy(policy, draft, row.requesterUserId);
      const alternatives = await tx.procurementQuotation.findMany({
        where: { requestId, status: 'VALID', validUntil: { gt: new Date() } },
        take: 101,
      });
      requireRule(
        alternatives.length <= 100,
        'LIMIT_EXCEEDED',
        'پیشنهادهای فعال نیازمند تعیین تکلیف هستند.',
      );
      const selectedLines = await tx.procurementQuotationItem.findMany({
        where: { quotationId: quotation.id },
        take: 101,
      });
      const allLines = await tx.procurementQuotationItem.findMany({
        where: { quotationId: { in: alternatives.map((q) => q.id) } },
        take: 10001,
      });
      const signature = (items: typeof selectedLines) =>
        items
          .map((line) => `${line.requestItemId}:${line.quantity.toString()}`)
          .sort()
          .join('|');
      const comparable = alternatives.filter(
        (q) =>
          v.object(q.data).requestVersionId === snapshot.requestVersionId &&
          signature(allLines.filter((line) => line.quotationId === q.id)) ===
            signature(selectedLines),
      );
      requireRule(
        comparable.every((q) => q.currencyCode === quotation.currencyCode),
        'FX_SNAPSHOT_REQUIRED',
        'مقایسه چندارزی به نرخ مصوب و نسخه‌دار نیاز دارد.',
      );
      const reason = v.text(input.reason, 'reason', 2000, true);
      const count = new Set(comparable.map((q) => q.supplierId)).size;
      if (count < policy.minimumQuotations)
        requireRule(
          input.singleSource === true &&
            policy.singleSourceAllowed &&
            reason &&
            actor.permissions.includes('procurement.quote.single_source'),
          'SINGLE_SOURCE_NOT_AUTHORIZED',
          'خرید تک‌منبعی نیازمند سیاست، مجوز و دلیل است.',
        );
      if (
        comparable.some(
          (q) =>
            decimal(q.totalAmount.toString()) <
            decimal(quotation.totalAmount.toString()),
        )
      )
        requireRule(
          reason,
          'SELECTION_REASON_REQUIRED',
          'برای انتخاب پیشنهاد غیرارزان‌تر دلیل لازم است.',
        );
      await tx.procurementSelection.create({
        data: {
          requestId,
          quotationId: quotation.id,
          requestVersionId: snapshot.requestVersionId,
          selectedByUserId: actor.userId,
          reason: reason || 'LOWEST_COMPARABLE_VALID_QUOTATION',
          payload: json({
            quotationVersion: quotation.version,
            supplierId: quotation.supplierId,
            currencyCode: quotation.currencyCode,
            totalAmount: quotation.totalAmount.toString(),
            comparedQuotationIds: comparable.map((q) => q.id),
            policyReference: policy.id,
            policyVersion: policy.version,
          }),
        },
      });
      return;
    }
    if (action === 'ORDER') {
      requireRule(
        ['APPROVED', 'SOURCING'].includes(row.status),
        'INVALID_STATE',
        'درخواست برای تنظیم سفارش تأیید نشده است.',
      );
      const selection = await tx.procurementSelection.findFirst({
        where: { id: v.uuid(input.selectionId), requestId },
      });
      requireRule(selection, 'INVALID_REFERENCE', 'انتخاب پیشنهاد معتبر نیست.');
      const currentRequestVersion =
        await tx.procurementRequestVersion.findFirstOrThrow({
          where: { requestId },
          orderBy: { version: 'desc' },
        });
      requireRule(
        selection.requestVersionId === currentRequestVersion.id,
        'STALE_SELECTION',
        'پس از تغییر درخواست، انتخاب پیشنهاد باید بازبینی شود.',
      );
      const quotation = await tx.procurementQuotation.findUniqueOrThrow({
        where: { id: selection.quotationId },
      });
      requireRule(
        quotation.validUntil && quotation.validUntil > new Date(),
        'QUOTATION_EXPIRED',
        'اعتبار پیشنهاد تمام شده است.',
      );
      const supplier = await this.master.supplier(quotation.supplierId);
      const quotationLines = await tx.procurementQuotationItem.findMany({
        where: { quotationId: quotation.id },
        take: 101,
      });
      requireRule(
        quotationLines.length > 0 && quotationLines.length <= 100,
        'VALIDATION_ERROR',
        'اقلام پیشنهاد معتبر نیست.',
      );
      const allocated = await tx.$queryRaw<
        { requestItemId: string; quantity: Prisma.Decimal }[]
      >(Prisma.sql`
        SELECT i."requestItemId", SUM(i.quantity) AS quantity FROM procurement_order_item i
        JOIN procurement_order o ON o.id = i."orderId"
        JOIN procurement_order_version ov ON ov.id = i."orderVersionId" AND ov.version = o.version
        WHERE o."requestId" = ${requestId}::uuid AND o.status <> 'CANCELLED' GROUP BY i."requestItemId"`);
      for (const line of quotationLines) {
        const requested = draft.items.find(
          (item) => item.id === line.requestItemId,
        );
        const previous =
          allocated
            .find((item) => item.requestItemId === line.requestItemId)
            ?.quantity.toString() ?? '0';
        requireRule(
          requested &&
            decimal(previous) + decimal(line.quantity.toString()) <=
              decimal(requested.quantity),
          'ORDER_EXCEEDS_APPROVED_QUANTITY',
          'جمع سفارش‌ها از مقدار مصوب بیشتر است.',
        );
      }
      const id = randomUUID();
      const order = await tx.procurementOrder.create({
        data: {
          id,
          requestId,
          selectionId: selection.id,
          number: `PO-${id}`,
          supplierId: quotation.supplierId,
          status: 'PENDING_APPROVAL',
          currencyCode: quotation.currencyCode,
          totalAmount: quotation.totalAmount,
          expectedAt: new Date(v.date(input.expectedAt, 'expectedAt')),
          data: json({
            supplier,
            paymentTerms: v.text(input.paymentTerms, 'paymentTerms', 2000),
            deliveryLocation: v.text(
              input.deliveryLocation,
              'deliveryLocation',
              1000,
            ),
            makerUserId: actor.userId,
            quotationId: quotation.id,
          }),
        },
      });
      const version = await tx.procurementOrderVersion.create({
        data: {
          orderId: id,
          version: 1,
          createdByUserId: actor.userId,
          payload: json({ ...order, lines: quotationLines }),
        },
      });
      await tx.procurementOrderItem.createMany({
        data: quotationLines.map((line) => ({
          requestId,
          orderId: id,
          orderVersionId: version.id,
          requestItemId: line.requestItemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxAmount: line.taxAmount,
          discountAmount: line.discountAmount,
          extraCostAmount: line.extraCostAmount,
          totalAmount: line.totalAmount,
          data: json(
            draft.items.find((item) => item.id === line.requestItemId),
          ),
        })),
      });
      await this.requestOrderApproval(tx, row, order, actor);
      return;
    }
    if (action === 'ISSUE_ORDER') {
      const order = await this.order(tx, requestId, input.orderId);
      requireRule(
        order.status === 'APPROVED' &&
          ['APPROVED', 'SOURCING'].includes(row.status),
        'FINAL_APPROVAL_REQUIRED',
        'نسخه سفارش باید تأیید نهایی شده باشد.',
      );
      const approval = await tx.procurementApprovalSnapshot.findFirst({
        where: {
          requestId,
          payload: { path: ['commitment', 'orderId'], equals: order.id },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      requireRule(
        approval,
        'FINAL_APPROVAL_REQUIRED',
        'نسخه تأیید نهایی سفارش پیدا نشد.',
      );
      const currentRequest =
        await tx.procurementRequestVersion.findFirstOrThrow({
          where: { requestId },
          orderBy: { version: 'desc' },
        });
      const commitment = (approval.payload as unknown as CommitmentPolicy)
        .commitment;
      const undecided = await tx.procurementApprovalStep.count({
        where: { snapshotId: approval.id, status: { not: 'APPROVED' } },
      });
      requireRule(
        approval.requestVersionId === currentRequest.id &&
          commitment?.orderId === order.id &&
          commitment.version === order.version &&
          commitment.supplierId === order.supplierId &&
          commitment.currencyCode === order.currencyCode &&
          decimal(commitment.amount) ===
            decimal(order.totalAmount.toString()) &&
          undecided === 0,
        'FINAL_APPROVAL_REQUIRED',
        'تأیید نهایی باید به همین درخواست، نسخه سفارش، تأمین‌کننده و مبلغ متصل باشد.',
      );
      await this.master.supplier(order.supplierId);
      const selection = order.selectionId
        ? await tx.procurementSelection.findUnique({
            where: { id: order.selectionId },
          })
        : null;
      const quote = selection
        ? await tx.procurementQuotation.findUnique({
            where: { id: selection.quotationId },
          })
        : null;
      requireRule(
        quote?.validUntil && quote.validUntil > new Date(),
        'QUOTATION_EXPIRED',
        'برای صدور، پیشنهاد معتبر لازم است.',
      );
      await tx.procurementOrder.update({
        where: { id: order.id },
        data: {
          status: 'ISSUED',
          data: json({
            ...v.object(order.data),
            issuedAt: new Date().toISOString(),
            issuedByUserId: actor.userId,
          }),
        },
      });
      await tx.procurementRequest.update({
        where: { id: requestId },
        data: { status: 'SOURCING' },
      });
      await tx.procurementOutbox.create({
        data: {
          requestId,
          eventType: 'procurement.supplier-order-intent.v1',
          status: 'PENDING',
          payload: json({
            contract: 'procurement.supplier-order-intent.v1',
            branchId: row.branchId,
            requestId,
            orderId: order.id,
            orderVersion: order.version,
            supplierId: order.supplierId,
            currencyCode: order.currencyCode,
            amount: order.totalAmount.toString(),
            connection: 'SUPPLIER_DELIVERY_QUEUED',
          }),
        },
      });
      return;
    }
    if (action === 'AMEND_ORDER') {
      const order = await this.order(tx, requestId, input.orderId);
      this.issued(order);
      const reason = v.text(input.reason, 'reason', 1000);
      const lines = linesOf(input.lines);
      const amount = documentTotal(lines);
      const supplier = await this.master.supplier(v.uuid(input.supplierId));
      const currencyCode = v.currency(input.currencyCode);
      await this.master.assertCurrency(currencyCode);
      const oldItems = await this.orderItems(tx, order);
      // Fulfilled/billed versions require an explicit commercial correction agreement.
      const dependencies =
        (await tx.procurementReceipt.count({ where: { orderId: order.id } })) +
        (await tx.procurementServiceAcceptance.count({
          where: { orderId: order.id },
        })) +
        (await tx.procurementInvoice.count({ where: { orderId: order.id } }));
      requireRule(
        dependencies === 0,
        'AMENDMENT_POLICY_REQUIRED',
        'اصلاح سفارش دارای دریافت یا فاکتور به سیاست جبرانی مصوب نیاز دارد.',
      );
      requireRule(
        lines.length === oldItems.items.length &&
          lines.every((line) =>
            oldItems.items.some(
              (item) =>
                item.requestItemId === line.itemId &&
                decimal(item.quantity.toString()) === decimal(line.quantity),
            ),
          ),
        'AMENDMENT_POLICY_REQUIRED',
        'تغییر دامنه یا مقدار نیازمند تأیید مجدد درخواست است.',
      );
      const amended = await tx.procurementOrder.update({
        where: { id: order.id },
        data: {
          version: { increment: 1 },
          supplierId: supplier.id,
          currencyCode,
          totalAmount: amount,
          status: 'PENDING_APPROVAL',
          data: json({
            ...v.object(order.data),
            supplier,
            reason,
            makerUserId: actor.userId,
          }),
        },
      });
      const version = await tx.procurementOrderVersion.create({
        data: {
          orderId: order.id,
          version: amended.version,
          payload: json({ ...amended, lines }),
          createdByUserId: actor.userId,
        },
      });
      await tx.procurementOrderItem.createMany({
        data: lines.map((line) => ({
          requestId,
          orderId: order.id,
          orderVersionId: version.id,
          requestItemId: line.itemId,
          ...storedLine(line),
          data: json(draft.items.find((item) => item.id === line.itemId)),
        })),
      });
      await this.requestOrderApproval(tx, row, amended, actor);
      return;
    }
    if (action === 'RECEIVE') {
      const order = await this.order(tx, requestId, input.orderId);
      this.issued(order);
      const { version, items } = await this.orderItems(tx, order);
      const incoming = v.array(input.lines, 'lines').map((value) => {
        const line = v.object(value, [
          'itemId',
          'quantity',
          'acceptedQuantity',
          'rejectedQuantity',
        ]);
        return {
          itemId: v.uuid(line.itemId),
          quantity: v.money(line.quantity),
          acceptedQuantity: v.money(line.acceptedQuantity),
          rejectedQuantity: v.money(line.rejectedQuantity),
        };
      });
      requireRule(
        incoming.length > 0 &&
          new Set(incoming.map((line) => line.itemId)).size === incoming.length,
        'DUPLICATE_ITEM',
        'اقلام دریافت معتبر نیست.',
      );
      const documents = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      const totals = await tx.procurementReceiptItem.groupBy({
        by: ['orderItemId'],
        where: { orderId: order.id },
        _sum: { quantity: true },
      });
      const corrections = await tx.$queryRaw<
        { orderItemId: string; quantity: Prisma.Decimal }[]
      >(
        Prisma.sql`SELECT i."orderItemId", SUM(a."receivedDelta") AS quantity FROM procurement_receipt_adjustment a JOIN procurement_receipt_item i ON i.id = a."receiptItemId" WHERE a."orderId" = ${order.id}::uuid GROUP BY i."orderItemId"`,
      );
      const returns = await tx.$queryRaw<
        { orderItemId: string; quantity: Prisma.Decimal }[]
      >(
        Prisma.sql`SELECT i."orderItemId", SUM(a.quantity) AS quantity FROM procurement_return a JOIN procurement_receipt_item i ON i.id = a."receiptItemId" WHERE a."orderId" = ${order.id}::uuid GROUP BY i."orderItemId"`,
      );
      for (const line of incoming) {
        const item = items.find((item) => item.id === line.itemId);
        requireRule(
          item && v.object(item.data).kind === 'GOODS',
          'INVALID_REFERENCE',
          'این قلم کالا متعلق به نسخه سفارش نیست.',
        );
        const before =
          decimal(
            totals
              .find((total) => total.orderItemId === item.id)
              ?._sum.quantity?.toString() ?? '0',
          ) +
          signed(
            corrections
              .find((total) => total.orderItemId === item.id)
              ?.quantity.toString() ?? '0',
          ) -
          decimal(
            returns
              .find((total) => total.orderItemId === item.id)
              ?.quantity.toString() ?? '0',
          );
        assertReceipt(
          item.quantity.toString(),
          decimalString(before),
          line.quantity,
          line.acceptedQuantity,
          line.rejectedQuantity,
        );
      }
      const id = randomUUID();
      await tx.procurementReceipt.create({
        data: {
          id,
          requestId,
          orderId: order.id,
          orderVersionId: version.id,
          number: `GR-${id}`,
          receivedAt: new Date(v.date(input.receivedAt, 'receivedAt')),
          receivedByUserId: actor.userId,
          data: json({
            location: v.text(input.location, 'location', 1000),
            documents,
          }),
        },
      });
      await tx.procurementReceiptItem.createMany({
        data: incoming.map((line) => ({
          receiptId: id,
          orderId: order.id,
          orderVersionId: version.id,
          orderItemId: line.itemId,
          quantity: line.quantity,
          acceptedQuantity: line.acceptedQuantity,
          rejectedQuantity: line.rejectedQuantity,
        })),
      });
      if (
        incoming.some(
          (line) =>
            decimal(line.rejectedQuantity) > 0n ||
            decimal(line.acceptedQuantity) + decimal(line.rejectedQuantity) <
              decimal(line.quantity),
        )
      )
        await tx.procurementDiscrepancy.create({
          data: {
            requestId,
            orderId: order.id,
            receiptId: id,
            kind: 'RECEIPT',
            description:
              'دریافت دارای مقدار ردشده یا در انتظار تعیین تکلیف است.',
            data: json({ lines: incoming }),
          },
        });
      return;
    }
    if (action === 'ACCEPT_SERVICE') {
      const order = await this.order(tx, requestId, input.orderId);
      this.issued(order);
      const { version, items } = await this.orderItems(tx, order);
      const item = items.find((item) => item.id === v.uuid(input.itemId));
      requireRule(
        item && v.object(item.data).kind === 'SERVICE',
        'INVALID_REFERENCE',
        'قلم خدمت متعلق به نسخه سفارش نیست.',
      );
      const quantity = v.money(input.quantity);
      const previous = await tx.procurementServiceAcceptance.aggregate({
        where: { orderItemId: item.id },
        _sum: { quantity: true },
      });
      assertReceipt(
        item.quantity.toString(),
        previous._sum.quantity?.toString() ?? '0',
        quantity,
        quantity,
        '0',
      );
      const evidence = v.text(input.evidence, 'evidence', 2000);
      const documents = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      await tx.procurementServiceAcceptance.create({
        data: {
          requestId,
          orderId: order.id,
          orderVersionId: version.id,
          orderItemId: item.id,
          quantity,
          acceptedByUserId: actor.userId,
          acceptedAt: new Date(v.date(input.acceptedAt, 'acceptedAt')),
          criteriaSnapshot: json({
            criteria: v.object(item.data).acceptanceCriteria,
            evidence,
          }),
          data: json({ documents }),
        },
      });
      return;
    }
    if (action === 'CLOSE_REMAINDER' || action === 'CANCEL_ORDER') {
      const order = await this.order(tx, requestId, input.orderId);
      requireRule(
        !['CLOSED', 'CANCELLED'].includes(order.status),
        'INVALID_STATE',
        'سفارش نهایی است.',
      );
      const reason = v.text(input.reason, 'reason', 1000);
      const unresolved = await tx.procurementDiscrepancy.count({
        where: { orderId: order.id, status: 'OPEN' },
      });
      requireRule(
        unresolved === 0,
        'OPEN_DISCREPANCY',
        'ابتدا مغایرت‌های باز را تعیین تکلیف کنید.',
      );
      const received =
        (await tx.procurementReceipt.count({ where: { orderId: order.id } })) +
        (await tx.procurementServiceAcceptance.count({
          where: { orderId: order.id },
        })) +
        (await tx.procurementInvoice.count({ where: { orderId: order.id } }));
      requireRule(
        action !== 'CANCEL_ORDER' || received === 0,
        'COMMITTED_ORDER',
        'سفارش دارای تحویل یا فاکتور قابل لغو کامل نیست.',
      );
      await tx.procurementOrder.update({
        where: { id: order.id },
        data: {
          status: action === 'CANCEL_ORDER' ? 'CANCELLED' : 'CLOSED',
          data: json({
            ...v.object(order.data),
            closure: {
              reason,
              actorUserId: actor.userId,
              at: new Date().toISOString(),
            },
          }),
        },
      });
      return;
    }
    if (action === 'DISCREPANCY') {
      const order = await this.order(tx, requestId, input.orderId);
      const kind = v.text(input.kind, 'kind', 50);
      requireRule(
        ['SHORTAGE', 'DAMAGE', 'DELAY', 'SPECIFICATION'].includes(kind),
        'VALIDATION_ERROR',
        'نوع مغایرت معتبر نیست.',
      );
      await tx.procurementDiscrepancy.create({
        data: {
          requestId,
          orderId: order.id,
          kind,
          description: v.text(input.description, 'description', 2000),
          data: { createdByUserId: actor.userId },
        },
      });
      return;
    }
    if (action === 'RESOLVE_DISCREPANCY') {
      const discrepancy = await tx.procurementDiscrepancy.findFirst({
        where: { id: v.uuid(input.discrepancyId), requestId, status: 'OPEN' },
      });
      requireRule(discrepancy, 'INVALID_REFERENCE', 'مغایرت باز پیدا نشد.');
      const resolution = v.text(input.resolution, 'resolution', 30);
      requireRule(
        ['REPLACE', 'RETURN', 'REJECT'].includes(resolution),
        'ADJUSTMENT_POLICY_REQUIRED',
        'پذیرش با تعدیل نیازمند سیاست مصوب است.',
      );
      const reason = v.text(input.reason, 'reason', 1000);
      await tx.procurementDiscrepancy.update({
        where: { id: discrepancy.id },
        data: {
          status: 'RESOLVED',
          resolution,
          version: { increment: 1 },
          data: json({
            ...v.object(discrepancy.data),
            resolutionReason: reason,
            resolvedBy: actor.userId,
          }),
        },
      });
      return;
    }
    if (action === 'RETURN') {
      const item = await tx.procurementReceiptItem.findUnique({
        where: { id: v.uuid(input.receiptItemId) },
      });
      requireRule(item, 'INVALID_REFERENCE', 'قلم رسید پیدا نشد.');
      await this.order(tx, requestId, item.orderId);
      const quantity = v.money(input.quantity);
      const disposition = v.text(
        input.disposition ?? 'ACCEPTED',
        'disposition',
        20,
      );
      requireRule(
        ['ACCEPTED', 'REJECTED'].includes(disposition),
        'VALIDATION_ERROR',
        'نوع مقدار مرجوعی معتبر نیست.',
      );
      const previous = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>(
        Prisma.sql`SELECT COALESCE(SUM(quantity), 0) AS quantity FROM procurement_return WHERE "receiptItemId" = ${item.id}::uuid AND COALESCE(data->>'disposition', 'ACCEPTED') = ${disposition}`,
      );
      const adjustments = await tx.procurementReceiptAdjustment.aggregate({
        where: { receiptItemId: item.id },
        _sum: { acceptedDelta: true, rejectedDelta: true },
      });
      const available =
        disposition === 'ACCEPTED'
          ? decimal(item.acceptedQuantity.toString()) +
            signed(adjustments._sum.acceptedDelta?.toString() ?? '0')
          : decimal(item.rejectedQuantity.toString()) +
            signed(adjustments._sum.rejectedDelta?.toString() ?? '0');
      requireRule(
        decimal(quantity) > 0n &&
          decimal(quantity) +
            decimal(previous[0]?.quantity.toString() ?? '0') <=
            available,
        'RETURN_EXCEEDS_ACCEPTANCE',
        'مرجوعی از مقدار معتبر این وضعیت بیشتر است.',
      );
      const documents = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      const createdReturn = await tx.procurementReturn.create({
        data: {
          requestId,
          orderId: item.orderId,
          receiptItemId: item.id,
          quantity,
          reason: v.text(input.reason, 'reason', 1000),
          returnedByUserId: actor.userId,
          returnedAt: new Date(v.date(input.returnedAt, 'returnedAt')),
          data: json({
            disposition,
            documents,
            financeCorrectionStatus:
              disposition === 'ACCEPTED' ? 'PENDING' : 'NOT_APPLICABLE',
          }),
        },
      });
      if (disposition === 'ACCEPTED') {
        const eventId = randomUUID();
        await tx.procurementOutbox.create({
          data: {
            requestId,
            eventId,
            eventType: 'procurement.finance-correction.v1',
            status: 'PENDING',
            payload: json({
              contract: 'procurement.finance-correction.v1',
              eventId,
              sourceVersion: 1,
              returnId: createdReturn.id,
              requestId,
              orderId: item.orderId,
              receiptItemId: item.id,
              branchId: row.branchId,
              quantity,
              reason: createdReturn.reason,
              returnedAt: createdReturn.returnedAt.toISOString(),
            }),
          },
        });
      }
      await tx.procurementDiscrepancy.create({
        data: {
          requestId,
          orderId: item.orderId,
          kind:
            disposition === 'ACCEPTED'
              ? 'RETURN_FINANCE_REVIEW'
              : 'RETURN_REPLACEMENT',
          description:
            disposition === 'ACCEPTED'
              ? 'مرجوعی ثبت شد؛ تعیین اثر مالی از مسیر مالی لازم است.'
              : 'کالای ردشده مرجوع شد؛ جایگزینی یا بستن مانده لازم است.',
        },
      });
      return;
    }
    if (action === 'ADJUST_RECEIPT') {
      requireRule(
        actor.permissions.includes('procurement.receipt.manage'),
        'FORBIDDEN',
        'مجوز دریافت و پذیرش برای اصلاح رسید لازم است.',
      );
      const receipt = await tx.procurementReceiptItem.findUnique({
        where: { id: v.uuid(input.receiptItemId) },
      });
      requireRule(receipt, 'INVALID_REFERENCE', 'قلم رسید معتبر نیست.');
      const order = await this.order(tx, requestId, receipt.orderId);
      requireRule(
        ['ISSUED', 'CLOSED'].includes(order.status),
        'INVALID_STATE',
        'سفارش دریافت‌شده معتبر نیست.',
      );
      const receivedDelta = v.signedMoney(input.receivedDelta);
      const acceptedDelta = v.signedMoney(input.acceptedDelta);
      const rejectedDelta = v.signedMoney(input.rejectedDelta);
      requireRule(
        [receivedDelta, acceptedDelta, rejectedDelta].some(
          (value) => signed(value) !== 0n,
        ),
        'VALIDATION_ERROR',
        'حداقل یک مقدار اصلاح لازم است.',
      );
      const previous = await tx.procurementReceiptAdjustment.aggregate({
        where: { receiptItemId: receipt.id },
        _sum: { receivedDelta: true, acceptedDelta: true, rejectedDelta: true },
      });
      const received =
        decimal(receipt.quantity.toString()) +
        signed(previous._sum.receivedDelta?.toString() ?? '0') +
        signed(receivedDelta);
      const accepted =
        decimal(receipt.acceptedQuantity.toString()) +
        signed(previous._sum.acceptedDelta?.toString() ?? '0') +
        signed(acceptedDelta);
      const rejected =
        decimal(receipt.rejectedQuantity.toString()) +
        signed(previous._sum.rejectedDelta?.toString() ?? '0') +
        signed(rejectedDelta);
      requireRule(
        received >= 0n &&
          accepted >= 0n &&
          rejected >= 0n &&
          accepted + rejected <= received,
        'INVALID_RECEIPT_ADJUSTMENT',
        'مقادیر تجمعی اصلاح رسید معتبر نیست.',
      );
      const returns = await tx.$queryRaw<
        { disposition: string; quantity: Prisma.Decimal }[]
      >(
        Prisma.sql`SELECT COALESCE(data->>'disposition', 'ACCEPTED') AS disposition, SUM(quantity) AS quantity FROM procurement_return WHERE "receiptItemId" = ${receipt.id}::uuid GROUP BY disposition`,
      );
      requireRule(
        returns.every(
          (item) =>
            decimal(item.quantity.toString()) <=
            (item.disposition === 'REJECTED' ? rejected : accepted),
        ),
        'INVALID_RECEIPT_ADJUSTMENT',
        'مقدار قبلاً مرجوع‌شده را نمی‌توان دوباره کاهش داد.',
      );
      const orderItem = await tx.procurementOrderItem.findUniqueOrThrow({
        where: { id: receipt.orderItemId },
      });
      const totals = await tx.$queryRaw<
        {
          received: Prisma.Decimal;
          accepted: Prisma.Decimal;
          invoiced: Prisma.Decimal;
        }[]
      >(Prisma.sql`
        SELECT COALESCE((SELECT SUM(i.quantity) FROM procurement_receipt_item i WHERE i."orderItemId" = ${orderItem.id}::uuid),0)
          + COALESCE((SELECT SUM(a."receivedDelta") FROM procurement_receipt_adjustment a JOIN procurement_receipt_item i ON i.id=a."receiptItemId" WHERE i."orderItemId" = ${orderItem.id}::uuid),0)
          - COALESCE((SELECT SUM(rt.quantity) FROM procurement_return rt JOIN procurement_receipt_item i ON i.id=rt."receiptItemId" WHERE i."orderItemId" = ${orderItem.id}::uuid),0) AS received,
        COALESCE((SELECT SUM(i."acceptedQuantity") FROM procurement_receipt_item i WHERE i."orderItemId" = ${orderItem.id}::uuid),0)
          + COALESCE((SELECT SUM(a."acceptedDelta") FROM procurement_receipt_adjustment a JOIN procurement_receipt_item i ON i.id=a."receiptItemId" WHERE i."orderItemId" = ${orderItem.id}::uuid),0)
          - COALESCE((SELECT SUM(rt.quantity) FROM procurement_return rt JOIN procurement_receipt_item i ON i.id=rt."receiptItemId" WHERE i."orderItemId" = ${orderItem.id}::uuid AND COALESCE(rt.data->>'disposition','ACCEPTED')='ACCEPTED'),0) AS accepted,
        COALESCE((SELECT SUM(i.quantity) FROM procurement_invoice_item i JOIN procurement_invoice n ON n.id=i."invoiceId" WHERE i."orderItemId" = ${orderItem.id}::uuid AND n.status IN ('MATCHED','WAITING_FINANCE','ACCEPTED','PAID')),0) AS invoiced`);
      const total = totals[0]!;
      requireRule(
        signed(total.received.toString()) + signed(receivedDelta) <=
          decimal(orderItem.quantity.toString()),
        'RECEIPT_EXCEEDS_ORDER',
        'اصلاح از مقدار سفارش بیشتر می‌شود.',
      );
      requireRule(
        signed(total.accepted.toString()) + signed(acceptedDelta) >=
          decimal(total.invoiced.toString()),
        'FINANCIAL_ADJUSTMENT_POLICY_REQUIRED',
        'کاهش مقدار تطبیق‌شده نیازمند اصلاح مصوب تجاری و مالی است.',
      );
      const documents = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      await tx.procurementReceiptAdjustment.create({
        data: {
          requestId,
          orderId: order.id,
          orderVersionId: receipt.orderVersionId,
          receiptItemId: receipt.id,
          receivedDelta,
          acceptedDelta,
          rejectedDelta,
          reason: v.text(input.reason, 'reason', 1000),
          actorUserId: actor.userId,
          data: json({
            documents,
            before: {
              received: decimalString(received - signed(receivedDelta)),
              accepted: decimalString(accepted - signed(acceptedDelta)),
              rejected: decimalString(rejected - signed(rejectedDelta)),
            },
            after: {
              received: decimalString(received),
              accepted: decimalString(accepted),
              rejected: decimalString(rejected),
            },
          }),
        },
      });
      return;
    }
    if (action === 'INVOICE') {
      const order = await this.order(tx, requestId, input.orderId);
      requireRule(
        ['ISSUED', 'CLOSED'].includes(order.status),
        'INVALID_STATE',
        'فاکتور باید به سفارش صادرشده متصل باشد.',
      );
      const { version, items } = await this.orderItems(tx, order);
      const lines = linesOf(input.lines);
      const totalAmount = documentTotal(lines);
      requireRule(
        lines.every((line) => items.some((item) => item.id === line.itemId)),
        'INVALID_REFERENCE',
        'قلم فاکتور متعلق به نسخه سفارش نیست.',
      );
      const targets = await this.legal.issueTargets(actor, 'prompt');
      requireRule(
        !targets.data.requiresExplicitIssuer &&
          targets.data.targets.length === 1,
        'ISSUER_REQUIRED',
        'شرکت مشخص صادرکننده را انتخاب کنید؛ زمینه همه شرکت‌ها مجاز نیست.',
      );
      const issuer = targets.data.targets[0]!;
      const branding = await this.legal.branding(issuer.id, actor);
      const number = v.text(input.number, 'number', 100);
      const normalizedNumber = normalizeInvoiceNumber(number);
      const duplicate = await tx.procurementInvoice.findFirst({
        where: {
          supplierId: order.supplierId,
          issuerLegalEntityId: issuer.id,
          normalizedNumber,
        },
        select: { id: true },
      });
      requireRule(
        !duplicate,
        'DUPLICATE_INVOICE',
        'شماره فاکتور این تأمین‌کننده و شرکت قبلاً ثبت شده است.',
      );
      const currencyCode = v.currency(input.currencyCode);
      await this.master.assertCurrency(currencyCode);
      const documents = await this.documentsFor(
        input.documents,
        row.branchId,
        actor,
        true,
      );
      const invoice = await tx.procurementInvoice.create({
        data: {
          requestId,
          orderId: order.id,
          orderVersionId: version.id,
          supplierId: order.supplierId,
          issuerLegalEntityId: issuer.id,
          number,
          normalizedNumber,
          currencyCode,
          totalAmount,
          issuedAt: new Date(v.date(input.issuedAt, 'issuedAt')),
          dueAt: input.dueAt ? new Date(v.date(input.dueAt, 'dueAt')) : null,
          data: json({ documents, issuer, branding: branding.data }),
        },
      });
      await tx.procurementInvoiceItem.createMany({
        data: lines.map((line) => ({
          invoiceId: invoice.id,
          orderId: order.id,
          orderVersionId: version.id,
          orderItemId: line.itemId,
          ...storedLine(line),
        })),
      });
      await this.match(tx, row, invoice.id, actor);
      return;
    }
    if (action === 'MATCH_INVOICE') {
      await this.match(tx, row, v.uuid(input.invoiceId), actor);
      return;
    }
    if (action === 'SUBMIT_FINANCE') {
      const invoiceId = v.uuid(input.invoiceId);
      const { invoice, result } = await this.match(tx, row, invoiceId, actor);
      requireRule(
        result.matched,
        'INVOICE_MISMATCH',
        'فاکتور تا رفع مغایرت قابل ارجاع نیست.',
      );
      requireRule(
        (await tx.procurementDiscrepancy.count({
          where: { orderId: invoice.orderId, status: 'OPEN' },
        })) === 0,
        'OPEN_DISCREPANCY',
        'مغایرت سفارش باز است.',
      );
      const sourceKey = `procurement:${invoice.id}:${invoice.version}`;
      const existing = await tx.procurementFinanceHandoff.findUnique({
        where: { sourceKey },
      });
      if (!existing) {
        const pinned = await tx.procurementOrderVersion.findUniqueOrThrow({
          where: { id: invoice.orderVersionId },
        });
        const orderData = v.object(v.object(pinned.payload).data);
        const invoiceData = v.object(invoice.data);
        const issuer = v.object(invoiceData.issuer);
        const lines = await tx.procurementInvoiceItem.findMany({
          where: { invoiceId },
          take: 101,
        });
        requireRule(
          lines.length > 0 && lines.length <= 100,
          'INVALID_REFERENCE',
          'اقلام منشأ مالی معتبر نیست.',
        );
        const payload: ProcurementFinanceSourceV1 = {
          contract: 'procurement.finance-source.v1',
          sourceId: invoiceId,
          sourceVersion: invoice.version,
          idempotencyKey: sourceKey,
          branchId: row.branchId,
          issuer: {
            id: String(issuer.id),
            version: Number(issuer.version),
            label: String(issuer.persianName),
          },
          supplier: orderData.supplier as ProcurementReferenceV1,
          orderId: invoice.orderId,
          orderVersion: pinned.version,
          currencyCode: invoice.currencyCode,
          amount: invoice.totalAmount.toString(),
          dueAt: invoice.dueAt?.toISOString() ?? null,
          documents: invoiceData.documents as ProcurementDocumentReferenceV1[],
          lines: lines.map((line) => ({
            itemId: line.orderItemId,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            amount: line.totalAmount.toString(),
          })),
        };
        requireRule(
          payload.issuer.version > 0 && payload.supplier?.version > 0,
          'INVALID_REFERENCE',
          'نسخه مرجع شرکت و تأمین‌کننده لازم است.',
        );
        const handoff = await tx.procurementFinanceHandoff.create({
          data: {
            requestId,
            invoiceId,
            invoiceVersion: invoice.version,
            sourceKey,
            status: 'PENDING',
            lastErrorCode: null,
            payload: json(payload),
          },
        });
        await tx.procurementOutbox.create({
          data: {
            requestId,
            handoffId: handoff.id,
            eventType: 'procurement.finance-source.v1',
            status: 'PENDING',
            payload: handoff.payload as Prisma.InputJsonValue,
          },
        });
      }
      await tx.procurementInvoice.update({
        where: { id: invoice.id },
        data: { status: 'WAITING_FINANCE' },
      });
      return;
    }
    requireRule(false, 'VALIDATION_ERROR', 'اقدام پیاده‌سازی نشده است.');
  }
  private async match(
    tx: ProcurementTx,
    row: ProcurementRow,
    invoiceId: string,
    actor: AuthenticatedActor,
  ) {
    const invoice = await tx.procurementInvoice.findFirst({
      where: { id: invoiceId, requestId: row.id },
    });
    requireRule(
      invoice,
      'INVALID_REFERENCE',
      'فاکتور متعلق به این درخواست نیست.',
    );
    const pinned = await tx.procurementOrderVersion.findUniqueOrThrow({
      where: { id: invoice.orderVersionId },
    });
    const orderPayload = v.object(pinned.payload);
    const [
      items,
      lines,
      acceptedGoods,
      acceptedServices,
      previous,
      returns,
      adjustments,
    ] = await Promise.all([
      tx.procurementOrderItem.findMany({
        where: { orderVersionId: pinned.id },
        take: 100,
      }),
      tx.procurementInvoiceItem.findMany({ where: { invoiceId }, take: 100 }),
      tx.procurementReceiptItem.groupBy({
        by: ['orderItemId'],
        where: { orderVersionId: pinned.id },
        _sum: { acceptedQuantity: true },
      }),
      tx.procurementServiceAcceptance.groupBy({
        by: ['orderItemId'],
        where: { orderVersionId: pinned.id },
        _sum: { quantity: true },
      }),
      tx.$queryRaw<{ orderItemId: string; quantity: Prisma.Decimal }[]>(
        Prisma.sql`SELECT i."orderItemId", SUM(i.quantity) AS quantity FROM procurement_invoice_item i JOIN procurement_invoice n ON n.id = i."invoiceId" WHERE n."orderId" = ${invoice.orderId}::uuid AND n.id <> ${invoiceId}::uuid AND n.status IN ('MATCHED','WAITING_FINANCE','ACCEPTED','PAID') GROUP BY i."orderItemId"`,
      ),
      tx.$queryRaw<{ orderItemId: string; quantity: Prisma.Decimal }[]>(
        Prisma.sql`SELECT i."orderItemId", SUM(r.quantity) AS quantity FROM procurement_return r JOIN procurement_receipt_item i ON i.id = r."receiptItemId" WHERE r."orderId" = ${invoice.orderId}::uuid AND COALESCE(r.data->>'disposition','ACCEPTED') = 'ACCEPTED' GROUP BY i."orderItemId"`,
      ),
      tx.$queryRaw<{ orderItemId: string; quantity: Prisma.Decimal }[]>(
        Prisma.sql`SELECT i."orderItemId", SUM(a."acceptedDelta") AS quantity FROM procurement_receipt_adjustment a JOIN procurement_receipt_item i ON i.id = a."receiptItemId" WHERE a."orderId" = ${invoice.orderId}::uuid GROUP BY i."orderItemId"`,
      ),
    ]);
    const accepted = new Map<string, string>();
    for (const item of items) {
      const goods = decimal(
        acceptedGoods
          .find((r) => r.orderItemId === item.id)
          ?._sum.acceptedQuantity?.toString() ?? '0',
      );
      const services = decimal(
        acceptedServices
          .find((r) => r.orderItemId === item.id)
          ?._sum.quantity?.toString() ?? '0',
      );
      const returned = decimal(
        returns.find((r) => r.orderItemId === item.id)?.quantity.toString() ??
          '0',
      );
      accepted.set(
        item.id,
        decimalString(
          goods +
            services -
            returned +
            signed(
              adjustments
                .find((r) => r.orderItemId === item.id)
                ?.quantity.toString() ?? '0',
            ),
        ),
      );
    }
    const result = matchInvoice(
      String(orderPayload.currencyCode),
      invoice.currencyCode,
      items.map(commercial),
      accepted,
      new Map(previous.map((r) => [r.orderItemId, r.quantity.toString()])),
      lines.map((line) => ({ ...commercial(line), itemId: line.orderItemId })),
    );
    await tx.procurementInvoiceMatch.create({
      data: {
        invoiceId,
        invoiceVersion: invoice.version,
        orderId: invoice.orderId,
        orderVersionId: pinned.id,
        status: result.matched ? 'MATCHED' : 'MISMATCH',
        matchedByUserId: actor.userId,
        payload: json(result),
      },
    });
    await tx.procurementInvoice.update({
      where: { id: invoiceId },
      data: {
        status: result.matched
          ? invoice.status === 'WAITING_FINANCE'
            ? 'WAITING_FINANCE'
            : 'MATCHED'
          : 'MISMATCH',
      },
    });
    return { invoice, result };
  }
  async records(
    tx: ProcurementTx,
    requestId: string,
    kind: string,
    page: number,
  ) {
    const args = {
      where: { requestId },
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: 51,
      skip: (page - 1) * 50,
    };
    let rows: unknown[];
    if (kind === 'quotations') {
      const parents = await tx.procurementQuotation.findMany(args);
      const lines = await tx.procurementQuotationItem.findMany({
        where: { quotationId: { in: parents.map((r) => r.id) } },
        take: 5100,
      });
      rows = parents.map((r) => ({
        ...r,
        lines: lines.filter((line) => line.quotationId === r.id),
      }));
    } else if (kind === 'orders') {
      const parents = await tx.procurementOrder.findMany(args);
      const versions = await tx.procurementOrderVersion.findMany({
        where: {
          OR: parents.map((r) => ({ orderId: r.id, version: r.version })),
        },
        take: 51,
      });
      const lines = await tx.procurementOrderItem.findMany({
        where: { orderVersionId: { in: versions.map((r) => r.id) } },
        take: 5100,
      });
      rows = parents.map((r) => ({
        ...r,
        lines: lines.filter((line) => line.orderId === r.id),
      }));
    } else if (kind === 'receipts') {
      const parents = await tx.procurementReceipt.findMany(args);
      const lines = await tx.procurementReceiptItem.findMany({
        where: { receiptId: { in: parents.map((r) => r.id) } },
        take: 5100,
      });
      rows = parents.map((r) => ({
        ...r,
        lines: lines.filter((line) => line.receiptId === r.id),
      }));
    } else if (kind === 'invoices') {
      const parents = await tx.procurementInvoice.findMany(args);
      const lines = await tx.procurementInvoiceItem.findMany({
        where: { invoiceId: { in: parents.map((r) => r.id) } },
        take: 5100,
      });
      rows = parents.map((r) => ({
        ...r,
        lines: lines.filter((line) => line.invoiceId === r.id),
      }));
    } else if (kind === 'acceptances')
      rows = await tx.procurementServiceAcceptance.findMany(args);
    else if (kind === 'selections')
      rows = await tx.procurementSelection.findMany(args);
    else if (kind === 'discrepancies')
      rows = await tx.procurementDiscrepancy.findMany(args);
    else if (kind === 'returns')
      rows = await tx.procurementReturn.findMany(args);
    else if (kind === 'adjustments')
      rows = await tx.procurementReceiptAdjustment.findMany(args);
    else if (kind === 'handoffs')
      rows = await tx.procurementFinanceHandoff.findMany(args);
    else if (kind === 'audit') rows = await tx.procurementAudit.findMany(args);
    else if (kind === 'versions')
      rows = await tx.procurementRequestVersion.findMany(args);
    else {
      requireRule(false, 'VALIDATION_ERROR', 'نوع فهرست معتبر نیست.');
    }
    return {
      items: rows.slice(0, 50),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
}
