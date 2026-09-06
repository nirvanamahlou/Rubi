import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HrWorkspace } from './hr-workspace';
import {
  frappeWorkspaces,
  hrWorkspaceLinkHref,
  normalizeFrappeWorkspace,
} from './frappe-workspaces';
import { sectionTabs } from './hr.model';

describe('Frappe-style HR workspaces', () => {
  it('renders the nine requested workspaces in the HR launcher', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="home" />);
    expect(frappeWorkspaces).toHaveLength(9);
    expect(html).toContain('فضاهای کاری منابع انسانی');
    for (const workspace of frappeWorkspaces) {
      expect(html).toContain(workspace.title);
      expect(html).toContain(`/hr?workspace=${workspace.id}`);
    }
  });

  it.each(frappeWorkspaces)(
    'fills the $id workspace with metrics, a trend and every directory link',
    (workspace) => {
      const html = renderToStaticMarkup(
        <HrWorkspace workspaceId={workspace.id} />,
      );
      expect(html).toContain(workspace.title);
      expect(html).toContain(workspace.trendLabel);
      expect(html).toContain('اطلاعات پایه و گزارش‌ها');
      expect(html).toContain('داده آزمایشی');
      expect(html).not.toContain('No Data');
      expect(html).not.toContain('آدرس API تنظیم نشده است');
      for (const metric of workspace.metrics) {
        expect(metric.value).not.toBe('—');
        expect(html).toContain(metric.label);
        expect(html).toContain(metric.value);
      }
      for (const group of workspace.groups) {
        expect(html).toContain(group.title);
        for (const item of group.items) {
          expect(html).toContain(item.label);
        }
      }
    },
  );

  it('maps every directory link to a real HR section and tab', () => {
    for (const workspace of frappeWorkspaces) {
      for (const group of workspace.groups) {
        for (const item of group.items) {
          expect(hrWorkspaceLinkHref(item)).toContain(
            `section=${item.section}`,
          );
          if (item.tab) {
            expect(
              sectionTabs[item.section]?.some(({ id }) => id === item.tab),
            ).toBe(true);
          }
        }
      }
    }
  });

  it('opens a requested deep-linked tab inside an existing capability', () => {
    const html = renderToStaticMarkup(
      <HrWorkspace sectionId="expenses" tabId="claims" />,
    );
    expect(html).toMatch(/aria-selected="true"[^>]*>.*بازپرداخت هزینه/s);
  });

  it('rejects unsupported workspace identifiers', () => {
    expect(normalizeFrappeWorkspace()).toBeNull();
    expect(normalizeFrappeWorkspace('unknown')).toBeNull();
    expect(normalizeFrappeWorkspace('payroll')).toBe('payroll');
  });
});
