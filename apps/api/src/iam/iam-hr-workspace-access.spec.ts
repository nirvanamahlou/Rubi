import {
  canViewScreen,
  HR_PERMISSION_CODES,
  screenPermission,
} from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import { IamService } from './iam.service';

const service = Object.create(IamService.prototype) as IamService;

describe('HR workspace access', () => {
  it.each(['demo', 'nirvana', 'nima', 'danial'])(
    'grants full HR workspace access to %s',
    (username) => {
      const permissions = service['permissionCodes']({ username, roles: [] });
      expect(permissions).toEqual(
        expect.arrayContaining([...HR_PERMISSION_CODES]),
      );
      expect(canViewScreen(permissions, 'hr.home')).toBe(true);
    },
  );

  it('still denies HR access to a different account with an HR role', () => {
    const permissions = service['permissionCodes']({
      username: 'other',
      roles: [
        {
          role: {
            isActive: true,
            permissions: [{ permission: { code: 'hr.manage' } }],
          },
        },
      ],
    });
    expect(permissions).not.toContain('hr.manage');
    expect(permissions).not.toContain(screenPermission('hr.home'));
    expect(canViewScreen(permissions, 'hr.home')).toBe(false);
  });
});
