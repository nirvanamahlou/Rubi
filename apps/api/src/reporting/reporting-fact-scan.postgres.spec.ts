import { randomUUID } from 'node:crypto';

import { createDatabaseClient } from '@nora/database';
import { describe, expect, it } from 'vitest';

import { ReportingRepository } from './reporting.repository';

describe.skipIf(process.env.NORA_RUN_REPORTING_POSTGRES_TESTS !== '1')(
  'travel fact batches on PostgreSQL',
  () => {
    it('preserves timestamp ties and branch scope across a batch boundary', async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        throw new Error('An isolated local database is required');
      const client = createDatabaseClient(url.toString());
      const repository = new ReportingRepository({ client } as never);
      const fixture = randomUUID();
      const branchId = randomUUID();
      const otherBranch = randomUUID();
      const occurredAt = new Date('2026-10-01T10:00:00.123Z');
      const fields = {
        sourceVersion: 1,
        occurredAt,
        legalEntityCode: fixture,
        legalEntityName: fixture,
        branchId,
        branchName: 'Scope test',
        ownerName: 'Scope test',
        siteCode: 'test',
        salesChannel: 'TEST',
        serviceType: 'FLIGHT',
        customerType: 'PERSON',
        customerName: 'Synthetic',
        orderStatus: 'CONFIRMED',
        reservationStatus: 'CONFIRMED',
        issueStatus: 'ISSUED',
        paymentStatus: 'PAID',
        currencyCode: 'EUR',
        salesAmount: '123.0000000001',
        purchaseAmount: '23',
        dataAsOf: occurredAt,
      };
      const rows = Array.from({ length: 1002 }, (_, index) => ({
        ...fields,
        id: randomUUID(),
        sourceItemId: `${fixture}-${index}`,
        orderNumber: `TEST-${index}`,
        occurredAt:
          index === 1001 ? new Date(occurredAt.getTime() - 1) : occurredAt,
      }));
      try {
        await client.branch.createMany({
          data: [
            { id: branchId, code: branchId, name: 'Scope test' },
            { id: otherBranch, code: otherBranch, name: 'Excluded branch' },
          ],
        });
        await client.reportingTravelFact.createMany({
          data: [
            ...rows,
            {
              ...rows[0]!,
              id: randomUUID(),
              branchId: otherBranch,
              sourceItemId: fixture + '-excluded',
            },
          ],
        });
        const seen: string[] = [];
        await repository.scanFacts(
          {
            legalEntityId: fixture,
            filters: { currencyCode: 'EUR' },
            page: 1,
            pageSize: 25,
            timezone: 'Asia/Tehran',
          },
          [branchId],
          (row) => {
            expect(row.salesAmount.toString()).toBe('123.0000000001');
            seen.push(row.id);
          },
        );
        expect(seen).toEqual([
          ...rows
            .slice(0, 1001)
            .map(({ id }) => id)
            .sort(),
          rows[1001]!.id,
        ]);
      } finally {
        try {
          await client.reportingTravelFact.deleteMany({
            where: { legalEntityCode: fixture },
          });
          await client.branch.deleteMany({
            where: { id: { in: [branchId, otherBranch] } },
          });
        } finally {
          await client.$disconnect();
        }
      }
    }, 30_000);
  },
);
