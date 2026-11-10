import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import type { CustomerInsuranceIdentity } from '../../customers/customer-insurance-identity';
import type { CustomerService } from '../../customers/customer.service';
import type { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import type { TravelWorkflowService } from '../travel-workflow.service';
import {
  insurancePassengerIds,
  parseInsuranceDraft,
  ReservationInsuranceService,
} from './insurance.service';

function fixture() {
  const customerId = randomUUID(),
    contractId = randomUUID(),
    intakeId = randomUUID(),
    branchId = randomUUID();
  const input = {
    customerId,
    intakeId,
    destinationCode: '90',
    planCode: 'P1',
    departureDate: '2027-02-20',
    durationDays: 8,
    notes: '',
    expectedVersion: 0,
  };
  const actor = {
    userId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'reservations.read',
      'customers.read',
      'reservations.documents.manage',
    ],
  } as AuthenticatedActor;
  const snapshot = {
    contractId,
    passengerIds: [customerId],
    serviceSelections: [{ kind: 'INSURANCE', clientKey: 'insurance' }],
    passengerAssignments: [{ customerId, serviceClientKeys: ['insurance'] }],
  } as unknown as SalesReservationRequestV1;
  const row = {
    id: randomUUID(),
    contractId,
    customerId,
    intakeId,
    provider: 'NOYAN',
    providerId: null,
    policyNumber: null,
    status: 'DRAFT',
    version: 1,
    destinationCode: '90',
    planCode: 'P1',
    departureDate: new Date('2027-02-20Z'),
    durationDays: 8,
    notes: '',
    amount: null,
    currencyCode: null,
    issuedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-10-25T00:00:00Z'),
    updatedAt: new Date(),
  };
  const policies = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(row),
    findUnique: vi.fn().mockResolvedValue(null),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    create: vi
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ ...row, ...data })),
    update: vi
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ ...row, ...data })),
  };
  const tx = {
    reservationInsurancePolicy: policies,
    reservationInsuranceRevision: { create: vi.fn() },
    $queryRaw: vi.fn(),
  };
  const db = {
    client: {
      ...tx,
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    },
  };
  const customers = {
    detail: vi
      .fn()
      .mockResolvedValue({ data: { displayName: 'Synthetic Passenger' } }),
  };
  const workflow = {
    detail: vi
      .fn()
      .mockResolvedValue({ id: intakeId, contractId, branchId, snapshot }),
  };
  const settings = {
    issuanceCatalog: vi
      .fn()
      .mockResolvedValue({ durations: [{ days: 7 }, { days: 8 }] }),
    read: vi.fn().mockResolvedValue({
      config: {
        countries: [
          {
            active: true,
            providerCountryCode: '90',
            plans: [{ providerPlanCode: 'P1' }],
          },
        ],
      },
    }),
  };
  const identities = { correction: vi.fn(), saveCorrection: vi.fn() };
  const service = new ReservationInsuranceService(
    db as unknown as DatabaseService,
    workflow as unknown as TravelWorkflowService,
    customers as unknown as CustomerService,
    settings as unknown as InsuranceSettingsService,
    identities as unknown as CustomerInsuranceIdentity,
  );
  return {
    input,
    actor,
    row,
    tx,
    policies,
    service,
    snapshot,
    customers,
    workflow,
    settings,
    identities,
    branchId,
  };
}
describe('passenger insurance ownership and lifecycle', () => {
  it('only queues passengers actually assigned the insurance service', () => {
    const f = fixture();
    expect(insurancePassengerIds(f.snapshot)).toEqual([f.input.customerId]);
    expect(
      insurancePassengerIds({ ...f.snapshot, passengerAssignments: [] }),
    ).toEqual([]);
    expect(insurancePassengerIds({ ...f.snapshot, passengerIds: [] })).toEqual(
      [],
    );
    expect(
      insurancePassengerIds({ ...f.snapshot, serviceSelections: [] }),
    ).toEqual([]);
  });
  it.each(['2027-02-30', '2027-13-01', '2027-00-20'])(
    'rejects impossible date %s',
    (departureDate) => {
      expect(() =>
        parseInsuranceDraft({ ...fixture().input, departureDate }),
      ).toThrow();
    },
  );
  it('does not accept an issued number or status from draft input', () => {
    expect(() =>
      parseInsuranceDraft({ ...fixture().input, policyNumber: 'FAKE' }),
    ).toThrow();
    expect(() =>
      parseInsuranceDraft({ ...fixture().input, status: 'ISSUED' }),
    ).toThrow();
  });
  it('saves a versioned draft without policy number, premium or issue date', async () => {
    const f = fixture();
    const result = await f.service.saveDraft(f.input, f.actor);
    expect(result.data).toMatchObject({
      policyNumber: null,
      amount: null,
      issuedAt: null,
      status: 'DRAFT',
      version: 1,
    });
    expect(f.tx.reservationInsuranceRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DRAFT_SAVED',
          actorUserId: f.actor.userId,
        }),
      }),
    );
  });
  it('rejects stale edits and changes to already issued policies', async () => {
    const f = fixture();
    f.policies.findUnique.mockResolvedValue(f.row);
    await expect(f.service.saveDraft(f.input, f.actor)).rejects.toThrow();
    f.policies.findUnique.mockResolvedValue({ ...f.row, status: 'ISSUED' });
    await expect(
      f.service.saveDraft({ ...f.input, expectedVersion: 1 }, f.actor),
    ).rejects.toThrow();
    expect(f.policies.update).not.toHaveBeenCalled();
  });
  it('rejects unsupported duration or unavailable catalogue before a policy/identity write', async () => {
    const f = fixture();
    await expect(
      f.service.saveDraft({ ...f.input, durationDays: 1 }, f.actor),
    ).rejects.toThrow('مدت بیمه');
    expect(f.identities.saveCorrection).not.toHaveBeenCalled();
    expect(f.policies.create).not.toHaveBeenCalled();
    f.settings.issuanceCatalog.mockRejectedValueOnce(
      new Error('catalogue unavailable'),
    );
    await expect(f.service.saveDraft(f.input, f.actor)).rejects.toThrow(
      'catalogue unavailable',
    );
    expect(f.policies.create).not.toHaveBeenCalled();
  });
  it('rejects missing entitlement, unauthorized identity and inactive mapping', async () => {
    const f = fixture();
    f.settings.read.mockResolvedValue({ config: { countries: [] } });
    await expect(f.service.saveDraft(f.input, f.actor)).rejects.toThrow();
    f.customers.detail.mockRejectedValue(new Error('forbidden'));
    await expect(f.service.saveDraft(f.input, f.actor)).rejects.toThrow(
      'forbidden',
    );
    f.snapshot.passengerIds = [];
    await expect(f.service.saveDraft(f.input, f.actor)).rejects.toThrow();
    expect(f.policies.create).not.toHaveBeenCalled();
  });
  it('reads numbers by contract, passenger, issued state and branch', async () => {
    const f = fixture();
    f.policies.findMany.mockResolvedValue([
      { customerId: f.input.customerId, policyNumber: 'TEST-ISSUED' },
    ]);
    expect(
      await f.service.issuedNumbers(
        f.row.contractId,
        [f.input.customerId],
        f.actor,
      ),
    ).toEqual(new Map([[f.input.customerId, 'TEST-ISSUED']]));
    expect(f.policies.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contractId: f.row.contractId,
          customerId: { in: [f.input.customerId] },
          status: 'ISSUED',
          intake: { branchId: { in: [f.branchId] } },
        },
      }),
    );
  });
  it('does not treat a temporary provider ID as a confirmed policy', async () => {
    const f = fixture();
    await expect(
      f.service.recordProviderConfirmation(
        f.row.id,
        1,
        { providerId: 'temporary' },
        f.actor,
      ),
    ).rejects.toThrow();
    expect(f.policies.update).not.toHaveBeenCalled();
  });
  it('records exact confirmed money and supports identical callback replay', async () => {
    const f = fixture();
    const reply = {
      providerId: 'test-provider-id',
      policyNumber: 'test-number',
      amount: '123456789012345.1234',
      currencyCode: 'IRR',
      issuedAt: '2026-10-25T10:00:00Z',
    };
    const saved = await f.service.recordProviderConfirmation(
      f.row.id,
      1,
      reply,
      f.actor,
    );
    expect(saved).toMatchObject({
      policyNumber: reply.policyNumber,
      amount: reply.amount,
      status: 'ISSUED',
      version: 2,
    });
    f.policies.findUniqueOrThrow.mockResolvedValue({
      ...f.row,
      ...reply,
      issuedAt: new Date(reply.issuedAt),
      amount: new Prisma.Decimal(reply.amount),
      status: 'ISSUED',
      version: 2,
    });
    await f.service.recordProviderConfirmation(f.row.id, 1, reply, f.actor);
    expect(f.policies.update).toHaveBeenCalledTimes(1);
    await expect(
      f.service.recordProviderConfirmation(
        f.row.id,
        1,
        { ...reply, policyNumber: 'conflict' },
        f.actor,
      ),
    ).rejects.toThrow();
  });
  it('denies reads and writes without the reservation/customer grants', async () => {
    const f = fixture(),
      actor = { ...f.actor, permissions: [] } as AuthenticatedActor;
    await expect(f.service.list({}, actor)).rejects.toThrow();
    await expect(f.service.saveDraft(f.input, actor)).rejects.toThrow();
    expect(f.policies.create).not.toHaveBeenCalled();
  });
});

