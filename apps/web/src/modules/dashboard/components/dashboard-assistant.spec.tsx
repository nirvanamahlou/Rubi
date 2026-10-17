import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { assistantViews } from '@/modules/assistant/model';
import { assistantCopy } from '@/i18n/assistant-copy';
import { DashboardWorkspace } from './dashboard-workspace';

const state = vi.hoisted(() => ({
  page: 'assistant',
  view: 'overview',
  query: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useSearchParams: () =>
    new URLSearchParams({ page: state.page, view: state.view }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    state.query(options);
    return { isPending: true, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({ context: null }),
}));

describe('assistant dashboard integration', () => {
  it.each(assistantViews)(
    'renders the complete %s page with dashboard navigation',
    (view) => {
      state.page = 'assistant';
      state.view = view;
      state.query.mockClear();
      const html = renderToStaticMarkup(
        <AccessPermissionsProvider value={[]}>
          <DashboardWorkspace />
        </AccessPermissionsProvider>,
      );
      expect(html).toContain('ناوبری داشبورد');
      expect(html).toContain(assistantCopy.views[view].title[0]);
      expect(html).not.toContain('data-dashboard-kpi-count');
      expect(html).toContain('/dashboard?page=assistant&amp;view=' + view);
      expect(state.query).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
      for (const id of assistantViews)
        expect(html).toContain(assistantCopy.views[id].label[0]);
    },
  );
});
