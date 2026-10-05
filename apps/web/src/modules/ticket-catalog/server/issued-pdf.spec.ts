import { describe, it, expect } from 'vitest';
import { issuedPrintHtml, renderIssuedPdf } from './issued-pdf';
describe('issued report PDF', () => {
  it('escapes passenger text, includes issuance and flight details and prints empty results', () => {
    const html = issuedPrintHtml(
      {
        data: [
          {
            passengerDisplayName: '<script>test</script>',
            ticketNumber: '001234',
            flightNumber: 'T-1',
            direction: 'RETURN',
            issuedAt: '2026-10-01T21:00:00Z',
          },
        ],
      },
      'font',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('001234');
    expect(html).toContain('T-1');
    expect(html).toContain('برگشت');
    expect(html).toContain('break-inside:avoid');
    expect(issuedPrintHtml({ data: [] }, 'font')).toContain(
      'بلیطی با این فیلترها یافت نشد',
    );
  });
});

it.runIf(process.env.ISSUED_PDF_RUNTIME_SMOKE === '1')(
  'renders a real PDF from server report data',
  async () => {
    const bytes = await renderIssuedPdf({
      data: [
        {
          passengerDisplayName: 'مسافر آزمایشی',
          ticketNumber: '001234',
          flightNumber: 'T-1',
          direction: 'OUTBOUND',
        },
      ],
    });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  },
  60000,
);
