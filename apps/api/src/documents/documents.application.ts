import type {
  DocumentAccessLog,
  DocumentArchiveRecord,
  DocumentAsset,
  DocumentLegalHold,
  DocumentListQuery,
  DocumentUploadSession,
  DocumentVersion,
  PaginatedDocuments,
} from './documents.contracts';
import type { DocumentsActorContext } from './documents.permissions';

export interface CreateUploadSessionCommand {
  displayName: string;
  originalFileName: string;
  expectedSizeBytes: number;
  expectedSha256: string;
  detectedMimeType: string;
  branchReference: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
}

export interface AuthorizedDownloadRequest {
  documentId: string;
  versionId: string | null;
  reason: string | null;
  ttlSeconds: number;
}

export interface AuthorizedDownloadResult {
  readonly expiresAt: string;
  readonly signedUrl: string;
}

export interface DocumentsApplicationPort {
  listDocuments(
    query: DocumentListQuery,
    actor: DocumentsActorContext,
  ): Promise<PaginatedDocuments<DocumentAsset>>;
  getDocument(
    documentId: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentAsset | null>;
  createUploadSession(
    command: CreateUploadSessionCommand,
    actor: DocumentsActorContext,
  ): Promise<DocumentUploadSession>;
  completeUpload(
    uploadSessionId: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentAsset>;
  cancelUpload(
    uploadSessionId: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentUploadSession>;
  createVersion(
    documentId: string,
    command: CreateUploadSessionCommand & { versionNote: string },
    actor: DocumentsActorContext,
  ): Promise<DocumentVersion>;
  listVersions(
    documentId: string,
    actor: DocumentsActorContext,
  ): Promise<readonly DocumentVersion[]>;
  requestAuthorizedDownload(
    request: AuthorizedDownloadRequest,
    actor: DocumentsActorContext,
  ): Promise<AuthorizedDownloadResult>;
  archiveDocument(
    documentId: string,
    reason: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentArchiveRecord>;
  restoreDocument(
    documentId: string,
    reason: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentArchiveRecord>;
  listAccessHistory(
    documentId: string,
    actor: DocumentsActorContext,
  ): Promise<readonly DocumentAccessLog[]>;
  placeLegalHold(
    documentId: string,
    reason: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentLegalHold>;
  releaseLegalHold(
    legalHoldId: string,
    reason: string,
    actor: DocumentsActorContext,
  ): Promise<DocumentLegalHold>;
}
