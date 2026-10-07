import { describe, expect, it } from 'vitest';
import {
  canViewRoute,
  type ReservationIntakeV1,
  type TicketPurchaseInboxItemV1,
} from '@nora/contracts';
import {
  contractPurchaseServices,
  flightPurchase,
  purchaseCategory,
  purchaseHubHref,
  servicePurchase,
} from './model';
const request = {
  id: 'intake',
  branchId: 'branch',
  snapshot: {
    contractNumber: 'CTR / 42',
    serviceSelections: [
      {
        clientKey: 'transfer-out',
        kind: 'TRANSFER',
        titleSnapshot: 'Outbound',
      },
      { clientKey: 'transfer-in', kind: 'TRANSFER', titleSnapshot: 'Inbound' },
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        referenceId: 'offer',
        titleSnapshot: 'Flight',
      },
    ],
    selectedTicketOfferIds: ['offer'],
    hotelSelection: { serviceClientKey: 'hotel', hotelNameSnapshot: 'Hotel' },
  },
  servicePurchases: [
    {
      id: 'old',
      version: 1,
      serviceClientKey: 'transfer-out',
      coveredServiceClientKeys: ['transfer-out', 'transfer-in'],
      amount: '100',
    },
    {
      id: 'new',
      version: 2,
      serviceClientKey: 'transfer-out',
      coveredServiceClientKeys: ['transfer-out', 'transfer-in'],
      amount: '200',
    },
  ],
} as unknown as ReservationIntakeV1;
describe('contract purchases share canonical reservation records', () => {
  it('does not relabel bus or train offers as flights', () => {
    expect(
      contractPurchaseServices({
        ...request,
        snapshot: {
          ...request.snapshot,
          hotelSelection: null,
          serviceSelections: [
            { clientKey: 'bus', kind: 'BUS', titleSnapshot: 'Bus' },
          ],
          selectedTicketOfferIds: ['bus-offer'],
        },
      }),
    ).toEqual([]);
  });
  it('includes missing hotel purchases and keeps an existing flight unique', () => {
    const services = contractPurchaseServices(request);
    expect(services.map((s) => s.clientKey)).toEqual([
      'transfer-out',
      'transfer-in',
      'flight',
      'hotel',
    ]);
    expect(servicePurchase(request, 'hotel')).toBeUndefined();
  });
  it('resolves the latest common transfer revision for either direction', () => {
    expect(servicePurchase(request, 'transfer-out')?.id).toBe('new');
    expect(servicePurchase(request, 'transfer-in')?.amount).toBe('200');
    expect(request.servicePurchases?.[0]?.id).toBe('old');
  });
  it('matches flight purchases only by canonical offer and authorized branch', () => {
    const service = contractPurchaseServices(request).find(
      (s) => s.kind === 'FLIGHT',
    )!;
    const item = {
      request: { branchId: 'branch', offerId: 'offer', status: 'PENDING' },
      cost: { unitCost: '45.50' },
    } as TicketPurchaseInboxItemV1;
    expect(flightPurchase(request, service, [item])).toBe(item);
    expect(
      flightPurchase({ ...request, branchId: 'other' }, service, [item]),
    ).toBeUndefined();
    expect(
      flightPurchase(request, service, [
        { ...item, request: { ...item.request, status: 'CANCELLED' } },
      ]),
    ).toBeUndefined();
  });
  it('encodes the selected intake and contract number and rejects unknown categories', () => {
    const url = new URL(
      purchaseHubHref({ id: 'intake', contractNumber: 'CTR / 42' }),
      'http://localhost',
    );
    expect(url.pathname).toBe('/ticket-purchases');
    expect(url.searchParams.get('reservationId')).toBe('intake');
    expect(url.searchParams.get('contractNumber')).toBe('CTR / 42');
    expect(purchaseCategory('invalid')).toBe('ALL');
  });
  it('admits existing reservation readers without granting purchase or Finance access', () => {
    expect(
      canViewRoute(
        ['reservations.read'],
        '/ticket-purchases?reservationId=intake',
      ),
    ).toBe(true);
    expect(canViewRoute([], '/ticket-purchases?reservationId=intake')).toBe(
      false,
    );
    expect(canViewRoute(['reservations.read'], '/finance')).toBe(false);
  });
});
