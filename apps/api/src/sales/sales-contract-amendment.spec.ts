import { describe, it, expect, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesContractAmendmentV1,
} from '@nora/contracts';
import { SalesService } from './sales.service';
const id = '10000000-0000-4000-8000-000000000001',
  person = '10000000-0000-4000-8000-000000000002';
const input: SalesContractAmendmentV1 = {
  version: 2,
  reason: 'Synthetic amendment',
  customerId: id,
  payerCustomerId: id,
  tripType: 'ONE_WAY',
  originId: '10000000-0000-4000-8000-000000000003',
  destinationId: '10000000-0000-4000-8000-000000000004',
  departureDate: '2099-01-01',
  services: [
    {
      clientKey: 'other',
      kind: 'OTHER',
      titleSnapshot: 'Synthetic',
      status: 'SELECTED',
      metadata: { passengerPackagePricingVersion: 1 },
    },
  ],
  passengers: [
    {
      customerId: person,
      displayNameSnapshot: 'Synthetic passenger',
      birthDate: '1990-01-01',
      serviceClientKeys: ['other'],
      agreedPrices: [{ amount: '100', currencyCode: 'USD' }],
    },
  ],
  priceComponents: [
    { type: 'BASE', title: 'Synthetic', amount: '100', currencyCode: 'USD' },
  ],
  passengerCategories: { [person]: 'ADT' },
  ticketSelections: [],
  hotelSelection: null,
};
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: [
    'sales.contracts.read.branch',
    'sales.contracts.update.branch',
    'sales.contracts.confirm',
    'sales.reservation_request.create',
  ],
} as unknown as AuthenticatedActor;
function setup() {
  const row = {
    id,
    version: 2,
    contractNumber: 'SYNTH-1',
    customerId: id,
    payerCustomerId: id,
    customerNameSnapshot: 'Synthetic',
    branchId: 'branch',
    ownerUserId: 'owner',
    assignedUserId: null,
    status: 'SENT_TO_RESERVATIONS',
    reservationStatus: 'ACCEPTED',
    tripType: 'ONE_WAY',
    originId: input.originId,
    destinationId: input.destinationId,
    departureDate: new Date('2099-01-01'),
    returnNotBefore: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    buyerContact: null,
    paymentTerms: null,
    services: input.services.map((s) => ({ ...s, id: 'service' })),
    passengers: input.passengers.map((p) => ({
      ...p,
      id: 'passenger',
      birthDate: new Date(p.birthDate),
      ageCategory: 'ADT',
      agreedPrices: p.agreedPrices,
      allocations: [{ service: { clientKey: 'other' } }],
    })),
    priceComponents: input.priceComponents,
    payments: [
      {
        id: 'receipt',
        amount: '50',
        currencyCode: 'USD',
        status: 'FINANCE_CONFIRMED',
        dueAt: new Date(),
        method: 'CASH',
        createdAt: new Date(),
      },
    ],
    ticketSelections: [],
    hotelSelection: null,
    reservationRequests: [],
  };
  const repo = {
    findById: vi.fn(async () => row),
    updateDraft: vi.fn(async (...args: unknown[]) => {
      void args;
      return true;
    }),
  };
  const tickets = { amend: vi.fn() };
  const service = new SalesService(
    repo as never,
    {
      resolveSnapshot: vi.fn(async () => ({ id, displayName: 'Synthetic' })),
      assertPassengers: vi.fn(),
    } as never,
    tickets as never,
  );
  return { row, repo, service, tickets };
}
describe('canonical Sales amendment', () => {
  it('publishes a new operational version for a band-only change and preserves it for older clients omitting the field', async () => {
    const { row, service, repo } = setup();
    Object.assign(row.passengers[0]!, {
      ageCategory: 'CHD',
      childAgeBand: 'AGE_2_6',
    });
    const categories = { [person]: 'CHD' as const };
    const next = {
      ...input,
      passengerCategories: categories,
      passengers: input.passengers.map((p) => ({
        ...p,
        childAgeBand: 'AGE_6_12' as const,
      })),
    };
    await service.update(id, next, actor, undefined, categories);
    expect(
      (repo.updateDraft.mock.calls[0]?.[5] as { snapshot: unknown }).snapshot,
    ).toBeDefined();
    repo.updateDraft.mockClear();
    await service.update(id, input, actor, undefined, categories);
    const saved = repo.updateDraft.mock
      .calls[0]?.[1] as SalesContractAmendmentV1;
    expect(saved.passengers[0]?.childAgeBand).toBe('AGE_2_6');
    expect(
      (repo.updateDraft.mock.calls[0]?.[5] as { snapshot: unknown }).snapshot,
    ).toBeUndefined();
  });
  it('persists and republishes a child-band correction with unchanged identity and transactional capacity', async () => {
    const { service, repo, tickets } = setup();
    const categories = { [person]: 'CHD' as const };
    const next = {
      ...input,
      passengerCategories: categories,
      passengers: input.passengers.map((p) => ({
        ...p,
        childAgeBand: 'AGE_6_12' as const,
      })),
    };
    await service.update(id, next, actor, undefined, categories);
    const saved = repo.updateDraft.mock
      .calls[0]?.[1] as SalesContractAmendmentV1;
    expect(saved.passengers[0]).toMatchObject({
      birthDate: '1990-01-01',
      childAgeBand: 'AGE_6_12',
    });
    const options = repo.updateDraft.mock.calls[0]?.[5] as {
      snapshot: { passengerAssignments: { childAgeBand: string }[] };
      reserve: (tx: unknown) => Promise<void>;
    };
    expect(options.snapshot.passengerAssignments[0]?.childAgeBand).toBe(
      'AGE_6_12',
    );
    await options.reserve({});
    expect(tickets.amend).toHaveBeenCalledWith({}, [], 'branch', id, 1);
  });
  it('changes exact sale amounts while retaining payment evidence and operational state', async () => {
    const { service, repo } = setup();
    const next = {
      ...input,
      passengers: input.passengers.map((p) => ({
        ...p,
        agreedPrices: [{ amount: '120', currencyCode: 'USD' }],
      })),
      priceComponents: [{ ...input.priceComponents[0]!, amount: '120' }],
    };
    await service.update(id, next, actor, undefined, next.passengerCategories);
    const options = repo.updateDraft.mock.calls[0]?.[5] as {
      snapshot: unknown;
    };
    expect(options.snapshot).toBeUndefined();
    expect(repo.updateDraft.mock.calls[0]?.[1]).not.toHaveProperty('payments');
  });
  it('publishes corrected age categories and applies capacity on the repository transaction', async () => {
    const { service, repo, tickets } = setup();
    const categories = { [person]: 'CHD' as const };
    await service.update(id, input, actor, undefined, categories);
    const options = repo.updateDraft.mock.calls[0]?.[5] as {
      snapshot: { passengerAssignments: { ageCategory: string }[] };
      reserve: (t: unknown) => Promise<void>;
    };
    expect(options.snapshot.passengerAssignments[0]?.ageCategory).toBe('CHD');
    const tx = {};
    await options.reserve(tx);
    expect(tickets.amend).toHaveBeenCalledWith(tx, [], 'branch', id, 1);
  });
  it('cannot change a buyer through the inventory amendment endpoint', async () => {
    const { service, repo } = setup();
    await expect(
      service.update(
        id,
        { ...input, customerId: person },
        actor,
        undefined,
        input.passengerCategories,
      ),
    ).rejects.toThrow('طرف قرارداد');
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });
  it('cannot rewrite passenger identity through age correction', async () => {
    const { service, repo } = setup();
    await expect(
      service.update(
        id,
        {
          ...input,
          passengers: input.passengers.map((p) => ({
            ...p,
            birthDate: '2001-01-01',
          })),
        },
        actor,
        undefined,
        input.passengerCategories,
      ),
    ).rejects.toThrow('هویتی');
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });
  it('requires confirmation permission for an issued contract amendment', async () => {
    const { service, repo } = setup();
    await expect(
      service.update(
        id,
        input,
        { ...actor, permissions: ['sales.contracts.update.branch'] },
        undefined,
        input.passengerCategories,
      ),
    ).rejects.toThrow('مجوز');
    expect(repo.updateDraft).not.toHaveBeenCalled();
  });
});
