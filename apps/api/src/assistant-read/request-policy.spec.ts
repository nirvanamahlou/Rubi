import { describe, expect, it } from 'vitest';
import { allowsAssistantReadRequest } from './request-policy';
describe('Assistant read HTTP boundary', () => {
  it.each(['query', 'count-breakdown'])(
    'permits the authenticated read-only %s command only when enabled',
    (route) => {
      const path = '/api/v1/sales/assistant-agent/' + route;
      expect(allowsAssistantReadRequest('POST', path, true)).toBe(true);
      expect(allowsAssistantReadRequest('POST', path, false)).toBe(false);
      expect(allowsAssistantReadRequest('DELETE', path, true)).toBe(false);
    },
  );
  it.each([
    '/api/v1/sales/contracts',
    '/api/v1/sales/assistant-agent/count-breakdown/extra',
    '/api/v1/sales/assistant-agent/query/',
  ])('keeps mutation and unrecognized paths blocked: %s', (path) => {
    expect(allowsAssistantReadRequest('POST', path, true)).toBe(false);
    expect(allowsAssistantReadRequest('PATCH', path, true)).toBe(false);
  });
  it.each(['GET', 'HEAD'])(
    'retains ordinary authenticated %s reads',
    (method) => {
      expect(
        allowsAssistantReadRequest(
          method,
          '/api/v1/sales/assistant-agent/schema',
          false,
        ),
      ).toBe(true);
    },
  );
});
