import { assistantViews, type AssistantView } from './model';

export function assistantDashboardHref(view: AssistantView = 'overview') {
  return '/dashboard?page=assistant-' + view;
}

export function assistantViewForDashboardPage(
  page: string | null,
): AssistantView | null {
  return assistantViews.find((view) => page === 'assistant-' + view) ?? null;
}
