import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import type { HrPayrollFinancePublicService } from '../../hr/hr-payroll-finance-public.service';
import type { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import type { MasterOrganizationDirectory } from '../../master-data/master-organization-directory';
import { FinancePayrollService } from './finance-payroll.service';
const org = '11111111-1111-4111-8111-111111111111';
const branch = '22222222-2222-4222-8222-222222222222';
const user = '33333333-3333-4333-8333-333333333333';
const operationId = '44444444-4444-4444-8444-444444444444';
const actor = {
  userId: user,
  branchIds: [branch],
  permissions: ['finance.read', 'finance.request.manage'],
} as AuthenticatedActor;
const input = {
  operationId,
  branchId: branch,
  kind: 'CHECK',
  title: 'Synthetic check',
  party: 'untrusted label',
  description: '',
  reference: 'QA-001',
  amount: '10.50',
  currencyCode: 'IRR',
  dueAt: '2026-11-01',
  counterpartyOrganizationId: org,
  counterpartyRole: 'SUPPLIER',
};
function fixture() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    financeOperationalRequest: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: operationId, status: 'NEW' }),
    },
    financeOperationalRevision: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    client: {
      $transaction: vi.fn(async (run: (value: unknown) => unknown) => run(tx)),
    },
  };
  const directory = {
    cooperationReference: vi.fn().mockResolvedValue({
      id: org,
      isActive: true,
      legalName: 'Trusted synthetic supplier',
    }),
  };
  const master = { assertCurrency: vi.fn().mockResolvedValue(undefined) };
  return {
    tx,
    database,
    directory,
    service: new FinancePayrollService(
      database as unknown as DatabaseService,
      {} as HrPayrollFinancePublicService,
      undefined,
      undefined,
      master as unknown as MasterProcurementDirectory,
      directory as unknown as MasterOrganizationDirectory,
    ),
  };
}
describe('partner Finance requests', () => {
  it('persists an actual organization/role FK and trusted party snapshot in the existing workflow', async () => {
    const { service, tx, directory } = fixture();
    await expect(service.createManual(input, actor)).resolves.toEqual({
      requestId: operationId,
      status: 'NEW',
    });
    expect(directory.cooperationReference).toHaveBeenCalledWith(
      org,
      'SUPPLIER',
    );
    expect(tx.financeOperationalRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        counterpartyOrganizationId: org,
        counterpartyRole: 'SUPPLIER',
        party: 'Trusted synthetic supplier',
      }),
    });
    expect(tx.financeOperationalRevision.create).toHaveBeenCalledOnce();
    expect(tx.financeOperationalRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toStatus: 'NEW', action: 'CREATE' }),
    });
  });
  it('retains strict idempotency and never creates a second request on replay', async () => {
    const { service, tx } = fixture();
    await service.createManual(input, actor);
    const saved = tx.financeOperationalRequest.create.mock.calls[0]![0] as {
      data: { createFingerprint: string };
    };
    tx.financeOperationalRequest.findUnique.mockResolvedValue({
      id: operationId,
      status: 'NEW',
      requesterId: user,
      createFingerprint: saved.data.createFingerprint,
    } as never);
    await service.createManual(input, actor);
    expect(tx.financeOperationalRequest.create).toHaveBeenCalledOnce();
    await expect(
      service.createManual({ ...input, counterpartyRole: 'BROKER' }, actor),
    ).rejects.toThrow('شناسه');
  });
  it.each([
    { counterpartyOrganizationId: null },
    { counterpartyRole: 'AGENCY' },
    { kind: 'REFUND' },
    { reference: '' },
  ])('rejects invalid partner fields before transaction: %j', async (patch) => {
    const { service, database } = fixture();
    await expect(
      service.createManual({ ...input, ...patch }, actor),
    ).rejects.toThrow();
    expect(database.client.$transaction).not.toHaveBeenCalled();
  });
  it('denies another branch, missing permission or inactive identity', async () => {
    const { service, directory, database } = fixture();
    await expect(
      service.createManual({ ...input, branchId: org }, actor),
    ).rejects.toThrow();
    await expect(
      service.createManual(input, { ...actor, permissions: ['finance.read'] }),
    ).rejects.toThrow();
    directory.cooperationReference.mockResolvedValue({
      id: org,
      isActive: false,
      legalName: 'Inactive',
    });
    await expect(service.createManual(input, actor)).rejects.toThrow('فعال');
    expect(database.client.$transaction).not.toHaveBeenCalled();
  });
});
