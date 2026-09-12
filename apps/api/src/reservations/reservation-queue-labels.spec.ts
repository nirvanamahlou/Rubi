import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReservationRequestsController } from './reservations-runtime.module';

function setup(permissions: string[]) {
  const row = {
    id: 'intake',
    salesOwnerUserId: 'seller',
    snapshot: { customerId: 'party' },
  };
  const list = vi.fn().mockResolvedValue([row, { ...row, id: 'intake2' }]);
  const detail = vi
    .fn()
    .mockResolvedValue({
      data: { displayName: 'Agency', nationalId: 'never-project' },
    });
  const listUsers = vi
    .fn()
    .mockResolvedValue([
      { id: 'seller', displayName: 'Seller', email: 'never-project' },
    ]);
  const controller = new ReservationRequestsController(
    { list } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { detail } as never,
    { listUsers } as never,
  );
  const request = { actor: { permissions, branchIds: ['allowed'] } } as never;
  return { controller, request, detail, listUsers, list };
}
describe('reservation queue public labels', () => {
  it('deduplicates customer reads and projects only names with existing permissions', async () => {
    const s = setup(['reservations.read', 'customers.read', 'iam.users.read']);
    const result = await s.controller.list(s.request);
    expect(s.detail).toHaveBeenCalledTimes(1);
    expect(s.listUsers).toHaveBeenCalledTimes(1);
    expect(result.data[0]).toMatchObject({
      sellerName: 'Seller',
      contractPartyName: 'Agency',
    });
    expect(JSON.stringify(result)).not.toContain('never-project');
    expect(result.data[0]).not.toHaveProperty('salesOwnerUserId');
  });
  it('keeps the queue without invoking privileged name services when permissions are absent', async () => {
    const s = setup(['reservations.read']);
    const result = await s.controller.list(s.request);
    expect(s.detail).not.toHaveBeenCalled();
    expect(s.listUsers).not.toHaveBeenCalled();
    expect(result.data[0]).toMatchObject({
      sellerName: null,
      contractPartyName: null,
    });
  });
  it('does not reveal a customer outside the customer service scope', async () => {
    const s = setup(['reservations.read', 'customers.read']);
    s.detail.mockRejectedValue(new ForbiddenException());
    expect(
      (await s.controller.list(s.request)).data[0]?.contractPartyName,
    ).toBeNull();
  });
});
