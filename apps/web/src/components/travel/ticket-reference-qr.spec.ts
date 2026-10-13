import { describe, expect, it } from 'vitest';
import { ticketReferenceQr } from './ticket-reference-qr';
import { ticketQrGolden } from './ticket-qr-golden';
describe('printed booking reference QR', () => {
  it('matches independent ReportLab version 3-L byte-mode mask-0 encoding', () => {
    const svg = ticketReferenceQr('SC-2026-000003')!;
    const coords = new Set(
      [...svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(
        (match) => `${Number(match[1]) - 4},${Number(match[2]) - 4}`,
      ),
    );
    const rows = Array.from({ length: 29 }, (_, y) =>
      Array.from({ length: 29 }, (_, x) =>
        coords.has(`${x},${y}`) ? '1' : '0',
      ).join(''),
    );
    expect(rows).toEqual(ticketQrGolden);
  });
  it('does not turn a long, empty or missing reference into a fabricated code', () => {
    expect(ticketReferenceQr('')).toBeNull();
    expect(ticketReferenceQr('x'.repeat(54))).toBeNull();
    expect(ticketReferenceQr('SC-2026-000003')).not.toEqual(
      ticketReferenceQr('SC-2026-000004'),
    );
  });
});
