import { describe, expect, it } from 'vitest';
import { issabelCallerName } from './caller-name';
describe('provider caller display name', () => {
  it('accepts trimmed Persian and Latin names', () => {
    expect(issabelCallerName('  شرکت نمونه  ')).toBe('شرکت نمونه');
    expect(issabelCallerName('Example Company')).toBe('Example Company');
  });
  it('ignores empty, anonymous, numeric, oversized and control-character names', () => {
    for (const value of [
      undefined,
      '',
      'unknown',
      '<unknown>',
      'Anonymous',
      '+12025550123',
      'x'.repeat(161),
      'name\nInjected',
      'name\u202e',
    ])
      expect(issabelCallerName(value)).toBeNull();
  });
});
