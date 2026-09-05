import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
  TicketOfferCreateV1,
} from '@rubi/contracts';
import { createDatabaseClient } from '@rubi/database';
import type { DatabaseService } from '../database/database.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import {
  TicketPublicService,
  validateTicketOffer,
} from './ticket-public.service';
import { SalesRepository } from '../sales/sales.repository';
import { SalesReservationDispatcher } from '../sales/sales-reservation-dispatcher';

const definition: TicketOfferCreateV1 = {
  originId: randomUUID(),
  destinationId: randomUUID(),
  departureAt: '2099-10-01T10:00:00.000Z',
  arrivalAt: '2099-10-01T12:00:00.000Z',
  carrierName: 'Synthetic test carrier',
  serviceNumber: 'TEST-1',
  cabinClassCode: 'BUSINESS',
  totalCapacity: 10,
};

describe('published ticket validation', () => {
  it('rejects invalid dates, routes, capacities and cabins', () => {
    for (const change of [
      { arrivalAt: definition.departureAt },
      { destinationId: definition.originId },
      { totalCapacity: -1 },
      { totalCapacity: 0.5 },
      { cabinClassCode: 'UNKNOWN' },
    ]) {
      expect(() => validateTicketOffer({ ...definition, ...change })).toThrow();
    }
    expect(validateTicketOffer(definition)).toEqual(definition);
  });
});

