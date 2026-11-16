import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactModule from 'react';
import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteManagement } from './components/site-management';
const h = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useState: (value: unknown) => {
    const i = h.index++;
    if (!(i in h.states))
      h.states[i] = typeof value === 'function' ? value() : value;
    return [h.states[i], vi.fn()];
  },
}));
it('renders collapsible tours with city/date filters and separate site controls beside each period', () => {
  h.states = [
    'tours',
    [{ id: 'b', name: 'Branch' }],
    'b',
    [],
    '',
    [],
    [
      {
        id: 'float',
        name: 'Floating Antalya',
        branchId: 'b',
        destinationId: 'city',
        destinationIds: ['city'],
        canPublish: true,
        periods: ['2026-08-01', '2026-08-08'].map((date) => ({
          key: `dated:${date}:7`,
          startsOn: date,
          endsOn: '2026-08-15',
          nights: 7,
          monthly: null,
        })),
      },
    ],
    [],
    '',
    false,
    0,
    '',
    { city: 'Antalya' },
    '',
    '',
    '',
    '',
    '',
  ];
  h.index = 0;
  const html = renderToStaticMarkup(
    <SiteManagement
      actor={
        {
          branchIds: ['b'],
          permissions: ['ticket_catalog.manage'],
        } as AuthenticatedActor
      }
    />,
  );
  expect(html).toContain('<summary');
  expect(html).toContain('Floating Antalya');
  expect(html).toContain('2026-08-01 — 2026-08-15');
  expect(html).toContain('2026-08-08 — 2026-08-15');
  expect(html).toContain('aria-label="شهر مقصد تور"');
  expect(html).toContain('aria-label="تور از تاریخ"');
  expect(html).toContain('aria-label="تور تا تاریخ"');
  expect(html.match(/type="checkbox"/g)).toHaveLength(8);
});
