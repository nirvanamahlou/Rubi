import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  USER_ACCESS_PROFILE_PERMISSION,
  screenPermission,
} from '@nora/contracts';
vi.mock('next/navigation', () => ({
  usePathname: () => '/ticket-management',
  useSearchParams: () => new URLSearchParams(),
}));
import { AccessPermissionsProvider } from './access-context';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/overlays';
import AccessLink from '@/components/access-link';
import { AppShell } from '@/components/layout/app-shell';
const render = (permissions: string[], child: React.ReactNode) =>
  renderToStaticMarkup(
    createElement(AccessPermissionsProvider, { value: permissions }, child),
  );
describe('rendered access controls', () => {
  it('does not render denied tab labels or content and chooses an allowed fallback', () => {
    const body = render(
      [
        USER_ACCESS_PROFILE_PERMISSION,
        screenPermission('ticket-catalog.tab.catalog'),
      ],
      createElement(
        Tabs,
        { defaultValue: 'issued' },
        createElement(
          TabsList,
          {},
          createElement(TabsTrigger, { value: 'catalog' }, 'CATALOG'),
          createElement(TabsTrigger, { value: 'issued' }, 'ISSUED'),
        ),
        createElement(TabsContent, { value: 'catalog' }, 'ALLOWED BODY'),
        createElement(TabsContent, { value: 'issued' }, 'DENIED BODY'),
      ),
    );
    expect(body).toContain('CATALOG');
    expect(body).toContain('ALLOWED BODY');
    expect(body).not.toContain('ISSUED');
    expect(body).not.toContain('DENIED BODY');
  });
  it('hides route links including object href queries for forbidden sections', () => {
    const permissions = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('system.users'),
    ];
    expect(
      render(
        permissions,
        createElement(AccessLink, { href: '/finance' }, 'FORBIDDEN'),
      ),
    ).toBe('');
    expect(
      render(
        permissions,
        createElement(
          AccessLink,
          { href: { pathname: '/hr', query: { section: 'time' } } },
          'FORBIDDEN',
        ),
      ),
    ).toBe('');
    expect(
      render(
        permissions,
        createElement(AccessLink, { href: '/system/users' }, 'USERS'),
      ),
    ).toContain('USERS');
  });
  it('keeps legacy navigation available without the managed marker', () => {
    expect(
      render([], createElement(AccessLink, { href: '/finance' }, 'FINANCE')),
    ).toContain('FINANCE');
  });
});

it('does not render application navigation or business content before account permissions load', () => {
  const markup = renderToStaticMarkup(
    <AppShell>
      <div>PRIVATE BUSINESS CONTENT</div>
    </AppShell>,
  );
  expect(markup).toContain('role="status"');
  expect(markup).not.toContain('PRIVATE BUSINESS CONTENT');
  expect(markup).not.toContain('Main navigation');
});

it('keeps uncatalogued future tabs hidden for a managed account', () => {
  const markup = render(
    [USER_ACCESS_PROFILE_PERMISSION, screenPermission('ticket-catalog.home')],
    createElement(
      Tabs,
      { defaultValue: 'future' },
      createElement(
        TabsList,
        {},
        createElement(TabsTrigger, { value: 'future' }, 'FUTURE TAB'),
      ),
      createElement(TabsContent, { value: 'future' }, 'FUTURE CONTENT'),
    ),
  );
  expect(markup).not.toContain('FUTURE TAB');
  expect(markup).not.toContain('FUTURE CONTENT');
});
