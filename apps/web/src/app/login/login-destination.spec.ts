import { describe, expect, it } from 'vitest';
import { loginDestination } from './login-destination';

describe('login destination', () => {
  it.each([null, '', 'https://example.com', '//example.com', '/\\example.com'])(
    'opens Workbench for an absent or unsafe destination %s',
    (next) => {
      expect(loginDestination(next)).toBe('/workbench');
    },
  );
  it.each(['/finance?section=delivery', '/dashboard', '/workbench', '/'])(
    'preserves the requested internal route %s',
    (next) => {
      expect(loginDestination(next)).toBe(next);
    },
  );
});
