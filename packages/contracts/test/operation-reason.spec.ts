import { expect, it } from 'vitest';
import { isOptionalOperationReason } from '../src/operation-reason';
it('accepts omitted, blank and short human reasons while bounding supplied text', () => {
  for (const v of [undefined, null, '', '   ', 'x', 'Human reason'])
    expect(isOptionalOperationReason(v, 20)).toBe(true);
  for (const v of [false, 1, {}, [], 'x'.repeat(21)])
    expect(isOptionalOperationReason(v, 20)).toBe(false);
});
