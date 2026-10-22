import type * as ReactModule from 'react';
import type { TicketOfferV1 } from '@nora/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  revise: vi.fn(),
  saved: vi.fn(),
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useEffect: () => undefined,
    useRef: <T,>(current: T) => ({ current }),
    useState: <T,>(value: T | (() => T)) => [
      typeof value === 'function' ? (value as () => T)() : value,
      vi.fn(),
    ],
  };
});
vi.mock('../api/tours', () => ({
  toursApi: { reviseOfferBatch: mocks.batch, reviseOffer: mocks.revise },
}));
import { PublishedOfferForm } from './published-offer-form';
const offer = {
  id: 'past-flight',
  version: 7,
  branchId: 'branch',
  originId: 'a',
  destinationId: 'b',
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
  mocks.revise.mockReset().mockResolvedValue({});
  mocks.batch.mockReset().mockResolvedValue({});
  mocks.saved.mockReset().mockResolvedValue(undefined);
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
  expect(source).toContain(
    'new Date(offer.departureAt).getTime() <= catalogNow',
  );
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
