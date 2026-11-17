import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { FinanceFiscalStorage } from '../src/finance/fiscal-context/finance-fiscal-storage';
import { fundBroker } from '../src/finance/payments/broker-transfer';
import type {
  AuthenticatedActor,
  FinanceFiscalRequestV1,
} from '@nora/contracts';
import { ExchangeOfficeService } from '../src/finance/exchange-offices/exchange-office.service';
import { MasterProcurementDirectory } from '../src/master-data/master-procurement-directory';
import { FinanceTicketCostService } from '../src/finance/ticket-cost/finance-ticket-cost.service';
import { ProcurementPublicService } from '../src/procurement/procurement-public.service';
const enabled = process.env.NORA_RUN_BANK_ACCOUNT_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)(
  'exchange office funds with native payment transactions',
  () => {
    let db: DatabaseClient,
      offices: ExchangeOfficeService,
      tickets: FinanceTicketCostService,
      actor: AuthenticatedActor,
      methodId: string,
      brokerId: string,
      receiptTypeId: string,
      scope: FinanceFiscalRequestV1;
    const scoped = <T>(work: () => Promise<T>) =>
      new FinanceFiscalStorage().run(scope, work);
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/nora_ci' ||
        !['5432', '55593'].includes(url.port)
      )
        throw new Error('Disposable test database required');
      db = createDatabaseClient(url.toString());
      const branch = await db.branch.create({
        data: { code: randomUUID(), name: 'Synthetic exchange branch' },
      });
      const user = await db.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Synthetic exchange actor',
          passwordHash: 'not-a-login-hash',
        },
      });
      actor = {
        userId: user.id,
        sessionId: randomUUID(),
        branchIds: [branch.id],
        permissions: [
          'finance.read',
          'master_data.read',
          'finance.account.manage',
          'finance.payment.create',
          'procurement.quote.manage',
        ],
      };
      for (const code of ['USD', 'EUR', 'IRR'])
        await db.masterCurrency.upsert({
          where: { code },
          create: {
            code,
            name: code,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          update: { isActive: true },
        });
      const holder = { client: db } as never,
        directory = new MasterProcurementDirectory(holder);
      offices = new ExchangeOfficeService(holder, directory);
      tickets = new FinanceTicketCostService(
        holder,
        new ProcurementPublicService(holder),
        directory,
      );
      const method = await db.masterPaymentMethod.create({
        data: {
          code: randomUUID().replaceAll('-', '').toUpperCase(),
          name: 'Synthetic exchange transfer',
          channel: 'CASH',
          direction: 'PAYMENT',
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      methodId = method.id;
      const book = await db.accountingBook.create({
        data: {
          branchId: branch.id,
          code: 'EX',
          title: 'Exchange test book',
          baseCurrency: 'IRR',
        },
      });
      const year = await db.accountingConfiguration.create({
        data: {
          bookId: book.id,
          kind: 'fiscal-years',
          code: '2026',
          title: '2026',
          attributes: {},
        },
      });
      const period = await db.accountingPeriod.create({
        data: {
          bookId: book.id,
          fiscalYearId: year.id,
          isDefault: true,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      });
      const selection = {
        ...period,
        yearActive: true,
        code: year.code,
        title: year.title,
      };
      scope = {
        actorId: user.id,
        issuerCompanyId: null,
        company: null,
        companySelection: branch.id,
        isAggregate: false,
        bookId: book.id,
        bookVersion: book.version,
        defaultPeriodId: period.id,
        periods: [selection],
        period: selection,
        mode: 'default',
      };
      brokerId = (
        await db.masterBroker.create({
          data: {
            code: randomUUID().slice(0, 16),
            name: 'Test broker',
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
        })
      ).id;
      receiptTypeId = (
        await db.documentType.create({
          data: {
            code: randomUUID(),
            domain: 'FINANCE',
            name: 'Test broker receipt',
            allowedMimeTypes: ['application/pdf'],
          },
        })
      ).id;
    }, 30000);
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function office(usd = '100', eur = '200') {
      return offices.save(
        null,
        {
          requestId: randomUUID(),
          title: 'Synthetic exchange',
          balances: [
            { currencyCode: 'USD', amount: usd },
            { currencyCode: 'EUR', amount: eur },
          ],
        },
        actor,
      );
    }
    async function purchase(
      officeId: string,
      amount = '40',
      currencyCode = 'USD',
    ) {
      const suffix = randomUUID();
      const request = await db.procurementTicketPurchaseRequest.create({
        data: {
          branchId: actor.branchIds[0]!,
          catalogProductReference: suffix,
          title: 'Synthetic exchange purchase',
          supplierDisplaySnapshot: 'Synthetic airline',
          seatCount: 2,
          createdByUserId: actor.userId,
          createKey: suffix,
          fingerprint: '0'.repeat(64),
        },
      });
      const cost = await tickets.recordCost(
        request.id,
        {
          version: 1,
          operationId: randomUUID(),
          expectedCostVersion: 0,
          seatCount: 2,
          unitCost: '50',
          currencyCode,
        },
        actor,
      );
      return {
        requestId: request.id,
        command: {
          version: 1 as const,
          operationId: randomUUID(),
          expectedPaymentVersion: 0,
          costRevisionId: cost.id,
          exchangeOfficeId: officeId,
          paymentMethodId: methodId,
          paidAmount: amount,
          exchangeRateToIrr: '1',
          transferAt: '2026-11-08T10:00:00.000Z',
        },
      };
    }
    type TicketPurchase = Awaited<ReturnType<typeof purchase>>;
    function dispatch(p: TicketPurchase, id = randomUUID()) {
      return scoped(() =>
        db.$transaction((tx) =>
          fundBroker(tx, actor, {
            id,
            brokerId,
            kind: 'TICKET',
            sourceId: p.command.costRevisionId,
            officeId: p.command.exchangeOfficeId,
            amount: p.command.paidAmount,
            rate: p.command.exchangeRateToIrr,
            sentAt: p.command.transferAt,
          }),
        ),
      );
    }
    async function receipt(transferId: string) {
      const doc = await db.document.create({
        data: {
          title: 'Test broker receipt',
          documentTypeId: receiptTypeId,
          branchId: actor.branchIds[0]!,
          ownerUserId: actor.userId,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
          sourceModule: 'FINANCE',
          sourceEntityType: 'FinanceBrokerTransfer',
          sourceEntityId: transferId,
        },
      });
      const version = await db.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          storageObjectKey: randomUUID(),
          originalFileName: 'receipt.pdf',
          safeDownloadName: 'receipt.pdf',
          detectedMimeType: 'application/pdf',
          extension: 'pdf',
          versionNote: 'Test receipt',
          sizeBytes: 100n,
          sha256: randomUUID().replaceAll('-', '').repeat(2),
          scanStatus: 'CLEAN',
          createdByUserId: actor.userId,
        },
      });
      await db.document.update({
        where: { id: doc.id },
        data: { currentVersionId: version.id, currentVersionNumber: 1 },
      });
      return doc.id;
    }
    async function balance(id: string, currencyCode = 'USD') {
      return (
        await db.financeExchangeBalance.findUniqueOrThrow({
          where: { officeId_currencyCode: { officeId: id, currencyCode } },
        })
      ).amount.toString();
    }
    it('requires only title, validates provided fields, masks deleted entries and checks manage permission', async () => {
      const input = { requestId: randomUUID(), title: 'Title only' };
      const row = await offices.save(null, input, actor);
      expect(await offices.save(null, input, actor)).toEqual(row);
      expect(
        await db.financeExchangeOffice.findUniqueOrThrow({
          where: { id: row.id },
        }),
      ).toMatchObject({
        countryId: null,
        address: null,
        phone: null,
        isActive: true,
      });
      await expect(
        offices.save(
          null,
          { ...input, requestId: randomUUID(), title: '' },
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        offices.save(
          null,
          { ...input, requestId: randomUUID() },
          { ...actor, permissions: ['finance.read'] },
        ),
      ).rejects.toThrow();
      await expect(
        offices.save(
          null,
          {
            ...input,
            requestId: randomUUID(),
            balances: [{ currencyCode: 'USD', amount: '-1' }],
          },
          actor,
        ),
      ).rejects.toThrow();
      await offices.remove(row.id, row.version, actor);
      expect(
        (await offices.list({ search: 'Title only' }, actor)).items.some(
          (x) => x.id === row.id,
        ),
      ).toBe(false);
    });
    it('debits exactly once on concurrent replay and preserves the other currency, with real payment linkage', async () => {
      const row = await office();
      const p = await purchase(row.id);
      await expect(
        scoped(() => tickets.recordPayment(p.requestId, p.command, actor)),
      ).rejects.toThrow('رسید کارگزار');
      const transferId = randomUUID();
      await Promise.all([dispatch(p, transferId), dispatch(p, transferId)]);
      expect(await balance(row.id)).toBe('60');
      expect(
        await db.financeTicketPurchasePaymentRevision.count({
          where: { costRevisionId: p.command.costRevisionId },
        }),
      ).toBe(0);
      const command = {
        ...p.command,
        brokerTransferId: transferId,
        brokerReceiptId: await receipt(transferId),
      };
      const payments = await Promise.all([
        scoped(() => tickets.recordPayment(p.requestId, command, actor)),
        scoped(() => tickets.recordPayment(p.requestId, command, actor)),
      ]);
      expect(
        await db.financeTicketPurchasePaymentRevision.findUniqueOrThrow({
          where: { id: payments[0]!.id },
        }),
      ).toMatchObject({ brokerTransferId: transferId });
      expect(payments[0]).toEqual(payments[1]);
      expect(await balance(row.id)).toBe('60');
      expect(await balance(row.id, 'EUR')).toBe('200');
      const movement = await db.financeExchangeMovement.findUniqueOrThrow({
        where: { brokerTransferId: transferId },
        include: { balance: true },
      });
      expect(movement.delta.toString()).toBe('-40');
      expect(movement.balance.officeId).toBe(row.id);
      await expect(
        offices.save(
          row.id,
          {
            title: 'Stale',
            expectedVersion: 1,
            balances: [{ currencyCode: 'USD', amount: '999' }],
          },
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        tickets.recordPayment(
          p.requestId,
          { ...command, exchangeOfficeId: (await office()).id },
          actor,
        ),
      ).rejects.toThrow();
    });
    it('rejects insufficient funds and races without leaving a payment or negative balance', async () => {
      const row = await office('60');
      const excessive = await purchase(row.id, '80');
      await expect(dispatch(excessive)).rejects.toThrow('کافی');
      expect(
        await db.financeTicketPurchasePaymentRevision.count({
          where: { costRevisionId: excessive.command.costRevisionId },
        }),
      ).toBe(0);
      expect(await balance(row.id)).toBe('60');
      const a = await purchase(row.id),
        b = await purchase(row.id);
      const results = await Promise.allSettled([dispatch(a), dispatch(b)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await balance(row.id)).toBe('20');
    });
    it('keeps a funded transfer open and rolls back receipt confirmation if the accounting event fails', async () => {
      const row = await office();
      const p = await purchase(row.id);
      const advance = await dispatch(p);
      const command = {
        ...p.command,
        brokerTransferId: advance.id,
        brokerReceiptId: await receipt(advance.id),
      };
      const broken = db.$extends({
        query: {
          financeAccountingEvent: {
            async createMany() {
              throw new Error('Synthetic event failure');
            },
          },
        },
      });
      const holder = { client: broken } as never;
      const service = new FinanceTicketCostService(
        holder,
        new ProcurementPublicService(holder),
        new MasterProcurementDirectory(holder),
      );
      await expect(
        scoped(() => service.recordPayment(p.requestId, command, actor)),
      ).rejects.toThrow('Synthetic event failure');
      expect(await balance(row.id)).toBe('60');
      expect(
        (
          await db.financeBrokerTransfer.findUniqueOrThrow({
            where: { id: advance.id },
          })
        ).receiptId,
      ).toBeNull();
      expect(
        await db.financeTicketPurchasePaymentRevision.count({
          where: { costRevisionId: p.command.costRevisionId },
        }),
      ).toBe(0);
      expect(
        await db.financeExchangeMovement.count({
          where: { brokerTransferId: advance.id },
        }),
      ).toBe(1);
    });
    it('keeps exact currency totals, filters offices and records audited manual corrections', async () => {
      const title = randomUUID();
      const created = await offices.save(
        null,
        {
          requestId: randomUUID(),
          title,
          balances: [{ currencyCode: 'USD', amount: '123.4567' }],
        },
        actor,
      );
      await offices.save(
        created.id,
        {
          title,
          expectedVersion: 1,
          balances: [{ currencyCode: 'USD', amount: '124.4567' }],
        },
        actor,
      );
      const list = await offices.list(
        { search: title, currencyCode: 'USD' },
        actor,
      );
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.balances[0]!.amount).toBe('124.4567');
      const adjustment = await db.financeExchangeMovement.findFirstOrThrow({
        where: { balance: { officeId: created.id } },
        orderBy: { createdAt: 'desc' },
      });
      expect(adjustment.delta.toString()).toBe('1');
      await expect(
        db.financeExchangeMovement.delete({ where: { id: adjustment.id } }),
      ).rejects.toThrow();
    });
  },
);
