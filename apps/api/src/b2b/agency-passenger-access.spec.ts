import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  AgencyPassengerAccessService,
  parseAgencyPassengerUpdate,
} from './agency-passenger-access.service';
import type { DatabaseService } from '../database/database.service';
import type { CustomerService } from '../customers/customer.service';
import type { B2bOrganizationUserService } from './b2b-organization-user.service';
const actor = (
  permissions: AuthenticatedActor['permissions'],
): AuthenticatedActor => ({
  userId: 'agency-user',
  sessionId: 's',
  branchIds: [],
  permissions,
});
describe('agency passenger access', () => {
  it('updates an owned passenger through bounded customer authority and returns no commercial data', async () => {
    const data = {
      id: 'passenger',
      version: 3,
      kind: 'person',
      roles: ['passenger'],
      ownerBranchId: 'branch',
      organizationId: null,
      firstName: 'Synthetic',
      lastName: 'Passenger',
      passportFirstName: 'Synthetic',
      passportLastName: 'Passenger',
      displayName: 'Synthetic Passenger',
      gender: 'M',
      nationalId: null,
      price: 999,
    };
    const update = vi.fn().mockResolvedValue({
      data: { ...data, version: 4, passportNumber: 'TEST123' },
    });
    const service = new AgencyPassengerAccessService(
      {
        client: {
          customer: { findMany: vi.fn().mockResolvedValue([{ id: 'buyer' }]) },
          salesContract: {
            findMany: vi
              .fn()
              .mockResolvedValue([
                { passengers: [{ customerId: 'passenger' }] },
              ]),
          },
        },
      } as unknown as DatabaseService,
      {
        member: vi.fn().mockResolvedValue({
          row: { organizationId: 'own', branchId: 'branch' },
        }),
      } as unknown as B2bOrganizationUserService,
      {
        detail: vi.fn().mockResolvedValue({ data }),
        update,
      } as unknown as CustomerService,
    );
    const result = await service.update(
      actor(['b2b.portal.passengers.read', 'b2b.portal.passengers.update']),
      'contract',
      'passenger',
      { version: 3, passportNumber: 'TEST123' },
    );
    expect(update.mock.calls[0]![1]).toMatchObject({
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      passportFirstName: data.passportFirstName,
      passportLastName: data.passportLastName,
      version: 3,
      passportNumber: 'TEST123',
    });
    const scoped = update.mock.calls[0]![2] as AuthenticatedActor;
    expect(scoped.branchIds).toEqual(['branch']);
    expect(scoped.permissions).toContain(
      'ui.allow.field.customers.passportNumber',
    );
    expect(scoped.permissions).not.toContain(
      'ui.allow.field.customers.firstName',
    );
    expect(result.data).toMatchObject({
      version: 4,
      passportNumber: 'TEST123',
    });
    expect(result.data).not.toHaveProperty('price');
  });
  it.each([
    'firstName',
    'lastName',
    'displayName',
    'passportFirstName',
    'passportLastName',
    'organizationId',
    'roles',
    'price',
    'status',
  ])('rejects injected %s, including names and commercial fields', (field) => {
    expect(() =>
      parseAgencyPassengerUpdate({ version: 1, [field]: 'changed' }),
    ).toThrow();
  });
  it('accepts only bounded identity fields with an optimistic version', () => {
    expect(
      parseAgencyPassengerUpdate({
        version: 2,
        gender: 'F',
        passportNumber: 'TEST123',
      }),
    ).toMatchObject({ version: 2 });
    expect(() => parseAgencyPassengerUpdate({ gender: 'F' })).toThrow();
  });
  it('rejects another agency passenger before accessing customer data, and revoked grants before reading membership', async () => {
    const member = vi.fn().mockResolvedValue({
      row: { organizationId: 'own', branchId: 'branch' },
    });
    const buyers = vi.fn().mockResolvedValue([{ id: 'buyer' }]);
    const contracts = vi.fn().mockResolvedValue([]);
    const detail = vi.fn();
    const service = new AgencyPassengerAccessService(
      {
        client: {
          customer: { findMany: buyers },
          salesContract: { findMany: contracts },
        },
      } as unknown as DatabaseService,
      { member } as unknown as B2bOrganizationUserService,
      { detail } as unknown as CustomerService,
    );
    await expect(
      service.detail(
        actor(['b2b.portal.passengers.read']),
        'foreign-contract',
        'foreign-passenger',
      ),
    ).rejects.toThrow();
    expect(contracts.mock.calls[0]![0].where).toMatchObject({
      customerId: { in: ['buyer'] },
      branchId: 'branch',
      id: 'foreign-contract',
    });
    expect(detail).not.toHaveBeenCalled();
    member.mockClear();
    await expect(service.list(actor([]))).rejects.toThrow();
    expect(member).not.toHaveBeenCalled();
    await expect(
      service.update(actor(['b2b.portal.passengers.read']), 'c', 'p', {
        version: 1,
        gender: 'F',
      }),
    ).rejects.toThrow();
  });
});
