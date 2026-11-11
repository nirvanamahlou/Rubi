import { TicketPublicService } from '../../ticket-catalog/ticket-public.service';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProcurementPublicService } from '../../procurement/procurement-public.service';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
import { readFinanceInvoiceQueueStates } from '../finance-invoice-queue-read';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';

const enabled = process.env.NORA_RUN_FINANCE_POSTGRES_TESTS === '1';
const databaseName = `nora_finance_test_${randomUUID().replaceAll('-', '')}`;
let created = false;
let client: DatabaseClient;
async function sql(database: string, input: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  const PgClient = createRequire(
    resolve(process.cwd(), '../../packages/database/package.json'),
  )('pg').Client as new (options: {
    connectionString: string;
    connectionTimeoutMillis: number;
  }) => {
    connect(): Promise<void>;
    query(text: string): Promise<unknown>;
    end(): Promise<void>;
  };
  const connection = new PgClient({
    connectionString: url.toString(),
    connectionTimeoutMillis: 30000,
  });
  try {
    await connection.connect();
    await connection.query(input);
  } finally {
    await connection.end();
  }
}
describe.skipIf(!enabled)('Finance ticket payment isolated PostgreSQL', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.port !== '5432' ||
      !/^nora_finance_test_[a-f0-9]{32}$/.test(databaseName)
    )
      throw new Error('An isolated local database is required');
    await sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    url.pathname = `/${databaseName}`;
    // Use the real migration engine so accounting activation metadata is present.
    await promisify(execFile)(
      process.execPath,
      [
        resolve(
          process.cwd(),
          '../../packages/database/node_modules/prisma/build/index.js',
        ),
        'migrate',
        'deploy',
        '--schema',
        'prisma/schema.prisma',
      ],
      {
        cwd: resolve(process.cwd(), '../../packages/database'),
        env: { ...process.env, DATABASE_URL: url.toString() },
        timeout: 120000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    client = createDatabaseClient(url.toString());
  }, 120000);
  afterAll(async () => {
    await client?.$disconnect();
    if (created && /^nora_finance_test_[a-f0-9]{32}$/.test(databaseName))
      await sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 60000);
  it('reads only the latest revision of each selected procurement invoice', async () => {
    const suffix = randomUUID();
    const actor = await client.user.create({
      data: {
        username: `invoice-${suffix}`,
        displayName: 'Isolated invoice projection',
        passwordHash: 'synthetic-not-a-login-hash',
      },
    });
    const branch = await client.branch.create({
      data: { code: suffix, name: 'Isolated invoice branch' },
    });
    const primary = randomUUID();
    const secondary = randomUUID();
    const missing = randomUUID();
    const unrelated = randomUUID();
    const fields = {
      branchId: branch.id,
      actorUserId: actor.id,
      sourceVersion: 1,
    };
    await client.financeProcurementInvoiceRevision.createMany({
      data: [
        {
          ...fields,
          sourceId: primary,
          version: 1,
          status: 'APPROVED',
          remainingAmount: '9007199254740993.1250',
        },
        {
          ...fields,
          sourceId: primary,
          version: 2,
          status: 'PARTIALLY_PAID',
          cumulativePaid: '0.0001',
          remainingAmount: '9007199254740993.1249',
        },
        {
          ...fields,
          sourceId: secondary,
          version: 1,
          status: 'CORRECTION_REQUIRED',
          remainingAmount: '30',
          sourceVersion: 2,
        },
        {
          ...fields,
          sourceId: unrelated,
          version: 1,
          status: 'APPROVED',
          remainingAmount: '10',
        },
      ],
    });
    const states = await readFinanceInvoiceQueueStates(client, [
      primary,
      missing,
      secondary,
      primary,
    ]);
    expect(new Set(states.keys())).toEqual(new Set([primary, secondary]));
    expect(states.get(primary)).toMatchObject({
      sourceVersion: 1,
      version: 2,
      status: 'PARTIALLY_PAID',
    });
    expect(states.get(primary)?.cumulativePaid.toString()).toBe('0.0001');
    expect(states.get(primary)?.remainingAmount.toString()).toBe(
      '9007199254740993.1249',
    );
    expect(states.get(secondary)).toMatchObject({
      sourceVersion: 2,
      version: 1,
    });
    expect(await readFinanceInvoiceQueueStates(client, [])).toEqual(new Map());
  });

  async function fixture(currencyCode = 'IRR') {
    const suffix = randomUUID();
    const user = await client.user.create({
      data: {
        username: `finance-${suffix}`,
        displayName: 'Finance isolated fixture',
        passwordHash: 'synthetic-not-a-login-hash',
      },
    });
    const branch = await client.branch.create({
      data: { code: suffix, name: 'Isolated Finance branch' },
    });
    const request = await client.procurementTicketPurchaseRequest.create({
      data: {
        branchId: branch.id,
        catalogProductReference: suffix,
        title: 'Isolated ticket purchase',
        supplierDisplaySnapshot: 'Isolated airline',
        seatCount: 2,
        createdByUserId: user.id,
        createKey: suffix,
        fingerprint: '0'.repeat(64),
      },
    });
    const account = await client.financeSettlementAccount.create({
      data: {
        branchId: branch.id,
        title: 'Isolated cash',
        kind: 'CASH',
        currencyCode: 'IRR',
        createdByUserId: user.id,
      },
    });
    const method = await client.masterPaymentMethod.create({
      data: {
        code: suffix.slice(0, 32).toUpperCase(),
        name: 'Isolated payment',
        channel: 'CASH',
        direction: 'PAYMENT',
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });
    const actor = {
      userId: user.id,
      branchIds: [branch.id],
      permissions: ['finance.payment.create', 'procurement.quote.manage'],
    } as unknown as AuthenticatedActor;
    const service = new FinanceTicketCostService(
      { client } as never,
      new ProcurementPublicService({ client } as never),
      new MasterProcurementDirectory({ client } as never),
    );
    const price = {
      version: 1 as const,
      operationId: randomUUID(),
      expectedCostVersion: 0,
      seatCount: 2,
      unitCost: '50',
      currencyCode,
    };
    const [cost, replay] = await Promise.all([
      service.recordCost(request.id, price, actor),
      service.recordCost(request.id, price, actor),
    ]);
    expect(cost).toEqual(replay);
    expect(
      await client.financeTicketPurchaseCostRevision.count({
        where: { requestId: request.id },
      }),
    ).toBe(1);
    const command = {
      version: 1 as const,
      operationId: randomUUID(),
      expectedPaymentVersion: 0,
      costRevisionId: cost!.id,
      accountId: account.id,
      paymentMethodId: method.id,
      paidAmount: '40',
      exchangeRateToIrr: '1',
      transferAt: '2026-10-04T10:00:00.000Z',
    };
    return { service, request, command, actor };
  }
  it('projects only the latest cost and its payment history for each requested purchase', async () => {
    const f = await fixture();
    const unpaid = await fixture('EUR');
    await f.service.recordPayment(f.request.id, f.command, f.actor);
    await f.service.recordPayment(
      f.request.id,
      {
        ...f.command,
        operationId: randomUUID(),
        expectedPaymentVersion: 1,
        paidAmount: '15.125',
      },
      f.actor,
    );

    const missing = randomUUID();
    const ids = [f.request.id, unpaid.request.id, missing, f.request.id];
    const states = await f.service.queueStates(ids);
    expect(states.size).toBe(2);
    expect(states.has(missing)).toBe(false);
    expect(states.get(f.request.id)).toMatchObject({
      costVersion: 1,
      costRevisionId: f.command.costRevisionId,
      paymentCount: 2,
      paidAmount: '55.125',
      remainingAmount: '44.875',
      status: 'PAYING',
    });
    expect(states.get(unpaid.request.id)).toMatchObject({
      currencyCode: 'EUR',
      paymentCount: 0,
      paidAmount: '0',
      remainingAmount: '100',
      status: 'READY_FOR_PAYMENT',
    });

    const groupId = randomUUID();
    const newer = await client.financeTicketPurchaseCostRevision.create({
      data: {
        requestId: f.request.id,
        branchId: f.request.branchId,
        actorUserId: f.actor.userId,
        version: 2,
        adultUnitCost: '48.0625',
        childUnitCost: '48.0625',
        seatCount: 2,
        unitCost: '48.0625',
        invoiceAmount: '96.125',
        currencyCode: 'IRR',
        reason: ['purchase-group', groupId, '1'.repeat(64), 2, '96.125'].join(
          ':',
        ),
      },
    });

    const newerStates = await f.service.queueStates(ids);
    expect(newerStates.get(f.request.id)).toMatchObject({
      costVersion: 2,
      costRevisionId: newer.id,
      createdAt: newer.createdAt.toISOString(),
      purchaseGroup: { id: groupId, seatCount: 2, totalCost: '96.125' },
      unitCost: '48.0625',
      paymentCount: 0,
      paidAmount: '0',
      remainingAmount: '96.125',
      status: 'READY_FOR_PAYMENT',
    });
    expect(await f.service.queueStates([])).toEqual(new Map());
  });
  it('serializes concurrent retries into one persistent payment revision', async () => {
    const f = await fixture();
    const results = await Promise.all([
      f.service.recordPayment(f.request.id, f.command, f.actor),
      f.service.recordPayment(f.request.id, f.command, f.actor),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      await client.financeTicketPurchasePaymentRevision.count({
        where: { costRevisionId: f.command.costRevisionId },
      }),
    ).toBe(1);
    expect(results[0]!.remainingAmount).toBe('60');
  });
  it('persists a foreign supplier payment without an account and retains replay identity', async () => {
    const f = await fixture('EUR');
    const supplier = await client.masterSupplier.create({
      data: {
        code: randomUUID().slice(0, 32),
        name: 'Synthetic paying supplier',
        createdByUserId: f.actor.userId,
        updatedByUserId: f.actor.userId,
      },
    });
    const command = {
      ...f.command,
      accountId: null,
      payingSupplierId: supplier.id,
      exchangeRateToIrr: '600000',
    };
    const payment = await f.service.recordPayment(
      f.request.id,
      command,
      f.actor,
    );
    expect(payment.remainingAmount).toBe('60');
    expect(
      await f.service.recordPayment(f.request.id, command, f.actor),
    ).toEqual(payment);
    const saved =
      await client.financeTicketPurchasePaymentRevision.findUniqueOrThrow({
        where: { id: command.operationId },
      });
    expect(saved.accountId).toBeNull();
    expect(saved.payingSupplierId).toBe(supplier.id);
    expect(saved.payingSupplierName).toBe('Synthetic paying supplier');
    expect(saved.rialEquivalent.toString()).toBe('24000000');
    await expect(
      f.service.recordPayment(
        f.request.id,
        { ...command, payingSupplierId: randomUUID() },
        f.actor,
      ),
    ).rejects.toThrow();
    await expect(
      client.masterSupplier.delete({ where: { id: supplier.id } }),
    ).rejects.toThrow();
  });
  it('persists foreign debt units and actual IRR cash under real account, event and replay constraints', async () => {
    const f = await fixture('EUR');
    const command = { ...f.command, exchangeRateToIrr: '800000' };
    const result = await f.service.recordPayment(
      f.request.id,
      command,
      f.actor,
    );
    expect(result.remainingAmount).toBe('60');
    expect(
      await f.service.recordPayment(f.request.id, command, f.actor),
    ).toEqual(result);
    const saved =
      await client.financeTicketPurchasePaymentRevision.findUniqueOrThrow({
        where: { id: command.operationId },
        include: { cost: true, account: true },
      });
    expect(saved.cost.currencyCode).toBe('EUR');
    expect(saved.account?.currencyCode).toBe('IRR');
    expect(saved.paidAmount.toString()).toBe('40');
    expect(saved.rialEquivalent.toString()).toBe('32000000');
    const event = await client.financeAccountingEvent.findFirstOrThrow({
      where: {
        source: 'TICKET',
        recordId: command.operationId,
        kind: 'TICKET_PAYMENT',
      },
    });
    expect(event.amount.toString()).toBe('32000000');
    expect(event.currency).toBe('IRR');
    expect(event.settlementAccountId).toBe(command.accountId);
    expect(
      await client.financeAccountingEvent.count({
        where: {
          source: 'TICKET',
          recordId: command.operationId,
          kind: 'TICKET_PAYMENT',
        },
      }),
    ).toBe(1);
    const otherCurrency = await client.financeSettlementAccount.create({
      data: {
        branchId: f.actor.branchIds[0]!,
        createdByUserId: f.actor.userId,
        title: 'Synthetic incompatible currency account',
        kind: 'CASH',
        currencyCode: 'USD',
      },
    });
    await expect(
      f.service.recordPayment(
        f.request.id,
        {
          ...command,
          operationId: randomUUID(),
          expectedPaymentVersion: 1,
          accountId: otherCurrency.id,
        },
        f.actor,
      ),
    ).rejects.toThrow();
    expect(
      await client.financeTicketPurchasePaymentRevision.count({
        where: { costRevisionId: command.costRevisionId },
      }),
    ).toBe(1);
  });
  it('rejects a stale concurrent installment and replays a completed settlement', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      f.service.recordPayment(f.request.id, f.command, f.actor),
      f.service.recordPayment(
        f.request.id,
        { ...f.command, operationId: randomUUID() },
        f.actor,
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const final = {
      ...f.command,
      operationId: randomUUID(),
      expectedPaymentVersion: 1,
      paidAmount: '60',
    };
    const paid = await f.service.recordPayment(f.request.id, final, f.actor);
    expect(paid.remainingAmount).toBe('0');
    expect(await f.service.recordPayment(f.request.id, final, f.actor)).toEqual(
      paid,
    );
    expect(
      await client.procurementTicketPurchaseRequest.findUnique({
        where: { id: f.request.id },
      }),
    ).toMatchObject({ status: 'PAID' });
    expect(
      await client.financeTicketPurchasePaymentRevision.count({
        where: { costRevisionId: f.command.costRevisionId },
      }),
    ).toBe(2);
  });
  it('atomically prices recurring capacity under real row locks, replays concurrently, and feeds exact contract cost', async () => {
    const f = await fixture();
    const procurement = new ProcurementPublicService({ client } as never);
    const catalog = new TicketPublicService({ client } as never, procurement);
    const service = new FinanceTicketCostService(
      { client } as never,
      procurement,
      undefined,
      catalog,
    );
    const route = { originId: randomUUID(), destinationId: randomUUID() };
    const requests = [];
    for (let i = 0; i < 2; i++) {
      const key = randomUUID(),
        seatCount = i === 0 ? 2 : 1;
      const offer = await client.ticketPublishedOffer.create({
        data: {
          ...route,
          branchId: f.actor.branchIds[0]!,
          createdByUserId: f.actor.userId,
          createKey: key,
          fingerprint: '0'.repeat(64),
          departureAt: new Date(
            i ? '2026-10-12T10:00:00Z' : '2026-10-05T10:00:00Z',
          ),
          arrivalAt: new Date(
            i ? '2026-10-12T12:00:00Z' : '2026-10-05T12:00:00Z',
          ),
          carrierName: 'SYNTHETIC AIRLINE',
          serviceNumber: '9740',
          cabinClassCode: 'ECONOMY',
          totalCapacity: seatCount,
          supplyType: 'COMPANY',
        },
      });
      requests.push(
        await client.procurementTicketPurchaseRequest.create({
          data: {
            branchId: f.actor.branchIds[0]!,
            createdByUserId: f.actor.userId,
            catalogProductReference: key,
            title: 'Synthetic recurring departure',
            supplierDisplaySnapshot: 'SYNTHETIC AIRLINE',
            offerId: offer.id,
            offerVersion: offer.version,
            seatCount,
            createKey: key,
            fingerprint: '0'.repeat(64),
          },
        }),
      );
    }
    const input = {
      version: 1 as const,
      operationId: randomUUID(),
      members: requests.map((r) => ({
        requestId: r.id,
        expectedCostVersion: 0,
      })),
      seatCount: 3,
      totalCost: '100',
      currencyCode: 'IRR',
    };
    const [a, b] = await Promise.all([
      service.recordGroupCost(input, f.actor),
      service.recordGroupCost(input, f.actor),
    ]);
    expect(a).toEqual(b);
    const saved = await client.financeTicketPurchaseCostRevision.findMany({
      where: { requestId: { in: requests.map((r) => r.id) } },
      orderBy: { requestId: 'asc' },
    });
    expect(saved).toHaveLength(2);
    expect(
      saved.reduce((sum, r) => sum + Number(r.invoiceAmount.toString()), 0),
    ).toBe(100);
    const recorded = await service.recordedCostsForOffers(
      requests.map((r) => r.offerId!),
      f.actor.branchIds[0]!,
    );
    expect(
      recorded.every(
        (r) => r.poolCost?.seatCount === 3 && r.poolCost.totalCost === '100',
      ),
    ).toBe(true);
    const incomplete = {
      ...input,
      operationId: randomUUID(),
      members: input.members.map((m, i) => ({
        ...m,
        expectedCostVersion: i === 0 ? 1 : 0,
      })),
    };
    await expect(
      service.recordGroupCost(incomplete, f.actor),
    ).rejects.toThrow();
    expect(
      await client.financeTicketPurchaseCostRevision.count({
        where: { requestId: { in: requests.map((r) => r.id) } },
      }),
    ).toBe(2);
    const failures = new FinanceTicketCostService(
      { client } as never,
      procurement,
      undefined,
      catalog,
      {
        capture: async () => {
          throw Error('synthetic FX rollback');
        },
      } as never,
    );
    const next = {
      ...input,
      operationId: randomUUID(),
      members: input.members.map((m) => ({ ...m, expectedCostVersion: 1 })),
      totalCost: '200',
    };
    await expect(failures.recordGroupCost(next, f.actor)).rejects.toThrow(
      'synthetic FX rollback',
    );
    expect(
      await client.financeTicketPurchaseCostRevision.count({
        where: { requestId: { in: requests.map((r) => r.id) } },
      }),
    ).toBe(2);
  }, 30000);
});
