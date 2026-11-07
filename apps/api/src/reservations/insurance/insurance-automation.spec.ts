import { expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import type { CustomerInsuranceIdentity } from '../../customers/customer-insurance-identity';
import type { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import type { TravisSandboxService } from '../../integrations/insurance/travis-sandbox.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import { InsuranceAutomation } from './insurance-automation';

function fixture() {
  const contract = {
    id: 'contract',
    ownerUserId: 'owner',
    contractNumber: '120000',
    status: 'SENT_TO_RESERVATIONS',
    originId: 'origin',
    destinationId: 'destination',
    departureDate: new Date('2027-01-01'),
    returnNotBefore: new Date('2027-01-07'),
  };
  const snapshot = {
    passengerIds: ['passenger'],
    passengerAssignments: [
      { customerId: 'passenger', serviceClientKeys: ['insurance'] },
    ],
    serviceSelections: [
      { kind: 'INSURANCE', clientKey: 'insurance', referenceId: 'plan' },
    ],
    ticketSelections: [],
  };
  const intake = {
    id: 'intake',
    branchId: 'branch',
    contractId: 'contract',
    status: 'NEW',
    snapshot,
    contract,
  };
  const row = {
    id: 'policy',
    contractId: 'contract',
    intakeId: 'intake',
    customerId: 'passenger',
    automatic: true,
    sandbox: true,
    status: 'DRAFT',
    automation: { phase: 'QUEUED' },
    providerId: null,
    policyNumber: null,
    pdfUrl: null,
    version: 1,
  } as Record<string, unknown>;
  const policies = {
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { status?: { not?: string }; processingUntil?: Date };
        data: Record<string, unknown>;
      }) => {
        if (
          where.processingUntil &&
          (!(row.processingUntil instanceof Date) ||
            row.processingUntil.getTime() !== where.processingUntil.getTime())
        )
          return { count: 0 };
        if (where.status?.not === 'ISSUED' && row.status === 'ISSUED')
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    ),
    findUniqueOrThrow: vi.fn(async () => ({ ...row })),
    findMany: vi.fn(async () => [{ ...row }]),
    upsert: vi.fn(),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { processingUntil?: Date };
        data: Record<string, unknown> & { version?: { increment: number } };
      }) => {
        if (
          where.processingUntil &&
          (!(row.processingUntil instanceof Date) ||
            row.processingUntil.getTime() !== where.processingUntil.getTime())
        )
          throw new Error('Lease is no longer owned');
        const { version, ...rest } = data;
        Object.assign(row, rest);
        if (version?.increment)
          row.version = Number(row.version) + version.increment;
        return { ...row };
      },
    ),
  };
  const tx = {
    reservationInsurancePolicy: policies,
    reservationInsuranceRevision: { create: vi.fn() },
  };
  const db = {
    client: {
      salesContract: { findFirst: vi.fn(async () => contract) },
      reservationInsurancePolicy: policies,
      reservationIntake: {
        findUnique: vi.fn(async () => intake),
        findFirst: vi.fn(async () => intake),
      },
      masterCity: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === 'origin'
            ? { country: { code: 'IR' } }
            : { countryId: 'turkey' },
        ),
      },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
  };
  const identities = {
    read: vi.fn(async () => ({
      intake,
      snapshot,
      passportNo: 'FAKE123',
      person: {
        nationalCode: 'SYNTHETIC',
        firstName: 'Test',
        mobile: '00000000000',
      },
    })),
  };
  const settings = {
    automationConfig: vi.fn(async () => ({
      countries: [
        {
          countryId: 'turkey',
          providerCountryCode: '5',
          active: true,
          plans: [{ masterPlanId: 'plan', providerPlanCode: '76' }],
        },
      ],
    })),
  };
  const active = {
    providerId: '123',
    active: true,
    policyNumber: 'VERIFIED-NUMBER',
    amount: '399000',
    currencyCode: 'IRR',
    pdfUrl:
      'https://sandbox.travis.ir/Print/PolicyPdf/11111111-1111-4111-8111-111111111111/true',
  };
  const provider = {
    configured: vi.fn(() => true),
    catalog: vi.fn(async () => ({
      countries: [
        { id: 1, standardCode: 'IR' },
        { id: 5, standardCode: 'TR' },
      ],
      plans: [{ id: 76 }],
    })),
    createPolicy: vi.fn(async () => 123),
    confirmPolicy: vi.fn(async () => undefined),
    policy: vi
      .fn()
      .mockResolvedValueOnce({ providerId: '123', active: false })
      .mockResolvedValue(active),
    findCorrelatedPolicy: vi.fn(async () => null),
    policyPdf: vi.fn(async () => Buffer.from('%PDF-synthetic')),
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const service = new InsuranceAutomation(
    db as unknown as DatabaseService,
    identities as unknown as CustomerInsuranceIdentity,
    settings as unknown as InsuranceSettingsService,
    provider as unknown as TravisSandboxService,
    notifications as unknown as NotificationsService,
  );
  const actor = {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: ['reservations.read', 'customers.read'],
  } as unknown as AuthenticatedActor;
  return {
    service,
    db,
    row,
    policies,
    tx,
    intake,
    identities,
    settings,
    provider,
    notifications,
    active,
    actor,
  };
}

