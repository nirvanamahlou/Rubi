import { expect, it } from 'vitest';
import {
  reservationHotelStays,
  type TravelWorkflowStateV1,
} from '@nora/contracts';
import { hotelFormScope } from './hotel-form-scope';
import { defaultSupplierFormSettings } from './voucher-settings';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import type { ReservationFormIntake } from './reservation-form';
it('prints independent supplier, room prices and stay nights for each hotel, with no cross-hotel leakage', () => {
  const intake = {
    receivedAt: '2026-10-31T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: [],
      passengerAssignments: [],
      serviceSelections: [
        { clientKey: 'h', kind: 'HOTEL', titleSnapshot: 'FIRST HOTEL' },
      ],
      hotelSelection: {
        serviceClientKey: 'h',
        hotelId: 'first',
        hotelNameSnapshot: 'FIRST HOTEL',
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-04',
        roomCount: 1,
        rooms: [
          {
            ordinal: 1,
            roomTypeNameSnapshot: 'DBL',
            adults: 2,
            childAges: [4],
          },
        ],
        additionalStays: [
          {
            hotelId: 'second',
            hotelNameSnapshot: 'SECOND HOTEL',
            checkInDate: '2026-11-04',
            checkOutDate: '2026-11-09',
            rooms: [
              {
                ordinal: 1,
                roomTypeNameSnapshot: 'FAMILY',
                adults: 2,
                childAges: [4],
              },
            ],
          },
        ],
      },
    },
    workflow: { version: 0, roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const stays = reservationHotelStays(intake.snapshot);
  const entries: NonNullable<TravelWorkflowStateV1['hotelSupplierForms']> = {};
  for (const [i, stay] of stays.entries()) {
    const settings = defaultSupplierFormSettings(
      hotelFormScope(intake, stay.key),
    );
    settings.brokerId = '11111111-1111-4111-8111-111111111111';
    settings.text.broker = i ? 'SECOND SUPPLIER' : 'FIRST SUPPLIER';
    settings.hotelRoomPrices = {
      currencyCode: 'EUR',
      rooms: [
        {
          roomOrdinal: 1,
          baseAmount: i ? '50' : '120',
          factor: i ? '1' : '2.5',
        },
      ],
    };
    settings.supplierFormPrices = {
      transferPp: { amount: '0', currencyCode: 'IRR' },
    };
    settings.hotelTransferCounts = { outbound: 0, returning: 0 };
    entries[stay.key] = { settings, status: 'NEW' };
  }
  intake.workflow.hotelSupplierForms = entries;
  const first = reservationPdfHtml(
    hotelFormScope(intake, stays[0]!.key),
    {},
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxUAAAAASUVORK5CYII=',
    '',
  );
  const second = reservationPdfHtml(
    hotelFormScope(intake, stays[1]!.key),
    {},
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVxUAAAAASUVORK5CYII=',
    '',
  );
  expect(first).toContain('FIRST SUPPLIER');
  expect(first).not.toContain('SECOND SUPPLIER');
  expect(first).not.toContain('SECOND HOTEL');
  expect(first).toContain('900 EUR');
  expect(second).toContain('SECOND SUPPLIER');
  expect(second).not.toContain('FIRST SUPPLIER');
  expect(second).not.toContain('FIRST HOTEL');
  expect(second).toContain('250 EUR');
  expect(second).toContain('OUTBOUND: 0 / RETURN: 0');
  expect(second).toContain('0 IRR');
  expect(second).toContain('07');
});
