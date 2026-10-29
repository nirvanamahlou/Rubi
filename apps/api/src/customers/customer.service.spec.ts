import { MANUAL_ACCESS_VERSION } from '@nora/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  CustomerMutationRequest,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerContactCrypto } from './customer-contact.crypto';
import type { CustomerNationalIdProtector } from './customer-national-id';
import type { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: [
    'customers.read',
    'customers.create',
    'customers.update',
    'customers.merge',
    'customers.consent.manage',
  ],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};

const protectedContact = {
  encryptedValue: 'encrypted-contact',
  encryptionIv: 'iv-base64-value',
  encryptionAuthTag: 'auth-tag-base64-value',
  encryptionKeyVersion: 1,
  maskedValue: '0000•••000',
  valueFingerprint: 'f'.repeat(64),
  valueHash: 'f'.repeat(64),
};

function createService(
  repository: CustomerRepository,
  cryptoOverrides: Partial<CustomerContactCrypto> = {},
) {
  const contactCrypto = {
    protect: vi.fn().mockReturnValue(protectedContact),
    decrypt: vi.fn().mockReturnValue('0000000000'),
    fingerprint: vi.fn().mockReturnValue('f'.repeat(64)),
    ...cryptoOverrides,
  } as unknown as CustomerContactCrypto;
  const nationalIdProtector = {
    protect: vi.fn().mockReturnValue({
      nationalIdEncrypted: 'encrypted-national-id',
      nationalIdIv: 'iv-base64-value',
      nationalIdAuthTag: 'auth-tag-base64-value',
      nationalIdKeyVersion: 1,
      nationalIdFingerprint: 'n'.repeat(64),
      nationalIdMasked: '******7891',
    }),
    decrypt: vi.fn().mockReturnValue('1234567891'),
    protectPassportNumber: vi.fn().mockReturnValue({
      passportNumberEncrypted: 'encrypted-passport-number',
      passportNumberIv: 'passport-iv-val',
      passportNumberAuthTag: 'passport-auth-tag-val',
      passportNumberKeyVersion: 1,
      passportNumberFingerprint: 'p'.repeat(64),
      passportNumberMasked: 'A*******78',
    }),
    decryptPassportNumber: vi.fn().mockReturnValue(null),
  } as unknown as CustomerNationalIdProtector;
  return {
    service: new CustomerService(
      repository,
      contactCrypto,
      nationalIdProtector,
    ),
    contactCrypto,
    nationalIdProtector,
  };
}
const mutation: CustomerMutationRequest = {
  kind: 'person',
  firstName: 'نمونه',
  lastName: 'آزمایشی',
  displayName: 'مشتری ساختگی',
  nationalId: '1234567891',
  birthDate: '1990-01-01',
  roles: ['customer', 'passenger'],
};

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  kind: 'PERSON',
  organizationId: null,
  firstName: 'نمونه',
  lastName: 'آزمایشی',
  displayName: 'مشتری ساختگی',
  birthDate: new Date('1990-01-01T00:00:00.000Z'),
  nationalIdEncrypted: 'encrypted-national-id',
  nationalIdIv: 'iv-base64-value',
  nationalIdAuthTag: 'auth-tag-base64-value',
  nationalIdKeyVersion: 1,
  nationalIdMasked: '******7891',
  isActive: true,
  isCustomer: true,
  isPassenger: true,
  acquaintanceMethodId: null,
  ownerBranchId: actor.branchIds[0],
  version: 1,
  createdAt: new Date('2026-08-24T00:00:00.000Z'),
  updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  contacts: [],
  addresses: [],
  consents: [],
  relationships: [],
  _count: { relationships: 0 },
};

