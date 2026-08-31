import type {
  DocumentListQuery,
  DocumentSortField,
} from './documents.contracts';
import { documentSortFields } from './documents.contracts';

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_SIGNED_URL_TTL_SECONDS = 300;
export const MAX_ARCHIVE_ENTRIES = 1_000;
export const MAX_ARCHIVE_EXPANSION_RATIO = 100;

const blockedExtensions = new Set([
  'bat',
  'cmd',
  'com',
  'dll',
  'docm',
  'exe',
  'jar',
  'js',
  'msi',
  'pptm',
  'ps1',
  'scr',
  'vbs',
  'xlsm',
]);

const mimeByExtension: Readonly<Record<string, readonly string[]>> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

export interface UploadValidationInput {
  originalFileName: string;
  declaredMimeType: string;
  detectedMimeType: string;
  sizeBytes: number;
  sha256: string;
  magicBytes: readonly number[];
  archiveEntryCount?: number;
  archiveUncompressedBytes?: number;
}

export interface UploadValidationResult {
  valid: boolean;
  safeFileName: string;
  extension: string;
  errors: readonly string[];
}

function extensionOf(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index < 1 ? '' : normalized.slice(index + 1);
}

export function sanitizeDownloadFileName(fileName: string): string {
  const leaf = fileName.replaceAll('\\', '/').split('/').at(-1) ?? 'document';
  const normalized = Array.from(leaf.normalize('NFKC'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        codePoint > 31 &&
        codePoint !== 127 &&
        !['"', "'", ';'].includes(character)
      );
    })
    .join('');
  const safe = normalized
    .replace(/\.{2,}/g, '.')
    .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
    .trim()
    .slice(0, 120);
  return safe && safe !== '.' ? safe : 'document';
}

export function validateUploadFile(
  input: UploadValidationInput,
): UploadValidationResult {
  const errors: string[] = [];
  const safeFileName = sanitizeDownloadFileName(input.originalFileName);
  const extension = extensionOf(safeFileName);
  if (!extension || !mimeByExtension[extension])
    errors.push('EXTENSION_NOT_ALLOWED');
  if (blockedExtensions.has(extension))
    errors.push('EXECUTABLE_OR_MACRO_BLOCKED');
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1)
    errors.push('EMPTY_OR_INVALID_SIZE');
  if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) errors.push('FILE_TOO_LARGE');
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) errors.push('INVALID_SHA256');
  if (input.declaredMimeType !== input.detectedMimeType)
    errors.push('DECLARED_MIME_MISMATCH');
  if (
    mimeByExtension[extension] &&
    !mimeByExtension[extension].includes(input.detectedMimeType)
  )
    errors.push('EXTENSION_MIME_MISMATCH');

  const bytes = input.magicBytes;
  const magicValid =
    (input.detectedMimeType === 'application/pdf' &&
      [0x25, 0x50, 0x44, 0x46].every(
        (value, index) => bytes[index] === value,
      )) ||
    (input.detectedMimeType === 'image/png' &&
      [0x89, 0x50, 0x4e, 0x47].every(
        (value, index) => bytes[index] === value,
      )) ||
    (input.detectedMimeType === 'image/jpeg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (input.detectedMimeType.startsWith('text/') && bytes.length > 0) ||
    (input.detectedMimeType.includes('openxmlformats') &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b);
  if (!magicValid) errors.push('MAGIC_BYTES_MISMATCH');

  if (input.detectedMimeType.includes('openxmlformats')) {
    if ((input.archiveEntryCount ?? 0) > MAX_ARCHIVE_ENTRIES)
      errors.push('ARCHIVE_ENTRY_LIMIT_EXCEEDED');
    const ratio =
      input.sizeBytes > 0
        ? (input.archiveUncompressedBytes ?? 0) / input.sizeBytes
        : Number.POSITIVE_INFINITY;
    if (ratio > MAX_ARCHIVE_EXPANSION_RATIO)
      errors.push('ARCHIVE_BOMB_SUSPECTED');
  }

  return { valid: errors.length === 0, safeFileName, extension, errors };
}

export function validateStorageObjectKey(objectKey: string): boolean {
  return /^documents\/[0-9a-f-]{36}\/v[1-9]\d*\/[0-9a-f-]{36}\.bin$/.test(
    objectKey,
  );
}

export function validateSignedUrlTtl(ttlSeconds: number): boolean {
  return (
    Number.isInteger(ttlSeconds) &&
    ttlSeconds >= 1 &&
    ttlSeconds <= MAX_SIGNED_URL_TTL_SECONDS
  );
}

export function normalizeDocumentListQuery(
  input: Partial<DocumentListQuery>,
): DocumentListQuery {
  const page = Number.isFinite(input.page)
    ? Math.max(1, Math.trunc(input.page!))
    : 1;
  const pageSize = Number.isFinite(input.pageSize)
    ? Math.min(100, Math.max(10, Math.trunc(input.pageSize!)))
    : 25;
  const sortBy = documentSortFields.includes(input.sortBy as DocumentSortField)
    ? (input.sortBy as DocumentSortField)
    : 'updatedAt';
  return {
    search: input.search?.trim().slice(0, 120) ?? '',
    category: input.category ?? 'ALL',
    sourceModule: input.sourceModule?.trim().slice(0, 60) || null,
    sourceEntityId: input.sourceEntityId?.trim().slice(0, 100) || null,
    issuerLegalEntityReference:
      input.issuerLegalEntityReference?.trim().slice(0, 100) || null,
    confidentiality: input.confidentiality ?? 'ALL',
    scanStatus: input.scanStatus ?? 'ALL',
    archiveStatus: input.archiveStatus ?? 'ALL',
    createdBy: input.createdBy?.trim().slice(0, 100) || null,
    createdFrom: input.createdFrom ?? null,
    createdTo: input.createdTo ?? null,
    sortBy,
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page,
    pageSize,
  };
}
