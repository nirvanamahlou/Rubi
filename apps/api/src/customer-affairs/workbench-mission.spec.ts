import { describe, it, expect, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { CustomerAffairsService } from './customer-affairs.service';
const actor = {
  userId: 'sender',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
const finance = {
  amount: '120000',
  fee: '1000',
  title: 'رفت و آمد',
  costCenter: 'فروش',
  description: 'هزینه تاکسی',
  referToPetty: false,
  attachmentIds: [],
};
function fixture(to = '2020-01-01') {
  const mission = {
    destination: 'تهران',
    purpose: 'جلسه کاری',
    from: to,
    to,
    startTime: '09:00',
    endTime: '17:00',
  };
  const row = {
    id: 'ticket',
    version: 2,
    status: 'NEW',
    branchId: 'branch',
    subject: 'مأموریت',
    timeline: [
      {
        id: 'event',
        type: 'WORKBENCH_MISSION',
        summary: JSON.stringify(mission),
      },
    ],
  };
  const tx = {
    $queryRaw: vi.fn(),
    customerAffairsTicket: {
      findFirst: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    },
    customerAffairsTimeline: { update: vi.fn(), create: vi.fn() },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const service = Object.create(
    CustomerAffairsService.prototype,
  ) as CustomerAffairsService;
  const dependencies = {
    repository: {
      transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
    },
    documents: { assertLeaveEvidence: vi.fn() },
    requestDirectory: {
      hrLeaveRecipient: vi
        .fn()
        .mockResolvedValue({ recipientId: 'nima', unitId: 'hr' }),
    },
    notifications: { createWithinTransaction: vi.fn() },
  };
  Object.assign(service, dependencies);
  return { service, tx, row, mission, dependencies };
}
describe('workbench mission finance', () => {
  it('forces initial mission delivery to HR regardless of requested recipient', async () => {
    const t = fixture();
    const create = vi.fn().mockResolvedValue({ data: { id: 'ticket' } });
    Object.assign(t.service, { createTicket: create });
    await t.service.createWorkbenchRequest(
      {
        subject: 'مأموریت کاری',
        description: 'درخواست مأموریت کاری',
        priority: 'NORMAL',
        organizationUnitId: 'other',
        executionOwnerUserId: 'other',
        mission: t.mission,
      },
      actor,
      'branch',
      'key',
    );
    expect(create.mock.calls[0]![6]).toEqual(
      expect.objectContaining({
        unitId: 'hr',
        recipientId: 'nima',
        mission: t.mission,
      }),
    );
  });
  it('blocks expense submission before mission end', async () => {
    const t = fixture('2099-01-01');
    await expect(
      t.service.updateMissionFinance('ticket', { version: 2, finance }, actor),
    ).rejects.toThrow('پس از پایان');
    expect(t.tx.customerAffairsTicket.update).not.toHaveBeenCalled();
  });
  it('keeps original mission fields and routes financial submission to HR', async () => {
    const t = fixture();
    await t.service.updateMissionFinance(
      'ticket',
      { version: 2, finance, destination: 'changed' },
      actor,
    );
    expect(t.tx.customerAffairsTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdByUserId: 'sender',
          branchId: { in: ['branch'] },
        }),
      }),
    );
    expect(
      JSON.parse(
        t.tx.customerAffairsTimeline.update.mock.calls[0]![0].data.summary,
      ),
    ).toEqual({ ...t.mission, finance });
    expect(t.tx.customerAffairsTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionOwnerUserId: 'nima',
          executionUnit: 'منابع انسانی',
        }),
      }),
    );
    expect(t.dependencies.documents.assertLeaveEvidence).toHaveBeenCalledWith(
      [],
      'branch',
      'sender',
      'MissionEvidence',
    );
  });
  it('rejects stale updates and invalid amounts', async () => {
    const t = fixture();
    await expect(
      t.service.updateMissionFinance('ticket', { version: 1, finance }, actor),
    ).rejects.toThrow();
    await expect(
      t.service.updateMissionFinance(
        'ticket',
        { version: 2, finance: { ...finance, amount: '-1' } },
        actor,
      ),
    ).rejects.toThrow();
    expect(t.tx.customerAffairsTimeline.update).not.toHaveBeenCalled();
  });
});
