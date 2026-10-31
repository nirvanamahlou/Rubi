import { describe, expect, it } from 'vitest';
import { manualSectionForScreen } from '../src/iam/manual-access';

describe('manual integration section isolation', () => {
  it('keeps website tour management in Integrations instead of native Tours', () => {
    expect(
      manualSectionForScreen({
        id: 'integrations.niyayesh.manage.tours',
        group: 'integrations',
        route: '/integrations',
      }),
    ).toBe('integrations');
    expect(
      manualSectionForScreen({
        id: 'ticket-catalog.tab.tours',
        group: 'sales',
        route: '/sales/tours',
      }),
    ).toBe('tours');
    expect(
      manualSectionForScreen({
        id: 'system.users',
        group: 'system',
        route: '/system/users',
      }),
    ).toBe('system');
  });
});
