import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { ServiceParties } from './service-parties';
import {
  emptySalesForm,
  salesFlightSeats,
  type SalesFormState,
} from '../model/sales-form';
import { passengerSlotKeys } from '../model/sales-people-sheet';
const fixture = vi.hoisted(() => ({
  categorySelects: [] as {
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string) => void;
  }[],
  childSelects: [] as {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (key: string) => void;
  }[],
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
vi.mock('./sales-themed-select', () => ({
  SalesThemedSelect: (props: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (key: string) => void;
  }) => {
    if (props.label === 'دسته‌بندی اتاق') fixture.categorySelects.push(props);
    else fixture.childSelects.push(props);
    return <span>{props.label}</span>;
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
  fixture.childSelects = [];
  fixture.categorySelects = [];
  fixture.inputs = [];
  fixture.selects = [];
});
const state: SalesFormState = {
  ...emptySalesForm,
  passengerComposition: { adults: 4, children: 2, infants: 0 },
  serviceKinds: ['FLIGHT', 'HOTEL', 'VISA'],
  childAges: [5, 7],
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
  expect(fixture.inputs.map((p) => p.value)).toEqual([
    2, 1, 6, 2, 2, 1, 0, 1, 0, 0,
  ]);
});
it('changing a room affects that room without changing the flight party', () => {
  const patch = vi.fn();
  renderToStaticMarkup(<ServiceParties {...props} patch={patch} />);
  fixture.inputs[7]!.onChange({ target: { value: '2' } });
  const next = patch.mock.calls[0]![0];
  expect(next.passengerComposition).toBeUndefined();
  expect(next.hotel.rooms[0]).toMatchObject(state.hotel.rooms![0]!);
  expect(next.hotel.rooms[1].adults).toBe(2);
  expect(next.hotel).toMatchObject({
    roomCount: 2,
    singleRoomCount: 0,
    doubleRoomCount: 2,
    extraBedCount: 0,
    occupancy: 5,
  });
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
  fixture.inputs[7]!.onChange({ target: { value: '9' } });
  expect(patch.mock.calls[0]![0].hotel.rooms[1].adults).toBe(2);
  fixture.inputs[8]!.onChange({ target: { value: '9' } });
  expect(patch.mock.calls[1]![0].hotel.rooms[1].childAges).toEqual([7]);
});

it('offers only unused flight children and inherits their age instead of asking for it again', () => {
  const patch = vi.fn();
  const value = {
    ...state,
    hotel: {
      ...state.hotel,
      rooms: [
        state.hotel.rooms![0]!,
        { ...state.hotel.rooms![1]!, childAges: [7] },
      ],
    },
  };
  renderToStaticMarkup(
    <ServiceParties {...props} state={value} patch={patch} />,
  );
  expect(fixture.childSelects[0]!.value).toBe('child:0');
  expect(
    fixture.childSelects[0]!.options.some((o) => o.value === 'child:1'),
  ).toBe(false);
  expect(fixture.childSelects[1]!.value).toBe('child:1');
  expect(
    fixture.childSelects[1]!.options.some((o) => o.value === 'child:0'),
  ).toBe(false);
  fixture.childSelects[0]!.onValueChange('');
  expect(patch.mock.calls[0]![0].hotel.rooms[0].childAges).toEqual([null]);
  fixture.childSelects = [];
  fixture.categorySelects = [];
  renderToStaticMarkup(
    <ServiceParties
      {...props}
      state={{ ...value, childAges: [6, 7] }}
      patch={patch}
    />,
  );
  expect(
    fixture.childSelects[0]!.options.some((o) => o.label === 'کودک 1 · 6 سال'),
  ).toBe(true);
});

it('defaults a double with children without extra beds and saves an editable extra-bed override', () => {
  const patch = vi.fn();
  renderToStaticMarkup(<ServiceParties {...props} patch={patch} />);
  expect(fixture.categorySelects[0]!.value).toBe('DOUBLE');
  expect(fixture.categorySelects[0]!.options.map((o) => o.value)).toEqual([
    '',
    'DOUBLE',
    'DOUBLE_EXTRA',
    'FAMILY',
  ]);
  fixture.categorySelects[0]!.onValueChange('DOUBLE_EXTRA');
  expect(patch.mock.calls[0]![0].hotel.rooms[0].roomCategory).toBe(
    'DOUBLE_EXTRA',
  );
  expect(patch.mock.calls[0]![0].hotel.extraBedCount).toBe(1);
  fixture.categorySelects[0]!.onValueChange('FAMILY');
  expect(patch.mock.calls[1]![0].hotel.rooms[0].roomCategory).toBe('FAMILY');
  expect(patch.mock.calls[1]![0].hotel.extraBedCount).toBe(0);
});

it('adding a room infant creates the flight infant composition without an extra seat or bed', () => {
  const patch = vi.fn();
  const driven = { ...state, roomDrivenGuests: true };
  const html = renderToStaticMarkup(
    <ServiceParties {...props} state={driven} patch={patch} />,
  );
  expect(html).toContain('تعداد بزرگسال اتاق');
  expect(html).toContain('تعداد کودک اتاق');
  expect(html).toContain('تعداد نوزاد اتاق');
  fixture.inputs[6]!.onChange({ target: { value: '1' } });
  const next = patch.mock.calls[0]![0];
  expect(next.hotel.rooms[0].childAges).toEqual([5, 0]);
  expect(next.passengerComposition).toEqual({
    adults: 3,
    children: 1,
    infants: 1,
  });
  expect(next.infantAges).toEqual([0]);
  const updated = { ...driven, ...next };
  expect(passengerSlotKeys(updated)).toHaveLength(5);
  expect(salesFlightSeats(updated, 'OUTBOUND')).toBe(4);
  expect(next.hotel.rooms[0].roomCategory).toBe('DOUBLE');
});

it('assigns a declared infant to a legacy room without losing the child link', () => {
  const patch = vi.fn();
  const legacy = {
    ...state,
    passengerComposition: { adults: 4, children: 2, infants: 1 },
    infantAges: [1],
    hotelChildAssignments: { '1': ['child:0'], '2': [] },
  };
  renderToStaticMarkup(
    <ServiceParties {...props} state={legacy} patch={patch} />,
  );
  fixture.inputs[6]!.onChange({ target: { value: '1' } });
  expect(patch.mock.calls[0]![0].hotel.rooms[0].childAges).toEqual([5, 1]);
  expect(patch.mock.calls[0]![0].hotelChildAssignments['1']).toEqual([
    'child:0',
    'infant:0',
  ]);
  expect(legacy.hotelChildAssignments['1']).toEqual(['child:0']);
});
