import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesContractCreateRequest,
  SalesTicketSelectionInput,
  TicketOfferV1,
} from '@rubi/contracts';
import { createDatabaseClient } from '@rubi/database';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { TicketPublicService } from './ticket-public.service';
import { TourPublicService } from './tour-public.service';

describe.skipIf(!process.env.TRAVEL_TEST_DATABASE_URL)(
  'tour persistence and shared stock',
  () => {
    const client = createDatabaseClient(
      process.env.TRAVEL_TEST_DATABASE_URL ??
        'postgresql://unused:unused@localhost/unused',
    );
    const database = { client } as DatabaseService;
    const references = {
      assertTourReferences: vi.fn(async () => {}),
    } as unknown as MasterTravelDirectory;
    const service = new TourPublicService(database, references);
    const tickets = new TicketPublicService(database);
    const branchId = randomUUID();
    const actor: AuthenticatedActor = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
    };
    const definition = {
      name: 'Synthetic tour',
      originId: randomUUID(),
      destinationId: randomUUID(),
      hotelIds: [],
      transferOutbound: true,
      transferReturn: true,
      visa: false,
    };
    afterAll(async () => {
      await client.$disconnect();
    });
    const selection = (
      offer: TicketOfferV1,
      direction: 'OUTBOUND' | 'RETURN',
    ): SalesTicketSelectionInput => ({
      serviceClientKey: `flight-${direction.toLowerCase()}`,
      direction,
      offerId: offer.id,
      originId: offer.originId,
      destinationId: offer.destinationId,
      departureAt: offer.departureAt,
      arrivalAt: offer.arrivalAt,
      carrierNameSnapshot: offer.carrierName,
      serviceNumberSnapshot: offer.serviceNumber,
      cabinClassCode: offer.cabinClassCode,
    });

    it('stores an immutable package and rejects replay mismatch/unauthorized commands', async () => {
      const key = randomUUID();
      const first = await service.createPackage(
        definition,
        actor,
        branchId,
        key,
      );
      expect(
        await service.createPackage(definition, actor, branchId, key),
      ).toEqual(first);
      await expect(
        service.createPackage(
          { ...definition, name: 'Different' },
          actor,
          branchId,
          key,
        ),
      ).rejects.toThrow();
      await expect(
        service.createPackage(
          definition,
          { ...actor, permissions: [] },
          branchId,
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        service.createPackage(definition, actor, randomUUID(), randomUUID()),
      ).rejects.toThrow();
      expect(
        (await service.packages({ ...actor, branchIds: [randomUUID()] })).data,
      ).toEqual([]);
      expect(references.assertTourReferences).toHaveBeenCalled();
    });

    it('tour and standalone reservations cannot oversell the same offers; repetition preserves old stock', async () => {
      const pack = (
        await service.createPackage(definition, actor, branchId, randomUUID())
      ).data;
      const publish = async (back: boolean, day: string) =>
        (
          await tickets.publish(
            {
              originId: back ? definition.destinationId : definition.originId,
              destinationId: back
                ? definition.originId
                : definition.destinationId,
              departureAt: `${day}T10:00:00.000Z`,
              arrivalAt: `${day}T12:00:00.000Z`,
              carrierName: 'Synthetic carrier',
              serviceNumber: back ? 'TEST-B' : 'TEST-A',
              cabinClassCode: 'ECONOMY',
              totalCapacity: back ? 2 : 3,
            },
            actor,
            branchId,
            randomUUID(),
          )
        ).data.id;
      const outboundOfferId = await publish(false, '2099-10-01');
      const returnOfferId = await publish(true, '2099-10-08');
      const input = {
        packageId: pack.id,
        packageVersion: 1,
        startsOn: '2099-10-01',
        endsOn: '2099-10-08',
        outboundOfferId,
        returnOfferId,
      };
      const key = randomUUID();
      const tour = (await service.createDeparture(input, actor, branchId, key))
        .data;
      expect(tour.remainingCapacity).toBe(2);
      const concurrentKey = randomUUID();
      const replays = await Promise.all([
        service.createDeparture(input, actor, branchId, concurrentKey),
        service.createDeparture(input, actor, branchId, concurrentKey),
      ]);
      expect(replays[0].data.id).toBe(replays[1].data.id);
      const salesInput: SalesContractCreateRequest = {
        customerId: randomUUID(),
        tripType: 'ROUND_TRIP',
        originId: definition.originId,
        destinationId: definition.destinationId,
        departureDate: '2099-10-01T00:00:00.000Z',
        passengers: [],
        priceComponents: [],
        services: [
          {
            clientKey: 'flight-outbound',
            kind: 'FLIGHT',
            titleSnapshot: 'Flight',
            metadata: {
              tourDepartureId: tour.id,
              tourDepartureVersion: tour.version,
            },
          },
          {
            clientKey: 'flight-return',
            kind: 'FLIGHT',
            titleSnapshot: 'Return',
          },
          {
            clientKey: 'transfer-outbound',
            kind: 'TRANSFER',
            titleSnapshot: 'Included transfer',
            metadata: { direction: 'OUTBOUND' },
          },
          {
            clientKey: 'transfer-return',
            kind: 'TRANSFER',
            titleSnapshot: 'Included transfer',
            metadata: { direction: 'RETURN' },
          },
        ],
        ticketSelections: [
          selection(tour.outbound, 'OUTBOUND'),
          selection(tour.returning!, 'RETURN'),
        ],
      };
      await expect(
        service.assertSalesSelection(salesInput, branchId),
      ).resolves.toBeUndefined();
      await expect(
        service.assertSalesSelection(salesInput, randomUUID()),
      ).rejects.toThrow();
      await expect(
        service.assertSalesSelection(
          { ...salesInput, ticketSelections: [] },
          branchId,
        ),
      ).rejects.toThrow();
      await expect(
        service.assertSalesSelection(
          { ...salesInput, services: salesInput.services.slice(0, 2) },
          branchId,
        ),
      ).rejects.toThrow();
      expect(
        (await service.createDeparture(input, actor, branchId, key)).data.id,
      ).toBe(tour.id);
      await expect(
        service.createDeparture(
          { ...input, packageVersion: 2 },
          actor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        service.createDeparture(
          { ...input, startsOn: '2099-10-02' },
          actor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toThrow();
      const selections = [
        selection(tour.outbound, 'OUTBOUND'),
        selection(tour.returning!, 'RETURN'),
      ];
      const sold = await Promise.all([
        tickets.reserve(selections, branchId, randomUUID(), 2),
        tickets.reserve([selections[1]!], branchId, randomUUID(), 1),
      ]);
      expect(sold.filter((result) => result.available)).toHaveLength(1);
      const oldBeforeRepeat = await client.ticketOfferCapacityAllocation.count({
        where: { offerId: returnOfferId, status: 'ACTIVE' },
      });
      const repeated = (
        await service.createDeparture(
          {
            ...input,
            startsOn: '2099-10-08',
            endsOn: '2099-10-15',
            outboundOfferId: await publish(false, '2099-10-08'),
            returnOfferId: await publish(true, '2099-10-15'),
          },
          actor,
          branchId,
          randomUUID(),
        )
      ).data;
      expect(repeated.id).not.toBe(tour.id);
      expect(repeated.remainingCapacity).toBe(2);
      expect(
        await client.ticketOfferCapacityAllocation.count({
          where: { offerId: returnOfferId, status: 'ACTIVE' },
        }),
      ).toBe(oldBeforeRepeat);
      expect(
        (
          await client.tourDeparture.findUniqueOrThrow({
            where: { id: tour.id },
          })
        ).startsOn.toISOString(),
      ).toBe('2099-10-01T00:00:00.000Z');
    });
  },
);
