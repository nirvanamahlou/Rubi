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
    { kind: 'HOTEL', label: 'هتل', titles: [] },
    { kind: 'FLIGHT', label: 'پرواز', titles: ['بلیط رفت', 'بلیط برگشت'] },
    {
      kind: 'TRANSFER',
      label: 'ترانسفر',
      titles: ['ترانسفر رفت', 'ترانسفر برگشت'],
    },
  ]);
});

it('keeps the same category order for differently ordered contract services', () => {
  const serviceItems = [
    { kind: 'OTHER', title: 'راهنما' },
    { kind: 'TRANSFER', title: 'ترانسفر رفت' },
    { kind: 'HOTEL', title: 'اقامت هتل' },
    { kind: 'FLIGHT', title: 'بلیط رفت' },
    { kind: 'VISA', title: 'ویزا' },
  ];
  const expected = ['HOTEL', 'FLIGHT', 'TRANSFER', 'VISA', 'OTHER'];
  for (let offset = 0; offset < serviceItems.length; offset++) {
    const items = [
      ...serviceItems.slice(offset),
      ...serviceItems.slice(0, offset),
    ];
    expect(
      reservationServiceGroups(row({ serviceItems: items })).map((g) => g.kind),
    ).toEqual(expected);
    expect(
      reservationServiceGroups(row({ serviceItems: items.reverse() })).map(
        (g) => g.kind,
      ),
    ).toEqual(expected);
  }
  expect(
    reservationServiceGroups(
      row({ services: ['FLIGHT', 'HOTEL', 'INSURANCE'] }),
    ).map((g) => g.kind),
  ).toEqual(['HOTEL', 'FLIGHT', 'INSURANCE']);
});

it('omits only the generic hotel caption and keeps specific hotel details', () => {
  expect(
    reservationServiceGroups(
      row({
        serviceItems: [
          { kind: 'HOTEL', title: ' اقامت هتل ' },
          { kind: 'HOTEL', title: 'هتل' },
          { kind: 'HOTEL', title: 'Custom hotel stay' },
          { kind: 'OTHER', title: 'اقامت هتل' },
        ],
      }),
    ),
  ).toEqual([
    { kind: 'HOTEL', label: 'هتل', titles: ['Custom hotel stay'] },
    { kind: 'OTHER', label: 'سایر خدمات', titles: ['اقامت هتل'] },
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
