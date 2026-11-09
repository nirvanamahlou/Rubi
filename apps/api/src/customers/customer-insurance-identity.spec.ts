import { expect, it, vi } from 'vitest';
import { CustomerInsuranceIdentity } from './customer-insurance-identity';
import type { SalesOperationalAmendmentService } from '../sales/sales-operational-amendment.module';
import type { DatabaseService } from '../database/database.service';
import type { CustomerNationalIdProtector } from './customer-national-id';
import type { CustomerContactCrypto } from './customer-contact.crypto';
import type { CustomerRepository } from './customer.repository';
function fixture() {
  const intake = {
    id: 'intake',
    contractId: 'contract',
    branchId: 'branch',
    status: 'NEW',
    contract: {
      ownerUserId: 'owner',
      customerId: 'person',
      status: 'SENT_TO_RESERVATIONS',
      branchId: 'branch',
    },
    snapshot: {
      passengerIds: ['person'],
      serviceSelections: [{ kind: 'INSURANCE', clientKey: 'insurance' }],
      passengerAssignments: [
        { customerId: 'person', serviceClientKeys: ['insurance'] },
      ],
    },
  };
  const person = {
    id: 'person',
    kind: 'PERSON',
    isActive: true,
    firstName: 'Test',
    lastName: 'Passenger',
    passportFirstName: 'TEST',
    passportLastName: 'PASSENGER',
    gender: 'M',
    birthDate: new Date('1990-01-01'),
    nationalityCode: 'IRN',
    contacts: [
      { type: 'PHONE', encryptedValue: 'phone' },
      { type: 'EMAIL', encryptedValue: 'email' },
    ],
  };
  const db = {
    client: {
      salesContract: { findFirst: vi.fn(async () => intake.contract) },
      reservationIntake: {
        findUnique: vi.fn(async () => intake),
        findFirst: vi.fn(async () => ({ id: 'intake' })),
      },
      customer: { findUnique: vi.fn(async () => person) },
    },
  };
  const ids = {
    decrypt: vi.fn(() => 'SYNTHETIC-NATIONAL'),
    decryptPassportNumber: vi.fn(() => 'SYNTHETIC-PASSPORT'),
  };
  const contacts = {
    decrypt: vi.fn((c: { type: string }) =>
      c.type === 'PHONE' ? '00000000000' : 'synthetic@example.invalid',
    ),
  };
  const repository = { auditSensitiveRead: vi.fn() };
  const sales = { currentExecution: vi.fn(async () => intake.snapshot) };
  const service = new CustomerInsuranceIdentity(
    db as unknown as DatabaseService,
    ids as unknown as CustomerNationalIdProtector,
    contacts as unknown as CustomerContactCrypto,
    repository as unknown as CustomerRepository,
    sales as unknown as SalesOperationalAmendmentService,
  );
  return { intake, person, db, ids, contacts, repository, service, sales };
}
it('validates standalone national identity through the Customer public port without reading or changing a Customer', () => {
  const f = fixture();
  expect(() =>
    f.service.validateApplicant({
      nationalityCode: 'IRN',
      nationalCode: '0000000000',
    } as never),
  ).toThrow('کد ملی');
  expect(() =>
    f.service.validateApplicant({
      nationalityCode: 'TUR',
      nationalCode: '',
    } as never),
  ).not.toThrow();
  expect(f.repository.auditSensitiveRead).not.toHaveBeenCalled();
});
it('provides only selected insured identities to the internal provider and records the sensitive read', async () => {
  const f = fixture();
  const output = await f.service.read('intake', 'person');
  expect(output.person).toMatchObject({
    nationalCode: 'SYNTHETIC-NATIONAL',
    firstNameLatin: 'TEST',
    mobile: '00000000000',
  });
  expect(f.repository.auditSensitiveRead).toHaveBeenCalledWith(
    'person',
    'owner',
    'branch',
    'insurance-provider-issuance',
    undefined,
    expect.arrayContaining(['nationalId', 'passportNumber']),
  );
});
it('validates current contract insurance membership instead of an obsolete intake allocation', async () => {
  const f = fixture();
  const current = structuredClone(f.intake.snapshot);
  f.intake.snapshot.passengerAssignments = [];
  f.sales.currentExecution.mockResolvedValue(current);
  expect((await f.service.read('intake', 'person')).passportNo).toBe(
    'SYNTHETIC-PASSPORT',
  );
  current.passengerAssignments[0]!.serviceClientKeys = [];
  f.ids.decryptPassportNumber.mockClear();
  await expect(f.service.read('intake', 'person')).rejects.toThrow();
  expect(f.ids.decryptPassportNumber).not.toHaveBeenCalled();
});
it('does not decrypt unrelated people, cancelled contracts or superseded intake snapshots', async () => {
  const f = fixture();
  await expect(f.service.read('intake', 'someone-else')).rejects.toThrow();
  expect(f.ids.decrypt).not.toHaveBeenCalled();
  f.intake.contract.status = 'CANCELLED';
  await expect(f.service.read('intake', 'person')).rejects.toThrow();
  f.intake.contract.status = 'SENT_TO_RESERVATIONS';
  f.db.client.reservationIntake.findFirst.mockResolvedValue({ id: 'newer' });
  await expect(f.service.read('intake', 'person')).rejects.toThrow();
  expect(f.ids.decrypt).not.toHaveBeenCalled();
});
it('requires actual contact details rather than manufacturing them for the provider', async () => {
  const f = fixture();
  f.person.contacts = [];
  await expect(f.service.read('intake', 'person')).rejects.toThrow('تکمیل');
});

