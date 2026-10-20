import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { guestStayColumns } from './guest-stay-columns';
import { emptySalesForm } from '../model/sales-form';
vi.mock('./sales-date-picker', () => ({
  SalesDatePicker: ({
    value,
    disabled,
  }: {
    value: string;
    disabled: boolean;
  }) => <input value={value} disabled={disabled} readOnly />,
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
  it('unlocks only an explicit override and exposes its own currency/amount fields', () => {
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
    const price = renderToStaticMarkup(
      cols[3]!.render({ key: 'sales-entry-p0' }),
    );
    expect(price).toContain('مبلغ اقامت متفاوت');
    expect(price).toContain('ارز اقامت متفاوت');
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
    expect(
      renderToStaticMarkup(
        cols[3]!.render({ key: 'sales-entry-flight-only-0' }),
      ),
    ).toBe('<span>—</span>');
  });
});
