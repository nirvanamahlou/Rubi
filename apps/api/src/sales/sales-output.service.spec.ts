import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor, SalesContractDetail } from '@rubi/contracts';
import { SalesOutputService } from './sales-output.service';
import { SalesService } from './sales.service';
import type { SalesRepository } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { CustomerService } from '../customers/customer.service';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import type { IamService } from '../iam/iam.service';
const actor: AuthenticatedActor = {
  userId: 'owner',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'sales.export',
    'sales.contracts.read.own',
    'legal-entity.read',
  ],
};
function setup() {
  const contract = {
    id: 'contract',
    customerId: 'buyer',
    ownerUserId: 'owner',
    branchId: 'branch',
    status: 'CONFIRMED',
    version: 2,
    balances: [{ amount: '123.45', currencyCode: 'IRR' }],
  } as unknown as SalesContractDetail;
  const sales = { detail: vi.fn().mockResolvedValue({ data: contract }) };
  const repo = { recordOutputPreview: vi.fn().mockResolvedValue({}) };
  const customers = {
    maskedDetail: vi
      .fn()
      .mockResolvedValue({ data: { kind: 'person', addresses: [] } }),
  };
  const legal = {
    current: vi.fn().mockResolvedValue({
      data: { isAggregate: false, legalEntity: { id: 'company' } },
    }),
    branding: vi.fn().mockResolvedValue({
      data: {
        legalEntityId: 'company',
        code: 'NIYAYESH_SEIR_SAHAR',
        persianName: 'نمونه',
        latinName: null,
        website: null,
        version: 1,
      },
    }),
  };
  const iam = {
    listUsers: vi
      .fn()
      .mockResolvedValue([{ id: 'owner', displayName: 'نام نمونه' }]),
  };
  const service = new SalesOutputService(
    sales as unknown as SalesService,
    repo as unknown as SalesRepository,
    customers as unknown as CustomerService,
    legal as unknown as LegalEntitiesService,
    iam as unknown as IamService,
  );
  return { service, contract, sales, repo, customers, legal, iam };
}
describe('Sales saved output authorization', () => {
  it('denies export without existing permission before reading any data', async () => {
    const t = setup();
    await expect(
      t.service.prepare('contract', { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.sales.detail).not.toHaveBeenCalled();
    expect(t.repo.recordOutputPreview).not.toHaveBeenCalled();
  });
  it('delegates existing contract scope and propagates forbidden access', async () => {
    const t = setup();
    t.sales.detail.mockRejectedValue(new ForbiddenException());
    await expect(t.service.prepare('other', actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(t.sales.detail).toHaveBeenCalledWith('other', actor);
    expect(t.legal.current).not.toHaveBeenCalled();
  });
  it('existing Sales policy rejects another counter and another branch', async () => {
    for (const patch of [{ ownerUserId: 'other' }, { branchId: 'other' }]) {
      const repo = {
        findById: vi.fn().mockResolvedValue({
          id: 'contract',
          ownerUserId: 'owner',
          branchId: 'branch',
          assignedUserId: null,
          ...patch,
        }),
      };
      const sales = new SalesService(
        repo as unknown as SalesRepository,
        {} as SalesCustomersPublicAdapter,
        {} as SalesTicketAvailabilityPort,
      );
      await expect(sales.detail('contract', actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
  });
  it('rejects unconfirmed contracts and aggregate branding', async () => {
    const t = setup();
    t.contract.status = 'DRAFT';
    await expect(t.service.prepare('contract', actor)).rejects.toThrow('تأیید');
    t.contract.status = 'CONFIRMED';
    t.legal.current.mockResolvedValue({
      data: { isAggregate: true, legalEntity: { id: 'company' } },
    });
    await expect(t.service.prepare('contract', actor)).rejects.toThrow(
      'شرکت مشخص',
    );
  });
  it('returns saved amounts, omits ungranted IAM names and audits a preview rather than official issue', async () => {
    const t = setup();
    const result = await t.service.prepare('contract', actor, 'trace');
    expect(result.data.contract.balances).toEqual(t.contract.balances);
    expect(t.iam.listUsers).not.toHaveBeenCalled();
    expect(result.data.ownerName).toBeNull();
    expect(t.repo.recordOutputPreview).toHaveBeenCalledWith(
      'contract',
      expect.objectContaining({
        userId: 'owner',
        branchId: 'branch',
        traceId: 'trace',
      }),
      expect.objectContaining({
        officialIssuance: false,
        contractVersion: 2,
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(t.customers.maskedDetail).toHaveBeenCalledWith('buyer', actor);
  });
});