const passenger = {
  version: 1,
  firstName: 'Test',
  lastName: 'Passenger',
  firstNameLatin: 'TEST',
  lastNameLatin: 'PASSENGER',
  nationalityCode: 'IRN',
  nationalCode: '0013547890',
  passportNo: 'A12345678',
  birthDate: '1990-01-01',
  gender: 'M' as const,
  mobile: '09123456789',
  email: 'test@example.invalid',
};
it('opens correction for an authorized scoped policy and denies unauthorized or issued records', async () => {
  const f = fixture();
  f.identities.correction.mockResolvedValue(passenger);
  await expect(f.service.correction(f.row.id, f.actor)).resolves.toEqual({
    data: passenger,
  });
  expect(f.policies.findFirst).toHaveBeenCalledWith({
    where: { id: f.row.id, intake: { branchId: { in: [f.branchId] } } },
  });
  await expect(
    f.service.correction(f.row.id, { ...f.actor, permissions: [] }),
  ).rejects.toThrow();
  f.policies.findFirst.mockResolvedValue({ ...f.row, status: 'ISSUED' });
  await expect(f.service.correction(f.row.id, f.actor)).rejects.toThrow();
});
it('corrects incomplete automatic requests transactionally and queues the saved trip for retry', async () => {
  const f = fixture();
  f.policies.findUnique.mockResolvedValue({
    ...f.row,
    automatic: true,
    status: 'INPUT_ERROR',
    automation: { phase: 'QUEUED' },
  } as never);
  const result = await f.service.saveDraft(
    { ...f.input, expectedVersion: 1, passenger },
    f.actor,
  );
  expect(f.identities.saveCorrection).toHaveBeenCalledWith(
    f.tx,
    f.input.customerId,
    passenger,
    f.actor,
    f.branchId,
  );
  expect(result.data.status).toBe('DRAFT');
  expect(f.policies.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        automation: { phase: 'QUEUED', useDraft: true },
        lastError: null,
        version: 2,
      }),
    }),
  );
});
it.each([
  { phase: 'CREATING' },
  { phase: 'CREATED' },
  { phase: 'QUEUED', fingerprint: 'sent' },
])(
  'does not reset an already submitted provider attempt: %j',
  async (automation) => {
    const f = fixture();
    f.policies.findUnique.mockResolvedValue({
      ...f.row,
      automatic: true,
      automation,
    } as never);
    await expect(
      f.service.saveDraft(
        { ...f.input, expectedVersion: 1, passenger },
        f.actor,
      ),
    ).rejects.toThrow();
    expect(f.identities.saveCorrection).not.toHaveBeenCalled();
  },
);
it.each([
  { mobile: '123' },
  { email: 'bad' },
  { birthDate: '2026-02-30' },
  { nationalCode: '123' },
  { gender: 'X' },
  { firstNameLatin: 'علی' },
  { passportNo: 'bad space' },
])('validates insurance correction formats: %j', (patch) => {
  expect(() =>
    parseInsuranceDraft({
      ...fixture().input,
      passenger: { ...passenger, ...patch },
    }),
  ).toThrow();
});

it('identifies the invalid insurance field without echoing its private value', () => {
  const invalidEmail = 'synthetic-invalid-email';
  try {
    parseInsuranceDraft({
      ...fixture().input,
      passenger: { ...passenger, email: invalidEmail },
    });
    throw new Error('Expected input rejection');
  } catch (error) {
    expect((error as Error).message).toContain('ایمیل بیمه‌شده');
    expect((error as Error).message).not.toContain(invalidEmail);
  }
});
