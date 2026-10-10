import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FlightCabinCapacities } from './flight-cabin-capacities';
describe('flight cabin controls', () => {
  it('shows add/remove controls, the business capacity and the combined 25 seats', () => {
    const html = renderToStaticMarkup(
      createElement(FlightCabinCapacities, {
        primaryCapacity: 20,
        cabins: [{ flightClassId: 'business', totalCapacity: 5 }],
        references: [
          {
            id: 'business',
            kind: 'flightClass',
            name: 'Business',
            active: true,
          },
        ],
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('افزودن کلاس پروازی');
    expect(html).toContain('حذف کلاس');
    expect(html).toContain('Business');
    expect(html).toContain('value="5"');
    expect(html).toContain('ظرفیت کل پرواز:');
    expect(html).toContain('۲۵');
  });
  it('explains recurring round-trip class capacities and locks the form during saving', () => {
    const html = renderToStaticMarkup(
      createElement(FlightCabinCapacities, {
        primaryCapacity: 20,
        cabins: [],
        references: [],
        onChange: vi.fn(),
        roundTrip: true,
        disabled: true,
      }),
    );
    expect(html).toContain('برای رفت و برگشت');
    expect(html).toContain('<fieldset disabled');
  });
});
