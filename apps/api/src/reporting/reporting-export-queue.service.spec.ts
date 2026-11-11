import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { expect, it, vi } from 'vitest';

import { ReportingExportQueue } from './reporting-export-queue.service';
import type { QueuedReportExport } from './reporting-export-queue.repository';
import type { ExportCreateDto } from './reporting.dto';

function fixture() {
  const actor = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    permissions: ['reporting.export', 'reporting.read'],
    branchIds: [randomUUID()],
  } as unknown as AuthenticatedActor;
  const input: ExportCreateDto = {
    format: 'CSV',
    query: { filters: {}, page: 1, pageSize: 20, timezone: 'Asia/Tehran' },
  };
  const id = randomUUID();
  const artifact = {
    objectKey: 'documents/synthetic/v1/example.bin',
    sizeBytes: 14,
    checksum: 'a'.repeat(64),
    expiryDays: 7,
    recordCount: 1,
  };
  const queue = {
    enqueue: vi
      .fn<
        (input: {
          payload: QueuedReportExport['queuePayload'];
        }) => Promise<{ id: string; status: string }>
      >()
      .mockResolvedValue({ id, status: 'QUEUED' }),
    claim: vi.fn(),
    complete: vi.fn().mockResolvedValue(true),
    status: vi.fn().mockResolvedValue(null),
  };
  const reports = {
    assertExportAccess: vi.fn(),
    prepareQueuedExport: vi.fn().mockReturnValue({
      report: { title: 'Synthetic report', approvedView: 'travel', version: 1 },
      query: input.query,
    }),
    renderQueuedExport: vi.fn().mockResolvedValue(artifact),
  };
  const files = { discard: vi.fn().mockResolvedValue(undefined) };
  const iam = {
    authenticateSessionReferenceV1: vi.fn().mockResolvedValue(actor),
  };
  const worker = new ReportingExportQueue(
    queue as never,
    reports as never,
    files as never,
    iam as never,
  );
  const enqueue = async () => {
    const created = await worker.enqueue('travel', input, actor);
    const job: QueuedReportExport = {
      id,
      runId: randomUUID(),
      queueToken: randomUUID(),
      creatorUserId: actor.userId,
      reportCode: 'travel',
      format: 'CSV',
      queuePayload: queue.enqueue.mock.calls[0]![0].payload,
    };
    queue.claim.mockResolvedValueOnce(job);
    return { created, job };
  };
  return { worker, actor, artifact, queue, reports, files, iam, enqueue };
}

it('enqueues without rendering and rechecks the current session before publishing', async () => {
  const f = fixture();
  const { created, job } = await f.enqueue();
  expect(created).toEqual({ id: job.id, status: 'QUEUED' });
  expect(f.reports.renderQueuedExport).not.toHaveBeenCalled();
  await f.worker.poll();
  expect(f.iam.authenticateSessionReferenceV1).toHaveBeenCalledTimes(2);
  expect(f.iam.authenticateSessionReferenceV1).toHaveBeenCalledWith(
    f.actor.userId,
    f.actor.sessionId,
    true,
  );
  expect(f.queue.complete).toHaveBeenCalledWith(
    job,
    f.artifact,
    expect.any(Number),
  );
  await expect(f.worker.status(job.id, f.actor)).rejects.toThrow(
    'خروجی پیدا نشد.',
  );
  expect(f.queue.status).toHaveBeenCalledWith(job.id, f.actor.userId);
});

it('fails before reading data when the queued actor scope changes', async () => {
  const f = fixture();
  const { job } = await f.enqueue();
  f.iam.authenticateSessionReferenceV1.mockResolvedValueOnce({
    ...f.actor,
    branchIds: [],
  });
  await f.worker.poll();
  expect(f.reports.renderQueuedExport).not.toHaveBeenCalled();
  expect(f.queue.complete).toHaveBeenCalledWith(
    job,
    { errorMessage: expect.stringContaining('دسترسی گزارش تغییر کرده است') },
    expect.any(Number),
  );
});

it('discards output when the session is revoked during rendering or the lease is lost', async () => {
  const f = fixture();
  await f.enqueue();
  f.iam.authenticateSessionReferenceV1
    .mockResolvedValueOnce(f.actor)
    .mockRejectedValueOnce(new UnauthorizedException());
  await f.worker.poll();
  expect(f.files.discard).toHaveBeenCalledWith(f.artifact.objectKey);
  expect(f.queue.complete.mock.calls[0]![1]).toHaveProperty('errorMessage');

  await f.enqueue();
  f.queue.complete.mockResolvedValueOnce(false);
  await f.worker.poll();
  expect(f.files.discard).toHaveBeenCalledTimes(2);
});
