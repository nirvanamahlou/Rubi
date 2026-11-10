import { expect, it, vi } from 'vitest';
import { ForbiddenException, Logger } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import type { CustomerInsuranceIdentity } from '../../customers/customer-insurance-identity';
import type { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import {
  TravisDiagnosticError,
  type TravisSandboxService,
} from '../../integrations/insurance/travis-sandbox.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import { InsuranceAutomation } from './insurance-automation';
import type { SalesOperationalAmendmentService } from '../../sales/sales-operational-amendment.module';
import type { InsuranceApplicantCrypto } from './insurance-applicant.crypto';

it('uses current insurance allocations and shows a reason for every missing policy without issuing on a read', async () => {
  const f = fixture();
  const current = structuredClone(f.intake.snapshot);
  f.intake.snapshot.serviceSelections = [];
  f.sales.currentExecution.mockResolvedValue(current);
  f.policies.findMany.mockResolvedValue([]);
  const result = await f.service.summary('intake', f.actor);
  expect(result.total).toBe(1);
  expect(result.policies).toEqual([
    expect.objectContaining({
      customerId: 'passenger',
      id: null,
      ready: false,
      status: 'PENDING',
      error: expect.any(String),
    }),
  ]);
  expect(f.policies.upsert).not.toHaveBeenCalled();
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  await expect(f.service.prepare('intake', f.actor)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  await f.service.prepare('intake', {
    ...f.actor,
    permissions: [...f.actor.permissions, 'reservations.documents.manage'],
  });
  expect(f.policies.upsert).toHaveBeenCalledTimes(1);
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  current.passengerAssignments[0]!.serviceClientKeys = [];
  expect(await f.service.summary('intake', f.actor)).toMatchObject({
    total: 0,
    selected: true,
  });
});

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
      reservationInsuranceApplicant: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'applicant',
          branchId: 'branch',
          createdByUserId: 'standalone-owner',
          sourceCountryCode: '1',
          encryptedData: 'synthetic-envelope',
        })),
      },
      reservationInsuranceApplicantAccess: { create: vi.fn() },
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
      durations: [{ days: 2 }, { days: 7 }, { days: 12 }],
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
  const applicantCrypto = {
    open: vi.fn(() => ({
      nationalityCode: 'TUR',
      nationalCode: '',
      passportNo: 'SYNTHETIC123',
      firstName: 'Synthetic',
      lastName: 'Applicant',
      firstNameLatin: 'SYNTHETIC',
      lastNameLatin: 'APPLICANT',
      gender: 'F',
      birthDate: '1990-01-01',
      mobile: '00000000000',
      email: 'synthetic@example.invalid',
    })),
  };
  const sales = { currentExecution: vi.fn(async () => intake.snapshot) };
  const service = new InsuranceAutomation(
    db as unknown as DatabaseService,
    identities as unknown as CustomerInsuranceIdentity,
    settings as unknown as InsuranceSettingsService,
    provider as unknown as TravisSandboxService,
    notifications as unknown as NotificationsService,
    sales as unknown as SalesOperationalAmendmentService,
    applicantCrypto as unknown as InsuranceApplicantCrypto,
  );
  const actor = {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: ['reservations.read', 'customers.read'],
  } as unknown as AuthenticatedActor;
  return {
    service,
    sales,
    db,
    row,
    policies,
    tx,
    intake,
    identities,
    settings,
    provider,
    notifications,
    applicantCrypto,
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

it('starts a committed correction without waiting for the periodic timer and safely defers a failed kick', async () => {
  const f = fixture();
  const process = vi
    .spyOn(f.service, 'process')
    .mockResolvedValueOnce(undefined);
  f.service.requestImmediate('policy');
  expect(process).toHaveBeenCalledExactlyOnceWith('policy');
  f.provider.configured.mockReturnValueOnce(false);
  f.service.requestImmediate('policy');
  expect(process).toHaveBeenCalledTimes(1);
  const warning = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
  process.mockRejectedValueOnce(new Error('synthetic queue unavailable'));
  f.service.requestImmediate('policy');
  await Promise.resolve();
  expect(warning).toHaveBeenCalled();
  warning.mockRestore();
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
it('issues a standalone applicant without consulting a Sales contract or Customer', async () => {
  const f = fixture();
  Object.assign(f.row, {
    applicantId: 'applicant',
    contractId: null,
    intakeId: null,
    customerId: null,
    automation: { phase: 'QUEUED', useDraft: true },
    destinationCode: '5',
    planCode: '76',
    departureDate: new Date('2027-01-01'),
    durationDays: 7,
  });
  await f.service.process('policy');
  expect(f.row.status).toBe('ISSUED');
  expect(f.identities.read).not.toHaveBeenCalled();
  expect(f.db.client.masterCity.findUnique).not.toHaveBeenCalled();
  expect(f.provider.createPolicy).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceCountryId: 1,
      contractNo: 'policy',
      person: expect.objectContaining({
        nationalCode: 'SYNTHETIC123',
        isIranian: false,
      }),
    }),
  );
  expect(f.notifications.createWithinTransaction).toHaveBeenCalledWith(
    f.tx,
    expect.objectContaining({
      recipientUserIds: ['standalone-owner'],
      href: '/reservations/insurance',
    }),
  );
  expect(
    f.db.client.reservationInsuranceApplicantAccess.create,
  ).toHaveBeenCalledWith({
    data: {
      applicantId: 'applicant',
      actorUserId: 'standalone-owner',
      action: 'PROVIDER_READ',
    },
  });
  expect(JSON.stringify(f.row)).not.toContain('SYNTHETIC123');
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
  expect(f.policies.findMany).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: { contractId: 'contract', customerId: { in: ['passenger'] } },
    }),
  );
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

