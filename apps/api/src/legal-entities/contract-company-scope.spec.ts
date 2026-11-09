import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { LegalEntitiesService } from './legal-entities.service';
import { ContractCompanyScope } from '../sales/contract-company-scope.public';

const id = '11111111-1111-4111-8111-111111111111';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: ['system.settings.read', 'system.settings.manage'],
};
function setup() {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    salesContract: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn(),
    },
    salesContractAuditEvent: { createMany: vi.fn() },
    reservationIntake: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const db = {
    client: {
      ...tx,
      $transaction: vi.fn(async (work) =>
        typeof work === 'function' ? work(tx) : Promise.all(work),
      ),
    },
  };
  const entities = {
    current: vi.fn().mockResolvedValue({
      data: { isAggregate: false, legalEntity: { id: 'selected-company' } },
    }),
  };
  const scope = new ContractCompanyScope(
    db as unknown as DatabaseService,
    entities as unknown as LegalEntitiesService,
  );
  return { scope, tx, entities };
}
describe('saved contract company and reversible archive', () => {
  it('shares reservation contracts across issuers without selecting aggregate context', async () => {
    const t = setup();
    t.tx.salesContract.findMany.mockResolvedValue([
      { id: 'company-a-contract' },
      { id: 'company-b-contract' },
    ] as never);
    expect(await t.scope.reservationInboxIds(['branch'])).toEqual([
      'company-a-contract',
      'company-b-contract',
    ]);
    expect(t.tx.salesContract.findMany).toHaveBeenCalledWith({
      where: { hiddenAt: null, branchId: { in: ['branch'] } },
      select: { id: true },
    });
    expect(t.entities.current).not.toHaveBeenCalled();
    await t.scope.reservationInboxIds([]);
    expect(t.tx.salesContract.findMany).toHaveBeenLastCalledWith({
      where: { hiddenAt: null, branchId: { in: [] } },
      select: { id: true },
    });
  });
  it('uses the selected company for new writes and all visible lists', async () => {
    const t = setup();
    expect(await t.scope.selected(actor, true)).toBe('selected-company');
    expect(await t.scope.where(actor)).toEqual({
      legalEntityId: 'selected-company',
      hiddenAt: null,
    });
    t.entities.current.mockResolvedValue({
      data: { isAggregate: false, legalEntity: { id: 'other-company' } },
    });
    expect(await t.scope.selected(actor, true)).toBe('other-company');
  });
  it('allows aggregate reads only with permission and never aggregate writes', async () => {
    const t = setup();
    t.entities.current.mockResolvedValue({
      data: { isAggregate: true },
    } as never);
    await expect(t.scope.where(actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const aggregate = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'legal-entity.aggregate.read' as const,
      ],
    };
    expect(await t.scope.where(aggregate)).toEqual({ hiddenAt: null });
    await expect(t.scope.selected(aggregate, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('reads document ownership from the saved contract, never the viewing user switch', async () => {
    const t = setup();
    t.tx.salesContract.findUnique.mockResolvedValue({
      legalEntity: { id: 'saved-company' },
    });
    expect(await t.scope.owner(id)).toEqual({ id: 'saved-company' });
    expect(t.entities.current).not.toHaveBeenCalled();
  });
  it('applies company, hidden state, branches and search before paging', async () => {
    const t = setup();
    await t.scope.hidden(actor, '120001', 2);
    expect(t.tx.salesContract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        where: {
          AND: [
            { legalEntityId: 'selected-company', hiddenAt: { not: null } },
            { branchId: { in: ['branch'] } },
            expect.anything(),
          ],
        },
      }),
    );
  });
  it('locks, restores and audits only the requested hidden contracts', async () => {
    const t = setup();
    t.tx.salesContract.findMany.mockResolvedValue([
      {
        id,
        branchId: 'branch',
        legalEntityId: 'selected-company',
        hiddenAt: new Date('2026-11-08'),
      },
    ] as never);
    expect(await t.scope.restore(actor, { ids: [id, id] })).toEqual({
      restored: 1,
    });
    expect(t.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(t.tx.salesContract.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [id] } },
      data: { hiddenAt: null },
    });
    expect(t.tx.salesContractAuditEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          action: 'sales.contract.restored',
          actorUserId: actor.userId,
          afterSnapshot: { hiddenAt: null, legalEntityId: 'selected-company' },
        }),
      ],
    });
  });
  it('rejects inaccessible selections atomically and requires restore permission', async () => {
    const t = setup();
    await expect(t.scope.restore(actor, { ids: [id] })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(t.tx.salesContract.updateMany).not.toHaveBeenCalled();
    await expect(
      t.scope.restore(
        { ...actor, permissions: ['system.settings.read'] },
        { ids: [id] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('hides contract-linked finance events and refund requests by source references', async () => {
    const t = setup();
    t.tx.salesContract.findMany.mockResolvedValue([
      { id, contractNumber: '120001' },
    ] as never);
    t.tx.reservationIntake.findMany.mockResolvedValue([
      {
        id: 'intake',
        requestId: 'request',
        servicePurchases: [{ id: 'purchase' }],
      },
    ] as never);
    expect(await t.scope.eventWhere(actor)).toEqual({
      AND: [
        { requestId: { notIn: [id, 'intake', 'request', 'purchase'] } },
        {
          OR: [
            { trackingNumber: null },
            { trackingNumber: { notIn: ['120001'] } },
          ],
        },
      ],
    });
    expect(await t.scope.operationalWhere(actor)).toEqual({
      AND: [
        { reference: { notIn: [id, '120001'] } },
        {
          OR: [
            { refundReceiptId: null },
            { refundReceipt: { contractId: { notIn: [id] } } },
          ],
        },
      ],
    });
  });
});
