import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { InputHTMLAttributes } from 'react';
import type * as FormControls from '@/components/ui/form-controls';
import { AdditionalHotelStays } from './additional-hotel-stays';
import {
  emptySalesForm,
  salesHotelValid,
  salesPayload,
  type SalesFormState,
} from '../model/sales-form';
const fixture = vi.hoisted(() => ({
  choices: [] as {
    label: string;
    options: { id: string }[];
    onChange: (value: string) => void;
  }[],
  inputs: [] as InputHTMLAttributes<HTMLInputElement>[],
  ages: [] as { label: string; onChange: (value: number | null) => void }[],
  categories: [] as { onValueChange: (value: string) => void }[],
}));
vi.mock('@/components/ui/form-controls', async (importOriginal) => {
  const original = await importOriginal<typeof FormControls>();
  return {
    ...original,
    Input: (props: InputHTMLAttributes<HTMLInputElement>) => {
      fixture.inputs.push(props);
      return <input {...props} />;
    },
  };
});
vi.mock('./sales-themed-select', () => ({
  SalesThemedSelect: (props: {
    label: string;
    onValueChange: (value: string) => void;
  }) => {
    fixture.categories.push(props);
    return <span>{props.label}</span>;
  },
}));
vi.mock('./passenger-age-field', () => ({
  PassengerAgeField: (props: {
    label: string;
    onChange: (value: number | null) => void;
  }) => {
    fixture.ages.push(props);
    return <span>{props.label}</span>;
  },
}));
vi.mock('./searchable-reference', () => ({
  SearchableReference: (props: (typeof fixture.choices)[number]) => {
    fixture.choices.push(props);
    return <div>{props.label}</div>;
  },
}));
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: ({ value }: { value: string }) => (
    <input readOnly value={value} />
  ),
}));
const hotels = [
  {
    id: 'first',
    name: 'First',
    attributes: { cityId: 'city-one', roomTypeIds: 'room-first' },
  },
  {
    id: 'second',
    name: 'Second',
    attributes: { cityId: 'city-two', roomTypeIds: 'room-second' },
  },
] as never;
const roomTypes = [
  { id: 'room-first', name: 'Single' },
  { id: 'room-second', name: 'Suite' },
] as never;
const state = {
  ...emptySalesForm,
  serviceKinds: ['FLIGHT', 'HOTEL'] as typeof emptySalesForm.serviceKinds,
  hotel: {
    ...emptySalesForm.hotel,
    multiHotel: true,
    hotelId: 'first',
    occupancy: 3,
    additionalStays: [
      {
        hotelId: 'second',
        cityId: 'city-two',
        hotelNameSnapshot: 'Second',
        checkInDate: '2099-01-03',
        checkOutDate: '2099-01-06',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: 'room-second',
            roomTypeNameSnapshot: 'Suite',
            adults: 2,
            childAges: [4],
            roomCategory: 'DOUBLE_EXTRA' as const,
          },
        ],
      },
    ],
  },
};
beforeEach(() => {
  fixture.choices = [];
  fixture.inputs = [];
  fixture.ages = [];
  fixture.categories = [];
});
it('offers all cities and clears incompatible hotel/rooms when the destination changes', () => {
  const patch = vi.fn();
  const cities = [
    { id: 'city-one', name: 'One' },
    { id: 'city-two', name: 'Two' },
    { id: 'city-three', name: 'Three' },
  ] as never;
  renderToStaticMarkup(
    <AdditionalHotelStays
      state={state}
      patch={patch}
      hotels={hotels}
      cities={cities}
      roomTypes={roomTypes}
    />,
  );
  expect(fixture.choices[0]!.label).toBe('شهر مقصد');
  expect(fixture.choices[0]!.options.map((city) => city.id)).toEqual([
    'city-one',
    'city-two',
    'city-three',
  ]);
  fixture.choices[1]!.onChange('first');
  expect(patch).not.toHaveBeenCalled();
  fixture.choices[0]!.onChange('city-three');
  expect(patch.mock.calls[0]![0].hotel.additionalStays[0]).toMatchObject({
    cityId: 'city-three',
    hotelId: '',
    hotelNameSnapshot: '',
    rooms: [],
    checkInDate: '2099-01-03',
    checkOutDate: '2099-01-06',
  });
});
it('shows no hotels before choosing a city and excludes hotels from other cities', () => {
  renderToStaticMarkup(
    <AdditionalHotelStays
      state={{
        ...state,
        hotel: {
          ...state.hotel,
          additionalStays: [{ ...state.hotel.additionalStays[0]!, cityId: '' }],
        },
      }}
      patch={vi.fn()}
      hotels={hotels}
      roomTypes={roomTypes}
    />,
  );
  expect(fixture.choices[1]!.options).toEqual([]);
});
it('edits two independent rooms and preserves child, infant, age and category in the contract payload', () => {
  let current: SalesFormState = {
    ...structuredClone(state),
    hotel: { ...structuredClone(state.hotel), occupancy: 5 },
  };
  const patch = (value: Partial<SalesFormState>) => {
    current = { ...current, ...value };
  };
  const render = () => {
    fixture.inputs = [];
    fixture.choices = [];
    fixture.ages = [];
    fixture.categories = [];
    renderToStaticMarkup(
      <AdditionalHotelStays
        state={current}
        patch={patch}
        hotels={hotels}
        roomTypes={roomTypes}
      />,
    );
  };
  const setNumber = (index: number, value: string) =>
    fixture.inputs[index]!.onChange!({ target: { value } } as never);
  render();
  setNumber(0, '2');
  render();
  fixture.choices[3]!.onChange('room-second');
  render();
  setNumber(3, '1');
  render();
  fixture.ages[1]!.onChange(1);
  render();
  fixture.categories[0]!.onValueChange('DOUBLE_EXTRA');
  render();
  const rooms = current.hotel.additionalStays![0]!.rooms!;
  expect(rooms).toHaveLength(2);
  expect(rooms[0]).toMatchObject({
    adults: 2,
    childAges: [4, 1],
    roomCategory: 'DOUBLE_EXTRA',
  });
  expect(rooms[1]).toMatchObject({
    adults: 1,
    childAges: [],
    roomTypeId: 'room-second',
  });
  expect(
    salesPayload(current).hotelSelection?.additionalStays?.[0]?.rooms,
  ).toEqual(
    rooms.map((room) => ({
      ...room,
      roomCategory: room.roomCategory ?? 'SINGLE',
    })),
  );
});
it('selects hotels across cities and only the selected hotel room types', () => {
  const patch = vi.fn();
  const html = renderToStaticMarkup(
    <AdditionalHotelStays
      state={state}
      patch={patch}
      hotels={hotels}
      roomTypes={roomTypes}
    />,
  );
  expect(fixture.choices[1]!.options.map((h) => h.id)).toEqual(['second']);
  expect(fixture.choices[2]!.options.map((r) => r.id)).toEqual(['room-second']);
  expect(html).toContain('2099-01-03');
  expect(html).toContain('2099-01-06');
  expect(html).toContain('مجموع مهمانان هتل: 3');
  expect(html).toContain('تعداد اتاق');
  expect(html).toContain('دسته‌بندی اتاق');
  expect(html).toContain('تعداد بزرگسال اتاق');
  expect(html).toContain('تعداد کودک اتاق');
  expect(html).toContain('تعداد نوزاد اتاق');
  fixture.choices[1]!.onChange('second');
  expect(patch.mock.calls[0]![0].hotel.additionalStays[0]).toMatchObject({
    cityId: 'city-two',
    hotelNameSnapshot: 'Second',
    rooms: [],
  });
});
it('shows the editor for hotel-only and flight+hotel, hides it for flight-only and when unchecked', () => {
  const render = (next: typeof state) =>
    renderToStaticMarkup(
      <AdditionalHotelStays
        state={next}
        patch={vi.fn()}
        hotels={hotels}
        roomTypes={roomTypes}
      />,
    );
  expect(render({ ...state, serviceKinds: ['HOTEL'] })).toContain('افزودن هتل');
  expect(render({ ...state, serviceKinds: ['FLIGHT'] })).toBe('');
  expect(
    render({
      ...state,
      hotel: { ...state.hotel, multiHotel: false, additionalStays: [] },
    }),
  ).toBe('');
});
it('keeps room composition and dates in the payload without creating charged duplicate hotel services', () => {
  const payload = salesPayload(state);
  expect(payload.hotelSelection?.additionalStays).toEqual(
    state.hotel.additionalStays,
  );
  expect(payload.services.filter((s) => s.kind === 'HOTEL')).toHaveLength(1);
  expect(
    salesHotelValid({
      ...state,
      hotel: {
        ...state.hotel,
        additionalStays: [{ ...state.hotel.additionalStays[0]!, rooms: [] }],
      },
    }),
  ).toBe(false);
});
