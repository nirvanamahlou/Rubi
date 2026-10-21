import { assistantViews, type AssistantView } from './model';

export function assistantDashboardHref(view: AssistantView = 'overview') {
  return '/dashboard?page=assistant&view=' + view;
}

export function assistantViewForDashboardPage(
  page: string | null,
  selectedView: string | null = null,
): AssistantView | null {
  if (page === 'assistant') {
    return assistantViews.find((view) => view === selectedView) ?? 'overview';
  }
  return assistantViews.find((view) => page === 'assistant-' + view) ?? null;
}
