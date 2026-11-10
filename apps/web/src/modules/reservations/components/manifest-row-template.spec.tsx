import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ManifestExport } from './manifest-export';
const fixture = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  pickers: [] as {
    id: string;
    value: string;
    onChange: (id: string, name: string) => void;
  }[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = fixture.index++;
    if (!(i in fixture.states))
      fixture.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      fixture.states[i],
      (next: unknown) => {
        fixture.states[i] =
          typeof next === 'function' ? next(fixture.states[i]) : next;
      },
    ];
  },
}));
vi.mock('@/modules/ticket-catalog/components/manifest-template-picker', () => ({
  ManifestTemplatePicker: (props: (typeof fixture.pickers)[number]) => {
    fixture.pickers.push(props);
    return <span>{props.value}</span>;
  },
}));
it('has an independent default dropdown for each flight even with an assigned or unavailable uploaded template', () => {
  const ticket = {
    transportType: 'FLIGHT',
    direction: 'OUTBOUND',
    originName: 'TEHRAN',
    destinationName: 'ANTALYA',
    departureAt: '2099-10-01T08:00:00Z',
    arrivalAt: '2099-10-01T12:00:00Z',
    contractCount: 1,
    passengerCount: 2,
  };
  fixture.states = [];
  fixture.states[4] = [
    {
      ...ticket,
      offerId: 'one',
      template: { id: 'old-template', name: 'Old Assigned', versionNumber: 1 },
    },
    {
      ...ticket,
      offerId: 'two',
      template: null,
      unavailableReason: 'old unavailable',
    },
  ];
  fixture.states[9] = true;
  const render = () => {
    fixture.index = 0;
    fixture.pickers = [];
    return renderToStaticMarkup(<ManifestExport />);
  };
  const html = render();
  expect(fixture.pickers.map((p) => p.value)).toEqual([
    'DEFAULT_MANIFEST',
    'DEFAULT_MANIFEST',
  ]);
  expect(html).not.toContain('old unavailable');
  fixture.pickers[0]!.onChange('REPORT', 'گزارش‌گیری');
  render();
  expect(fixture.pickers.map((p) => p.value)).toEqual([
    'REPORT',
    'DEFAULT_MANIFEST',
  ]);
  fixture.pickers[1]!.onChange('registered', 'Registered');
  render();
  expect(fixture.pickers.map((p) => p.value)).toEqual(['REPORT', 'registered']);
});
