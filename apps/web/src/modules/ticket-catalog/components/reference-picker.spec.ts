import { describe, expect, it } from 'vitest';
import { ticketReferenceDisplayName } from './reference-picker';

describe('Ticket reference labels', () => {
  it('shows the human name without the internal reference code', () => {
    expect(ticketReferenceDisplayName({ name: 'بار مجاز ۳۰ کیلوگرم' })).toBe(
      'بار مجاز ۳۰ کیلوگرم',
    );
  });
});