it('saves correction with encrypted identifiers and contacts, optimistic concurrency, and metadata-only audit', async () => {
  const f = fixture();
  const protect = vi.fn(() => ({ nationalIdEncrypted: 'sealed-national' }));
  const protectPassportNumber = vi.fn(() => ({
    passportNumberEncrypted: 'sealed-passport',
  }));
  const protectContact = vi.fn((type: string) => ({
    encryptedValue: 'sealed-' + type,
    valueHash: 'hash-' + type,
    maskedValue: 'masked',
    valueFingerprint: 'fingerprint-' + type,
  }));
  Object.assign(f.ids, { protect, protectPassportNumber });
  Object.assign(f.contacts, { protect: protectContact });
  const tx = {
    customer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    customerContact: { updateMany: vi.fn(), upsert: vi.fn() },
    customerAuditEvent: { create: vi.fn() },
  };
  const input = {
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
  await f.service.saveCorrection(
    tx as never,
    'person',
    input,
    { userId: 'operator' } as never,
    'branch',
  );
  expect(tx.customer.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'person', version: 1, kind: 'PERSON', isActive: true },
      data: expect.objectContaining({
        nationalIdEncrypted: 'sealed-national',
        passportNumberEncrypted: 'sealed-passport',
      }),
    }),
  );
  expect(tx.customerContact.upsert).toHaveBeenCalledTimes(2);
  for (const [target, code] of [
    ['nationalIdFingerprint', 'CUSTOMER_NATIONAL_ID_EXISTS'],
    ['passportNumberFingerprint', 'CUSTOMER_PASSPORT_NUMBER_EXISTS'],
  ]) {
    const databaseError = { code: 'P2002', meta: { target: [target] } };
    tx.customer.updateMany.mockRejectedValueOnce(databaseError);
    const failure = await f.service
      .saveCorrection(
        tx as never,
        'person',
        input,
        { userId: 'operator' } as never,
        'branch',
      )
      .catch((error) => error);
    expect(failure.getStatus()).toBe(409);
    expect(failure.getResponse().code).toBe(code);
    expect(JSON.stringify(failure.getResponse())).not.toContain(
      input.nationalCode,
    );
    expect(tx.customerContact.upsert).toHaveBeenCalledTimes(2);
  }
  const unexpected = new Error('database unavailable');
  tx.customer.updateMany.mockRejectedValueOnce(unexpected);
  await expect(
    f.service.saveCorrection(
      tx as never,
      'person',
      input,
      { userId: 'operator' } as never,
      'branch',
    ),
  ).rejects.toBe(unexpected);
  const audit = JSON.stringify(tx.customerAuditEvent.create.mock.calls);
  for (const secret of [
    input.nationalCode,
    input.passportNo,
    input.mobile,
    input.email,
  ])
    expect(audit).not.toContain(secret);
  tx.customer.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    f.service.saveCorrection(
      tx as never,
      'person',
      input,
      { userId: 'operator' } as never,
      'branch',
    ),
  ).rejects.toThrow();
  expect(tx.customerContact.upsert).toHaveBeenCalledTimes(2);
});
it('reads incomplete correction fields without requiring issuance-ready identity', async () => {
  const f = fixture();
  f.person.contacts = [];
  f.person.passportFirstName = '';
  const result = await f.service.correction('intake', 'person', {
    userId: 'operator',
  } as never);
  expect(result.firstNameLatin).toBe('');
  expect(result.mobile).toBe('');
  expect(f.repository.auditSensitiveRead).toHaveBeenCalledWith(
    'person',
    'operator',
    'branch',
    expect.any(String),
    undefined,
    expect.any(Array),
  );
});
