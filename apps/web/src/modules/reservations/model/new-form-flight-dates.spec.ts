import { afterEach, expect, it } from 'vitest';
import {
  defaultSupplierFormSettings,
  defaultVoucherSettings,
  supplierFormData,
  voucherFormData,
} from './voucher-settings';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import type { ReservationFormIntake } from './reservation-form';
import { parseIsoDate, toIsoDate } from '@/components/ui/date-picker.utils';

const previousTimezone = process.env.TZ;
afterEach(() => {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
});

it.each(['UTC', 'Asia/Tehran', 'America/Los_Angeles', 'Pacific/Auckland'])(
  'keeps new forms, saved dates and both PDF outputs on the flight day in %s',
  (timezone) => {
    process.env.TZ = timezone;
    const intake = {
      receivedAt: '2026-11-01T00:00:00Z',
      snapshot: {
        contractNumber: 'SYNTHETIC-DATE-GUARD',
        passengerIds: [],
        passengerAssignments: [],
        serviceSelections: [{ kind: 'TRANSFER', clientKey: 'transfer' }],
        ticketSelections: [
          {
            direction: 'OUTBOUND',
            originId: 'origin',
            destinationId: 'destination',
            departureAt: '2026-11-08T20:45:00Z',
            arrivalAt: '2026-11-09T01:00:00Z',
            carrierNameSnapshot: 'Test Air',
            serviceNumberSnapshot: 'OUT-1',
            cabinClassCode: 'ECONOMY',
          },
          {
            direction: 'RETURN',
            originId: 'destination',
            destinationId: 'origin',
            departureAt: '2026-11-12T20:15:00Z',
            arrivalAt: '2026-11-13T01:00:00Z',
            carrierNameSnapshot: 'Test Air',
            serviceNumberSnapshot: 'BACK-1',
            cabinClassCode: 'ECONOMY',
          },
        ],
      },
      workflow: { roomOrder: [], ageOverrides: {}, note: '' },
    } as unknown as ReservationFormIntake;
    for (const defaults of [
      defaultSupplierFormSettings,
      defaultVoucherSettings,
    ]) {
      const settings = defaults(intake, {});
      // 00:15 Tehran crosses the UTC day; 23:45 Tehran does not.
      expect(settings.text.arrivalDate).toBe('2026-11-09');
      expect(settings.text.departureDate).toBe('2026-11-12');
      for (const value of [
        settings.text.arrivalDate,
        settings.text.departureDate,
      ]) {
        expect(toIsoDate(parseIsoDate(value)!)).toBe(value);
      }
      // The settings request sends these calendar strings as JSON, not instants.
      const saved = JSON.parse(JSON.stringify(settings));
      const reopened = {
        ...intake,
        workflow: {
          ...intake.workflow,
          supplierFormSettings: saved,
          voucherSettings: saved,
        },
      };
      for (const [index, output] of [
        supplierFormData(reopened),
        voucherFormData(reopened, {}),
      ].entries()) {
        expect(output.flights.map((flight) => flight.date)).toEqual([
          '09 NOV 2026',
          '12 NOV 2026',
        ]);
        const html = reservationPdfHtml(
          reopened,
          {},
          'data:image/png;base64,AAAA',
          '',
          index === 1,
        );
        expect(html).toContain('09 NOV 2026');
        expect(html).toContain('12 NOV 2026');
        expect(html).not.toContain('08 NOV 2026');
        expect(html).not.toContain('11 NOV 2026');
      }
      expect(defaultSupplierFormSettings(reopened).text.arrivalDate).toBe(
        '2026-11-09',
      );
      expect(defaultVoucherSettings(reopened, {}).text.arrivalDate).toBe(
        '2026-11-09',
      );
    }
  },
);
