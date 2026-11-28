import { randomUUID } from 'node:crypto';

import { createDatabaseClient } from '@nora/database';
import { describe, expect, it } from 'vitest';

import { ReportingRepository } from './reporting.repository';
import { readVoucherCoverage } from '../reservations/voucher-coverage.public';
import { readSettledHotelContracts } from '../sales/settled-hotel-contracts.public';
import { pendingVoucherPage } from './settled-vouchers.controller';

describe.skipIf(process.env.NORA_RUN_REPORTING_POSTGRES_TESTS !== '1')(
  'travel fact batches on PostgreSQL',
  () => {
    it('reconciles two sold hotel stays against the latest persisted reservation voucher in a rolled-back transaction', async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        throw new Error('An isolated local database is required');
      const db = createDatabaseClient(url.toString());
      const rollback = new Error('ROLLBACK_SYNTHETIC_VOUCHER_FIXTURE');
      try {
        await expect(
          db.$transaction(
            async (tx) => {
              const branchId = randomUUID();
              const actor = await tx.user.create({
                data: {
                  username: randomUUID(),
                  displayName: 'Voucher fixture',
                  passwordHash: 'disabled',
                  status: 'INACTIVE',
                },
              });
              const audit = {
                createdByUserId: actor.id,
                updatedByUserId: actor.id,
              };
              const country = await tx.masterCountry.upsert({
                where: { code: 'ZZ' },
                update: {},
                create: { code: 'ZZ', name: 'Voucher fixture', ...audit },
              });
              const city = await tx.masterCity.create({
                data: {
                  countryId: country.id,
                  code: randomUUID().slice(0, 20),
                  name: 'Fixture',
                  ...audit,
                },
              });
              const hotel = await tx.masterHotel.create({
                data: {
                  cityId: city.id,
                  code: randomUUID().slice(0, 20),
                  name: 'Second fixture hotel',
                  ...audit,
                },
              });
              const customerId = randomUUID();
              const contract = await tx.salesContract.create({
                data: {
                  contractNumber: randomUUID(),
                  branchId,
                  ownerUserId: actor.id,
                  customerId,
                  payerCustomerId: customerId,
                  customerNameSnapshot: 'Fixture',
                  originId: randomUUID(),
                  destinationId: city.id,
                  tripType: 'ONE_WAY',
                  departureDate: new Date('2026-11-21'),
                  status: 'CONFIRMED',
                  settlementStatus: 'SETTLED',
                  createIdempotencyKey: randomUUID(),
                  createRequestFingerprint: '0'.repeat(64),
                  services: {
                    create: {
                      clientKey: 'hotel',
                      kind: 'HOTEL',
                      titleSnapshot: 'Hotel',
                    },
                  },
                },
                include: { services: true },
              });
              const dates = {
                checkInDate: new Date('2026-11-21'),
                checkOutDate: new Date('2026-11-24'),
              };
              const firstHotel = randomUUID();
              await tx.salesContractHotelSelection.create({
                data: {
                  contractId: contract.id,
                  serviceId: contract.services[0]!.id,
                  hotelId: firstHotel,
                  hotelNameSnapshot: 'First fixture hotel',
                  cityId: city.id,
                  ...dates,
                  roomCount: 1,
                  roomTypeId: randomUUID(),
                  occupancy: 1,
                  inventoryStatus: 'AVAILABLE',
                  additionalStays: {
                    create: {
                      ordinal: 2,
                      hotelId: hotel.id,
                      cityId: city.id,
                      hotelNameSnapshot: hotel.name,
                      ...dates,
                    },
                  },
                },
              });
              const intake = {
                contractId: contract.id,
                branchId,
                snapshot: {},
                fingerprint: '0'.repeat(64),
              };
              const old = await tx.reservationIntake.create({
                data: {
                  ...intake,
                  requestId: randomUUID(),
                  contractVersion: 1,
                },
              });
              const current = await tx.reservationIntake.create({
                data: {
                  ...intake,
                  requestId: randomUUID(),
                  contractVersion: 2,
                },
              });
              const issued = {
                key: 'hotel',
                hotelId: firstHotel,
                checkInDate: '2026-11-21',
                checkOutDate: '2026-11-24',
              };
              await tx.reservationWorkflowRevision.createMany({
                data: [
                  {
                    intakeId: old.id,
                    actorUserId: actor.id,
                    version: 1,
                    state: { voucherIssued: true },
                  },
                  {
                    intakeId: current.id,
                    actorUserId: actor.id,
                    version: 1,
                    state: { voucherIssued: false },
                  },
                  {
                    intakeId: current.id,
                    actorUserId: actor.id,
                    version: 2,
                    state: { voucherIssued: true, issuedHotelStays: [issued] },
                  },
                ],
              });
              const contracts = await readSettledHotelContracts(
                tx,
                [branchId],
                null,
              );
              const evidence = await readVoucherCoverage(
                tx,
                contracts.map((c) => c.contractId),
              );
              const result = pendingVoucherPage(contracts, evidence, 1, 10);
              expect(result).toMatchObject({
                total: 1,
                unknownStayCount: 0,
                rows: [
                  {
                    contractNumber: contract.contractNumber,
                    intakeId: current.id,
                    hotelName: hotel.name,
                  },
                ],
              });
              await tx.salesContract.update({
                where: { id: contract.id },
                data: { settlementStatus: 'UNPAID' },
              });
              expect(
                await readSettledHotelContracts(tx, [branchId], null),
              ).toEqual([]);
              throw rollback;
            },
            { timeout: 20_000 },
          ),
        ).rejects.toBe(rollback);
      } finally {
        await db.$disconnect();
      }
    }, 30_000);
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
