import { describe, it, expect } from 'vitest';
import { ticketNumberDefaults } from './ticket-flight-number-editor';
describe('automatic flight number editor', () => {
  it('prefills each direction and retains only its saved manual override', () => {
    const flights = [
      { id: 'out', serviceNumber: '4512' },
      { id: 'back', serviceNumber: '7410' },
    ];
    expect(ticketNumberDefaults(flights, {})).toEqual({
      out: '4512',
      back: '7410',
    });
    expect(ticketNumberDefaults(flights, { back: '7411' })).toEqual({
      out: '4512',
      back: '7411',
    });
    expect(flights[1]!.serviceNumber).toBe('7410');
  });
});
