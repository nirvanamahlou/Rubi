import { describe, expect, it } from 'vitest';

import type { DocumentVersion } from './documents.contracts';
import { AwaitingAntivirusAdapter } from './documents.adapters';

describe('documents adapter contracts', () => {
  it('reports missing antivirus explicitly without inventing a clean result', async () => {
    const adapter = new AwaitingAntivirusAdapter();
    const version = {
      id: 'preview-version-1',
      documentId: 'preview-document-1',
      versionNumber: 1,
      storageObjectKey:
        'documents/11111111-1111-4111-8111-111111111111/v1/22222222-2222-4222-8222-222222222222.bin',
      originalFileName: 'preview.pdf',
      safeDownloadName: 'preview.pdf',
      detectedMimeType: 'application/pdf',
      extension: 'pdf',
      sizeBytes: 100,
      sha256: 'a'.repeat(64),
      scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
      versionNote: 'نمونه',
      createdBy: 'preview-actor',
      createdAt: '2026-09-01T08:00:00.000Z',
    } satisfies DocumentVersion;
    expect(adapter.availability).toBe('AWAITING_ANTIVIRUS_ADAPTER');
    await expect(adapter.requestScan(version)).resolves.toMatchObject({
      status: 'AWAITING_ANTIVIRUS_ADAPTER',
      adapterReference: null,
      scannedAt: null,
    });
  });
});
