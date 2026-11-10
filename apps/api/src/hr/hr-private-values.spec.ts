import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  protectHrValues,
  revealHrValues,
  publicHrData,
  privateCommandFingerprint,
} from './hr-private-values';

afterEach(() => vi.unstubAllEnvs());
describe('HR encryption key rotation', () => {
  it('reads old and new records and preserves command replay after active-key rotation', () => {
    const oldKey = Buffer.alloc(32, 1).toString('base64');
    const newKey = Buffer.alloc(32, 2).toString('base64');
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEY_ID', undefined);
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEYS_JSON', undefined);
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEY_BASE64', oldKey);
    const old = protectHrValues(['synthetic value'], 'employee:one');
    const fingerprint = privateCommandFingerprint({ synthetic: 1 }, 'actor');
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEY_ID', '2026-v2');
    vi.stubEnv(
      'HR_PRIVATE_ENCRYPTION_KEYS_JSON',
      JSON.stringify({ legacy: oldKey, '2026-v2': newKey }),
    );
    const current = protectHrValues(['new synthetic value'], 'employee:one');
    expect(current.privateKeyId).toBe('2026-v2');
    expect(revealHrValues(old, 'employee:one')).toEqual(['synthetic value']);
    expect(revealHrValues(current, 'employee:one')).toEqual([
      'new synthetic value',
    ]);
    expect(privateCommandFingerprint({ synthetic: 1 }, 'actor')).toBe(
      fingerprint,
    );
    expect(publicHrData(current)).toEqual({});
    expect(() => revealHrValues(current, 'employee:other')).toThrow();
    expect(() =>
      revealHrValues({ ...current, privateKeyId: 'unknown' }, 'employee:one'),
    ).toThrow();
  });
  it('fails closed for a malformed ring without logging its content', () => {
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEYS_JSON', 'secret-invalid-json');
    expect(() => protectHrValues([], 'record')).toThrow(
      'HR encryption key ring is invalid.',
    );
  });
});
