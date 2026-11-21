import { describe, expect, it } from 'vitest';
import {
  financeCodingProfiles,
  financeCodingProfileForValue,
  financeCodingProfile,
} from '../src/finance-coding';

describe('finance coding rules', () => {
  it.each(financeCodingProfiles)(
    'validates the eight digits and reserved serial for $title',
    (profile) => {
      expect(financeCodingProfile(profile.typeCode)).toBe(profile);
      expect(financeCodingProfileForValue(profile.firstCode)).toBe(profile);
      expect(financeCodingProfileForValue(profile.prefix + '9999999')).toBe(
        profile,
      );
      for (const bad of [
        profile.prefix + '0000000',
        profile.prefix + '1',
        profile.firstCode + '0',
        '9' + profile.firstCode.slice(1),
        ' ' + profile.firstCode,
      ])
        expect(financeCodingProfileForValue(bad)).toBeUndefined();
    },
  );
});