it('issues with explicitly corrected trip settings instead of overwriting them from the contract', async () => {
  const f = fixture();
  Object.assign(f.row, {
    automation: { phase: 'QUEUED', useDraft: true },
    destinationCode: '5',
    planCode: '76',
    departureDate: new Date('2027-03-10'),
    durationDays: 12,
  });
  await f.service.process('policy');
  expect(f.provider.createPolicy).toHaveBeenCalledWith(
    expect.objectContaining({
      destinationCountryId: 5,
      planId: 76,
      durationOfStay: 12,
    }),
  );
});

it('explains cancelled policies and contracts instead of displaying a misleading pending status', async () => {
  const f = fixture();
  f.row.status = 'CANCELLED';
  expect(
    (await f.service.summary('intake', f.actor)).policies[0],
  ).toMatchObject({ ready: false, error: 'بیمه‌نامه لغو شده است.' });
  f.intake.contract.status = 'CANCELLED';
  expect(
    (await f.service.summary('intake', f.actor)).policies[0],
  ).toMatchObject({ ready: false, error: 'قرارداد ابطال شده است.' });
});

it('retains only locally generated provider diagnostics in the policy error', async () => {
  const f = fixture();
  f.provider.createPolicy.mockRejectedValueOnce(
    new TravisDiagnosticError('ثبت درخواست بیمه: موبایل (کد 400).'),
  );
  await f.service.process('policy');
  expect(f.row).toMatchObject({
    status: 'PROVIDER_ERROR',
    lastError: 'ثبت درخواست بیمه: موبایل (کد 400).',
  });
  expect(f.provider.confirmPolicy).not.toHaveBeenCalled();
  await f.service.process('policy');
  await f.service.process('policy');
  expect(f.row.lastError).toBe('ثبت درخواست بیمه: موبایل (کد 400).');
  expect(f.row.automation).toMatchObject({
    phase: 'CREATING',
    firstError: 'ثبت درخواست بیمه: موبایل (کد 400).',
  });
  expect(f.provider.createPolicy).toHaveBeenCalledTimes(1);
  f.provider.catalog.mockRejectedValueOnce(
    new TravisDiagnosticError('خطای داخلی سرویس بیمه (کد 503).'),
  );
  await f.service.process('policy');
  expect(f.row.lastError).toContain('موبایل (کد 400)');
  expect(f.row.lastError).toContain('کد 503');
});
it('blocks unsupported periods before Create without inventing a longer duration', async () => {
  const f = fixture();
  f.intake.contract.returnNotBefore = new Date('2027-01-01');
  await f.service.process('policy');
  expect(f.row).toMatchObject({
    status: 'INPUT_ERROR',
    lastError: 'مدت بیمه را از فهرست مجاز بیمه‌گر انتخاب کنید.',
  });
  expect(f.provider.createPolicy).not.toHaveBeenCalled();
  expect(f.row.automation).toEqual({ phase: 'QUEUED' });
});
it('sends only documented PolicyCreateInput field names and integer identifiers', async () => {
  const f = fixture();
  await f.service.process('policy');
  const input = (
    f.provider.createPolicy.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ]
  )[0];
  expect(Object.keys(input).sort()).toEqual(
    [
      'sourceCountryId',
      'destinationCountryId',
      'durationOfStay',
      'travelKind',
      'travelTypeId',
      'planId',
      'contractNo',
      'passportNo',
      'person',
    ].sort(),
  );
  for (const field of [
    'sourceCountryId',
    'destinationCountryId',
    'durationOfStay',
    'travelKind',
    'travelTypeId',
    'planId',
  ])
    expect(Number.isInteger(input[field])).toBe(true);
  expect(typeof input.person).toBe('object');
});

it('persists bounded provider business and HTTP diagnostics without overwriting the first failure', async () => {
  const f = fixture();
  const diagnostic = {
    httpStatus: 200,
    code: 400,
    messages: ['Jalali birth date is required'],
    fields: ['birthDate'],
  };
  f.provider.createPolicy.mockRejectedValueOnce(
    new TravisDiagnosticError('Provider rejected birth date', diagnostic),
  );
  await f.service.process('policy');
  expect(f.row.automation).toMatchObject({
    providerDiagnostic: diagnostic,
    firstError: 'Provider rejected birth date',
  });
});
it('binds sparse provider reconciliation to the exact successful creation receipt', async () => {
  const f = fixture();
  await f.service.process('policy');
  expect(f.provider.policy).toHaveBeenCalledWith(
    expect.any(Number),
    expect.objectContaining({
      trustedCreation: true,
      contractNo: 'policy',
      planId: 76,
    }),
  );
});
