import { describe, it, expect, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';
const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.manage'],
} as AuthenticatedActor;
const id = '10000000-0000-4000-8000-000000000003';
function setup(count = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count });
  const service = new TicketPublicService(
    {
      client: { ticketSalePriceTarget: { updateMany } },
    } as unknown as DatabaseService,
    {} as ProcurementPublicService,
  );
  return { service, updateMany };
}
describe('sale target removal', () => {
  it('deactivates only the current active version in an authorized branch and retains history', async () => {
    const { service, updateMany } = setup();
    expect(await service.removeSalePriceTarget(id, 2, actor)).toEqual({
      data: { id, isActive: false, version: 3 },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, branchId: { in: ['branch'] }, isActive: true, version: 2 },
      data: { isActive: false, version: { increment: 1 } },
    });
  });
  it('rejects stale or inaccessible targets', async () => {
    const { service } = setup(0);
    await expect(service.removeSalePriceTarget(id, 2, actor)).rejects.toThrow(
      'مقصد تغییر کرده',
    );
  });
  it('requires permission and a valid version before touching storage', async () => {
    const { service, updateMany } = setup();
    await expect(
      service.removeSalePriceTarget(id, 2, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(service.removeSalePriceTarget(id, 0, actor)).rejects.toThrow(
      'نسخه معتبر',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
