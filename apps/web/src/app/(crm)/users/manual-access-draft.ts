import type { ManualAccessSelection } from '@nora/contracts';

export function manualAccessDraftKey(draft: {
  title: string;
  selection: ManualAccessSelection;
}) {
  return JSON.stringify({
    title: draft.title,
    selection: Object.fromEntries(
      (['permissionCodes', 'screenIds', 'allowedControlIds'] as const).map(
        (key) => [key, [...new Set(draft.selection[key])].sort()],
      ),
    ),
  });
}
