import { describe, it, expect, vi } from 'vitest';
import {
  contractFlightMetadata,
  type SalesContractCreateRequest,
  type AuthenticatedActor,
} from '@nora/contracts';
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
  it.each(['BUS', 'TRAIN'] as const)(
    'hands %s route/day to Reservations without inventing a catalog offer',
    async (kind) => {
      const saved = row();
      saved.services = [
        {
          ...saved.services[0]!,
          clientKey: kind.toLowerCase(),
          kind,
          titleSnapshot: 'Ground service',
          metadata: { carrierName: 'Synthetic Operator' },
        },
      ];
      const repository = {
        findById: vi.fn().mockResolvedValue(saved),
        transition: vi.fn().mockResolvedValue(true),
      };
      const reserve = vi.fn();
      const service = new SalesService(
        repository as unknown as SalesRepository,
        {
          resolveSnapshot: vi.fn(),
          assertPassengers: vi.fn(),
        } as unknown as SalesCustomersPublicAdapter,
        { reserve, release: vi.fn() } as unknown as SalesTicketAvailabilityPort,
      );
      await service.confirm('contract', 1, null, actor, 'ground-key');
      const snapshot = repository.transition.mock.calls[0]![8];
      expect(snapshot.serviceSelections[0]).toMatchObject({
        kind,
        metadata: {
          originId,
          destinationId,
          date: '2026-10-01',
          carrierName: 'Synthetic Operator',
        },
      });
      expect(saved.services[0]!.metadata).toEqual({
        carrierName: 'Synthetic Operator',
      });
      expect(snapshot.selectedTicketOfferIds).toEqual([]);
      expect(reserve).not.toHaveBeenCalled();
    },
  );

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
  it('rejects a floating return paired with a company inventory outbound', () => {
    expect(() =>
      validateSalesContract({
        ...input,
        tripType: 'ROUND_TRIP',
        returnNotBefore: '2026-10-02',
        services: [
          {
            clientKey: 'flight-outbound',
            kind: 'FLIGHT',
            titleSnapshot: 'Out',
            metadata: { direction: 'OUTBOUND' },
          },
          {
            clientKey: 'flight-return',
            kind: 'FLIGHT',
            titleSnapshot: 'Back',
            status: 'NEEDS_RESERVATION_CONFIRMATION',
            metadata: contractFlightMetadata({
              ...flight,
              direction: 'RETURN',
              originId: destinationId,
              destinationId: originId,
              departureAt: '2026-10-02T06:00:00Z',
              arrivalAt: '2026-10-02T08:00:00Z',
            }),
          },
        ],
        ticketSelections: [
          {
            ...flight,
            offerId: 'catalog',
            serviceClientKey: 'flight-outbound',
          },
        ],
      }),
    ).toThrow('برای بلیت رفت از سهمیه شرکت');
  });
  it('persists the service metadata and never writes a ticket selection', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'service' }),
      ticketCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ value: 120123n }]),
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
    expect(tx.salesContract.create.mock.calls[0]![0].data.contractNumber).toBe(
      '120123',
    );
    expect(presentSalesContract(row()).servicesDetail[0]?.metadata).toEqual(
      input.services[0]!.metadata,
    );
  });
  it.each([false, true])(
    'reserves only real catalog selections (mixed=%s) and preserves metadata in the versioned reservation snapshot',
    async (mixed) => {
      const saved = row();
      saved.passengers = [
        {
          id: 'passenger',
          customerId: input.passengers[0]!.customerId,
          displayNameSnapshot: input.passengers[0]!.displayNameSnapshot,
          birthDate: new Date(input.passengers[0]!.birthDate),
          ageCategory: 'ADT',
          accommodationKind: null,
          allocations: [{ service: saved.services[0]! }],
          agreedPrices: [],
        },
      ] as unknown as SalesContractRow['passengers'];
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
      const reserve = vi.fn().mockResolvedValue({
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
      expect(snapshot.passengerAssignments).toEqual([
        expect.objectContaining({
          customerId: input.passengers[0]!.customerId,
          displayNameSnapshot: 'Sample',
        }),
      ]);
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

it('allows a contract creator to submit only their own branch draft without separate confirmation grants', async () => {
  const saved = row();
  const repository = {
    findById: vi.fn().mockResolvedValue(saved),
    transition: vi.fn().mockResolvedValue(true),
  };
  const service = new SalesService(
    repository as unknown as SalesRepository,
    {
      resolveSnapshot: vi.fn(),
      assertPassengers: vi.fn(),
    } as unknown as SalesCustomersPublicAdapter,
    {
      reserve: vi.fn(),
      release: vi.fn(),
    } as unknown as SalesTicketAvailabilityPort,
  );
  const creator = {
    ...actor,
    permissions: ['sales.contracts.create'],
  } as AuthenticatedActor;
  await service.confirm('contract', 1, null, creator, 'entry-submit');
  await expect(service.detail('contract', creator)).resolves.toHaveProperty(
    'data.contractNumber',
    'SAMPLE',
  );
  expect(repository.transition).toHaveBeenCalledOnce();
  await expect(
    service.confirm(
      'contract',
      1,
      null,
      { ...creator, userId: 'other' },
      'other-submit',
    ),
  ).rejects.toThrow();
  await expect(
    service.confirm(
      'contract',
      1,
      null,
      { ...creator, branchIds: ['other'] },
      'wrong-branch',
    ),
  ).rejects.toThrow();
});

it('reserves aggregate historical adults and children per catalog leg and keeps anonymous identities out of the snapshot', async () => {
  const saved = row();
  saved.passengers = [];
  saved.services = [
    {
      ...saved.services[0]!,
      metadata: {
        direction: 'OUTBOUND',
        legacyServicePartiesV2: JSON.stringify({
          'flight-outbound': { adults: 2, children: 1, infants: 1 },
        }),
      },
    },
  ];
  saved.ticketSelections = [
    {
      ...flight,
      departureAt: new Date(flight.departureAt),
      arrivalAt: new Date(flight.arrivalAt),
      offerId: 'catalog',
      serviceId: 'service',
      serviceClientKey: 'flight-outbound',
    },
  ] as unknown as SalesContractRow['ticketSelections'];
  const reserve = vi.fn().mockResolvedValue({
    available: true,
    unavailableOfferIds: [],
    createdAllocationIds: ['allocation'],
  });
  const transition = vi.fn().mockResolvedValue(saved);
  const service = new SalesService(
    {
      findById: vi.fn().mockResolvedValue(saved),
      transition,
    } as unknown as SalesRepository,
    {
      resolveSnapshot: vi.fn(),
      assertPassengers: vi.fn(),
    } as unknown as SalesCustomersPublicAdapter,
    { reserve, release: vi.fn() } as unknown as SalesTicketAvailabilityPort,
  );
  await service.confirm('contract', 1, null, actor, 'legacy-confirm');
  expect(reserve).toHaveBeenCalledWith(
    expect.any(Array),
    'branch',
    'contract',
    3,
    undefined,
    { 'flight-outbound': 3 },
  );
  const snapshot = transition.mock.calls[0]![8];
  expect(presentSalesContract(saved).passengerCount).toBe(4);
  expect(snapshot.passengerIds).toEqual([]);
  expect(snapshot.passengerAssignments).toEqual([]);
  expect(
    snapshot.serviceSelections[0].metadata.legacyServicePartiesV2,
  ).toBeDefined();
  transition.mockClear();
  reserve.mockResolvedValueOnce({
    available: false,
    unavailableOfferIds: ['catalog'],
    createdAllocationIds: [],
  });
  await expect(
    service.confirm('contract', 1, null, actor, 'legacy-full'),
  ).rejects.toThrow('ظرفیت');
  expect(transition).not.toHaveBeenCalled();
});
