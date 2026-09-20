import { describe, expect, it } from 'vitest';

import { hasProposedPermission } from './permissions';

describe('proposed master data permissions', () => {
  it('keeps viewer deny-by-default for mutations and export', () => {
    expect(hasProposedPermission('viewer', 'master_data.read')).toBe(true);
    expect(hasProposedPermission('viewer', 'master_data.create')).toBe(false);
    expect(hasProposedPermission('viewer', 'master_data.export')).toBe(false);
  });

  it('reserves status management for manager', () => {
    expect(hasProposedPermission('editor', 'master_data.status.manage')).toBe(
      false,
    );
    expect(hasProposedPermission('manager', 'master_data.status.manage')).toBe(
      true,
    );
  });
});
