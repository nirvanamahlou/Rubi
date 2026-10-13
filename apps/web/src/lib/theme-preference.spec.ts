import { describe, expect, it } from 'vitest';
import { resolveThemePreference } from './theme-preference';

describe('explicit theme preference', () => {
  it.each([null, '', 'system', 'invalid', 'light'])(
    'defaults to light for %s without consulting the OS preference',
    (saved) => {
      expect(resolveThemePreference(saved)).toBe('light');
    },
  );
  it('retains an explicitly chosen dark theme across page refreshes', () => {
    expect(resolveThemePreference('dark')).toBe('dark');
  });
});
