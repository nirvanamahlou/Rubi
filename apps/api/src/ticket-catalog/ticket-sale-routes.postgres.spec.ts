import { randomUUID } from 'node:crypto';
import { afterAll, describe, it, expect } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import { TicketPublicService } from './ticket-public.service';
const ciProof = process.env.NORA_RUN_TICKET_ROUTES_POSTGRES_TESTS === '1';
const url =
  process.env.TICKET_ROUTES_TEST_DATABASE_URL ??
  (ciProof ? process.env.DATABASE_URL : undefined);
describe.skipIf(!url)(
  'commercial destinations share real PostgreSQL inventory',
  () => {
    if (
      url &&
      (!['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
        !(
          new URL(url).pathname.startsWith('/rubi_ticket_routes_1021_') ||
          (ciProof &&
            process.env.CI === 'true' &&
            new URL(url).pathname === '/nora_ci')
        ))
    )
      throw new Error('Isolated synthetic database required');
    const client = createDatabaseClient(
      url ?? 'postgresql://unused:unused@localhost/unused',
    );
    afterAll(() => client.$disconnect());
    it('serializes two destination sales against the same offer and rejects excess capacity, stale versions, unconfigured routes and foreign branches', async () => {
      const user = randomUUID(),
        branch = randomUUID();
      const country = await client.masterCountry.upsert({
        where: { code: 'XZ' },
        update: {},
        create: {
          code: 'XZ',
          name: 'Synthetic routes',
          createdByUserId: user,
          updatedByUserId: user,
        },
      });
      const cities = await Promise.all(
        ['Origin', 'Kusadasi', 'Bodrum', 'Other'].map((name, index) =>
          client.masterCity.create({
            data: {
              countryId: country.id,
              code: branch.slice(0, 20) + index,
              name,
              createdByUserId: user,
              updatedByUserId: user,
            },
          }),
        ),
      );
      const a = cities[0]!.id,
        b = cities[1]!.id,
        c = cities[2]!.id,
        d = cities[3]!.id;
      const actor = {
        userId: user,
        branchIds: [branch],
        permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
      } as never;
      const service = new TicketPublicService(
        { client } as never,
        { ensureOfferPurchaseRequest: async () => undefined } as never,
        undefined,
        { detail: async () => ({ data: { status: 'active' } }) } as never,
      );
      const input = {
        originId: a,
        destinationId: b,
        departureAt: '2099-01-01T08:00:00Z',
        arrivalAt: '2099-01-01T10:00:00Z',
        carrierName: 'Synthetic',
        serviceNumber: 'QA',
        cabinClassCode: 'ECONOMY' as const,
        totalCapacity: 3,
        saleRoutes: [{ originId: a, destinationId: c }],
      };
      const key = randomUUID();
      const published = await service.publish(input, actor, branch, key);
      expect(await service.publish(input, actor, branch, key)).toEqual(
        published,
      );
      const offer = await client.ticketPublishedOffer.findUniqueOrThrow({
        where: { id: published.data.id },
      });
      expect(
        await client.ticketOfferSaleRoute.count({
          where: { offerId: offer.id },
        }),
      ).toBe(1);
      await expect(
        client.ticketOfferSaleRoute.create({
          data: { offerId: offer.id, originId: a, destinationId: randomUUID() },
        }),
      ).rejects.toThrow();
      const selection = (destinationId: string) => ({
        offerId: offer.id,
        originId: a,
        destinationId,
        departureAt: offer.departureAt.toISOString(),
        arrivalAt: offer.arrivalAt.toISOString(),
        carrierNameSnapshot: offer.carrierName,
        serviceNumberSnapshot: offer.serviceNumber,
        cabinClassCode: 'ECONOMY' as const,
        serviceClientKey: 'f',
        direction: 'OUTBOUND' as const,
      });
      const contracts = [randomUUID(), randomUUID()];
      const attempts = await Promise.all([
        service.reserve([selection(b)], branch, contracts[0]!, 2),
        service.reserve([selection(c)], branch, contracts[1]!, 2),
      ]);
      expect(attempts.filter((r) => r.available)).toHaveLength(1);
      expect(
        await client.ticketPublishedOffer.count({
          where: { branchId: branch },
        }),
      ).toBe(1);
      expect(
        (
          await client.ticketOfferCapacityAllocation.aggregate({
            where: { offerId: offer.id, status: 'ACTIVE' },
            _sum: { quantity: true },
          })
        )._sum.quantity,
      ).toBe(2);
      const first = attempts[0]!.available ? 0 : 1,
        second = first === 0 ? 1 : 0;
      const secondDest = second === 0 ? b : c;
      expect(
        (
          await service.reserve(
            [selection(secondDest)],
            branch,
            contracts[second]!,
            1,
          )
        ).available,
      ).toBe(true);
      expect(
        (
          await service.reserve(
            [selection(secondDest)],
            branch,
            contracts[second]!,
            1,
          )
        ).available,
      ).toBe(true);
      expect(
        await client.ticketOfferCapacityAllocation.count({
          where: { offerId: offer.id, status: 'ACTIVE' },
        }),
      ).toBe(2);
      expect(
        (await service.reserve([selection(b)], branch, randomUUID(), 1))
          .available,
      ).toBe(false);
      expect(
        (await service.reserve([selection(d)], branch, randomUUID(), 1))
          .available,
      ).toBe(false);
      expect(
        (await service.reserve([selection(c)], randomUUID(), randomUUID(), 1))
          .available,
      ).toBe(false);
      for (const destinationId of [b, c])
        expect(
          (
            await service.search(
              { originId: a, destinationId, departureFrom: '2099-01-01' },
              actor,
            )
          ).data[0],
        ).toMatchObject({ id: offer.id, remainingCapacity: 0, destinationId });
      await expect(
        service.revise(
          offer.id,
          {
            expectedVersion: 99,
            offer: {
              originId: a,
              destinationId: b,
              departureAt: offer.departureAt.toISOString(),
              arrivalAt: offer.arrivalAt.toISOString(),
              carrierName: 'Synthetic',
              serviceNumber: 'QA',
              cabinClassCode: 'ECONOMY',
              totalCapacity: 3,
            },
          },
          actor,
        ),
      ).rejects.toThrow();
    }, 20000);
  },
);
