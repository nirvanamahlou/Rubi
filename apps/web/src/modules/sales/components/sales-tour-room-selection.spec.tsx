import type * as React from 'react';
import type { TourDepartureV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SalesTourPicker } from './sales-tour-picker';
import { emptySalesForm } from '../model/sales-form';
const fixture = vi.hoisted(() => ({
  rows: [] as unknown[],
  index: 0,
  select: (id: string) => {
    void id;
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => [
    fixture.index++ === 0 ? fixture.rows : initial,
    vi.fn(),
  ],
}));
vi.mock('@/components/ui/search-combobox', () => ({
  SearchCombobox: (props: { onValueChange: (id: string) => void }) => {
    fixture.select = props.onValueChange;
    return <span />;
  },
}));
it('starts fresh per-room tour entry while retaining the package outbound and return offers', async () => {
  const outbound = {
    id: 'out',
    status: 'ACTIVE',
    departureAt: '2099-10-01T08:00:00Z',
    arrivalAt: '2099-10-01T12:00:00Z',
    serviceNumber: '100',
  };
  const returning = {
    ...outbound,
    id: 'back',
    departureAt: '2099-10-05T08:00:00Z',
    serviceNumber: '101',
  };
  fixture.rows = [
    {
      id: 'tour',
      startsOn: '2099-10-01',
      endsOn: '2099-10-05',
      remainingCapacity: 50,
      outbound,
      returning,
      package: {
        name: 'Synthetic tour',
        hotelIds: ['hotel'],
        originId: 'origin',
        destinationId: 'destination',
      },
    },
  ];
  fixture.index = 0;
  const onChange = vi.fn();
  renderToStaticMarkup(
    <SalesTourPicker
      state={{
        ...emptySalesForm,
        roomDrivenGuests: false,
        hotelChildAssignments: { '1': ['child:0'] },
        hotel: {
          ...emptySalesForm.hotel,
          hotelId: 'old',
          roomTypeId: 'old-type',
          roomCount: 2,
          doubleRoomCount: 2,
          rooms: [
            {
              ordinal: 1,
              roomTypeId: 'old-type',
              roomTypeNameSnapshot: 'Old Room',
              adults: 2,
              childAges: [4],
            },
          ],
        },
      }}
      countries={[]}
      cities={[]}
      hotels={[]}
      onChange={onChange}
    />,
  );
  fixture.select('tour');
  await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  const next = onChange.mock.calls[0]![0];
  expect(next.roomDrivenGuests).toBe(true);
  expect(next.hotelChildAssignments).toEqual({});
  expect(next.hotel).toMatchObject({
    rooms: [],
    roomTypeId: '',
    roomCount: 0,
    doubleRoomCount: 0,
  });
  expect(next.outboundOffer).toEqual(outbound);
  expect(next.returnOffer).toEqual(returning);
  expect(next.ticket).toMatchObject({
    outboundOfferId: 'out',
    returnOfferId: 'back',
  });
  expect(next.tour).toEqual(fixture.rows[0] as TourDepartureV1);
});
