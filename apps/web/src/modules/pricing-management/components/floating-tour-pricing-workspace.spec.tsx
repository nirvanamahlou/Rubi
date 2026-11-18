import { renderToStaticMarkup } from 'react-dom/server';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FloatingTourPricingWorkspace } from './floating-tour-pricing-workspace';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  permissions: ['package_pricing.read', 'package_pricing.period.manage'],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useState: (initial: unknown) => {
    const i = h.index++;
    if (!(i in h.states))
      h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[i],
      (v: unknown) => {
        h.states[i] = typeof v === 'function' ? v(h.states[i]) : v;
      },
    ];
  },
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => h.permissions,
  useRouteAccess: () => () => true,
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
beforeEach(() => {
  h.states = [];
  h.index = 0;
  h.permissions = ['package_pricing.read', 'package_pricing.period.manage'];
});
function seed(nights: number) {
  h.states = [
    {},
    [{ id: 'tour', name: 'Floating' }],
    'tour',
    null,
    null,
    null,
    false,
    '',
    '',
    {
      nights,
      destinationNights: nights ? [3, nights - 3] : [0, 0],
      mode: 'DATED',
      calendar: 'PERSIAN',
      months: [],
      combined: true,
    },
  ];
}
it('requires an explicitly entered night count before enabling the Excel picker', () => {
  seed(0);
  const html = renderToStaticMarkup(<FloatingTourPricingWorkspace />);
  expect(html).toContain('تعداد شب این بازه');
  expect(html).toContain('تعداد مقصد');
  expect(html).toContain('تعداد شب مقصد 1');
  expect(html).toContain('تعداد شب مقصد 2');
  expect(html).toContain('شهر هر مقصد از هتل داخل اکسل خوانده می‌شود');
  expect(
    html.match(/<input[^>]*aria-label="تعداد شب این بازه"[^>]*>/)?.[0],
  ).toContain('readOnly=""');
  expect(html).toContain('دانلود قالب قیمت تور');
  expect(html).toContain('/api/v1/sales/pricing/floating-tours/tour/template');
  expect(html).toContain('قیمت مشترک را در سلول ادغام‌شده وارد کنید');
  expect(html).not.toContain('دو ردیف پشت‌سرهم');
  expect(
    html.match(/<input[^>]*aria-label="فایل قیمت تور"[^>]*>/)?.[0],
  ).toContain('disabled=""');
  h.index = 0;
  seed(7);
  const enabled = renderToStaticMarkup(<FloatingTourPricingWorkspace />);
  expect(
    enabled.match(/<input[^>]*aria-label="فایل قیمت تور"[^>]*>/)?.[0],
  ).not.toContain('disabled=""');
  expect(enabled).toContain('فروش نفری');
});
it('matches the merged template to three destinations and blocks incomplete stops', () => {
  seed(7);
  h.states[9] = {
    nights: 7,
    mode: 'DATED',
    combined: true,
    destinationNights: [2, 0, 5],
  };
  const html = renderToStaticMarkup(<FloatingTourPricingWorkspace />);
  expect(html).toContain('destinationCount=3');
  expect(html).toContain('تعداد شب مقصد 3');
  expect(
    html.match(/<input[^>]*aria-label="فایل قیمت تور"[^>]*>/)?.[0],
  ).toContain('disabled=""');
});
it('keeps preview and final confirmation separate and blocks mutation for read-only users', () => {
  seed(7);
  h.states[5] = {
    rows: [],
    options: { nights: 7, mode: 'DATED' },
    digest: 'a',
    expectedVersion: 0,
  };
  h.permissions = ['package_pricing.read'];
  const html = renderToStaticMarkup(<FloatingTourPricingWorkspace />);
  expect(html).toContain('پیش‌نمایش ورود قیمت');
  expect(html).toContain('ثبت نهایی قیمت فروش');
  expect(
    html.match(/<input[^>]*aria-label="فایل قیمت تور"[^>]*>/)?.[0],
  ).toContain('disabled=""');
  expect(html).not.toContain('قیمت خرید');
});
