import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@nora/database';
import { expect, it } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DocumentsRepository } from './documents.repository';

it.skipIf(process.env.NORA_RUN_DOCUMENT_SCAN_POSTGRES_TEST !== '1')(
  'reclaims a crashed scanner without letting its stale result release the document',
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/document_scan_proof'
    )
      throw new Error('Use the disposable local document_scan_proof database.');
    const client = createDatabaseClient(url.toString());
    try {
      const repository = new DocumentsRepository(
        { client } as unknown as DatabaseService,
        {
          createWithinTransaction: async () => undefined,
        } as unknown as NotificationsService,
      );
      const user = await client.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Scan proof',
          passwordHash: 'INVALID-TEST',
        },
      });
      const branch = await client.branch.create({
        data: { code: randomUUID(), name: 'Scan proof' },
      });
      const type = await client.documentType.create({
        data: {
          code: randomUUID(),
          name: 'Scan proof',
          domain: 'GENERAL',
          allowedMimeTypes: ['application/pdf'],
        },
      });
      const documentId = randomUUID();
      const versionId = randomUUID();
      await repository.createUploaded({
        documentId,
        versionId,
        storageObjectKey:
          'documents/' + documentId + '/v1/' + randomUUID() + '.bin',
        title: 'Scan proof',
        description: null,
        documentTypeId: type.id,
        categoryId: null,
        branchId: branch.id,
        ownerUserId: user.id,
        sourceModule: 'documents',
        sourceEntityType: null,
        sourceEntityId: null,
        sourceDisplayLabel: null,
        confidentiality: 'INTERNAL',
        requiresStepUpVerification: false,
        confidentialAccessCodeHash: null,
        confidentialAccessCodeSalt: null,
        validUntil: null,
        originalFileName: 'proof.pdf',
        safeDownloadName: 'proof.pdf',
        detectedMimeType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: 16,
        sha256: 'a'.repeat(64),
        versionNote: '',
        actorUserId: user.id,
        actorBranchId: branch.id,
        ipSummary: 'test',
        userAgentSummary: 'test',
      });
      const candidate = await repository.scanJobForVersion(versionId);
      expect(candidate).not.toBeNull();
      const claims = await Promise.all([
        repository.claimScanJob(candidate!.id),
        repository.claimScanJob(candidate!.id),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const first = claims.find(Boolean)!;
      expect(first.attempts).toBe(1);
      expect(
        (await repository.pendingScanJobs(25)).some(
          (row) => row.id === first.id,
        ),
      ).toBe(false);

      await client.documentProcessingJob.update({
        where: { id: first.id },
        data: { availableAt: new Date(0) },
      });
      expect(
        (await repository.pendingScanJobs(25)).some(
          (row) => row.id === first.id,
        ),
      ).toBe(true);
      const second = await repository.claimScanJob(first.id);
      expect(second?.attempts).toBe(2);

      const clean = {
        status: 'CLEAN' as const,
        adapterReference: 'synthetic-scanner',
        scannedAt: new Date(),
        engineVersion: 'test',
        threatCode: null,
      };
      await expect(repository.finishScanJob(first, clean)).resolves.toBe(false);
      expect(
        (
          await client.documentQuarantine.findUniqueOrThrow({
            where: { versionId },
          })
        ).status,
      ).toBe('ACTIVE');
      await expect(repository.finishScanJob(second!, clean)).resolves.toBe(
        true,
      );
      expect(
        (
          await client.documentQuarantine.findUniqueOrThrow({
            where: { versionId },
          })
        ).status,
      ).toBe('RELEASED');
      expect(
        await client.documentAuditEvent.count({
          where: { versionId, action: 'documents.antivirus.scan' },
        }),
      ).toBe(1);
    } finally {
      await client.$disconnect();
    }
  },
  30000,
);
