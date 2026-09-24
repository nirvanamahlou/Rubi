import { describe, expect, it } from 'vitest';
import { ticketBarcode } from './ticket-barcode';

describe('ticketBarcode', () => {
  it('encodes the normalized contract number as Code 39 bars', () => {
    const barcode = ticketBarcode(' sc-2026-000003 ');
    expect(barcode?.value).toBe('SC-2026-000003');
    expect(barcode?.bars.length).toBeGreaterThan(30);
    expect(barcode?.width).toBeGreaterThan(0);
  });

  it('does not render unsupported or empty values', () => {
    expect(ticketBarcode('')).toBeNull();
    expect(ticketBarcode('قرارداد')).toBeNull();
  });
});
