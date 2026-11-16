import type {
  FloatingTourWebsiteCandidate,
  FloatingTourWebsitePeriod,
  TourDepartureV1,
} from '@nora/contracts';
import { publishableTours } from './site-publication-model';

export type SiteTourPeriod = FloatingTourWebsitePeriod & {
  resourceId: string;
  kind: 'tour' | 'floating-tour';
  canPublish: boolean;
};
export interface SiteTourGroup {
  id: string;
  name: string;
  destinationIds: string[];
  periods: SiteTourPeriod[];
}
export function websiteTourGroups(
  tours: TourDepartureV1[],
  floating: FloatingTourWebsiteCandidate[],
  branchId: string,
) {
  const groups = new Map<string, SiteTourGroup>();
  for (const row of publishableTours(tours, branchId)) {
    const group: SiteTourGroup = groups.get(row.packageId) ?? {
      id: row.packageId,
      name: row.package.name,
      destinationIds: [
        ...new Set([
          row.package.destinationId,
          ...(row.package.details?.destinations?.map((s) => s.cityId) ?? []),
        ]),
      ],
      periods: [],
    };
    group.periods.push({
      resourceId: row.id,
      kind: 'tour',
      key: '',
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      nights: 0,
      monthly: null,
      canPublish: true,
    });
    groups.set(group.id, group);
  }
  for (const row of floating.filter((item) => item.branchId === branchId))
    groups.set(row.id, {
      id: row.id,
      name: row.name,
      destinationIds: row.destinationIds,
      periods: row.periods.map((period) => ({
        ...period,
        resourceId: row.id,
        kind: 'floating-tour',
        canPublish: row.canPublish,
      })),
    });
  return [...groups.values()].map((group) => ({
    ...group,
    periods: group.periods.sort(
      (a, b) =>
        (a.startsOn ?? '').localeCompare(b.startsOn ?? '') ||
        a.key.localeCompare(b.key),
    ),
  }));
}

function matchesDate(period: SiteTourPeriod, from: string, to: string) {
  if (!from && !to) return true;
  if (!period.monthly)
    return (
      !!period.startsOn &&
      (!from || period.startsOn >= from) &&
      (!to || period.startsOn <= to)
    );
  // Monthly prices have no year. Match their recurring months without inventing a departure.
  if (!from || !to) return true;
  const first = Date.parse(`${from}T12:00:00Z`),
    last = Date.parse(`${to}T12:00:00Z`);
  if (last - first >= 366 * 86400000) return true;
  const format = new Intl.DateTimeFormat('en-US', {
    calendar: period.monthly.calendar === 'PERSIAN' ? 'persian' : 'gregory',
    month: 'numeric',
    timeZone: 'UTC',
  });
  for (let day = first; day <= last; day += 86400000)
    if (period.monthly.months.includes(Number(format.format(new Date(day)))))
      return true;
  return false;
}
export function filterWebsiteTourGroups(
  groups: SiteTourGroup[],
  filters: {
    tourId: string;
    cityId: string;
    from: string;
    to: string;
    query: string;
  },
) {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  return groups
    .filter(
      (group) =>
        (!filters.tourId || group.id === filters.tourId) &&
        (!filters.cityId || group.destinationIds.includes(filters.cityId)) &&
        group.name
          .toLocaleLowerCase()
          .includes(filters.query.trim().toLocaleLowerCase()),
    )
    .map((group) => ({
      ...group,
      periods: group.periods.filter((period) =>
        matchesDate(period, filters.from, filters.to),
      ),
    }))
    .filter((group) => group.periods.length || (!filters.from && !filters.to));
}
