import { expect, it, vi } from 'vitest';
vi.mock('./ticket-pdf', () => ({
  resolveTicketPdfRuntime: async () => ({ chromePath: null, fontPath: null }),
}));
import { prepareReservationHtml } from './reservation-pdf';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
it('keeps voucher export English even when the staff interface uses Persian', async () => {
  const { intake, refs } = voucherServiceFixture();
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
});
