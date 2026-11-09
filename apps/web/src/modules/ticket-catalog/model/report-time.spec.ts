import { expect, it } from 'vitest';
import { reportGregorianTime } from './report-time';
import { issuedPrintHtml } from '../server/issued-pdf';

it('shows Gregorian defined times in cards and either-language PDFs, never UTC instants', () => {
  expect(reportGregorianTime('2026-11-08T21:00:00Z')).toBe('2026-11-09 00:30');
  expect(reportGregorianTime('2026-11-09')).toBe('2026-11-09');
  expect(reportGregorianTime('invalid')).toBe('');
  for (const language of ['fa', 'en'] as const) {
    const html = issuedPrintHtml(
      {
        data: [
          {
            departureAt: '2026-11-08T21:00:00Z',
            arrivalAt: '2026-11-09T00:00:00Z',
            checkInDate: '2026-11-09',
            checkOutDate: '2026-11-12',
          },
        ],
      },
      'font',
      language,
    );
    expect(html).toContain('2026-11-09 00:30');
    expect(html).toContain('2026-11-09 03:30');
    expect(html).toContain('2026-11-12');
    expect(html).not.toContain('21:00:00Z');
  }
});
