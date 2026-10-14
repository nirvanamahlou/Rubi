import { describe, expect, it, vi } from 'vitest';
import { IamReservationsDirectory } from './iam-reservations-directory';
const role = (code: string, permissions: string[], isActive = true) => ({
  role: {
    code,
    name: code,
    isActive,
    permissions: permissions.map((code) => ({ permission: { code } })),
  },
});
describe('Reservations notification recipient directory', () => {
  it('honors exclusive manual-access snapshots and disabled roles instead of resurrecting shared grants', async () => {
    const tx = {
      user: {
        findMany: vi.fn(async () => [
          {
            id: 'allowed',
            roles: [role('reservations', ['reservations.read'])],
          },
          {
            id: 'inactive-role',
            roles: [role('reservations', ['reservations.read'], false)],
          },
          {
            id: 'manual-denied',
            roles: [
              role('reservations', ['reservations.read']),
              role('manual-access-v3-user', ['ui.manual.v3']),
            ],
          },
          {
            id: 'manual-allowed',
            roles: [
              role('manual-access-v3-user', [
                'ui.manual.v3',
                'reservations.read',
              ]),
            ],
          },
          {
            id: 'disabled-snapshot',
            roles: [
              role('reservations', ['reservations.read']),
              role('manual-access-v3-user', ['ui.manual.v3'], false),
            ],
          },
        ]),
      },
    };
    const service = new IamReservationsDirectory({} as never);
    expect(await service.recipients('branch', tx as never)).toEqual([
      'allowed',
      'manual-allowed',
    ]);
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          branches: {
            some: { branchId: 'branch', branch: { isActive: true } },
          },
        },
      }),
    );
  });
});