describe.skipIf(!process.env.TRAVEL_TEST_DATABASE_URL)(
  'travel runtime PostgreSQL integration',
  () => {
    const client = createDatabaseClient(
      process.env.TRAVEL_TEST_DATABASE_URL ??
        'postgresql://unused:unused@localhost/unused',
    );
    const database = { client } as DatabaseService;
    const tickets = new TicketPublicService(database);
    const reservations = new ReservationsPublicService(database);
    const sales = new SalesRepository(database);
    const branchId = randomUUID();
    const actor = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
    } as AuthenticatedActor;
    afterAll(async () => {
      await client.$disconnect();
    });

    it('replays publication, rejects key reuse and checks authorization before persistence', async () => {
      const key = randomUUID();
      const first = await tickets.publish(definition, actor, branchId, key);
      expect(await tickets.publish(definition, actor, branchId, key)).toEqual(
        first,
      );
      await expect(
        tickets.publish(
          { ...definition, totalCapacity: 11 },
          actor,
          branchId,
          key,
        ),
      ).rejects.toThrow();
      await expect(
        tickets.publish(
          definition,
          { ...actor, permissions: [] },
          branchId,
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        tickets.publish(definition, actor, randomUUID(), randomUUID()),
      ).rejects.toThrow();
      expect(
        await client.ticketOfferAudit.count({
          where: { offerId: first.data.id },
        }),
      ).toBe(1);
    });

    it('searches return offers beyond the outbound window and scopes to authorized branches', async () => {
      const outbound = await tickets.publish(
        definition,
        actor,
        branchId,
        randomUUID(),
      );
      const returnDefinition = {
        ...definition,
        originId: definition.destinationId,
        destinationId: definition.originId,
        departureAt: '2099-11-20T10:00:00.000Z',
        arrivalAt: '2099-11-20T12:00:00.000Z',
      };
      const inbound = await tickets.publish(
        returnDefinition,
        actor,
        branchId,
        randomUUID(),
      );
      const query = {
        originId: returnDefinition.originId,
        destinationId: returnDefinition.destinationId,
        departureFrom: '2099-10-01',
        cabinClassCode: 'BUSINESS' as const,
      };
      const result = await tickets.search(query, actor);
      expect(result.data.map(({ id }) => id)).toContain(inbound.data.id);
      expect(result.data.map(({ id }) => id)).not.toContain(outbound.data.id);
      expect(
        (await tickets.search(query, { ...actor, branchIds: [randomUUID()] }))
          .data,
      ).toEqual([]);
      expect(
        (await tickets.revalidate([inbound.data.id], randomUUID())).available,
      ).toBe(false);
      expect(
        (await tickets.revalidate([inbound.data.id], branchId)).available,
      ).toBe(true);
      expect(
        (
          await tickets.revalidate([inbound.data.id], branchId, [
            {
              serviceClientKey: 'flight',
              direction: 'RETURN',
              offerId: inbound.data.id,
              originId: returnDefinition.originId,
              destinationId: returnDefinition.destinationId,
              departureAt: returnDefinition.departureAt,
              arrivalAt: returnDefinition.arrivalAt,
              carrierNameSnapshot: returnDefinition.carrierName,
              serviceNumberSnapshot: returnDefinition.serviceNumber,
              cabinClassCode: 'ECONOMY',
            },
          ])
        ).available,
      ).toBe(false);
    });

    it('receives a versioned immutable request once across concurrent retries', async () => {
      const snapshot: SalesReservationRequestV1 = {
        version: 1,
        requestId: randomUUID(),
        contractId: randomUUID(),
        contractNumber: 'TEST-CONTRACT',
        contractVersion: 2,
        customerId: randomUUID(),
        passengerIds: [randomUUID()],
        serviceSelections: [
          { clientKey: 'visa', kind: 'VISA', titleSnapshot: 'Test visa' },
        ],
        selectedTicketOfferIds: [],
        hotelSelection: null,
        createdAt: new Date().toISOString(),
      };
      const received = await Promise.all([
        reservations.receive(snapshot, branchId),
        reservations.receive(snapshot, branchId),
      ]);
      expect(received[0]).toEqual(received[1]);
      expect(
        await client.reservationIntake.count({
          where: { requestId: snapshot.requestId },
        }),
      ).toBe(1);
      await expect(
        reservations.receive(
          { ...snapshot, contractNumber: 'CHANGED' },
          branchId,
        ),
      ).rejects.toThrow();
      expect(
        (await reservations.list([branchId])).some(
          (item) => item.requestId === snapshot.requestId,
        ),
      ).toBe(true);
      expect(await reservations.list([randomUUID()])).toEqual([]);
    });
    it('keeps mixed-currency contracts unsettled until every currency is covered, and dispatches the durable outbox', async () => {
      const context = { userId: actor.userId, branchId };
      const contract = await sales.create(
        {
          customerId: randomUUID(),
          tripType: 'ONE_WAY',
          originId: definition.originId,
          destinationId: definition.destinationId,
          departureDate: '2099-10-01',
          services: [
            { clientKey: 'visa', kind: 'VISA', titleSnapshot: 'Test visa' },
          ],
          passengers: [
            {
              customerId: randomUUID(),
              displayNameSnapshot: 'Synthetic passenger',
              birthDate: '1990-01-01',
              serviceClientKeys: ['visa'],
            },
          ],
          priceComponents: [
            {
              type: 'BASE',
              title: 'IRR total',
              amount: '100',
              currencyCode: 'IRR',
            },
            {
              type: 'BASE',
              title: 'USD total',
              amount: '10',
              currencyCode: 'USD',
            },
          ],
          payments: [
            {
              amount: '110',
              currencyCode: 'IRR',
              method: 'CASH',
              dueAt: '2099-09-01T00:00:00Z',
            },
            {
              amount: '10',
              currencyCode: 'USD',
              method: 'CASH',
              dueAt: '2099-09-01T00:00:00Z',
            },
          ],
        },
        'Synthetic customer',
        randomUUID(),
        'test',
        context,
      );
      expect(contract.settlementStatus).toBe('UNPAID');
      const payment = contract.payments.find(
        (item) => item.currencyCode === 'IRR',
      )!;
      await sales.applyFinanceConfirmation({
        contractId: contract.id,
        paymentId: payment.id,
        financePaymentReference: randomUUID(),
        financeConfirmationId: randomUUID(),
        confirmedAt: new Date().toISOString(),
      });
      const partial = (await sales.findById(contract.id))!;
      expect(partial.settlementStatus).toBe('PARTIALLY_SETTLED');
      const usd = contract.payments.find(
        (item) => item.currencyCode === 'USD',
      )!;
      await sales.applyFinanceConfirmation({
        contractId: contract.id,
        paymentId: usd.id,
        financePaymentReference: randomUUID(),
        financeConfirmationId: randomUUID(),
        confirmedAt: new Date().toISOString(),
      });
      const paid = (await sales.findById(contract.id))!;
      expect(paid.settlementStatus).toBe('OVERPAID');
      const requestId = randomUUID();
      const snapshot: SalesReservationRequestV1 = {
        version: 1,
        requestId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        contractVersion: paid.version + 1,
        customerId: contract.customerId,
        passengerIds: contract.passengers.map((item) => item.customerId),
        serviceSelections: [
          { clientKey: 'visa', kind: 'VISA', titleSnapshot: 'Test visa' },
        ],
        selectedTicketOfferIds: [],
        hotelSelection: null,
        createdAt: new Date().toISOString(),
      };
      await sales.transition(
        contract.id,
        paid.version,
        ['DRAFT'],
        'SENT_TO_RESERVATIONS',
        'Test dispatch',
        context,
        randomUUID(),
        'test',
        JSON.parse(JSON.stringify(snapshot)),
        requestId,
      );
      const dispatcher = new SalesReservationDispatcher(sales, reservations);
      await dispatcher.dispatch();
      await dispatcher.dispatch();
      expect(
        await client.reservationIntake.count({ where: { requestId } }),
      ).toBe(1);
      expect((await sales.findById(contract.id))?.reservationStatus).toBe(
        'ACCEPTED',
      );
      expect(
        await client.salesReservationRequest.findUnique({
          where: { id: requestId },
        }),
      ).toMatchObject({ status: 'ACCEPTED' });
    }, 30000);
  },
);
