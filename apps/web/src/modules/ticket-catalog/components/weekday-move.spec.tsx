import type * as ReactModule from 'react';
import type { ReactElement } from 'react';
import type { TicketOfferV1 } from '@nora/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  target: 1,
  batch: vi.fn(),
  saved: vi.fn(),
  state: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: <T,>(current: T) => ({ current }),
    useState: <T,>(value: T | (() => T)) => [
      typeof value === 'number'
        ? mocks.target
        : typeof value === 'function'
          ? (value as () => T)()
          : value,
      mocks.state,
    ],
  };
});
vi.mock('../api/tours', () => ({
  toursApi: { reviseOfferBatch: mocks.batch },
}));
import { PublishedOfferForm } from './published-offer-form';
import { loadWeekdayMoveRevisions } from '../model/load-weekday-edit';
const offer = {
  id: 'sunday',
  version: 4,
  branchId: 'branch',
  loadGroupId: 'load',
  originId: 'a',
  destinationId: 'b',
  departureAt: '2026-10-25T07:00:00Z',
  arrivalAt: '2026-10-26T01:00:00Z',
  carrierName: 'Test Air',
  serviceNumber: 'TEST',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 30,
  remainingCapacity: 30,
  status: 'ACTIVE',
} as TicketOfferV1;
function nodes(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function form(
  readOnly = false,
  group: readonly TicketOfferV1[] | undefined = [offer],
) {
  return PublishedOfferForm({
    offer,
    readOnly,
    weekdayOffers: group,
    onSaved: mocks.saved,
  });
}
function moveButton(tree: unknown) {
  return nodes(tree).find(
    (node) =>
      node.props.type === 'button' && typeof node.props.onClick === 'function',
  );
}
beforeEach(() => {
  mocks.target = 1;
  mocks.batch.mockReset().mockResolvedValue({});
  mocks.saved.mockReset().mockResolvedValue(undefined);
  mocks.state.mockReset();
});
it('uses a separate non-submit button and the existing atomic versioned batch, then reloads', async () => {
  const button = moveButton(form())!;
  expect(button.props.disabled).toBe(false);
  (button.props.onClick as () => void)();
  await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
  expect(mocks.batch).toHaveBeenCalledExactlyOnceWith(
    loadWeekdayMoveRevisions(offer, [offer], 1),
  );
});
it('does not expose changes to read-only or single-ticket views and disables unchanged days', () => {
  expect(moveButton(form(true))).toBeUndefined();
  expect(
    moveButton(
      PublishedOfferForm({ offer, readOnly: false, onSaved: mocks.saved }),
    ),
  ).toBeUndefined();
  mocks.target = 0;
  expect(moveButton(form())?.props.disabled).toBe(true);
});
it('does not refresh or close the form after a failed batch', async () => {
  mocks.batch.mockRejectedValue(new Error('Conflict'));
  (moveButton(form())!.props.onClick as () => void)();
  await vi.waitFor(() => expect(mocks.state).toHaveBeenCalledWith('Conflict'));
  expect(mocks.saved).not.toHaveBeenCalled();
});
it('blocks duplicate clicks while a move is pending', async () => {
  let resolve!: () => void;
  mocks.batch.mockImplementation(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const click = moveButton(form())!.props.onClick as () => void;
  click();
  click();
  expect(mocks.batch).toHaveBeenCalledOnce();
  resolve();
  await vi.waitFor(() => expect(mocks.saved).toHaveBeenCalledOnce());
});
