import { describe, expect, it } from 'vitest';
import {
  canViewScreen,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
} from '../src/iam';

describe('Workbench daily package screen access', () => {
  it('inherits the existing Workbench home visibility', () => {
    expect(
      canViewScreen(
        [USER_ACCESS_PROFILE_PERMISSION, screenPermission('workbench.home')],
        'workbench.tab.daily-packages',
      ),
    ).toBe(true);
    expect(canViewScreen([], 'workbench.tab.daily-packages')).toBe(false);
  });
});
