export type MasterDataKpiState = 'loading' | 'ready' | 'error';

export function masterDataComplementKpi(
  total: unknown,
  subset: unknown,
  state: MasterDataKpiState,
): number | '—' {
  if (
    state !== 'ready' ||
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(subset) ||
    (total as number) < 0 ||
    (subset as number) < 0 ||
    (subset as number) > (total as number)
  )
    return '—';
  return (total as number) - (subset as number);
}
