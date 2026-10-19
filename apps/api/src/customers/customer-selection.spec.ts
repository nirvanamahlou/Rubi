import { ForbiddenException } from '@nestjs/common';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
  type CustomerListQuery,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';

const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'test',
  branchIds: ['branch'],
  permissions: ['finance.account.manage'],
};
const query: CustomerListQuery = {
  search: 'Sample',
  kind: 'person',
  status: 'all',
  role: 'all',
  branchId: 'all',
  sortBy: 'displayName',
  sortDirection: 'asc',
  page: 1,
  pageSize: 20,
};
describe('minimal customer workflow options', () => {
  it('requires consumer authority and permitted branches, not customer administration', async () => {
    const selectionOptions = vi
      .fn()
      .mockResolvedValue([{ id: 'person', displayName: 'Sample' }]);
    const service = new CustomerService(
      { selectionOptions } as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.selectionOptions(actor, 'accounting', query),
    ).resolves.toEqual({ data: [{ id: 'person', displayName: 'Sample' }] });
    expect(selectionOptions).toHaveBeenCalledWith(
      ['branch'],
      expect.objectContaining({ kind: 'person' }),
      false,
    );
    await expect(
      service.selectionOptions(actor, 'accounting', {
        ...query,
        branchId: 'outside',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.selectionOptions(
        { ...actor, permissions: ['customers.read'] },
        'accounting',
        query,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.selectionOptions(
        {
          ...actor,
          permissions: [MANUAL_ACCESS_VERSION, 'finance.account.manage'],
        },
        'accounting',
        query,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(selectionOptions).toHaveBeenCalledTimes(1);
  });
  it('searches names only and projects no contacts or identity documents', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'person',
        displayName: 'Sample',
        contacts: ['secret'],
        nationalId: 'secret',
        consents: [],
      },
    ]);
    const repository = new CustomerRepository({
      client: { customer: { findMany } },
    } as never);
    await expect(
      repository.selectionOptions(['branch'], {
        search: 'Sample',
        kind: 'person',
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toEqual([{ id: 'person', displayName: 'Sample' }]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerBranchId: { in: ['branch'] },
          mergedIntoId: null,
          isActive: true,
          displayName: { contains: 'Sample', mode: 'insensitive' },
        }),
        select: expect.objectContaining({ id: true, displayName: true }),
      }),
    );
    expect(findMany.mock.calls[0]![0].select).not.toHaveProperty('contacts');
  });
  it('excludes revoked/latest consent and never returns consent details for marketing', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'revoked', displayName: 'Old', consents: [{ status: 'REVOKED' }] },
      {
        id: 'granted',
        displayName: 'Current',
        consents: [{ status: 'GRANTED' }],
      },
      { id: 'missing', displayName: 'Missing', consents: [] },
    ]);
    const repository = new CustomerRepository({
      client: { customer: { findMany } },
    } as never);
    await expect(
      repository.selectionOptions(
        ['branch'],
        { search: '', kind: 'all', page: 1, pageSize: 20 },
        true,
      ),
    ).resolves.toEqual([{ id: 'granted', displayName: 'Current' }]);
    expect(findMany.mock.calls[0]![0].select.consents).toMatchObject({
      orderBy: { occurredAt: 'desc' },
      take: 1,
    });
  });
});
