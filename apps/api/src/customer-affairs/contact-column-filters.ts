import { normalizeCallSearch } from './call-center-search';
export interface ContactColumnFilters {
  direction?: string;
  outcome?: string;
  source?: string;
  unit?: string;
  incomplete?: string;
}
export function matchesContactColumns(
  call: {
    direction: string;
    outcome?: string | null;
    source: string;
    operator: string;
    answerRecipient?: { label: string } | undefined;
    needsCompletion: boolean | null;
  },
  filters: ContactColumnFilters,
) {
  const label = (value: string | undefined) =>
    normalizeCallSearch(value?.trim() || 'نامشخص');
  return (
    (!filters.direction || call.direction === filters.direction) &&
    (!filters.outcome || (call.outcome ?? 'UNKNOWN') === filters.outcome) &&
    (!filters.source || label(call.source) === label(filters.source)) &&
    (!filters.unit ||
      label(call.answerRecipient?.label || call.operator) ===
        label(filters.unit)) &&
    (!filters.incomplete ||
      !!call.needsCompletion === (filters.incomplete === 'YES'))
  );
}
