import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelephonyWorker } from './telephony-worker';

afterEach(() => vi.unstubAllGlobals());
describe('telephony worker transport', () => {
  it('rejects public plaintext transport before exposing the machine credential', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const worker = new TelephonyWorker(
      new ConfigService({
        TELEPHONY_API_URL: 'http://example.invalid/api/v1',
        TELEPHONY_WORKER_SECRET: 'x'.repeat(32),
      }),
    );
    await expect(worker.request('pending')).rejects.toThrow('HTTPS');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('is disabled without explicit internal transport configuration', () => {
    const worker = new TelephonyWorker(new ConfigService({}));
    worker.onModuleInit();
    expect(worker['queue']).toBeUndefined();
  });
  it('sends only the configured machine credential and rejects failed delivery', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ inboxId: 'opaque-id' }],
    });
    vi.stubGlobal('fetch', fetch);
    const worker = new TelephonyWorker(
      new ConfigService({
        TELEPHONY_API_URL: 'http://127.0.0.1:4000/api/v1',
        TELEPHONY_WORKER_SECRET: 'x'.repeat(32),
      }),
    );
    expect(await worker.request('pending')).toEqual([{ inboxId: 'opaque-id' }]);
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:4000/api/v1/internal/telephony-worker/pending',
    );
    fetch.mockResolvedValue({ ok: false, status: 503 });
    await expect(worker.request('opaque-id/process', 'POST')).rejects.toThrow(
      '503',
    );
  });
  it('resumes a durable pending row on the next sweep after transport recovery', async () => {
    const worker = new TelephonyWorker(new ConfigService({}));
    const add = vi.fn().mockResolvedValue({});
    worker['queue'] = { add, getJob: vi.fn().mockResolvedValue(null) } as never;
    vi.spyOn(worker, 'request')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([{ inboxId: 'pending-id' }]);
    await worker.sweep();
    expect(add).not.toHaveBeenCalled();
    await worker.sweep();
    expect(add).toHaveBeenCalledWith(
      'process',
      { inboxId: 'pending-id' },
      { jobId: 'pending-id' },
    );
  });
});
