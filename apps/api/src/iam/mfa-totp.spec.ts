import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { MfaTotpService } from './mfa-totp';

function service(values: Record<string, string>) {
  return new MfaTotpService(new ConfigService(values));
}

describe('MfaTotpService', () => {
  it('verifies the RFC 6238 SHA1 vector and rejects a wrong code', () => {
    const totp = service({
      NODE_ENV: 'test',
      IAM_ACCESS_TOKEN_SECRET:
        'test-access-secret-that-is-longer-than-thirty-two-characters',
    });
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(totp.verify(secret, '287082', 59_000)).toBe(1);
    expect(totp.verify(secret, '287083', 59_000)).toBeNull();
    expect(totp.verify(secret, 'letters', 59_000)).toBeNull();
  });

  it('encrypts a secret for one user and refuses another user context', () => {
    const totp = service({
      NODE_ENV: 'production',
      IAM_TOTP_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 5).toString('base64'),
    });
    const encrypted = totp.encrypt('user-a', 'BASE32SECRET');

    expect(encrypted).not.toContain('BASE32SECRET');
    expect(totp.decrypt('user-a', encrypted)).toBe('BASE32SECRET');
    expect(() => totp.decrypt('user-b', encrypted)).toThrow(
      ServiceUnavailableException,
    );
  });

  it('creates an Authenticator URI without exposing a password', () => {
    const totp = service({
      NODE_ENV: 'test',
      IAM_ACCESS_TOKEN_SECRET:
        'test-access-secret-that-is-longer-than-thirty-two-characters',
    });
    const uri = totp.otpAuthUri('pc-b-user', 'BASE32SECRET');

    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=BASE32SECRET');
    expect(uri).toContain('issuer=Rubi');
    expect(uri).not.toContain('password');
  });
});
