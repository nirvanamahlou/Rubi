import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
function setup() {
  const create = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    reservationWorkflowRevision: {
      findFirst: vi.fn().mockResolvedValue(null),
      create,
    },
  };
  const database = {
    client: {
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    },
  };
  const amendments = { assertActive: vi.fn() };
  const service = new TravelWorkflowService(
    database as never,
    {} as never,
    {} as never,
    {} as never,
    amendments as never,
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    contractId: 'contract',
    branchId: 'branch',
    snapshot: { passengerIds: [] },
    workflow: initialTravelWorkflow(),
  } as never);
  const actor = {
    userId: 'server-actor',
    permissions: ['reservations.documents.manage'],
    branchIds: ['branch'],
  };
  return { service, actor, create, amendments };
}
describe('table status persistence', () => {
  it('stores server time and authenticated actor in the immutable workflow revision', async () => {
    const s = setup();
    const result = await s.service.update(
      'id',
      {
        action: 'TABLE_STATUS',
        expectedVersion: 0,
        note: 'اقدام ویزا',
        tableFlag: 'visaRequested',
        checked: true,
      },
      s.actor as never,
    );
    expect(result.tableFlags?.visaRequested).toMatchObject({
      checked: true,
      updatedByUserId: 'server-actor',
    });
    expect(
      Number.isFinite(Date.parse(result.tableFlags!.visaRequested!.updatedAt)),
    ).toBe(true);
    expect(
      s.create.mock.calls[0]?.[0].data.state.tableFlags.visaRequested
        .updatedByUserId,
    ).toBe('server-actor');
    expect(s.amendments.assertActive).toHaveBeenCalledWith(
      expect.anything(),
      'contract',
      ['branch'],
    );
  });
  it('rejects missing operation permission and cancelled contracts before persistence', async () => {
    const s = setup();
    const command = {
      action: 'TABLE_STATUS',
      expectedVersion: 0,
      note: 'اقدام ویزا',
      tableFlag: 'visaRequested',
      checked: true,
    } as const;
    await expect(
      s.service.update('id', command, { ...s.actor, permissions: [] } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    s.amendments.assertActive.mockRejectedValue(new ConflictException());
    await expect(
      s.service.update('id', command, s.actor as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(s.create).not.toHaveBeenCalled();
  });
});
