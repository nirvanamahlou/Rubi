import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationFormSheet } from './reservation-form-sheet';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
import { voucherServiceColumns } from '../model/voucher-passenger-services';
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
