import { expect, it } from 'vitest';
import type {
  FloatingTourWebsiteCandidate,
  TourDepartureV1,
} from '@nora/contracts';
import { websiteTourGroups, filterWebsiteTourGroups } from './site-tour-groups';

const candidate: FloatingTourWebsiteCandidate = {
  id: 'floating',
  name: 'Floating Antalya',
  branchId: 'b',
  destinationId: 'antalya',
  destinationIds: ['antalya', 'bodrum'],
  canPublish: true,
  periods: ['2026-08-01', '2026-08-08'].map((date) => ({
    key: `dated:${date}:7`,
    startsOn: date,
    endsOn: date === '2026-08-01' ? '2026-08-08' : '2026-08-15',
    nights: 7,
    monthly: null,
  })),
};
const filters = { tourId: '', cityId: '', from: '', to: '', query: '' };
it('groups priced floating and charter periods under their tours without leaking another branch', () => {
  const charter = ['one', 'two'].map((id) => ({
    id,
    packageId: 'charter',
    branchId: 'b',
    startsOn: '2026-08-01',
    endsOn: '2026-08-08',
    package: {
      id: 'charter',
      name: 'Charter',
      destinationId: 'antalya',
      publicationStatus: 'PUBLISHED',
    },
  })) as TourDepartureV1[];
  const groups = websiteTourGroups(
    charter,
    [candidate, { ...candidate, id: 'other', branchId: 'other' }],
    'b',
  );
  expect(groups).toHaveLength(2);
  expect(groups.map((group) => group.periods.length)).toEqual([2, 2]);
  expect(groups[1]!.periods[0]).toMatchObject({
    resourceId: 'floating',
    kind: 'floating-tour',
    key: 'dated:2026-08-01:7',
  });
  expect(groups[1]!.periods[1]!.key).not.toBe(groups[1]!.periods[0]!.key);
  expect(
    filterWebsiteTourGroups(groups, {
      ...filters,
      cityId: 'bodrum',
      from: '2026-08-08',
      to: '2026-08-08',
      query: 'Antalya',
    })[0]!.periods,
  ).toHaveLength(1);
  expect(
    filterWebsiteTourGroups(groups, {
      ...filters,
      from: '2026-09-01',
      to: '2026-08-01',
    }),
  ).toEqual([]);
});
it('retains unpriced definitions and matches recurring monthly prices without fabricating a year', () => {
  const monthly = {
    ...candidate,
    periods: [
      {
        key: 'monthly:PERSIAN:8:7',
        startsOn: null,
        endsOn: null,
        nights: 7,
        monthly: { calendar: 'PERSIAN' as const, months: [8] },
      },
    ],
  };
  const groups = websiteTourGroups(
    [],
    [monthly, { ...candidate, id: 'unpriced', canPublish: false, periods: [] }],
    'b',
  );
  expect(groups[1]!.periods).toEqual([]);
  expect(
    filterWebsiteTourGroups(groups, {
      ...filters,
      from: '2026-11-01',
      to: '2026-11-10',
    }),
  ).toHaveLength(1);
  expect(
    filterWebsiteTourGroups(groups, {
      ...filters,
      from: '2026-07-01',
      to: '2026-07-10',
    }),
  ).toEqual([]);
  expect(filterWebsiteTourGroups(groups, filters)).toHaveLength(2);
});
