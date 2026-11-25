import type { AuthenticatedActor } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { WebsiteManagementWorkspace } from './components/website-management-workspace';
import { commerceWebsites } from './site-publication-model';

function overview(permissions: AuthenticatedActor['permissions']) {
  return renderToStaticMarkup(
    <WebsiteManagementWorkspace
      actor={{
        userId: 'operator',
        sessionId: 'test',
        branchIds: ['branch'],
        permissions,
      }}
      initialSite="jahan-bastan"
      onOpenConnection={vi.fn()}
    />,
  );
}

it('opens each storefront separately and exposes permitted management actions', () => {
  const html = overview([
    'ticket_catalog.manage',
    'sales.contracts.read.branch',
  ]);
  for (const website of commerceWebsites)
    expect(html).toContain(
      `href="${website.url}" target="_blank" rel="noopener noreferrer"`,
    );
  expect(html).toMatch(/aria-pressed="true"[^>]*>.*ج(?:هان) باستان/);
  expect(html).toContain('تورهای تاریخ‌دار و شناور');
  expect(html).toContain('بلیط‌ها');
  expect(html).not.toContain('فروش، نرخ و تحویل');
  expect(html).not.toContain('href="/sales"');
});

it('keeps storefront links available while hiding unauthorised publication and order shortcuts', () => {
  const html = overview([]);
  expect(html).toContain('href="https://jahanbastan.ir"');
  expect(html).not.toContain('تورهای تاریخ‌دار و شناور');
  expect(html).not.toContain('href="/sales"');
});
