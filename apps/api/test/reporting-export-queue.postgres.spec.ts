import { randomUUID } from 'node:crypto';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ReportingExportQueueRepository } from '../src/reporting/reporting-export-queue.repository';
import { ReportingRepository } from '../src/reporting/reporting.repository';

const enabled =
  process.env.NORA_RUN_REPORTING_EXPORT_QUEUE_POSTGRES_TESTS === '1';
describe.skipIf(!enabled)(
  'Reporting export queue on isolated PostgreSQL',
  () => {
    let db: DatabaseClient;
    const ownerId = randomUUID();
    const otherId = randomUUID();
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL!);
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55516' ||
        url.pathname !== '/reporting_export_queue_test'
      )
        throw new Error('Isolated reporting export test database required.');
      db = createDatabaseClient(url.toString());
      await db.user.createMany({
        data: [ownerId, otherId].map((id) => ({
          id,
          username: id,
          displayName: 'Synthetic reporting owner',
          passwordHash: 'disabled-synthetic-test',
        })),
      });
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('persists a single claim, fences stale workers and publishes run and artifact together', async () => {
      const firstWorker = new ReportingExportQueueRepository({
        client: db,
      } as never);
      const secondWorker = new ReportingExportQueueRepository({
        client: db,
      } as never);
      const legacy = new ReportingRepository({ client: db } as never);
      const input = {
        reportCode: 'sales_by_service_route',
        reportName: 'Synthetic export',
        viewName: 'reporting_travel_facts',
        viewVersion: 2,
        creatorUserId: ownerId,
        format: 'CSV' as const,
        fileName: 'report.csv',
        contentType: 'text/csv',
        filterSnapshot: { filters: {} },
        payload: {
          sessionId: randomUUID(),
          authorizationFingerprint: 'test-fingerprint',
          viewName: 'reporting_travel_facts',
          viewVersion: 2,
          query: {
            filters: {},
            page: 1,
            pageSize: 25,
            timezone: 'Asia/Tehran' as const,
          },
        },
      };

      const oldRun = await legacy.createRun({
        reportCode: input.reportCode,
        actorUserId: ownerId,
        viewName: input.viewName,
        viewVersion: input.viewVersion,
        filterSnapshot: input.filterSnapshot,
      });
      const oldArtifact = await legacy.createExport({
        ...input,
        runId: String(oldRun.id),
      });
      expect(oldArtifact).toMatchObject({ status: 'GENERATING' });
      expect(oldArtifact).not.toHaveProperty('queuePayload');
      expect(await firstWorker.claim()).toBeUndefined();

      const created = await firstWorker.enqueue(input);
      expect(created.status).toBe('QUEUED');
      expect(await firstWorker.status(created.id, otherId)).toBeNull();
      expect((await legacy.listExports(ownerId))[0]).not.toHaveProperty(
        'queuePayload',
      );
      const claims = await Promise.all([
        firstWorker.claim(),
        secondWorker.claim(),
      ]);
      const initial = claims.find((job) => job?.id === created.id)!;
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(initial).toBeDefined();
      expect(
        (
          await db.reportingRun.findUniqueOrThrow({
            where: { id: initial.runId },
          })
        ).status,
      ).toBe('RUNNING');
      const finished = {
        objectKey: 'documents/synthetic/v1/output.bin',
        sizeBytes: 10,
        checksum: 'a'.repeat(64),
        expiryDays: 7,
        recordCount: 12,
      };
      await db.reportingExportArtifact.update({
        where: { id: created.id },
        data: { queueLeaseUntil: new Date(0) },
      });
      expect(await firstWorker.complete(initial, finished, 20)).toBe(false);
      const recovered = (await secondWorker.claim())!;
      expect(recovered).toMatchObject({ id: created.id, runId: initial.runId });
      expect(recovered.queueToken).not.toBe(initial.queueToken);
      expect(await firstWorker.complete(initial, finished, 30)).toBe(false);
      expect(await secondWorker.complete(recovered, finished, 50)).toBe(true);
      expect(await firstWorker.status(created.id, ownerId)).toMatchObject({
        status: 'READY',
      });
      expect(
        await db.reportingExportArtifact.findUniqueOrThrow({
          where: { id: created.id },
        }),
      ).toMatchObject({
        objectKey: finished.objectKey,
        queuePayload: null,
        queueToken: null,
      });
      expect(
        await db.reportingRun.findUniqueOrThrow({
          where: { id: initial.runId },
        }),
      ).toMatchObject({ status: 'SUCCEEDED', recordCount: 12 });

      const pending = await Promise.allSettled(
        Array.from({ length: 4 }, () => firstWorker.enqueue(input)),
      );
      expect(
        pending.filter((entry) => entry.status === 'fulfilled'),
      ).toHaveLength(3);
      const interrupted = (await firstWorker.claim())!;
      await db.reportingExportArtifact.update({
        where: { id: interrupted.id },
        data: { queueLeaseUntil: new Date(0), queueAttempts: 3 },
      });
      await secondWorker.claim();
      expect(await firstWorker.status(interrupted.id, ownerId)).toMatchObject({
        status: 'FAILED',
      });
      expect(
        await db.reportingRun.findUniqueOrThrow({
          where: { id: interrupted.runId },
        }),
      ).toMatchObject({
        status: 'FAILED',
        errorCode: 'REPORT_EXPORT_LEASE_EXPIRED',
      });
    });
  },
);
