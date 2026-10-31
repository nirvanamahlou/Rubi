import { FinancePayrollService } from '../src/finance/operations/finance-payroll.service';
import {
  customerPurchaseSettlement,
  assertCustomerPurchaseCoverage,
} from '../src/sales/customer-purchase-settlement.public';
import { reservedCustomerRefunds } from '../src/finance/operations/receipt-refund-reservations.public';
import { FinanceReceiptAllocationService } from '../src/finance/operations/receipt-allocation.service';
import { MasterProcurementDirectory } from '../src/master-data/master-procurement-directory';
import { readFinanceHistory } from '../src/finance/finance-history';
import { SalesRepository } from '../src/sales/sales.repository';
import { presentSalesContract } from '../src/sales/sales.service';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  ACCOUNTING_PERMISSIONS,
  type AuthenticatedActor,
} from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { MasterDataService } from '../src/master-data/master-data.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import {
  recordFinancialEvent,
  type FinancialEventV1,
} from '../src/finance/accounting/financial-event.public';
import { FinancialEventDispatcher } from '../src/finance/accounting/financial-event-dispatcher';
const url =
  process.env.ACCOUNTING_TEST_DATABASE_URL ??
  (process.env.NORA_RUN_FINANCIAL_EVENT_POSTGRES_TESTS === '1'
    ? process.env.DATABASE_URL
    : undefined);
