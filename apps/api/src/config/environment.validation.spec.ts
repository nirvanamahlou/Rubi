import { describe, expect, it } from 'vitest';

import { environmentValidationSchema } from './environment.validation';

const encryptionKey = Buffer.alloc(32, 1).toString('base64');
const fingerprintKey = Buffer.alloc(32, 2).toString('base64');

const validEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:5432/rubi',
  IAM_ACCESS_TOKEN_SECRET:
    'iam-secret-that-is-longer-than-thirty-two-characters',
  CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: encryptionKey,
  CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: fingerprintKey,
  CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 1,
  MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 3).toString('base64'),
};

describe('API environment validation', () => {
  it('requires independent 32-byte contact keys and a positive version', () => {
    expect(
      environmentValidationSchema.validate(validEnvironment).error,
    ).toBeUndefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment,
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: encryptionKey,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment,
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: 0,
      }).error,
    ).toBeDefined();
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment,
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: undefined,
      }).error,
    ).toBeDefined();
  });

  it('rejects reuse of the IAM access-token secret', () => {
    expect(
      environmentValidationSchema.validate({
        ...validEnvironment,
        IAM_ACCESS_TOKEN_SECRET: encryptionKey,
      }).error,
    ).toBeDefined();
  });
});
