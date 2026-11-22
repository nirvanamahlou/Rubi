import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Reference, ProductInput } from '../model/catalog';
import { emptyInput } from '../model/preview';
import { FlightScheduleForm } from './flight-schedule-form';
import { readFileSync } from 'node:fs';
const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  pickers: [] as {
    id: string;
    countryId?: string;
    allowAnyCityCountry?: boolean;
    value?: Reference;
    onSelect: (value: Reference | undefined) => void;
  }[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = fixture.cursor++;
    if (!(i in fixture.cells))
      fixture.cells[i] =
        typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      fixture.cells[i],
      (next: unknown) => {
        fixture.cells[i] =
          typeof next === 'function'
            ? (next as (old: unknown) => unknown)(fixture.cells[i])
            : next;
      },
    ];
  },
}));
vi.mock('./reference-picker', () => ({
  ReferencePicker: (props: (typeof fixture.pickers)[number]) => {
    fixture.pickers.push(props);
    return <div data-picker={props.id} />;
  },
}));
vi.mock('./ticket-date-picker', () => ({ TicketDatePicker: () => null }));
vi.mock('./manifest-template-picker', () => ({
  ManifestTemplatePicker: () => null,
}));
vi.mock('./flight-cabin-capacities', () => ({
  FlightCabinCapacities: () => null,
}));
const countries: Reference[] = [
  { id: 'country-a', kind: 'country', name: 'Country A', active: true },
  { id: 'country-b', kind: 'country', name: 'Country B', active: true },
  { id: 'country-c', kind: 'country', name: 'Country C', active: true },
];
const city: Reference = {
  id: 'extra',
  kind: 'city',
  name: 'Extra city',
  countryId: 'country-c',
  active: true,
};
function render(initial: ProductInput) {
  fixture.cursor = 0;
  fixture.pickers = [];
  return renderToStaticMarkup(
    <FlightScheduleForm
      initial={initial}
      references={[...countries, city]}
      onReference={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}
beforeEach(() => {
  fixture.cells = [];
  fixture.cursor = 0;
  fixture.pickers = [];
});
it.each(['outbound', 'return'] as const)(
  'allows %s sales routes to use cities abroad and retains them when the primary country changes',
  (role) => {
    const initial: ProductInput = {
      ...emptyInput(),
      journeyRole: role,
      totalCapacity: 25,
      saleRoutes: [
        role === 'return'
          ? { originId: 'extra', destinationId: 'home' }
          : { originId: 'home', destinationId: 'extra' },
      ],
    };
    initial.segments = [
      {
        ...initial.segments[0]!,
        originCountryId: role === 'return' ? 'country-b' : 'country-a',
        destinationCountryId: role === 'return' ? 'country-a' : 'country-b',
        originCityId: role === 'return' ? 'primary' : 'home',
        destinationCityId: role === 'return' ? 'home' : 'primary',
        departureAt: '2099-01-01T10:00:00Z',
        arrivalAt: '2099-01-01T12:00:00Z',
      },
    ];
    render(initial);
    const side = role === 'return' ? 'origin' : 'destination';
    expect(
      fixture.pickers.find((p) => p.id === 'sale-destination-0'),
    ).toMatchObject({
      allowAnyCityCountry: true,
      value: city,
    });
    expect(
      fixture.pickers.find((p) => p.id === 'sale-destination-0')?.countryId,
    ).toBeUndefined();
    expect(
      fixture.pickers.find((p) => p.id === `schedule-${side}-city`)?.countryId,
    ).toBe('country-b');
    fixture.pickers
      .find((p) => p.id === `schedule-${side}-country`)!
      .onSelect(countries[2]);
    render(initial);
    expect(
      fixture.pickers.find((p) => p.id === 'sale-destination-0'),
    ).toMatchObject({ allowAnyCityCountry: true, value: city });
    const input = fixture.cells.find((value): value is ProductInput =>
      Boolean(value && typeof value === 'object' && 'segments' in value),
    )!;
    expect(input.totalCapacity).toBe(25);
    expect(input.saleRoutes).toEqual(initial.saleRoutes);
  },
);
it('keeps the added city on the same label/control grid and excludes its container from that grid', () => {
  const css = readFileSync(
    new URL('./flight-schedule-form.module.css', import.meta.url),
    'utf8',
  );
  expect(css).toMatch(
    /\.route > div:not\(\.extraDestinations\),\s*\.extraDestination > div\s*\{[^}]*grid-template-columns: 4rem minmax\(0, 1fr\)/,
  );
  expect(css).toMatch(
    /\.extraDestinations,\s*\.extraDestination\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/,
  );
});
