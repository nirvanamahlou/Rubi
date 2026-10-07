import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PROCUREMENT_PERMISSION_CODES,
  type AuthenticatedActor,
  type ProcurementDraftV1,
  type ProcurementRequestV1,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import type { DocumentsService } from '../documents/documents.service';
import type { HrProcurementDirectory } from '../hr/hr-procurement-directory';
import type { IamProcurementDirectory } from '../iam/iam-procurement-directory';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import type { MasterProcurementDirectory } from '../master-data/master-procurement-directory';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { AutomationTasksService } from '../tasks/automation-tasks.service';
import type {
  ApprovalPolicy,
  CommercialLine,
} from './domain/procurement.rules';
import { ProcurementOperations } from './procurement.operations';
import { ProcurementPolicyPort } from './procurement.ports';
import { ProcurementPublicService } from './procurement-public.service';
import {
  json,
  procurementBoundary,
  procurementCategoryKey,
  ProcurementService,
} from './procurement.service';

// Explicit opt-in and exact endpoint/database guards: no ordinary test run can
// connect to business data. Fixtures persist only in the task-owned test DB.
describe.skipIf(process.env.PROCUREMENT_API_DATABASE_TEST !== '1')(
  'Procurement service with PostgreSQL',
  () => {
    let database: DatabaseService;
    let service: ProcurementService;
    let branch: string;
    let otherBranch: string;
    let supplier: string;
    let supplierEnabled = true;
    let issuer: string;
    let maker: AuthenticatedActor;
    let checker1: AuthenticatedActor;
    let checker2: AuthenticatedActor;
    let colleague: AuthenticatedActor;
    let outsider: AuthenticatedActor;
    let approvedPolicy: ApprovalPolicy | null;
    const identities = new Map<
      string,
      { actor: AuthenticatedActor; unit: string }
    >();
    const documentId = randomUUID();
    const documentVersionId = randomUUID();
    const documents = [{ id: documentId, versionId: documentVersionId }];
    const instant = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
    const basePermissions: AuthenticatedActor['permissions'] = [
      ...PROCUREMENT_PERMISSION_CODES,
      'documents.metadata.read',
      'documents.procurement.read',
    ];

    async function identity(unit: string, branchIds: string[]) {
      const id = randomUUID();
      await database.client.user.create({
        data: {
          id,
          username: `proc-test-${id}`,
          displayName: 'Synthetic Procurement Test',
          passwordHash: 'disabled-synthetic-fixture',
        },
      });
      const actor: AuthenticatedActor = {
        userId: id,
        sessionId: randomUUID(),
        permissions: [...basePermissions],
        branchIds,
      };
      identities.set(id, { actor, unit });
      return actor;
    }
    function fixture(
      changes: Partial<ProcurementDraftV1> = {},
    ): ProcurementDraftV1 {
      return {
        title: `Synthetic purchase ${randomUUID()}`,
        branchId: branch,
        unitId: 'unit-a',
        purchaseType: 'GENERAL',
        category: 'OFFICE',
        needReason: 'Synthetic test requirement',
        requiredAt: nextMonth,
        priority: 'NORMAL',
        urgent: false,
        urgencyReason: '',
        estimatedAmount: '100',
        currencyCode: 'IRR',
        unknownEstimateReason: '',
        deliveryLocation: 'Synthetic office',
        notes: '',
        documents: [],
        origin: { kind: 'GENERAL' },
        items: [
          {
            id: randomUUID(),
            kind: 'GOODS',
            description: 'Synthetic goods',
            specification: 'Specification A',
            quantity: '10',
            unit: 'piece',
            acceptanceCriteria: '',
            period: '',
          },
        ],
        ...changes,
      };
    }
    const commercial = (
      itemId: string,
      changes: Partial<CommercialLine> = {},
    ): CommercialLine => ({
      itemId,
      quantity: '10',
      unitPrice: '10',
      discount: '0',
      tax: '0',
      extraCost: '0',
      ...changes,
    });
    const create = (draft = fixture(), actor = maker, key = randomUUID()) =>
      procurementBoundary(() => service.create(draft, key, actor));
    const command = (
      row: ProcurementRequestV1,
      action: string,
      input: Record<string, unknown> = {},
      actor = maker,
      key = randomUUID(),
    ) =>
      procurementBoundary(() =>
        service.command(
          row.id,
          { action, expectedVersion: row.version, ...input },
          key,
          actor,
        ),
      );
    async function rejected(
      operation: () => Promise<unknown>,
      status: number,
      code?: string,
    ) {
      let failure: unknown;
      try {
        await operation();
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(HttpException);
      expect((failure as HttpException).getStatus()).toBe(status);
      if (code)
        expect((failure as HttpException).getResponse()).toMatchObject({
          code,
        });
    }
    async function approve(row: ProcurementRequestV1) {
      row = await command(row, 'DECIDE', { decision: 'APPROVED' }, checker1);
      expect(row.status).toBe('IN_REVIEW');
      row = await command(row, 'DECIDE', { decision: 'APPROVED' }, checker2);
      expect(row.status).toBe('APPROVED');
      return row;
    }
    async function approvedRequest(draft = fixture()) {
      return approve(await command(await create(draft), 'SUBMIT'));
    }
    it('rejects and permanently deletes atomically only for the independent approver with deletion permission', async () => {
      const row = await command(await create(), 'SUBMIT');
      const body = {
        decision: 'REJECTED',
        reason: 'Synthetic rejection',
        deleteRejected: true,
      };
      await rejected(
        () => command(row, 'DECIDE', body, maker),
        403,
        'NO_VALID_APPROVER',
      );
      await rejected(
        () =>
          command(row, 'DECIDE', body, {
            ...checker1,
            permissions: checker1.permissions.filter(
              (p) => p !== 'procurement.request.cancel',
            ),
          }),
        403,
      );
      expect((await service.detail(row.id, maker)).version).toBe(row.version);
      await rejected(
        () =>
          command(row, 'DECIDE', body, {
            ...checker1,
            permissions: checker1.permissions.filter(
              (p) => p !== 'procurement.assign',
            ),
          }),
        403,
      );
      const key = randomUUID();
      const result = await command(row, 'DECIDE', body, checker1, key);
      expect(await command(row, 'DECIDE', body, checker1, key)).toEqual(result);
      expect(result).toMatchObject({ status: 'REJECTED', deleted: true });
      expect(
        await database.client.procurementRequest.findUnique({
          where: { id: row.id },
        }),
      ).toBeNull();
      expect(
        await database.client.procurementApprovalSnapshot.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('permanently deletes the entire uncommitted order graph without leaving restrictive foreign keys', async () => {
      const ordered = await orderedRequest();
      let row = await command(
        ordered.row,
        'RECEIVE',
        receiptInput(ordered.order.id, ordered.item.id),
      );
      row = await command(
        row,
        'INVOICE',
        invoiceInput(ordered.order.id, ordered.item.id),
      );
      await service.remove(row.id, { expectedVersion: row.version }, maker);
      expect(
        await database.client.procurementRequest.findUnique({
          where: { id: row.id },
        }),
      ).toBeNull();
      expect(
        await database.client.procurementOrder.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
      expect(
        await database.client.procurementIdempotency.count({
          where: {
            operation: 'DELETE_PERMANENT',
            response: { path: ['id'], equals: row.id },
          },
        }),
      ).toBe(1);
    });
    it('also rejects and deletes a pending order commitment atomically without bypassing its independent reviewer', async () => {
      const selected = await selectedRequest();
      const row = await command(selected.row, 'ORDER', {
        selectionId: selected.selection.id,
        expectedAt: tomorrow,
        paymentTerms: 'Synthetic',
        deliveryLocation: 'Synthetic office',
      });
      const result = await command(
        row,
        'DECIDE',
        {
          decision: 'REJECTED',
          reason: 'Synthetic commitment rejection',
          deleteRejected: true,
        },
        checker1,
      );
      expect(result).toMatchObject({ deleted: true, status: 'REJECTED' });
      expect(
        await database.client.procurementOrder.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('keeps history immutable outside the exact-request purge and keeps deletion receipts immutable', async () => {
      const first = await create();
      const second = await create();
      await expect(
        database.client.procurementRequestVersion.deleteMany({
          where: { requestId: first.id },
        }),
      ).rejects.toThrow('PROCUREMENT_APPEND_ONLY');
      await expect(
        database.client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('rubi.procurement_purge_request_id', ${first.id}, true)`;
          await tx.procurementRequestVersion.deleteMany({
            where: { requestId: second.id },
          });
        }),
      ).rejects.toThrow('PROCUREMENT_APPEND_ONLY');
      await service.remove(first.id, { expectedVersion: first.version }, maker);
      await expect(
        database.client.procurementIdempotency.deleteMany({
          where: {
            operation: 'DELETE_PERMANENT',
            response: { path: ['id'], equals: first.id },
          },
        }),
      ).rejects.toThrow('PROCUREMENT_APPEND_ONLY');
      expect((await service.detail(second.id, maker)).id).toBe(second.id);
    });
    it('handles repeated simultaneous deletion without an internal server error or a duplicate deletion receipt', async () => {
      const row = await create();
      const attempts = await Promise.allSettled(
        [1, 2].map(() =>
          procurementBoundary(() =>
            service.remove(row.id, { expectedVersion: row.version }, maker),
          ),
        ),
      );
      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      for (const result of attempts)
        if (result.status === 'rejected') {
          expect(result.reason).toBeInstanceOf(HttpException);
          expect([404, 409]).toContain(
            (result.reason as HttpException).getStatus(),
          );
        }
      expect(
        await database.client.procurementIdempotency.count({
          where: {
            operation: 'DELETE_PERMANENT',
            response: { path: ['id'], equals: row.id },
          },
        }),
      ).toBe(1);
    });
    it('rejects deletion of an accepted Finance commitment at both API and history-trigger boundaries', async () => {
      const ordered = await orderedRequest();
      const row = await command(
        ordered.row,
        'INVOICE',
        invoiceInput(ordered.order.id, ordered.item.id),
      );
      const invoice = await invoiceFor(row);
      const handoff = await database.client.procurementFinanceHandoff.create({
        data: {
          requestId: row.id,
          invoiceId: invoice.id,
          invoiceVersion: invoice.version,
          sourceKey: randomUUID(),
          status: 'ACCEPTED',
          acceptedSourceId: 'synthetic-finance-source',
          payload: {},
        },
      });
      await rejected(
        () =>
          procurementBoundary(() =>
            service.remove(row.id, { expectedVersion: row.version }, maker),
          ),
        409,
        'INVALID_STATE',
      );
      await expect(
        database.client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('rubi.procurement_purge_request_id', ${row.id}, true)`;
          await tx.procurementAudit.deleteMany({
            where: { requestId: row.id },
          });
        }),
      ).rejects.toThrow('PROCUREMENT_APPEND_ONLY');
      expect((await service.detail(row.id, maker)).version).toBe(row.version);
      expect(
        await database.client.procurementFinanceHandoff.findUnique({
          where: { id: handoff.id },
        }),
      ).not.toBeNull();
      // Remove only this synthetic fixture so subsequent Finance-source list
      // regressions do not observe a deliberately minimal handoff payload.
      await database.client.procurementFinanceHandoff.delete({
        where: { id: handoff.id },
      });
    });
    it('creates a form order atomically, with warranty, scoped listing and final approval still required', async () => {
      const draft = fixture();
      const request = await approvedRequest(draft);
      const key = randomUUID();
      const input = {
        supplierId: supplier,
        currencyCode: 'IRR',
        lines: [commercial(draft.items[0]!.id)],
        validUntil: nextMonth,
        expectedAt: tomorrow,
        paymentTerms: 'On acceptance',
        warranty: '12 months',
        deliveryLocation: 'Synthetic office',
        trackingCode: 'FORM-1',
        documents,
      };
      const saved = await command(request, 'ORDER_FORM', input, maker, key);
      await command(request, 'ORDER_FORM', input, maker, key);
      const orders = await database.client.procurementOrder.findMany({
        where: { requestId: request.id },
      });
      expect(orders).toHaveLength(1);
      expect(orders[0]!.status).toBe('PENDING_APPROVAL');
      expect(orders[0]!.data).toMatchObject({
        warranty: '12 months',
        trackingCode: 'FORM-1',
        documents,
      });
      const own = await service.orders({ search: draft.title }, maker);
      expect(own.items.some((order) => order.id === orders[0]!.id)).toBe(true);
      const outside = await service.orders(
        { search: draft.title },
        { ...outsider, branchIds: [otherBranch] },
      );
      expect(outside.items).toHaveLength(0);
      await rejected(
        () => command(saved, 'ISSUE_ORDER', { orderId: orders[0]!.id }),
        422,
        'FINAL_APPROVAL_REQUIRED',
      );
    });
    it('rolls back quote, selection and version when the form order has an invalid tracking code', async () => {
      const draft = fixture();
      const request = await approvedRequest(draft);
      await rejected(
        () =>
          command(request, 'ORDER_FORM', {
            supplierId: supplier,
            currencyCode: 'IRR',
            lines: [commercial(draft.items[0]!.id)],
            validUntil: nextMonth,
            expectedAt: tomorrow,
            paymentTerms: 'On acceptance',
            deliveryLocation: 'Synthetic office',
            trackingCode: 'x'.repeat(101),
            documents,
          }),
        422,
        'VALIDATION_ERROR',
      );
      expect(
        await database.client.procurementQuotation.count({
          where: { requestId: request.id },
        }),
      ).toBe(0);
      expect(
        await database.client.procurementSelection.count({
          where: { requestId: request.id },
        }),
      ).toBe(0);
      expect(
        await database.client.procurementOrder.count({
          where: { requestId: request.id },
        }),
      ).toBe(0);
      expect((await service.detail(request.id, maker)).version).toBe(
        request.version,
      );
    });
    it('rejects form order without quote-select permission before writing any quotation', async () => {
      const request = await approvedRequest();
      await rejected(
        () =>
          command(
            request,
            'ORDER_FORM',
            {},
            {
              ...maker,
              permissions: maker.permissions.filter(
                (permission) => permission !== 'procurement.quote.select',
              ),
            },
          ),
        403,
      );
      expect(
        await database.client.procurementQuotation.count({
          where: { requestId: request.id },
        }),
      ).toBe(0);
    });
    it('replaces pending order approval on amendment and retires it on cancellation', async () => {
      const context = await orderedRequest('GOODS', false);
      // The helper has approved the initial order, but has not issued it.
      const amended = await command(context.row, 'AMEND_ORDER', {
        orderId: context.order.id,
        warranty: '24 months',
        reason: 'Synthetic updated warranty',
      });
      expect(amended.status).toBe('IN_REVIEW');
      const again = await command(amended, 'AMEND_ORDER', {
        orderId: context.order.id,
        warranty: '36 months',
        reason: 'Synthetic second amendment',
      });
      const cancelled = await command(again, 'CANCEL_ORDER', {
        orderId: context.order.id,
        reason: 'Synthetic cancellation',
      });
      expect(cancelled.status).toBe('SOURCING');
      const snapshots =
        await database.client.procurementApprovalSnapshot.findMany({
          where: { requestId: cancelled.id },
        });
      expect(
        await database.client.procurementApprovalStep.count({
          where: {
            snapshotId: { in: snapshots.map((snapshot) => snapshot.id) },
            status: 'PENDING',
          },
        }),
      ).toBe(0);
      expect(
        (await service.orders({ search: cancelled.draft.title }, maker)).items,
      ).toHaveLength(0);
      expect(
        (
          await service.orders(
            { search: cancelled.draft.title, status: 'CANCELLED' },
            maker,
          )
        ).items,
      ).toHaveLength(1);
    });
    it('stores discrepancy date and rejects return using a different order context', async () => {
      const context = await orderedRequest();
      let row = await command(
        context.row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id),
      );
      const receipt =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      await rejected(
        () =>
          command(row, 'RETURN', {
            orderId: randomUUID(),
            receiptItemId: receipt.id,
            quantity: '1',
            disposition: 'ACCEPTED',
            returnedAt: instant,
            reason: 'Synthetic mismatch',
            documents,
          }),
        422,
        'INVALID_REFERENCE',
      );
      row = await command(row, 'DISCREPANCY', {
        orderId: context.order.id,
        kind: 'DAMAGE',
        description: 'Synthetic damage',
        occurredAt: instant,
      });
      expect(
        (
          await database.client.procurementDiscrepancy.findFirstOrThrow({
            where: { requestId: row.id },
          })
        ).data,
      ).toMatchObject({ occurredAt: instant });
    });
    it('saves order-bound discrepancy and documented return form submissions once and reloads their dates and evidence', async () => {
      const context = await orderedRequest();
      let row = await command(
        context.row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id),
      );
      const receipts = await service.records(
        row.id,
        { kind: 'receipts' },
        maker,
      );
      const receipt = (receipts.items[0] as { lines: { id: string }[] })
        .lines[0]!;
      const discrepancyInput = {
        orderId: context.order.id,
        kind: 'DAMAGE',
        description: 'Synthetic form damage',
        occurredAt: instant,
        currencyCode: 'IRR',
        disposition: 'ACCEPTED',
        resolution: 'REPLACE',
        receivedDelta: '0',
        acceptedDelta: '0',
        rejectedDelta: '0',
      };
      const discrepancyKey = randomUUID();
      const beforeDiscrepancy = row;
      row = await command(
        beforeDiscrepancy,
        'DISCREPANCY',
        discrepancyInput,
        maker,
        discrepancyKey,
      );
      await command(
        beforeDiscrepancy,
        'DISCREPANCY',
        discrepancyInput,
        maker,
        discrepancyKey,
      );
      const discrepancies = await service.records(
        row.id,
        { kind: 'discrepancies' },
        maker,
      );
      expect(discrepancies.items).toHaveLength(1);
      expect(discrepancies.items[0]).toMatchObject({
        orderId: context.order.id,
        description: 'Synthetic form damage',
        data: { occurredAt: instant },
      });
      const returnInput = {
        orderId: context.order.id,
        receiptItemId: receipt.id,
        quantity: '0.25',
        disposition: 'ACCEPTED',
        returnedAt: instant,
        reason: 'Synthetic form return',
        documents,
      };
      const returnKey = randomUUID();
      const beforeReturn = row;
      row = await command(
        beforeReturn,
        'RETURN',
        returnInput,
        maker,
        returnKey,
      );
      await command(beforeReturn, 'RETURN', returnInput, maker, returnKey);
      const returns = await service.records(row.id, { kind: 'returns' }, maker);
      expect(returns.items).toHaveLength(1);
      expect(JSON.parse(JSON.stringify(returns.items[0]))).toMatchObject({
        orderId: context.order.id,
        receiptItemId: receipt.id,
        quantity: '0.25',
        returnedAt: instant,
        reason: 'Synthetic form return',
        data: { documents, disposition: 'ACCEPTED' },
      });
    });
    async function selectedRequest(draft = fixture(), validUntil = nextMonth) {
      let row = await approvedRequest(draft);
      row = await command(row, 'QUOTE', {
        supplierId: supplier,
        currencyCode: draft.currencyCode,
        lines: [commercial(draft.items[0]!.id)],
        quotedAt: new Date(Date.now() - 86400000).toISOString(),
        validUntil,
        deliveryAt: tomorrow,
        paymentTerms: 'Upon acceptance',
        documents,
      });
      const quotation =
        await database.client.procurementQuotation.findFirstOrThrow({
          where: { requestId: row.id },
        });
      row = await command(row, 'SELECT_QUOTE', { quotationId: quotation.id });
      const selection =
        await database.client.procurementSelection.findFirstOrThrow({
          where: { requestId: row.id },
        });
      return { row, selection, quotation };
    }
    async function orderedRequest(
      kind: 'GOODS' | 'SERVICE' = 'GOODS',
      issue = true,
      currencyCode = 'IRR',
      expectedAt = tomorrow,
    ) {
      const draft = fixture({ currencyCode });
      draft.items[0]!.kind = kind;
      draft.items[0]!.acceptanceCriteria =
        kind === 'SERVICE' ? 'Signed proof of completed deliverable' : '';
      const selected = await selectedRequest(draft);
      let row = await command(selected.row, 'ORDER', {
        selectionId: selected.selection.id,
        expectedAt,
        supplierId: supplier,
        paymentTerms: 'Upon acceptance',
        deliveryLocation: 'Synthetic office',
        trackingCode: 'SYNTHETIC-ORDER-TRACKING',
        documents,
      });
      const order = await database.client.procurementOrder.findFirstOrThrow({
        where: { requestId: row.id },
      });
      expect(order.status).toBe('PENDING_APPROVAL');
      expect(order.data).toMatchObject({
        trackingCode: 'SYNTHETIC-ORDER-TRACKING',
        documents,
      });
      row = await approve(row);
      if (issue) row = await command(row, 'ISSUE_ORDER', { orderId: order.id });
      const item = await database.client.procurementOrderItem.findFirstOrThrow({
        where: { orderId: order.id },
      });
      return { ...selected, row, order, item };
    }
    function receiptInput(orderId: string, itemId: string, quantity = '10') {
      return {
        orderId,
        receivedAt: instant,
        location: 'Synthetic office',
        documents,
        lines: [
          {
            itemId,
            quantity,
            acceptedQuantity: quantity,
            rejectedQuantity: '0',
          },
        ],
      };
    }
    function invoiceInput(
      orderId: string,
      itemId: string,
      changes: Record<string, unknown> = {},
    ) {
      return {
        orderId,
        number: `TEST-${randomUUID()}`,
        currencyCode: 'IRR',
        issuedAt: instant,
        dueAt: tomorrow,
        documents,
        lines: [commercial(itemId)],
        ...changes,
      };
    }
    async function invoiceFor(row: ProcurementRequestV1) {
      return database.client.procurementInvoice.findFirstOrThrow({
        where: { requestId: row.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    }
    async function financeState() {
      // Owner tables are observed only by this test, never accessed by Procurement.
      const result = await database.client.$queryRaw<
        { name: string; data: unknown }[]
      >`
      SELECT 'supplier-payment' AS name, COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) AS data FROM "FinanceSupplierPaymentRevision" r
      UNION ALL SELECT 'delivery', COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) FROM "FinanceDeliveryRevision" r`;
      return result;
    }
    async function paidFinanceFixture() {
      // A real, synthetic Finance-owned PAID row verifies preservation of an
      // existing owner decision, not merely absence of writes into an empty table.
      const country = await database.client.masterCountry.upsert({
        where: { code: 'ZZ' },
        create: {
          code: 'ZZ',
          name: 'Synthetic country',
          englishName: 'Synthetic country',
          createdByUserId: maker.userId,
          updatedByUserId: maker.userId,
        },
        update: {},
      });
      const bank = await database.client.masterBank.create({
        data: {
          countryId: country.id,
          code: `PT-${randomUUID().slice(0, 12)}`,
          name: 'Synthetic bank',
          createdByUserId: maker.userId,
          updatedByUserId: maker.userId,
        },
      });
      const organization = await database.client.masterOrganization.create({
        data: {
          code: `PT-${randomUUID().slice(0, 12)}`,
          legalName: 'Synthetic supplier organization',
          displayName: 'Synthetic Supplier',
          createdByUserId: maker.userId,
          updatedByUserId: maker.userId,
        },
      });
      await database.client.masterSupplier.update({
        where: { id: supplier },
        data: { organizationId: organization.id },
      });
      const intake = await database.client.reservationIntake.create({
        data: {
          requestId: randomUUID(),
          contractId: randomUUID(),
          contractVersion: 1,
          branchId: branch,
          fingerprint: 'a'.repeat(64),
          snapshot: { synthetic: true },
          purchaseVersion: 1,
        },
      });
      const purchase = await database.client.reservationServicePurchase.create({
        data: {
          intakeId: intake.id,
          serviceClientKey: randomUUID(),
          serviceKind: 'OTHER',
          serviceTitleSnapshot: 'Synthetic service',
          supplierOrganizationId: organization.id,
          supplierNameSnapshot: 'Synthetic Supplier',
          version: 1,
          amount: '100',
          currencyCode: 'IRR',
          actorUserId: maker.userId,
          idempotencyKey: randomUUID(),
          fingerprint: 'b'.repeat(64),
        },
      });
      const payment =
        await database.client.financeSupplierPaymentRevision.create({
          data: {
            purchaseId: purchase.id,
            version: 1,
            status: 'PAID',
            bankId: bank.id,
            transferAt: new Date(instant),
            paymentReference: `SYNTHETIC-${randomUUID()}`,
            reason: 'Synthetic paid owner baseline',
            actorUserId: checker1.userId,
          },
        });
      await database.client.financeDeliveryRevision.create({
        data: {
          intakeId: intake.id,
          version: 1,
          approved: true,
          reason: 'Synthetic approved owner baseline',
          actorUserId: checker1.userId,
        },
      });
      return payment;
    }

    beforeAll(async () => {
      const target = new URL(process.env.DATABASE_URL ?? '');
      if (
        target.hostname !== '127.0.0.1' ||
        target.port !== '55473' ||
        target.pathname !== '/procurement_001_api_test'
      )
        throw new Error(
          'Refusing target outside the dedicated PROCUREMENT-001 API test database',
        );
      database = new DatabaseService();
      const version = await database.client.$queryRaw<
        { server_version_num: string }[]
      >`SHOW server_version_num`;
      expect(Number(version[0]!.server_version_num)).toBeGreaterThanOrEqual(
        180000,
      );
      expect(Number(version[0]!.server_version_num)).toBeLessThan(190000);
      branch = (
        await database.client.branch.create({
          data: {
            code: `PT-${randomUUID().slice(0, 12)}`,
            name: 'Synthetic branch A',
          },
        })
      ).id;
      otherBranch = (
        await database.client.branch.create({
          data: {
            code: `PT-${randomUUID().slice(0, 12)}`,
            name: 'Synthetic branch B',
          },
        })
      ).id;
      maker = await identity('unit-a', [branch]);
      checker1 = await identity('unit-a', [branch]);
      checker2 = await identity('unit-a', [branch]);
      colleague = await identity('unit-a', [branch]);
      outsider = await identity('unit-b', [branch]);
      for (const code of ['IRR', 'USD'])
        await database.client.masterCurrency.upsert({
          where: { code },
          create: {
            code,
            name: `Synthetic ${code}`,
            createdByUserId: maker.userId,
            updatedByUserId: maker.userId,
          },
          update: {},
        });
      supplier = (
        await database.client.masterSupplier.create({
          data: {
            code: `PT-${randomUUID().slice(0, 12)}`,
            name: 'Synthetic Supplier',
            createdByUserId: maker.userId,
            updatedByUserId: maker.userId,
          },
        })
      ).id;
      issuer = (
        await database.client.legalEntity.create({
          data: {
            code: `PT-${randomUUID().slice(0, 12)}`,
            persianName: 'Synthetic issuer',
          },
        })
      ).id;
      const master = {
        assertCurrency: async (code: string) => {
          expect(['IRR', 'USD']).toContain(code);
        },
        supplier: async (id: string) => {
          expect(id).toBe(supplier);
          if (!supplierEnabled) throw new Error('Synthetic inactive supplier');
          return { id, version: 1, label: 'Synthetic Supplier' };
        },
        supplierLabels: async (ids: readonly string[]) =>
          new Map(ids.map((id) => [id, 'Synthetic Supplier'])),
      } as unknown as MasterProcurementDirectory;
      const hr = {
        self: async (actor: AuthenticatedActor, requestedBranch?: string) => {
          const person = identities.get(actor.userId);
          return person
            ? {
                id: actor.userId,
                version: 1,
                userId: actor.userId,
                branchId: requestedBranch ?? actor.branchIds[0],
                label: 'Synthetic employee',
                unitId: person.unit,
              }
            : null;
        },
        requester: async (
          actor: AuthenticatedActor,
          userId: string,
          requestedBranch: string,
        ) => {
          const person = identities.get(userId);
          return person &&
            actor.branchIds.includes(requestedBranch) &&
            person.actor.branchIds.includes(requestedBranch)
            ? {
                id: userId,
                version: 1,
                userId,
                branchId: requestedBranch,
                label: 'Synthetic requester',
                unitId: person.unit,
              }
            : null;
        },
      } as unknown as HrProcurementDirectory;
      const iam = {
        candidates: async (branchId: string) => ({
          items: [...identities.values()]
            .filter(
              ({ actor }) =>
                actor.branchIds.includes(branchId) &&
                actor.permissions.includes('procurement.quote.manage'),
            )
            .map(({ actor }) => ({
              id: actor.userId,
              label: 'Synthetic buyer',
            })),
          page: 1,
          pageSize: 50,
          hasMore: false,
        }),
        authorizedUsers: async (
          ids: string[],
          branchId: string,
          permission: string,
        ) =>
          ids
            .filter((id) => {
              const person = identities.get(id);
              return (
                person?.actor.branchIds.includes(branchId) &&
                person.actor.permissions.some((code) => code === permission)
              );
            })
            .map((id) => ({ id })),
      } as unknown as IamProcurementDirectory;
      const documentOwner = {
        detail: async (id: string) => {
          expect(id).toBe(documentId);
          return {
            data: {
              branchId: branch,
              type: { domain: 'PROCUREMENT' },
              archiveStatus: 'ACTIVE',
              isIncomplete: false,
              versions: [{ id: documentVersionId, scanStatus: 'CLEAN' }],
            },
          };
        },
      } as unknown as DocumentsService;
      const legal = {
        issueTargets: async () => ({
          data: {
            requiresExplicitIssuer: false,
            targets: [
              { id: issuer, version: 1, persianName: 'Synthetic issuer' },
            ],
          },
        }),
        branding: async (id: string) => {
          expect(id).toBe(issuer);
          return {
            data: {
              legalEntityId: issuer,
              version: 1,
              name: 'Synthetic issuer',
            },
          };
        },
      } as unknown as LegalEntitiesService;
      const port = {
        resolve: async () => approvedPolicy,
      } as unknown as ProcurementPolicyPort;
      const operations = new ProcurementOperations(
        master,
        iam,
        legal,
        documentOwner,
        port,
      );
      service = new ProcurementService(
        database,
        master,
        hr,
        iam,
        documentOwner,
        port,
        operations,
        new NotificationsService(new NotificationsRepository(database)),
        new AutomationTasksService(database),
      );
    }, 30000);
    afterAll(async () => {
      await database?.onModuleDestroy();
    });
    beforeEach(() => {
      supplierEnabled = true;
      approvedPolicy = {
        id: 'synthetic-approved-policy',
        version: 1,
        source: 'Synthetic test policy only',
        approvedAt: instant,
        branchId: branch,
        unitId: 'unit-a',
        category: 'OFFICE',
        currencyCode: 'IRR',
        maximumAmount: '1000',
        allowUnknownEstimate: false,
        emergencyAllowed: false,
        minimumQuotations: 1,
        singleSourceAllowed: false,
        steps: [checker1, checker2].map((actor) => ({
          userId: actor.userId,
          maximumAmount: '1000',
          permission: 'procurement.approve',
        })),
      };
    });

    it('persists normalized categories within the authorized branch and retains legacy request categories', async () => {
      expect(procurementCategoryKey('مهندسی\u200c شبکه ك')).toBe(
        'مهندسی شبکه ک',
      );
      await create(fixture({ category: 'دفتر و لوازم' }));
      const saved = await service.createCategory(
        { branchId: branch, label: 'مهندسی\u200c شبکه ك' },
        maker,
      );
      expect(saved).toMatchObject({
        branchId: branch,
        label: 'مهندسی\u200c شبکه ك',
      });
      const list = await service.categories({ branchId: branch }, maker);
      expect(list.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: 'مهندسی\u200c شبکه ك' }),
          expect.objectContaining({ label: 'دفتر و لوازم' }),
        ]),
      );
      const duplicateActor: AuthenticatedActor = {
        ...maker,
        userId: colleague.userId,
      };
      await rejected(
        () =>
          procurementBoundary(() =>
            service.createCategory(
              { branchId: branch, label: 'مهندسی شبکه ک' },
              duplicateActor,
            ),
          ),
        409,
        'CONFLICT',
      );
      await rejected(
        () => service.categories({ branchId: otherBranch }, maker),
        403,
      );
    });

    it('stores an incomplete draft and rolls back unsuccessful submission without losing its contents', async () => {
      const row = await create(
        fixture({ title: '', items: [], needReason: '', requiredAt: null }),
      );
      expect(row.status).toBe('DRAFT');
      await rejected(() => command(row, 'SUBMIT'), 422, 'VALIDATION_ERROR');
      expect(await service.detail(row.id, maker)).toEqual(row);
      expect(
        await database.client.procurementApprovalSnapshot.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('routes a created request to an authorized buyer for follow-up without creating approval authority', async () => {
      const requester: AuthenticatedActor = {
        ...maker,
        permissions: ['procurement.request.create'],
      };
      const ownerChoices = await service.owners(
        { branchId: branch, search: '', page: 1 },
        requester,
      );
      expect(ownerChoices.items.map((item) => item.id)).toContain(
        checker1.userId,
      );
      const row = await procurementBoundary(() =>
        service.create(
          {
            draft: fixture(),
            ownerUserId: checker1.userId,
          },
          randomUUID(),
          requester,
        ),
      );

      expect(row.ownerUserId).toBe(checker1.userId);
      expect(
        await database.client.automationTask.findFirst({
          where: {
            sourceModule: 'PROCUREMENT',
            sourceReference: row.id,
            assigneeUserId: checker1.userId,
            kind: 'PROCUREMENT_FOLLOW_UP',
            status: 'OPEN',
          },
        }),
      ).toMatchObject({ assigneeUserId: checker1.userId });
      expect(
        await database.client.procurementApprovalSnapshot.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('rejects a follow-up recipient who is not an authorized same-branch buyer', async () => {
      await rejected(
        () =>
          procurementBoundary(() =>
            service.create(
              { draft: fixture(), ownerUserId: randomUUID() },
              randomUUID(),
              { ...maker, permissions: ['procurement.request.create'] },
            ),
          ),
        422,
        'INVALID_OWNER',
      );
    });
    it('leaves a complete draft intact when the production policy port is unconfigured', async () => {
      approvedPolicy = await new ProcurementPolicyPort().resolve(fixture());
      const row = await create();
      await rejected(
        () => command(row, 'SUBMIT'),
        422,
        'POLICY_NOT_CONFIGURED',
      );
      expect(await service.detail(row.id, maker)).toEqual(row);
    });
    it('publishes a complete draft without inventing an approval policy', async () => {
      approvedPolicy = await new ProcurementPolicyPort().resolve(fixture());
      const row = await create();

      const published = await command(row, 'PUBLISH');

      expect(published.status).toBe('SUBMITTED');
      expect(
        await database.client.procurementApprovalSnapshot.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('persists and publishes optional unit, need text and goods description without changing the audit actor', async () => {
      const input = fixture({ unitId: null, needReason: '' });
      input.items[0]!.description = '';
      const row = await procurementBoundary(() =>
        service.create({ draft: input, publish: true }, randomUUID(), maker),
      );
      expect(row.status).toBe('SUBMITTED');
      expect(row.requesterUserId).toBe(maker.userId);
      expect((await service.detail(row.id, maker)).draft).toMatchObject({
        unitId: null,
        needReason: '',
        items: [{ description: '' }],
      });
    });
    it('creates and publishes atomically and leaves no draft when validation fails', async () => {
      const complete = fixture();
      const published = await procurementBoundary(() =>
        service.create({ draft: complete, publish: true }, randomUUID(), maker),
      );
      expect(published.status).toBe('SUBMITTED');
      expect(published.version).toBe(2);

      const invalid = fixture();
      invalid.items[0]!.quantity = '0';
      await rejected(
        () =>
          procurementBoundary(() =>
            service.create(
              { draft: invalid, publish: true },
              randomUUID(),
              maker,
            ),
          ),
        422,
        'VALIDATION_ERROR',
      );
      expect(
        await database.client.procurementRequest.count({
          where: { title: invalid.title },
        }),
      ).toBe(0);
    });
    it('preserves zero/incomplete quantities, full HR unit identifiers and prevents cross-request item theft', async () => {
      const person = identities.get(maker.userId)!;
      const oldUnit = person.unit;
      person.unit = 'u'.repeat(160);
      try {
        const input = fixture({ unitId: person.unit });
        input.items[0]!.quantity = '0';
        const row = await create(input);
        expect(row.draft.unitId).toHaveLength(160);
        expect(row.draft.items[0]!.quantity).toBe('0');
        const item =
          await database.client.procurementRequestItem.findUniqueOrThrow({
            where: { id: input.items[0]!.id },
          });
        expect(item.quantity).toBeNull();
        expect(item.data).toMatchObject({ quantity: '0' });
        await rejected(
          () => create({ ...input, title: 'Attempted cross-request reuse' }),
          422,
          'INVALID_REFERENCE',
        );
        expect(
          (
            await database.client.procurementRequestItem.findUniqueOrThrow({
              where: { id: item.id },
            })
          ).requestId,
        ).toBe(row.id);
        const equivalentId = `${randomUUID().slice(0, -1)}a`;
        await rejected(
          () =>
            create({
              ...input,
              title: 'Duplicate canonical UUID',
              items: [
                { ...input.items[0]!, id: equivalentId },
                { ...input.items[0]!, id: equivalentId.toUpperCase() },
              ],
            }),
          422,
          'DUPLICATE_ITEM',
        );
      } finally {
        person.unit = oldUnit;
      }
    });
    it('supersedes pending approvals when editing a submitted request and creates fresh approval steps', async () => {
      let row = await command(await create(), 'SUBMIT');
      const originalSnapshot =
        await database.client.procurementApprovalSnapshot.findFirstOrThrow({
          where: { requestId: row.id },
        });
      row = await procurementBoundary(() =>
        service.update(
          row.id,
          {
            expectedVersion: row.version,
            draft: { ...row.draft, title: 'Revised request' },
            reason: 'Synthetic revision',
          },
          randomUUID(),
          maker,
        ),
      );
      expect(row.status).toBe('DRAFT');
      const oldSteps = await database.client.procurementApprovalStep.findMany({
        where: { snapshotId: originalSnapshot.id },
      });
      expect(oldSteps).toHaveLength(2);
      expect(oldSteps.every((step) => step.status === 'SUPERSEDED')).toBe(true);
      row = await command(row, 'SUBMIT');
      row = await approve(row);
      expect(
        await database.client.procurementApprovalSnapshot.count({
          where: { requestId: row.id },
        }),
      ).toBe(2);
    });
    it('concurrent identical create retries persist one request and one audit, but changed input gets 409', async () => {
      const input = fixture();
      const key = randomUUID();
      const results = await Promise.all([
        create(input, maker, key),
        create(input, maker, key),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        await database.client.procurementRequest.count({
          where: { title: input.title },
        }),
      ).toBe(1);
      expect(
        await database.client.procurementAudit.count({
          where: { requestId: results[0]!.id, action: 'CREATE' },
        }),
      ).toBe(1);
      await rejected(
        () => create({ ...input, title: 'Changed payload' }, maker, key),
        409,
        'IDEMPOTENCY_CONFLICT',
      );
    });
    it('uses the real Notifications owner transaction without duplicates on retry or failed decisions', async () => {
      const row = await create();
      const key = randomUUID();
      const submitted = await command(row, 'SUBMIT', {}, maker, key);
      expect(await command(row, 'SUBMIT', {}, maker, key)).toEqual(submitted);
      const messages = await database.client.notification.findMany({
        where: { entityId: row.id, sourceModule: 'PROCUREMENT' },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        recipientUserId: checker1.userId,
        actorUserId: maker.userId,
        eventType: 'procurement.workflow-event.v1',
        href: `/purchases?request=${row.id}`,
      });
      await rejected(
        () => command(submitted, 'DECIDE', { decision: 'APPROVED' }, checker2),
        403,
        'NO_VALID_APPROVER',
      );
      expect(
        await database.client.notification.count({
          where: { entityId: row.id, sourceModule: 'PROCUREMENT' },
        }),
      ).toBe(1);
      await command(submitted, 'DECIDE', { decision: 'APPROVED' }, checker1);
      expect(
        await database.client.notification.count({
          where: { entityId: row.id, sourceModule: 'PROCUREMENT' },
        }),
      ).toBe(3);
    });
    it('allows exactly one concurrent update and retains the winning version', async () => {
      const row = await create();
      const attempts = await Promise.allSettled(
        ['Writer A', 'Writer B'].map((title) =>
          procurementBoundary(() =>
            service.update(
              row.id,
              { expectedVersion: row.version, draft: { ...row.draft, title } },
              randomUUID(),
              maker,
            ),
          ),
        ),
      );
      const success = attempts.filter((entry) => entry.status === 'fulfilled');
      const failure = attempts.filter((entry) => entry.status === 'rejected');
      expect(success).toHaveLength(1);
      expect(failure).toHaveLength(1);
      expect((failure[0]!.reason as HttpException).getStatus()).toBe(409);
      const stored = await service.detail(row.id, maker);
      expect(stored).toEqual(success[0]!.value);
      expect(stored.version).toBe(2);
      expect(
        await database.client.procurementRequestVersion.count({
          where: { requestId: row.id },
        }),
      ).toBe(2);
    });
    it('enforces branch, own and current employee unit visibility and command permission', async () => {
      const row = await create();
      const own: AuthenticatedActor = {
        ...colleague,
        permissions: ['procurement.read.own'],
      };
      expect(
        (await service.list({}, own)).items.some((item) => item.id === row.id),
      ).toBe(false);
      await rejected(() => service.detail(row.id, own), 404);
      const unit: AuthenticatedActor = {
        ...colleague,
        permissions: ['procurement.read.unit'],
      };
      expect(
        (await service.list({}, unit)).items.some((item) => item.id === row.id),
      ).toBe(true);
      await rejected(
        () =>
          service.detail(row.id, {
            ...outsider,
            permissions: ['procurement.read.unit'],
          }),
        404,
      );
      await rejected(
        () => service.detail(row.id, { ...maker, branchIds: [otherBranch] }),
        404,
      );
      await rejected(() => create(fixture({ branchId: otherBranch })), 403);
      await rejected(
        () =>
          command(row, 'CANCEL', { reason: 'Synthetic cancellation' }, unit),
        403,
      );
      expect(
        (
          await service.detail(row.id, {
            ...maker,
            permissions: ['procurement.read.own'],
          })
        ).id,
      ).toBe(row.id);
      await command(row, 'ASSIGN', { ownerUserId: colleague.userId });
      expect((await service.detail(row.id, own)).id).toBe(row.id);
    });
    it('requires sequential independent request decisions and final order decisions before issuing', async () => {
      let row = await command(await create(), 'SUBMIT');
      await rejected(
        () => command(row, 'DECIDE', { decision: 'APPROVED' }),
        403,
        'NO_VALID_APPROVER',
      );
      await rejected(
        () => command(row, 'DECIDE', { decision: 'APPROVED' }, checker2),
        403,
        'NO_VALID_APPROVER',
      );
      row = await approve(row);
      const selected = await selectedRequest();
      row = await command(selected.row, 'ORDER', {
        selectionId: selected.selection.id,
        expectedAt: tomorrow,
        paymentTerms: 'Acceptance',
        deliveryLocation: 'Office',
      });
      const order = await database.client.procurementOrder.findFirstOrThrow({
        where: { requestId: row.id },
      });
      await rejected(
        () => command(row, 'ISSUE_ORDER', { orderId: order.id }),
        422,
        'FINAL_APPROVAL_REQUIRED',
      );
      expect(
        await database.client.procurementOutbox.count({
          where: {
            requestId: row.id,
            eventType: 'procurement.supplier-order-intent.v1',
          },
        }),
      ).toBe(0);
      await rejected(
        () => command(row, 'DECIDE', { decision: 'APPROVED' }, checker2),
        403,
        'NO_VALID_APPROVER',
      );
      row = await approve(row);
      await command(row, 'ISSUE_ORDER', { orderId: order.id });
      expect(
        (
          await database.client.procurementOrder.findUniqueOrThrow({
            where: { id: order.id },
          })
        ).status,
      ).toBe('ISSUED');
      const intents = await database.client.procurementOutbox.findMany({
        where: {
          requestId: row.id,
          eventType: 'procurement.supplier-order-intent.v1',
        },
      });
      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({
        status: 'PENDING',
        payload: {
          orderId: order.id,
          orderVersion: 1,
          supplierId: supplier,
          connection: 'SUPPLIER_DELIVERY_QUEUED',
        },
      });
      const publicEvents = new ProcurementPublicService(database);
      expect(
        await publicEvents.listPendingConnectionEvents(
          [otherBranch],
          'procurement.supplier-order-intent.v1',
        ),
      ).toEqual([]);
      expect(
        (
          await publicEvents.listPendingConnectionEvents(
            [branch],
            'procurement.supplier-order-intent.v1',
          )
        ).some((event) => event.eventId === intents[0]?.eventId),
      ).toBe(true);
    });
    it('rejects an order supplier that differs from the approved selected quotation', async () => {
      const context = await selectedRequest();
      await rejected(
        () =>
          command(context.row, 'ORDER', {
            selectionId: context.selection.id,
            supplierId: randomUUID(),
            expectedAt: tomorrow,
            paymentTerms: 'Synthetic terms',
            deliveryLocation: 'Synthetic office',
          }),
        422,
        'INVALID_REFERENCE',
      );
      expect(
        await database.client.procurementOrder.count({
          where: { requestId: context.row.id },
        }),
      ).toBe(0);
    });
    it('persists uploaded invoice references in amended orders and immutable order versions', async () => {
      const context = await orderedRequest();
      await database.client.procurementOrder.update({
        where: { id: context.order.id },
        data: {
          data: json({
            ...(context.order.data as Record<string, unknown>),
            documents: [],
          }),
        },
      });
      await command(context.row, 'AMEND_ORDER', {
        orderId: context.order.id,
        reason: 'Attach archived invoice',
        documents,
      });
      const saved = await database.client.procurementOrder.findUniqueOrThrow({
        where: { id: context.order.id },
      });
      expect(saved.data).toMatchObject({ documents });
      const version =
        await database.client.procurementOrderVersion.findUniqueOrThrow({
          where: {
            orderId_version: { orderId: saved.id, version: saved.version },
          },
        });
      expect(version.payload).toMatchObject({ data: { documents } });
      expect(
        (await service.orders({}, maker)).items.find(
          (order) => order.id === saved.id,
        )?.data,
      ).toMatchObject({ documents });
    });
    it('rejects unverified invoice versions and unauthorized attachments without changing the order', async () => {
      const context = await orderedRequest();
      await rejected(
        () =>
          command(context.row, 'AMEND_ORDER', {
            orderId: context.order.id,
            reason: 'Invalid document version',
            documents: [{ id: documentId, versionId: randomUUID() }],
          }),
        503,
        'DOCUMENTS_UNAVAILABLE',
      );
      await rejected(
        () =>
          command(
            context.row,
            'AMEND_ORDER',
            {
              orderId: context.order.id,
              reason: 'Unauthorized attachment',
              documents,
            },
            {
              ...maker,
              permissions: maker.permissions.filter(
                (p) => p !== 'documents.procurement.read',
              ),
            },
          ),
        403,
        'FORBIDDEN',
      );
      expect(
        (
          await database.client.procurementOrder.findUniqueOrThrow({
            where: { id: context.order.id },
          })
        ).version,
      ).toBe(context.order.version);
    });
    it('persists order amendments as new approved versions and preserves omitted metadata and exact documents', async () => {
      const context = await orderedRequest();
      const original = await database.client.procurementOrder.findUniqueOrThrow(
        { where: { id: context.order.id } },
      );
      const originalVersion =
        await database.client.procurementOrderVersion.findUniqueOrThrow({
          where: {
            orderId_version: { orderId: context.order.id, version: 1 },
          },
        });
      const updatedExpectedAt = nextMonth;
      const amended = await command(context.row, 'AMEND_ORDER', {
        orderId: context.order.id,
        reason: 'Synthetic delivery plan update',
        supplierId: supplier,
        currencyCode: 'IRR',
        expectedAt: updatedExpectedAt,
        deliveryLocation: 'Synthetic west branch',
        paymentTerms: 'Net 30 after acceptance',
        trackingCode: 'SYNTHETIC-TRACK-UPDATED',
        lines: [commercial(context.item.requestItemId)],
      });
      const updated = await database.client.procurementOrder.findUniqueOrThrow({
        where: { id: context.order.id },
      });
      expect(amended.status).toBe('IN_REVIEW');
      expect(updated).toMatchObject({
        version: 2,
        status: 'PENDING_APPROVAL',
        expectedAt: new Date(updatedExpectedAt),
        data: {
          deliveryLocation: 'Synthetic west branch',
          paymentTerms: 'Net 30 after acceptance',
          trackingCode: 'SYNTHETIC-TRACK-UPDATED',
          documents,
        },
      });
      expect(
        await database.client.procurementOrder.findUniqueOrThrow({
          where: { id: context.order.id },
        }),
      ).not.toEqual(original);
      expect(
        await database.client.procurementOrderVersion.findUniqueOrThrow({
          where: {
            orderId_version: { orderId: context.order.id, version: 1 },
          },
        }),
      ).toEqual(originalVersion);
      expect(original.data).toMatchObject({
        deliveryLocation: 'Synthetic office',
        paymentTerms: 'Upon acceptance',
        trackingCode: 'SYNTHETIC-ORDER-TRACKING',
        documents,
      });

      const second = await orderedRequest();
      const omitted = await command(second.row, 'AMEND_ORDER', {
        orderId: second.order.id,
        reason: 'Synthetic reason-only amendment',
      });
      const preserved =
        await database.client.procurementOrder.findUniqueOrThrow({
          where: { id: second.order.id },
        });
      expect(omitted.status).toBe('IN_REVIEW');
      expect(preserved).toMatchObject({
        version: 2,
        expectedAt: second.order.expectedAt,
        data: {
          deliveryLocation: 'Synthetic office',
          paymentTerms: 'Upon acceptance',
          trackingCode: 'SYNTHETIC-ORDER-TRACKING',
          documents,
        },
      });
      const preservedVersion =
        await database.client.procurementOrderVersion.findUniqueOrThrow({
          where: {
            orderId_version: { orderId: second.order.id, version: 2 },
          },
        });
      expect(
        await database.client.procurementOrderItem.findMany({
          where: {
            orderId: second.order.id,
            orderVersionId: preservedVersion.id,
          },
        }),
      ).toHaveLength(1);
    });
    it('keeps an amended order bound to its selected supplier and currency', async () => {
      const context = await orderedRequest();
      await rejected(
        () =>
          command(context.row, 'AMEND_ORDER', {
            orderId: context.order.id,
            reason: 'Synthetic supplier change',
            supplierId: randomUUID(),
          }),
        422,
        'INVALID_REFERENCE',
      );
      await rejected(
        () =>
          command(context.row, 'AMEND_ORDER', {
            orderId: context.order.id,
            reason: 'Synthetic currency change',
            currencyCode: 'USD',
          }),
        422,
        'INVALID_REFERENCE',
      );
      expect(
        await database.client.procurementOrder.findUniqueOrThrow({
          where: { id: context.order.id },
        }),
      ).toMatchObject({
        version: 1,
        status: 'ISSUED',
        supplierId: context.order.supplierId,
        currencyCode: context.order.currencyCode,
      });
    });
    it('rejects malformed or oversized amended order metadata without changing the saved version', async () => {
      const context = await orderedRequest();
      await rejected(
        () =>
          command(context.row, 'AMEND_ORDER', {
            orderId: context.order.id,
            reason: 'Synthetic invalid date',
            supplierId: supplier,
            currencyCode: 'IRR',
            expectedAt: 'not-a-date',
            lines: [commercial(context.item.requestItemId)],
          }),
        422,
        'VALIDATION_ERROR',
      );
      await rejected(
        () =>
          command(context.row, 'AMEND_ORDER', {
            orderId: context.order.id,
            reason: 'Synthetic oversized tracking code',
            supplierId: supplier,
            currencyCode: 'IRR',
            trackingCode: 'x'.repeat(101),
            lines: [commercial(context.item.requestItemId)],
          }),
        422,
        'VALIDATION_ERROR',
      );
      expect(
        await database.client.procurementOrder.findUniqueOrThrow({
          where: { id: context.order.id },
        }),
      ).toMatchObject({ version: 1, status: 'ISSUED' });
    });
    it('offers only current unexpired selections whose suppliers remain active', async () => {
      const context = await selectedRequest();
      const available = await service.records(
        context.row.id,
        { kind: 'selections', page: 1 },
        maker,
      );
      expect(available.items).toEqual([
        expect.objectContaining({
          id: context.selection.id,
          supplierId: supplier,
          supplierName: 'Synthetic Supplier',
          quotation: expect.objectContaining({
            id: context.quotation.id,
            currencyCode: 'IRR',
          }),
        }),
      ]);

      supplierEnabled = false;
      try {
        expect(
          await service.records(
            context.row.id,
            { kind: 'selections', page: 1 },
            maker,
          ),
        ).toMatchObject({ items: [], hasMore: false });
      } finally {
        supplierEnabled = true;
      }

      await database.client.procurementQuotation.update({
        where: { id: context.quotation.id },
        data: { validUntil: new Date(Date.now() - 1000) },
      });
      expect(
        await service.records(
          context.row.id,
          { kind: 'selections', page: 1 },
          maker,
        ),
      ).toMatchObject({ items: [], hasMore: false });
    });
    it('blocks selecting an expired quotation', async () => {
      let row = await approvedRequest();
      row = await command(row, 'QUOTE', {
        supplierId: supplier,
        currencyCode: 'IRR',
        lines: [commercial(row.draft.items[0]!.id)],
        quotedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        validUntil: new Date(Date.now() - 86400000).toISOString(),
        deliveryAt: tomorrow,
        paymentTerms: 'Acceptance',
        documents,
      });
      const quote = await database.client.procurementQuotation.findFirstOrThrow(
        { where: { requestId: row.id } },
      );
      await rejected(
        () => command(row, 'SELECT_QUOTE', { quotationId: quote.id }),
        422,
        'QUOTATION_EXPIRED',
      );
      expect(
        await database.client.procurementSelection.count({
          where: { requestId: row.id },
        }),
      ).toBe(0);
    });
    it('blocks cumulative over-ordering, over-receipt and records identical receipt retry only once', async () => {
      const context = await orderedRequest();
      let row = context.row;
      await rejected(
        () =>
          command(row, 'ORDER', {
            selectionId: context.selection.id,
            expectedAt: tomorrow,
            paymentTerms: 'Acceptance',
            deliveryLocation: 'Office',
          }),
        422,
        'ORDER_EXCEEDS_APPROVED_QUANTITY',
      );
      const input = receiptInput(context.order.id, context.item.id, '6');
      const key = randomUUID();
      const received = await command(row, 'RECEIVE', input, maker, key);
      expect(await command(row, 'RECEIVE', input, maker, key)).toEqual(
        received,
      );
      row = received;
      expect(
        await database.client.procurementReceipt.count({
          where: { requestId: row.id },
        }),
      ).toBe(1);
      await rejected(
        () =>
          command(
            row,
            'RECEIVE',
            receiptInput(context.order.id, context.item.id, '4.0001'),
          ),
        422,
        'RECEIPT_EXCEEDS_ORDER',
      );
      await command(
        row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id, '4'),
      );
      const totals = await database.client.procurementReceiptItem.aggregate({
        where: { orderId: context.order.id },
        _sum: { quantity: true },
      });
      expect(totals._sum.quantity?.toString()).toBe('10');
    });
    it('requires service acceptance evidence before matching or Finance submission', async () => {
      const context = await orderedRequest('SERVICE');
      let row = context.row;
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id),
      );
      const invoice = await invoiceFor(row);
      expect(invoice.status).toBe('MISMATCH');
      expect(
        (await service.list({ queue: 'discrepant' }, maker)).items.some(
          (item) => item.id === row.id,
        ),
      ).toBe(true);
      await rejected(
        () => command(row, 'SUBMIT_FINANCE', { invoiceId: invoice.id }),
        422,
        'INVOICE_MISMATCH',
      );
      row = await command(row, 'ACCEPT_SERVICE', {
        orderId: context.order.id,
        itemId: context.item.id,
        quantity: '10',
        evidence: 'Synthetic signed completion report',
        documents,
        acceptedAt: instant,
      });
      row = await command(row, 'MATCH_INVOICE', { invoiceId: invoice.id });
      expect((await invoiceFor(row)).status).toBe('MATCHED');
      expect(
        (await service.list({ queue: 'discrepant' }, maker)).items.some(
          (item) => item.id === row.id,
        ),
      ).toBe(false);
    });
    it('matches cumulative partial invoices and reports price/currency differences without silently accepting them', async () => {
      const context = await orderedRequest();
      let row = await command(
        context.row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id),
      );
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '6' })],
        }),
      );
      expect((await invoiceFor(row)).status).toBe('MATCHED');
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '5' })],
        }),
      );
      expect((await invoiceFor(row)).status).toBe('MISMATCH');
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          currencyCode: 'USD',
          lines: [
            commercial(context.item.id, { quantity: '1', unitPrice: '11' }),
          ],
        }),
      );
      const mismatch = await invoiceFor(row);
      const evidence =
        await database.client.procurementInvoiceMatch.findFirstOrThrow({
          where: { invoiceId: mismatch.id },
        });
      expect(evidence.payload).toMatchObject({
        issues: expect.arrayContaining([
          { itemId: null, code: 'CURRENCY_MISMATCH' },
          { itemId: context.item.id, code: 'PRICE_MISMATCH' },
        ]),
      });
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '4' })],
        }),
      );
      expect((await invoiceFor(row)).status).toBe('MATCHED');
    });
    it('normalizes supplier/issuer invoice identity and rolls duplicate attempts back', async () => {
      const context = await orderedRequest();
      let row = await command(
        context.row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id),
      );
      const prefix = `DUP-${randomUUID()}-`;
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          number: `${prefix}۱۲۳`,
        }),
      );
      await rejected(
        () =>
          command(
            row,
            'INVOICE',
            invoiceInput(context.order.id, context.item.id, {
              number: ` ${prefix.toLowerCase()}1\u200b23 `,
            }),
          ),
        409,
        'DUPLICATE_INVOICE',
      );
      expect(
        await database.client.procurementInvoice.count({
          where: { requestId: row.id },
        }),
      ).toBe(1);
      expect(await service.detail(row.id, maker)).toEqual(row);
    });
    it('Finance retries create one source/outbox, and returns create a correction without changing Finance-owned payment data', async () => {
      const context = await orderedRequest();
      let row = await command(
        context.row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id),
      );
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id),
      );
      for (const section of ['quotes', 'orders', 'receipts', 'invoices']) {
        expect(
          (await service.list({ section }, maker)).items.some(
            (item) => item.id === row.id,
          ),
        ).toBe(true);
        expect(
          (
            await service.list(
              { section },
              { ...maker, branchIds: [otherBranch] },
            )
          ).items.some((item) => item.id === row.id),
        ).toBe(false);
      }
      await expect(
        service.list({ section: 'unknown' }, maker),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      const invoice = await invoiceFor(row);
      const paid = await paidFinanceFixture();
      const before = await financeState();
      const key = randomUUID();
      const submitted = await command(
        row,
        'SUBMIT_FINANCE',
        { invoiceId: invoice.id },
        maker,
        key,
      );
      expect(
        await command(
          row,
          'SUBMIT_FINANCE',
          { invoiceId: invoice.id },
          maker,
          key,
        ),
      ).toEqual(submitted);
      row = await command(submitted, 'SUBMIT_FINANCE', {
        invoiceId: invoice.id,
      });
      expect(
        (await service.list({ queue: 'finance' }, maker)).items.some(
          (item) => item.id === row.id,
        ),
      ).toBe(true);
      expect(
        (
          await service.list(
            { queue: 'finance' },
            { ...outsider, permissions: ['procurement.read.unit'] },
          )
        ).items,
      ).toEqual([]);
      expect(
        await database.client.procurementFinanceHandoff.count({
          where: { requestId: row.id },
        }),
      ).toBe(1);
      const handoff =
        await database.client.procurementFinanceHandoff.findFirstOrThrow({
          where: { requestId: row.id },
        });
      expect(handoff).toMatchObject({
        status: 'PENDING',
        lastErrorCode: null,
        acceptedSourceId: null,
      });
      expect(handoff.payload).toMatchObject({
        contract: 'procurement.finance-source.v1',
        sourceId: invoice.id,
        sourceVersion: 1,
        orderId: context.order.id,
        orderVersion: 1,
        amount: '100',
        currencyCode: 'IRR',
        issuer: { id: issuer, version: 1, label: 'Synthetic issuer' },
        supplier: { id: supplier, version: 1, label: 'Synthetic Supplier' },
        lines: [
          {
            itemId: context.item.id,
            quantity: '10',
            unitPrice: '10',
            amount: '100',
          },
        ],
      });
      const publicSources = new ProcurementPublicService(database);
      expect(
        await publicSources.listFinanceInvoiceSources([otherBranch]),
      ).toEqual([]);
      expect(await publicSources.listFinanceInvoiceSources([branch])).toEqual([
        {
          ...(handoff.payload as object),
          handoffCreatedAt: handoff.createdAt.toISOString(),
        },
      ]);
      expect(
        (
          await publicSources.listPendingConnectionEvents(
            [branch],
            'procurement.workflow-event.v1',
          )
        ).some(
          (event) =>
            (event.payload as { requestId?: string }).requestId === row.id,
        ),
      ).toBe(false);
      expect(
        await database.client.procurementOutbox.count({
          where: { handoffId: handoff.id, status: 'PENDING' },
        }),
      ).toBe(1);
      const receipt =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      row = await command(row, 'RETURN', {
        receiptItemId: receipt.id,
        quantity: '2',
        reason: 'Synthetic damage',
        returnedAt: instant,
        documents,
      });
      expect(await financeState()).toEqual(before);
      expect(
        await database.client.financeSupplierPaymentRevision.findUniqueOrThrow({
          where: { id: paid.id },
        }),
      ).toEqual(paid);
      expect(
        await database.client.procurementFinanceHandoff.findUniqueOrThrow({
          where: { id: handoff.id },
        }),
      ).toEqual(handoff);
      const returned = await database.client.procurementReturn.findFirstOrThrow(
        { where: { requestId: row.id } },
      );
      expect(returned.data).toMatchObject({
        financeCorrectionStatus: 'PENDING',
      });
      expect(
        await database.client.procurementDiscrepancy.count({
          where: { requestId: row.id, status: 'OPEN' },
        }),
      ).toBe(1);
      await rejected(
        () =>
          command(row, 'RETURN', {
            receiptItemId: receipt.id,
            quantity: '9',
            reason: 'Synthetic excessive return',
            returnedAt: instant,
            documents,
          }),
        422,
        'RETURN_EXCEEDS_ACCEPTANCE',
      );
    });
    it('appends idempotent receipt corrections, preserves original evidence and protects invoiced acceptance', async () => {
      const context = await orderedRequest();
      let row = await command(context.row, 'RECEIVE', {
        ...receiptInput(context.order.id, context.item.id),
        lines: [
          {
            itemId: context.item.id,
            quantity: '10',
            acceptedQuantity: '2',
            rejectedQuantity: '0',
          },
        ],
      });
      const original =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      const correction = {
        receiptItemId: original.id,
        receivedDelta: '0',
        acceptedDelta: '3',
        rejectedDelta: '0',
        reason: 'Synthetic pending inspection completed',
        documents,
      };
      await rejected(
        () =>
          command(row, 'ADJUST_RECEIPT', correction, {
            ...maker,
            permissions: maker.permissions.filter(
              (permission) => permission !== 'procurement.receipt.manage',
            ),
          }),
        403,
        'FORBIDDEN',
      );
      await rejected(
        () => command(row, 'ADJUST_RECEIPT', { ...correction, documents: [] }),
        422,
        'DOCUMENT_REQUIRED',
      );
      const key = randomUUID();
      const corrected = await command(
        row,
        'ADJUST_RECEIPT',
        correction,
        maker,
        key,
      );
      expect(
        await command(row, 'ADJUST_RECEIPT', correction, maker, key),
      ).toEqual(corrected);
      expect(
        await database.client.procurementReceiptAdjustment.count({
          where: { receiptItemId: original.id },
        }),
      ).toBe(1);
      row = await command(corrected, 'ADJUST_RECEIPT', {
        ...correction,
        acceptedDelta: '5',
        reason: 'Synthetic final inspection completed',
      });
      const adjustments =
        await database.client.procurementReceiptAdjustment.findMany({
          where: { receiptItemId: original.id },
          orderBy: { createdAt: 'asc' },
        });
      expect(adjustments).toHaveLength(2);
      expect(adjustments[1]!.data).toMatchObject({
        before: { received: '10', accepted: '5', rejected: '0' },
        after: { received: '10', accepted: '10', rejected: '0' },
      });
      expect(
        await database.client.procurementReceiptItem.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
      expect(
        (
          await service.list(
            { queue: 'partial', search: row.draft.title },
            maker,
          )
        ).items,
      ).toEqual([]);
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id),
      );
      expect((await invoiceFor(row)).status).toBe('MATCHED');
      await rejected(
        () =>
          command(row, 'ADJUST_RECEIPT', {
            ...correction,
            acceptedDelta: '-1',
            reason: 'Synthetic forbidden reduction',
          }),
        422,
        'FINANCIAL_ADJUSTMENT_POLICY_REQUIRED',
      );
      expect(
        await database.client.procurementReceiptAdjustment.count({
          where: { receiptItemId: original.id },
        }),
      ).toBe(2);
    });
    it('permits replacing rejected returns and deducts only accepted returns during invoice matching', async () => {
      const context = await orderedRequest();
      let row = await command(context.row, 'RECEIVE', {
        ...receiptInput(context.order.id, context.item.id),
        lines: [
          {
            itemId: context.item.id,
            quantity: '10',
            acceptedQuantity: '8',
            rejectedQuantity: '2',
          },
        ],
      });
      const original =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      const returned = {
        receiptItemId: original.id,
        quantity: '2',
        disposition: 'REJECTED',
        reason: 'Synthetic rejected units for replacement',
        returnedAt: instant,
        documents,
      };
      row = await command(row, 'RETURN', returned);
      const returnEvidence =
        await database.client.procurementReturn.findFirstOrThrow({
          where: { requestId: row.id },
        });
      expect(returnEvidence.data).toMatchObject({
        disposition: 'REJECTED',
        financeCorrectionStatus: 'NOT_APPLICABLE',
      });
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '8' })],
        }),
      );
      expect((await invoiceFor(row)).status).toBe('MATCHED');
      row = await command(
        row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id, '2'),
      );
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '2' })],
        }),
      );
      const replacementInvoice = await invoiceFor(row);
      expect(replacementInvoice.status).toBe('MATCHED');
      expect(
        await database.client.procurementReceiptItem.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
      await rejected(
        () =>
          command(
            row,
            'RECEIVE',
            receiptInput(context.order.id, context.item.id, '0.0001'),
          ),
        422,
        'RECEIPT_EXCEEDS_ORDER',
      );
      row = await command(row, 'RETURN', {
        ...returned,
        disposition: 'ACCEPTED',
        quantity: '1',
        reason: 'Synthetic accepted goods returned',
      });
      await command(row, 'MATCH_INVOICE', { invoiceId: replacementInvoice.id });
      expect(
        (
          await database.client.procurementInvoice.findUniqueOrThrow({
            where: { id: replacementInvoice.id },
          })
        ).status,
      ).toBe('MISMATCH');
    });
    it('cannot reuse an old order approval after reducing and reapproving the request quantity', async () => {
      const context = await orderedRequest('GOODS', false);
      let row = context.row;
      const edited = {
        ...row.draft,
        items: row.draft.items.map((item) => ({ ...item, quantity: '1' })),
      };
      // Either the edit must be rejected while a commercial commitment exists,
      // or the old commitment must become unissuable until explicitly reconciled.
      try {
        row = await procurementBoundary(() =>
          service.update(
            row.id,
            {
              expectedVersion: row.version,
              draft: edited,
              reason: 'Synthetic reduction',
            },
            randomUUID(),
            maker,
          ),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect([409, 422]).toContain((error as HttpException).getStatus());
        return;
      }
      row = await approve(await command(row, 'SUBMIT'));
      await expect(
        command(row, 'ISSUE_ORDER', { orderId: context.order.id }),
      ).rejects.toBeInstanceOf(HttpException);
    });
    it('reports each currency independently and enforces own, unit and branch scope in aggregate queries', async () => {
      const own: AuthenticatedActor = {
        ...maker,
        permissions: ['procurement.read.own'],
      };
      const before = await service.report({ dimension: 'currency' }, own);
      const previousIrr = Number(
        before.groups.items.find(
          (group) => group.currencyCode === 'IRR' && !group.cancelled,
        )?.amount ?? '0',
      );
      await orderedRequest();
      approvedPolicy = { ...approvedPolicy!, currencyCode: 'USD' };
      await orderedRequest('GOODS', true, 'USD');
      const report = await service.report({ dimension: 'currency' }, own);
      expect(report.basis).toBe('CURRENT_ORDER_VERSION_BY_CURRENCY');
      expect(report.finance).toBe('CONNECTED');
      expect(
        Number(
          report.groups.items.find(
            (group) => group.currencyCode === 'IRR' && !group.cancelled,
          )!.amount,
        ),
      ).toBe(previousIrr + 100);
      expect(
        Number(
          report.groups.items.find(
            (group) => group.currencyCode === 'USD' && !group.cancelled,
          )!.amount,
        ),
      ).toBe(100);
      const unit = await service.report(
        { dimension: 'unit' },
        { ...colleague, permissions: ['procurement.read.unit'] },
      );
      expect(unit.groups.items.every((group) => group.label === 'unit-a')).toBe(
        true,
      );
      expect(
        (
          await service.report(
            {},
            { ...outsider, permissions: ['procurement.read.unit'] },
          )
        ).groups.items,
      ).toEqual([]);
      expect(
        (await service.report({}, { ...maker, branchIds: [otherBranch] }))
          .counts,
      ).toEqual([]);
      await rejected(
        () => service.report({}, { ...maker, permissions: [] }),
        403,
      );
    });
    it('late and partial queues track outstanding accepted quantity and exclude completed delivery', async () => {
      const lateAt = new Date(Date.now() - 86400000).toISOString();
      const context = await orderedRequest('GOODS', true, 'IRR', lateAt);
      let row = context.row;
      expect(
        (
          await service.list({ queue: 'late', search: row.draft.title }, maker)
        ).items.map((item) => item.id),
      ).toEqual([row.id]);
      expect(
        (
          await service.list(
            { queue: 'partial', search: row.draft.title },
            maker,
          )
        ).items,
      ).toEqual([]);
      row = await command(
        row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id, '6'),
      );
      expect(
        (
          await service.list(
            { queue: 'partial', search: row.draft.title },
            maker,
          )
        ).items.map((item) => item.id),
      ).toEqual([row.id]);
      const before = await service.report({}, maker);
      row = await command(
        row,
        'RECEIVE',
        receiptInput(context.order.id, context.item.id, '4'),
      );
      expect(
        (await service.list({ queue: 'late', search: row.draft.title }, maker))
          .items,
      ).toEqual([]);
      expect(
        (
          await service.list(
            { queue: 'partial', search: row.draft.title },
            maker,
          )
        ).items,
      ).toEqual([]);
      const after = await service.report({}, maker);
      expect(after.performance!.completedOrders).toBe(
        before.performance!.completedOrders + 1,
      );
      expect(after.performance!.lateOrders).toBe(
        before.performance!.lateOrders - 1,
      );
    });
    it('rejects stale quotations and selections after a scope revision and excludes old prices from fresh comparison', async () => {
      const selected = await selectedRequest();
      let row = await procurementBoundary(() =>
        service.update(
          selected.row.id,
          {
            expectedVersion: selected.row.version,
            draft: {
              ...selected.row.draft,
              items: selected.row.draft.items.map((item) => ({
                ...item,
                specification: 'Revised technical specification',
              })),
            },
            reason: 'Synthetic specification revision',
          },
          randomUUID(),
          maker,
        ),
      );
      row = await approve(await command(row, 'SUBMIT'));
      await rejected(
        () =>
          command(row, 'SELECT_QUOTE', { quotationId: selected.quotation.id }),
        422,
        'STALE_QUOTATION',
      );
      await rejected(
        () =>
          command(row, 'ORDER', {
            selectionId: selected.selection.id,
            expectedAt: tomorrow,
            paymentTerms: 'Acceptance',
            deliveryLocation: 'Office',
          }),
        422,
        'STALE_SELECTION',
      );
      row = await command(row, 'QUOTE', {
        supplierId: supplier,
        currencyCode: 'IRR',
        lines: [commercial(row.draft.items[0]!.id, { unitPrice: '11' })],
        quotedAt: instant,
        validUntil: nextMonth,
        deliveryAt: tomorrow,
        paymentTerms: 'Acceptance',
        documents,
      });
      const fresh = await database.client.procurementQuotation.findFirstOrThrow(
        { where: { requestId: row.id, id: { not: selected.quotation.id } } },
      );
      // The old price of 10 is obsolete despite identical item IDs/quantities.
      await command(row, 'SELECT_QUOTE', { quotationId: fresh.id });
      const decision =
        await database.client.procurementSelection.findFirstOrThrow({
          where: { quotationId: fresh.id },
        });
      expect(decision.payload).toMatchObject({
        comparedQuotationIds: [fresh.id],
      });
      expect(
        await database.client.procurementQuotation.findUniqueOrThrow({
          where: { id: selected.quotation.id },
        }),
      ).toEqual(selected.quotation);
    });
    it('allows only one concurrent request to claim the same item ID under different create keys', async () => {
      const first = fixture();
      const second = { ...first, title: `Second claimant ${randomUUID()}` };
      const results = await Promise.allSettled([create(first), create(second)]);
      const success = results.filter((result) => result.status === 'fulfilled');
      const failure = results.filter((result) => result.status === 'rejected');
      expect(success).toHaveLength(1);
      expect(failure).toHaveLength(1);
      expect((failure[0]!.reason as HttpException).getResponse()).toMatchObject(
        { code: 'INVALID_REFERENCE' },
      );
      expect(
        await database.client.procurementRequest.count({
          where: { title: { in: [first.title, second.title] } },
        }),
      ).toBe(1);
      expect(
        (
          await database.client.procurementRequestItem.findUniqueOrThrow({
            where: { id: first.items[0]!.id },
          })
        ).requestId,
      ).toBe(success[0]!.value.id);
    });
    it('keeps page two scoped to own/unit identities before loading draft payloads', async () => {
      const prefix = `Pagination-${randomUUID()}`;
      const visible = Array.from({ length: 55 }, (_, index) => {
        const draft = fixture({ title: `${prefix}-${index}`, items: [] });
        return {
          id: randomUUID(),
          number: randomUUID(),
          branchId: branch,
          requesterUserId: maker.userId,
          unitId: 'unit-a',
          title: draft.title,
          data: json(draft),
          createdAt: new Date(instant),
        };
      });
      const hidden = Array.from({ length: 20 }, (_, index) => {
        const draft = fixture({
          title: `${prefix}-hidden-${index}`,
          unitId: 'unit-b',
          items: [],
        });
        return {
          id: randomUUID(),
          number: randomUUID(),
          branchId: branch,
          requesterUserId: outsider.userId,
          unitId: 'unit-b',
          title: draft.title,
          data: json(draft),
          createdAt: new Date(instant),
        };
      });
      const otherBranches = Array.from({ length: 10 }, (_, index) => {
        const draft = fixture({
          title: `${prefix}-other-branch-${index}`,
          branchId: otherBranch,
          items: [],
        });
        return {
          id: randomUUID(),
          number: randomUUID(),
          branchId: otherBranch,
          requesterUserId: maker.userId,
          unitId: 'unit-a',
          title: draft.title,
          data: json(draft),
          createdAt: new Date(instant),
        };
      });
      await database.client.procurementRequest.createMany({
        data: [...visible, ...hidden, ...otherBranches],
      });
      const expected = visible
        .map((row) => row.id)
        .sort()
        .reverse();
      const own: AuthenticatedActor = {
        ...maker,
        permissions: ['procurement.read.own'],
      };
      const first = await service.list({ search: prefix, page: 1 }, own);
      const second = await service.list({ search: prefix, page: 2 }, own);
      expect(first.items.map((row) => row.id)).toEqual(expected.slice(0, 50));
      expect(first.hasMore).toBe(true);
      expect(second.items.map((row) => row.id)).toEqual(expected.slice(50));
      expect(second.hasMore).toBe(false);
      expect(
        (
          await service.list(
            { search: prefix, page: 2 },
            { ...colleague, permissions: ['procurement.read.unit'] },
          )
        ).items.map((row) => row.id),
      ).toEqual(expected.slice(50));
    });
    it('uses the original requester unit for an authorized purchaser from another unit', async () => {
      let row = await create();
      row = await procurementBoundary(() =>
        service.update(
          row.id,
          {
            expectedVersion: row.version,
            draft: { ...row.draft, title: 'Purchaser-reviewed request' },
          },
          randomUUID(),
          outsider,
        ),
      );
      expect(row).toMatchObject({
        requesterUserId: maker.userId,
        draft: { unitId: 'unit-a' },
      });
      await rejected(
        () =>
          procurementBoundary(() =>
            service.update(
              row.id,
              {
                expectedVersion: row.version,
                draft: { ...row.draft, unitId: 'unit-b' },
              },
              randomUUID(),
              outsider,
            ),
          ),
        403,
        'FORBIDDEN',
      );
      row = await command(row, 'SUBMIT', {}, outsider);
      expect(row).toMatchObject({
        status: 'IN_REVIEW',
        requesterUserId: maker.userId,
        draft: { unitId: 'unit-a' },
      });
    });
    it.each(['GOODS', 'SERVICE'] as const)(
      'blocks closing accepted %s until every unit has an invoice handed to Finance',
      async (kind) => {
        const context = await orderedRequest(kind);
        let row = context.row;
        await rejected(
          () => command(row, 'CLOSE_REQUEST', { reason: 'Premature closure' }),
          422,
          'OPEN_COMMITMENTS',
        );
        row =
          kind === 'GOODS'
            ? await command(
                row,
                'RECEIVE',
                receiptInput(context.order.id, context.item.id),
              )
            : await command(row, 'ACCEPT_SERVICE', {
                orderId: context.order.id,
                itemId: context.item.id,
                quantity: '10',
                acceptedAt: instant,
                evidence: 'Synthetic completion',
                documents,
              });
        row = await command(row, 'CLOSE_REMAINDER', {
          orderId: context.order.id,
          reason: 'Delivery completed',
        });
        await rejected(
          () => command(row, 'CLOSE_REQUEST', { reason: 'No invoice yet' }),
          422,
          'OPEN_COMMITMENTS',
        );
        row = await command(
          row,
          'INVOICE',
          invoiceInput(context.order.id, context.item.id, {
            lines: [commercial(context.item.id, { quantity: '6' })],
          }),
        );
        await rejected(
          () =>
            command(row, 'CLOSE_REQUEST', { reason: 'Invoice not handed off' }),
          422,
          'OPEN_COMMITMENTS',
        );
        row = await command(row, 'SUBMIT_FINANCE', {
          invoiceId: (await invoiceFor(row)).id,
        });
        await rejected(
          () =>
            command(row, 'CLOSE_REQUEST', {
              reason: 'Four accepted units remain uninvoiced',
            }),
          422,
          'OPEN_COMMITMENTS',
        );
        row = await command(
          row,
          'INVOICE',
          invoiceInput(context.order.id, context.item.id, {
            lines: [commercial(context.item.id, { quantity: '4' })],
          }),
        );
        row = await command(row, 'SUBMIT_FINANCE', {
          invoiceId: (await invoiceFor(row)).id,
        });
        const key = randomUUID();
        const closed = await command(
          row,
          'CLOSE_REQUEST',
          { reason: 'All accepted units handed to Finance' },
          maker,
          key,
        );
        expect(closed.status).toBe('CLOSED');
        expect(
          await command(
            row,
            'CLOSE_REQUEST',
            { reason: 'All accepted units handed to Finance' },
            maker,
            key,
          ),
        ).toEqual(closed);
        expect(
          await database.client.procurementAudit.count({
            where: { requestId: row.id, action: 'CLOSE_REQUEST' },
          }),
        ).toBe(1);
      },
    );
    it.each(['CANCEL_ORDER', 'CLOSE_REMAINDER'])(
      'permits closing an unfulfilled request after %s without inventing an invoice',
      async (action) => {
        const empty = await create();
        await rejected(
          () => command(empty, 'CLOSE_REQUEST', { reason: 'No orders exist' }),
          422,
          'OPEN_COMMITMENTS',
        );
        const context = await orderedRequest();
        let row = await command(context.row, action, {
          orderId: context.order.id,
          reason: 'Synthetic unfulfilled commitment ended',
        });
        row = await command(row, 'CLOSE_REQUEST', {
          reason: 'No accepted quantity or financial obligation',
        });
        expect(row.status).toBe('CLOSED');
        expect(
          await database.client.procurementInvoice.count({
            where: { requestId: row.id },
          }),
        ).toBe(0);
      },
    );
    it('includes receipt corrections and subtracts accepted returns when checking closure obligations', async () => {
      const context = await orderedRequest();
      let row = await command(context.row, 'RECEIVE', {
        ...receiptInput(context.order.id, context.item.id),
        lines: [
          {
            itemId: context.item.id,
            quantity: '10',
            acceptedQuantity: '2',
            rejectedQuantity: '8',
          },
        ],
      });
      const receipt =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      row = await command(row, 'ADJUST_RECEIPT', {
        receiptItemId: receipt.id,
        receivedDelta: '0',
        acceptedDelta: '3',
        rejectedDelta: '-3',
        reason: 'Three inspected units accepted',
        documents,
      });
      row = await command(row, 'RETURN', {
        receiptItemId: receipt.id,
        disposition: 'ACCEPTED',
        quantity: '1',
        reason: 'One accepted unit returned',
        returnedAt: instant,
        documents,
      });
      await rejected(
        () =>
          command(row, 'CLOSE_REQUEST', { reason: 'Discrepancies still open' }),
        422,
        'OPEN_COMMITMENTS',
      );
      const discrepancies =
        await database.client.procurementDiscrepancy.findMany({
          where: { requestId: row.id, status: 'OPEN' },
        });
      for (const discrepancy of discrepancies)
        row = await command(row, 'RESOLVE_DISCREPANCY', {
          discrepancyId: discrepancy.id,
          resolution: 'RETURN',
          reason: 'Synthetic disposition documented',
        });
      row = await command(row, 'CLOSE_REMAINDER', {
        orderId: context.order.id,
        reason: 'Remainder settled',
      });
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '3' })],
        }),
      );
      row = await command(row, 'SUBMIT_FINANCE', {
        invoiceId: (await invoiceFor(row)).id,
      });
      await rejected(
        () =>
          command(row, 'CLOSE_REQUEST', {
            reason: 'One corrected accepted unit remains uninvoiced',
          }),
        422,
        'OPEN_COMMITMENTS',
      );
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '1' })],
        }),
      );
      row = await command(row, 'SUBMIT_FINANCE', {
        invoiceId: (await invoiceFor(row)).id,
      });
      expect(
        (
          await command(row, 'CLOSE_REQUEST', {
            reason: 'All four net accepted units handed off',
          })
        ).status,
      ).toBe('CLOSED');
    });
    it('requires explicit receipt disposition even after its discrepancy is marked resolved', async () => {
      const context = await orderedRequest();
      let row = await command(context.row, 'RECEIVE', {
        ...receiptInput(context.order.id, context.item.id),
        lines: [
          {
            itemId: context.item.id,
            quantity: '10',
            acceptedQuantity: '4',
            rejectedQuantity: '0',
          },
        ],
      });
      const receipt =
        await database.client.procurementReceiptItem.findFirstOrThrow({
          where: { orderId: context.order.id },
        });
      const discrepancy =
        await database.client.procurementDiscrepancy.findFirstOrThrow({
          where: { requestId: row.id, status: 'OPEN' },
        });
      row = await command(row, 'RESOLVE_DISCREPANCY', {
        discrepancyId: discrepancy.id,
        resolution: 'REJECT',
        reason: 'Synthetic inspection decision recorded',
      });
      row = await command(row, 'CLOSE_REMAINDER', {
        orderId: context.order.id,
        reason: 'Remaining order ended',
      });
      row = await command(
        row,
        'INVOICE',
        invoiceInput(context.order.id, context.item.id, {
          lines: [commercial(context.item.id, { quantity: '4' })],
        }),
      );
      row = await command(row, 'SUBMIT_FINANCE', {
        invoiceId: (await invoiceFor(row)).id,
      });
      await rejected(
        () =>
          command(row, 'CLOSE_REQUEST', {
            reason: 'Six received units still lack disposition',
          }),
        422,
        'OPEN_COMMITMENTS',
      );
      row = await command(row, 'ADJUST_RECEIPT', {
        receiptItemId: receipt.id,
        receivedDelta: '0',
        acceptedDelta: '0',
        rejectedDelta: '6',
        reason: 'Explicitly reject six remaining units',
        documents,
      });
      expect(
        (
          await command(row, 'CLOSE_REQUEST', {
            reason: 'All received quantities now have disposition',
          })
        ).status,
      ).toBe('CLOSED');
      expect(
        await database.client.procurementReceiptItem.findUniqueOrThrow({
          where: { id: receipt.id },
        }),
      ).toEqual(receipt);
    });
  },
);
