import { describe, expect, it } from 'vitest';

import type {
  DocumentAsset,
  DocumentUploadSession,
  DocumentVersion,
} from './documents.contracts';
import {
  archiveDocument,
  canDownloadDocument,
  canTransitionUploadSession,
  createNextDocumentVersion,
  DocumentsDomainError,
  restoreDocument,
  transitionUploadSession,
} from './documents.domain';

const now = '2026-09-01T08:00:00.000Z';

function session(
  status: DocumentUploadSession['status'] = 'INITIATED',
): DocumentUploadSession {
  return {
    id: 'preview-upload-1',
    status,
    objectKey:
      'documents/11111111-1111-4111-8111-111111111111/v1/22222222-2222-4222-8222-222222222222.bin',
    branchReference: 'branch-preview-tehran',
    createdBy: 'actor-preview-1',
    createdAt: now,
    expiresAt: '2026-09-01T08:15:00.000Z',
    expectedSizeBytes: 1_024,
    expectedSha256: 'a'.repeat(64),
  };
}

function version(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: 'preview-version-1',
    documentId: 'preview-document-1',
    versionNumber: 1,
    storageObjectKey:
      'documents/11111111-1111-4111-8111-111111111111/v1/22222222-2222-4222-8222-222222222222.bin',
    originalFileName: 'contract.pdf',
    safeDownloadName: 'contract.pdf',
    detectedMimeType: 'application/pdf',
    extension: 'pdf',
    sizeBytes: 1_024,
    sha256: 'a'.repeat(64),
    scanStatus: 'CLEAN',
    versionNote: 'نسخه اولیه',
    createdBy: 'actor-preview-1',
    createdAt: now,
    ...overrides,
  };
}

function asset(overrides: Partial<DocumentAsset> = {}): DocumentAsset {
  return {
    id: 'preview-document-1',
    displayName: 'قرارداد نمونه',
    category: 'SALES_CONTRACT',
    sourceModule: 'sales',
    issuerLegalEntityReference: 'preview-issuer-1',
    branchReference: 'branch-preview-tehran',
    confidentiality: 'CONFIDENTIAL',
    archiveStatus: 'ACTIVE',
    currentVersionNumber: 1,
    references: [],
    createdBy: 'actor-preview-1',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    proposedDeletionAt: null,
    legalHoldActive: false,
    ...overrides,
  };
}

describe('documents domain state machine', () => {
  it('allows only explicit upload transitions', () => {
    expect(canTransitionUploadSession('INITIATED', 'UPLOADING')).toBe(true);
    expect(canTransitionUploadSession('UPLOADED', 'CLEAN')).toBe(false);
    expect(canTransitionUploadSession('CLEAN', 'UPLOADING')).toBe(false);
    expect(transitionUploadSession(session(), 'UPLOADING').status).toBe(
      'UPLOADING',
    );
    expect(() =>
      transitionUploadSession(session('CLEAN'), 'UPLOADING'),
    ).toThrow(DocumentsDomainError);
  });

  it('creates a new immutable version without replacing history', () => {
    const first = version();
    const next = createNextDocumentVersion({
      currentVersions: [first],
      version: {
        ...version({
          id: 'preview-version-2',
          storageObjectKey:
            'documents/11111111-1111-4111-8111-111111111111/v2/33333333-3333-4333-8333-333333333333.bin',
          sha256: 'b'.repeat(64),
        }),
      },
    });
    expect(next.versionNumber).toBe(2);
    expect(Object.isFrozen(next)).toBe(true);
    expect(first).toEqual(version());
    expect(() =>
      createNextDocumentVersion({
        currentVersions: [first],
        version: { ...first, sha256: 'c'.repeat(64) },
      }),
    ).toThrowError(/unique id and immutable object key/);
  });

  it('archives and restores through immutable records with reasons', () => {
    const archived = archiveDocument({
      asset: asset(),
      actorReference: 'actor-preview-admin',
      reason: 'پایان گردش فعال',
      occurredAt: now,
    });
    expect(archived.asset.archiveStatus).toBe('ARCHIVED');
    expect(archived.record.action).toBe('ARCHIVE');
    const restored = restoreDocument({
      asset: archived.asset,
      actorReference: 'actor-preview-admin',
      reason: 'نیاز عملیاتی مجدد',
      occurredAt: '2026-09-01T09:00:00.000Z',
    });
    expect(restored.asset.archiveStatus).toBe('ACTIVE');
    expect(restored.record.action).toBe('RESTORE');
  });

  it('blocks restore while legal hold is active', () => {
    expect(() =>
      restoreDocument({
        asset: asset({ archiveStatus: 'ARCHIVED', legalHoldActive: true }),
        actorReference: 'actor-preview-admin',
        reason: 'درخواست بازیابی',
        occurredAt: now,
      }),
    ).toThrowError(/legal-hold/);
  });
});

describe('documents download gate', () => {
  it('permits only authorized, active and CLEAN versions', () => {
    expect(
      canDownloadDocument({
        scanStatus: 'CLEAN',
        archiveStatus: 'ACTIVE',
        authorizationAllowed: true,
      }),
    ).toEqual({ allowed: true, code: 'ALLOWED' });
    expect(
      canDownloadDocument({
        scanStatus: 'PENDING_SCAN',
        archiveStatus: 'ACTIVE',
        authorizationAllowed: true,
      }).code,
    ).toBe('SCAN_REQUIRED');
    expect(
      canDownloadDocument({
        scanStatus: 'QUARANTINED',
        archiveStatus: 'ACTIVE',
        authorizationAllowed: true,
      }).code,
    ).toBe('QUARANTINED');
    expect(
      canDownloadDocument({
        scanStatus: 'CLEAN',
        archiveStatus: 'ARCHIVED',
        authorizationAllowed: true,
      }).code,
    ).toBe('DOCUMENT_ARCHIVED');
  });
});
