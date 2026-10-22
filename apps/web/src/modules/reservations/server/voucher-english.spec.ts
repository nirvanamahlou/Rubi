import { expect, it, vi } from 'vitest';
vi.mock('./ticket-pdf', () => ({
  resolveTicketPdfRuntime: async () => ({ chromePath: null, fontPath: null }),
}));
import { prepareReservationHtml } from './reservation-pdf';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
it('keeps voucher export English even when the staff interface uses Persian', async () => {
  const { intake, refs } = voucherServiceFixture();
  intake.workflow.voucherSettings!.text.transferBoard = 'SAMPLE BOARD';
  const html = await prepareReservationHtml(
    intake,
    refs,
    '',
    '',
    true,
    '',
    'fa',
    'https://example.test/d/' + 'a'.repeat(32),
  );
  expect(html).toContain('lang="en"');
  expect(html).toContain('PASSENGER SERVICES');
  expect(html).toContain('Jahan Bastan');
  expect(html).not.toMatch(/[\u0600-\u06ff]/);
  expect(html).not.toContain('PROPOSED PURCHASE PRICE');
  expect(html).not.toContain('STAY DATES');
  expect(html).not.toContain('EXCURSION');
  expect(html).not.toContain('Board:');
  expect(html).toContain('<th>BOARD</th>');
  expect(html).toContain('SAMPLE BOARD');
  expect(html).toMatch(/class="differentStay"[^>]*>22 OCT 2026/);
  const hotel = html.slice(
    html.indexOf('HOTEL INFORMATION'),
    html.indexOf('ROOM QUANTITIES BY TYPE') > 0
      ? html.indexOf('ROOM QUANTITIES BY TYPE')
      : html.indexOf('TOUR SERVICES'),
  );
  expect(hotel).toContain('<th>CHECK-IN</th>');
  expect(hotel).toContain('01 NOV 2026');
});
