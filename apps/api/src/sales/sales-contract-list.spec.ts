import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesService } from './sales.service';
import type { SalesRepository, SalesContractRow } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { MasterDataService } from '../master-data/master-data.service';
import type { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';

const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.own'],
} as AuthenticatedActor;
function row(id: string): SalesContractRow {
  return {
    id,
    contractNumber: 'SC-2026-000001',
    branchId: 'branch',
    ownerUserId: 'owner',
    customerId: 'customer',
    customerNameSnapshot: 'Synthetic Buyer',
    originId: 'origin',
    destinationId: 'destination',
    version: 1,
    status: 'DRAFT',
    tripType: 'ONE_WAY',
    departureDate: new Date('2026-10-08'),
    createdAt: new Date('2026-10-03T08:00:00Z'),
    updatedAt: new Date('2026-10-04T08:00:00Z'),
    passengers: [],
    services: [],
    payments: [],
    priceComponents: [],
    ticketSelections: [],
    reservationRequests: [],
  } as unknown as SalesContractRow;
}
describe('contract list route and buyer phone', () => {
  it('projects sellers and flags only a reservation amendment applied to the contract', async () => {
    const changed = row('changed'),
      internal = row('internal'),
      canonical = row('canonical');
    canonical.reservationRequests = [
      { idempotencyKey: 'amend-synthetic' },
    ] as never;
    changed.services = [
      {
        kind: 'HOTEL',
        metadata: {
          reservationFormAmendment: JSON.stringify({
            version: 1,
            targetContractVersion: 2,
          }),
        },
      },
    ] as never;
    internal.services = [
      {
        kind: 'HOTEL',
        metadata: {
          internalForm: 'private details',
          reservationFormAmendment: 'untrusted metadata is not an audit event',
        },
      },
    ] as never;
    const list = vi.fn().mockResolvedValue({
      data: [changed, internal, canonical],
      page: 1,
      pageSize: 20,
      total: 3,
    });
    const displayNames = vi
      .fn()
      .mockResolvedValue([{ id: 'owner', displayName: 'Synthetic Seller' }]);
    const service = new SalesService(
      {
        list,
        amendedContractIds: vi
          .fn()
          .mockResolvedValue([
            { contractId: 'changed' },
            { contractId: 'canonical' },
          ]),
      } as never,
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      undefined,
      { displayNames } as never,
    );
    const result = await service.list(
      {},
      {
        ...actor,
        permissions: ['sales.contracts.read.all', 'sales.contracts.create'],
      },
    );
    expect(list).toHaveBeenCalledWith({}, {}, false);
    expect(result.data.map((item) => item.sellerName)).toEqual([
      'Synthetic Seller',
      'Synthetic Seller',
      'Synthetic Seller',
    ]);
    expect(result.data.map((item) => item.reservationContractChanged)).toEqual([
      true,
      false,
      true,
    ]);
    expect(JSON.stringify(result)).not.toContain('private details');
    expect(JSON.stringify(result)).not.toContain('reservationFormAmendment');
    expect(displayNames).toHaveBeenCalledWith(
      ['owner', 'owner', 'owner'],
      ['branch'],
    );
  });
  it('prefers the immutable buyer phone, resolves legacy contacts once and preserves scoped listing', async () => {
    const first = row('snapshot');
    first.buyerContact = { version: 1, encrypted: 'synthetic' };
    const list = vi.fn().mockResolvedValue({
      data: [first, row('legacy'), row('legacy2')],
      page: 1,
      pageSize: 20,
      total: 3,
    });
    const resolvePhone = vi.fn().mockResolvedValue('09999999999');
    const detail = vi.fn(async (_resource: string, id: string) => ({
      data: {
        name: id === 'origin' ? 'Tehran' : 'Antalya',
        status: 'inactive',
      },
    }));
    const decrypt = vi.fn().mockReturnValue({
      name: 'Synthetic Buyer',
      phone: '08888888888',
      address: 'Synthetic address',
      postalCode: '',
    });
    const service = new SalesService(
      { list } as unknown as SalesRepository,
      { resolvePhone } as unknown as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
      undefined,
      undefined,
      { decrypt } as unknown as SalesBuyerContactCrypto,
      { detail } as unknown as MasterDataService,
    );
    const result = await service.list({}, actor);
    expect(result.data.map((item) => item.customerPhone)).toEqual([
      '08888888888',
      '09999999999',
      '09999999999',
    ]);
    expect(result.data[0]).toMatchObject({
      originName: 'Tehran',
      destinationName: 'Antalya',
      createdAt: '2026-10-03T08:00:00.000Z',
      travelDates: {
        outbound: { date: '2026-10-08', calendar: 'persian' },
        returning: null,
      },
      passengerComposition: {
        adults: 0,
        children2To6: 0,
        children6To12: 0,
        infants: 0,
        childrenUnknownAge: 0,
      },
    });
    expect(result.data[0]).not.toHaveProperty('buyerContact');
    expect(resolvePhone).toHaveBeenCalledOnce();
    expect(resolvePhone).toHaveBeenCalledWith('customer', actor);
    expect(detail).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith(
      {},
      {
        branchId: { in: ['branch'] },
        ownerUserId: 'owner',
      },
      false,
    );
  });
  it('rejects an unauthorized list before loading any contact or route', async () => {
    const list = vi.fn(),
      resolvePhone = vi.fn();
    const service = new SalesService(
      { list } as unknown as SalesRepository,
      { resolvePhone } as unknown as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    await expect(
      service.list({}, { ...actor, permissions: [] }),
    ).rejects.toThrow('مجوز');
    expect(list).not.toHaveBeenCalled();
    expect(resolvePhone).not.toHaveBeenCalled();
  });
});
