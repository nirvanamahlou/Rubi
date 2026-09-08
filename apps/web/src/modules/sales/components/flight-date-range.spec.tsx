import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  FlightDateRangeFilter,
  selectFlightRange,
  flightCalendarPlacement,
} from './flight-date-range';
describe('optional flight range', () => {
  it('opens above low controls and bounds panel height to visible space', () => {
    expect(flightCalendarPlacement(750, 794, 900)).toEqual({
      above: true,
      maxHeight: 520,
    });
    expect(flightCalendarPlacement(120, 164, 800)).toEqual({
      above: false,
      maxHeight: 520,
    });
    expect(flightCalendarPlacement(300, 344, 800)).toEqual({
      above: false,
      maxHeight: 440,
    });
  });
  it('selects both endpoints in one calendar, including reverse and same-day ranges', () => {
    const start = selectFlightRange({ from: '', to: '' }, '2026-10-10');
    expect(start).toEqual({ from: '2026-10-10', to: '' });
    expect(selectFlightRange(start, '2026-10-08')).toEqual({
      from: '2026-10-08',
      to: '2026-10-10',
    });
    expect(selectFlightRange(start, '2026-10-10')).toEqual({
      from: '2026-10-10',
      to: '2026-10-10',
    });
    expect(
      selectFlightRange({ from: '2026-10-01', to: '2026-10-10' }, '2026-11-01'),
    ).toEqual({ from: '2026-11-01', to: '' });
  });
  it('starts without a required date and offers clearing an applied filter', () => {
    expect(
      renderToStaticMarkup(
        <FlightDateRangeFilter
          value={{ from: '', to: '' }}
          onChange={() => undefined}
        />,
      ),
    ).toContain('همه بلیت‌های آینده');
    expect(
      renderToStaticMarkup(
        <FlightDateRangeFilter
          value={{ from: '2026-10-01', to: '2026-10-10' }}
          onChange={() => undefined}
        />,
      ),
    ).toContain('پاک کردن فیلتر تاریخ');
  });
});
