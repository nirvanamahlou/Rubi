import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProcurementPublicService } from '../../procurement/procurement-public.service';
import { FinanceTicketCostService } from './finance-ticket-cost.service';

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
    const root = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    const migrations = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) =>
        readFileSync(resolve(root, entry.name, 'migration.sql'), 'utf8'),
      )
      .join('\n');
    await sql(databaseName, migrations);
    url.pathname = `/${databaseName}`;
    client = createDatabaseClient(url.toString());
  }, 120000);
  afterAll(async () => {
    await client?.$disconnect();
    if (created && /^nora_finance_test_[a-f0-9]{32}$/.test(databaseName))
      await sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 60000);
  async function fixture() {
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
    );
    const price = {
      version: 1 as const,
      operationId: randomUUID(),
      expectedCostVersion: 0,
      seatCount: 2,
      unitCost: '50',
      currencyCode: 'IRR',
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
});
