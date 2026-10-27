import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor, SalesContractDetail } from '@nora/contracts';
import { SalesOutputService } from './sales-output.service';
import { SalesService } from './sales.service';
import type { SalesRepository } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { CustomerService } from '../customers/customer.service';
import type { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import type { IamFinanceDirectory } from '../iam/iam-finance-directory';
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
    salesOutputIdentity: vi.fn().mockResolvedValue({
      displayName: null,
      passportName: null,
      birthDate: null,
    }),
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
    documentOwnerName: vi
      .fn()
      .mockResolvedValue({ id: 'owner', displayName: 'نام نمونه' }),
  };
  const service = new SalesOutputService(
    sales as unknown as SalesService,
    repo as unknown as SalesRepository,
    customers as unknown as CustomerService,
    legal as unknown as LegalEntitiesService,
    iam as unknown as IamFinanceDirectory,
  );
  return { service, contract, sales, repo, customers, legal, iam };
}
describe('Sales saved output authorization', () => {
  it('uses the saved buyer contact even after the current customer address changes', async () => {
    const t = setup();
    t.contract.buyerContact = {
      name: 'Synthetic Buyer',
      phone: '09120000000',
      address: 'Saved address',
      postalCode: '0012345678',
    };
    t.customers.maskedDetail.mockResolvedValue({
      data: {
        kind: 'person',
        addresses: [{ isPrimary: true, label: 'Changed address' }],
      },
    } as never);
    const result = await t.service.prepare('contract', actor);
    expect(result.data.customer).toMatchObject({
      address: 'Saved address',
      phone: '09120000000',
      postalCode: '0012345678',
    });
  });
  it.each(['JAHAN_ACADEMIA', 'GHESATI_RO'])(
    'preserves the public issuer code %s in output and audit',
    async (code) => {
      const t = setup();
      t.legal.branding.mockResolvedValue({
        data: {
          legalEntityId: 'company',
          code,
          persianName: 'شرکت نمونه',
          latinName: null,
          website: null,
          version: 3,
        },
      });
      const result = await t.service.prepare('contract', actor);
      expect(result.data.company.code).toBe(code);
      expect(t.repo.recordOutputPreview).toHaveBeenCalledWith(
        'contract',
        expect.anything(),
        expect.objectContaining({ company: expect.objectContaining({ code }) }),
      );
    },
  );
  it('retains authoritative contract-read denial before reading document data', async () => {
    const t = setup();
    t.sales.detail.mockRejectedValue(new ForbiddenException());
    await expect(
      t.service.prepare('contract', { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.sales.detail).toHaveBeenCalled();
    expect(t.customers.maskedDetail).not.toHaveBeenCalled();
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
  it('returns the authorized document owner name without an IAM directory grant and audits a preview', async () => {
    const t = setup();
    const result = await t.service.prepare('contract', actor, 'trace');
    expect(result.data.contract.balances).toEqual(t.contract.balances);
    expect(t.iam.documentOwnerName).toHaveBeenCalledWith('owner');
    expect(result.data.ownerName).toBe('نام نمونه');
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

it('uses passport Latin names for contract output without mutating the saved contract', async () => {
  const t = setup();
  t.contract.passengersDetail = [
    {
      id: 'p',
      customerId: 'passenger',
      displayNameSnapshot: 'Wrong display name',
    },
  ] as never;
  t.customers.salesOutputIdentity.mockResolvedValue({
    displayName: 'CURRENT NAME',
    passportName: 'PASSPORT SURNAME',
    birthDate: '1991-02-03',
  } as never);
  const result = await t.service.prepare('contract', actor);
  expect(result.data.contract.passengersDetail[0]?.displayNameSnapshot).toBe(
    'PASSPORT SURNAME',
  );
  expect(result.data.contract.passengersDetail[0]?.birthDate).toBe(
    '1991-02-03',
  );
  expect(t.contract.passengersDetail[0]?.displayNameSnapshot).toBe(
    'Wrong display name',
  );
});

it('allows a creator to output their own contract without separate export/legal-directory grants', async () => {
  const t = setup();
  const result = await t.service.prepare('contract', {
    ...actor,
    permissions: ['sales.contracts.create'],
  });
  expect(result.data.ownerName).toBe('نام نمونه');
  expect(t.iam.documentOwnerName).toHaveBeenCalledWith('owner');
});
it('rejects another owner or branch for creator-only output without recording output', async () => {
  for (const scope of ['owner', 'branch']) {
    const t = setup();
    t.sales.detail.mockRejectedValue(new ForbiddenException(scope));
    await expect(
      t.service.prepare('contract', {
        ...actor,
        permissions: ['sales.contracts.create'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.repo.recordOutputPreview).not.toHaveBeenCalled();
    expect(t.iam.documentOwnerName).not.toHaveBeenCalled();
  }
});

it('prints the saved seller rather than the exporting manager without granting IAM access', async () => {
  const t = setup();
  t.contract.ownerUserId = 'other-seller';
  t.iam.documentOwnerName.mockResolvedValue({
    id: 'other-seller',
    displayName: 'Actual Seller',
  });
  const result = await t.service.prepare('contract', {
    ...actor,
    userId: 'manager',
    permissions: [
      'sales.contracts.read.all',
      'sales.export',
      'legal-entity.read',
    ],
  });
  expect(result.data.ownerName).toBe('Actual Seller');
  expect(t.iam.documentOwnerName).toHaveBeenCalledExactlyOnceWith(
    'other-seller',
  );
});
it('does not substitute the exporting user when the historical owner is missing', async () => {
  const t = setup();
  t.iam.documentOwnerName.mockResolvedValue(null as never);
  expect(
    (await t.service.prepare('contract', actor)).data.ownerName,
  ).toBeNull();
});

it.each(['own', 'branch', 'all'])(
  'allows an authorized %s reader to output the latest amended contract without export/company grants',
  async (scope) => {
    const t = setup();
    const reader: AuthenticatedActor = {
      ...actor,
      branchIds: scope === 'all' ? [] : actor.branchIds,
      permissions: [
        `sales.contracts.read.${scope}` as 'sales.contracts.read.own',
      ],
    };
    t.contract.version = 9;
    t.contract.passengersDetail = [
      {
        id: 'p',
        customerId: 'passenger',
        displayNameSnapshot: 'Corrected Name',
      },
    ] as never;
    const result = await t.service.prepare('contract', reader);
    expect(t.sales.detail).toHaveBeenCalledExactlyOnceWith('contract', reader);
    expect(result.data.contract.version).toBe(9);
    expect(result.data.contract.passengersDetail[0]?.displayNameSnapshot).toBe(
      'Corrected Name',
    );
    expect(t.customers.salesOutputIdentity).toHaveBeenCalledWith(
      'passenger',
      expect.objectContaining({
        userId: reader.userId,
        branchIds: expect.arrayContaining([t.contract.branchId]),
        permissions: expect.arrayContaining(['sales.export']),
      }),
      undefined,
    );
    expect(reader.permissions).toEqual([`sales.contracts.read.${scope}`]);
    expect(reader.branchIds).toEqual(scope === 'all' ? [] : actor.branchIds);
    expect(t.repo.recordOutputPreview).toHaveBeenCalledWith(
      'contract',
      expect.anything(),
      expect.objectContaining({ contractVersion: 9 }),
    );
  },
);
