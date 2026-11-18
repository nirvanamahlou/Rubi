import type {
  FloatingTourSaleSet,
  FloatingTourWebsitePeriod,
} from '@nora/contracts';

/** Price and hotel changes retain the explicit site selection for that period. */
export function floatingWebsitePeriods(
  prices?: FloatingTourSaleSet,
): FloatingTourWebsitePeriod[] {
  const dated = [
    ...new Map(
      (prices?.dated ?? []).map((row) => [
        `dated:${row.startsOn}:${row.nights}`,
        {
          key: `dated:${row.startsOn}:${row.nights}`,
          startsOn: row.startsOn,
          endsOn: row.endsOn,
          nights: row.nights,
          monthly: null,
        },
      ]),
    ).values(),
  ];
  const monthly = prices?.monthly;
  return [
    ...dated,
    ...(monthly
      ? [...new Set(monthly.rows.map((row) => row.nights))].map((nights) => ({
          key: `monthly:${monthly.calendar}:${[...monthly.months].sort((a, b) => a - b).join('-')}:${nights}`,
          startsOn: null,
          endsOn: null,
          nights,
          monthly: { calendar: monthly.calendar, months: monthly.months },
        }))
      : []),
  ];
}
