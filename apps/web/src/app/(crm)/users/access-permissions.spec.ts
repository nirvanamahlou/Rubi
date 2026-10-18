import { describe, expect, it } from 'vitest';
import { permissionInSection, permissionLabel } from './access-permissions';

describe('site management operation in user access settings', () => {
  it('makes the existing operation discoverable under Integrations and retains System management', () => {
    expect(permissionInSection('system.settings.manage', 'integrations')).toBe(
      true,
    );
    expect(permissionInSection('system.settings.manage', 'system')).toBe(true);
    expect(permissionInSection('iam.users.manage', 'integrations')).toBe(false);
    expect(permissionInSection('system.settings.read', 'integrations')).toBe(
      false,
    );
    expect(permissionInSection('system.settings.manage', 'sales')).toBe(false);
  });

  it('gives the same native permission a searchable website label without changing its identity', () => {
    const permission = {
      code: 'system.settings.manage',
      name: 'مدیریت تنظیمات',
    };
    expect(permissionLabel(permission, 'integrations')).toContain('سایت');
    expect(permissionLabel(permission, 'system')).toBe(permission.name);
    expect(permission.code).toBe('system.settings.manage');
    expect(
      permissionLabel(
        { code: 'iam.users.read', name: 'مشاهده کاربران' },
        'system',
      ),
    ).toBe('مشاهده کاربران');
  });
});
