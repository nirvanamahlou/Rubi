import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
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
      methodId: string;
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
      const payments = await Promise.all([
        tickets.recordPayment(p.requestId, p.command, actor),
        tickets.recordPayment(p.requestId, p.command, actor),
      ]);
      expect(payments[0]).toEqual(payments[1]);
      expect(await balance(row.id)).toBe('60');
      expect(await balance(row.id, 'EUR')).toBe('200');
      const movement = await db.financeExchangeMovement.findUniqueOrThrow({
        where: { ticketPaymentId: payments[0]!.id },
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
          { ...p.command, exchangeOfficeId: (await office()).id },
          actor,
        ),
      ).rejects.toThrow();
    });
    it('rejects insufficient funds and races without leaving a payment or negative balance', async () => {
      const row = await office('60');
      const excessive = await purchase(row.id, '80');
      await expect(
        tickets.recordPayment(excessive.requestId, excessive.command, actor),
      ).rejects.toThrow('کافی');
      expect(
        await db.financeTicketPurchasePaymentRevision.count({
          where: { costRevisionId: excessive.command.costRevisionId },
        }),
      ).toBe(0);
      expect(await balance(row.id)).toBe('60');
      const a = await purchase(row.id),
        b = await purchase(row.id);
      const results = await Promise.allSettled([
        tickets.recordPayment(a.requestId, a.command, actor),
        tickets.recordPayment(b.requestId, b.command, actor),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await balance(row.id)).toBe('20');
    });
    it('rolls back the debit if a later financial event fails', async () => {
      const row = await office();
      const p = await purchase(row.id);
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
        service.recordPayment(p.requestId, p.command, actor),
      ).rejects.toThrow();
      expect(await balance(row.id)).toBe('100');
      expect(
        await db.financeTicketPurchasePaymentRevision.count({
          where: { costRevisionId: p.command.costRevisionId },
        }),
      ).toBe(0);
      expect(
        await db.financeExchangeMovement.count({
          where: { balance: { officeId: row.id }, kind: 'PAYMENT' },
        }),
      ).toBe(0);
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
