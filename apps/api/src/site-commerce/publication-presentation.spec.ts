import { expect, it } from 'vitest';
import { websitePresentation } from './publication-presentation';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const room = { double: '100', single: '150', extra: '70', childWithBed: '80' };
const preview = {
  title: '',
  description: '',
  commissionPercent: '0',
  previewOnly: true,
  previewHotelRate: {
    checkIn: '2030-01-04',
    checkOut: '2030-01-10',
    amountIrr: '100',
    breakdown: { hotel: room, adultFlightIrr: '50', childFlightIrr: '40' },
  },
};

it('preserves separate hotel prices and accepts existing shared preview prices', () => {
  expect(websitePresentation(preview)).toEqual(preview);
  const hotels = { [first]: room, [second]: { ...room, double: '200' } };
  expect(
    websitePresentation({
      ...preview,
      previewHotelRate: {
        ...preview.previewHotelRate,
        breakdown: { ...preview.previewHotelRate.breakdown, hotels },
      },
    }).previewHotelRate?.breakdown?.hotels,
  ).toEqual(hotels);
});

it('rejects an incomplete price for an individual hotel', () => {
  expect(() =>
    websitePresentation({
      ...preview,
      previewHotelRate: {
        ...preview.previewHotelRate,
        breakdown: {
          ...preview.previewHotelRate.breakdown,
          hotels: { [first]: { ...room, double: '' } },
        },
      },
    }),
  ).toThrow();
});
