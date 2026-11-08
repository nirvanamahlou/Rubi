import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationFormSheet } from './reservation-form-sheet';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
import { voucherServiceColumns } from '../model/voucher-passenger-services';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import { defaultVoucherSettings } from '../model/voucher-settings';

it('keeps forty passenger service rows consecutive without restarting hotel or tour sections', () => {
  const { intake, refs } = voucherServiceFixture();
  const template = intake.snapshot.passengerAssignments![0]!;
  const ids = Array.from({ length: 40 }, (_, i) => 'continuous-' + i);
  intake.snapshot.passengerIds = ids;
  intake.snapshot.passengerAssignments = ids.map((customerId, i) => ({
    ...template,
    customerId,
    displayNameSnapshot: `CONTINUOUS GUEST ${String(i + 1).padStart(3, '0')}`,
  }));
  intake.workflow.roomOrder = ids;
  intake.outputPassengers = [];
  delete intake.workflow.voucherSettings;
  intake.workflow.voucherSettings = defaultVoucherSettings(intake, refs);
  intake.workflow.voucherSettings.flags.withLetterhead = false;
  const before = structuredClone(intake);
  const preview = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} references={refs} logo="" voucher />,
  );
  const pdf = reservationPdfHtml(intake, refs, '', '', true);
  for (const html of [preview, pdf]) {
    expect(html.match(/HOTEL INFORMATION/g)).toHaveLength(1);
    expect(html.match(/TOUR SERVICES/g)).toHaveLength(1);
    expect(html.match(/PASSENGER SERVICES/g)).toHaveLength(1);
    expect(html).not.toContain('OTHER SERVICES');
    let position = html.indexOf('PASSENGER SERVICES');
    for (let i = 1; i <= 40; i++) {
      const next = html.indexOf(
        `CONTINUOUS GUEST ${String(i).padStart(3, '0')}`,
        position,
      );
      expect(next).toBeGreaterThan(position);
      position = next;
    }
    expect(html.indexOf('HOTEL INFORMATION')).toBeLessThan(
      html.indexOf('PASSENGER SERVICES'),
    );
  }
  expect(intake).toEqual(before);
});
it('keeps voucher preview service columns, passport names and English footer aligned with the PDF', () => {
  const { intake, refs } = voucherServiceFixture();
  intake.workflow.voucherSettings!.text.transferBoard = 'SAMPLE BOARD';
  const before = structuredClone(intake);
  const html = renderToStaticMarkup(
    <ReservationFormSheet intake={intake} references={refs} logo="" voucher />,
  );
  expect(html).toContain('PASSENGER SERVICES');
  for (const [label] of voucherServiceColumns) expect(html).toContain(label);
  expect(html).toContain('Jahan Bastan');
  expect(html).toContain('ADULT PASSPORT');
  expect(html).toContain('CHD (6-12)');
  expect(html).toContain('01 NOV 2026');
  expect(html).toContain('22 OCT 2026');
  expect(html).not.toContain('HIDDEN PASSENGER');
  expect(html).not.toContain('PROPOSED PURCHASE PRICE');
  expect(html).not.toContain('STAY DATES');
  expect(html).not.toContain('EXCURSION');
  expect(html).not.toContain('Board:');
  expect(html).toContain('>BOARD</th>');
  expect(html).toContain('SAMPLE BOARD');
  expect(html).toContain('<strong>22 OCT 2026</strong>');
  const hotel = html.slice(
    html.indexOf('HOTEL INFORMATION'),
    html.indexOf('TOUR SERVICES'),
  );
  expect(hotel).toContain('CHECK-IN');
  expect(hotel).toContain('01 NOV 2026');
  expect(html).not.toMatch(/[\u0600-\u06ff]/);
  expect(intake).toEqual(before);
});
