import type {
  DocumentScanResult,
  DocumentUploadSession,
  DocumentVersion,
} from './documents.contracts';

export interface ObjectStoragePort {
  createPrivateUploadTarget(input: {
    objectKey: string;
    contentLength: number;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; expiresAt: string }>;
  createPrivateDownloadTarget(input: {
    objectKey: string;
    safeDownloadName: string;
    expiresInSeconds: number;
  }): Promise<{ downloadUrl: string; expiresAt: string }>;
  verifyObject(input: {
    objectKey: string;
    expectedSizeBytes: number;
    expectedSha256: string;
  }): Promise<{ verified: boolean }>;
  quarantineObject(objectKey: string): Promise<void>;
}

export interface AntivirusScanPort {
  readonly availability: 'AWAITING_ANTIVIRUS_ADAPTER' | 'AVAILABLE';
  requestScan(version: DocumentVersion): Promise<DocumentScanResult>;
}

export interface DocumentBackgroundWorkPort {
  enqueueOrphanCleanup(session: DocumentUploadSession): Promise<void>;
  enqueueRetentionReview(documentId: string): Promise<void>;
}

export interface DocumentAuditPort {
  appendSensitiveAccess(input: {
    documentId: string;
    versionId: string | null;
    actorReference: string;
    branchReference: string;
    action: 'VIEW' | 'DOWNLOAD';
    reason: string;
    outcome: 'ALLOWED' | 'DENIED' | 'FAILED';
    occurredAt: string;
    ipSummary: string;
    userAgentSummary: string;
  }): Promise<void>;
}

export class AwaitingAntivirusAdapter implements AntivirusScanPort {
  readonly availability = 'AWAITING_ANTIVIRUS_ADAPTER' as const;

  async requestScan(version: DocumentVersion): Promise<DocumentScanResult> {
    return Promise.resolve({
      versionId: version.id,
      status: 'AWAITING_ANTIVIRUS_ADAPTER',
      adapterReference: null,
      scannedAt: null,
      engineVersion: null,
      threatCode: null,
    });
  }
}
