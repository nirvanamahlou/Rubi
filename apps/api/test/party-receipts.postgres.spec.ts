import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { FinancePartyReceipts } from '../src/finance/operations/party-receipts';
import {
  partyContractBalance,
  persistPartyReceipt,
} from '../src/sales/party-receipts.public';

const enabled =
  process.env.CI === 'true' &&
  process.env.NORA_RUN_FINANCIAL_EVENT_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)('party receipts atomic PostgreSQL FIFO', () => {
  let db: DatabaseClient;
  const branchId = randomUUID(),
    userId = randomUUID();
  const actor = {
    userId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: ['finance.read', 'finance.receipt.approve'],
  } as AuthenticatedActor;
  let service: FinancePartyReceipts;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '5432' ||
      url.pathname !== '/nora_ci' ||
      url.username !== 'nora_ci'
    )
      throw new Error('Ephemeral CI database only');
    db = createDatabaseClient(url.toString());
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic FIFO branch' },
    });
    await db.user.create({
      data: {
        id: userId,
        username: userId,
        displayName: 'Synthetic finance user',
        passwordHash: 'not-a-login-credential',
      },
    });
    service = new FinancePartyReceipts({ client: db } as never);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  async function fixture() {
    const payerId = randomUUID(),
      contracts = [];
    for (let i = 0; i < 8; i++)
      contracts.push(
        await db.salesContract.create({
          data: {
            contractNumber: randomUUID(),
            branchId,
            ownerUserId: userId,
            customerId: payerId,
            payerCustomerId: payerId,
            customerNameSnapshot: 'Synthetic FIFO agency',
            tripType: 'ONE_WAY',
            originId: randomUUID(),
            destinationId: randomUUID(),
            departureDate: new Date('2026-11-01'),
            status: 'SENT_TO_RESERVATIONS',
            createdAt: new Date(Date.UTC(2026, 0, i + 1)),
            createIdempotencyKey: randomUUID(),
            createRequestFingerprint: 'a'.repeat(64),
            priceComponents: {
              create: [
                {
                  type: 'BASE',
                  title: 'USD service',
                  amount: '100',
                  currencyCode: 'USD',
                },
                {
                  type: 'BASE',
                  title: 'IRR service',
                  amount: '1000',
                  currencyCode: 'IRR',
                },
              ],
            },
          },
        }),
      );
    const account = await db.financeSettlementAccount.create({
      data: {
        branchId,
        title: randomUUID(),
        kind: 'BANK',
        currencyCode: 'USD',
        createdByUserId: userId,
      },
    });
    const balance = await service.balance(branchId, payerId, actor);
    const command = {
      operationId: randomUUID(),
      branchId,
      payerId,
      revision: balance.revision,
      amount: '650',
      currencyCode: 'USD',
      accountId: account.id,
      reference: 'synthetic-bank-reference',
    };
    return { payerId, contracts, command };
  }
  it('settles six contracts and part of seventh, keeps IRR debt, and retries without another bank receipt', async () => {
    const f = await fixture();
    const first = await service.receive(f.command, actor);
    expect(first.allocations.map((a) => a.amount)).toEqual([
      '100',
      '100',
      '100',
      '100',
      '100',
      '100',
      '50',
    ]);
    expect(await service.receive(f.command, actor)).toEqual(first);
    const after = await service.balance(branchId, f.payerId, actor);
    expect(
      after.totals.find((b) => b.currencyCode === 'USD')!.outstanding,
    ).toBe('150');
    expect(
      after.totals.find((b) => b.currencyCode === 'IRR')!.outstanding,
    ).toBe('8000');
    expect(
      await db.salesContractPaymentEntry.count({
        where: { idempotencyKey: `party-receipt:${f.command.operationId}` },
      }),
    ).toBe(7);
    expect(
      await db.financeAccountingEvent.count({
        where: {
          recordId: { in: first.allocations.map((a) => a.paymentId) },
          kind: 'CUSTOMER_RECEIPT',
        },
      }),
    ).toBe(7);
    await expect(
      service.receive({ ...f.command, operationId: randomUUID() }, actor),
    ).rejects.toThrow('تغییر');
    await expect(
      service.balance(branchId, f.payerId, { ...actor, branchIds: [] }),
    ).rejects.toThrow('مجوز');
  });
  it('returns one committed batch to two concurrent retries of the same operation', async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([
      service.receive(f.command, actor),
      service.receive(f.command, actor),
    ]);
    expect(a).toEqual(b);
    expect(
      await db.salesContractPaymentEntry.count({
        where: { idempotencyKey: `party-receipt:${f.command.operationId}` },
      }),
    ).toBe(7);
  });
  it('serializes concurrent operations so only one stale-preview command can allocate', async () => {
    const f = await fixture();
    const outcomes = await Promise.allSettled([
      service.receive(f.command, actor),
      service.receive({ ...f.command, operationId: randomUUID() }, actor),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await service.balance(branchId, f.payerId, actor);
    expect(
      after.totals.find((b) => b.currencyCode === 'USD')!.confirmedPaid,
    ).toBe('650');
  });
  it('rolls back every payment and audit if financial capture fails mid-batch', async () => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        const balance = await partyContractBalance(tx, branchId, f.payerId);
        let calls = 0;
        await persistPartyReceipt(
          tx,
          f.command,
          'b'.repeat(64),
          userId,
          balance,
          'Synthetic bank',
          async () => {
            if (++calls === 3) throw new Error('capture failed');
          },
        );
      }),
    ).rejects.toThrow('capture failed');
    expect(
      await db.salesContractPaymentEntry.count({
        where: { contractId: { in: f.contracts.map((c) => c.id) } },
      }),
    ).toBe(0);
    expect(
      await db.salesContractAuditEvent.count({
        where: { contractId: { in: f.contracts.map((c) => c.id) } },
      }),
    ).toBe(0);
  });
});
