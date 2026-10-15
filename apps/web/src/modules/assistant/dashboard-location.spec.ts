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
    const page = new URLSearchParams(
      assistantDashboardHref(view).split('?')[1],
    ).get('page');
    expect(assistantViewForDashboardPage(page)).toBe(view);
    expect(dashboardPages.find((item) => item.id === page)).toBeDefined();
    expect(dashboardNavigation.some((item) => item.pageId === page)).toBe(true);
  });
  it('rejects unknown pages and keeps dashboard metrics separate', () => {
    expect(assistantViewForDashboardPage('executive-overview')).toBeNull();
    expect(assistantViewForDashboardPage('assistant-unknown')).toBeNull();
    expect(assistantViewForDashboardPage(null)).toBeNull();
  });
});
