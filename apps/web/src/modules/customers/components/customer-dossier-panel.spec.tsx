import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactModule from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CustomerDossierResponse } from '@nora/contracts';
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({
    context: { selection: 'company', version: 1 },
    loading: false,
    switching: false,
  }),
}));
const fixture = vi.hoisted(() => ({
  result: null as CustomerDossierResponse | null,
  calls: 0,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const n = fixture.calls++;
    return [n % 3 === 0 ? fixture.result : initial, vi.fn()];
  },
  useEffect: vi.fn(),
}));
vi.mock('../api/client', () => ({ customersApi: { dossier: vi.fn() } }));
import { CustomerDossierPanel } from './customer-dossier-panel';
beforeEach(() => {
  fixture.calls = 0;
  fixture.result = null;
});
describe('customer dossier records', () => {
  it('does not render previous customer records while another customer is loading', () => {
    fixture.result = {
      data: {
        customerId: 'old',
        sections: [
          {
            id: 'contracts',
            state: 'ready',
            hasMore: false,
            rows: [
              {
                id: 'record',
                reference: 'PRIVATE-OLD',
                status: 'DRAFT',
                occurredAt: '2026-11-09T00:00:00Z',
              },
            ],
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      <CustomerDossierPanel customerId="new" />,
    );
    expect(html).not.toContain('PRIVATE-OLD');
    expect(html).toContain('در حال دریافت سوابق');
  });
  it('renders all nine real sources and separates forbidden, unavailable and empty', () => {
    const ids = [
      'requests',
      'contracts',
      'services',
      'tickets',
      'vouchers',
      'insurance',
      'payments',
      'checks',
      'support',
    ] as const;
    fixture.result = {
      data: {
        customerId: 'customer',
        sections: ids.map((id, i) => ({
          id,
          state: i === 0 ? 'forbidden' : i === 1 ? 'unavailable' : 'ready',
          hasMore: false,
          rows:
            i === 2
              ? [
                  {
                    id: 'record',
                    reference: '<script>private</script>',
                    status: 'SELECTED',
                    occurredAt: '2026-11-09T00:00:00Z',
                  },
                ]
              : [],
        })),
      },
    };
    const html = renderToStaticMarkup(
      <CustomerDossierPanel customerId="customer" />,
    );
    expect(html.match(/<h4/g)).toHaveLength(9);
    expect(html).toContain('مجوز مشاهده این بخش را ندارید.');
    expect(html).toContain('این بخش موقتاً در دسترس نیست.');
    expect(html).toContain('سابقه‌ای ثبت نشده است.');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
