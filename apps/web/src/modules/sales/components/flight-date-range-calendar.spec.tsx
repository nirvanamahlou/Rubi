import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { FlightDateRangeFilter } from './flight-date-range';
const fixture = vi.hoisted(() => ({ open: true, system: 'persian' }));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      value === false
        ? fixture.open
        : value === 'persian'
          ? fixture.system
          : value,
      vi.fn(),
    ];
  },
}));
afterEach(() => vi.useRealTimers());
it.each(['persian', 'gregorian'])('allows past dates in %s', (system) => {
  fixture.system = system;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T21:00:00Z'));
  const html = renderToStaticMarkup(
    <FlightDateRangeFilter
      value={{ from: '2026-10-03', to: '2026-10-08' }}
      onChange={vi.fn()}
    />,
  );
  const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
  const past = buttons.filter((button) => button.includes('disabled=""'));
  expect(past).toHaveLength(0);
  const todayLabel = new Intl.DateTimeFormat(
    system === 'persian' ? 'fa-IR' : 'en-GB',
    {
      dateStyle: 'medium',
      calendar: system === 'persian' ? 'persian' : 'gregory',
    },
  ).format(new Date('2026-10-04T12:00:00'));
  const today = buttons.find((button) =>
    button.includes(`aria-label="${todayLabel}"`),
  );
  expect(today).toBeDefined();
  expect(today).not.toContain('disabled=""');
});
