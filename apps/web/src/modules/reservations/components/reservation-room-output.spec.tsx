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
  expect(html).toContain('2,500,000 IRR · 123.50 EUR');
  expect(html.indexOf('PROPOSED PURCHASE PRICE')).toBeGreaterThan(
    html.indexOf('SUPPLIER'),
  );
  expect(html.indexOf('PROPOSED PURCHASE PRICE')).toBeLessThan(
    html.indexOf('DATE OF ISSUE'),
  );
  expect(html).not.toContain('HOTEL TOTAL');
  intake.workflow.voucherSettings = settings;
  const voucherHtml = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} logo="/logo.png" voucher />,
  );
  expect(voucherHtml).not.toContain('PROPOSED PURCHASE PRICE');
  expect(voucherHtml).not.toContain('2,500,000');
  expect(voucherHtml).not.toContain('123.50');
});
