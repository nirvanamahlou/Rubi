import type { DatabaseService } from '../database/database.service';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRepository, toCustomerDetail } from './customer.repository';

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
  ownerBranchId: '33333333-3333-4333-8333-333333333333',
  version: 1,
  createdAt: new Date('2026-08-24T00:00:00.000Z'),
  updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  contacts: [],
  addresses: [],
  consents: [],
  relationships: [],
  _count: { relationships: 0 },
};

describe('CustomerRepository', () => {
  it('allows only one atomic update claim and writes one audit event', async () => {
    let version = 1;
    const customer = {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { version: number } }) => {
            if (where.version !== version) return { count: 0 };
            version += 1;
            return { count: 1 };
          },
        ),
      update: vi.fn().mockImplementation(async () => ({ ...row, version })),
    };
    const audit = { create: vi.fn().mockResolvedValue({ id: 'audit' }) };
    const transaction = { customer, customerAuditEvent: audit };
    const database = {
      client: {
        $transaction: async <T>(
          callback: (client: typeof transaction) => Promise<T>,
        ) => callback(transaction),
      },
    } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);
    const results = await Promise.all([
      repository.update(
        row.id,
        [row.ownerBranchId],
        { displayName: 'ویرایش یک' },
        1,
        '11111111-1111-4111-8111-111111111111',
        row.ownerBranchId,
      ),
      repository.update(
        row.id,
        [row.ownerBranchId],
        { displayName: 'ویرایش دو' },
        1,
        '11111111-1111-4111-8111-111111111111',
        row.ownerBranchId,
      ),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(audit.create).toHaveBeenCalledTimes(1);
    const snapshot = JSON.stringify(audit.create.mock.calls[0]?.[0]);
    expect(snapshot).not.toContain('نمونه');
    expect(snapshot).not.toContain('آزمایشی');
    expect(snapshot).not.toContain('1990-01-01');
    expect(snapshot).toContain('changedFields');
  });

  it('promotes an existing customer to passenger in the relationship transaction', async () => {
    const related = {
      ...row,
      id: '55555555-5555-4555-8555-555555555555',
      isPassenger: false,
    };
    const customer = {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce(related),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({
        ...related,
        isPassenger: true,
        version: 2,
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    };
    const customerRelationship = {
      create: vi.fn().mockResolvedValue({
        id: '66666666-6666-4666-8666-666666666666',
        customerId: row.id,
        relatedCustomerId: related.id,
        relationshipType: 'COMPANION',
      }),
    };
    const customerAuditEvent = {
      create: vi.fn().mockResolvedValue({ id: 'audit' }),
    };
    const transaction = {
      customer,
      customerRelationship,
      customerAuditEvent,
    };
    const database = {
      client: {
        $transaction: async <T>(
          callback: (client: typeof transaction) => Promise<T>,
        ) => callback(transaction),
      },
    } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);

    await repository.addCompanion(
      row.id,
      [row.ownerBranchId],
      {
        relatedCustomerId: related.id,
        relationshipType: 'companion',
        version: row.version,
      },
      '11111111-1111-4111-8111-111111111111',
      row.ownerBranchId,
    );

    expect(customer.update).toHaveBeenCalledWith({
      where: { id: related.id },
      data: {
        isPassenger: true,
        version: { increment: 1 },
        updatedByUserId: '11111111-1111-4111-8111-111111111111',
      },
    });
    expect(customerRelationship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ relatedCustomerId: related.id }),
    });
    expect(customerAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'customers.role.passenger.add',
        entityId: related.id,
      }),
    });
    expect(JSON.stringify(customerAuditEvent.create.mock.calls)).not.toContain(
      related.displayName,
    );
  });

  it('searches an exact customer code without weakening branch scope', async () => {
    const customer = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    const database = { client: { customer } } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);

    await repository.list([row.ownerBranchId], {
      search: row.id,
      status: 'all',
      role: 'all',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    });

    expect(customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerBranchId: { in: [row.ownerBranchId] },
          OR: expect.arrayContaining([{ id: row.id }]),
        }),
      }),
    );
  });

  it('applies only allowlisted model-backed list filters', async () => {
    const customer = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    const database = { client: { customer } } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);

    await repository.list([row.ownerBranchId], {
      search: '',
      kind: 'organization',
      status: 'inactive',
      role: 'customer',
      acquaintanceMethodId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-31',
      updatedFrom: '2026-08-10',
      updatedTo: '2026-08-20',
      sortBy: 'createdAt',
      sortDirection: 'asc',
      page: 2,
      pageSize: 10,
    });

    expect(customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerBranchId: { in: [row.ownerBranchId] },
          kind: 'ORGANIZATION',
          isActive: false,
          isCustomer: true,
          acquaintanceMethodId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          createdAt: {
            gte: new Date('2026-08-01'),
            lte: new Date('2026-08-31T23:59:59.999Z'),
          },
          updatedAt: {
            gte: new Date('2026-08-10'),
            lte: new Date('2026-08-20T23:59:59.999Z'),
          },
        }),
        orderBy: { createdAt: 'asc' },
        skip: 10,
        take: 10,
      }),
    );
    expect(customer.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        kind: 'PERSON',
        isCustomer: true,
        ownerBranchId: { in: [row.ownerBranchId] },
      }),
    });
    expect(customer.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        kind: 'PERSON',
        isPassenger: true,
        ownerBranchId: { in: [row.ownerBranchId] },
      }),
    });
  });

  it('reads branch-scoped audit with a safe explicit select', async () => {
    const customer = { findFirst: vi.fn().mockResolvedValue({ id: row.id }) };
    const customerDuplicateCandidate = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    const customerAuditEvent = { findMany: vi.fn().mockResolvedValue([]) };
    const database = {
      client: { customer, customerDuplicateCandidate, customerAuditEvent },
    } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);

    await repository.audit(row.id, [row.ownerBranchId]);

    expect(customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerBranchId: { in: [row.ownerBranchId] },
        }),
      }),
    );
    const auditQuery = customerAuditEvent.findMany.mock.calls[0]?.[0];
    expect(auditQuery.select).toEqual(
      expect.objectContaining({ action: true, reason: true, occurredAt: true }),
    );
    expect(auditQuery.select).not.toHaveProperty('beforeSnapshot');
    expect(auditQuery.select).not.toHaveProperty('afterSnapshot');
    expect(auditQuery).toMatchObject({ take: 200 });
  });

  it('masks restricted birth date unless permission was granted upstream', () => {
    expect(toCustomerDetail(row as never, false)).toMatchObject({
      birthDate: null,
      birthDateMasked: true,
    });
    expect(toCustomerDetail(row as never, true).birthDate).toBe('1990-01-01');
  });
  it('queries duplicate candidates with branch isolation, indexed fingerprints and a hard limit', async () => {
    const customer = {
      findFirst: vi.fn().mockResolvedValue({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        birthDate: row.birthDate,
        contacts: [{ valueFingerprint: 'f'.repeat(64) }],
      }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const database = { client: { customer } } as unknown as DatabaseService;
    const repository = new CustomerRepository(database);
    await repository.duplicateInputs(row.id, [row.ownerBranchId]);

    expect(customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: row.id },
          ownerBranchId: { in: [row.ownerBranchId] },
          mergedIntoId: null,
          OR: expect.arrayContaining([
            {
              contacts: {
                some: { valueFingerprint: { in: ['f'.repeat(64)] } },
              },
            },
          ]),
        }),
        take: 50,
      }),
    );
    const query = customer.findMany.mock.calls[0]?.[0];
    expect(query).not.toHaveProperty('include');
    expect(query.where).not.toEqual({
      ownerBranchId: { in: [row.ownerBranchId] },
    });
  });
});