it('queues only selected insured passengers and does not contact the provider before processing', async () => {
  const f = fixture();
  await f.service.enqueue('intake');
  expect(f.policies.upsert).toHaveBeenCalledTimes(1);
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  f.intake.snapshot.serviceSelections = [];
  f.policies.upsert.mockClear();
  await f.service.enqueue('intake');
  expect(f.policies.upsert).not.toHaveBeenCalled();
});
it('persists the provider-issued number and PDF and notifies only the contract owner', async () => {
  const f = fixture();
  await f.service.process('policy');
  expect(f.provider.createPolicy).toHaveBeenCalledWith(
    expect.objectContaining({
      contractNo: 'policy',
      destinationCountryId: 5,
      planId: 76,
      durationOfStay: 7,
    }),
  );
  expect(f.row).toMatchObject({
    status: 'ISSUED',
    policyNumber: 'VERIFIED-NUMBER',
    providerId: '123',
    pdfUrl: f.active.pdfUrl,
    sandbox: true,
  });
  expect(f.notifications.createWithinTransaction).toHaveBeenCalledWith(
    f.tx,
    expect.objectContaining({
      recipientUserIds: ['owner'],
      eventType: 'insurance.sandbox.issued',
    }),
  );
  expect(JSON.stringify(f.row)).not.toContain('SYNTHETIC');
});
it('never repeats creation after an ambiguous timeout and reconciles by its exact local correlation', async () => {
  const f = fixture();
  f.provider.createPolicy.mockRejectedValueOnce(new Error('timeout'));
  await f.service.process('policy');
  await f.service.process('policy');
  expect(f.provider.createPolicy).toHaveBeenCalledTimes(1);
  expect(f.provider.findCorrelatedPolicy).toHaveBeenCalledWith(
    'SYNTHETIC',
    76,
    'policy',
  );
  expect(f.row.status).toBe('PROVIDER_ERROR');
  expect(f.row.policyNumber).toBeNull();
});
it('does not repeat confirmation after an uncertain result; a later verified active response completes it', async () => {
  const f = fixture();
  f.provider.confirmPolicy.mockRejectedValueOnce(new Error('timeout'));
  await f.service.process('policy');
  f.provider.policy.mockResolvedValueOnce({ ...f.active, active: false });
  await f.service.process('policy');
  expect(f.provider.confirmPolicy).toHaveBeenCalledTimes(1);
  expect(f.row.status).toBe('PROVIDER_ERROR');
  await f.service.process('policy');
  expect(f.row.status).toBe('ISSUED');
  expect(f.provider.confirmPolicy).toHaveBeenCalledTimes(1);
});
it('stops changed identity inputs after submission and does not issue without a successful claim', async () => {
  const f = fixture();
  f.row.automation = { phase: 'CREATING', fingerprint: 'different' };
  await f.service.process('policy');
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  expect(f.row.lastError).toContain('تغییر');
  f.identities.read.mockClear();
  f.policies.updateMany.mockResolvedValueOnce({ count: 0 });
  await f.service.process('policy');
  expect(f.identities.read).not.toHaveBeenCalled();
});
it('downloads each original PDF independently without a financial gate, enforcing permissions and policy ownership', async () => {
  const f = fixture();
  await f.service.process('policy');
  expect((await f.service.summary('intake', f.actor)).ready).toBe(true);
  await expect(
    f.service.download('intake', { ...f.actor, permissions: [] }, 'policy'),
  ).rejects.toBeInstanceOf(ForbiddenException);
  const one = await f.service.download('intake', f.actor, 'policy');
  expect(one.type).toBe('application/pdf');
  expect(one.bytes.toString()).toBe('%PDF-synthetic');
  await expect(
    f.service.download('intake', f.actor, 'other-policy'),
  ).rejects.toThrow();
  const seller = {
    ...f.actor,
    permissions: ['sales.contracts.read.own'],
  } as AuthenticatedActor;
  expect((await f.service.summary('intake', seller, 'contract')).ready).toBe(
    true,
  );
  await expect(
    f.service.download(
      'intake',
      { ...seller, userId: 'other' },
      'policy',
      'contract',
    ),
  ).rejects.toBeInstanceOf(ForbiddenException);
  f.intake.contract.status = 'CANCELLED';
  await expect(
    f.service.download('intake', f.actor, 'policy'),
  ).rejects.toBeInstanceOf(ForbiddenException);
});

it('does not submit or overwrite state after another worker acquires the lease', async () => {
  const f = fixture();
  const catalog = await f.provider.catalog();
  const newerLease = new Date('2999-01-01');
  f.provider.catalog.mockImplementationOnce(async () => {
    f.row.processingUntil = newerLease;
    return catalog;
  });
  await f.service.process('policy');
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  expect(f.row.status).toBe('DRAFT');
  expect(f.row.processingUntil).toBe(newerLease);
  expect(f.notifications.createWithinTransaction).not.toHaveBeenCalled();
});
