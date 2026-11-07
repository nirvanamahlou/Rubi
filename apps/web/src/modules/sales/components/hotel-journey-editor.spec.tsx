import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { HotelJourneyV1 } from '@nora/contracts';
import { HotelJourneyEditor } from './hotel-journey-editor';
const h = vi.hoisted(() => ({
  dates: [] as { value: string; onChange: (value: string) => void }[],
  selects: [] as { label: string; onValueChange: (value: string) => void }[],
  airports: [] as {
    label: string;
    cityId: string;
    countryId: string;
    preferredId?: string;
  }[],
}));
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: (props: (typeof h.dates)[number]) => {
    h.dates.push(props);
    return <span>{props.value}</span>;
  },
}));
vi.mock('./sales-themed-select', () => ({
  SalesThemedSelect: (props: (typeof h.selects)[number]) => {
    h.selects.push(props);
    return <span>{props.label}</span>;
  },
}));
vi.mock('./floating-flight-airport', () => ({
  FloatingFlightAirport: (props: (typeof h.airports)[number]) => {
    h.airports.push(props);
    return <span>{props.label}</span>;
  },
}));
const leg: HotelJourneyV1 = {
  fromHotelId: 'first',
  toHotelId: 'second',
  mode: 'BUS',
  departureDate: '2027-01-06',
  arrivalDate: '2027-01-06',
  departureTime: '09:00',
  arrivalTime: '11:00',
};
const props = {
  fromHotelId: 'first',
  toHotelId: 'second',
  fromLabel: 'First hotel',
  toLabel: 'Second hotel',
  originCityId: 'istanbul',
  destinationCityId: 'paris',
  defaultDate: '2027-01-06',
  cities: [
    { id: 'istanbul', attributes: { countryId: 'turkey' } },
    { id: 'paris', attributes: { countryId: 'france' } },
  ] as never,
};
beforeEach(() => {
  h.dates = [];
  h.selects = [];
  h.airports = [];
});
it('starts optional and exposes independent editable travel dates without flight fields for ground transport', () => {
  expect(
    renderToStaticMarkup(<HotelJourneyEditor {...props} onChange={vi.fn()} />),
  ).toContain('افزودن جابه‌جایی');
  expect(h.dates).toHaveLength(0);
  const change = vi.fn();
  const html = renderToStaticMarkup(
    <HotelJourneyEditor {...props} value={leg} onChange={change} />,
  );
  expect(html).not.toContain('شماره پرواز');
  expect(h.airports).toHaveLength(0);
  h.dates[0]!.onChange('2027-01-09');
  expect(change.mock.lastCall![0]).toMatchObject({
    departureDate: '2027-01-09',
  });
  expect(h.dates).toHaveLength(1);
  expect(html).not.toContain('تاریخ رسیدن جابه‌جایی');
  expect(change.mock.lastCall![0]).not.toHaveProperty('arrivalDate');
});
it('creates independent flight fields and determines the countries from the two hotel cities', () => {
  const change = vi.fn();
  renderToStaticMarkup(
    <HotelJourneyEditor {...props} value={leg} onChange={change} />,
  );
  h.selects.find((s) => s.label === 'روش جابه‌جایی')!.onValueChange('FLIGHT');
  const value = change.mock.lastCall![0] as HotelJourneyV1;
  expect(value.flight).toMatchObject({
    airline: '',
    number: '',
    cabinClass: 'ECONOMY',
  });
  const html = renderToStaticMarkup(
    <HotelJourneyEditor {...props} value={value} onChange={change} />,
  );
  expect(html).toContain('شماره پرواز جابه‌جایی');
  expect(h.airports).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ cityId: 'istanbul', countryId: 'turkey' }),
      expect.objectContaining({ cityId: 'paris', countryId: 'france' }),
    ]),
  );
  h.selects.at(-2)!.onValueChange('CAR');
  expect(change.mock.lastCall![0]).not.toHaveProperty('flight');
});
it('passes the return ticket airport identity for the final journey default', () => {
  renderToStaticMarkup(
    <HotelJourneyEditor
      {...props}
      toHotelId={null}
      value={{ ...leg, toHotelId: null }}
      preferredAirportId="return-airport"
      onChange={vi.fn()}
    />,
  );
  expect(h.airports[0]).toMatchObject({
    label: 'فرودگاه بلیت برگشت',
    preferredId: 'return-airport',
  });
});
