import { FinanceInboxService } from '../src/finance/finance-inbox.service';
import { SalesRepository } from '../src/sales/sales.repository';
import { FinancialEventDispatcher } from '../src/finance/accounting/financial-event-dispatcher';
import {
  hasPendingSalesContractAccounting,
  captureSalesContractAccounting,
  SALES_CONTRACT_EVENT,
} from '../src/finance/accounting/sales-contract-accounting.public';
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
import { recordFinancialEvent } from '../src/finance/accounting/financial-event.public';
import {
  grossAccrualCovers,
  assertRevenueEditable,
} from '../src/finance/accounting/accounting.workflows';
const url =
  process.env.ACCOUNTING_TEST_DATABASE_URL ??
  (process.env.NORA_RUN_FINANCIAL_EVENT_POSTGRES_TESTS === '1'
    ? process.env.DATABASE_URL
    : undefined);
describe.skipIf(!url)(
  'accounting workflow completion on isolated PostgreSQL',
  { timeout: 30000 },
  () => {
    let db: DatabaseClient,
      service: AccountingService,
      bookId: string,
      typeId: string,
      debitId: string,
      creditId: string,
      profitLossId: string;
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
      profitLossId = String(
        (
          await command('save-account', {
            code: '1103',
            title: 'Synthetic FX result',
            level: 'SUBSIDIARY',
            nature: 'ANY',
            parentId: general.id,
          })
        ).id,
      );
    }, 120000);
    afterAll(async () => {
      await db?.$disconnect();
    });

    const checker = { ...maker, userId: checkerId };
    async function post(id: string) {
      let j = await db.accountingJournal.findUniqueOrThrow({ where: { id } });
      for (const action of ['submit', 'approve', 'post'])
        j = await command<typeof j>(
          action,
          { id },
          j.version,
          action === 'approve' ? checker : maker,
        );
      return j;
    }
    const evidence = (
      kind: string,
      sourceId: string,
      extra: Record<string, unknown> = {},
    ) => ({
      kind,
      sourceId,
      date: '2026-10-25',
      reference: randomUUID(),
      reason: 'Synthetic documented financial evidence',
      ...extra,
    });
    async function contract() {
      const customerId = randomUUID();
      return db.salesContract.create({
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
          departureDate: new Date('2026-10-25'),
          createdAt: new Date('2026-10-01'),
          status: 'COMPLETED',
          createIdempotencyKey: randomUUID(),
          createRequestFingerprint: 'a'.repeat(64),
          priceComponents: {
            create: [
              {
                type: 'BASE',
                title: 'Service',
                amount: '100000',
                currencyCode: 'IRR',
              },
              {
                type: 'TAX',
                title: 'Source tax',
                amount: '9000',
                currencyCode: 'IRR',
              },
            ],
          },
        },
      });
    }
    async function approveContractReceipt(contractId: string, approve = true) {
      const repository = new SalesRepository({ client: db } as never);
      const component = await db.salesContractPriceComponent.findFirstOrThrow({
        where: { contractId },
      });
      const account = await db.financeSettlementAccount.create({
        data: {
          branchId,
          title: `Synthetic verified receipt ${randomUUID()}`,
          kind: 'CASH',
          currencyCode: component.currencyCode,
          isActive: true,
          createdByUserId: makerId,
        },
      });
      const payment = await db.salesContractPaymentEntry.create({
        data: {
          contractId,
          amount: '1',
          currencyCode: component.currencyCode,
          dueAt: new Date('2026-10-01'),
          method: 'CASH',
          idempotencyKey: randomUUID(),
          requestFingerprint: 'b'.repeat(64),
          createdByUserId: makerId,
        },
      });
      const inbox = new FinanceInboxService(
        {
          financeReceipt: (
            paymentId: string,
            id: string,
            actor: AuthenticatedActor,
          ) => repository.financeReceipt(paymentId, id, actor.branchIds),
          applyFinancePaymentConfirmed: (event: {
            eventId: string;
            contractId: string;
            paymentId: string;
            financePaymentReference: string;
            receiptAccountId: string;
            confirmedAt: string;
            reviewedByUserId: string;
            reason?: string;
          }) =>
            repository.applyFinanceConfirmation({
              ...event,
              financeConfirmationId: event.eventId,
            }),
        } as never,
        {} as never,
        {} as never,
        {} as never,
        { client: db } as never,
        {} as never,
        {} as never,
      );
      const payload = {
        version: 1 as const,
        contractId,
        action: 'APPROVE' as const,
        accountId: account.id,
      };
      if (approve) await inbox.decideReceipt(payment.id, payload, maker);
      return { inbox, payment, account, payload };
    }
    it('waits for Finance inbox approval, captures the contract once across replay and partial receipts, and releases deferred liability without duplicating receivables', async () => {
      const c = await contract();
      await db.salesContract.update({
        where: { id: c.id },
        data: { status: 'DRAFT' },
      });
      const sales = new SalesRepository({ client: db } as never);
      const transition = () =>
        sales.transition(
          c.id,
          1,
          ['DRAFT'],
          'SENT_TO_RESERVATIONS',
          'Synthetic confirmation',
          { userId: makerId, branchId },
          randomUUID(),
          'c'.repeat(64),
        );
      expect(await transition()).toBe(true);
      expect(await transition()).toBe(false);
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(0);
      const approval = await approveContractReceipt(c.id);
      await expect(
        approval.inbox.decideReceipt(
          approval.payment.id,
          approval.payload,
          maker,
        ),
      ).resolves.toEqual({ status: 'RECEIPT_CONFIRMED' });
      await approveContractReceipt(c.id);
      let events = await db.financeAccountingEvent.findMany({
        where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
      });
      expect(events).toHaveLength(1);
      const event = events[0]!;
      expect(event.amount.toString()).toBe('109000');
      expect(event.partyId).toBe(c.payerCustomerId);
      expect(event.trackingNumber).toBe(c.contractNumber);
      expect(event.journalId).toBeNull();
      await command('financial-rule-save', {
        eventId: event.id,
        typeId,
        debitAccountId: debitId,
        creditAccountId: creditId,
      });
      // Rules intentionally apply prospectively: the first source uses the explicit approved mapping.
      const j = await command('financial-event-journal', {
        eventId: event.id,
        typeId,
        debitAccountId: debitId,
        creditAccountId: creditId,
      });
      await expect(
        db.$transaction((tx) => assertRevenueEditable(tx, c.id, [branchId])),
      ).rejects.toThrow();
      await post(String(j.id));
      const w = await command(
        'workflow-create',
        evidence('REVENUE', c.id, {
          currency: 'IRR',
          sourceVersion: (
            await db.salesContract.findUniqueOrThrow({ where: { id: c.id } })
          ).version,
          mode: 'PRINCIPAL',
          fulfilled: true,
        }),
      );
      const revenue = await command('workflow-journal', {
        id: w.id,
        typeId,
        receivableAccountId: debitId,
        incomeAccountId: profitLossId,
        taxAccountId: profitLossId,
      });
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: String(revenue.id) },
        orderBy: { position: 'asc' },
      });
      expect(lines[0]!.accountId).toBe(creditId);
      expect(lines[0]!.debit.toString()).toBe('109000');
      expect(lines.some((l) => l.accountId === debitId)).toBe(false);
      await post(String(revenue.id));
      const period = await db.accountingPeriod.findFirstOrThrow({
        where: { bookId },
      });
      const posted = await db.accountingJournal.findUniqueOrThrow({
        where: { id: String(j.id) },
      });
      await expect(
        command(
          'reverse',
          {
            id: j.id,
            periodId: period.id,
            documentDate: '2026-10-25',
            reason: 'Synthetic reversal evidence',
          },
          posted.version,
        ),
      ).rejects.toThrow();
      // The next contract of the same payer/currency uses the approved chart mapping automatically.
      const next = await contract();
      await db.salesContract.update({
        where: { id: next.id },
        data: { payerCustomerId: c.payerCustomerId },
      });
      await approveContractReceipt(next.id);
      const dispatcher = new FinancialEventDispatcher(
        {
          client: {
            financeAccountingEvent: {
              findMany: (args: { where: object }) =>
                db.financeAccountingEvent.findMany({
                  ...args,
                  where: { ...args.where, requestId: next.id },
                }),
              updateMany: db.financeAccountingEvent.updateMany.bind(
                db.financeAccountingEvent,
              ),
            },
            accountingConfiguration: db.accountingConfiguration,
          },
        } as never,
        service,
        { reminderPrincipal: async () => maker } as never,
      );
      await dispatcher.tick();
      await dispatcher.tick();
      events = await db.financeAccountingEvent.findMany({
        where: { requestId: next.id, kind: SALES_CONTRACT_EVENT },
        include: { journal: true },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.journalId).toBeTruthy();
      expect(
        await db.accountingJournal.count({
          where: { sourceKey: events[0]!.sourceKey },
        }),
      ).toBe(1);
    });
    it('does not capture pending, rejected, scheduled or incompletely marked receipts, and handles approval before Sales confirmation', async () => {
      const c = await contract();
      const pending = await approveContractReceipt(c.id, false);
      for (const status of [
        'PENDING_FINANCE_CONFIRMATION',
        'SCHEDULED',
        'FINANCE_REJECTED',
      ] as const) {
        await db.salesContractPaymentEntry.update({
          where: { id: pending.payment.id },
          data: { status },
        });
        await db.$transaction((tx) =>
          captureSalesContractAccounting(tx, c.id, makerId, true),
        );
        expect(
          await db.financeAccountingEvent.count({
            where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
          }),
        ).toBe(0);
      }
      await expect(
        db.salesContractPaymentEntry.update({
          where: { id: pending.payment.id },
          data: { status: 'FINANCE_CONFIRMED' },
        }),
      ).rejects.toThrow();
      await db.salesContractPaymentEntry.update({
        where: { id: pending.payment.id },
        data: {
          status: 'FINANCE_CONFIRMED',
          financeReceiptAccountId: pending.account.id,
        },
      });
      await db.$transaction((tx) =>
        captureSalesContractAccounting(tx, c.id, makerId, true),
      );
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(0);
      await db.salesContractPaymentEntry.update({
        where: { id: pending.payment.id },
        data: {
          status: 'PENDING_FINANCE_CONFIRMATION',
          financeReceiptAccountId: null,
        },
      });
      await db.salesContract.update({
        where: { id: c.id },
        data: { status: 'DRAFT' },
      });
      await pending.inbox.decideReceipt(
        pending.payment.id,
        pending.payload,
        maker,
      );
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(0);
      const version = (
        await db.salesContract.findUniqueOrThrow({ where: { id: c.id } })
      ).version;
      const sales = new SalesRepository({ client: db } as never);
      expect(
        await sales.transition(
          c.id,
          version,
          ['DRAFT'],
          'SENT_TO_RESERVATIONS',
          'Synthetic confirmation after Finance approval',
          { userId: makerId, branchId },
          randomUUID(),
          'c'.repeat(64),
        ),
      ).toBe(true);
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(1);
      // Retire this synthetic source so later period-close assertions remain independent.
      await db.salesContract.update({
        where: { id: c.id },
        data: { status: 'CANCELLED' },
      });
    });
    it('rolls Finance approval and its receipt event back together if contract accounting capture fails', async () => {
      const c = await contract();
      await db.salesContractPriceComponent.create({
        data: {
          contractId: c.id,
          type: 'DISCOUNT',
          title: 'Synthetic invalid source',
          amount: '200000',
          currencyCode: 'IRR',
        },
      });
      const approval = await approveContractReceipt(c.id, false);
      await expect(
        approval.inbox.decideReceipt(
          approval.payment.id,
          approval.payload,
          maker,
        ),
      ).rejects.toThrow('مبلغ خالص قرارداد');
      const payment = await db.salesContractPaymentEntry.findUniqueOrThrow({
        where: { id: approval.payment.id },
      });
      expect(payment.status).toBe('PENDING_FINANCE_CONFIRMATION');
      expect(payment.financeConfirmedByRef).toBeNull();
      expect(
        (await db.salesContract.findUniqueOrThrow({ where: { id: c.id } }))
          .version,
      ).toBe(c.version);
      expect(
        await db.financeAccountingEvent.count({ where: { requestId: c.id } }),
      ).toBe(0);
    });
    it('keeps currencies separate, supersedes changed unlinked sources and rejects cancelled/foreign-branch sources', async () => {
      const c = await contract();
      await db.$transaction((tx) =>
        captureSalesContractAccounting(tx, c.id, makerId),
      );
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(0);
      await db.salesContractPriceComponent.create({
        data: {
          contractId: c.id,
          type: 'BASE',
          title: 'Synthetic USD',
          amount: '12.3456',
          currencyCode: 'USD',
        },
      });
      await approveContractReceipt(c.id);
      await db.$transaction((tx) =>
        captureSalesContractAccounting(tx, c.id, makerId, true),
      );
      const first = await db.financeAccountingEvent.findMany({
        where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
      });
      expect(first.map((e) => e.currency).sort()).toEqual(['IRR', 'USD']);
      await db.$transaction((tx) =>
        captureSalesContractAccounting(tx, c.id, makerId, true),
      );
      expect(
        await db.financeAccountingEvent.count({
          where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
        }),
      ).toBe(2);
      await db.salesContractPriceComponent.create({
        data: {
          contractId: c.id,
          type: 'DISCOUNT',
          title: 'Synthetic discount',
          amount: '1000',
          currencyCode: 'IRR',
        },
      });
      await db.salesContract.update({
        where: { id: c.id },
        data: { version: { increment: 1 } },
      });
      await db.$transaction((tx) =>
        captureSalesContractAccounting(tx, c.id, makerId, true),
      );
      const old = first.find((e) => e.currency === 'IRR')!;
      await expect(
        command('financial-event-journal', {
          eventId: old.id,
          typeId,
          debitAccountId: debitId,
          creditAccountId: creditId,
        }),
      ).rejects.toThrow();
      const current = await db.financeAccountingEvent.findFirstOrThrow({
        where: {
          requestId: c.id,
          kind: SALES_CONTRACT_EVENT,
          currency: 'IRR',
          id: { not: old.id },
        },
      });
      expect(current.amount.toString()).toBe('108000');
      await db.accountingAccount.update({
        where: { id: creditId },
        data: { attributes: { revaluable: true } },
      });
      await expect(
        command('financial-event-journal', {
          eventId: current.id,
          typeId,
          debitAccountId: debitId,
          creditAccountId: creditId,
        }),
      ).rejects.toThrow();
      await db.accountingAccount.update({
        where: { id: creditId },
        data: { attributes: {} },
      });

      await expect(
        command('financial-event-journal', {
          eventId: current.id,
          typeId,
          debitAccountId: creditId,
          creditAccountId: debitId,
        }),
      ).rejects.toThrow();
      await expect(
        command(
          'financial-event-journal',
          {
            eventId: current.id,
            typeId,
            debitAccountId: debitId,
            creditAccountId: creditId,
          },
          undefined,
          { ...maker, branchIds: [] },
        ),
      ).rejects.toThrow();
      expect(
        await db.$transaction((tx) =>
          hasPendingSalesContractAccounting(
            tx,
            branchId,
            '2026-01-01',
            '2026-12-31',
          ),
        ),
      ).toBe(true);
      await db.salesContract.update({
        where: { id: c.id },
        data: { status: 'CANCELLED' },
      });
      expect(
        await db.$transaction((tx) =>
          hasPendingSalesContractAccounting(
            tx,
            branchId,
            '2026-01-01',
            '2026-12-31',
          ),
        ),
      ).toBe(false);

      await expect(
        command('financial-event-journal', {
          eventId: current.id,
          typeId,
          debitAccountId: debitId,
          creditAccountId: creditId,
        }),
      ).rejects.toThrow();
    });
    it('releases earned agency fees from the original foreign deferred lot, retaining the approved rate and tracking dimensions', async () => {
      const c = await contract();
      await db.salesContractPriceComponent.deleteMany({
        where: { contractId: c.id },
      });
      await db.salesContractPriceComponent.create({
        data: {
          contractId: c.id,
          type: 'BASE',
          title: 'Synthetic EUR',
          amount: '100',
          currencyCode: 'EUR',
        },
      });
      await db.accountingAccount.updateMany({
        where: { id: { in: [debitId, creditId, profitLossId] } },
        data: { attributes: { multiCurrency: true } },
      });
      const fx = await db.accountingFxSnapshot.create({
        data: {
          bookId,
          currency: 'EUR',
          rate: '11',
          source: 'Synthetic',
          validFrom: new Date('2026-01-01'),
          validTo: new Date('2026-12-31'),
          status: 'APPROVED',
          makerId,
          approverId: checkerId,
        },
      });
      await approveContractReceipt(c.id);
      const event = await db.financeAccountingEvent.findFirstOrThrow({
        where: { requestId: c.id, kind: SALES_CONTRACT_EVENT },
      });
      const j = await command('financial-event-journal', {
        eventId: event.id,
        typeId,
        debitAccountId: debitId,
        creditAccountId: creditId,
        fxSnapshotId: fx.id,
      });
      await post(String(j.id));
      const w = await command(
        'workflow-create',
        evidence('REVENUE', c.id, {
          currency: 'EUR',
          sourceVersion: (
            await db.salesContract.findUniqueOrThrow({ where: { id: c.id } })
          ).version,
          mode: 'AGENT',
          amount: '5',
          fulfilled: true,
        }),
      );
      const release = await command('workflow-journal', {
        id: w.id,
        typeId,
        receivableAccountId: debitId,
        incomeAccountId: profitLossId,
      });
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: String(release.id) },
        orderBy: { position: 'asc' },
      });
      expect(lines[0]!.accountId).toBe(creditId);
      expect(lines[0]!.debit.toString()).toBe('55');
      expect(lines[0]!.foreignAmount?.toString()).toBe('5');
      expect(lines[0]!.attributes).toMatchObject({
        trackingNumber: c.contractNumber,
      });
      expect(lines.every((l) => l.fxSnapshotId === fx.id)).toBe(true);
      await post(String(release.id));
    });
    it('recognises only evidenced principal revenue, preserves source and requires independent posting', async () => {
      const c = await contract(),
        p = evidence('REVENUE', c.id, {
          currency: 'IRR',
          sourceVersion: c.version,
          mode: 'PRINCIPAL',
          fulfilled: true,
        });
      await expect(
        command('workflow-create', { ...p, fulfilled: false }),
      ).rejects.toThrow();
      const key = randomUUID(),
        w = await command('workflow-create', p, undefined, maker, key);
      expect(
        (await command('workflow-create', p, undefined, maker, key)).id,
      ).toBe(w.id);
      await expect(command('workflow-create', p)).rejects.toThrow();
      const j = await command('workflow-journal', {
        id: w.id,
        typeId,
        receivableAccountId: debitId,
        incomeAccountId: creditId,
        taxAccountId: creditId,
      });
      const saved = await db.accountingJournal.findUniqueOrThrow({
        where: { id: String(j.id) },
        include: { lines: true },
      });
      expect(saved.lines.map((l) => l.credit.toString())).toEqual([
        '0',
        '100000',
        '9000',
      ]);
      await expect(
        db.$transaction((tx) => assertRevenueEditable(tx, c.id, [branchId])),
      ).rejects.toThrow();
      await expect(
        db.accountingWorkflow.update({
          where: { id: String(w.id) },
          data: { amount: '1' },
        }),
      ).rejects.toThrow();
      await expect(
        db.accountingWorkflow.delete({ where: { id: String(w.id) } }),
      ).rejects.toThrow();
      await post(String(j.id));
      expect(
        (await db.salesContract.findUniqueOrThrow({ where: { id: c.id } }))
          .version,
      ).toBe(c.version);
    });
    it('recognises agent fee only, rejects a fee above the source and cross-branch access', async () => {
      const c = await contract(),
        p = evidence('REVENUE', c.id, {
          currency: 'IRR',
          sourceVersion: c.version,
          mode: 'AGENT',
          amount: '5000',
          fulfilled: true,
        });
      await expect(
        command('workflow-create', { ...p, amount: '100001' }),
      ).rejects.toThrow();
      await expect(
        command('workflow-create', p, undefined, { ...maker, branchIds: [] }),
      ).rejects.toThrow();
      const w = await command('workflow-create', p),
        j = await command('workflow-journal', {
          id: w.id,
          typeId,
          receivableAccountId: debitId,
          incomeAccountId: creditId,
        });
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: String(j.id) },
      });
      expect(lines).toHaveLength(2);
      expect(lines.reduce((n, l) => n + Number(l.credit), 0)).toBe(5000);
      await expect(
        command('workflow-cancel', {
          id: w.id,
          reason: 'Synthetic cancellation evidence',
        }),
      ).rejects.toThrow();
    });
    async function payroll() {
      const employee = await db.hrEmployee.create({
        data: {
          personnelCode: randomUUID(),
          branchId,
          name: 'Synthetic employee',
          kind: 'کارمند',
          unit: 'QA',
          position: 'QA',
          grade: 'QA',
          startedAt: new Date('2026-01-01'),
        },
      });
      const net = await db.hrRecord.create({
        data: {
          code: randomUUID(),
          branchId,
          employeeId: employee.id,
          section: 'payroll',
          tab: 'paymentRequests',
          status: 'تأییدشده',
          values: [employee.id, '2026-10', '80000', '2026-10-25'],
          amounts: {
            create: { field: 'field2', amount: '80000', currency: 'IRR' },
          },
        },
      });
      const rows = [];
      for (const [header, value] of [
        ['حقوق ناخالص', '100000'],
        ['کسورات', '20000'],
        ['خالص پرداختی', '80000'],
        ['ارز', 'IRR'],
      ])
        rows.push(
          await db.hrRecord.create({
            data: {
              code: randomUUID(),
              branchId,
              employeeId: employee.id,
              section: 'payroll',
              tab: 'importedPayslips',
              values: ['Synthetic employee', '1405', '7', header!, value!],
            },
          }),
        );
      return { net, rows };
    }
    it('accrues gross = net + deductions once and covers the later Finance net approval', async () => {
      const { net, rows } = await payroll(),
        p = evidence('PAYROLL', net.id, {
          grossRecordId: rows[0]!.id,
          sourceVersion: net.version,
          periodConfirmed: true,
        });
      const results = await Promise.allSettled([
        command('workflow-create', p),
        command('workflow-create', p),
      ]);
      if (results.every((r) => r.status === 'rejected'))
        throw new Error(
          results
            .map((r) => (r.status === 'rejected' ? String(r.reason) : ''))
            .join(' · '),
        );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const w = await db.accountingWorkflow.findFirstOrThrow({
        where: { hrRecordId: net.id },
      });
      const j = await command('workflow-journal', {
        id: w.id,
        typeId,
        expenseAccountId: debitId,
        payableAccountId: creditId,
        deductionsAccountId: creditId,
      });
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: String(j.id) },
        orderBy: { position: 'asc' },
      });
      expect(
        lines.map((l) => [l.debit.toString(), l.credit.toString()]),
      ).toEqual([
        ['100000', '0'],
        ['0', '80000'],
        ['0', '20000'],
      ]);
      expect(
        await db.$transaction((tx) =>
          grossAccrualCovers(tx, branchId, net.id, '80000', 'IRR'),
        ),
      ).toBe(true);
      await expect(
        db.$transaction((tx) =>
          grossAccrualCovers(tx, branchId, net.id, '80001', 'IRR'),
        ),
      ).rejects.toThrow();
    });
    async function payment(
      currency = 'IRR',
      foreign = '100',
      costRate = '1',
      payRate = '1',
      paid = foreign,
    ) {
      const requestId = randomUUID(),
        occurredAt = new Date('2026-10-20T08:00:00Z');
      const fx = async (rate: string) =>
        db.accountingFxSnapshot.create({
          data: {
            bookId,
            currency,
            rate,
            source: 'Synthetic',
            validFrom: new Date('2026-01-01'),
            validTo: new Date('2026-12-31'),
            status: 'APPROVED',
            makerId,
            approverId: checkerId,
          },
        });
      const rates =
        currency === 'IRR' ? [] : [await fx(costRate), await fx(payRate)];
      const events = [];
      for (const [index, kind] of [
        'SUPPLIER_INVOICE_APPROVED',
        'SUPPLIER_PAYMENT',
      ].entries()) {
        const recordId = randomUUID();
        const eventId = await db.$transaction((tx) =>
          recordFinancialEvent(tx, {
            source: 'INVOICE',
            recordId,
            requestId,
            kind,
            branchId,
            actorId: makerId,
            occurredAt:
              index === 0 ? new Date('2026-10-18T08:00:00Z') : occurredAt,
            trackingDate: '2026-10-18',
            amount: index === 0 ? foreign : paid,
            currency,
          }),
        );
        const event = await db.financeAccountingEvent.findUniqueOrThrow({
          where: { id: eventId },
        });
        const j = await command('financial-event-journal', {
          eventId: event.id,
          typeId,
          debitAccountId: index === 0 ? debitId : creditId,
          creditAccountId: index === 0 ? creditId : debitId,
          ...(rates[index] ? { fxSnapshotId: rates[index]!.id } : {}),
        });
        await post(String(j.id));
        events.push({ ...event, journalId: String(j.id) });
      }
      return events[1]!;
    }
    it('retains payout evidence, records failed purchase and caps concurrent manual refunds', async () => {
      const e = await payment();
      const failed = await command(
        'workflow-create',
        evidence('PURCHASE_OUTCOME', e.id, { state: 'FAILED' }),
      );
      const cancellation = await command('workflow-journal', {
        id: failed.id,
        typeId,
      });
      await post(String(cancellation.id));
      const account = await db.financeSettlementAccount.create({
        data: {
          branchId,
          title: 'Synthetic manual cash',
          kind: 'CASH',
          currencyCode: 'IRR',
          isActive: true,
          createdByUserId: makerId,
        },
      });
      const p = evidence('SUPPLIER_REFUND', e.id, {
        receiptAccountId: account.id,
        amount: '70',
      });
      const results = await Promise.allSettled([
        command('workflow-create', p),
        command('workflow-create', { ...p, reference: randomUUID() }),
      ]);
      if (results.every((r) => r.status === 'rejected'))
        throw new Error(
          results
            .map((r) => (r.status === 'rejected' ? String(r.reason) : ''))
            .join(' · '),
        );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const w = await db.accountingWorkflow.findFirstOrThrow({
        where: { sourceEventId: e.id, kind: 'SUPPLIER_REFUND' },
      });
      const j = await command('workflow-journal', {
        id: w.id,
        typeId,
        cashAccountId: debitId,
      });
      await post(String(j.id));
      expect(
        (
          await db.financeAccountingEvent.findUniqueOrThrow({
            where: { id: e.id },
          })
        ).amount.toString(),
      ).toBe('100');
      await expect(
        command(
          'workflow-create',
          evidence('PURCHASE_OUTCOME', e.id, { state: 'SUCCESS' }),
        ),
      ).rejects.toThrow();
    });
    it('records realised FX without a second bank line and preserves historical failed-purchase lots', async () => {
      await db.accountingAccount.updateMany({
        where: { id: { in: [debitId, creditId] } },
        data: { attributes: { multiCurrency: true } },
      });
      const e = await payment('USD', '100', '10', '12');
      const w = await command(
        'workflow-create',
        evidence('FX_SETTLEMENT', e.id),
      );
      const j = await command('workflow-journal', {
        id: w.id,
        typeId,
        lossAccountId: profitLossId,
      });
      const lines = await db.accountingJournalLine.findMany({
        where: { journalId: String(j.id) },
      });
      expect(lines.every((l) => l.accountId !== debitId)).toBe(true);
      expect(lines.reduce((n, l) => n + Number(l.debit), 0)).toBe(200);
      await post(String(j.id));
      await expect(
        command('workflow-create', evidence('FX_SETTLEMENT', e.id)),
      ).rejects.toThrow();
      const failed = await command(
        'workflow-create',
        evidence('PURCHASE_OUTCOME', e.id, { state: 'FAILED' }),
      );
      const reversed = await command('workflow-journal', {
        id: failed.id,
        typeId,
      });
      await post(String(reversed.id));
      const loss = await command(
        'workflow-create',
        evidence('PURCHASE_WRITE_OFF', e.id, { amount: '100' }),
      );
      const lossJournal = await command('workflow-journal', {
        id: loss.id,
        typeId,
        expenseAccountId: debitId,
      });
      const saved = await db.accountingJournalLine.findMany({
        where: { journalId: String(lossJournal.id) },
      });
      expect(saved.find((l) => l.credit.gt(0))?.credit.toString()).toBe('1000');
    });
    it('uses previous revaluation in settlement and cancels its carrying adjustment on failure', async () => {
      const e = await payment('USD', '100', '10', '12');
      const original = await db.financeAccountingEvent.findFirstOrThrow({
        where: { requestId: e.requestId, kind: 'SUPPLIER_INVOICE_APPROVED' },
      });
      const revaluation = await db.accountingJournal.create({
        data: {
          bookId,
          periodId: (
            await db.accountingPeriod.findFirstOrThrow({ where: { bookId } })
          ).id,
          typeId,
          makerId,
          approverId: checkerId,
          documentDate: '2026-10-19',
          description: 'Synthetic posted historical revaluation fixture',
          status: 'DRAFT',
          sourceKey: `REVALUE:fixture:${randomUUID()}`,
          attributes: {},
          lines: {
            create: [
              {
                position: 0,
                accountId: creditId,
                debit: '0',
                credit: '100',
                attributes: {
                  valuationCurrency: 'USD',
                  trackingNumber: e.requestId,
                },
              },
              {
                position: 1,
                accountId: profitLossId,
                debit: '100',
                credit: '0',
                attributes: {},
              },
            ],
          },
        },
      });
      await db.accountingJournal.update({
        where: { id: revaluation.id },
        data: { status: 'POSTED', postedAt: new Date('2026-10-19') },
      });
      const w = await command(
        'workflow-create',
        evidence('FX_SETTLEMENT', e.id),
      );
      expect((w.facts as Record<string, unknown>).carrying).toBe('1100');
      const j = await command('workflow-journal', {
        id: w.id,
        typeId,
        lossAccountId: profitLossId,
      });
      await post(String(j.id));
      const failed = await command(
        'workflow-create',
        evidence('PURCHASE_OUTCOME', e.id, { state: 'FAILED' }),
      );
      const cancellation = await command('workflow-journal', {
        id: failed.id,
        typeId,
        gainAccountId: profitLossId,
      });
      await post(String(cancellation.id));
      const loss = await command(
        'workflow-create',
        evidence('PURCHASE_WRITE_OFF', e.id, { amount: '100' }),
      );
      const writeOff = await command('workflow-journal', {
        id: loss.id,
        typeId,
        expenseAccountId: debitId,
      });
      await post(String(writeOff.id));
      const journalIds = [
        e.journalId!,
        original.journalId!,
        String(j.id),
        String(cancellation.id),
        String(writeOff.id),
      ];
      const liability = await db.accountingJournalLine.findMany({
        where: {
          accountId: creditId,
          journal: { bookId, status: 'POSTED' },
          OR: [
            { journalId: { in: journalIds } },
            { attributes: { path: ['trackingNumber'], equals: e.requestId } },
          ],
        },
      });
      expect(
        liability.reduce((n, l) => n + Number(l.credit) - Number(l.debit), 0),
      ).toBe(0);
    });
    it('retains the exact partial carrying basis and blocks reversing an earlier settlement used by a later payment', async () => {
      const e = await payment('USD', '100', '10', '12', '40');
      const first = await command(
        'workflow-create',
        evidence('FX_SETTLEMENT', e.id),
      );
      expect((first.facts as Record<string, unknown>).carrying).toBe('400');
      const firstJournal = await command('workflow-journal', {
        id: first.id,
        typeId,
        lossAccountId: profitLossId,
      });
      await post(String(firstJournal.id));
      const rate = await db.accountingFxSnapshot.create({
        data: {
          bookId,
          currency: 'USD',
          rate: '11',
          source: 'Synthetic second payment rate',
          validFrom: new Date('2026-01-01'),
          validTo: new Date('2026-12-31'),
          status: 'APPROVED',
          makerId,
          approverId: checkerId,
        },
      });
      const secondId = await db.$transaction((tx) =>
        recordFinancialEvent(tx, {
          source: 'INVOICE',
          recordId: randomUUID(),
          requestId: e.requestId,
          kind: 'SUPPLIER_PAYMENT',
          branchId,
          actorId: makerId,
          occurredAt: new Date('2026-10-21T08:00:00Z'),
          trackingDate: '2026-10-18',
          amount: '60',
          currency: 'USD',
        }),
      );
      const paymentJournal = await command('financial-event-journal', {
        eventId: secondId,
        typeId,
        debitAccountId: creditId,
        creditAccountId: debitId,
        fxSnapshotId: rate.id,
      });
      await post(String(paymentJournal.id));
      const second = await command(
        'workflow-create',
        evidence('FX_SETTLEMENT', secondId),
      );
      expect(second.facts).toMatchObject({
        carrying: '600',
        actual: '660',
        difference: '60',
        priorSettlementIds: [first.id],
      });
      const original = await db.accountingJournal.findUniqueOrThrow({
        where: { id: String(firstJournal.id) },
      });
      const reversal = await command(
        'reverse',
        {
          id: original.id,
          periodId: original.periodId,
          typeId,
          documentDate: '2026-10-25',
        },
        original.version,
      );
      await expect(post(String(reversal.id))).rejects.toThrow();
    });
    it('does not reserve a financial source in a book that disallows posting', async () => {
      const c = await contract();
      await db.accountingBook.update({
        where: { id: bookId },
        data: { allowsPosting: false },
      });
      try {
        await expect(
          command(
            'workflow-create',
            evidence('REVENUE', c.id, {
              sourceVersion: c.version,
              currency: 'IRR',
              mode: 'PRINCIPAL',
              fulfilled: true,
            }),
          ),
        ).rejects.toThrow();
      } finally {
        await db.accountingBook.update({
          where: { id: bookId },
          data: { allowsPosting: true },
        });
      }
      expect(
        await db.accountingWorkflow.count({ where: { contractId: c.id } }),
      ).toBe(0);
    });
  },
);
