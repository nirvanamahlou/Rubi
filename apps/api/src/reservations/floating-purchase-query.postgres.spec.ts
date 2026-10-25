import { describe, it, expect } from 'vitest';
import { createDatabaseClient, Prisma } from '@nora/database';
import { purchaseSelectionSql } from './reservation-purchase-selection';
import { parsePurchaseQuery } from './reservation-purchase-query';
const uuid = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
describe.skipIf(process.env.NORA_RUN_FLOATING_PURCHASE_POSTGRES_TESTS !== '1')(
  'floating purchase SQL on PostgreSQL18',
  () => {
    it('scopes owner, branches and actual floating inventory before filtering/count/pagination', async () => {
      const db = createDatabaseClient();
      try {
        await db.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(
              'CREATE TEMP TABLE "ReservationIntake" (id uuid,"branchId" uuid,"salesOwnerUserId" uuid,"receivedAt" timestamptz,snapshot jsonb) ON COMMIT DROP',
            );
            await tx.$executeRawUnsafe(
              'CREATE TEMP TABLE "ReservationServicePurchase" ("intakeId" uuid,"serviceClientKey" text,"coveredServiceClientKeys" jsonb,version int,"createdAt" timestamptz) ON COMMIT DROP',
            );
            await tx.$executeRawUnsafe(
              'CREATE TEMP TABLE "ReservationHotelPurchase" ("intakeId" uuid,"createdAt" timestamptz) ON COMMIT DROP',
            );
            const hotel = (n: number) => ({
              kind: 'HOTEL',
              clientKey: `h${n}`,
            });
            const contractOnly = {
              kind: 'FLIGHT',
              clientKey: 'f',
              metadata: { contractFlightVersion: 1 },
            };
            const rows = [
              {
                n: 1,
                owner: uuid(10),
                branch: uuid(20),
                snapshot: { serviceSelections: [hotel(1), contractOnly] },
              },
              {
                n: 2,
                owner: uuid(11),
                branch: uuid(20),
                snapshot: {
                  serviceSelections: [
                    hotel(2),
                    { kind: 'FLIGHT', clientKey: 'f', referenceId: 'floating' },
                  ],
                  ticketSelections: [
                    {
                      serviceClientKey: 'f',
                      offerId: 'floating',
                      source: 'CATALOG',
                    },
                  ],
                },
              },
              {
                n: 3,
                owner: uuid(10),
                branch: uuid(21),
                snapshot: { serviceSelections: [hotel(3), contractOnly] },
              },
              {
                n: 4,
                owner: uuid(10),
                branch: uuid(20),
                snapshot: {
                  serviceSelections: [
                    hotel(4),
                    { kind: 'FLIGHT', clientKey: 'f', referenceId: 'company' },
                  ],
                  ticketSelections: [
                    {
                      serviceClientKey: 'f',
                      offerId: 'company',
                      source: 'CATALOG',
                    },
                  ],
                },
              },
              {
                n: 5,
                owner: uuid(10),
                branch: uuid(20),
                snapshot: {
                  serviceSelections: [
                    hotel(5),
                    {
                      kind: 'FLIGHT',
                      clientKey: 'f',
                      referenceId: 'company',
                      metadata: {
                        purchaseSupplyType: 'FLOATING',
                        contractFlightVersion: 1,
                      },
                    },
                  ],
                  ticketSelections: [
                    {
                      serviceClientKey: 'f',
                      offerId: 'company',
                      source: 'CATALOG',
                    },
                  ],
                },
              },
              {
                n: 6,
                owner: uuid(10),
                branch: uuid(20),
                snapshot: {
                  serviceSelections: [hotel(6)],
                  selectedTicketOfferIds: ['floating'],
                },
              },
              {
                n: 7,
                owner: null,
                branch: uuid(20),
                snapshot: { serviceSelections: [hotel(7), contractOnly] },
              },
            ];
            for (const r of rows)
              await tx.$executeRaw(
                Prisma.sql`INSERT INTO "ReservationIntake" VALUES (${uuid(r.n)}::uuid,${r.branch}::uuid,${r.owner}::uuid,${new Date('2026-10-25T00:00:00Z')},${JSON.stringify({ ...r.snapshot, contractNumber: `SYNTHETIC-${r.n}` })}::jsonb)`,
              );
            await tx.$executeRaw(
              Prisma.sql`INSERT INTO "ReservationServicePurchase" VALUES (${uuid(2)}::uuid,'h2',NULL,1,${new Date('2026-10-25T00:00:00Z')})`,
            );
            const q = parsePurchaseQuery({ kind: 'HOTEL' });
            const own = await tx.$queryRaw<{ clientKey: string }[]>(
              purchaseSelectionSql(
                [uuid(20)],
                q,
                undefined,
                false,
                ['floating'],
                { ownerUserId: uuid(10) },
              ),
            );
            expect(own.map((r) => r.clientKey).sort()).toEqual(['h1', 'h6']);
            const all = await tx.$queryRaw<{ clientKey: string }[]>(
              purchaseSelectionSql(
                [uuid(20)],
                q,
                undefined,
                false,
                ['floating'],
                {},
              ),
            );
            expect(all.map((r) => r.clientKey).sort()).toEqual([
              'h1',
              'h2',
              'h6',
              'h7',
            ]);
            const summary = await tx.$queryRaw<
              { total: number; registered: number }[]
            >(
              purchaseSelectionSql(
                [uuid(20)],
                q,
                undefined,
                true,
                ['floating'],
                {},
              ),
            );
            expect(summary[0]).toMatchObject({ total: 4, registered: 1 });
            const registered = await tx.$queryRaw<{ clientKey: string }[]>(
              purchaseSelectionSql(
                [uuid(20)],
                parsePurchaseQuery({ kind: 'HOTEL', status: 'REGISTERED' }),
                undefined,
                false,
                ['floating'],
                {},
              ),
            );
            expect(registered.map((r) => r.clientKey)).toEqual(['h2']);
          },
          { timeout: 30000 },
        );
      } finally {
        await db.$disconnect();
      }
    }, 40000);
  },
);
