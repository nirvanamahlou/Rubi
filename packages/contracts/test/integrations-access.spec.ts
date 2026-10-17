import { describe, expect, it } from 'vitest';
import {
  MANUAL_ACCESS_VERSION,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  allowAccessControl,
  canViewScreen,
  hasAccessControl,
  isUserAccessControlId,
  manualSectionForScreen,
  screenPermission,
  systemSettingControlId,
} from '../src';

const moduleId = 'system.module.integrations';
const fieldId = systemSettingControlId('integrations', 'registry');

describe('Integrations access in native user administration', () => {
  it('registers both required controls once in the Integrations section', () => {
    for (const id of [moduleId, fieldId]) {
      expect(isUserAccessControlId(id)).toBe(true);
      expect(USER_ACCESS_DENY_CONTROLS.filter((c) => c.id === id)).toHaveLength(
        1,
      );
      expect(USER_ACCESS_DENY_CONTROLS.find((c) => c.id === id)?.group).toBe(
        'integrations',
      );
    }
    const screen = USER_ACCESS_SCREENS.find((s) => s.id === moduleId)!;
    expect(screen.route).toBe('/integrations');
    expect(manualSectionForScreen(screen)).toBe('integrations');
  });

  it('keeps existing manual profiles denied until the module and field are selected', () => {
    const existing = [
      MANUAL_ACCESS_VERSION,
      screenPermission('integrations.home'),
    ];
    expect(hasAccessControl(existing, moduleId)).toBe(false);
    expect(hasAccessControl(existing, fieldId)).toBe(false);
    const selected = [
      ...existing,
      screenPermission(moduleId),
      allowAccessControl(moduleId),
      allowAccessControl(fieldId),
    ];
    expect(canViewScreen(selected, moduleId)).toBe(true);
    expect(hasAccessControl(selected, moduleId)).toBe(true);
    expect(hasAccessControl(selected, fieldId)).toBe(true);
    expect(hasAccessControl(selected, 'system.module.sales')).toBe(false);
    expect(
      hasAccessControl(selected, systemSettingControlId('sales', 'discount')),
    ).toBe(false);
    expect(hasAccessControl([...selected, `ui.deny.${fieldId}`], fieldId)).toBe(
      false,
    );
  });

  it('inherits the legacy Integrations route without opening system administration', () => {
    const legacy = [
      'ui.profile',
      'integrations.read',
      screenPermission('integrations.home'),
    ];
    expect(canViewScreen(legacy, moduleId)).toBe(true);
    expect(canViewScreen(legacy, 'system.users')).toBe(false);
    expect(canViewScreen(legacy, 'system.module.sales')).toBe(false);
  });
});
