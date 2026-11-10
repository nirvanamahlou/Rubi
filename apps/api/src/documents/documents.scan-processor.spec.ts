import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WindowsDefenderAntivirus } from './documents.antivirus';
import type {
  DocumentScanJobRow,
  DocumentsRepository,
} from './documents.repository';
import { DocumentsScanProcessor } from './documents.scan-processor';
import type { LocalDocumentStorage } from './documents.storage';

const contents = Buffer.from('%PDF-1.7\nsynthetic scan processor test');
const job = {
  id: '11111111-1111-4111-8111-111111111111',
  versionId: '22222222-2222-4222-8222-222222222222',
  jobType: 'ANTIVIRUS_SCAN',
  status: 'PENDING',
  attempts: 0,
  availableAt: new Date(),
  lastErrorCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: {
    id: '22222222-2222-4222-8222-222222222222',
    storageObjectKey:
      'documents/33333333-3333-4333-8333-333333333333/v1/44444444-4444-4444-8444-444444444444.bin',
    safeDownloadName: 'document.pdf',
    sizeBytes: BigInt(contents.length),
    sha256: createHash('sha256').update(contents).digest('hex'),
    document: {
      id: '33333333-3333-4333-8333-333333333333',
      branchId: '55555555-5555-4555-8555-555555555555',
    },
  },
} as DocumentScanJobRow;

describe('DocumentsScanProcessor', () => {
  const repository = {
    pendingScanJobs: vi.fn(),
    scanJobForVersion: vi.fn(),
    claimScanJob: vi.fn(),
    finishScanJob: vi.fn(),
  };
  const storage = { readQuarantined: vi.fn() };
  const antivirus = { available: true, scan: vi.fn() };
  let processor: DocumentsScanProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    repository.finishScanJob.mockResolvedValue(true);
    processor = new DocumentsScanProcessor(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      antivirus as unknown as WindowsDefenderAntivirus,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves queue and inline processing to the standalone scanner in worker mode', async () => {
    vi.stubEnv('DOCUMENTS_SCAN_EXECUTION', 'worker');
    await processor.onModuleInit();
    await expect(processor.processVersion(job.versionId)).resolves.toBe(false);
    expect(repository.pendingScanJobs).not.toHaveBeenCalled();
    expect(repository.scanJobForVersion).not.toHaveBeenCalled();

    const worker = new DocumentsScanProcessor(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      antivirus as unknown as WindowsDefenderAntivirus,
      true,
    );
    repository.pendingScanJobs.mockResolvedValue([]);
    await worker.processPending();
    expect(repository.pendingScanJobs).toHaveBeenCalledOnce();
  });

  it('marks the final expired scan as failed without attempting another scan', async () => {
    const expired = { ...job, status: 'RUNNING', attempts: 3 };
    repository.pendingScanJobs.mockResolvedValue([expired]);
    await processor.processPending();
    expect(repository.claimScanJob).not.toHaveBeenCalled();
    expect(antivirus.scan).not.toHaveBeenCalled();
    expect(repository.finishScanJob).toHaveBeenCalledWith(
      expired,
      expect.objectContaining({
        status: 'SCAN_FAILED',
        threatCode: 'SCAN_LEASE_EXPIRED',
      }),
    );
  });

  it('verifies the decrypted hash before recording a real clean result', async () => {
    repository.scanJobForVersion.mockResolvedValue(job);
    repository.claimScanJob.mockResolvedValue(job);
    storage.readQuarantined.mockResolvedValue(contents);
    antivirus.scan.mockResolvedValue({
      status: 'CLEAN',
      adapterReference: 'windows-defender:MpCmdRun.exe',
      scannedAt: new Date(),
      engineVersion: 'Microsoft Defender',
      threatCode: null,
    });

    await expect(processor.processVersion(job.versionId)).resolves.toBe(true);
    expect(antivirus.scan).toHaveBeenCalledWith(contents, 'document.pdf');
    expect(repository.finishScanJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({ status: 'CLEAN', threatCode: null }),
    );
  });

  it('fails closed when decrypted bytes do not match the stored hash', async () => {
    repository.scanJobForVersion.mockResolvedValue(job);
    repository.claimScanJob.mockResolvedValue(job);
    storage.readQuarantined.mockResolvedValue(Buffer.from('tampered'));

    await processor.processVersion(job.versionId);

    expect(antivirus.scan).not.toHaveBeenCalled();
    expect(repository.finishScanJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({
        status: 'SCAN_FAILED',
        threatCode: 'STORAGE_HASH_MISMATCH',
      }),
    );
  });
});
