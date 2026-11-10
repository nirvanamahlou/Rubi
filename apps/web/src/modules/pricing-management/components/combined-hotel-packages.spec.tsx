import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { packageRoomCode, type PackageTourCostGridV1 } from '@nora/contracts';
import { CombinedHotelPackages } from './combined-hotel-packages';
import { TourDestinations } from '@/modules/ticket-catalog/components/tour-destinations';
import type { MasterDataRecord } from '@nora/contracts';

const cities = ['آنتالیا', 'ازمیر', 'استانبول'].map((name, i) => ({
  id: `city-${i}`,
  name,
  attributes: { countryId: 'country' },
})) as unknown as MasterDataRecord[];
const countries = [
  { id: 'country', name: 'ترکیه', attributes: {} },
] as unknown as MasterDataRecord[];
const grid = {
  version: 1,
  nights: 6,
  tour: {
    startsOn: '2026-11-01',
    endsOn: '2026-11-07',
    branchId: 'branch',
    package: {
      name: 'تور ترکیبی',
      destinationId: 'city-0',
      details: {
        version: 1,
        isCombined: true,
        destinations: cities.map((c) => ({ cityId: c.id, nights: 2 })),
      },
    },
  },
  destinationStays: cities.map((c) => ({ name: c.name })),
  purchaseBatches: cities.map((c, i) => ({
    id: `batch-${i}`,
    cityId: c.id,
    branchId: 'branch',
    method: 'STAY',
    checkIn: '2026-11-01',
    checkOut: '2026-12-01',
    currencyCode: 'EUR',
    rows: [
      {
        id: `rate-${i}`,
        hotelId: `hotel-${i}`,
        hotelName: ['Royal Antalya', 'Grand Izmir', 'Istanbul Palace'][i],
        brokerName: 'Travel Partner',
        basePerNight: '0',
        factors: {},
        roomRates: [
          {
            roomTypeId: `room-${i}`,
            roomTypeName: 'Standard Room',
            factor: '1',
            maxAdults: 2,
            maxChildren: 0,
            occupancyRates: [
              {
                adults: 2,
                childAges: [],
                startsOn: '2026-11-01',
                endsOnExclusive: '2026-12-01',
                amount: '100',
                currencyCode: 'EUR',
                board: 'BB',
              },
            ],
          },
        ],
      },
    ],
  })),
} as unknown as PackageTourCostGridV1;
const value = [
  {
    id: 'combo',
    rooms: cities.map((_, i) => ({
      rateId: `rate-${i}`,
      roomCode: packageRoomCode({
        roomTypeId: `room-${i}`,
        adults: 2,
        childAges: [],
        board: 'BB',
      }),
    })),
    sales: [{ currencyCode: 'EUR', amount: '750.00' }],
  },
];
it('renders one complete three-city package with independent stay dates and one shared sale', async () => {
  const html = renderToStaticMarkup(
    <>
      <TourDestinations
        value={grid.tour.package}
        countries={countries}
        cities={cities}
        onChange={() => undefined}
      />
      <CombinedHotelPackages
        grid={grid}
        value={value}
        onChange={() => undefined}
      />
    </>,
  );
  for (const title of [
    'Royal Antalya',
    'Grand Izmir',
    'Istanbul Palace',
    '2026-11-03',
    '2026-11-05',
    '2026-11-07',
    '600.00',
    '750.00',
    'افزودن ترکیب هتل',
  ])
    expect(html).toContain(title);
  expect(html.match(/فروش مشترک/g)).toHaveLength(1);
  if (process.env.COMBINED_UI_PREVIEW) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      process.env.COMBINED_UI_PREVIEW,
      `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="combined-preview.css"><body class="bg-background p-6 font-sans text-foreground"><main class="mx-auto grid max-w-7xl gap-6">${html}</main></body></html>`,
    );
  }
});
