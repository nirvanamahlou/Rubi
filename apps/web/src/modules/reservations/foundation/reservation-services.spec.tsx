import { expect, it } from 'vitest';
import { reservationServiceGroups } from './reservation-services';
import type { RequestView } from './model';

const row = (value: Partial<RequestView>) => value as RequestView;

it('groups round-trip services by actual kind and preserves every distinct title', () => {
  expect(
    reservationServiceGroups(
      row({
        serviceItems: [
          { kind: 'FLIGHT', title: 'بلیط رفت' },
          { kind: 'TRANSFER', title: 'ترانسفر رفت' },
          { kind: 'FLIGHT', title: 'بلیط برگشت' },
          { kind: 'HOTEL', title: 'اقامت هتل' },
          { kind: 'TRANSFER', title: 'ترانسفر برگشت' },
          { kind: 'FLIGHT', title: 'بلیط رفت' },
        ],
      }),
    ),
  ).toEqual([
    { kind: 'FLIGHT', label: 'هواپیما', titles: ['بلیط رفت', 'بلیط برگشت'] },
    {
      kind: 'TRANSFER',
      label: 'ترانسفر',
      titles: ['ترانسفر رفت', 'ترانسفر برگشت'],
    },
    { kind: 'HOTEL', label: 'هتل', titles: ['اقامت هتل'] },
  ]);
});

it('does not infer kinds from localized text or discard unknown services', () => {
  expect(
    reservationServiceGroups(
      row({
        serviceItems: [
          { kind: 'VISA', title: 'Hotel visa service' },
          { kind: 'FUTURE_KIND', title: 'Custom service' },
        ],
      }),
    ),
  ).toEqual([
    { kind: 'VISA', label: 'ویزا', titles: ['Hotel visa service'] },
    { kind: 'OTHER', label: 'سایر خدمات', titles: ['Custom service'] },
  ]);
});

it('retains legacy titles, supports kind-only views and empty services', () => {
  expect(
    reservationServiceGroups(
      row({ serviceTitles: ['Custom'], services: ['HOTEL'] }),
    )[0]?.titles,
  ).toEqual(['Custom']);
  expect(reservationServiceGroups(row({ services: ['HOTEL'] }))[0]?.label).toBe(
    'هتل',
  );
  expect(reservationServiceGroups(row({ services: [] }))).toEqual([]);
});
