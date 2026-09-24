import { createHash } from 'node:crypto';

import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { WindowsDefenderAntivirus } from './documents.antivirus';
import {
  type DocumentScanJobRow,
  DocumentsRepository,
} from './documents.repository';
import { LocalDocumentStorage } from './documents.storage';

@Injectable()
export class DocumentsScanProcessor implements OnModuleInit, OnModuleDestroy {
  private processing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DocumentsRepository)
    private readonly repository: DocumentsRepository,
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
    @Inject(WindowsDefenderAntivirus)
    private readonly antivirus: WindowsDefenderAntivirus,
  ) {}

  get available() {
    return this.antivirus.available;
  }

  async onModuleInit() {
    if (!this.available) return;
    await this.processPending();
    this.timer = setInterval(() => void this.processPending(), 30_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async processPending() {
    if (!this.available || this.processing) return;
    this.processing = true;
    try {
      const jobs = await this.repository.pendingScanJobs(25);
      for (const job of jobs) await this.processJob(job);
    } finally {
      this.processing = false;
    }
  }

  async processVersion(versionId: string) {
    if (!this.available) return false;
    const job = await this.repository.scanJobForVersion(versionId);
    if (!job) return false;
    await this.processJob(job);
    return true;
  }

  private async processJob(candidate: DocumentScanJobRow) {
    const job = await this.repository.claimScanJob(candidate.id);
    if (!job) return;
    try {
      const contents = await this.storage.readQuarantined(
        job.version.storageObjectKey,
        Number(job.version.sizeBytes),
      );
      const sha256 = createHash('sha256').update(contents).digest('hex');
      const result =
        sha256 === job.version.sha256
          ? await this.antivirus.scan(contents, job.version.safeDownloadName)
          : {
              status: 'SCAN_FAILED' as const,
              adapterReference: 'storage-integrity-check',
              scannedAt: new Date(),
              engineVersion: 'SHA-256',
              threatCode: 'STORAGE_HASH_MISMATCH',
            };
      await this.repository.finishScanJob(job, result);
    } catch {
      await this.repository.finishScanJob(job, {
        status: 'SCAN_FAILED',
        adapterReference: 'windows-defender:error',
        scannedAt: new Date(),
        engineVersion: 'Microsoft Defender',
        threatCode: 'ANTIVIRUS_SCAN_FAILED',
      });
    }
  }
}
