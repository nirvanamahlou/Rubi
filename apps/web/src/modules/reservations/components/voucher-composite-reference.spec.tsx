import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { ReservationFormIntake } from '../model/reservation-form';
const h = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
  loaded: vi.fn(),
  detail: vi.fn(async (_resource: string, id: string) => ({
    data: { id, name: id, attributes: { englishName: id } },
  })),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: () => [undefined, h.loaded],
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
}));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: { detail: h.detail },
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test',
}));
import { useReservationFormReferences } from './reservation-form-sheet';
beforeEach(() => {
  vi.clearAllMocks();
  h.effects = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ data: [] })),
  );
});
afterEach(() => vi.unstubAllGlobals());
it('loads secondary hotel/city/room references while skipping missing legacy room IDs in the browser preview', async () => {
  const intake = {
    id: 'synthetic',
    snapshot: {
      serviceSelections: [],
      ticketSelections: [],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'primary',
        cityId: 'first-city',
        roomTypeId: '',
        rooms: [{ roomTypeId: '' }],
        additionalStays: [
          {
            hotelId: 'second',
            cityId: 'second-city',
            rooms: [{ roomTypeId: 'second-room' }],
          },
        ],
      },
    },
  } as unknown as ReservationFormIntake;
  useReservationFormReferences(intake, true);
  h.effects.splice(0).forEach((effect) => effect());
  await vi.waitFor(() => expect(h.loaded).toHaveBeenCalledOnce());
  expect(h.detail.mock.calls.some(([, id]) => !id)).toBe(false);
  expect(h.detail.mock.calls.map(([resource, id]) => [resource, id])).toEqual(
    expect.arrayContaining([
      ['hotels', 'second'],
      ['cities', 'second-city'],
      ['room-types', 'second-room'],
    ]),
  );
  expect(h.loaded.mock.calls[0]![0]).toMatchObject({
    failed: false,
    references: {
      second: { id: 'second' },
      'second-city': { id: 'second-city' },
      'second-room': { id: 'second-room' },
    },
  });
});