describe('current identity for authorized contract output', () => {
  it('returns current spelling and birthday without decrypting document numbers', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({
        ...row,
        kind: 'PERSON',
        passportFirstName: 'CURRENT',
        passportLastName: 'PASSENGER',
        birthDate: new Date('1991-02-03T00:00:00Z'),
      }),
      auditSensitiveRead: vi.fn(),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    const reader: AuthenticatedActor = {
      ...actor,
      permissions: ['sales.export'],
    };
    expect(
      await service.salesOutputIdentity(row.id, reader, 'trace'),
    ).toMatchObject({
      passportName: 'CURRENT PASSENGER',
      birthDate: '1991-02-03',
    });
    expect(repository.find).toHaveBeenCalledWith(row.id, reader.branchIds);
    expect(repository.auditSensitiveRead).toHaveBeenCalledWith(
      row.id,
      reader.userId,
      row.ownerBranchId,
      'customer-verification',
      'trace',
    );
    expect(nationalIdProtector.decrypt).not.toHaveBeenCalled();
    await expect(
      service.salesOutputIdentity(row.id, { ...reader, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('CustomerService', () => {
  it('uses actor-scoped receipt persistence for a contract creator without Customer permissions', async () => {
    const repository = {
      createSalesRegistration: vi.fn().mockResolvedValue(row),
      create: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const creator = {
      ...actor,
      permissions: ['sales.contracts.create'],
    } as AuthenticatedActor;
    await service.createForSales(
      { ...mutation, nationalId: null },
      creator,
      undefined,
      'trace',
      'receipt',
    );
    expect(repository.createSalesRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'PERSON' }),
      actor.userId,
      actor.branchIds[0],
      'receipt',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'trace',
    );
    expect(repository.create).not.toHaveBeenCalled();
    expect(creator.permissions).toEqual(['sales.contracts.create']);
    await expect(
      service.createForSales(
        mutation,
        { ...creator, permissions: [] },
        undefined,
        undefined,
        'receipt',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('enforces positive manual field grants on actual updates, even without legacy deny tokens', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const scoped: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.manual.v3',
        'ui.allow.field.customers.birthDate',
      ],
    };
    await expect(
      service.update(
        row.id,
        { ...mutation, firstName: 'changed', version: 1 },
        scoped,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
    await expect(
      service.update(
        row.id,
        { ...mutation, birthDate: '1991-01-01', version: 1 },
        scoped,
      ),
    ).resolves.toBeDefined();
    expect(repository.update).toHaveBeenCalledTimes(1);
  });
  it('rejects denied create values including null and allows only unchanged denied updates', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    const restricted = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'ui.deny.field.customers.displayName',
      ],
    } as AuthenticatedActor;
    await expect(
      service.create({ ...mutation, displayName: null } as never, restricted),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update(
        row.id,
        { ...mutation, displayName: row.displayName, version: 1 },
        restricted,
      ),
    ).resolves.toBeDefined();
    await expect(
      service.update(
        row.id,
        { ...mutation, displayName: 'نام تازه', version: 1 },
        restricted,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(nationalIdProtector.decrypt).not.toHaveBeenCalled();
    expect(nationalIdProtector.decryptPassportNumber).not.toHaveBeenCalled();
  });
  it('allows explicit national-ID matching for authorized correction while preserving scope and audit', async () => {
    const repository = {
      findRegistration: vi.fn().mockResolvedValue(row),
      auditSensitiveRead: vi.fn(),
      update: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const input = {
      nationalId: '1234567891',
      firstName: 'Corrected',
      lastName: 'Name',
      birthDate: '1991-02-03',
      matchByNationalId: true,
    };
    await expect(
      service.registrationLookup(input, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findRegistration).not.toHaveBeenCalled();
    const result = await service.registrationLookup(input, {
      ...actor,
      permissions: [...actor.permissions, 'customers.sensitive.read'],
    });
    expect(result.data?.id).toBe(row.id);
    expect(repository.findRegistration).toHaveBeenCalledExactlyOnceWith(
      'n'.repeat(64),
      actor.branchIds,
    );
    expect(repository.auditSensitiveRead).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('recovers only exact branch-scoped identity and audits sensitive output', async () => {
    const repository = {
      findRegistration: vi.fn().mockResolvedValue(row),
      auditSensitiveRead: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const result = await service.registrationLookup(
      {
        nationalId: '1234567891',
        firstName: 'نمونه',
        lastName: 'آزمایشی',
        birthDate: '1990-01-01',
      },
      {
        ...actor,
        permissions: [...actor.permissions, 'customers.sensitive.read'],
      },
    );
    expect(repository.findRegistration).toHaveBeenCalledWith(
      'n'.repeat(64),
      actor.branchIds,
    );
    expect(result.data?.id).toBe(row.id);
    expect(repository.auditSensitiveRead).toHaveBeenCalledTimes(1);
  });
  it('does not expose or bind mismatching registration and requires sensitive read permission', async () => {
    const repository = {
      findRegistration: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const input = {
      nationalId: '1234567891',
      firstName: 'Different',
      lastName: 'آزمایشی',
      birthDate: '1990-01-01',
    };
    await expect(
      service.registrationLookup(input, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findRegistration).not.toHaveBeenCalled();
    await expect(
      service.registrationLookup(input, {
        ...actor,
        permissions: [...actor.permissions, 'customers.sensitive.read'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    vi.mocked(repository.findRegistration).mockResolvedValue(null);
    await expect(
      service.registrationLookup(input, {
        ...actor,
        permissions: [...actor.permissions, 'customers.sensitive.read'],
      }),
    ).resolves.toEqual({ data: null });
  });
  it('persists expiry as a date and preserves omitted values on legacy updates', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await service.update(
      row.id,
      { ...mutation, version: 1, passportExpiryDate: '2031-02-03' },
      actor,
    );
    expect(vi.mocked(repository.update).mock.calls[0]?.[2]).toHaveProperty(
      'passportExpiryDate',
      new Date('2031-02-03T00:00:00.000Z'),
    );
    await service.update(row.id, { ...mutation, version: 1 }, actor);
    expect(vi.mocked(repository.update).mock.calls[1]?.[2]).not.toHaveProperty(
      'passportExpiryDate',
    );
    await expect(
      service.update(
        row.id,
        { ...mutation, version: 1, passportExpiryDate: '2031-02-30' },
        actor,
      ),
    ).rejects.toThrow('انقضای پاسپورت');
  });
  it('normalizes airline identity and preserves it when omitted later', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await service.update(
      row.id,
      {
        ...mutation,
        version: 1,
        passportFirstName: 'Ali',
        passportLastName: 'Example',
        gender: 'M',
        nationalityCode: 'irn',
        passportIssuingCountryCode: 'irn',
        birthCountryCode: 'irn',
      },
      actor,
    );
    expect(vi.mocked(repository.update).mock.calls[0]?.[2]).toMatchObject({
      passportFirstName: 'ALI',
      passportLastName: 'EXAMPLE',
      gender: 'M',
      nationalityCode: 'IRN',
      passportIssuingCountryCode: 'IRN',
      birthCountryCode: 'IRN',
    });
    await service.update(row.id, { ...mutation, version: 1 }, actor);
    expect(vi.mocked(repository.update).mock.calls[1]?.[2]).not.toHaveProperty(
      'nationalityCode',
    );
  });
  it('preserves omitted birthday and national ID during unrelated legacy edits', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    const edit = { ...mutation, version: 1 };
    delete edit.nationalId;
    delete edit.birthDate;
    await service.update(row.id, edit, actor);
    const data = vi.mocked(repository.update).mock.calls[0]?.[2];
    expect(data).not.toHaveProperty('birthDate');
    expect(data).not.toHaveProperty('nationalIdEncrypted');
    expect(nationalIdProtector.protect).not.toHaveBeenCalled();
    await service.update(row.id, { ...edit, birthDate: null }, actor);
    expect(vi.mocked(repository.update).mock.calls[1]?.[2]).toHaveProperty(
      'birthDate',
      null,
    );
  });

  it('rejects unsupported passenger organization instead of silently discarding it', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(
      service.create(
        { ...mutation, organizationId: actor.branchIds[0]! },
        actor,
      ),
    ).rejects.toThrow('اتصال شخص به سازمان');
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(['2025-02-29', '2026-02-31', '2999-01-01'])(
    'rejects invalid or future date %s before persistence',
    async (birthDate) => {
      const repository = { create: vi.fn() } as unknown as CustomerRepository;
      const { service } = createService(repository);
      await expect(
        service.create({ ...mutation, birthDate }, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it('requires and protects a separate national ID before persistence', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);

    await service.create(mutation, actor);

    expect(nationalIdProtector.protect).toHaveBeenCalledWith('1234567891');
    const persisted = vi.mocked(repository.create).mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      nationalIdEncrypted: 'encrypted-national-id',
      nationalIdFingerprint: 'n'.repeat(64),
      nationalIdMasked: '******7891',
    });
    expect(persisted).not.toHaveProperty('nationalId');
    expect(JSON.stringify(persisted)).not.toContain('1234567891');
  });

  it('creates a customer-only person without a national ID or birth date', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({
        ...row,
        isPassenger: false,
        birthDate: null,
        nationalIdEncrypted: null,
        nationalIdIv: null,
        nationalIdAuthTag: null,
        nationalIdKeyVersion: null,
        nationalIdMasked: null,
      }),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    await service.create(
      {
        kind: 'person',
        firstName: 'Synthetic',
        lastName: 'Customer',
        displayName: 'Synthetic Customer',
        roles: ['customer'],
      },
      actor,
    );
    expect(repository.create).toHaveBeenCalledOnce();
    expect(nationalIdProtector.protect).not.toHaveBeenCalled();
    expect(vi.mocked(repository.create).mock.calls[0]?.[0]).toMatchObject({
      isCustomer: true,
      isPassenger: false,
    });
  });

  it('creates a contract passenger without national ID but keeps directory creation strict', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    const input = { ...mutation };
    delete input.nationalId;
    await service.createForSales(input, {
      ...actor,
      permissions: ['sales.contracts.create'],
    });
    expect(repository.create).toHaveBeenCalledOnce();
    expect(vi.mocked(repository.create).mock.calls[0]?.[0]).not.toHaveProperty(
      'nationalIdFingerprint',
    );
    expect(nationalIdProtector.protect).not.toHaveBeenCalled();
    await expect(service.create(input, actor)).rejects.toMatchObject({
      response: { code: 'CUSTOMER_NATIONAL_ID_REQUIRED' },
    });
    await expect(
      service.createForSales(input, { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows unknown birth dates in Sales while keeping ordinary Customer creation strict', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const input = {
      kind: 'person' as const,
      firstName: 'Synthetic',
      lastName: 'Passenger',
      displayName: 'Synthetic Passenger',
      roles: ['passenger' as const],
    };
    const salesActor: AuthenticatedActor = {
      ...actor,
      permissions: ['sales.contracts.create'],
    };
    await service.createForSalesCompletion(input, salesActor);
    expect(vi.mocked(repository.create).mock.calls[0]?.[0]).toMatchObject({
      isPassenger: true,
      birthDate: null,
    });
    await service.createForSales(input, salesActor);
    expect(vi.mocked(repository.create).mock.calls[1]?.[0]).toMatchObject({
      birthDate: null,
    });
    await expect(
      service.create({ ...input, nationalId: mutation.nationalId! }, actor),
    ).rejects.toMatchObject({
      response: { code: 'CUSTOMER_PASSENGER_BIRTH_DATE_REQUIRED' },
    });
    await expect(
      service.createForSalesCompletion(input, { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('still protects a supplied national ID and validates a supplied birth date', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service, nationalIdProtector } = createService(repository);
    const salesActor: AuthenticatedActor = {
      ...actor,
      permissions: ['sales.contracts.create'],
    };
    await service.createForSales(mutation, salesActor);
    expect(nationalIdProtector.protect).toHaveBeenCalledWith(
      mutation.nationalId,
    );
    const input = { ...mutation };
    delete input.nationalId;
    delete input.birthDate;
    await service.createForSales(input, salesActor);
    expect(vi.mocked(repository.create).mock.calls[1]?.[0]).toMatchObject({
      birthDate: null,
    });
    await expect(
      service.createForSales({ ...input, birthDate: 'invalid' }, salesActor),
    ).rejects.toThrow('تاریخ تولد معتبر نیست');
  });

  it('rejects a person create without national ID', async () => {
    const repository = { create: vi.fn() } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const withoutNationalId = { ...mutation };
    delete withoutNationalId.nationalId;

    await expect(
      service.create(withoutNationalId, actor),
    ).rejects.toMatchObject({
      response: { code: 'CUSTOMER_NATIONAL_ID_REQUIRED' },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns a safe conflict for a duplicate national ID fingerprint', async () => {
    const repository = {
      create: vi.fn().mockRejectedValue({ code: 'P2002' }),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);

    await expect(service.create(mutation, actor)).rejects.toMatchObject({
      status: 409,
      response: { code: 'CUSTOMER_NATIONAL_ID_EXISTS' },
    });
  });

  it('rejects branch filter tampering before querying persistence', async () => {
    const repository = { list: vi.fn() } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(
      service.list(
        {
          search: '',
          status: 'all',
          role: 'all',
          branchId: '99999999-9999-4999-8999-999999999999',
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          page: 1,
          pageSize: 25,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'CUSTOMER_BRANCH_SCOPE_FORBIDDEN' },
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('returns filter-scoped customer metrics without inventing Sales data', async () => {
    const repository = {
      list: vi.fn().mockResolvedValue({
        rows: [row],
        total: 1,
        metrics: {
          totalCustomers: 1,
          totalPassengers: 1,
          newCustomersLastThreeMonths: 1,
        },
      }),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const response = await service.list(
      {
        search: '',
        kind: 'person',
        status: 'all',
        role: 'all',
        branchId: 'all',
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        page: 1,
        pageSize: 25,
      },
      actor,
    );

    expect(response.meta.metrics).toEqual({
      totalCustomers: 1,
      totalPassengers: 1,
      newCustomersLastThreeMonths: 1,
      returningCustomerRate: null,
      returningCustomerRateStatus: 'awaiting-sales-public-contract',
    });
  });

  it('returns safe real status, activity and audit timelines', async () => {
    const repository = {
      statusHistory: vi.fn().mockResolvedValue([
        {
          id: 'history-id',
          fromStatus: 'ACTIVE',
          toStatus: 'INACTIVE',
          reason: 'manual-deactivation',
          changedByUserId: actor.userId,
          actorBranchId: actor.branchIds[0],
          changedAt: row.updatedAt,
          changedBy: { displayName: 'کاربر ساختگی' },
        },
      ]),
      audit: vi.fn().mockResolvedValue([
        {
          id: 'audit-id',
          action: 'customers.sensitive.read',
          outcome: 'SUCCESS',
          reason: 'customer-verification',
          actorUserId: actor.userId,
          actorBranchId: actor.branchIds[0],
          traceId: 'trace-id',
          occurredAt: row.updatedAt,
          actor: { displayName: 'کاربر ساختگی' },
        },
      ]),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);

    await expect(service.statusHistory(row.id, actor)).resolves.toMatchObject({
      data: [{ fromStatus: 'active', toStatus: 'inactive' }],
    });
    await expect(service.activity(row.id, actor)).resolves.toMatchObject({
      data: [{ type: 'sensitive-view', title: 'مشاهده اطلاعات حساس' }],
    });
    const audit = await service.audit(row.id, actor);
    expect(audit.data[0]).toEqual(
      expect.objectContaining({
        action: 'customers.sensitive.read',
        outcome: 'success',
      }),
    );
    expect(audit.data[0]).not.toHaveProperty('beforeSnapshot');
    expect(audit.data[0]).not.toHaveProperty('afterSnapshot');
  });

  it('enforces branch context on mutations', async () => {
    const repository = { create: vi.fn() } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(
      service.create(mutation, { ...actor, branchIds: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns coded optimistic concurrency conflicts', async () => {
    const repository = {
      update: vi.fn().mockResolvedValue(null),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    const operation = service.update(
      row.id,
      { ...mutation, version: 1 },
      actor,
    );
    await expect(operation).rejects.toBeInstanceOf(ConflictException);
    await expect(operation).rejects.toMatchObject({
      response: { code: 'CONCURRENT_MODIFICATION' },
      status: 409,
    });
  });

  it('persists the actual trimmed consent reason', async () => {
    const repository = {
      addConsent: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);

    await service.addConsent(
      row.id,
      {
        purpose: 'marketing',
        channel: 'all',
        status: 'granted',
        source: '  staff-ui  ',
        reason: '  درخواست حضوری مشتری  ',
        version: 1,
      },
      actor,
    );

    expect(repository.addConsent).toHaveBeenCalledWith(
      row.id,
      actor.branchIds,
      expect.objectContaining({
        source: 'staff-ui',
        reason: 'درخواست حضوری مشتری',
      }),
      actor.userId,
      actor.branchIds[0],
      undefined,
    );
  });

  it.each(['x'.repeat(501)])(
    'rejects an invalid consent reason before persistence (%j)',
    async (reason) => {
      const repository = {
        addConsent: vi.fn(),
      } as unknown as CustomerRepository;
      const { service } = createService(repository);

      await expect(
        service.addConsent(
          row.id,
          {
            purpose: 'marketing',
            channel: 'all',
            status: 'granted',
            source: 'staff-ui',
            reason,
            version: 1,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.addConsent).not.toHaveBeenCalled();
    },
  );

  it.each([
    'تماس با 09120000000 انجام شد',
    'ارسال به person@example.test',
    'Bearer synthetic-token',
  ])('rejects sensitive consent reason content (%s)', async (reason) => {
    const repository = {
      addConsent: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);

    await expect(
      service.addConsent(
        row.id,
        {
          purpose: 'marketing',
          channel: 'all',
          status: 'revoked',
          source: 'staff-ui',
          reason,
          version: 1,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CUSTOMER_CONSENT_REASON_SENSITIVE_DATA' },
    });
    expect(repository.addConsent).not.toHaveBeenCalled();
  });

  it('hashes and masks contacts without passing the raw value to persistence', async () => {
    const repository = {
      addContact: vi.fn().mockResolvedValue(row),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await service.addContact(
      row.id,
      { type: 'phone', value: '0000000000', isPrimary: true, version: 1 },
      actor,
    );
    const persisted = vi.mocked(repository.addContact).mock.calls[0]?.[2];
    expect(persisted).toMatchObject({ maskedValue: '0000•••000' });
    expect(persisted?.valueFingerprint).toHaveLength(64);
    expect(persisted?.valueHash).toHaveLength(64);
    expect(persisted?.encryptedValue).toBe('encrypted-contact');
    expect(persisted).not.toHaveProperty('value');
  });

  it('masks birth date without sensitive permission and never auto-merges', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      duplicateInputs: vi.fn().mockResolvedValue({
        source: { ...row, contacts: [{ valueFingerprint: 'same' }] },
        candidates: [
          {
            ...row,
            id: '55555555-5555-4555-8555-555555555555',
            contacts: [{ valueFingerprint: 'same' }],
          },
        ],
      }),
      saveDuplicateCandidate: vi.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
        sourceCustomerId: row.id,
        candidateCustomerId: '55555555-5555-4555-8555-555555555555',
        score: 100,
        reasons: ['تماس یکسان'],
        reviewStatus: 'PENDING',
        reviewReason: null,
        version: 1,
        reviewedAt: null,
        createdAt: row.createdAt,
        candidateCustomer: { displayName: 'کاندیدای ساختگی' },
      }),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);
    await expect(service.detail(row.id, actor)).resolves.toMatchObject({
      data: { birthDate: null, birthDateMasked: true },
    });
    await expect(
      service.detectDuplicates(row.id, actor),
    ).resolves.toMatchObject({
      data: [{ score: 100, reviewStatus: 'pending' }],
      meta: { autoMergePerformed: false },
    });
  });
  it('decrypts contacts and audits access only with sensitive permission', async () => {
    const encryptedRow = {
      ...row,
      contacts: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: 'PHONE',
          label: null,
          maskedValue: '0000•••000',
          encryptedValue: 'encrypted-contact',
          encryptionIv: 'iv-base64-value',
          encryptionAuthTag: 'auth-tag-base64-value',
          encryptionKeyVersion: 1,
          valueFingerprint: 'f'.repeat(64),
          isPrimary: true,
          verifiedAt: null,
          createdAt: row.createdAt,
        },
      ],
    };
    const repository = {
      find: vi.fn().mockResolvedValue(encryptedRow),
      auditSensitiveRead: vi.fn().mockResolvedValue(undefined),
    } as unknown as CustomerRepository;
    const { service, contactCrypto, nationalIdProtector } =
      createService(repository);

    const masked = await service.detail(row.id, actor);
    expect(masked.data.contacts[0]).toMatchObject({
      maskedValue: '0000•••000',
      value: null,
    });
    expect(masked.data.nationalId).toBeNull();
    expect(contactCrypto.decrypt).not.toHaveBeenCalled();
    expect(nationalIdProtector.decrypt).not.toHaveBeenCalled();
    expect(repository.auditSensitiveRead).not.toHaveBeenCalled();

    const sensitiveActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'customers.sensitive.read'],
    };
    const permissionWithoutReason = await service.detail(
      row.id,
      sensitiveActor,
    );
    expect(permissionWithoutReason.data.contacts[0]?.value).toBeNull();
    expect(contactCrypto.decrypt).not.toHaveBeenCalled();

    const sensitive = await service.detail(
      row.id,
      sensitiveActor,
      undefined,
      'customer-verification',
    );
    expect(sensitive.data.contacts[0]?.value).toBe('0000000000');
    expect(sensitive.data.nationalId).toBe('1234567891');
    expect(contactCrypto.decrypt).toHaveBeenCalledTimes(1);
    expect(nationalIdProtector.decrypt).toHaveBeenCalledWith(encryptedRow);
    expect(repository.auditSensitiveRead).toHaveBeenCalledWith(
      row.id,
      actor.userId,
      row.ownerBranchId,
      'customer-verification',
      undefined,
    );
  });

  it('requires permission and an allowlisted reason before unmasking', async () => {
    const repository = {
      find: vi.fn().mockResolvedValue(row),
      auditSensitiveRead: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository);

    await expect(
      service.detail(row.id, actor, undefined, 'support-request'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.detail(
        row.id,
        {
          ...actor,
          permissions: [...actor.permissions, 'customers.sensitive.read'],
        },
        undefined,
        'free-text-reason',
      ),
    ).rejects.toMatchObject({
      response: { code: 'CUSTOMER_SENSITIVE_READ_REASON_INVALID' },
    });
    expect(repository.auditSensitiveRead).not.toHaveBeenCalled();
  });

  it('returns a stable safe error when contact decryption fails', async () => {
    const encryptedRow = {
      ...row,
      contacts: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          type: 'PHONE',
          label: null,
          maskedValue: '0000•••000',
          encryptedValue: 'encrypted-contact',
          encryptionIv: 'iv-base64-value',
          encryptionAuthTag: 'auth-tag-base64-value',
          encryptionKeyVersion: 1,
          valueFingerprint: 'f'.repeat(64),
          isPrimary: true,
          verifiedAt: null,
          createdAt: row.createdAt,
        },
      ],
    };
    const repository = {
      find: vi.fn().mockResolvedValue(encryptedRow),
      auditSensitiveRead: vi.fn(),
    } as unknown as CustomerRepository;
    const { service } = createService(repository, {
      decrypt: vi.fn(() => {
        throw new Error('synthetic-decryption-failure');
      }),
    });

    await expect(
      service.detail(
        row.id,
        {
          ...actor,
          permissions: [...actor.permissions, 'customers.sensitive.read'],
        },
        undefined,
        'data-correction',
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'CUSTOMER_SENSITIVE_DECRYPTION_FAILED' },
    });
    expect(repository.auditSensitiveRead).not.toHaveBeenCalled();
  });
});

describe('Sales workflow agency creation permission', () => {
  const salesActor: AuthenticatedActor = {
    ...actor,
    permissions: [
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      'ui.screen.sales.new-contract',
    ],
  };
  it('allows a contract creator without customer read/create permissions and returns only a summary', async () => {
    const resolveSalesOrganization = vi.fn().mockResolvedValue({
      ...row,
      kind: 'ORGANIZATION',
      organizationId: 'org',
    });
    const { service } = createService({ resolveSalesOrganization } as never);
    const result = await service.resolveSalesOrganization(
      { id: 'org', name: 'Agency' },
      salesActor,
    );
    expect(result.data.kind).toBe('organization');
    expect(result.data).not.toHaveProperty('contacts');
    expect(resolveSalesOrganization).toHaveBeenCalledWith(
      'org',
      'Agency',
      actor.branchIds[0],
      actor.userId,
      undefined,
    );
  });
  it('denies read-only users, explicit screen denies, empty branches and unassigned branch requests before writing', async () => {
    const resolveSalesOrganization = vi.fn();
    const { service } = createService({ resolveSalesOrganization } as never);
    const deniedActors: AuthenticatedActor[] = [
      { ...salesActor, permissions: ['sales.contracts.read.own'] },
      {
        ...salesActor,
        permissions: [...salesActor.permissions, 'ui.deny.sales.new-contract'],
      },
      { ...salesActor, branchIds: [] },
    ];
    for (const user of deniedActors) {
      await expect(
        service.resolveSalesOrganization({ id: 'org', name: 'Agency' }, user),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(
      service.resolveSalesOrganization(
        { id: 'org', name: 'Agency' },
        salesActor,
        'outside',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(resolveSalesOrganization).not.toHaveBeenCalled();
  });
  it('keeps inactive dossier conflicts explicit', async () => {
    const { service } = createService({
      resolveSalesOrganization: vi.fn().mockResolvedValue(null),
    } as never);
    await expect(
      service.resolveSalesOrganization(
        { id: 'org', name: 'Agency' },
        salesActor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

it('derives bounded request-only customer entry capabilities for a contract-only actor', () => {
  const { service } = createService({} as CustomerRepository);
  const creator = {
    ...actor,
    permissions: [
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      'ui.screen.sales.new-contract',
      'ui.allow.sales.new-contract',
      'ui.deny.field.customers.passportNumber',
    ],
  } as AuthenticatedActor;
  const scoped = service.salesEntryActor(creator);
  expect(scoped.userId).toBe(creator.userId);
  expect(scoped.branchIds).toEqual(creator.branchIds);
  expect(scoped.permissions).toContain('customers.create');
  expect(scoped.permissions).toContain('customers.sensitive.read');
  expect(scoped.permissions).not.toContain(
    'ui.deny.field.customers.passportNumber',
  );
  expect(scoped.permissions).not.toContain('customers.merge');
  expect(creator.permissions).not.toContain('customers.create');
  expect(creator.permissions).toContain(
    'ui.deny.field.customers.passportNumber',
  );
  expect(() =>
    service.salesEntryActor({ ...creator, branchIds: [] }),
  ).toThrow();
  expect(() =>
    service.salesEntryActor({ ...actor, permissions: [] }),
  ).toThrow();
});
