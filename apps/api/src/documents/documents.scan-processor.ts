import { createHash } from 'node:crypto';

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  WindowsDefenderAntivirus,
  type LocalAntivirusResult,
} from './documents.antivirus';
import {
  type DocumentScanJobRow,
  DocumentsRepository,
  maxDocumentScanAttempts,
} from './documents.repository';
import { LocalDocumentStorage } from './documents.storage';

export const STANDALONE_DOCUMENT_SCANNER = Symbol();

@Injectable()
export class DocumentsScanProcessor implements OnModuleInit, OnModuleDestroy {
  private inFlight?: Promise<void>;
  private stopping = false;
  private readonly logger = new Logger(DocumentsScanProcessor.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DocumentsRepository)
    private readonly repository: DocumentsRepository,
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
    @Inject(WindowsDefenderAntivirus)
    private readonly antivirus: WindowsDefenderAntivirus,
    @Optional()
    @Inject(STANDALONE_DOCUMENT_SCANNER)
    private readonly standalone = false,
  ) {}

  get available() {
    return this.antivirus.available;
  }

  private get runsHere() {
    return (
      this.available &&
      (this.standalone || process.env.DOCUMENTS_SCAN_EXECUTION !== 'worker')
    );
  }

  async onModuleInit() {
    if (!this.runsHere) return;
    if (this.standalone) await this.processPending();
    else await this.poll();
    if (this.stopping) return;
    this.timer = setInterval(() => void this.poll(), 30_000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight?.catch(() => undefined);
  }

  private async poll() {
    try {
      await this.processPending();
    } catch {
      this.logger.warn(
        'Document scan queue temporarily unavailable; claims remain recoverable.',
      );
    }
  }

  processPending(): Promise<void> {
    if (!this.runsHere || this.stopping) return Promise.resolve();
    return (this.inFlight ??= this.processBatch().finally(() => {
      delete this.inFlight;
    }));
  }

  private async processBatch() {
    const jobs = await this.repository.pendingScanJobs(25);
    for (const job of jobs) {
      if (this.stopping) break;
      await this.processJob(job);
    }
  }

  async processVersion(versionId: string) {
    if (!this.runsHere || this.stopping) return false;
    const job = await this.repository.scanJobForVersion(versionId);
    return job ? this.processJob(job) : false;
  }

  private async processJob(candidate: DocumentScanJobRow) {
    if (
      candidate.status === 'RUNNING' &&
      candidate.attempts >= maxDocumentScanAttempts
    ) {
      return this.repository.finishScanJob(
        candidate,
        this.failure('SCAN_LEASE_EXPIRED'),
      );
    }
    const job = await this.repository.claimScanJob(candidate.id);
    if (!job) return false;
    let result: LocalAntivirusResult;
    try {
      const contents = await this.storage.readQuarantined(
        job.version.storageObjectKey,
        Number(job.version.sizeBytes),
      );
      const sha256 = createHash('sha256').update(contents).digest('hex');
      result =
        sha256 === job.version.sha256
          ? await this.antivirus.scan(contents, job.version.safeDownloadName)
          : {
              status: 'SCAN_FAILED' as const,
              adapterReference: 'storage-integrity-check',
              scannedAt: new Date(),
              engineVersion: 'SHA-256',
              threatCode: 'STORAGE_HASH_MISMATCH',
            };
    } catch {
      result = this.failure('ANTIVIRUS_SCAN_FAILED');
    }
    return this.repository.finishScanJob(job, result);
  }

  private failure(threatCode: string): LocalAntivirusResult {
    return {
      status: 'SCAN_FAILED',
      adapterReference: 'document-antivirus:error',
      scannedAt: new Date(),
      engineVersion: 'Configured document antivirus',
      threatCode,
    };
  }
}
