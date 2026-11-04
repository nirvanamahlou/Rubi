import { describe, it, expect } from 'vitest';
import {
  validatePresence,
  presenceLayout,
  presenceNeighbours,
} from './presence-model';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SiteNavigationMap } from './components/site-navigation-map';
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
  const navigation: SitePresenceV1 = {
    ...sample,
    mapKind: 'SITE_NAVIGATION',
    groups: [{ id: 'explore', title: 'انتخاب سفر' }],
    total: 3,
    nodes: [
      { ...sample.nodes[0]!, group: 'home' },
      ...['trains', 'buses', 'destinations', 'visas'].map((id, row) => ({
        id,
        title: {
          trains: 'قطار',
          buses: 'اتوبوس',
          destinations: 'مقصدها',
          visas: 'ویزا',
        }[id]!,
        kind:
          id === 'trains' ? 'train' : id === 'buses' ? 'bus' : 'destination',
        group: 'explore',
        column: 1,
        row,
        count: row < 2 ? 1 : 0,
      })),
    ],
    edges: ['trains', 'buses', 'destinations', 'visas'].map((to) => ({
      from: 'home',
      to,
      kind: 'navigation',
    })),
  };
  it('keeps separate service cards and exposes only source-owned Home connections', () => {
    expect(validatePresence(navigation, 'site-a')).toBe(navigation);
    expect(
      presenceNeighbours(navigation, 'home').outgoing.map((n) => n.id),
    ).toEqual(['trains', 'buses', 'destinations', 'visas']);
    expect(
      presenceNeighbours(navigation, 'trains').incoming.map((n) => n.id),
    ).toEqual(['home']);
    const html = renderToStaticMarkup(
      createElement(SiteNavigationMap, { data: navigation }),
    );
    for (const label of [
      'انتخاب سفر',
      'قطار',
      'اتوبوس',
      'مقصدها',
      'ویزا',
      'از خانه',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('قطار و اتوبوس');
  });
  it('rejects grouped maps with missing roots, foreign groups or untyped connections', () => {
    expect(() =>
      validatePresence(
        { ...navigation, groups: [{ id: 'missing', title: 'Other' }] },
        'site-a',
      ),
    ).toThrow();
    expect(() =>
      validatePresence(
        {
          ...navigation,
          nodes: navigation.nodes.filter((n) => n.id !== 'home'),
        },
        'site-a',
      ),
    ).toThrow();
    expect(() =>
      validatePresence(
        { ...navigation, edges: [{ from: 'home', to: 'trains' }] },
        'site-a',
      ),
    ).toThrow();
  });
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
