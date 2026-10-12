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
