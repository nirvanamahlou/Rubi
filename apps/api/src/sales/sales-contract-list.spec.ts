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
    });
    expect(result.data[0]).not.toHaveProperty('buyerContact');
    expect(resolvePhone).toHaveBeenCalledOnce();
    expect(resolvePhone).toHaveBeenCalledWith('customer', actor);
    expect(detail).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledWith(
      {},
      {
        branchId: { in: ['branch'] },
        OR: [{ ownerUserId: 'owner' }, { assignedUserId: 'owner' }],
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
