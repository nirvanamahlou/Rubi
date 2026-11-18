import { describe, expect, it } from 'vitest';
import {
  canViewRoute,
  canViewScreen,
  denyPermission,
  MANUAL_ACCESS_VERSION,
  screenPermission,
} from '../src';

const parent = 'sales.pricing.management';
const child = 'sales.pricing.floating';
const manual = [MANUAL_ACCESS_VERSION, 'ui.profile', 'package_pricing.read'];

describe('floating package screen compatibility', () => {
  it('inherits the existing package management screen for manual profiles', () => {
    const permissions = [...manual, screenPermission(parent)];
    expect(canViewScreen(permissions, child)).toBe(true);
    expect(canViewRoute(permissions, '/sales/pricing/floating')).toBe(true);
    expect(permissions).not.toContain('package_pricing.period.manage');
    expect(canViewScreen(permissions, 'sales.pricing.generator')).toBe(false);
  });

  it.each([child, parent])('retains explicit denial of %s', (denied) => {
    const permissions = [
      ...manual,
      screenPermission(parent),
      denyPermission(denied),
    ];
    expect(canViewScreen(permissions, child)).toBe(false);
    expect(canViewRoute(permissions, '/sales/pricing/floating')).toBe(false);
  });

  it('does not grant a screen to unrelated or empty manual profiles', () => {
    for (const permissions of [
      manual,
      [...manual, screenPermission('sales.pricing.generator')],
    ]) {
      expect(canViewScreen(permissions, child)).toBe(false);
      expect(canViewRoute(permissions, '/sales/pricing/floating')).toBe(false);
    }
  });

  it('retains separately granted floating access and legacy package visibility', () => {
    expect(canViewScreen([...manual, screenPermission(child)], child)).toBe(
      true,
    );
    expect(
      canViewRoute(['package_pricing.read'], '/sales/pricing/floating'),
    ).toBe(true);
  });
});
