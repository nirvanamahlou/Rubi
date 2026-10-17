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

describe('migrated assistant dashboard pages', () => {
  const views = [
    'overview',
    'sales',
    'finance',
    'news',
    'scenarios',
    'advisor',
  ];
  it.each(views)(
    'preserves original access for %s without granting other dashboard pages',
    (view) => {
      for (const permissions of [
        [],
        ['ui.profile'],
        ['ui.manual.v3'],
        ['ui.manual.v3', 'ui.screen.assistant.executive'],
        [
          'ui.manual.v3',
          'ui.screen.assistant.executive',
          'ui.deny.assistant.executive',
        ],
      ]) {
        expect(
          canViewRoute(permissions, '/dashboard?page=assistant&view=' + view),
        ).toBe(canViewRoute(permissions, '/assistant'));
        expect(
          canViewRoute(permissions, '/dashboard?page=assistant-' + view),
        ).toBe(canViewRoute(permissions, '/assistant'));
      }
      expect(canViewRoute([], '/dashboard?page=executive-overview')).toBe(
        false,
      );
      expect(canViewRoute([], '/dashboard?page=assistant-unknown')).toBe(false);
      expect(canViewRoute([], '/dashboard/other?page=assistant-' + view)).toBe(
        false,
      );
    },
  );
});

it('rejects conflicting page selectors instead of authorizing a different dashboard', () => {
  expect(
    canViewRoute(
      [],
      '/dashboard?page=executive-overview&page=assistant-overview',
    ),
  ).toBe(false);
  expect(
    canViewRoute(
      [],
      '/dashboard?page=assistant-overview&page=executive-overview',
    ),
  ).toBe(false);
});
