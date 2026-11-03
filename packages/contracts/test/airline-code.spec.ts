import { describe, expect, it } from 'vitest';
import { normalizeAirlineCode } from '../src';

describe('airline identifiers', () => {
  it.each([
    [' w5 ', 'W5'],
    ['irm', 'IRM'],
    [' mahan   air ', 'MAHAN AIR'],
    ['speedbird', 'SPEEDBIRD'],
    ['AIR-TEST', 'AIR-TEST'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeAirlineCode(input)).toBe(expected);
  });
  it.each(['', 'A', 'A/B', 'A@B', 'A'.repeat(65), '-AIR', 'AIR-'])(
    'rejects invalid identifier %s',
    (input) => expect(normalizeAirlineCode(input)).toBeUndefined(),
  );
});
