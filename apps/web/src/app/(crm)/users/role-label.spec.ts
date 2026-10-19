import { describe, expect, it } from 'vitest';
import { roleLabel } from './role-label';

describe('legacy full-access role label', () => {
  it.each(['Demo', 'demo', 'DEMO'])(
    'removes only the full-access %s suffix',
    (suffix) => {
      expect(roleLabel(`دسترسی کامل ${suffix}`)).toBe('دسترسی کامل');
      expect(roleLabel(`مدیر سامانه، دسترسی کامل ${suffix}`)).toBe(
        'مدیر سامانه، دسترسی کامل',
      );
    },
  );
  it.each([
    'Demo',
    'Demo فروش',
    'Demonstration',
    'مدیر سامانه',
    'دسترسی کامل',
    'دسترسی کامل DemoTeam',
  ])('preserves unrelated names: %s', (name) => {
    expect(roleLabel(name)).toBe(name);
  });
});
