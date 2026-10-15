import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { assistantCopy } from '@/i18n/assistant-copy';
import {
  assistantView,
  assistantViews,
  snapshotSchema,
  type ExecutiveSnapshot,
} from './model';
import {
  AssistantComposer,
  ExecutivePanels,
  ExecutiveWorkspace,
  PersonalFollowUps,
} from './executive-workspace';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';

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
  it('keeps prepared requests in the compact chat without manual filters', () => {
    const html = renderToStaticMarkup(
      <AssistantComposer t={(text) => text[0]} denied={false} floating />,
    );
    for (const label of [
      assistantCopy.quickDaily,
      assistantCopy.quickSales,
      assistantCopy.quickReceivables,
    ]) {
      expect(html).toContain(label[0]);
    }
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('type="date"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<h1');
  });
  it('loads the shared workspace for an ordinary authenticated profile and denies a missing identity', () => {
    const ordinary = renderToStaticMarkup(
      <AccessPermissionsProvider value={[]}>
        <ExecutiveWorkspace view="advisor" />
      </AccessPermissionsProvider>,
    );
    expect(ordinary).toContain(assistantCopy.states.loading[0]);
    expect(ordinary).not.toContain(assistantCopy.noPersonalAccess[0]);
    const anonymous = renderToStaticMarkup(
      <AccessPermissionsProvider value={null}>
        <ExecutiveWorkspace view="advisor" />
      </AccessPermissionsProvider>,
    );
    expect(anonymous).toContain(assistantCopy.noPersonalAccess[0]);
  });
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

it('shows five evidence-backed recommendations first and keeps the rest in a closed native disclosure', () => {
  const evidence: ExecutiveSnapshot = {
    ...snapshot,
    followUps: Array.from({ length: 7 }, (_, index) => ({
      ...snapshot.followUps[0]!,
      id: `calendar:${index}`,
      title: `Synthetic ${index}`,
      sourcePriority: 'URGENT',
    })),
  };
  const html = renderToStaticMarkup(
    <PersonalFollowUps
      t={(text) => text[0]}
      snapshot={evidence}
      english={false}
    />,
  );
  const [visible, disclosure] = html.split('<details');
  expect((visible!.match(/<article/g) ?? []).length).toBe(5);
  expect((disclosure!.match(/<article/g) ?? []).length).toBe(2);
  expect(html).not.toContain('<details open');
  expect(html).toContain(assistantCopy.allRecommendations[0]);
  expect(html).toContain('PERSONAL_DUE_V2');
  expect(html).toContain(assistantCopy.recordedPriority[0]);
  expect(html).toContain(assistantCopy.asOf[0]);
});

it.each(['overview', 'sales', 'finance', 'advisor'] as const)(
  'keeps the dedicated %s layout while authenticated data loads',
  (view) => {
    const initial = renderToStaticMarkup(
      <AccessPermissionsProvider value={[]}>
        <ExecutiveWorkspace view={view} />
      </AccessPermissionsProvider>,
    );
    for (const metric of assistantCopy.views[view].metrics)
      expect(initial).toContain(metric[0]);
    for (const state of ['loading', 'ready', 'unavailable'] as const) {
      const html = renderToStaticMarkup(
        <ExecutivePanels
          view={view}
          state={state}
          snapshot={state === 'ready' ? snapshot : null}
        />,
      );
      for (const metric of assistantCopy.views[view].metrics)
        expect(html).toContain(metric[0]);
      const blocks = {
        overview: [
          assistantCopy.blocks.trend,
          assistantCopy.blocks.summary,
          assistantCopy.blocks.factors,
        ],
        sales: [
          assistantCopy.blocks.salesTrend,
          assistantCopy.blocks.destinations,
          assistantCopy.blocks.funnel,
        ],
        finance: [
          assistantCopy.blocks.cashTrend,
          assistantCopy.blocks.obligations,
          assistantCopy.blocks.balances,
        ],
        advisor: [
          assistantCopy.blocks.daily,
          assistantCopy.blocks.actions,
          assistantCopy.blocks.priorities,
        ],
      };
      for (const block of blocks[view]) expect(html).toContain(block[0]);
    }
  },
);
