import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { assistantCopy } from '@/i18n/assistant-copy';
import {
  assistantView,
  assistantViews,
  snapshotSchema,
  type ExecutiveSnapshot,
} from './model';
import { ExecutivePanels } from './executive-workspace';

vi.mock('next/navigation', () => ({
  usePathname: () => '/assistant',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
const snapshot: ExecutiveSnapshot = {
  version: 1,
  generatedAt: '2026-10-11T08:00:00.000Z',
  scope: 'SELF',
  sources: ['calendar', 'notes', 'procurement'].map((id) => ({
    id: id as ExecutiveSnapshot['sources'][number]['id'],
    status: 'READY',
    asOf: '2026-10-11T08:00:00.000Z',
    truncated: false,
  })),
  followUps: [
    {
      id: 'calendar:synthetic',
      title: 'Private synthetic follow-up <script>alert(1)</script>',
      source: 'calendar',
      dueAt: '2026-10-10T08:00:00.000Z',
      reason: 'OVERDUE',
      href: '/workbench?tab=calendar',
    },
  ],
  truncated: false,
  capabilities: {
    forecasting: false,
    news: false,
    scenarios: false,
    llm: false,
    writes: false,
  },
};
describe('executive reference coverage and evidence states', () => {
  it.each(assistantViews)(
    'renders %s and all four required metrics without invented values',
    (view) => {
      const html = renderToStaticMarkup(<ExecutivePanels view={view} />);
      expect(html).toContain(assistantCopy.views[view].title[0]);
      for (const metric of assistantCopy.views[view].metrics)
        expect(html).toContain(metric[0]);
      expect(html).toContain(assistantCopy.liveGate[0]);
      expect(html).not.toContain('۸۲٪');
      expect(html).not.toContain('۱۲.۴');
    },
  );
  it.each(assistantViews)('has English copy and direction for %s', (view) => {
    const html = renderToStaticMarkup(<ExecutivePanels view={view} english />);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain(assistantCopy.views[view].title[1]);
    expect(html).not.toMatch(/[\u0600-\u06ff]/);
  });
  it('does not retain visible private results after denial', () => {
    const html = renderToStaticMarkup(
      <ExecutivePanels view="advisor" state="forbidden" snapshot={snapshot} />,
    );
    expect(html).toContain(assistantCopy.noPersonalAccess[0]);
    expect(html).not.toContain(assistantCopy.blocks.daily[0]);
    expect(html).not.toContain('Private synthetic follow-up');
  });
  it('renders authorized personal evidence with a reason and escaped source title', () => {
    const html = renderToStaticMarkup(
      <ExecutivePanels view="advisor" state="ready" snapshot={snapshot} />,
    );
    expect(html).toContain('Private synthetic follow-up');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain(assistantCopy.reasons.OVERDUE[0]);
    expect(html).toContain('/workbench?tab=calendar');
  });
  it('normalizes unknown views and denies unsafe source links', () => {
    expect(assistantView('hr')).toBe('overview');
    expect(assistantView(['finance'])).toBe('overview');
    expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
    for (const href of [
      'https://external.invalid',
      '//external.invalid',
      'javascript:alert(1)',
      '/workbench?tab=notes&user=other',
    ]) {
      expect(
        snapshotSchema.safeParse({
          ...snapshot,
          followUps: [{ ...snapshot.followUps[0], href }],
        }).success,
      ).toBe(false);
    }
  });
});
