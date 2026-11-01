import { expect, it, vi } from 'vitest';
import { workflowApi } from './workflow-client';
const request = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
);
vi.mock('./client', () => ({ callCenterRequest: request }));
it('sends queue filters with paging and cancellation to the request endpoint', async () => {
  const signal = new AbortController().signal;
  await workflowApi.queue('branch', 'OPEN', 2, signal, {
    teamId: 'team',
    agentId: 'author',
    requestStatus: 'WAITING_CUSTOMER',
  });
  const [url, branch, options] = request.mock.calls[0]!;
  const params = new URL(url, 'https://local.test').searchParams;
  expect(new URL(url, 'https://local.test').pathname).toBe('/queue');
  expect(Object.fromEntries(params)).toEqual({
    view: 'OPEN',
    page: '2',
    teamId: 'team',
    agentId: 'author',
    requestStatus: 'WAITING_CUSTOMER',
  });
  expect(branch).toBe('branch');
  expect(options.signal).toBe(signal);
});
