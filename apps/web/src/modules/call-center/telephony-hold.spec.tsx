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
