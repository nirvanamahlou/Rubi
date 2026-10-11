import { describe, expect, it } from 'vitest';
import { canViewRoute, canViewScreen, screenPermission } from '../src/iam';

describe('explicit executive assistant access', () => {
  it.each([
    [],
    ['ui.administrator'],
    ['reporting.read'],
    ['finance.read'],
    ['assistant.read'],
    ['ui.profile'],
  ])('does not infer CEO access from %j', (...permissions) => {
    expect(canViewRoute(permissions as string[], '/assistant')).toBe(false);
    expect(canViewScreen(permissions as string[], 'assistant.executive')).toBe(
      false,
    );
  });
  it('allows only an explicit grant, including on managed profiles and direct links', () => {
    const grant = screenPermission('assistant.executive');
    expect(canViewRoute([grant], '/assistant?view=finance')).toBe(true);
    expect(canViewRoute(['ui.profile', grant], '/assistant?view=advisor')).toBe(
      true,
    );
    expect(canViewRoute(['ui.profile'], '/assistant?view=advisor')).toBe(false);
  });
});
