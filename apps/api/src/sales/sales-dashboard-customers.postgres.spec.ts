import { randomUUID } from 'node:crypto';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { SalesDashboardCustomers } from './sales-dashboard-customers.public';

describe.skipIf(process.env.NORA_RUN_REPORTING_POSTGRES_TESTS !== '1')(
  'Sales customer purchase cohorts on migrated PostgreSQL',
  () => {
    let db: DatabaseClient;
    const contractIds: string[] = [];
    const customerIds: string[] = [];
    const accountIds: string[] = [];
    const userIds: string[] = [];
    const branchIds: string[] = [];
    // A Persian-month boundary expressed as UTC; all comparisons are [from, to).
    const from = new Date('2026-10-22T20:30:00.000Z');
    const to = new Date('2026-11-21T20:30:00.000Z');
    const earlier = new Date('2026-10-15T09:00:00.000Z');
    const current = new Date('2026-11-01T09:00:00.000Z');

    beforeAll(() => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw new Error(
          'Only a disposable loopback nora_ci database is allowed',
        );
      db = createDatabaseClient(url.toString());
    });

    afterAll(async () => {
      if (!db) return;
      try {
        // Delete only this run's synthetic records; payments cascade with contracts.
        await db.salesContract.deleteMany({
          where: { id: { in: contractIds } },
        });
        await db.customer.deleteMany({ where: { id: { in: customerIds } } });
        await db.financeSettlementAccount.deleteMany({
          where: { id: { in: accountIds } },
        });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
        await db.branch.deleteMany({ where: { id: { in: branchIds } } });
      } finally {
        await db.$disconnect();
      }
    });

    async function fixture() {
      async function user() {
        const row = await db.user.create({
          data: {
            username: randomUUID(),
            displayName: 'Synthetic cohort evaluator',
            passwordHash: 'synthetic-not-a-login-hash',
          },
        });
        userIds.push(row.id);
        return row.id;
      }
      async function branch() {
        const row = await db.branch.create({
          data: { code: randomUUID(), name: 'Synthetic cohort branch' },
        });
        branchIds.push(row.id);
        return row.id;
      }
      const owner = await user();
      const otherOwner = await user();
      const homeBranch = await branch();
      const otherBranch = await branch();
      const receiptAccounts = new Map<string, string>();
      for (const branchId of [homeBranch, otherBranch]) {
        const account = await db.financeSettlementAccount.create({
          data: {
            branchId,
            title: 'Synthetic receipt account',
            kind: 'CASH',
            currencyCode: 'IRR',
            createdByUserId: owner,
          },
        });
        accountIds.push(account.id);
        receiptAccounts.set(branchId, account.id);
      }
      const query: DashboardSourceQuery = {
        actor: {
          userId: owner,
          branchIds: [homeBranch],
          permissions: [
            'customers.read',
            'sales.payments.read',
            'sales.contracts.read.own',
          ],
        },
        from,
        to,
        filters: {},
        dateBasis: 'effective',
      };
      const source = new SalesDashboardCustomers({ client: db } as never);
      async function customer() {
        const row = await db.customer.create({
          data: {
            kind: 'PERSON',
            firstName: 'Synthetic',
            lastName: 'Customer',
            displayName: 'Synthetic cohort customer',
            ownerBranchId: homeBranch,
            createdByUserId: owner,
            updatedByUserId: owner,
          },
        });
        customerIds.push(row.id);
        return row.id;
      }
      async function purchase(
        customerId: string,
        confirmedAt: Date,
        options: {
          ownerUserId?: string;
          branchId?: string;
          paidAt?: Date | null;
          status?: 'CONFIRMED' | 'CANCELLED';
        } = {},
      ) {
        const paidAt =
          options.paidAt === undefined ? confirmedAt : options.paidAt;
        const row = await db.salesContract.create({
          data: {
            contractNumber: randomUUID(),
            branchId: options.branchId ?? homeBranch,
            ownerUserId: options.ownerUserId ?? owner,
            customerId,
            payerCustomerId: customerId,
            customerNameSnapshot: 'Synthetic cohort customer',
            tripType: 'ONE_WAY',
            // These Sales-owned snapshot references have no cross-module FK.
            originId: randomUUID(),
            destinationId: randomUUID(),
            departureDate: new Date('2026-12-01'),
            status: options.status ?? 'CONFIRMED',
            confirmedAt,
            createIdempotencyKey: randomUUID(),
            createRequestFingerprint: '0'.repeat(64),
            ...(paidAt
              ? {
                  payments: {
                    create: {
                      amount: '1',
                      currencyCode: 'IRR',
                      dueAt: paidAt,
                      method: 'CASH',
                      status: 'FINANCE_CONFIRMED',
                      financeReceiptAccountId: receiptAccounts.get(
                        options.branchId ?? homeBranch,
                      )!,
                      financeConfirmedAt: paidAt,
                      createdByUserId: options.ownerUserId ?? owner,
                      idempotencyKey: randomUUID(),
                      requestFingerprint: '0'.repeat(64),
                    },
                  },
                }
              : {}),
          },
        });
        contractIds.push(row.id);
        return row.id;
      }
      return {
        source,
        query,
        customer,
        purchase,
        owner,
        otherOwner,
        homeBranch,
        otherBranch,
        receiptAccountId: receiptAccounts.get(homeBranch)!,
      };
    }

    it('classifies an earlier paid purchase under another owner without exposing foreign purchases', async () => {
      const f = await fixture();
      const buyer = await f.customer();
      await f.purchase(buyer, earlier, { ownerUserId: f.otherOwner });
      await f.purchase(buyer, current);
      await f.purchase(await f.customer(), current, {
        ownerUserId: f.otherOwner,
      });
      const result = await f.source.read(f.query);
      expect(result.state).toBe('ready');
      expect(result.metrics['new-customers']?.observations).toEqual([]);
      expect(result.metrics['returning-customers']?.observations).toEqual([
        { at: current, value: '1' },
      ]);
      expect(JSON.stringify(result)).not.toContain(buyer);
      expect(JSON.stringify(result)).not.toContain(f.otherOwner);
    });

    it('checks earlier company history outside the selected branch while current candidates stay scoped', async () => {
      const f = await fixture();
      const buyer = await f.customer();
      await f.purchase(buyer, earlier, {
        branchId: f.otherBranch,
        ownerUserId: f.otherOwner,
      });
      await f.purchase(buyer, current);
      await f.purchase(await f.customer(), current, {
        branchId: f.otherBranch,
      });
      const result = await f.source.read({
        ...f.query,
        actor: {
          ...f.query.actor,
          permissions: [
            'customers.read',
            'sales.payments.read',
            'sales.contracts.read.all',
          ],
        },
        branchId: f.homeBranch,
      });
      expect(result.metrics['new-customers']?.observations).toEqual([]);
      expect(result.metrics['returning-customers']?.observations).toEqual([
        { at: current, value: '1' },
      ]);
    });

    it('does not treat an older unpaid contract as a successful earlier purchase', async () => {
      const f = await fixture();
      const buyer = await f.customer();
      await f.purchase(buyer, earlier, { paidAt: null });
      await f.purchase(buyer, current);
      const result = await f.source.read(f.query);
      expect(result.metrics['new-customers']?.observations).toEqual([
        { at: current, value: '1' },
      ]);
      expect(result.metrics['returning-customers']?.observations).toEqual([]);
    });

    it('uses the later of Finance receipt and contract confirmation for delayed success', async () => {
      const f = await fixture();
      await f.purchase(await f.customer(), earlier, { paidAt: current });
      await f.purchase(await f.customer(), current, { paidAt: earlier });
      const result = await f.source.read(f.query);
      expect(result.metrics['new-customers']?.observations).toEqual([
        { at: current, value: '1' },
        { at: current, value: '1' },
      ]);
      expect(result.metrics['returning-customers']?.observations).toEqual([]);
    });

    it('counts each buyer only once despite multiple contracts and receipts in the window', async () => {
      const f = await fixture();
      const buyer = await f.customer();
      const contractId = await f.purchase(buyer, current);
      await f.purchase(buyer, new Date('2026-11-02T09:00:00Z'));
      await db.salesContractPaymentEntry.create({
        data: {
          contractId,
          amount: '2',
          currencyCode: 'IRR',
          dueAt: current,
          method: 'CASH',
          status: 'FINANCE_CONFIRMED',
          financeReceiptAccountId: f.receiptAccountId,
          financeConfirmedAt: new Date('2026-11-03T09:00:00Z'),
          createdByUserId: f.owner,
          idempotencyKey: randomUUID(),
          requestFingerprint: '0'.repeat(64),
        },
      });
      const result = await f.source.read(f.query);
      expect(result.metrics['new-customers']?.observations).toEqual([
        { at: current, value: '1' },
      ]);
      expect(result.metrics['returning-customers']?.observations).toEqual([]);
    });

    it('retains a cancelled historical paid purchase as customer conversion evidence', async () => {
      const f = await fixture();
      const buyer = await f.customer();
      await f.purchase(buyer, earlier, {
        status: 'CANCELLED',
        ownerUserId: f.otherOwner,
        branchId: f.otherBranch,
      });
      await f.purchase(buyer, current);
      const result = await f.source.read(f.query);
      expect(result.metrics['new-customers']?.observations).toEqual([]);
      expect(result.metrics['returning-customers']?.observations).toEqual([
        { at: current, value: '1' },
      ]);
    });

    it('uses inclusive from and exclusive to at Tehran midnight without losing earlier history', async () => {
      const f = await fixture();
      const justBeforeTo = new Date(to.getTime() - 1);
      await f.purchase(await f.customer(), from);
      await f.purchase(await f.customer(), justBeforeTo);
      await f.purchase(await f.customer(), to);
      const repeatBuyer = await f.customer();
      await f.purchase(repeatBuyer, new Date(from.getTime() - 1), {
        ownerUserId: f.otherOwner,
      });
      await f.purchase(repeatBuyer, from);
      const result = await f.source.read(f.query);
      expect(
        result.metrics['new-customers']?.observations
          .map((row) => row.at.toISOString())
          .sort(),
      ).toEqual([from.toISOString(), justBeforeTo.toISOString()].sort());
      expect(result.metrics['returning-customers']?.observations).toEqual([
        { at: from, value: '1' },
      ]);
    });
  },
);
