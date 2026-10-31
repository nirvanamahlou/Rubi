import { describe, it, expect } from 'vitest';
import { validatePresence, presenceLayout } from './presence-model';
import type { SitePresenceV1 } from './api/client';
const sample: SitePresenceV1 = {
  schemaVersion: 1,
  state: 'ACTIVE',
  registrySystemId: 'site-a',
  environment: 'LOCAL',
  checkedAt: '2026-10-31T10:00:00Z',
  activeWindowSeconds: 75,
  heartbeatSeconds: 20,
  total: 1,
  nodes: [
    { id: 'home', title: 'خانه', kind: 'home', column: 0, row: 0, count: 1 },
    {
      id: 'cart',
      title: 'سبد خرید',
      kind: 'cart',
      column: 1,
      row: 0,
      count: 0,
    },
  ],
  edges: [{ from: 'home', to: 'cart' }],
};
describe('source-owned live site map', () => {
  it('accepts actual zero and preserves site-defined nodes', () => {
    expect(validatePresence(sample, 'site-a')).toBe(sample);
    expect(presenceLayout(sample.nodes)).toEqual({ width: 346, height: 104 });
    expect(
      validatePresence(
        {
          ...sample,
          total: 0,
          nodes: sample.nodes.map((n) => ({ ...n, count: 0 })),
        },
        'site-a',
      ).total,
    ).toBe(0);
  });
  it('rejects cross-site data, duplicate nodes, invented totals and invalid edges', () => {
    expect(() => validatePresence(sample, 'site-b')).toThrow();
    expect(() => validatePresence({ ...sample, total: 2 }, 'site-a')).toThrow();
    expect(() =>
      validatePresence(
        { ...sample, nodes: [sample.nodes[0]!, sample.nodes[0]!] },
        'site-a',
      ),
    ).toThrow();
    expect(() =>
      validatePresence(
        { ...sample, edges: [{ from: 'home', to: 'unknown' }] },
        'site-a',
      ),
    ).toThrow();
  });
  it('distinguishes disabled monitoring from zero actual presence', () => {
    expect(
      validatePresence(
        {
          ...sample,
          state: 'NOT_CONFIGURED',
          total: null,
          nodes: sample.nodes.map((n) => ({ ...n, count: null })),
        },
        'site-a',
      ).state,
    ).toBe('NOT_CONFIGURED');
  });
});
