import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { PackageTicketDatePicker } from './package-ticket-date-picker';
import type { TicketDatePickerProps } from './ticket-date-picker';

const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
  picker: {} as TicketDatePickerProps,
  offers: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.cursor++;
    if (!(index in fixture.cells)) fixture.cells[index] = initial;
    return [
      fixture.cells[index],
      (next: unknown) => {
        fixture.cells[index] =
          typeof next === 'function'
            ? (next as (old: unknown) => unknown)(fixture.cells[index])
            : next;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => {
    fixture.effects.push(effect);
  },
}));
vi.mock('../api/tours', () => ({ toursApi: { offers: fixture.offers } }));
vi.mock('./ticket-date-picker', () => ({
  TicketDatePicker: (props: TicketDatePickerProps) => {
    fixture.picker = props;
    return null;
  },
}));
function render(originId = 'origin') {
  fixture.cursor = 0;
  fixture.effects = [];
  renderToStaticMarkup(
    <PackageTicketDatePicker
      originId={originId}
      destinationId="destination"
      branchId="branch"
    />,
  );
}
beforeEach(() => {
  fixture.cells = [];
  fixture.offers.mockReset();
});
it('marks only active tickets in the selected branch using Tehran dates', async () => {
  fixture.offers.mockResolvedValue([
    {
      branchId: 'branch',
      status: 'ACTIVE',
      departureAt: '2026-06-16T22:00:00Z',
    },
    {
      branchId: 'branch',
      status: 'ACTIVE',
      departureAt: '2026-06-17T03:00:00Z',
    },
    {
      branchId: 'other',
      status: 'ACTIVE',
      departureAt: '2026-06-18T03:00:00Z',
    },
    {
      branchId: 'branch',
      status: 'PAUSED',
      departureAt: '2026-06-19T03:00:00Z',
    },
  ]);
  render();
  fixture.picker.onVisibleRangeChange!('2026-06-01', '2026-06-30');
  render();
  fixture.effects[0]!();
  await vi.waitFor(() => {
    render();
    expect(fixture.picker.markedDates).toEqual(['2026-06-17']);
  });
  expect(fixture.offers).toHaveBeenCalledWith(
    'origin',
    'destination',
    '2026-06-01',
    '2026-06-30',
  );
  render('new-origin');
  expect(fixture.picker.markedDates).toEqual([]);
});
it('ignores stale responses after navigating to another month', async () => {
  let resolve!: (rows: unknown[]) => void;
  fixture.offers.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render();
  fixture.picker.onVisibleRangeChange!('2026-06-01', '2026-06-30');
  render();
  const cleanup = fixture.effects[0]!();
  if (cleanup) cleanup();
  fixture.picker.onVisibleRangeChange!('2026-07-01', '2026-07-31');
  resolve([
    {
      branchId: 'branch',
      status: 'ACTIVE',
      departureAt: '2026-06-17T03:00:00Z',
    },
  ]);
  await Promise.resolve();
  render();
  expect(fixture.picker.markedDates).toEqual([]);
});
it('keeps calendar selection available when the marker request fails', async () => {
  fixture.offers.mockRejectedValue(new Error('offline'));
  render();
  fixture.picker.onVisibleRangeChange!('2026-06-01', '2026-06-30');
  render();
  fixture.effects[0]!();
  await Promise.resolve();
  await Promise.resolve();
  render();
  expect(fixture.picker.markedDates).toEqual([]);
  expect(fixture.picker.disabled).toBeUndefined();
});
