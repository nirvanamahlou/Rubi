import { describe, it, expect, vi } from 'vitest';
import {
  contractFlightMetadata,
  type SalesContractCreateRequest,
  type AuthenticatedActor,
} from '@rubi/contracts';
import { validateSalesContract } from './sales.domain';
import { SalesService, presentSalesContract } from './sales.service';
import { SalesRepository, type SalesContractRow } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { DatabaseService } from '../database/database.service';
const originId = '10000000-0000-4000-8000-000000000002',
  destinationId = '10000000-0000-4000-8000-000000000003';
const flight = {
  version: 1 as const,
  direction: 'OUTBOUND' as const,
  originId,
  destinationId,
  departureAt: '2026-10-01T06:00:00Z',
  arrivalAt: '2026-10-01T08:00:00Z',
  carrierNameSnapshot: 'Sample Air',
  serviceNumberSnapshot: 'SF123',
  cabinClassCode: 'ECONOMY',
};
const input: SalesContractCreateRequest = {
  customerId: '10000000-0000-4000-8000-000000000001',
  tripType: 'ONE_WAY',
  originId,
  destinationId,
  departureDate: '2026-10-01',
  services: [
    {
      clientKey: 'flight-outbound',
      kind: 'FLIGHT',
      titleSnapshot: 'شناور',
      status: 'NEEDS_RESERVATION_CONFIRMATION',
      metadata: contractFlightMetadata(flight),
    },
  ],
  ticketSelections: [],
  passengers: [
    {
      customerId: '10000000-0000-4000-8000-000000000004',
      displayNameSnapshot: 'Sample',
      birthDate: '1990-01-01',
      serviceClientKeys: ['flight-outbound'],
    },
  ],
  priceComponents: [
    { type: 'BASE', title: 'قیمت', amount: '100', currencyCode: 'USD' },
  ],
};
const actor: AuthenticatedActor = {
  userId: 'owner',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'sales.contracts.read.own',
    'sales.contracts.confirm',
    'sales.reservation_request.create',
  ],
};
function row(): SalesContractRow {
  return {
    id: 'contract',
    contractNumber: 'SAMPLE',
    branchId: 'branch',
    ownerUserId: 'owner',
    version: 1,
    status: 'DRAFT',
    customerId: input.customerId,
    originId,
    destinationId,
    tripType: 'ONE_WAY',
    departureDate: new Date('2026-10-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    services: input.services.map((s) => ({ ...s, id: 'service' })),
    passengers: [],
    priceComponents: [],
    payments: [],
    ticketSelections: [],
    reservationRequests: [],
  } as unknown as SalesContractRow;
}
describe('Contract-only flights remain outside ticket inventory', () => {
  it('validates manual-only and mixed direction contracts but rejects duplicates or wrong routes', () => {
    expect(() => validateSalesContract(input)).not.toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        ticketSelections: [
          {
            ...flight,
            offerId: 'catalog',
            serviceClientKey: 'flight-outbound',
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        services: [
          {
            ...input.services[0]!,
            metadata: {
              ...input.services[0]!.metadata,
              originId: destinationId,
              destinationId: originId,
            },
          },
        ],
      }),
    ).toThrow();
    const mixed = {
      ...input,
      tripType: 'ROUND_TRIP' as const,
      returnNotBefore: '2026-10-01',
      services: [
        ...input.services,
        {
          clientKey: 'flight-return',
          kind: 'FLIGHT' as const,
          titleSnapshot: 'Back',
          metadata: { direction: 'RETURN' },
        },
      ],
      ticketSelections: [
        {
          ...flight,
          direction: 'RETURN' as const,
          originId: destinationId,
          destinationId: originId,
          offerId: 'catalog',
          serviceClientKey: 'flight-return',
          departureAt: '2026-10-02T06:00:00Z',
          arrivalAt: '2026-10-02T08:00:00Z',
        },
      ],
    };
    expect(() => validateSalesContract(mixed)).not.toThrow();
    expect(() =>
      validateSalesContract({
        ...mixed,
        ticketSelections: [
          {
            ...mixed.ticketSelections[0]!,
            departureAt: '2026-10-01T07:00:00Z',
          },
        ],
      }),
    ).toThrow();
  });
  it('persists the service metadata and never writes a ticket selection', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'service' }),
      ticketCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ value: 1n }]),
      salesContract: { create: vi.fn().mockResolvedValue({ id: 'contract' }) },
      salesContractService: { create },
      salesContractPassenger: {
        create: vi.fn().mockResolvedValue({ id: 'passenger' }),
      },
      salesPassengerServiceAllocation: { createMany: vi.fn() },
      salesContractTicketSelection: { create: ticketCreate },
      salesContractPriceComponent: { createMany: vi.fn() },
      salesContractStatusHistory: { create: vi.fn() },
      salesContractAuditEvent: { create: vi.fn() },
    };
    const repository = new SalesRepository({
      client: {
        $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
        salesContract: { findUnique: vi.fn().mockResolvedValue(row()) },
      },
    } as unknown as DatabaseService);
    await repository.create(input, 'Sample', 'key', 'fingerprint', {
      userId: 'owner',
      branchId: 'branch',
    });
    expect(create.mock.calls[0]![0].data.metadata).toEqual(
      input.services[0]!.metadata,
    );
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(presentSalesContract(row()).servicesDetail[0]?.metadata).toEqual(
      input.services[0]!.metadata,
    );
  });
  it.each([false, true])(
    'reserves only real catalog selections (mixed=%s) and preserves metadata in the versioned reservation snapshot',
    async (mixed) => {
      const saved = row();
      if (mixed) {
        saved.tripType = 'ROUND_TRIP';
        saved.services.push({
          ...saved.services[0]!,
          id: 'service-return',
          clientKey: 'flight-return',
          status: 'SELECTED',
          metadata: { direction: 'RETURN' },
        });
        saved.ticketSelections = [
          {
            ...flight,
            direction: 'RETURN',
            originId: destinationId,
            destinationId: originId,
            offerId: 'catalog',
            serviceId: 'service-return',
            departureAt: new Date('2026-10-02T06:00:00Z'),
            arrivalAt: new Date('2026-10-02T08:00:00Z'),
          },
        ] as unknown as SalesContractRow['ticketSelections'];
      }
      const repository = {
        findById: vi.fn().mockResolvedValue(saved),
        transition: vi.fn().mockResolvedValue(true),
      };
      const reserve = vi
        .fn()
        .mockResolvedValue({
          available: true,
          unavailableOfferIds: [],
          createdAllocationIds: [],
        });
      const service = new SalesService(
        repository as unknown as SalesRepository,
        {
          resolveSnapshot: vi.fn(),
          assertPassengers: vi.fn(),
        } as unknown as SalesCustomersPublicAdapter,
        { reserve, release: vi.fn() } as unknown as SalesTicketAvailabilityPort,
      );
      await service.confirm('contract', 1, null, actor, 'key');
      expect(reserve).toHaveBeenCalledTimes(mixed ? 1 : 0);
      if (mixed) expect(reserve.mock.calls[0]![0]).toHaveLength(1);
      const snapshot = repository.transition.mock.calls[0]![8];
      expect(snapshot.serviceSelections[0].metadata.contractFlightVersion).toBe(
        1,
      );
      expect(snapshot.selectedTicketOfferIds).toEqual(mixed ? ['catalog'] : []);
      await expect(
        service.confirm(
          'contract',
          1,
          null,
          { ...actor, permissions: [] },
          'other',
        ),
      ).rejects.toThrow('مجوز');
    },
  );
});
