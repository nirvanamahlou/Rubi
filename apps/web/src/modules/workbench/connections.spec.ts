import { describe, expect, it, vi } from 'vitest';
import {
  allowedWorkbenchDestinations,
  canReadWorkbenchHr,
  readWorkbenchHrNotification,
} from './connections';
describe('Workbench owner connections', () => {
  it('uses only actual HR read scopes', () => {
    for (const permission of ['hr.read', 'hr.manage', 'hr.self', 'hr.team'])
      expect(canReadWorkbenchHr([permission])).toBe(true);
    expect(canReadWorkbenchHr(['hr.audit'])).toBe(false);
    expect(canReadWorkbenchHr([])).toBe(false);
  });
  it('routes each permitted owner without treating document permission as business-operation access', () => {
    expect(
      allowedWorkbenchDestinations([
        'sales.contracts.read.own',
        'reservations.read',
        'hr.self',
        'b2b.agency.read',
      ]).map((item) => item.href),
    ).toEqual(['/hr', '/sales', '/reservations', '/organizations']);
    expect(
      allowedWorkbenchDestinations(['finance.read', 'procurement.read']).map(
        (item) => item.href,
      ),
    ).toEqual(['/finance', '/purchases']);
    expect(
      allowedWorkbenchDestinations([
        'documents.finance.read',
        'documents.procurement.read',
      ]),
    ).toEqual([]);
  });
  it('announces HR read changes only after the owner confirms success', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('forbidden'))
      .mockResolvedValueOnce(undefined);
    const notify = vi.fn();
    await expect(
      readWorkbenchHrNotification('notice', read, notify),
    ).rejects.toThrow('forbidden');
    expect(notify).not.toHaveBeenCalled();
    await readWorkbenchHrNotification('notice', read, notify);
    expect(notify).toHaveBeenCalledOnce();
    expect(read).toHaveBeenLastCalledWith('notice');
  });
});
