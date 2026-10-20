import type { DatePickerProps } from '@/components/ui/date-picker';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { emptySalesForm } from '../model/sales-form';
import { HotelStayDates } from './hotel-stay-dates';

const fixture = vi.hoisted(() => ({ pickers: [] as DatePickerProps[] }));
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: (props: DatePickerProps) => {
    fixture.pickers.push(props);
    return <input value={props.value} readOnly />;
  },
}));
beforeEach(() => {
  fixture.pickers = [];
});
it('defaults both shared hotel dates to Gregorian for international travel and synchronizes manual calendar changes', () => {
  const patch = vi.fn();
  const state = {
    ...emptySalesForm,
    destinationCountryId: 'turkey',
    destinationCountryCode: 'TR',
    hotel: {
      ...emptySalesForm.hotel,
      checkIn: '2026-11-01',
      checkOut: '2026-11-08',
    },
  };
  renderToStaticMarkup(<HotelStayDates state={state} patchState={patch} />);
  expect(fixture.pickers.map((p) => p.calendarSystem)).toEqual([
    'gregorian',
    'gregorian',
  ]);
  expect(fixture.pickers.map((p) => p.value)).toEqual([
    '2026-11-01',
    '2026-11-08',
  ]);
  fixture.pickers[0]!.onCalendarSystemChange!('persian');
  expect(patch).toHaveBeenCalledWith({
    hotel: { ...state.hotel, calendarSystem: 'persian' },
  });
  fixture.pickers = [];
  renderToStaticMarkup(
    <HotelStayDates
      state={{ ...state, hotel: { ...state.hotel, calendarSystem: 'persian' } }}
      patchState={patch}
    />,
  );
  expect(fixture.pickers.map((p) => p.calendarSystem)).toEqual([
    'persian',
    'persian',
  ]);
  expect(fixture.pickers.map((p) => p.value)).toEqual([
    '2026-11-01',
    '2026-11-08',
  ]);
});
