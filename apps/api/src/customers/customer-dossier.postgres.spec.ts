import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, it, expect } from 'vitest';
import {
  dossierSalesScope,
  readSalesCustomerDossier,
} from '../sales/customer-dossier.public';
describe.skipIf(process.env.NORA_RUN_REPORTING_POSTGRES_TESTS !== '1')(
  'customer dossier PostgreSQL isolation',
  () => {
    it('keeps other customers, branches, owners, archived contracts and fellow passenger payments out of real results', async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        url.pathname !== '/nora_ci'
      )
        throw new Error('Only disposable loopback nora_ci is allowed');
      const db = createDatabaseClient(url.toString());
      const rollback = new Error('ROLLBACK_SYNTHETIC_DOSSIER');
      try {
        await expect(
          db.$transaction(
            async (tx) => {
              const customerId = randomUUID(),
                otherCustomer = randomUUID(),
                branchId = randomUUID(),
                owner = randomUUID();
              const actor: AuthenticatedActor = {
                userId: owner,
                sessionId: 'synthetic',
                branchIds: [branchId],
                permissions: [
                  'customers.read',
                  'sales.contracts.read.own',
                  'sales.payments.read',
                  'finance.read',
                ],
              };
              async function contract(
                options: {
                  customer?: string;
                  branch?: string;
                  owner?: string;
                  hidden?: boolean;
                  passenger?: boolean;
                } = {},
              ) {
                return tx.salesContract.create({
                  data: {
                    contractNumber: randomUUID(),
                    branchId: options.branch ?? branchId,
                    ownerUserId: options.owner ?? owner,
                    customerId: options.customer ?? customerId,
                    payerCustomerId: options.customer ?? customerId,
                    customerNameSnapshot: 'Synthetic dossier',
                    tripType: 'ONE_WAY',
                    originId: randomUUID(),
                    destinationId: randomUUID(),
                    departureDate: new Date('2026-12-01'),
                    createIdempotencyKey: randomUUID(),
                    createRequestFingerprint: '0'.repeat(64),
                    hiddenAt: options.hidden ? new Date() : null,
                    ...(options.passenger
                      ? {
                          passengers: {
                            create: {
                              customerId,
                              displayNameSnapshot: 'Synthetic passenger',
                              ageCategory: 'ADT',
                            },
                          },
                        }
                      : {}),
                    payments: {
                      create: {
                        amount: '123.4567',
                        currencyCode: 'IRR',
                        dueAt: new Date(),
                        method: 'CHECK',
                        createdByUserId: owner,
                        idempotencyKey: randomUUID(),
                        requestFingerprint: '0'.repeat(64),
                      },
                    },
                  },
                });
              }
              const own = await contract();
              const passenger = await contract({
                customer: otherCustomer,
                passenger: true,
              });
              const excluded = await Promise.all([
                contract({ customer: randomUUID() }),
                contract({ branch: randomUUID() }),
                contract({ owner: randomUUID() }),
                contract({ hidden: true }),
              ]);
              const scope = dossierSalesScope(actor, customerId, {
                hiddenAt: null,
              });
              const result = await readSalesCustomerDossier(
                tx as never,
                actor,
                customerId,
                scope,
              );
              expect(
                result
                  .find((s) => s.id === 'contracts')
                  ?.rows.map((r) => r.id)
                  .sort(),
              ).toEqual([own.id, passenger.id].sort());
              for (const row of excluded)
                expect(JSON.stringify(result)).not.toContain(
                  row.contractNumber,
                );
              for (const id of ['payments', 'checks']) {
                const rows = result.find((s) => s.id === id)!.rows;
                expect(rows).toHaveLength(1);
                expect(rows[0]?.reference).toBe(own.contractNumber);
                expect(rows[0]?.amount).toBe('123.4567');
              }
              throw rollback;
            },
            { timeout: 30000 },
          ),
        ).rejects.toBe(rollback);
      } finally {
        await db.$disconnect();
      }
    }, 45000);
  },
);
