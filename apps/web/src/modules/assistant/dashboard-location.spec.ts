import { describe, expect, it } from 'vitest';
import { assistantViews } from './model';
import {
  assistantDashboardHref,
  assistantViewForDashboardPage,
} from './dashboard-location';
import {
  dashboardNavigation,
  dashboardPages,
} from '@/modules/dashboard/model/registry';

describe('assistant pages in dashboard', () => {
  it.each(assistantViews)('round-trips the complete %s page', (view) => {
    const params = new URLSearchParams(
      assistantDashboardHref(view).split('?')[1],
    );
    const page = params.get('page');
    expect(page).toBe('assistant');
    expect(assistantViewForDashboardPage(page, params.get('view'))).toBe(view);
    expect(assistantViewForDashboardPage('assistant-' + view)).toBe(view);
    expect(dashboardNavigation.at(-1)?.pageId).toBe(page);
    expect(
      dashboardNavigation.filter((item) => item.pageId.startsWith('assistant')),
    ).toHaveLength(1);
    expect(dashboardPages.find((item) => item.id === page)).toBeDefined();
    expect(dashboardNavigation.some((item) => item.pageId === page)).toBe(true);
  });
  it('rejects unknown pages and keeps dashboard metrics separate', () => {
    expect(assistantViewForDashboardPage('executive-overview')).toBeNull();
    expect(assistantViewForDashboardPage('assistant-unknown')).toBeNull();
    expect(assistantViewForDashboardPage(null)).toBeNull();
    expect(assistantViewForDashboardPage('assistant')).toBe('overview');
    expect(assistantViewForDashboardPage('assistant', 'unknown')).toBe(
      'overview',
    );
  });
});
