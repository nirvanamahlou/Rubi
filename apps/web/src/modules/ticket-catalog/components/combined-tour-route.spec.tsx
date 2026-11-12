import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import type { TourPackageInputV1 } from '@nora/contracts';
import { expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  index: 0,
  combined: true,
  saved: undefined as TourPackageInputV1 | undefined,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: unknown) => {
    const index = h.index++;
    const draft: TourPackageInputV1 = {
      name: 'Synthetic',
      originId: 'origin',
      destinationId: 'first',
      hotelIds: [],
      transferOutbound: false,
      transferReturn: false,
      visa: false,
      details: {
        version: 1,
        isCombined: h.combined,
        originAirportCode: 'OLD',
        destinationAirportCode: 'DEST',
        destinations: [
          { cityId: 'first', nights: 2 },
          { cityId: 'second', nights: 3 },
        ],
      },
    };
    return [
      index === 6 ? draft : index === 7 ? true : index === 9 ? false : initial,
      index === 6
        ? (value: TourPackageInputV1) => {
            h.saved = value;
          }
        : vi.fn(),
    ];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['ticket_catalog.manage'],
}));
import { TourWorkspace } from './tour-workspace';
import { TourDestinations } from './tour-destinations';
import { SearchableReference } from '@/modules/sales/components/searchable-reference';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
it('hides both old route controls only for combined tours', () => {
  h.index = 0;
  h.combined = true;
  let tree = nodes(TourWorkspace({}));
  expect(
    tree.filter((node) =>
      ['شهر مبدأ', 'شهر مقصد'].includes(String(node.props.label)),
    ),
  ).toHaveLength(0);
  expect(tree.some((node) => node.type === TourDestinations)).toBe(true);
  h.index = 0;
  h.combined = false;
  tree = nodes(TourWorkspace({}));
  expect(
    tree
      .filter((node) =>
        ['شهر مبدأ', 'شهر مقصد'].includes(String(node.props.label)),
      )
      .map((node) => node.props.label),
  ).toEqual(['شهر مبدأ', 'شهر مقصد']);
});
it('edits the origin in the combined block without dropping stays and synchronizes airport metadata', () => {
  h.index = 0;
  h.combined = true;
  const workspace = nodes(TourWorkspace({}));
  const section = workspace.find((node) => node.type === TourDestinations)!;
  const value = section.props.value as TourPackageInputV1;
  const form = nodes(
    TourDestinations({
      value,
      countries: [],
      cities: [],
      onChange: section.props.onChange as (value: TourPackageInputV1) => void,
    }),
  );
  const origin = form.find(
    (node) =>
      node.type === SearchableReference && node.props.label === 'شهر مبدأ',
  )!;
  (origin.props.onChange as (id: string) => void)('new-origin');
  expect(h.saved).toMatchObject({
    originId: 'new-origin',
    destinationId: 'first',
    details: {
      destinations: value.details!.destinations,
      destinationAirportCode: 'DEST',
    },
  });
  expect(h.saved?.details?.originAirportCode).toBeUndefined();
  const updated = h.saved!;
  const nextForm = nodes(
    TourDestinations({
      value: updated,
      countries: [],
      cities: [],
      onChange: section.props.onChange as (value: TourPackageInputV1) => void,
    }),
  );
  const destination = nextForm.find(
    (node) =>
      node.type === SearchableReference && node.props.label === 'شهر مقصد 1',
  )!;
  (destination.props.onChange as (id: string) => void)('replacement');
  expect(h.saved).toMatchObject({
    originId: 'new-origin',
    destinationId: 'replacement',
    details: {
      destinations: [
        { cityId: 'replacement', nights: 2 },
        { cityId: 'second', nights: 3 },
      ],
    },
  });
  expect(h.saved?.details?.destinationAirportCode).toBeUndefined();

  expect(
    form
      .filter(
        (node) =>
          node.type === SearchableReference &&
          String(node.props.label).startsWith('شهر مقصد'),
      )
      .map((node) => node.props.value),
  ).toEqual(['first', 'second']);
});

it('limits every city picker to its own country and clears the city on country change', () => {
  h.index = 0;
  const cities = [
    { id: 'tehran', attributes: { countryId: 'ir' } },
    { id: 'mashhad', attributes: { countryId: 'ir' } },
    { id: 'antalya', attributes: { countryId: 'tr' } },
    { id: 'bodrum', attributes: { countryId: 'tr' } },
    { id: 'paris', attributes: { countryId: 'fr' } },
  ] as unknown as import('@nora/contracts').MasterDataRecord[];
  const onChange = vi.fn();
  const tree = nodes(
    TourDestinations({
      value: {
        originId: 'tehran',
        destinationId: 'antalya',
        hotelIds: [],
        details: {
          version: 1,
          isCombined: true,
          destinations: [
            { cityId: 'antalya', nights: 4 },
            { cityId: 'paris', nights: 3 },
          ],
        },
      } as unknown as TourPackageInputV1,
      countries: [],
      cities,
      onChange,
    }),
  );
  const picker = (label: string) =>
    tree.find(
      (n) => n.type === SearchableReference && n.props.label === label,
    )!;
  const ids = (label: string) =>
    (picker(label).props.options as typeof cities).map((c) => c.id);
  expect(ids('شهر مبدأ')).toEqual(['tehran', 'mashhad']);
  expect(ids('شهر مقصد 1')).toEqual(['antalya', 'bodrum']);
  expect(ids('شهر مقصد 2')).toEqual(['paris']);
  (picker('کشور مقصد 1').props.onChange as (id: string) => void)('fr');
  expect(onChange.mock.lastCall?.[0]).toMatchObject({
    destinationId: '',
    details: {
      destinations: [
        { cityId: '', nights: 4 },
        { cityId: 'paris', nights: 3 },
      ],
    },
  });
  (picker('کشور مبدأ').props.onChange as (id: string) => void)('tr');
  expect(onChange.mock.lastCall?.[0].originId).toBe('');
});
