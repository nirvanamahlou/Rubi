import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { ReservationPurchaseWorkspace } from './workspace';
const state = vi.hoisted(() => ({ index: 0, records: undefined as unknown }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/ticket-purchases',
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    return [
      index === 3
        ? { key: '["ALL",1,"",0]', response: state.records }
        : typeof initial === 'function'
          ? initial()
          : initial,
      vi.fn(),
    ];
  },
}));
beforeEach(() => {
  state.index = 0;
  state.records = {
    meta: { page: 1, pageSize: 25, hasMore: false, canRecord: true },
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
