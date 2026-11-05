import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  SalesHotelSelectionInput,
  MasterDataRecord,
} from '@nora/contracts';
import {
  AmendmentAdditionalHotelStays,
  updateAdditionalAmendmentStay,
} from './amendment-additional-hotel-stays';
const h = vi.hoisted(() => ({
  dates: [] as {
    value: string;
    calendarSystem: string;
    onChange: (value: string) => void;
  }[],
  hotels: [] as { label: string; onChange: (id: string) => void }[],
  rooms: [] as {
    hotel: SalesHotelSelectionInput;
    onChange: (hotel: SalesHotelSelectionInput) => void;
  }[],
}));
vi.mock('@/modules/sales/components/sales-date-picker', () => ({
  SalesDatePicker: (props: (typeof h.dates)[number]) => {
    h.dates.push(props);
    return <span>{props.value}</span>;
  },
}));
vi.mock('@/modules/sales/components/searchable-reference', () => ({
  SearchableReference: (props: (typeof h.hotels)[number]) => {
    h.hotels.push(props);
    return null;
  },
}));
vi.mock('./amendment-hotel-rooms', () => ({
  AmendmentHotelRooms: (props: (typeof h.rooms)[number]) => {
    h.rooms.push(props);
    return null;
  },
}));
function fixture(): SalesHotelSelectionInput {
  return {
    serviceClientKey: 'hotel-service',
    hotelId: 'first',
    hotelNameSnapshot: 'FIRST HOTEL',
    cityId: 'first-city',
    checkInDate: '2027-01-01',
    checkOutDate: '2027-01-03',
    roomCount: 1,
    roomTypeId: 'first-room',
    occupancy: 2,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    rooms: [
      {
        ordinal: 1,
        roomTypeId: 'first-room',
        roomTypeNameSnapshot: 'FIRST DOUBLE',
        adults: 2,
        childAges: [],
        roomCategory: 'DOUBLE',
        agreedPrice: { amount: '100', currencyCode: 'USD' },
      },
    ],
    additionalStays: [
      {
        hotelId: 'second',
        hotelNameSnapshot: 'SECOND HOTEL',
        cityId: 'second-city',
        checkInDate: '2027-01-03',
        checkOutDate: '2027-01-06',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: 'second-room',
            roomTypeNameSnapshot: 'SECOND SINGLE',
            adults: 1,
            childAges: [],
            roomCategory: 'SINGLE',
          },
        ],
      },
      {
        hotelId: 'third',
        hotelNameSnapshot: 'THIRD HOTEL',
        cityId: 'third-city',
        checkInDate: '2027-01-06',
        checkOutDate: '2027-01-08',
      },
    ],
  };
}
const options = [
  {
    id: 'replacement',
    resource: 'hotels',
    code: 'REPLACEMENT',
    status: 'active',
    version: 1,
    createdAt: '2027-01-01T00:00:00Z',
    updatedAt: '2027-01-01T00:00:00Z',
    name: 'REPLACEMENT HOTEL',
    attributes: { cityId: 'replacement-city' },
  },
] satisfies MasterDataRecord[];
function render(hotel: SalesHotelSelectionInput, onChange = vi.fn()) {
  h.dates = [];
  h.hotels = [];
  h.rooms = [];
  return renderToStaticMarkup(
    <AmendmentAdditionalHotelStays
      hotel={hotel}
      hotels={options}
      roomTypes={[]}
      currencies={[]}
      onChange={onChange}
    />,
  );
}
beforeEach(() => {
  h.dates = [];
  h.hotels = [];
  h.rooms = [];
});
it('edits the second stay check-in and check-out independently while retaining primary and third stay', () => {
  const hotel = fixture();
  const before = structuredClone(hotel);
  const changed = vi.fn();
  const html = render(hotel, changed);
  expect(html).toContain('SECOND HOTEL');
  expect(html).toContain('THIRD HOTEL');
  expect(h.dates).toHaveLength(4);
  expect(h.dates.every((date) => date.calendarSystem === 'gregorian')).toBe(
    true,
  );
  h.dates[0]!.onChange('2027-01-04');
  const next = changed.mock.calls[0]![0] as SalesHotelSelectionInput;
  expect(next.additionalStays![0]).toMatchObject({
    checkInDate: '2027-01-04',
    checkOutDate: '2027-01-06',
  });
  expect(next.checkInDate).toBe(hotel.checkInDate);
  expect(next.rooms).toEqual(hotel.rooms);
  expect(next.additionalStays![1]).toEqual(hotel.additionalStays![1]);
  render(next, changed);
  h.dates[1]!.onChange('2027-01-07');
  expect(changed.mock.lastCall![0].additionalStays[0].checkOutDate).toBe(
    '2027-01-07',
  );
  expect(hotel).toEqual(before);
});
it('changes another hotel and its room composition without copying primary hotel pricing or fields', () => {
  const hotel = fixture();
  const changed = vi.fn();
  render(hotel, changed);
  h.hotels
    .find((c) => c.label === 'شهر اقامت بعدی')!
    .onChange('replacement-city');
  expect(changed.mock.lastCall![0].additionalStays[0].hotelId).toBe('');
  render(changed.mock.lastCall![0], changed);
  h.hotels.find((c) => c.label === 'هتل')!.onChange('replacement');
  expect(changed.mock.lastCall![0].additionalStays[0]).toMatchObject({
    hotelId: 'replacement',
    cityId: 'replacement-city',
    checkInDate: '2027-01-03',
  });
  expect(changed.mock.lastCall![0].hotelId).toBe('first');
  h.rooms[0]!.onChange({
    ...h.rooms[0]!.hotel,
    rooms: [
      {
        ordinal: 1,
        roomTypeId: 'family',
        roomTypeNameSnapshot: 'FAMILY',
        adults: 2,
        childAges: [5],
        roomCategory: 'FAMILY',
      },
    ],
  });
  expect(changed.mock.lastCall![0].additionalStays[0].rooms[0]).toMatchObject({
    roomTypeId: 'family',
    childAges: [5],
  });
  expect(changed.mock.lastCall![0].rooms[0].agreedPrice).toEqual({
    amount: '100',
    currencyCode: 'USD',
  });
  expect(h.rooms[1]!.hotel.rooms).toEqual([]);
  expect(h.rooms[1]!.hotel.roomTypeId).toBe('');
});
it('keeps single-hotel contracts unchanged and rejects nonexistent stay indexes', () => {
  const hotel = fixture();
  delete hotel.additionalStays;
  expect(render(hotel)).toBe('');
  expect(() =>
    updateAdditionalAmendmentStay(hotel, 0, { checkInDate: '2027-01-02' }),
  ).toThrow();
  const composite = fixture();
  const before = structuredClone(composite);
  for (const index of [-1, 2, 0.5])
    expect(() => updateAdditionalAmendmentStay(composite, index, {})).toThrow();
  expect(composite).toEqual(before);
});
