import { it, expect, vi } from 'vitest';
import { IamReservationsDirectory } from './iam-reservations-directory';
it.each([
  ['finance_staff', 'کارشناس مالی', true],
  ['administrator', 'مدیر سامانه', true],
  ['custom', 'مدیر', true],
  ['sales_staff', 'کارشناس فروش', false],
  ['custom', 'رزرواسیون', false],
])('checks active assigned role %s', async (code, name, allowed) => {
  const service = new IamReservationsDirectory({
    client: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'ACTIVE',
          roles: [{ role: { isActive: true, code, name } }],
        }),
      },
    },
  } as never);
  expect(await service.canCorrectContractPrice('u')).toBe(allowed);
});
it('denies inactive users and inactive roles', async () => {
  const findUnique = vi.fn().mockResolvedValue({
    status: 'ACTIVE',
    roles: [
      {
        role: {
          isActive: false,
          code: 'finance_staff',
          name: 'کارشناس مالی',
        },
      },
    ],
  });
  const service = new IamReservationsDirectory({
    client: { user: { findUnique } },
  } as never);
  expect(await service.canCorrectContractPrice('u')).toBe(false);
  findUnique.mockResolvedValue({ status: 'INACTIVE', roles: [] });
  expect(await service.canCorrectContractPrice('u')).toBe(false);
});
