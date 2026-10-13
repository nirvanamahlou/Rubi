'use client';
import { useState } from 'react';
import type { HrPreviewDataset } from './hr-preview-data';
import { recordKey, subsetDataset } from './hr-data-utils';

export function useHrRowSelection(scope: string) {
  const [state, setState] = useState<{
    scope: string;
    ids: ReadonlySet<string>;
  }>({ scope, ids: new Set() });
  const selectedIds = state.scope === scope ? state.ids : new Set<string>();
  const onSelectionChange = (ids: ReadonlySet<string>) =>
    setState({ scope, ids });
  return { selectedIds, onSelectionChange };
}
export function selectedHrDataset(
  data: HrPreviewDataset,
  ids: ReadonlySet<string>,
): HrPreviewDataset {
  const indices = data.rows
    .map((_, i) => i)
    .filter((i) => ids.has(recordKey(data, i)));
  return { ...subsetDataset(data, indices), totalLabel: '' };
}
