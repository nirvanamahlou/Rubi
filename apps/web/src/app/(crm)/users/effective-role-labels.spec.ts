import { describe, expect, it } from 'vitest';
import { MANUAL_ACCESS_ROLE_PREFIX } from '@nora/contracts';
import { effectiveRoleLabels } from './effective-role-labels';

describe('saved role display precedence', () => {
  const administrator = {
    role: { code: 'administrator', name: 'مدیر سامانه', isActive: true },
  };
  const manual = {
    role: {
      code: MANUAL_ACCESS_ROLE_PREFIX + 'user',
      name: 'دسترسی کامل Demo',
      isActive: true,
    },
  };
  it('shows the newly saved effective role instead of the retained shared administrator membership', () => {
    expect(effectiveRoleLabels([administrator, manual])).toEqual([
      'دسترسی کامل',
    ]);
    expect(administrator.role.name).toBe('مدیر سامانه');
  });
  it('preserves active legacy role labels until a manual snapshot exists', () => {
    expect(effectiveRoleLabels([administrator])).toEqual(['مدیر سامانه']);
  });
  it('does not display inherited grants as effective when a manual snapshot is disabled', () => {
    expect(
      effectiveRoleLabels([
        administrator,
        { role: { ...manual.role, isActive: false } },
      ]),
    ).toEqual([]);
  });
});