describe.skipIf(!url)(
  'confirmed financial events on isolated PostgreSQL',
  () => {
    let db: DatabaseClient,
      service: AccountingService,
      bookId: string,
      typeId: string,
      debitId: string,
      creditId: string;
    const branchId = randomUUID(),
      makerId = randomUUID(),
      checkerId = randomUUID();
    const maker: AuthenticatedActor = {
      userId: makerId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'finance.read',
        'finance.account.manage',
        'finance.request.manage',
        'finance.payment.create',
        'finance.receipt.approve',
        ...ACCOUNTING_PERMISSIONS,
      ],
    };
    const command = async <T = Record<string, unknown>>(
      action: string,
      payload: Record<string, unknown>,
      expectedVersion?: number,
      actor = maker,
      key: string = randomUUID(),
    ) =>
      JSON.parse(
        JSON.stringify(
          await service.command(
            bookId,
            action,
            {
              key,
              payload,
              ...(expectedVersion !== undefined ? { expectedVersion } : {}),
            },
            actor,
          ),
        ),
      ) as T;
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        target.hostname !== '127.0.0.1' ||
        !(
          (target.port === '55437' &&
            ['/accounting_test', '/accounting_clean'].includes(
              target.pathname,
            )) ||
          (target.port === '55494' &&
            target.pathname === '/accounting_design_qa') ||
          (process.env.CI === 'true' &&
            process.env.NORA_RUN_FINANCIAL_EVENT_POSTGRES_TESTS === '1' &&
            target.port === '5432' &&
            target.pathname === '/nora_ci' &&
            target.username === 'nora_ci')
        )
      )
        throw new Error('Dedicated accounting test container required.');
      db = createDatabaseClient(url);
      await db.branch.create({
        data: {
          id: branchId,
          code: branchId,
          name: 'Synthetic accounting branch',
        },
      });
      for (const id of [makerId, checkerId])
        await db.user.create({
          data: {
            id,
            username: id,
            displayName: 'Synthetic accountant',
            passwordHash: 'not-a-login-credential',
          },
        });
      service = new AccountingService(
        { client: db } as never,
        {
          branches: async (ids: string[]) =>
            ids.includes(branchId)
              ? [{ id: branchId, name: 'Synthetic', code: 'A' }]
              : [],
          displayNames: async (ids: string[]) =>
            ids.map((id) => ({ id, displayName: 'Synthetic accountant' })),
        } as never,
        undefined,
        new MasterDataService(
          new MasterDataRepository({ client: db } as never),
        ),
      );
      bookId = (
        await service.createBook(
          {
            id: randomUUID(),
            branchId,
            code: '01',
            title: 'Synthetic book',
            baseCurrency: 'IRR',
            approvalPolicy: 'DUAL_CONTROL',
          },
          maker,
        )
      ).id;
      const year = await command('save-configuration', {
        kind: 'fiscal-years',
        code: '2026',
        title: 'Fiscal 2026',
      });
      String(
        (
          await command('save-period', {
            fiscalYearId: year.id,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          })
        ).id,
      );
      typeId = String(
        (
          await command('save-configuration', {
            kind: 'voucher-types',
            code: '01',
            title: 'Manual journal',
          })
        ).id,
      );
      const group = await command('save-account', {
        code: '1',
        title: 'Assets',
        level: 'GROUP',
        nature: 'DEBIT',
      });
      const general = await command('save-account', {
        code: '11',
        title: 'Cash',
        level: 'GENERAL',
        nature: 'DEBIT',
        parentId: group.id,
      });
      debitId = String(
        (
          await command('save-account', {
            code: '1101',
            title: 'Bank cash',
            level: 'SUBSIDIARY',
            nature: 'DEBIT',
            parentId: general.id,
          })
        ).id,
      );
      creditId = String(
        (
          await command('save-account', {
            code: '1102',
            title: 'Clearing',
            level: 'SUBSIDIARY',
            nature: 'CREDIT',
            parentId: general.id,
          })
        ).id,
      );
    }, 120000);
    afterAll(async () => {
      await db?.$disconnect();
    });

    const input = (
      changes: Partial<FinancialEventV1> = {},
    ): FinancialEventV1 => ({
      source: 'SALES',
      recordId: randomUUID(),
      requestId: randomUUID(),
      kind: 'CUSTOMER_RECEIPT',
      branchId,
      actorId: makerId,
      occurredAt: new Date('2026-10-18T08:00:00Z'),
      amount: '123400',
      currency: 'IRR',
      partyId: randomUUID(),
      ...changes,
    });
    const capture = async (body = input()) => {
      await db.$transaction((tx) => recordFinancialEvent(tx, body));
      return db.financeAccountingEvent.findUniqueOrThrow({
        where: { sourceKey: `${body.source}:${body.recordId}` },
      });
    };
    const mapping = () => ({
      typeId,
      debitAccountId: debitId,
      creditAccountId: creditId,
    });
    it('captures once under concurrent replay and rejects changed source facts', async () => {
      const body = input();
      await Promise.all([capture(body), capture(body)]);
      expect(
        await db.financeAccountingEvent.count({
          where: { sourceKey: `SALES:${body.recordId}` },
        }),
      ).toBe(1);
      await expect(capture({ ...body, amount: '123401' })).rejects.toThrow();
      expect((await capture(body)).amount.toString()).toBe('123400');
    });
    it('rolls back business facts when durable source capture fails', async () => {
      const body = input();
      await expect(
        db.$transaction(async (tx) => {
          await tx.branch.update({
            where: { id: branchId },
            data: { name: 'must roll back' },
          });
          await recordFinancialEvent(tx, { ...body, amount: '0' });
        }),
      ).rejects.toThrow();
      expect(
        (await db.branch.findUniqueOrThrow({ where: { id: branchId } })).name,
      ).toBe('Synthetic accounting branch');
    });
    it('creates one balanced immutable source draft with local date and rejects cross-branch access', async () => {
      const event = await capture(
        input({ occurredAt: new Date('2026-10-17T21:00:00Z') }),
      );
      const first = await command('financial-event-journal', {
        eventId: event.id,
        ...mapping(),
        amount: '1',
      });
      const second = await command('financial-event-journal', {
        eventId: event.id,
        ...mapping(),
      });
      expect(first.id).toBe(second.id);
      expect(first.documentDate).toBe('2026-10-18');
      const saved = await db.accountingJournal.findUniqueOrThrow({
        where: { id: String(first.id) },
        include: { lines: true },
      });
      expect(saved.status).toBe('DRAFT');
      expect(saved.lines.map((l) => l.debit.toString())).toEqual([
        '123400',
        '0',
      ]);
      expect(saved.lines.map((l) => l.credit.toString())).toEqual([
        '0',
        '123400',
      ]);
      expect(saved.lines[0]!.attributes).toMatchObject({
        trackingNumber: event.requestId,
      });
      await expect(
        service.financialEvents(bookId, { ...maker, branchIds: [] }),
      ).rejects.toThrow();
      await expect(
        db.financeAccountingEvent.update({
          where: { id: event.id },
          data: { amount: '5' },
        }),
      ).rejects.toThrow();
      await expect(
        db.financeAccountingEvent.update({
          where: { id: event.id },
          data: { journalId: null },
        }),
      ).rejects.toThrow();
    });
    it('retains an unposted source when period, mapping or currency is invalid', async () => {
      const event = await capture(
        input({ occurredAt: new Date('2025-02-01T08:00:00Z') }),
      );
      await expect(
        command('financial-event-journal', { eventId: event.id, ...mapping() }),
      ).rejects.toThrow();
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: event.id },
          })
        ).journalId,
      ).toBeNull();
      const foreign = await capture(input({ currency: 'USD' }));
      await expect(
        command('financial-event-journal', {
          eventId: foreign.id,
          ...mapping(),
        }),
      ).rejects.toThrow();
      expect(
        await db.accountingJournal.count({
          where: { sourceKey: foreign.sourceKey },
        }),
      ).toBe(0);
    });
    it('settles an agency contract from actual receipts and reopens the remainder after a partial refund', async () => {
      const sales = new SalesRepository({ client: db } as never);
      const customerId = randomUUID();
      const contract = await db.salesContract.create({
        data: {
          contractNumber: randomUUID(),
          branchId,
          ownerUserId: makerId,
          customerId,
          payerCustomerId: customerId,
          customerNameSnapshot: 'Synthetic agency',
          tripType: 'ONE_WAY',
          originId: randomUUID(),
          destinationId: randomUUID(),
          departureDate: new Date('2026-11-01'),
          createIdempotencyKey: randomUUID(),
          createRequestFingerprint: 'a'.repeat(64),
          priceComponents: {
            create: {
              type: 'BASE',
              title: 'Service',
              amount: '100000',
              currencyCode: 'IRR',
            },
          },
          payments: {
            create: {
              amount: '100000',
              currencyCode: 'IRR',
              dueAt: new Date(),
              method: 'BANK_TRANSFER',
              idempotencyKey: randomUUID(),
              requestFingerprint: 'b'.repeat(64),
              createdByUserId: makerId,
            },
          },
        },
        include: { payments: true },
      });
      const account = await db.financeSettlementAccount.create({
        data: {
          branchId,
          title: randomUUID(),
          kind: 'BANK',
          currencyCode: 'IRR',
          createdByUserId: makerId,
        },
      });
      const paymentId = contract.payments[0]!.id;
      const approval = {
        contractId: contract.id,
        paymentId,
        financePaymentReference: randomUUID(),
        receiptAccountId: account.id,
        financeConfirmationId: randomUUID(),
        confirmedAt: new Date().toISOString(),
        reviewedByUserId: makerId,
      };
      expect(await sales.applyFinanceConfirmation(approval)).toBe('confirmed');
      expect(await sales.applyFinanceConfirmation(approval)).toBe('replayed');
      await db.$transaction(async (tx) => {
        const facts = await customerPurchaseSettlement(tx, contract.id, [
          branchId,
        ]);
        const holds = await reservedCustomerRefunds(
          tx,
          facts.receipts,
          branchId,
        );
        expect(() =>
          assertCustomerPurchaseCoverage(facts, holds),
        ).not.toThrow();
        expect(facts.balances).toEqual([
          { currencyCode: 'IRR', outstanding: '0' },
        ]);
        // A concurrent authorization/refund writer cannot pass the shared row lock.
        await expect(
          db.$transaction(async (contender) => {
            await contender.$executeRawUnsafe(
              "SET LOCAL lock_timeout = '100ms'",
            );
            await customerPurchaseSettlement(contender, contract.id, [
              branchId,
            ]);
          }),
        ).rejects.toThrow(/lock timeout|55P03/i);
      });
      const event = await db.financeAccountingEvent.findUniqueOrThrow({
        where: { sourceKey: `SALES:${paymentId}` },
      });
      expect(event.requestId).toBe(contract.id);
      expect(event.partyId).toBe(customerId);
      expect((await sales.findById(contract.id))!.settlementStatus).toBe(
        'SETTLED',
      );
      await db.financeCustomerDocumentDeliveryRevision.create({
        data: {
          contractId: contract.id,
          branchId,
          version: 1,
          approved: true,
          basis: 'FULL_SETTLEMENT',
          reason: 'تأیید تسویه قرارداد آزمایشی',
          actorUserId: makerId,
        },
      });
      const paymentMethod = await db.masterPaymentMethod.create({
        data: {
          code: randomUUID().slice(0, 32).toUpperCase(),
          name: 'Synthetic manual transfer',
          direction: 'PAYMENT',
          channel: 'BANK_TRANSFER',
          createdByUserId: makerId,
          updatedByUserId: makerId,
        },
      });
      const requestId = randomUUID(),
        operationId = randomUUID();
      await db.$transaction(async (tx) => {
        await tx.financeOperationalRequest.create({
          data: {
            id: requestId,
            branchId,
            requesterId: makerId,
            kind: 'REFUND',
            title: 'Synthetic refund',
            party: 'Synthetic',
            description: '',
            reference: '',
            amount: '25000',
            currencyCode: 'IRR',
            dueAt: new Date(),
            status: 'PAID',
            createFingerprint: 'c'.repeat(64),
            refundReceiptId: paymentId,
          },
        });
        await tx.financeOperationalRevision.create({
          data: {
            id: operationId,
            requestId,
            actorId: makerId,
            version: 1,
            action: 'PAY',
            toStatus: 'PAID',
            reason: '',
            fingerprint: 'd'.repeat(64),
            snapshot: {},
            paidAmount: '25000',
            cumulativePaid: '25000',
            remainingAmount: '0',
            accountId: account.id,
            methodId: paymentMethod.id,
            transferAt: new Date(),
          },
        });
        await sales.applyFinanceRefund(tx, {
          paymentId,
          operationId,
          actorId: makerId,
          amount: '25000',
          currency: 'IRR',
          branchId,
        });
      });
      await db.$transaction((tx) =>
        sales.applyFinanceRefund(tx, {
          paymentId,
          operationId,
          actorId: makerId,
          amount: '25000',
          currency: 'IRR',
          branchId,
        }),
      );
      const row = (await sales.findById(contract.id))!;
      expect(row.settlementStatus).toBe('PARTIALLY_SETTLED');
      await db.$transaction(async (tx) => {
        const facts = await customerPurchaseSettlement(tx, contract.id, [
          branchId,
        ]);
        const holds = await reservedCustomerRefunds(
          tx,
          facts.receipts,
          branchId,
        );
        expect(holds.get('IRR')).toBe('0');
        expect(() => assertCustomerPurchaseCoverage(facts, holds)).toThrow(
          'تسویه کامل',
        );
      });
      expect(
        await db.financeCustomerDocumentDeliveryRevision.findFirst({
          where: { contractId: contract.id },
          orderBy: { version: 'desc' },
        }),
      ).toMatchObject({ approved: false, version: 2 });
      expect(presentSalesContract(row).balances[0]).toMatchObject({
        confirmedPaid: '75000',
        outstanding: '25000',
      });
      expect(await db.salesPaymentRefund.count({ where: { paymentId } })).toBe(
        1,
      );
      expect(
        (await sales.financeCustomerDocumentDeliveryFacts(contract.id, [
          branchId,
        ]))!.settlementStatus,
      ).toBe('PARTIALLY_SETTLED');
      const overdue = await db.salesContractPaymentEntry.create({
        data: {
          contractId: contract.id,
          amount: '25000',
          currencyCode: 'IRR',
          dueAt: new Date(Date.now() - 86400000),
          method: 'BANK_TRANSFER',
          status: 'SCHEDULED',
          idempotencyKey: randomUUID(),
          requestFingerprint: 'f'.repeat(64),
          createdByUserId: makerId,
        },
      });
      expect(
        (await sales.pendingFinancePayments([branchId])).some(
          (p) => p.id === overdue.id,
        ),
      ).toBe(true);
      expect(
        await sales.applyFinanceConfirmation({
          ...approval,
          paymentId: overdue.id,
          financeConfirmationId: randomUUID(),
        }),
      ).toBe('confirmed');
      expect((await sales.findById(contract.id))!.settlementStatus).toBe(
        'SETTLED',
      );
      const future = await db.salesContractPaymentEntry.create({
        data: {
          contractId: contract.id,
          amount: '1',
          currencyCode: 'IRR',
          dueAt: new Date(Date.now() + 86400000),
          method: 'BANK_TRANSFER',
          status: 'SCHEDULED',
          idempotencyKey: randomUUID(),
          requestFingerprint: 'e'.repeat(64),
          createdByUserId: makerId,
        },
      });
      expect(
        (await sales.pendingFinancePayments([branchId])).some(
          (p) => p.id === future.id,
        ),
      ).toBe(false);
      await expect(
        sales.applyFinanceConfirmation({
          ...approval,
          paymentId: future.id,
          financeConfirmationId: randomUUID(),
        }),
      ).rejects.toThrow('وضعیت بررسی مالی');
      expect(
        await db.financeAccountingEvent.count({
          where: { sourceKey: `SALES:${future.id}` },
        }),
      ).toBe(0);
    }, 30000);
    it.each(['COMMISSION', 'ADJUSTMENT', 'CHECK'])(
      'requires independent approval and preserves the existing %s form workflow',
      async (kind) => {
        const finance = new FinancePayrollService(
          { client: db } as never,
          {} as never,
          undefined,
          undefined,
          { assertCurrency: async () => {} } as never,
        );
        const input = {
          operationId: randomUUID(),
          branchId,
          kind,
          title: 'Synthetic request',
          party: 'Synthetic payee',
          amount: '25.125',
          currencyCode: 'IRR',
          dueAt: '2026-10-26',
          reference: randomUUID(),
        };
        if (kind === 'CHECK') {
          await expect(
            finance.createManual({ ...input, reference: ' ' }, maker),
          ).rejects.toThrow('شماره چک');
          expect(
            await db.financeOperationalRequest.count({
              where: { id: input.operationId },
            }),
          ).toBe(0);
        }
        const { requestId } = await finance.createManual(input, maker);
        await finance.action(
          requestId,
          { operationId: randomUUID(), expectedVersion: 1, action: 'REVIEW' },
          maker,
        );
        const approve = {
          operationId: randomUUID(),
          expectedVersion: 2,
          action: 'APPROVE',
        };
        await expect(finance.action(requestId, approve, maker)).rejects.toThrow(
          'شخص دیگری',
        );
        expect(await finance.detail(requestId, maker)).toMatchObject({
          status: 'UNDER_REVIEW',
          version: 2,
        });
        expect(
          await db.financeAccountingEvent.count({ where: { requestId } }),
        ).toBe(0);
        const checker = { ...maker, userId: checkerId };
        await expect(
          finance.action(requestId, approve, checker),
        ).resolves.toMatchObject({ status: 'APPROVED', version: 3 });
        await expect(
          finance.action(requestId, approve, checker),
        ).resolves.toMatchObject({ status: 'APPROVED', version: 3 });
        expect(
          await db.financeOperationalRevision.count({
            where: { requestId, action: 'APPROVE' },
          }),
        ).toBe(1);
      },
      30000,
    );
    it.each(['IRR', 'USD'])(
      'records the full manual %s petty-cash cycle without treating funding as expense',
      async (currencyCode) => {
        const checker: AuthenticatedActor = { ...maker, userId: checkerId };
        const directory = new MasterProcurementDirectory({
          client: db,
        } as never);
        const documents = {
          detail: async (id: string) => {
            const doc = await db.document.findUniqueOrThrow({
              where: { id },
              include: { currentVersion: true },
            });
            return { data: { ...doc, currentVersion: doc.currentVersion! } };
          },
        };
        const finance = new FinancePayrollService(
          { client: db } as never,
          {} as never,
          undefined,
          documents as never,
          {
            assertCurrency: async () => {},
            activeOutgoingPaymentMethod:
              directory.activeOutgoingPaymentMethod.bind(directory),
            activeIncomingPaymentMethod:
              directory.activeIncomingPaymentMethod.bind(directory),
          } as never,
        );
        const method = await db.masterPaymentMethod.create({
          data: {
            code: randomUUID().slice(0, 32).toUpperCase(),
            name: 'Manual cash',
            channel: 'CASH',
            direction: 'BOTH',
            createdByUserId: makerId,
            updatedByUserId: makerId,
          },
        });
        const account = await db.financeSettlementAccount.create({
          data: {
            branchId,
            title: randomUUID(),
            kind: 'CASH',
            currencyCode,
            createdByUserId: makerId,
          },
        });
        const docType = await db.documentType.create({
          data: {
            code: randomUUID(),
            name: 'Synthetic expense proof',
            domain: 'FINANCE',
            allowedMimeTypes: ['application/pdf'],
          },
        });
        const proof = async () => {
          const doc = await db.document.create({
            data: {
              title: 'Synthetic receipt',
              documentTypeId: docType.id,
              branchId,
              ownerUserId: makerId,
              sourceModule: 'FINANCE',
              createdByUserId: makerId,
              updatedByUserId: makerId,
            },
          });
          const version = await db.documentVersion.create({
            data: {
              documentId: doc.id,
              versionNumber: 1,
              storageObjectKey: randomUUID(),
              originalFileName: 'synthetic.pdf',
              safeDownloadName: 'synthetic.pdf',
              detectedMimeType: 'application/pdf',
              extension: 'pdf',
              sizeBytes: 1n,
              sha256: 'a'.repeat(64),
              scanStatus: 'CLEAN',
              versionNote: 'Synthetic only',
              createdByUserId: makerId,
            },
          });
          await db.document.update({
            where: { id: doc.id },
            data: { currentVersionId: version.id, currentVersionNumber: 1 },
          });
          return doc.id;
        };
        const create = async (
          kind: string,
          amount: string,
          fundId?: string,
          documentId?: string,
        ) =>
          (
            await finance.createManual(
              {
                operationId: randomUUID(),
                branchId,
                kind,
                title: kind,
                party: 'Synthetic custodian',
                description: 'Synthetic isolated expense',
                reference: randomUUID(),
                amount,
                currencyCode,
                dueAt: '2026-10-18',
                ...(fundId ? { pettyFundId: fundId } : {}),
                ...(documentId ? { documentId } : {}),
              },
              maker,
            )
          ).requestId;
        const act = async (
          id: string,
          action: string,
          body: Record<string, unknown> = {},
          actor = checker,
        ) =>
          finance.action(
            id,
            {
              operationId: randomUUID(),
              expectedVersion: (await finance.detail(id, maker)).version,
              action,
              reason: 'Synthetic proof review',
              ...body,
            },
            actor,
          );
        const approve = async (id: string) => {
          await act(id, 'REVIEW');
          return act(id, 'APPROVE');
        };
        const pay = (amount: string) => ({
          paidAmount: amount,
          accountId: account.id,
          methodId: method.id,
          transferAt: new Date().toISOString(),
          paymentReference: randomUUID(),
        });
        const fund = await create('PETTY_CASH_ADVANCE', '1000');
        await act(fund, 'REVIEW');
        await expect(act(fund, 'APPROVE', {}, maker)).rejects.toThrow();
        await act(fund, 'APPROVE');
        await act(fund, 'PAY', pay('1000'));
        const firstProof = await proof();
        const expense = await create(
          'PETTY_CASH_EXPENSE',
          '600',
          fund,
          firstProof,
        );
        await approve(expense);
        expect(
          (await finance.detail(fund, maker)).pettyBalance?.available,
        ).toBe('400');
        await expect(
          create('PETTY_CASH_EXPENSE', '600', fund, firstProof),
        ).rejects.toThrow();
        await expect(act(expense, 'PAY', pay('600'))).rejects.toThrow();
        const overspend = await create(
          'PETTY_CASH_EXPENSE',
          '700',
          fund,
          await proof(),
        );
        await act(overspend, 'REVIEW');
        await expect(act(overspend, 'APPROVE')).rejects.toThrow();
        await act(overspend, 'REJECT');
        const topup = await create('PETTY_CASH_TOPUP', '700', fund);
        await approve(topup);
        await expect(act(topup, 'PAY', pay('700'))).rejects.toThrow();
        const secondExpense = await create(
          'PETTY_CASH_EXPENSE',
          '100',
          fund,
          await proof(),
        );
        await approve(secondExpense);
        await act(topup, 'PAY', pay('700'));
        await expect(act(fund, 'CLOSE')).rejects.toThrow();
        const receipt = await create('PETTY_CASH_RETURN', '1000', fund);
        await approve(receipt);
        await act(receipt, 'PAY', pay('1000'));
        const closed = await act(fund, 'CLOSE');
        expect(closed.status).toBe('CLOSED');
        expect(closed.pettyBalance).toMatchObject({
          funded: '1700',
          expenses: '700',
          returned: '1000',
          available: '0',
        });
        await expect(
          create('PETTY_CASH_EXPENSE', '1', fund, await proof()),
        ).rejects.toThrow();
        const history = await readFinanceHistory(
          { client: db } as never,
          {} as never,
          {} as never,
          { source: 'OPERATIONAL', requestId: receipt, direction: 'RECEIPT' },
          maker,
        );
        expect(history.items).toHaveLength(1);
        expect(history.items[0]!.direction).toBe('RECEIPT');
        const expenseEvents = await db.financeAccountingEvent.findMany({
          where: { requestId: expense },
        });
        expect(expenseEvents.map((e) => e.kind)).toEqual([
          'PETTY_CASH_EXPENSE_POSTED',
        ]);
        expect(
          await db.financeOperationalRevision.count({
            where: { requestId: expense, action: 'PAY' },
          }),
        ).toBe(0);
      },
      60000,
    );
    it('records late posting with its reason and rebuilds only an observed unposted draft', async () => {
      const event = await capture(
        input({ occurredAt: new Date('2025-12-31T08:00:00Z') }),
      );
      await expect(
        command('financial-event-journal', {
          eventId: event.id,
          ...mapping(),
          documentDate: '2026-01-01',
        }),
      ).rejects.toThrow('علت');
      const journal = await command('financial-event-journal', {
        eventId: event.id,
        ...mapping(),
        documentDate: '2026-01-01',
        latePostingReason: 'ثبت دریافت سنوات قبل پس از بررسی مدرک',
      });
      const rebuilt = await command(
        'financial-event-journal',
        {
          eventId: event.id,
          ...mapping(),
          rebuild: true,
          documentDate: '2026-01-02',
          latePostingReason: 'اصلاح تاریخ ثبت پیش از تأیید نهایی سند',
        },
        Number(journal.version),
      );
      expect(rebuilt.id).toBe(journal.id);
      expect(rebuilt.documentDate).toBe('2026-01-02');
      expect(
        (rebuilt.attributes as { sourceOccurredAt: string }).sourceOccurredAt,
      ).toBe(event.occurredAt.toISOString());
      expect(
        await db.accountingJournal.count({
          where: { sourceKey: event.sourceKey },
        }),
      ).toBe(1);
      await expect(
        command(
          'financial-event-journal',
          { eventId: event.id, ...mapping(), rebuild: true },
          Number(journal.version),
        ),
      ).rejects.toThrow();
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: event.id },
          })
        ).occurredAt,
      ).toEqual(event.occurredAt);
    });
    it('keeps the period open while a confirmed financial source has no journal', async () => {
      await capture();
      const period = await db.accountingPeriod.findFirstOrThrow({
        where: { bookId, status: 'OPEN' },
      });
      await expect(
        command('close-period', { id: period.id }, period.version),
      ).rejects.toThrow('منابع مالی بدون سند');
      expect(
        (
          await db.accountingPeriod.findUniqueOrThrow({
            where: { id: period.id },
          })
        ).status,
      ).toBe('OPEN');
    });
    it('does not close a period merely because its financial draft was cancelled', async () => {
      const year = await command('save-configuration', {
        kind: 'fiscal-years',
        code: '2024',
        title: 'Synthetic prior year',
      });
      const period = await command('save-period', {
        fiscalYearId: year.id,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      const event = await capture(
        input({ occurredAt: new Date('2024-06-01T08:00:00Z') }),
      );
      const journal = await command('financial-event-journal', {
        eventId: event.id,
        ...mapping(),
      });
      await command('cancel', { id: journal.id }, Number(journal.version));
      await expect(
        command('close-period', { id: period.id }, Number(period.version)),
      ).rejects.toThrow('منابع مالی بدون سند');
      expect(
        (
          await db.accountingPeriod.findUniqueOrThrow({
            where: { id: String(period.id) },
          })
        ).status,
      ).toBe('OPEN');
    });
    it('values foreign events at their approved operation-time rate and reports currencies separately', async () => {
      const parent = await db.accountingAccount.findFirstOrThrow({
        where: { bookId, level: 'GENERAL' },
      });
      const fxDebit = await command('save-account', {
        code: '1103',
        title: 'Foreign cash',
        level: 'SUBSIDIARY',
        nature: 'DEBIT',
        parentId: parent.id,
        attributes: { multiCurrency: true },
      });
      const fxCredit = await command('save-account', {
        code: '1104',
        title: 'Foreign clearing',
        level: 'SUBSIDIARY',
        nature: 'CREDIT',
        parentId: parent.id,
        attributes: { multiCurrency: true },
      });
      const rate = await db.accountingFxSnapshot.create({
        data: {
          bookId,
          currency: 'USD',
          rate: '500000',
          source: 'Synthetic approved operation rate',
          validFrom: new Date('2026-10-17T00:00:00Z'),
          validTo: new Date('2026-10-19T00:00:00Z'),
          status: 'APPROVED',
          makerId,
          approverId: checkerId,
        },
      });
      const event = await capture(
        input({ currency: 'USD', amount: '12.3456' }),
      );
      const journal = await command('financial-event-journal', {
        eventId: event.id,
        typeId,
        debitAccountId: fxDebit.id,
        creditAccountId: fxCredit.id,
      });
      const saved = await db.accountingJournal.findUniqueOrThrow({
        where: { id: String(journal.id) },
        include: { lines: true },
      });
      expect(saved.lines[0]!.debit.toString()).toBe('6172800');
      expect(saved.lines[0]!.foreignAmount?.toString()).toBe('12.3456');
      expect(saved.lines[0]!.fxSnapshotId).toBe(rate.id);
      const reconciliation = await service.financialEventReconciliation(
        bookId,
        maker,
      );
      expect(
        reconciliation.rows.find(
          (r) => r.currency === 'USD' && r.state === 'DRAFT',
        )?.amount,
      ).toBe('12.3456');
      expect(reconciliation.rows.some((r) => r.currency === 'IRR')).toBe(true);
      await expect(
        service.financialEventReconciliation(bookId, {
          ...maker,
          branchIds: [],
        }),
      ).rejects.toThrow();
      const page = await service.financialEvents(bookId, maker, {
        pending: 'true',
      });
      expect(page.items.some((e) => e.id === event.id)).toBe(false);
    });
    it('allocates a posted receipt without another cash movement and reverses it immutably', async () => {
      const customerId = randomUUID();
      const createContract = (amount: string) =>
        db.salesContract.create({
          data: {
            contractNumber: randomUUID(),
            branchId,
            ownerUserId: makerId,
            customerId,
            payerCustomerId: customerId,
            customerNameSnapshot: 'Synthetic allocation agency',
            tripType: 'ONE_WAY',
            originId: randomUUID(),
            destinationId: randomUUID(),
            departureDate: new Date('2026-11-01'),
            createIdempotencyKey: randomUUID(),
            createRequestFingerprint: 'a'.repeat(64),
            priceComponents: {
              create: {
                type: 'BASE',
                title: 'Service',
                amount,
                currencyCode: 'IRR',
              },
            },
          },
        });
      const source = await createContract('100000');
      const target = await createContract('60000');
      const account = await db.financeSettlementAccount.create({
        data: {
          branchId,
          title: randomUUID(),
          kind: 'BANK',
          currencyCode: 'IRR',
          createdByUserId: makerId,
        },
      });
      const payment = await db.salesContractPaymentEntry.create({
        data: {
          contractId: source.id,
          amount: '100000',
          currencyCode: 'IRR',
          dueAt: new Date(),
          method: 'BANK_TRANSFER',
          status: 'FINANCE_CONFIRMED',
          idempotencyKey: randomUUID(),
          requestFingerprint: 'b'.repeat(64),
          createdByUserId: makerId,
          financeReceiptAccountId: account.id,
          financeConfirmedAt: new Date(),
        },
      });
      const event = await capture(
        input({
          recordId: payment.id,
          requestId: source.id,
          partyId: customerId,
          amount: '100000',
        }),
      );
      const allocation = new FinanceReceiptAllocationService({
        client: db,
      } as never);
      expect((await allocation.context(event.id, maker)).accountingReady).toBe(
        false,
      );
      let journal = await command<{ id: string; version: number }>(
        'financial-event-journal',
        { eventId: event.id, ...mapping() },
      );
      for (const action of ['submit', 'approve', 'post'])
        journal = await command(
          action,
          { id: journal.id },
          journal.version,
          action === 'approve' ? { ...maker, userId: checkerId } : maker,
        );
      const context = await allocation.context(event.id, maker);
      const body = {
        operationId: randomUUID(),
        targetContractId: target.id,
        amount: '40000',
        reason: 'Synthetic contractual allocation',
        expectedSourceVersion: context.sourceVersion,
        expectedTargetVersion: target.version,
      };
      const [first, replay] = await Promise.all([
        allocation.command(event.id, body, maker),
        allocation.command(event.id, body, maker),
      ]);
      expect(replay).toEqual(first);
      expect((await allocation.context(event.id, maker)).availableAmount).toBe(
        '60000',
      );
      expect(
        (await db.salesContract.findUniqueOrThrow({ where: { id: target.id } }))
          .settlementStatus,
      ).toBe('PARTIALLY_SETTLED');
      expect(
        await db.salesContractPaymentEntry.count({
          where: { contractId: target.id },
        }),
      ).toBe(0);
      await expect(
        allocation.command(event.id, { ...body, amount: '1' }, maker),
      ).rejects.toThrow();
      await expect(
        allocation.context(event.id, { ...maker, branchIds: [] }),
      ).rejects.toThrow();
      const derived = await db.financeAccountingEvent.findUniqueOrThrow({
        where: { sourceKey: `SALES:RECEIPT_ALLOCATION:${first.id}` },
      });
      expect(derived.carryingAmount?.toString()).toBe('40000');
      const draft = await command<{ id: string; version: number }>(
        'financial-event-journal',
        { eventId: derived.id },
      );
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: draft.id },
        orderBy: { position: 'asc' },
      });
      expect(lines.map((line) => line.accountId)).toEqual([creditId, creditId]);
      expect(lines.map((line) => line.debit.toString())).toEqual([
        '40000',
        '0',
      ]);
      await expect(
        db.salesReceiptAllocation.update({
          where: { id: first.id },
          data: { amount: '1' },
        }),
      ).rejects.toThrow();
      const current = await allocation.context(event.id, maker);
      const row = current.allocations.find((item) => item.id === first.id)!;
      const rejectedOperation = randomUUID();
      await expect(
        allocation.command(
          event.id,
          {
            ...body,
            operationId: rejectedOperation,
            amount: '30000',
            expectedSourceVersion: current.sourceVersion,
            expectedTargetVersion: row.targetVersion,
          },
          maker,
        ),
      ).rejects.toThrow();
      expect(
        await db.salesReceiptAllocation.count({
          where: { id: rejectedOperation },
        }),
      ).toBe(0);
      expect(
        await db.financeAccountingEvent.count({
          where: { sourceKey: `SALES:RECEIPT_ALLOCATION:${rejectedOperation}` },
        }),
      ).toBe(0);
      let postedAllocation = await command<{ id: string; version: number }>(
        'submit',
        { id: draft.id },
        draft.version,
      );
      await expect(
        command('approve', { id: draft.id }, postedAllocation.version),
      ).rejects.toThrow();
      postedAllocation = await command(
        'approve',
        { id: draft.id },
        postedAllocation.version,
        { ...maker, userId: checkerId },
      );
      postedAllocation = await command(
        'post',
        { id: draft.id },
        postedAllocation.version,
      );
      await expect(
        command(
          'reverse',
          { id: draft.id, reason: 'Synthetic direct journal reversal' },
          postedAllocation.version,
        ),
      ).rejects.toThrow();
      const reverse = {
        operationId: randomUUID(),
        reason: 'Synthetic full allocation reversal',
        expectedSourceVersion: current.sourceVersion,
        expectedTargetVersion: row.targetVersion,
      };
      expect(
        (await allocation.command(event.id, reverse, maker, first.id)).status,
      ).toBe('REVERSED');
      expect((await allocation.context(event.id, maker)).availableAmount).toBe(
        '100000',
      );
      expect(
        (await db.salesContract.findUniqueOrThrow({ where: { id: target.id } }))
          .settlementStatus,
      ).toBe('UNPAID');
      await expect(
        allocation.command(
          event.id,
          { ...reverse, operationId: randomUUID() },
          maker,
          first.id,
        ),
      ).rejects.toThrow();
    }, 120000);
    it('dispatches only new exact-match sources using live authority and never approves them', async () => {
      const body = input();
      const old = await capture(body);
      const rule = await command('financial-rule-save', {
        eventId: old.id,
        ...mapping(),
      });
      const next = await capture({ ...body, recordId: randomUUID() });
      const unmatched = await capture({
        ...body,
        recordId: randomUUID(),
        partyId: randomUUID(),
      });
      const scopedDatabase = {
        client: {
          financeAccountingEvent: {
            findMany: (args: { where: object }) =>
              db.financeAccountingEvent.findMany({
                ...args,
                where: { ...args.where, branchId },
                take: 25,
              }),
            updateMany: db.financeAccountingEvent.updateMany.bind(
              db.financeAccountingEvent,
            ),
          },
          accountingConfiguration: db.accountingConfiguration,
        },
      };
      const dispatcher = new FinancialEventDispatcher(
        scopedDatabase as never,
        service,
        { reminderPrincipal: async () => maker } as never,
      );
      await dispatcher.tick();
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: old.id },
          })
        ).journalId,
      ).toBeNull();
      const updated = await db.financeAccountingEvent.findUniqueOrThrow({
        where: { id: next.id },
        include: { journal: true },
      });
      expect(updated.journal?.status).toBe('DRAFT');
      expect(updated.journal?.approverId).toBeNull();
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: unmatched.id },
          })
        ).lastError,
      ).toBeTruthy();
      await dispatcher.tick();
      expect(
        await db.accountingJournal.count({
          where: { sourceKey: next.sourceKey },
        }),
      ).toBe(1);
      const revoked = await capture({ ...body, recordId: randomUUID() });
      const noAuthority = new FinancialEventDispatcher(
        scopedDatabase as never,
        service,
        { reminderPrincipal: async () => null } as never,
      );
      await noAuthority.tick();
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: revoked.id },
          })
        ).journalId,
      ).toBeNull();
      expect(rule.kind).toBe('financial-event-rules');
    });
  },
);
