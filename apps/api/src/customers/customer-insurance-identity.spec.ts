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
