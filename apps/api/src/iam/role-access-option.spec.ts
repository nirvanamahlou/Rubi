import { describe, it, expect } from 'vitest';
import { roleOptionSelection } from './role-access-option';
import { manualAccessSelection } from './manual-access-policy';
import { screenPermission } from '@nora/contracts';

describe('reusable saved roles', () => {
  it('projects legacy roles using their effective permissions', () => {
    const role = {
      id: 'legacy',
      code: 'staff',
      isActive: true,
      permissions: [{ permission: { code: 'iam.users.manage' } }],
    };
    expect(roleOptionSelection(role)).toEqual(
      manualAccessSelection({ roles: [{ role }] }),
    );
  });
  it('preserves explicitly selected template screens without requiring native read grants', () => {
    const role = {
      id: 'saved',
      code: 'personal-access-template-job-test',
      isActive: true,
      permissions: [{ permission: { code: screenPermission('system.users') } }],
    };
    expect(roleOptionSelection(role).screenIds).toContain('system.users');
    expect(roleOptionSelection(role).permissionCodes).toEqual([]);
  });
});
