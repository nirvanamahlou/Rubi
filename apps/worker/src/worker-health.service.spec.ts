import { describe, expect, it, vi } from 'vitest';

import { WorkerHealthService } from './worker-health.service';

describe('WorkerHealthService', () => {
  it('reports separate healthy Redis, Queue, and Worker components after live probes', async () => {
    const service = new WorkerHealthService({} as never);
    const queue = {
      getJobCounts: vi
        .fn()
        .mockResolvedValue({ active: 0, failed: 0, wait: 0 }),
      waitUntilReady: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(service as unknown as { queue: typeof queue }, { queue });

    const result = await service.probe(new Date('2026-09-19T10:00:00.000Z'));

    expect(result.data).toMatchObject({ service: 'worker', status: 'ok' });
    expect(result.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: 'REDIS', status: 'HEALTHY' }),
        expect.objectContaining({ component: 'QUEUE', status: 'HEALTHY' }),
        expect.objectContaining({ component: 'WORKER', status: 'HEALTHY' }),
      ]),
    );
  });
});
