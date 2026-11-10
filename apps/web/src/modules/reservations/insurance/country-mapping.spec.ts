import { describe, expect, it } from 'vitest';
import {
  insuranceCountryFields,
  matchInsuranceCountry,
} from './country-mapping';
const georgia = { id: 29, title: 'گرجستان', standardCode: 'GE' };
const master = {
  id: 'country',
  code: 'GE',
  name: 'گرجستان',
  attributes: { englishName: 'GEORGIA' },
};
describe('insurance country selection', () => {
  it('uses the provider ID and title and canonical English name rather than typed values', () => {
    expect(insuranceCountryFields(georgia, master)).toEqual({
      providerCountryCode: '29',
      providerCountryName: 'گرجستان',
      englishName: 'GEORGIA',
    });
  });
  it('matches exact ISO codes only and refuses ambiguous or fuzzy guesses', () => {
    expect(matchInsuranceCountry(master, [georgia])?.id).toBe(29);
    expect(
      matchInsuranceCountry({ ...master, code: 'XX' }, [georgia]),
    ).toBeUndefined();
    expect(
      matchInsuranceCountry(master, [georgia, { ...georgia, id: 30 }]),
    ).toBeUndefined();
  });
  it('does not copy a different country English name and derives known ISO names safely', () => {
    expect(
      insuranceCountryFields(georgia, {
        ...master,
        code: 'TR',
        englishName: 'TURKEY',
      }).englishName,
    ).toBe('Georgia');
    expect(
      insuranceCountryFields({ ...georgia, standardCode: '' }).englishName,
    ).toBe('');
  });
});
