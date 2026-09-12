import { describe, expect, it } from 'vitest';
import {
  personalDetailsError,
  profilePhotoError,
  PROFILE_PHOTO_MAX_BYTES,
} from './personal-details';

describe('personal details validation', () => {
  const valid = {
    displayName: 'کاربر آزمایشی',
    email: 'test@example.com',
    phone: '+98 912 123 4567',
  };
  it('accepts optional contact fields and Persian phone digits', () => {
    expect(personalDetailsError(valid)).toBeNull();
    expect(
      personalDetailsError({ ...valid, email: '', phone: '۰۹۱۲۱۲۳۴۵۶۷' }),
    ).toBeNull();
    expect(personalDetailsError({ ...valid, email: '', phone: '' })).toBeNull();
  });
  it('rejects missing or oversized names and malformed contact values', () => {
    for (const fields of [
      { displayName: ' ' },
      { displayName: 'x'.repeat(161) },
      { email: 'invalid@' },
      { phone: 'call me' },
      { phone: '1'.repeat(33) },
    ]) {
      expect(personalDetailsError({ ...valid, ...fields })).not.toBeNull();
    }
  });
});

describe('profile photo validation', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  it('accepts matching raster headers within size limit', () => {
    expect(profilePhotoError({ type: 'image/png', size: 200 }, png)).toBeNull();
    expect(
      profilePhotoError(
        { type: 'image/jpeg', size: 200 },
        new Uint8Array([255, 216, 255]),
      ),
    ).toBeNull();
    expect(
      profilePhotoError(
        { type: 'image/webp', size: 200 },
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
      ),
    ).toBeNull();
  });
  it('rejects disguised files, SVG, empty and oversized uploads', () => {
    expect(
      profilePhotoError({ type: 'image/jpeg', size: 200 }, png),
    ).not.toBeNull();
    expect(
      profilePhotoError({ type: 'image/svg+xml', size: 200 }, png),
    ).not.toBeNull();
    expect(
      profilePhotoError({ type: 'image/png', size: 200 }, new Uint8Array()),
    ).not.toBeNull();
    expect(
      profilePhotoError({ type: 'image/png', size: 0 }, png),
    ).not.toBeNull();
    expect(
      profilePhotoError(
        { type: 'image/png', size: PROFILE_PHOTO_MAX_BYTES + 1 },
        png,
      ),
    ).not.toBeNull();
  });
});
