import type { ReservationIntakeV1 } from '@nora/contracts';
import { purchaseFilters } from './model';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { ReservationPurchaseWorkspace } from './workspace';
const state = vi.hoisted(() => ({
  index: 0,
  records: undefined as unknown,
  query: '',
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/ticket-purchases',
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    return [
      index === 3
        ? {
            key: JSON.stringify([
              'ALL',
              1,
              '',
              0,
              JSON.stringify(purchaseFilters(new URLSearchParams(state.query))),
            ]),
            response: state.records,
          }
        : typeof initial === 'function'
          ? initial()
          : initial,
      vi.fn(),
    ];
  },
}));
beforeEach(() => {
  state.index = 0;
  state.query = '';
  state.records = {
    meta: {
      page: 1,
      pageSize: 25,
      hasMore: false,
      canRecord: true,
      summary: {
        total: 99,
        registered: 64,
        unregistered: 33,
        unknown: 2,
        contracts: 40,
      },
      services: [
        {
          id: 'intake',
          clientKey: 'hotel',
          status: 'REGISTERED',
          entryAt: '2026-10-07T12:00:00Z',
          purchasedAt: '2026-10-09',
          checkInAt: '2026-10-15',
          departureAt: null,
          sortAt: '2026-10-07T12:00:00Z',
        },
        {
          id: 'intake',
          clientKey: 'insurance',
          status: 'UNREGISTERED',
          entryAt: '2026-10-07T12:00:00Z',
          purchasedAt: null,
          checkInAt: null,
          departureAt: null,
          sortAt: '2026-10-07T12:00:00Z',
        },
      ],
    },
    data: [
      {
        id: 'intake',
        branchId: 'branch',
        contractId: 'contract',
        contractVersion: 1,
        snapshot: {
          contractNumber: 'DEMO-42',
          serviceSelections: [
            {
              clientKey: 'hotel',
              kind: 'HOTEL',
              titleSnapshot: 'Example Hotel',
            },
            {
              clientKey: 'insurance',
              kind: 'INSURANCE',
              titleSnapshot: 'Example Policy',
            },
          ],
          hotelSelection: null,
          selectedTicketOfferIds: [],
        },
        servicePurchases: [
          {
            id: 'purchase',
            version: 1,
            serviceClientKey: 'hotel',
            amount: '125.50',
            currencyCode: 'USD',
            supplierName: 'Example supplier',
            finance: { status: 'PENDING' },
          },
        ],
      },
    ],
  };
});
function render(language: 'fa' | 'en') {
  return renderToStaticMarkup(
    <AccessPermissionsProvider
      value={['reservations.read', 'reservations.hotel_purchase.write']}
    >
      <DisplayLocaleContext.Provider value={language}>
        <ReservationPurchaseWorkspace />
      </DisplayLocaleContext.Provider>
    </AccessPermissionsProvider>,
  );
}
it('renders themed categories alongside both recorded and missing contract services', () => {
  const html = render('fa');
  expect(html.match(/aria-pressed=/g)).toHaveLength(5);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).toContain('همه خدمات');
  expect(html).toContain('خرید ثبت‌شده');
  expect(html).toContain('خرید ثبت نشده');
  expect(html).toContain('DEMO-42');
  expect(html).toContain('125.50');
  if (process.env.PURCHASE_HUB_VISUAL_PROOF === '1') {
    const chunks = resolve('.next/static/chunks');
    const css = readdirSync(chunks)
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(resolve(chunks, file), 'utf8'))
      .join('\n');
    writeFileSync(
      resolve(
        '../../../../.backups/reservation-purchases-hub-1007-preview.html',
      ),
      `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reservation purchase hub preview</title><style>${css}</style><body style="background:var(--background);color:var(--foreground)"><main style="max-width:1400px;margin:auto;padding:36px"><p style="margin-bottom:20px">پیش‌نمایش با دادهٔ آزمایشی</p>${html}</main></body></html>`,
    );
  }
});
it('renders English labels without translating identifiers or prices', () => {
  const html = render('en');
  expect(html).not.toMatch(/[\u0600-\u06ff]/);
  expect(html).toContain('Hotel purchases');
  expect(html).toContain('Purchase not recorded');
  expect(html).toContain('125.50');
  expect(html).toContain('DEMO-42');
});

it('renders only the matching service rows and retains bookmarked status/date controls', () => {
  state.query =
    'status=REGISTERED&dateBy=CHECK_IN&from=2026-10-15&to=2026-10-15&direction=ASC';
  const records = state.records as {
    meta: { services: { sortAt: string; clientKey: string }[] };
  };
  records.meta.services = records.meta.services
    .filter((r) => r.clientKey === 'hotel')
    .map((r) => ({ ...r, sortAt: '2026-10-15' }));
  const html = render('en');
  expect(html).toContain('value="REGISTERED" selected=""');
  expect(html).toContain('value="CHECK_IN" selected=""');
  expect(html).toContain('Hotel check-in date');
  expect(html).toContain('15/10/2026');
  expect(html).not.toContain('Example Policy');
});
it('preserves the global service row ordering returned by the server', () => {
  const records = state.records as { meta: { services: unknown[] } };
  records.meta.services.reverse();
  const html = render('en');
  expect(html.indexOf('Example Policy')).toBeLessThan(
    html.indexOf('Example Hotel'),
  );
});

it('shows global dashboard counts rather than counting one loaded page and defaults to unregistered', () => {
  const html = render('en');
  expect(html).toContain('value="UNREGISTERED" selected=""');
  expect(html).toContain('Purchase dashboard');
  expect(html).toContain('>99</strong>');
  expect(html).toContain('>64</strong>');
  expect(html).toContain('>33</strong>');
});

it('renders a combined transfer purchase once with its canonical amount', () => {
  const records = state.records as {
    data: ReservationIntakeV1[];
    meta: { services: unknown[] };
  };
  records.data[0]!.snapshot.serviceSelections = [
    { clientKey: 'out', kind: 'TRANSFER', titleSnapshot: 'Outbound' },
    { clientKey: 'back', kind: 'TRANSFER', titleSnapshot: 'Return' },
  ];
  records.data[0]!.servicePurchases = [
    {
      id: 'common',
      version: 1,
      serviceClientKey: 'out',
      coveredServiceClientKeys: ['out', 'back'],
      amount: '125.50',
      currencyCode: 'USD',
      supplierName: 'Example supplier',
    },
  ] as unknown as NonNullable<ReservationIntakeV1['servicePurchases']>;
  records.meta.services = [
    {
      id: 'intake',
      clientKey: 'back',
      coveredServiceClientKeys: ['back', 'out'],
      status: 'REGISTERED',
      sortAt: '2026-10-07',
    },
  ];
  const html = render('en');
  expect(html.match(/125.50/g)).toHaveLength(1);
  expect(html).toContain('Round trip transfer');
  expect(records.data[0]!.snapshot.serviceSelections[1]!.titleSnapshot).toBe(
    'Return',
  );
});
