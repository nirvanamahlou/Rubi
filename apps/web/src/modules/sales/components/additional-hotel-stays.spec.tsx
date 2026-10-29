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
it('derives the city from the selected hotel without a separate city or guest editor', () => {
  const patch = vi.fn();
  const html = renderToStaticMarkup(
    <AdditionalHotelStays
      state={state}
      patch={patch}
      hotels={hotels}
      roomTypes={roomTypes}
    />,
  );
  const picker = fixture.choices.find((c) => c.label === 'هتل')!;
  expect(picker.options.map((h) => h.id)).toEqual(['second']);
  picker.onChange('second');
  expect(patch.mock.calls[0]![0].hotel.additionalStays[0]).toMatchObject({
    cityId: 'city-two',
    hotelNameSnapshot: 'Second',
    checkInDate: '2099-01-03',
    checkOutDate: '2099-01-06',
  });
  expect(html).not.toContain('تعداد بزرگسال اتاق');
  expect(html).not.toContain('تعداد کودک اتاق');
  expect(html).not.toContain('تعداد نوزاد اتاق');
  expect(fixture.ages).toHaveLength(0);
});
it('copies the first stay guest composition into later room products and updates it when primary guests change', () => {
  const current: SalesFormState = {
    ...state,
    hotel: {
      ...state.hotel,
      occupancy: 4,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '10000000-0000-4000-8000-000000000001',
          roomTypeNameSnapshot: 'First',
          adults: 2,
          childAges: [4, 1],
          roomCategory: 'DOUBLE_EXTRA',
        },
      ],
    },
  };
  const patch = vi.fn();
  renderToStaticMarkup(
    <AdditionalHotelStays
      state={current}
      patch={patch}
      hotels={hotels}
      roomTypes={roomTypes}
    />,
  );
  fixture.choices.find((c) => c.label === 'نوع اتاق')!.onChange('room-second');
  const next = { ...current, ...patch.mock.calls[0]![0] } as SalesFormState;
  expect(next.hotel.additionalStays![0]!.rooms![0]).toMatchObject({
    adults: 2,
    childAges: [4, 1],
    roomTypeId: 'room-second',
  });
  expect(
    salesPayload(next).hotelSelection?.additionalStays?.[0]?.rooms?.[0],
  ).toMatchObject({ adults: 2, childAges: [4, 1] });
  current.hotel.rooms![0]!.adults = 3;
  expect(
    salesPayload(current).hotelSelection?.additionalStays?.[0]?.rooms?.[0]
      ?.adults,
  ).toBe(3);
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
