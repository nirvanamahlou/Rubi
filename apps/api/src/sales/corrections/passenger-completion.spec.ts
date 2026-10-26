import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesPassengerCompletionCommandV1,
} from '@nora/contracts';
import { PassengerCompletionService } from './passenger-completion.service';

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
  const customers = { detail: vi.fn().mockResolvedValue({ data: person }) };
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
    if (scenario === 'missing-identity') s.person.passportNumber = '';
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
