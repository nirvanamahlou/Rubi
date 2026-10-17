import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  PartnerPurchaseSourceV1,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { ReservationsPublicService } from '../reservations/reservations-public.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { FinancePartnerService } from './partner-finance.module';
const actor = {
  branchIds: ['branch'],
  permissions: ['finance.read', 'b2b.agency.read'],
} as AuthenticatedActor;
const source: PartnerPurchaseSourceV1 = {
  id: 'purchase',
  source: 'RESERVATIONS',
  sourceVersion: 1,
  title: 'QA',
  reference: 'QA',
  amount: '20',
  currencyCode: 'USD',
  createdAt: '2026-10-17T00:00:00Z',
  dueAt: null,
  current: true,
};
function fixture() {
  const directory = {
    partnerFinanceReference: vi.fn().mockResolvedValue({
      organizationId: 'org',
      organizationPurchaseId: 'org',
      supplierId: null,
      brokerId: 'broker',
    }),
  };
  const reservations = {
    partnerFinanceSources: vi.fn().mockResolvedValue([source]),
  };
  const procurement = { partnerFinanceSources: vi.fn().mockResolvedValue([]) };
  const database = {
    client: {
      financeOperationalRequest: { findMany: vi.fn().mockResolvedValue([]) },
      financeSupplierPaymentRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      financeProcurementInvoiceRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
  const service = new FinancePartnerService(
    database as unknown as DatabaseService,
    directory as unknown as MasterOrganizationDirectory,
    reservations as unknown as ReservationsPublicService,
    procurement as unknown as ProcurementPublicService,
  );
  return { service, directory, reservations, procurement, database };
}
describe('Finance partner public producer', () => {
  it('does not attribute an earlier invoice owner payment to the new supplier', async () => {
    const { service, reservations, procurement, directory, database } =
      fixture();
    reservations.partnerFinanceSources.mockResolvedValue([]);
    directory.partnerFinanceReference.mockResolvedValue({
      organizationId: 'org',
      organizationPurchaseId: 'org',
      supplierId: 'supplier',
      brokerId: null,
    } as never);
    procurement.partnerFinanceSources.mockResolvedValue([
      {
        ...source,
        source: 'PROCUREMENT',
        sourceVersion: 2,
        ownedVersions: [2],
      },
    ] as never);
    database.client.financeProcurementInvoiceRevision.findMany.mockResolvedValue(
      [
        {
          id: 'old-payment',
          sourceId: source.id,
          sourceVersion: 1,
          paidAmount: '9',
          paymentCurrencyCode: 'USD',
          status: 'PAID',
          createdAt: new Date(),
        },
      ] as never,
    );
    const result = await service.read('org', 'SUPPLIER', 'branch', actor);
    expect(result.payments).toEqual([]);
    expect(result.totals[0]?.balance).toBe('20');
  });
  it('blocks credit availability for paid standalone requests without purchase allocation', async () => {
    const { service, database } = fixture();
    database.client.financeOperationalRequest.findMany.mockResolvedValue([
      {
        id: 'check',
        kind: 'CHECK',
        title: 'QA',
        reference: 'QA',
        amount: '5',
        currencyCode: 'USD',
        status: 'PAID',
        dueAt: new Date(),
        revisions: [],
      },
    ] as never);
    const result = await service.read('org', 'BROKER', 'branch', actor);
    expect(result.reconciliationRequired).toEqual(['check']);
    expect(result.totals[0]?.balance).toBe('20');
    expect(
      await service.getPartnerExposure(
        {
          organizationId: 'org',
          role: 'BROKER',
          branchId: 'branch',
          currencyCode: 'USD',
        },
        actor,
      ),
    ).toMatchObject({ status: 'UNAVAILABLE' });
  });
  it('uses actual canonical references and received-credit direction', async () => {
    const { service, directory, reservations } = fixture();
    const result = await service.read('org', 'BROKER', 'branch', actor);
    expect(directory.partnerFinanceReference).toHaveBeenCalledWith(
      'org',
      'BROKER',
    );
    expect(reservations.partnerFinanceSources).toHaveBeenCalledWith(
      'branch',
      'org',
      'broker',
    );
    expect(result.creditDirection).toBe('COUNTERPARTY_TO_US');
    expect(result.totals[0]?.balance).toBe('20');
  });
  it('denies cross-branch and missing permission before resolving or querying source data', async () => {
    const { service, directory, database } = fixture();
    await expect(
      service.read('org', 'SUPPLIER', 'other', actor),
    ).rejects.toThrow();
    await expect(
      service.read('org', 'SUPPLIER', 'branch', {
        ...actor,
        permissions: ['b2b.agency.read'],
      }),
    ).rejects.toThrow();
    expect(directory.partnerFinanceReference).not.toHaveBeenCalled();
    expect(
      database.client.financeSupplierPaymentRevision.findMany,
    ).not.toHaveBeenCalled();
  });
  it('does not convert a failed owner source into an empty zero balance', async () => {
    const { service, reservations } = fixture();
    reservations.partnerFinanceSources.mockRejectedValue(
      new Error('source unavailable'),
    );
    await expect(
      service.read('org', 'BROKER', 'branch', actor),
    ).rejects.toThrow('source unavailable');
  });
  it('separates multi-role organization and broker purchase references', async () => {
    const { service, directory, reservations } = fixture();
    directory.partnerFinanceReference.mockResolvedValue({
      organizationId: 'org',
      organizationPurchaseId: null,
      supplierId: null,
      brokerId: 'broker',
    } as never);
    await service.read('org', 'BROKER', 'branch', actor);
    expect(reservations.partnerFinanceSources).toHaveBeenCalledWith(
      'branch',
      null,
      'broker',
    );
  });
  it('flags payments on replaced obligations for reconciliation', async () => {
    const { service, reservations, database } = fixture();
    reservations.partnerFinanceSources.mockResolvedValue([
      { ...source, current: false },
    ]);
    database.client.financeSupplierPaymentRevision.findMany.mockResolvedValue([
      {
        id: 'payment',
        purchaseId: source.id,
        status: 'PAID',
        paidAmount: null,
        cumulativePaid: null,
        createdAt: new Date(),
        transferAt: null,
        paymentReference: 'QA',
        paymentMethod: null,
      },
    ] as never);
    const result = await service.read('org', 'BROKER', 'branch', actor);
    expect(result.payments[0]?.amount).toBe('20');
    expect(result.reconciliationRequired).toEqual(['purchase']);
  });
});
