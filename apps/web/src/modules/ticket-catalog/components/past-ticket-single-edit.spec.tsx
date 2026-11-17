import type * as ReactModule from 'react';
import type { ReactElement, ReactNode } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import type { TicketOfferV1 } from '@nora/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  revise: vi.fn(),
  saved: vi.fn(),
  states: [] as unknown[],
  index: 0,
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: <T,>(current: T) => ({ current }),
    useState: (initial: unknown) => {
      const index = mocks.index++;
      if (!(index in mocks.states))
        mocks.states[index] =
          typeof initial === 'function' ? initial() : initial;
      return [
        mocks.states[index],
        (next: unknown) => {
          mocks.states[index] =
            typeof next === 'function' ? next(mocks.states[index]) : next;
        },
      ];
    },
  };
});
vi.mock('../api/tours', () => ({
  toursApi: { reviseOfferBatch: mocks.batch, reviseOffer: mocks.revise },
}));
import { PublishedOfferForm } from './published-offer-form';
import { ReferencePicker } from './reference-picker';
import { Select } from '@/components/ui';
const offer = {
  id: 'past-flight',
  version: 7,
  branchId: 'branch',
  originId: 'a',
  destinationId: 'b',
  originAirportId: 'airport-ika',
  destinationAirportId: 'airport-ayt',
  departureAt: '2000-01-01T08:00:00.000Z',
  arrivalAt: '2000-01-01T10:00:00.000Z',
  carrierName: 'Synthetic Air',
  serviceNumber: 'TEST1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 50,
  remainingCapacity: 40,
  status: 'PAUSED',
} as TicketOfferV1;
beforeEach(() => {
  mocks.states = [];
  mocks.index = 0;
  mocks.revise.mockReset().mockResolvedValue({});
  mocks.batch.mockReset().mockResolvedValue({});
  mocks.saved.mockReset().mockResolvedValue(undefined);
});

function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}

it('edits selected airports, scopes them to the route country and saves their IDs', async () => {
  const render = () => {
    mocks.index = 0;
    return PublishedOfferForm({ offer, readOnly: false, onSaved: mocks.saved });
  };
  render();
  mocks.states[4] = [
    { id: 'a', countryId: 'ir' },
    { id: 'b', countryId: 'tr' },
    { id: 'another-tr-city', countryId: 'tr' },
    { id: 'third-country-city', countryId: 'de' },
  ];
  const tree = () => nodes(canonicalTestTree(render()));
  const airport = () =>
    tree().find(
      (node) =>
        node.type === ReferencePicker &&
        node.props.id === `published-destination-airport-${offer.id}`,
    )!;
  expect(airport().props).toMatchObject({
    countryId: 'tr',
    required: true,
    readOnly: false,
  });
  (airport().props.onSelect as (ref: unknown) => void)({
    id: 'new-airport',
    kind: 'airport',
    countryId: 'tr',
    active: true,
    name: 'New airport',
  });
  expect(airport().props.value).toMatchObject({ id: 'new-airport' });
  const destination = () =>
    tree().find(
      (node) =>
        node.type === Select &&
        node.props.value ===
          (mocks.states[0] as { destinationId: string }).destinationId,
    )!;
  (destination().props.onValueChange as (id: string) => void)(
    'another-tr-city',
  );
  expect(airport().props.value).toMatchObject({ id: 'new-airport' });
  render().props.onSubmit({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.revise).toHaveBeenCalledWith(
    offer.id,
    offer.version,
    expect.objectContaining({
      originAirportId: 'airport-ika',
      destinationAirportId: 'new-airport',
    }),
  );
  (destination().props.onValueChange as (id: string) => void)(
    'third-country-city',
  );
  expect(airport().props).toMatchObject({ countryId: 'de', value: undefined });
});
it('submits exactly the selected historical ticket id and version without moving its dates', async () => {
  const form = PublishedOfferForm({
    offer,
    readOnly: false,
    onSaved: mocks.saved,
  });
  form.props.onSubmit({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.revise).toHaveBeenCalledExactlyOnceWith(
    offer.id,
    7,
    expect.objectContaining({
      departureAt: offer.departureAt,
      arrivalAt: offer.arrivalAt,
      totalCapacity: 50,
    }),
  );
});
it('keeps the historical view-only form read only', async () => {
  const form = PublishedOfferForm({
    offer,
    readOnly: true,
    onSaved: mocks.saved,
  });
  form.props.onSubmit({ preventDefault: vi.fn() });
  await Promise.resolve();
  expect(mocks.revise).not.toHaveBeenCalled();
});
it.each(['originAirportId', 'destinationAirportId'] as const)(
  'requires %s when saving an existing flight',
  async (field) => {
    const form = PublishedOfferForm({
      offer: { ...offer, [field]: null },
      readOnly: false,
      onSaved: mocks.saved,
    });
    form.props.onSubmit({ preventDefault: vi.fn() });
    await Promise.resolve();
    expect(mocks.revise).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
  },
);
it('exposes the single edit action independently of the departure date', () => {
  const source = readFileSync(
    new URL('./ticket-workspace.tsx', import.meta.url),
    'utf8',
  );
  expect(source).toContain(
    'onClick={() => setOfferForm({ offer, readOnly: false })}',
  );
  expect(source).not.toContain(
    '{new Date(offer.departureAt).getTime() > catalogNow ? (',
  );
  expect(source).toMatch(
    /<TicketCapacityHoldAction\s+mode="inspect"\s+offer=\{offer\}\s+now=\{catalogNow\}/,
  );
  const holdAction = readFileSync(
    new URL('./ticket-capacity-hold-action.tsx', import.meta.url),
    'utf8',
  );
  expect(holdAction).toContain('new Date(offer.departureAt).getTime() <= now');
});

it('uses the atomic batch command for same-weekday edits, preserving versions and dates', async () => {
  const next = {
    ...offer,
    id: 'next',
    version: 8,
    departureAt: '2000-01-08T08:00:00.000Z',
    arrivalAt: '2000-01-08T10:00:00.000Z',
  };
  const form = PublishedOfferForm({
    offer,
    readOnly: false,
    weekdayOffers: [offer, next],
    onSaved: mocks.saved,
  });
  form.props.onSubmit({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.revise).not.toHaveBeenCalled();
  expect(mocks.batch).toHaveBeenCalledExactlyOnceWith([
    expect.objectContaining({
      id: offer.id,
      expectedVersion: 7,
      offer: expect.objectContaining({ departureAt: offer.departureAt }),
    }),
    expect.objectContaining({
      id: 'next',
      expectedVersion: 8,
      offer: expect.objectContaining({ departureAt: next.departureAt }),
    }),
  ]);
});
