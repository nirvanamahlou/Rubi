import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type Prisma } from '@rubi/database';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@rubi/contracts';
import type { DatabaseService } from '../database/database.service';
import { ReservationsPublicService } from './reservations-public.service';
import {
  ReservationHotelPurchaseService,
  validateHotelPurchase,
} from './reservation-hotel-purchase.service';

describe('hotel purchase input', () => {
  it.each(['0', '-10', '1e3', '1.12345', '1,000'])('rejects %s', (amount) =>
    expect(() =>
      validateHotelPurchase({
        version: 1,
        expectedVersion: 0,
        amount,
        currencyCode: 'IRR',
      }),
    ).toThrow(),
  );
});
describe.skipIf(!process.env.HOTEL_PRICING_TEST_DATABASE_URL)(
  'hotel purchase PostgreSQL controls',
  () => {
    const url =
      process.env.HOTEL_PRICING_TEST_DATABASE_URL ??
      'postgresql://unused:unused@localhost/unused';
    if (
      process.env.HOTEL_PRICING_TEST_DATABASE_URL &&
      !new URL(url).pathname.endsWith('_pricing_test_0906')
    )
      throw new Error('Dedicated hotel pricing test database required');
    const client = createDatabaseClient(url);
    const service = new ReservationHotelPurchaseService({
      client,
    } as DatabaseService);
    const actor = {
      userId: randomUUID(),
      branchIds: [randomUUID()],
      permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
    } as AuthenticatedActor;
    const ids: string[] = [];
    const snapshot = {
      version: 1,
      requestId: randomUUID(),
      contractId: randomUUID(),
      contractNumber: 'SYNTHETIC-TEST',
      contractVersion: 1,
      customerId: randomUUID(),
      passengerIds: [randomUUID()],
      selectedTicketOfferIds: [],
      createdAt: new Date().toISOString(),
      serviceSelections: [
        {
          clientKey: 'hotel',
          kind: 'HOTEL',
          titleSnapshot: 'Synthetic hotel',
          pricing: [
            {
              version: 1,
              currencyCode: 'IRR',
              daySale: { basis: 'TOTAL', amount: '1000' },
              agreed: { basis: 'TOTAL', amount: '900' },
            },
          ],
        },
      ],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: randomUUID(),
        hotelNameSnapshot: 'Synthetic hotel',
        cityId: randomUUID(),
        checkInDate: '2026-09-10',
        checkOutDate: '2026-09-13',
        roomCount: 1,
        roomTypeId: randomUUID(),
        occupancy: 1,
        inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
      },
    } as SalesReservationRequestV1;
    const input = {
      version: 1 as const,
      expectedVersion: 0,
      amount: '700',
      currencyCode: 'IRR',
    };
    async function intake() {
      const row = await client.reservationIntake.create({
        data: {
          requestId: randomUUID(),
          contractId: randomUUID(),
          contractVersion: 1,
          branchId: actor.branchIds[0]!,
          fingerprint: 'synthetic',
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      ids.push(row.id);
      return row;
    }
    afterAll(async () => {
      await client.reservationArrangementRevision.deleteMany({
        where: { intakeId: { in: ids } },
      });
      await client.reservationHotelPurchase.deleteMany({
        where: { intakeId: { in: ids } },
      });
      await client.reservationIntake.deleteMany({ where: { id: { in: ids } } });
      await client.$disconnect();
    });
    it('denies missing permission and foreign branch without recording a cost', async () => {
      const row = await intake();
      await expect(
        service.record(
          row.id,
          input,
          { ...actor, permissions: ['reservations.read'] },
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.record(
          row.id,
          input,
          { ...actor, branchIds: [randomUUID()] },
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await client.reservationHotelPurchase.count({
          where: { intakeId: row.id },
        }),
      ).toBe(0);
    });
    it('records append-only revisions, preserves snapshot and replays exact retries', async () => {
      const row = await intake(),
        key = randomUUID();
      const saved = await service.record(row.id, input, actor, key);
      expect(await service.record(row.id, input, actor, key)).toEqual(saved);
      await expect(
        service.record(row.id, { ...input, amount: '600' }, actor, key),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        service.record(row.id, input, actor, randomUUID()),
      ).rejects.toMatchObject({ status: 409 });
      await service.record(
        row.id,
        { ...input, expectedVersion: 1, amount: '650' },
        actor,
        randomUUID(),
      );
      expect(
        await client.reservationHotelPurchase.count({
          where: { intakeId: row.id },
        }),
      ).toBe(2);
      const after = await client.reservationIntake.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(after.snapshot).toEqual(row.snapshot);
      expect(after.purchaseVersion).toBe(2);
    });
    it('rejects cross-currency costs and requests without hotel', async () => {
      const row = await intake();
      await expect(
        service.record(
          row.id,
          { ...input, currencyCode: 'USD' },
          actor,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 400 });
      await client.reservationIntake.update({
        where: { id: row.id },
        data: {
          snapshot: {
            ...snapshot,
            hotelSelection: null,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await expect(
        service.record(row.id, input, actor, randomUUID()),
      ).rejects.toMatchObject({ status: 400 });
    });
    it('preserves both purchase and arrangement versions through the public read/update boundary', async () => {
      const row = await intake();
      const reservations = new ReservationsPublicService({
        client,
      } as DatabaseService);
      await service.record(row.id, input, actor, randomUUID());
      const updated = await reservations.updateArrangement(
        row.id,
        {
          expectedVersion: 0,
          roomCount: 2,
          singleRoomCount: 1,
          doubleRoomCount: 1,
          extraBedCount: 0,
          hotelGuestCustomerIds: snapshot.passengerIds,
          reason: 'Synthetic integration check',
        },
        actor.branchIds,
        actor.userId,
      );
      expect(updated.purchaseVersion).toBe(1);
      expect(updated.hotelPurchases).toMatchObject([
        { amount: '700', currencyCode: 'IRR', version: 1 },
      ]);
      expect(updated.arrangement).toMatchObject({ version: 1, roomCount: 2 });
      await service.record(
        row.id,
        { ...input, expectedVersion: 1, amount: '650' },
        actor,
        randomUUID(),
      );
      const listed = (await reservations.list(actor.branchIds)).find(
        (item) => item.id === row.id,
      )!;
      expect(listed.purchaseVersion).toBe(2);
      expect(listed.hotelPurchases).toMatchObject([
        { amount: '650', version: 2 },
      ]);
      expect(listed.arrangement).toMatchObject({ version: 1, roomCount: 2 });
      expect(listed.snapshot).toEqual(row.snapshot);
      expect(await reservations.list([randomUUID()])).toEqual([]);
    });
    it('only lets one concurrent expected version win', async () => {
      const row = await intake();
      const results = await Promise.allSettled([
        service.record(row.id, input, actor, randomUUID()),
        service.record(
          row.id,
          { ...input, amount: '600' },
          actor,
          randomUUID(),
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(
        await client.reservationHotelPurchase.count({
          where: { intakeId: row.id },
        }),
      ).toBe(1);
    });
  },
);
