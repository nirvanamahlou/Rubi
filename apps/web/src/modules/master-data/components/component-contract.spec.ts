import { describe, expect, it } from 'vitest';

import { masterDataCatalog } from '../model/catalog';
import { proposedPermissionMatrix } from '../model/permissions';
import {
  MASTER_DATA_BLOCKER_TITLE,
  MASTER_DATA_PREVIEW_DISCLOSURE,
  masterDataComponentContract,
  masterDataStateOptions,
} from './component-contract';

describe('master data component contract', () => {
  it('requires every loading and authorization state', () => {
    expect(masterDataStateOptions.map(([state]) => state)).toEqual([
      'empty',
      'loading',
      'error',
      'forbidden',
      'preview',
    ]);
    expect(masterDataComponentContract.direction).toBe('rtl');
  });

  it('makes non-persistence and migration lock explicit', () => {
    expect(MASTER_DATA_PREVIEW_DISCLOSURE).toContain('ذخیره‌نشده');
    expect(MASTER_DATA_BLOCKER_TITLE).toBe('Blocked by Migration Lock');
  });

  it('covers the full catalog and deny-by-default viewer behavior', () => {
    expect(masterDataCatalog).toHaveLength(41);
    expect(proposedPermissionMatrix.viewer).toEqual(['master_data.read']);
    expect(proposedPermissionMatrix.viewer).not.toContain('master_data.export');
  });
});
