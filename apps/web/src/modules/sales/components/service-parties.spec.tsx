import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ServiceParties } from './service-parties';
import { emptySalesForm, type SalesFormState } from '../model/sales-form';
const fixture = vi.hoisted(() => ({
  inputs: [] as {
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }[],
  selects: [] as { label: string; onChange: (id: string) => void }[],
}));
vi.mock('@/components/ui/form-controls', () => ({
  Input: (props: {
    value: unknown;
    onChange: (event: { target: { value: string } }) => void;
  }) => {
    fixture.inputs.push(props);
    return <input value={String(props.value ?? '')} readOnly />;
  },
}));
vi.mock('./passenger-age-field', () => ({
  PassengerAgeField: ({ label }: { label: string }) => (
    <span
      role="combobox"
      aria-expanded={false}
      aria-controls="room-age-options"
    >
      {label}
    </span>
  ),
}));
vi.mock('./searchable-reference', () => ({
  SearchableReference: (props: {
    label: string;
    onChange: (id: string) => void;
  }) => {
    fixture.selects.push(props);
    return <span>{props.label}</span>;
  },
}));
beforeEach(() => {
  fixture.inputs = [];
  fixture.selects = [];
});
const state: SalesFormState = {
  ...emptySalesForm,
  passengerComposition: { adults: 4, children: 2, infants: 0 },
  serviceKinds: ['FLIGHT', 'HOTEL', 'VISA'],
  visaComposition: { adults: 2, children: 1 },
  visaChildAges: [6],
  visaApplicantIds: ['old'],
  hotel: {
    ...emptySalesForm.hotel,
    hotelId: 'h',
    rooms: [
      {
        ordinal: 1,
        roomTypeId: 'double',
        roomTypeNameSnapshot: 'Double',
        adults: 2,
        childAges: [5],
      },
      {
        ordinal: 2,
        roomTypeId: 'single',
        roomTypeNameSnapshot: 'Single',
        adults: 1,
        childAges: [],
      },
    ],
  },
};
const props: ComponentProps<typeof ServiceParties> = {
  state,
  patch: vi.fn(),
  hotels: [],
  roomTypes: [],
  rates: [],
};
it('shows independent room cards, visa child ages and compact responsive columns', () => {
  const html = renderToStaticMarkup(<ServiceParties {...props} />);
  expect(html).toContain('اتاق 1');
  expect(html).toContain('اتاق 2');
  expect(html).toContain('lg:grid-cols-2');
  expect(fixture.inputs.map((p) => p.value)).toEqual([2, 1, 6, 2, 2, 1, 1, 0]);
});
it('changing a room affects that room without changing the flight party', () => {
  const patch = vi.fn();
  renderToStaticMarkup(<ServiceParties {...props} patch={patch} />);
  fixture.inputs[6]!.onChange({ target: { value: '2' } });
  const next = patch.mock.calls[0]![0];
  expect(next.passengerComposition).toBeUndefined();
  expect(next.hotel.rooms[0]).toEqual(state.hotel.rooms![0]);
  expect(next.hotel.rooms[1].adults).toBe(2);
});
it('changing visa quantities clears stale applicants and creates each child age field', () => {
  const patch = vi.fn();
  renderToStaticMarkup(<ServiceParties {...props} patch={patch} />);
  fixture.inputs[1]!.onChange({ target: { value: '2' } });
  expect(patch).toHaveBeenCalledWith(
    expect.objectContaining({
      visaComposition: { adults: 2, children: 2 },
      visaApplicantIds: [],
      visaChildAges: [6, null],
    }),
  );
});
it('changing hotel removes the previous room products', () => {
  const patch = vi.fn();
  renderToStaticMarkup(<ServiceParties {...props} patch={patch} />);
  fixture.selects.find((s) => s.label === 'هتل')!.onChange('other');
  expect(patch.mock.calls[0]![0].hotel.rooms).toEqual([]);
});

it('caps each room at the remaining adults and children in the flight party', () => {
  const patch = vi.fn();
  const next = {
    ...state,
    visaComposition: { adults: 6, children: 2 },
    passengerComposition: { adults: 6, children: 2, infants: 0 },
    hotel: {
      ...state.hotel,
      rooms: [
        { ...state.hotel.rooms![0]!, adults: 4, childAges: [5] },
        { ...state.hotel.rooms![1]!, adults: 2, childAges: [7] },
      ],
    },
  };
  renderToStaticMarkup(
    <ServiceParties {...props} state={next} patch={patch} />,
  );
  fixture.inputs[6]!.onChange({ target: { value: '9' } });
  expect(patch.mock.calls[0]![0].hotel.rooms[1].adults).toBe(2);
  fixture.inputs[7]!.onChange({ target: { value: '9' } });
  expect(patch.mock.calls[1]![0].hotel.rooms[1].childAges).toEqual([7]);
});
