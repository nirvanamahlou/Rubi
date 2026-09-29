import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  assertSafeJson,
  maskIp,
  scopeKey,
  validateSetting,
} from './system-management.validation';

describe('system management validation', () => {
  it('rejects secrets at any nesting level', () => {
    expect(() =>
      assertSafeJson({ provider: { apiToken: 'must-not-be-stored-here' } }),
    ).toThrow(BadRequestException);
  });

  it('enforces typed values and explicit change reasons', () => {
    expect(() =>
      validateSetting({
        namespace: 'security',
        key: 'mfa.required',
        valueType: 'BOOLEAN',
        value: 'true',
        scope: 'GLOBAL',
        reason: 'enable policy',
      }),
    ).toThrow(BadRequestException);
  });

  it('requires an id for non-global scopes and masks network addresses', () => {
    expect(() => scopeKey('BRANCH')).toThrow(BadRequestException);
    expect(maskIp('192.168.10.44')).toBe('192.168.*.*');
    expect(maskIp('2001:db8:abcd:0012::1')).toBe('2001:db8:abcd:*');
  });
});
