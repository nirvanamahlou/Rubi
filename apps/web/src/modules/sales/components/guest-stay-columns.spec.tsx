import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { guestStayColumns } from './guest-stay-columns';
import { emptySalesForm } from '../model/sales-form';
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: ({
    value,
    disabled,
    calendarSystem,
  }: {
    value: string;
    disabled: boolean;
    calendarSystem: string;
  }) => (
    <input
      value={value}
      disabled={disabled}
      data-calendar={calendarSystem}
      readOnly
    />
  ),
}));
vi.mock('./sales-themed-select', () => ({
  SalesThemedSelect: ({ label }: { label: string }) => <span>{label}</span>,
}));
const state = {
  ...emptySalesForm,
  hotel: {
    ...emptySalesForm.hotel,
    checkIn: '2026-11-01',
    checkOut: '2026-11-07',
  },
};
describe('passenger hotel date columns', () => {
  it('locks inherited check-in and check-out', () => {
    const cols = guestStayColumns(state, vi.fn(), (key) => key);
    for (const col of cols.slice(0, 2))
      expect(
        renderToStaticMarkup(col.render({ key: 'sales-entry-p0' })),
      ).toContain('disabled');
    expect(
      renderToStaticMarkup(cols[0]!.render({ key: 'sales-entry-p0' })),
    ).toContain('2026-11-01');
  });
  it('unlocks only an explicit override without putting pricing in the passenger table', () => {
    const cols = guestStayColumns(
      {
        ...state,
        passengerHotelStays: {
          p0: {
            different: true,
            checkIn: '2026-11-02',
            checkOut: '2026-11-04',
          },
        },
      },
      vi.fn(),
      (key) => key,
    );
    expect(
      renderToStaticMarkup(cols[0]!.render({ key: 'sales-entry-p0' })),
    ).not.toContain('disabled');
    expect(cols.map((col) => col.key)).toEqual([
      'checkIn',
      'checkOut',
      'differentStay',
    ]);
    expect(cols.every((col) => col.position === 'end')).toBe(true);
  });
  it('does not show hotel dates or hotel price for a flight-only row', () => {
    const cols = guestStayColumns(
      { ...state, flightOnlyPassengers: [{ key: 'flight-only-0', age: 18 }] },
      vi.fn(),
      (key) => key,
    );
    expect(
      renderToStaticMarkup(
        cols[0]!.render({ key: 'sales-entry-flight-only-0' }),
      ),
    ).toBe('<span>—</span>');
  });
});

it('uses the same Gregorian hotel calendar as the shared stay fields, independently of birth dates', () => {
  for (const sample of [
    { ...state, destinationCountryId: 'turkey', destinationCountryCode: 'TR' },
    {
      ...state,
      hotel: { ...state.hotel, calendarSystem: 'gregorian' as const },
    },
  ]) {
    const cols = guestStayColumns(sample, vi.fn(), (key) => key);
    expect(
      renderToStaticMarkup(cols[0]!.render({ key: 'sales-entry-p0' })),
    ).toContain('data-calendar="gregorian"');
    expect(
      renderToStaticMarkup(cols[1]!.render({ key: 'sales-entry-p0' })),
    ).toContain('data-calendar="gregorian"');
  }
});
