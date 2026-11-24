import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  CustomerMutationRequest,
} from '@nora/contracts';
import { CustomerService } from './customer.service';
import { CustomerRepository } from './customer.repository';

const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: ['sales.contracts.create'],
};
const input: CustomerMutationRequest = {
  kind: 'person',
  firstName: 'Synthetic',
  lastName: 'Passenger',
  displayName: 'Synthetic Passenger',
  birthDate: '1990-01-01',
  nationalId: '1234567891',
  passportNumber: 'P1234567',
  roles: ['passenger'],
};
const row = {
  id: 'person',
  ownerBranchId: 'branch',
  mergedIntoId: null,
  isActive: true,
  kind: 'PERSON',
  nationalIdFingerprint: 'national',
  passportNumberFingerprint: 'passport',
  firstName: 'Synthetic',
  lastName: 'Passenger',
  birthDate: new Date('1990-01-01'),
};
function fixture(rows: unknown[] = []) {
  const repo = {
    websiteIdentityCandidates: vi.fn().mockResolvedValue(rows),
    findWebsitePassport: vi.fn().mockResolvedValue(null),
    findRegistration: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
  const crypto = {
    protect: vi.fn().mockReturnValue({ nationalIdFingerprint: 'national' }),
    protectPassportNumber: vi
      .fn()
      .mockReturnValue({ passportNumberFingerprint: 'passport' }),
  };
  const service = new CustomerService(
    repo as never,
    {} as never,
    crypto as never,
  );
  return {
    repo,
    service,
    check: (body = input, a = actor) =>
      service.checkWebsitePassenger(body, a, 'branch'),
  };
}
describe('read-only website passenger preflight', () => {
  it('accepts a new identity without creating or changing a customer', async () => {
    const f = fixture();
    expect(await f.check()).toEqual({ valid: true });
    expect(f.repo.create).not.toHaveBeenCalled();
    expect(f.repo.update).not.toHaveBeenCalled();
  });
  it('accepts exact existing identity with the same passport', async () => {
    expect(await fixture([row]).check()).toEqual({ valid: true });
  });
  it('allows a saved profile to match without changing the existing ERP identity', async () => {
    const f = fixture([row]);
    f.repo.findRegistration.mockResolvedValue({
      ...row,
      displayName: input.displayName,
    });
    const sync = (passenger: CustomerMutationRequest) =>
      f.service.syncWebsitePassenger(
        passenger,
        actor,
        'branch',
        undefined,
        true,
      );
    expect(await sync(input)).toEqual({
      data: { id: row.id, displayName: input.displayName },
    });
    await expect(sync({ ...input, firstName: 'Different' })).rejects.toThrow();
    expect(f.repo.update).not.toHaveBeenCalled();
  });
  it('reuses a matching passport-only identity on repeated storefront purchases', async () => {
    const passport = {
      ...input,
      nationalId: null,
      passportFirstName: 'SYNTHETIC',
      passportLastName: 'PASSENGER',
    };
    const f = fixture([{ ...row, nationalIdFingerprint: null }]);
    f.repo.findWebsitePassport.mockResolvedValue({
      ...row,
      passportFirstName: 'SYNTHETIC',
      passportLastName: 'PASSENGER',
      displayName: 'Synthetic Passenger',
    });
    expect(await f.check(passport)).toEqual({ valid: true });
    expect(
      await f.service.syncWebsitePassenger(passport, actor, 'branch'),
    ).toEqual({
      data: { id: row.id, displayName: 'Synthetic Passenger' },
    });
    expect(f.repo.findWebsitePassport).toHaveBeenCalledWith(
      'passport',
      'branch',
    );
    expect(f.repo.create).not.toHaveBeenCalled();
    expect(f.repo.update).not.toHaveBeenCalled();
    expect(await f.check({ ...passport, birthDate: '1990-02-01' })).toEqual({
      valid: false,
      code: 'CUSTOMER_PASSPORT_NUMBER_EXISTS',
    });
  });
  it('rejects a passport belonging to a different national-ID record', async () => {
    const f = fixture([
      row,
      {
        ...row,
        id: 'other',
        nationalIdFingerprint: 'other-national',
        passportNumberFingerprint: 'passport',
      },
    ]);
    f.repo.websiteIdentityCandidates.mockResolvedValue([
      { ...row, passportNumberFingerprint: 'old-passport' },
      { ...row, id: 'other', nationalIdFingerprint: 'other-national' },
    ]);
    expect(await f.check()).toEqual({
      valid: false,
      code: 'CUSTOMER_PASSPORT_NUMBER_EXISTS',
    });
    expect(f.repo.update).not.toHaveBeenCalled();
  });
  it.each([
    { ownerBranchId: 'other' },
    { isActive: false },
    { mergedIntoId: 'merged' },
    { kind: 'ORGANIZATION' },
  ])(
    'does not expose or modify an unavailable national-ID profile %j',
    async (patch) => {
      expect(await fixture([{ ...row, ...patch }]).check()).toEqual({
        valid: false,
        code: 'IDENTITY_REVIEW_REQUIRED',
      });
    },
  );
  it.each([
    { firstName: 'Another' },
    { lastName: 'Another' },
    { birthDate: new Date('1991-01-01') },
  ])(
    'preserves the authorized same-national-ID synchronization %j',
    async (patch) => {
      expect(await fixture([{ ...row, ...patch }]).check()).toEqual({
        valid: true,
      });
    },
  );
  it('does not disclose records or fingerprints in the result', async () => {
    expect(Object.keys(await fixture([row]).check())).toEqual(['valid']);
  });
  it('preserves the native authorization and branch boundary', async () => {
    await expect(
      fixture().check(input, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(
      fixture().check(input, { ...actor, branchIds: ['other'] }),
    ).rejects.toThrow();
  });
  it('validates malformed identity before the database probe', async () => {
    const f = fixture();
    await expect(f.check({ ...input, firstName: '' })).rejects.toThrow();
    expect(f.repo.websiteIdentityCandidates).not.toHaveBeenCalled();
  });
  it('uses a bounded, minimum-field read probe including conflicting unique identifiers', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new CustomerRepository({
      client: { customer: { findMany } },
    } as never);
    await repo.websiteIdentityCandidates('national', 'passport');
    const request = findMany.mock.calls[0]![0];
    expect(request.take).toBe(2);
    expect(request.where.OR).toHaveLength(2);
    expect(
      Object.keys(request.select).some((key) =>
        /Encrypted|Masked|displayName|firstName|lastName|birthDate/.test(key),
      ),
    ).toBe(false);
  });
});
