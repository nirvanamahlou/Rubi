import { describe, expect, it } from 'vitest';
import { canViewRoute, canViewScreen, screenPermission } from '../src/iam';

describe('shared authenticated assistant visibility (not data authorization)', () => {
  it.each([
    [],
    ['ui.administrator'],
    ['reporting.read'],
    ['finance.read'],
    ['assistant.read'],
    ['ui.profile'],
  ])('opens the shared shell for profile %j', (...permissions) => {
    expect(canViewRoute(permissions as string[], '/assistant')).toBe(true);
    expect(canViewScreen(permissions as string[], 'assistant.executive')).toBe(
      true,
    );
  });
  it('supports managed profiles and direct links without granting unrelated screens', () => {
    const grant = screenPermission('assistant.executive');
    expect(canViewRoute([grant], '/assistant?view=finance')).toBe(true);
    expect(canViewRoute(['ui.profile', grant], '/assistant?view=advisor')).toBe(
      true,
    );
    expect(canViewRoute(['ui.profile'], '/assistant?view=advisor')).toBe(true);
    expect(canViewRoute(['ui.profile'], '/finance')).toBe(false);
    expect(canViewScreen([], 'unknown.future.screen')).toBe(false);
  });
});
