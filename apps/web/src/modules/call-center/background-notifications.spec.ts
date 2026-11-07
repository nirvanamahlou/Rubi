import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTrackedFetch } from '@/components/layout/change-notifications';
import { callCenterRequest } from './client';
import { emptySearch, readApi } from './read-client';

const apiBaseUrl = 'http://localhost:4000/api/v1';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));

afterEach(() => vi.unstubAllGlobals());

function trackedBrowser(language: 'fa' | 'en') {
  vi.stubGlobal('window', {
    localStorage: { getItem: () => language },
  });
  const transport = vi.fn(
    async () => new Response(JSON.stringify({ leader: true, data: [] })),
  );
  const notify = vi.fn();
  let sequence = 0;
  vi.stubGlobal(
    'fetch',
    createTrackedFetch(
      transport,
      apiBaseUrl,
      notify,
      () => `change-${++sequence}`,
      () => new Date('2026-11-07T09:00:00Z'),
    ),
  );
  return { transport, notify };
}

describe.each(['fa', 'en'] as const)(
  'Call Center background notifications (%s)',
  (language) => {
    it('keeps a minute of lease renewals, hidden-tab release and unmount silent', async () => {
      const { transport, notify } = trackedBrowser(language);
      const signal = new AbortController().signal;
      for (let poll = 0; poll < 30; poll++) {
        const release = poll % 2 === 1;
        await expect(
          callCenterRequest('/telephony/lease', 'branch-a', {
            method: 'POST',
            body: JSON.stringify({ tabId: 'tab-a', release }),
            signal,
          }),
        ).resolves.toMatchObject({ leader: true });
        await callCenterRequest('/telephony?page=1', 'branch-a', { signal });
      }
      await callCenterRequest('/telephony/lease', 'branch-a', {
        method: 'POST',
        body: JSON.stringify({ tabId: 'tab-a', release: true }),
        keepalive: true,
      });

      expect(transport).toHaveBeenCalledTimes(61);
      expect(notify.mock.calls.length).toBe(0);
      expect(transport).toHaveBeenLastCalledWith(
        `${apiBaseUrl}/customer-affairs/call-center/telephony/lease`,
        expect.objectContaining({
          method: 'POST',
          keepalive: true,
          credentials: 'include',
          cache: 'no-store',
          headers: expect.objectContaining({ 'x-branch-id': 'branch-a' }),
          body: JSON.stringify({ tabId: 'tab-a', release: true }),
        }),
      );
    });

    it('silences real POST query clients while retaining real call and request saves', async () => {
      const { notify } = trackedBrowser(language);
      const signal = new AbortController().signal;
      await readApi.search('branch-a', emptySearch, 1, undefined, signal);
      await readApi.withoutOutcome('branch-a', 1, undefined, signal);
      await readApi.todayCalls('branch-a', 1, undefined, signal);
      await readApi.weekCalls('branch-a', 1, undefined, signal);
      await readApi.missedCallbacks('branch-a', 1, undefined, signal);
      await readApi.report('branch-a', emptySearch, signal);
      expect(notify.mock.calls.length).toBe(0);

      for (const [method, path] of [
        ['POST', '/calls'],
        ['PATCH', '/calls/call-a'],
        ['POST', '/contacts/contact-a/requests'],
        ['POST', '/telephony/call-a/actions'],
      ] as const) {
        await callCenterRequest(path, 'branch-a', {
          method,
          body: JSON.stringify({ action: 'SAVE' }),
        });
      }
      expect(notify).toHaveBeenCalledTimes(4);
      for (const [item] of notify.mock.calls) {
        expect(item).toMatchObject({
          href: '/customer-affairs/call-center',
          readAt: null,
        });
        expect(item.title).toContain('کال سنتر');
      }
    });

    it('does not announce failed saves or replace the original client error', async () => {
      const { transport, notify } = trackedBrowser(language);
      transport.mockImplementationOnce(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Save failed' } }), {
            status: 503,
          }),
      );
      await expect(
        callCenterRequest('/calls', 'branch-a', { method: 'POST' }),
      ).rejects.toThrow('Save failed');
      const abort = new DOMException('Cancelled', 'AbortError');
      transport.mockRejectedValueOnce(abort);
      await expect(
        callCenterRequest('/telephony/lease', 'branch-a', { method: 'POST' }),
      ).rejects.toBe(abort);
      expect(notify).not.toHaveBeenCalled();
    });

    it('keeps separate real saves even when their path and time are identical', async () => {
      const { notify } = trackedBrowser(language);
      for (const callId of ['call-a', 'call-b']) {
        await callCenterRequest('/calls', 'branch-a', {
          method: 'POST',
          body: JSON.stringify({ id: callId }),
        });
      }
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify.mock.calls[0]![0].id).not.toBe(notify.mock.calls[1]![0].id);
    });
  },
);

it.each(['', '/', '?branchId=test', '/?branchId=test'])(
  'recognizes background leases supplied as Request and URL objects (%s)',
  async (suffix) => {
    const notify = vi.fn();
    const response = new Response(JSON.stringify({ leader: false }));
    const original = vi.fn(async () => response);
    const tracked = createTrackedFetch(
      original,
      apiBaseUrl,
      notify,
      () => 'technical-change',
      () => new Date(),
    );
    const url = new URL(
      `${apiBaseUrl}/customer-affairs/call-center/telephony/lease${suffix}`,
    );
    const request = new Request(url, {
      method: 'POST',
      body: JSON.stringify({ tabId: 'tab-a', release: false }),
    });
    await expect(tracked(request)).resolves.toBe(response);
    await expect(tracked(url, { method: 'POST' })).resolves.toBe(response);
    expect(original).toHaveBeenNthCalledWith(1, request);
    expect(original).toHaveBeenNthCalledWith(2, url, { method: 'POST' });
    expect(notify.mock.calls.length).toBe(0);
  },
);
