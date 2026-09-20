import { describe, expect, it } from 'vitest';

import {
  MAX_DOCUMENT_SIZE_BYTES,
  normalizeDocumentListQuery,
  sanitizeDownloadFileName,
  validateSignedUrlTtl,
  validateStorageObjectKey,
  validateUploadFile,
} from './documents.validation';

const validPdf = {
  originalFileName: 'contract.pdf',
  declaredMimeType: 'application/pdf',
  detectedMimeType: 'application/pdf',
  sizeBytes: 1_024,
  sha256: 'a'.repeat(64),
  magicBytes: [0x25, 0x50, 0x44, 0x46],
};

describe('documents upload validation', () => {
  it('accepts an allowlisted file whose extension, MIME and magic bytes agree', () => {
    expect(validateUploadFile(validPdf)).toMatchObject({
      valid: true,
      extension: 'pdf',
      errors: [],
    });
  });

  it('rejects executable, fake MIME, oversized and malformed checksum inputs', () => {
    const result = validateUploadFile({
      ...validPdf,
      originalFileName: '..\\..\\payload.exe',
      declaredMimeType: 'application/pdf',
      detectedMimeType: 'application/octet-stream',
      sizeBytes: MAX_DOCUMENT_SIZE_BYTES + 1,
      sha256: 'invalid',
      magicBytes: [0x4d, 0x5a],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'EXTENSION_NOT_ALLOWED',
        'EXECUTABLE_OR_MACRO_BLOCKED',
        'FILE_TOO_LARGE',
        'INVALID_SHA256',
        'DECLARED_MIME_MISMATCH',
        'MAGIC_BYTES_MISMATCH',
      ]),
    );
  });

  it('rejects macro formats and archive bombs', () => {
    expect(
      validateUploadFile({
        ...validPdf,
        originalFileName: 'invoice.xlsm',
        declaredMimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        detectedMimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        magicBytes: [0x50, 0x4b],
        archiveEntryCount: 2_000,
        archiveUncompressedBytes: 500_000,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        'EXECUTABLE_OR_MACRO_BLOCKED',
        'ARCHIVE_ENTRY_LIMIT_EXCEEDED',
        'ARCHIVE_BOMB_SUSPECTED',
      ]),
    );
  });

  it('sanitizes Content-Disposition names and blocks path traversal', () => {
    expect(sanitizeDownloadFileName('../../secret؛".pdf')).toBe('secret_.pdf');
    expect(sanitizeDownloadFileName('..\\..\\contract.pdf')).toBe(
      'contract.pdf',
    );
  });

  it('requires random opaque object keys and signed URL TTL of at most 5 minutes', () => {
    expect(
      validateStorageObjectKey(
        'documents/11111111-1111-4111-8111-111111111111/v2/22222222-2222-4222-8222-222222222222.bin',
      ),
    ).toBe(true);
    expect(validateStorageObjectKey('documents/passport.pdf')).toBe(false);
    expect(validateSignedUrlTtl(300)).toBe(true);
    expect(validateSignedUrlTtl(301)).toBe(false);
  });
});

describe('documents list contract', () => {
  it('normalizes pagination, filter strings and sort allowlist', () => {
    expect(
      normalizeDocumentListQuery({
        search: `  قرارداد ${'الف'.repeat(200)}  `,
        sourceModule: ' sales ',
        page: -9,
        pageSize: 900,
        sortBy: 'invalid' as never,
        sortDirection: 'asc',
      }),
    ).toMatchObject({
      page: 1,
      pageSize: 100,
      sortBy: 'updatedAt',
      sortDirection: 'asc',
      sourceModule: 'sales',
    });
  });
});
