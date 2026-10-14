import { describe, expect, it } from 'vitest';
import { currencySymbol } from './currency-symbol';
import { translateUiText } from '@/i18n/translate';
describe('currency presentation', () => {
  it('distinguishes currencies with similar symbols and preserves unknown codes', () => {
    expect(
      ['IRR', 'USD', 'EUR', 'GBP', 'TRY', 'CAD', 'AUD'].map(currencySymbol),
    ).toEqual(['﷼', '$', '€', '£', '₺', 'CA$', 'A$']);
    expect(currencySymbol('ZZZ')).toBe('ZZZ');
    expect(translateUiText(currencySymbol('AED'), 'en')).toBe(
      currencySymbol('AED'),
    );
    expect(translateUiText(currencySymbol('IRR'), 'fa')).toBe('﷼');
  });
});
