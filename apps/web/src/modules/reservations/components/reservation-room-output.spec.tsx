import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationFormSheet } from './reservation-form-sheet';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
it('prints the edited room composition and child ages from the saved supplier revision', () => {
  const intake = {
    id: 'synthetic',
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['p'],
      passengerAssignments: [],
      serviceSelections: [],
      hotelSelection: { hotelNameSnapshot: 'Hotel', roomCount: 1 },
    },
    workflow: { roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const settings = defaultVoucherSettings(intake, {});
  settings.hotelPurchasePrices = [
    { amount: '2500000', currencyCode: 'IRR' },
    { amount: '123.50', currencyCode: 'EUR' },
  ];
  settings.supplierFormPrices = {
    pp: { amount: '100.50', currencyCode: 'EUR' },
    ratio: { amount: '2', currencyCode: 'USD' },
    transferPp: { amount: '1000', currencyCode: 'JPY' },
  };
  settings.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'Family Suite',
      adults: 2,
      childAges: [4, 10],
    },
    {
      ordinal: 2,
      roomTypeNameSnapshot: 'Sea Double',
      adults: 2,
      childAges: [],
    },
  ];
  intake.workflow.supplierFormSettings = settings;
  const html = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} logo="/logo.png" />,
  );
  expect(html).toContain('Family Suite');
  expect(html).toContain('Sea Double');
  expect(html).toContain('<caption>ROOM QUANTITIES BY TYPE</caption>');
  expect(html).not.toContain('DBL · DOUBLE');
  const hotelTable = html.slice(
    html.indexOf('HOTEL INFORMATION'),
    html.indexOf('ROOM QUANTITIES BY TYPE'),
  );
  expect(hotelTable).not.toContain('ROOM TYPE');
  expect(html).toContain('4, 10');
  expect(html).toContain('ROOM TYPE');
  expect(html).not.toContain('undefined');
  expect(html).not.toContain('PROPOSED PURCHASE PRICE');
  expect(html).not.toContain('2,500,000');
  expect(html).toContain('100.50 EUR');
  expect(html).toContain('1,000 JPY');
  expect(html).toContain('Ratio');
  expect(html).toContain('Transfer P.P');
  expect(html.indexOf('PRICES')).toBeLessThan(html.indexOf('NOTICE'));
  expect(html).toMatch(/07<\/b><strong>NOTICE/);
  expect(html).not.toContain('HOTEL TOTAL');
  intake.workflow.voucherSettings = settings;
  const voucherHtml = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} logo="/logo.png" voucher />,
  );
  expect(voucherHtml).not.toContain('PROPOSED PURCHASE PRICE');
  expect(voucherHtml).not.toContain('2,500,000');
  expect(voucherHtml).not.toContain('123.50');
  expect(voucherHtml).not.toContain('100.50 EUR');
  expect(voucherHtml).not.toContain('Transfer P.P');
});
