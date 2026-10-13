import { describe, expect, it } from 'vitest';

import {
  assertMarketingPermission,
  hasMarketingPermission,
  marketingActionPermission,
  marketingPermissions,
} from './marketing.permissions';

describe('marketing permission proposal', () => {
  it('contains every requested module-local permission exactly once', () => {
    expect(marketingPermissions).toHaveLength(18);
    expect(new Set(marketingPermissions).size).toBe(
      marketingPermissions.length,
    );
    expect(marketingPermissions).toContain('marketing.sensitive_summary.read');
  });

  it('is deny-by-default for empty and unrelated grants', () => {
    expect(hasMarketingPermission([], 'campaign.read')).toBe(false);
    expect(hasMarketingPermission(['iam.audit.read'], 'audit.read')).toBe(
      false,
    );
    expect(() => assertMarketingPermission([], 'campaign.create')).toThrow(
      'deny-by-default',
    );
  });

  it('maps every action to a known marketing permission', () => {
    for (const permission of Object.values(marketingActionPermission)) {
      expect(marketingPermissions).toContain(permission);
    }
    expect(
      hasMarketingPermission(
        ['marketing.campaign.approve'],
        'campaign.approve',
      ),
    ).toBe(true);
  });
});
