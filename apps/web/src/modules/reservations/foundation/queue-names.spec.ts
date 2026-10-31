import { beforeEach, expect, it, vi } from 'vitest';
const harness = vi.hoisted(() => ({
  loaded: undefined as unknown,
  effect: undefined as (() => void | (() => void)) | undefined,
  detail: vi.fn(),
}));
vi.mock('react', () => ({
  useState: () => [
    harness.loaded,
    (value: unknown) => {
      harness.loaded = value;
    },
  ],
  useEffect: (effect: () => void | (() => void)) => {
    harness.effect = effect;
  },
}));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: { detail: harness.detail },
}));
import { useQueueNames } from './queue-names';
import type { RequestView } from './model';

beforeEach(() => {
  harness.loaded = undefined;
  harness.effect = undefined;
  harness.detail.mockReset();
});

it('loads each composite hotel and keeps all names when one reference fails', async () => {
  const row: RequestView = {
    id: 'synthetic-request',
    contractNumber: 'SYNTHETIC',
    branchId: 'branch',
    branchName: 'Branch',
    issuerName: '',
    customerName: '',
    salesCounter: '',
    assignee: null,
    passengerNames: [],
    services: ['HOTEL'],
    priority: 'UNSPECIFIED',
    deadline: null,
    createdAt: '2026-10-31T00:00:00Z',
    status: 'NEW',
    issues: [],
    hotelId: 'primary',
    hotelName: 'FIRST / SECOND / THIRD',
    hotels: [
      { hotelId: 'primary', name: 'FIRST' },
      { hotelId: 'second', name: 'SECOND' },
      { hotelId: 'third', name: 'THIRD' },
    ],
  };
  harness.detail.mockImplementation(async (_resource: string, id: string) => {
    if (id === 'second') throw Error('Unavailable reference');
    return {
      data: {
        attributes: {
          englishName: id === 'primary' ? 'FIRST ENGLISH' : 'THIRD ENGLISH',
        },
      },
    };
  });
  expect(useQueueNames([row]).rows[0]?.hotelName).toBe(
    'FIRST / SECOND / THIRD',
  );
  const cleanup = harness.effect?.();
  await vi.waitFor(() => expect(harness.loaded).toBeDefined());
  const resolved = useQueueNames([row]);
  expect(resolved.ready).toBe(true);
  expect(resolved.rows[0]?.hotelName).toBe(
    'FIRST ENGLISH / SECOND / THIRD ENGLISH',
  );
  expect(resolved.rows[0]?.hotelId).toBe('primary');
  for (const id of ['primary', 'second', 'third'])
    expect(harness.detail).toHaveBeenCalledWith('hotels', id, 'reservations');
  if (typeof cleanup === 'function') cleanup();
});
