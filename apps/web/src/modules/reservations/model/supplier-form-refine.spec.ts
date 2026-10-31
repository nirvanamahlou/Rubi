import { expect, it } from 'vitest';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import { defaultVoucherSettings, supplierFormData } from './voucher-settings';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
it('keeps different stays bold in supplier PDF and puts shared dates within hotel section', () => {
  const { intake, refs } = voucherServiceFixture();
  intake.workflow.supplierFormSettings = defaultVoucherSettings(intake, refs);
  const data = supplierFormData(intake, refs);
  expect(data.passengers.find((p) => p.id === 'child')?.differentStay).toBe(
    true,
  );
  const html = reservationPdfHtml(
    intake,
    refs,
    'data:image/png;base64,AA==',
    '',
  );
  expect(html).not.toContain('STAY DATES');
  expect(html).toContain('class="differentStay"');
  const hotel = html.slice(
    html.indexOf('HOTEL INFORMATION'),
    html.indexOf('TOUR SERVICES'),
  );
  expect(hotel).toContain('CHECK-IN');
  expect(hotel).toContain('CHECK-OUT');
});
