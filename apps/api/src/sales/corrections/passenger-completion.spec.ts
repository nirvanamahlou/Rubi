import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesPassengerCompletionCommandV1,
} from '@nora/contracts';
import { PassengerCompletionService } from './passenger-completion.service';
import { CustomerService } from '../../customers/customer.service';

const id = '10000000-0000-4000-8000-000000000001';
const customerId = '20000000-0000-4000-8000-000000000001';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
function setup() {
  const party = { adults: 1, children: 0, infants: 0 };
  const row = {
    id,
    version: 3,
    status: 'SENT_TO_RESERVATIONS',
    branchId: 'branch',
    contractNumber: 'TEST-ONLY',
    departureDate: new Date('2027-01-01'),
    passengers: [],
    ticketSelections: [],
    hotelSelection: null,
    services: [
      {
        id: 'return',
        clientKey: 'back',
        kind: 'FLIGHT',
        titleSnapshot: 'Return',
        metadata: {},
      },
      {
        id: 'outbound',
        clientKey: 'out',
        kind: 'FLIGHT',
        titleSnapshot: 'Outbound',
        metadata: {
          legacyServicePartiesV2: JSON.stringify({ out: party, back: party }),
        },
      },
    ],
  };
  const person = {
    kind: 'person',
    status: 'active',
    birthDate: '1990-01-01',
    passportFirstName: 'SYNTHETIC',
    passportLastName: 'TEST',
    passportNumber: 'TEST12345',
    passportExpiryDate: '2030-01-01',
    gender: 'M',
    nationalityCode: 'IRN',
    passportIssuingCountryCode: 'IRN',
    birthCountryCode: 'IRN',
  };
  const tx = {
    salesContract: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    salesContractPassenger: { create: vi.fn().mockResolvedValue({}) },
    salesContractService: { update: vi.fn().mockResolvedValue({}) },
    salesContractAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const client = {
    salesContract: { findUniqueOrThrow: vi.fn().mockResolvedValue(row) },
    salesContractAuditEvent: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (fn: (arg: typeof tx) => unknown) => fn(tx)),
  };
  const access = { contract: vi.fn().mockResolvedValue(row) };
  const customers = {
    salesEntryActor: vi.fn(CustomerService.prototype.salesEntryActor),
    detail: vi.fn().mockResolvedValue({ data: person }),
    createForSalesCompletion: vi.fn().mockResolvedValue({ data: person }),
  };
  const notifications = {
    createWithinTransaction: vi.fn().mockResolvedValue({}),
  };
  const service = new PassengerCompletionService(
    { client } as never,
    access as never,
    customers as never,
    { recipients: vi.fn().mockResolvedValue(['reservation-user']) } as never,
    notifications as never,
  );
  const input: SalesPassengerCompletionCommandV1 = {
    operationId: '30000000-0000-4000-8000-000000000001',
    expectedVersion: 3,
    passengers: [{ customerId, serviceClientKeys: ['out', 'back'] }],
  };
  return {
    service,
    row,
    person,
    tx,
    client,
    access,
    customers,
    notifications,
    input,
  };
}
describe('completing booked aggregate passenger slots', () => {
  it('lets contract creators complete passenger identity without a global sensitive-customer grant', async () => {
    const s = setup();
    const creator = {
      ...actor,
      permissions: ['sales.contracts.create'],
    } as AuthenticatedActor;
    await expect(s.service.save(id, s.input, creator)).resolves.toHaveProperty(
      'version',
      4,
    );
    expect(s.customers.detail).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({
        permissions: expect.arrayContaining(['customers.sensitive.read']),
      }),
      undefined,
      'customer-verification',
    );
    expect(creator.permissions).toEqual(['sales.contracts.create']);
    const denied = setup();
    denied.access.contract.mockRejectedValue(new Error('outside contract'));
    await expect(
      denied.service.save(id, denied.input, creator),
    ).rejects.toThrow('outside contract');
    expect(denied.customers.detail).not.toHaveBeenCalled();
  });
  it('reads original counts independently of database service order', async () => {
    const s = setup();
    expect(await s.service.form(id, actor)).toMatchObject({
      available: true,
      version: 3,
      services: [
        { key: 'out', party: { adults: 1 } },
        { key: 'back', party: { adults: 1 } },
      ],
    });
  });
  it('creates real membership and both allocations without changing prices or reserving inventory', async () => {
    const s = setup();
    await expect(s.service.save(id, s.input, actor)).resolves.toEqual({
      version: 4,
    });
    expect(s.tx.salesContract.updateMany).toHaveBeenCalledWith({
      where: { id, version: 3, status: 'SENT_TO_RESERVATIONS' },
      data: { version: { increment: 1 } },
    });
    expect(s.tx.salesContractPassenger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId,
        ageCategory: 'ADT',
        allocations: {
          create: [{ serviceId: 'return' }, { serviceId: 'outbound' }],
        },
      }),
    });
    const marked = s.tx.salesContractService.update.mock.calls.find(
      ([arg]) => arg.where.id === 'outbound',
    )![0];
    expect(marked.data.metadata.legacyServicePartiesV2).toBeUndefined();
    expect(marked.data.metadata.completedLegacyServicePartiesV2).toBeDefined();
    expect(s.notifications.createWithinTransaction).toHaveBeenCalledOnce();
  });
  it.each([
    'wrong-age',
    'missing-return',
    'foreign-service',
    'missing-identity',
    'duplicate',
  ])('rejects %s before any contract write', async (scenario) => {
    const s = setup();
    if (scenario === 'wrong-age') s.person.birthDate = '2020-01-01';
    if (scenario === 'missing-return')
      s.input.passengers[0]!.serviceClientKeys = ['out'];
    if (scenario === 'foreign-service')
      s.input.passengers[0]!.serviceClientKeys.push('foreign');
    if (scenario === 'missing-identity') s.person.passportFirstName = '';
    if (scenario === 'duplicate')
      s.input.passengers.push(s.input.passengers[0]!);
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow();
    expect(s.client.$transaction).not.toHaveBeenCalled();
  });
  it('retains version guard after an authorized read', async () => {
    const s = setup();
    s.tx.salesContract.updateMany.mockResolvedValue({ count: 0 });
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow('هم‌زمان');
    expect(s.tx.salesContractPassenger.create).not.toHaveBeenCalled();
  });
  it.each(['ADT', 'CHD', 'INF'] as const)(
    'completes a name-only %s without fabricating a birth date',
    async (category) => {
      const s = setup();
      for (const key of Object.keys(s.person))
        if (
          !['kind', 'status', 'passportFirstName', 'passportLastName'].includes(
            key,
          )
        )
          (s.person as Record<string, string>)[key] = '';
      const party = {
        adults: category === 'ADT' || category === 'INF' ? 1 : 0,
        children: category === 'CHD' ? 1 : 0,
        infants: category === 'INF' ? 1 : 0,
      };
      s.row.services[1]!.metadata = {
        legacyServicePartiesV2: JSON.stringify({ out: party, back: party }),
      };
      s.input.passengers[0]!.ageCategory = category;
      if (category === 'INF') {
        s.customers.detail.mockResolvedValueOnce({
          data: { ...s.person, birthDate: '1990-01-01' },
        });
        s.input.passengers.unshift({
          customerId: '20000000-0000-4000-8000-000000000000',
          ageCategory: 'ADT',
          serviceClientKeys: ['out', 'back'],
        });
      }
      await expect(s.service.save(id, s.input, actor)).resolves.toEqual({
        version: 4,
      });
      expect(s.tx.salesContractPassenger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          birthDate: null,
          ageCategory: category,
          displayNameSnapshot: 'SYNTHETIC TEST',
        }),
      });
    },
  );
  it('requires an explicit booked category when birth date is absent', async () => {
    const s = setup();
    s.person.birthDate = '';
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow();
    expect(s.client.$transaction).not.toHaveBeenCalled();
  });
  it('persists two historical names and their booked service assignments with every optional identity field absent', async () => {
    const s = setup();
    s.row.services[1]!.metadata = {
      legacyServicePartiesV2: JSON.stringify({
        out: { adults: 1, children: 1, infants: 0 },
        back: { adults: 1, children: 1, infants: 0 },
      }),
    };
    const secondId = '20000000-0000-4000-8000-000000000002';
    s.customers.detail.mockImplementation(
      async (personId) =>
        ({
          data: {
            kind: 'person',
            status: 'active',
            birthDate: null,
            firstName: personId === customerId ? 'First' : 'Second',
            lastName: 'Traveler',
          },
        }) as never,
    );
    s.input.passengers = [
      { customerId, ageCategory: 'ADT', serviceClientKeys: ['out', 'back'] },
      {
        customerId: secondId,
        ageCategory: 'CHD',
        serviceClientKeys: ['out', 'back'],
      },
    ];
    await expect(s.service.save(id, s.input, actor)).resolves.toEqual({
      version: 4,
    });
    expect(s.tx.salesContractPassenger.create).toHaveBeenCalledTimes(2);
    for (const [personId, displayNameSnapshot, ageCategory] of [
      [customerId, 'First Traveler', 'ADT'],
      [secondId, 'Second Traveler', 'CHD'],
    ])
      expect(s.tx.salesContractPassenger.create).toHaveBeenCalledWith({
        data: {
          contractId: id,
          customerId: personId,
          displayNameSnapshot,
          ageCategory,
          birthDate: null,
          allocations: {
            create: [{ serviceId: 'return' }, { serviceId: 'outbound' }],
          },
        },
      });
    expect(s.notifications.createWithinTransaction).toHaveBeenCalledOnce();
  });
  it('does not allow an explicit category to override a known birth date', async () => {
    const s = setup();
    s.input.passengers[0]!.ageCategory = 'INF';
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow();
    expect(s.client.$transaction).not.toHaveBeenCalled();
  });
  it('authorizes name-only profile creation against the historical contract before calling Customer', async () => {
    const s = setup();
    const input = {
      kind: 'person' as const,
      firstName: 'Synthetic',
      lastName: 'Name',
      displayName: 'Synthetic Name',
      roles: ['passenger' as const],
    };
    await s.service.createPerson(id, input, actor);
    expect(s.customers.createForSalesCompletion).toHaveBeenCalledWith(
      input,
      actor,
    );
    s.access.contract.mockRejectedValue(Error('forbidden'));
    await expect(s.service.createPerson(id, input, actor)).rejects.toThrow(
      'forbidden',
    );
    expect(s.customers.createForSalesCompletion).toHaveBeenCalledOnce();
  });
  it('permits scoped profile creation for an amendment with existing passengers without relaxing completion membership guards', async () => {
    const s = setup();
    s.client.salesContract.findUniqueOrThrow.mockResolvedValue({
      ...s.row,
      passengers: [{ customerId }],
      services: s.row.services.map((service) => ({ ...service, metadata: {} })),
    });
    const input = {
      kind: 'person' as const,
      firstName: 'Synthetic',
      lastName: 'Added',
      displayName: 'Synthetic Added',
      roles: ['passenger' as const],
    };
    await s.service.createPerson(id, input, actor);
    expect(s.access.contract).toHaveBeenCalledWith(id, actor, true);
    expect(s.customers.createForSalesCompletion).toHaveBeenCalledWith(
      input,
      actor,
    );
    expect((await s.service.form(id, actor)).available).toBe(false);
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow();
    expect(s.client.$transaction).not.toHaveBeenCalled();
  });
  it('does not create an amendment passenger for a cancelled contract', async () => {
    const s = setup();
    s.row.status = 'CANCELLED';
    await expect(
      s.service.createPerson(
        id,
        {
          kind: 'person',
          firstName: 'Synthetic',
          lastName: 'Added',
          displayName: 'Synthetic Added',
          roles: ['passenger'],
        },
        actor,
      ),
    ).rejects.toThrow('تأییدشده');
    expect(s.customers.createForSalesCompletion).not.toHaveBeenCalled();
  });
  it('replays a committed operation even after membership exists and JSONB reorders keys', async () => {
    const s = setup();
    s.client.salesContractAuditEvent.findUnique.mockResolvedValue({
      id: s.input.operationId,
      actorUserId: actor.userId,
      contractId: id,
      action: 'SALES_PASSENGER_COMPLETION',
      afterSnapshot: {
        version: 4,
        command: {
          passengers: [{ serviceClientKeys: ['back', 'out'], customerId }],
          expectedVersion: 3,
          operationId: s.input.operationId,
        },
      },
    });
    await expect(s.service.save(id, s.input, actor)).resolves.toEqual({
      version: 4,
    });
    expect(s.customers.detail).not.toHaveBeenCalled();
    expect(s.client.$transaction).not.toHaveBeenCalled();
  });
  it('uses the existing scoped authorization before revealing or attaching passengers', async () => {
    const s = setup();
    s.access.contract.mockRejectedValue(Error('forbidden'));
    await expect(s.service.form(id, actor)).rejects.toThrow('forbidden');
    await expect(s.service.save(id, s.input, actor)).rejects.toThrow(
      'forbidden',
    );
    expect(s.client.salesContract.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
