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
  settings.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'Family Suite',
      adults: 2,
      childAges: [4, 10],
    },
  ];
  intake.workflow.supplierFormSettings = settings;
  const html = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} logo="/logo.png" />,
  );
  expect(html).toContain('Family Suite');
  expect(html).toContain('4, 10');
  expect(html).toContain('ROOM TYPE');
  expect(html).not.toContain('undefined');
});
