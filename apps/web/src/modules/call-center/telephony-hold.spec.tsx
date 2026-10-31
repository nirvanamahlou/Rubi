import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TelephonyAttention } from './telephony-attention';
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => ({
    userId: 'test',
    branchIds: ['branch'],
    permissions: [
      'customer_affairs.call_center.workflow.manage',
      'customer_affairs.call_center.read',
    ],
  }),
}));
afterEach(() => vi.unstubAllEnvs());
it('explicit rollout hold renders no attention UI even for a fully authorized operator', () => {
  vi.stubEnv('NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED', 'false');
  expect(renderToStaticMarkup(<TelephonyAttention />)).toBe('');
});

it('keeps the outbound listener separately opt-in and never restores the technical widget', () => {
  vi.stubEnv('NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED', 'false');
  expect(renderToStaticMarkup(<TelephonyAttention outboundOnly />)).toBe('');
  vi.stubEnv('NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED', 'true');
  const html = renderToStaticMarkup(<TelephonyAttention outboundOnly />);
  expect(html).not.toContain('تماس‌ها (');
  expect(html).not.toContain('ایزابل متصل نشده');
  expect(html).not.toContain('تلاش مجدد');
});

it('requires explicit activation for both directions while keeping the technical widget hidden', () => {
  vi.stubEnv('NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED', 'false');
  expect(
    renderToStaticMarkup(<TelephonyAttention outboundOnly bothDirections />),
  ).toBe('');
  vi.stubEnv('NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED', 'true');
  const html = renderToStaticMarkup(
    <TelephonyAttention outboundOnly bothDirections />,
  );
  expect(html).not.toContain('تماس‌ها (');
  expect(html).not.toContain('تلاش مجدد');
});
