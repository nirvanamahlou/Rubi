import { describe, expect, it } from 'vitest';
import { ticketPurchaseTotal } from './ticket-purchase-total';
describe('ticket purchase total', () => {
  it('multiplies seats and preserves fractional currency exactly', () => {
    expect(ticketPurchaseTotal('3', '0.1')).toBe('0.3');
    expect(ticketPurchaseTotal('20', '1250000')).toBe('25000000');
    expect(ticketPurchaseTotal('3', '123.4567')).toBe('370.3701');
    expect(ticketPurchaseTotal('2', '9007199254740993')).toBe(
      '18014398509481986',
    );
  });
  it('rejects invalid seats and unsupported money precision', () => {
    for (const seats of ['0', '-1', '1.5', '', '9007199254740992'])
      expect(ticketPurchaseTotal(seats, '1')).toBeNull();
    for (const unit of ['0', '-1', '', '1.00001', '1e4'])
      expect(ticketPurchaseTotal('2', unit)).toBeNull();
  });
});
