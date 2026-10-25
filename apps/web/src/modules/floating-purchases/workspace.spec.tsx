import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { FLOATING_PURCHASE_OWN, FLOATING_PURCHASE_ALL } from '@nora/contracts';
import { FloatingPurchasesWorkspace } from './workspace';
const fixture = vi.hoisted(() => ({
  permissions: [] as string[],
  owner: 'seller',
  loaded: false,
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => ({
    userId: 'seller',
    sessionId: 'session',
    branchIds: ['branch'],
    permissions: fixture.permissions,
  }),
  useAccessPermissions: () => fixture.permissions,
  useRouteAccess: () => () => true,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    let value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    if (value === undefined && fixture.loaded)
      value = {
        key: JSON.stringify([
          'HOTEL',
          1,
          '',
          0,
          JSON.stringify([
            'seller',
            'session',
            ['branch'],
            fixture.permissions,
          ]),
        ]),
        result: {
          data: [
            {
              id: 'intake',
              salesOwnerUserId: fixture.owner,
              snapshot: {
                contractNumber: 'SYNTHETIC',
                serviceSelections: [],
                hotelSelection: {
                  serviceClientKey: 'h',
                  hotelNameSnapshot: 'Synthetic hotel',
                },
              },
              servicePurchases: [],
              hotelPurchases: [{ amount: '125', currencyCode: 'USD' }],
            },
          ],
          meta: {
            services: [
              { id: 'intake', clientKey: 'h', status: 'UNREGISTERED' },
            ],
            page: 1,
            hasMore: false,
          },
        },
      };
    return [value, vi.fn()];
  },
}));
describe('floating purchase workspace', () => {
  it('does not expose a purchase screen without its dedicated scope', () => {
    fixture.permissions = [];
    fixture.loaded = false;
    const html = renderToStaticMarkup(
      <FloatingPurchasesWorkspace kind="HOTEL" />,
    );
    expect(html).toContain('دسترسی این بخش برای حساب شما فعال نیست.');
    expect(html).not.toContain('<table');
  });
  it('shows a legacy hotel row and permits its owner to record costs', () => {
    fixture.permissions = [FLOATING_PURCHASE_OWN];
    fixture.owner = 'seller';
    fixture.loaded = true;
    const html = renderToStaticMarkup(
      <FloatingPurchasesWorkspace kind="HOTEL" />,
    );
    expect(html).toContain('خرید هتل شناور');
    expect(html).toContain('Synthetic hotel');
    expect(html).toContain('125 USD');
    expect(html).toContain('SYNTHETIC');
    expect(html).toMatch(/<button[^>]*>ثبت خرید<\/button>/);
  });
  it('lets a manager read another seller contract without an edit button', () => {
    fixture.permissions = [FLOATING_PURCHASE_ALL, FLOATING_PURCHASE_OWN];
    fixture.owner = 'other';
    fixture.loaded = true;
    const html = renderToStaticMarkup(
      <FloatingPurchasesWorkspace kind="HOTEL" />,
    );
    expect(html).toContain('SYNTHETIC');
    expect(html).not.toMatch(/<button[^>]*>ثبت خرید<\/button>/);
  });
});
