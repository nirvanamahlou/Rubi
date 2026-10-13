import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HotelRoomCapacity } from './hotel-room-capacity';
import { salesHotelRoomOptions } from '../model/sales-hotel-room-options';

describe('Sales hotel rate rooms', () => {
  it('keeps rated rooms even with no master-data room or matching guest quote', () => {
    const rates = [
      { roomTypeId: 'suite', roomTypeName: 'Rate Suite', occupancyRates: [] },
    ];
    expect(salesHotelRoomOptions('hotel', [], [], rates as never)).toEqual([
      { id: 'suite', name: 'Rate Suite', code: 'suite' },
    ]);
    expect(salesHotelRoomOptions('', [], [], rates as never)).toEqual([]);
  });
  it('shows real maximum room capacity with each child age interval', () => {
    const html = renderToStaticMarkup(
      <HotelRoomCapacity
        room={
          {
            roomTypeId: 'suite',
            roomTypeName: 'Suite',
            capacityCombinations: [
              { adults: 4, childAges: [] },
              {
                adults: 3,
                childAges: [
                  { min: 2, maxExclusive: 6 },
                  { min: 6, maxExclusive: 12 },
                ],
              },
            ],
          } as never
        }
      />,
    );
    expect(html).toContain('Suite');
    expect(html).toContain('<bdi>5</bdi>');
    expect(html).toContain('<bdi>3</bdi>');
    expect(html).toContain('تا کمتر از');
    expect(html).toContain('<bdi>12</bdi>');
    expect(html).not.toContain('<bdi>4</bdi>');
  });
});
