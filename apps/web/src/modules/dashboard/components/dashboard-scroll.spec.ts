import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardWorkspaceSource = readFileSync(
  resolve(process.cwd(), 'src/modules/dashboard/components/dashboard-workspace.tsx'),
  'utf8',
);

describe('dashboard scroll stability', () => {
  it('keeps URL-driven page and filter updates at the current viewport', () => {
    expect(dashboardWorkspaceSource).toContain('preserveDashboardViewport();');
    expect(dashboardWorkspaceSource).toContain('scroll: false');
    expect(dashboardWorkspaceSource).toContain("overflowAnchor: 'none'");
    expect(dashboardWorkspaceSource).toContain('useLayoutEffect(() => {');
    expect(dashboardWorkspaceSource).toContain(
      'if (nextSearch === searchParams.toString()) return;',
    );
  });

  it('does not insert a global loading row above dashboard content', () => {
    expect(dashboardWorkspaceSource).not.toContain('{query.isPending ? (');
    expect(dashboardWorkspaceSource).not.toContain(
      '<Skeleton className="h-28" />',
    );
    expect(dashboardWorkspaceSource).toContain('loading={query.isPending}');
    expect(dashboardWorkspaceSource).toContain(
      'aria-label="در حال دریافت دادهٔ نمودار"',
    );
  });

  it('focuses searchable filters without moving the document viewport', () => {
    expect(dashboardWorkspaceSource).toContain(
      'searchRef.current?.focus({ preventScroll: true });',
    );
  });
});
