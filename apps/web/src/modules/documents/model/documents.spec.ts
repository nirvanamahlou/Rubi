import { describe, expect, it } from 'vitest';

import {
  defaultDocumentQuery,
  documentCategories,
  filterPreviewDocuments,
  normalizeDocumentQuery,
  paginatePreviewDocuments,
  previewDocuments,
  shouldBlockPreviewDownload,
  stateDescription,
} from './documents';

describe('documents frontend model', () => {
  it('uses only synthetic preview identifiers', () => {
    expect(
      previewDocuments.every(
        (document) =>
          document.id.startsWith('preview-document-') &&
          document.sourceRecord.startsWith('preview-'),
      ),
    ).toBe(true);
  });

  it('supports every requested extensible category', () => {
    expect(documentCategories).toHaveLength(10);
    expect(documentCategories).toEqual(
      expect.arrayContaining([
        'قرارداد فروش',
        'بلیت',
        'واچر هتل',
        'بیمه‌نامه',
        'Manifest',
        'اسناد مالی',
        'مدارک مشتری و مسافر',
        'منابع انسانی',
        'بازاریابی',
        'اسناد عمومی',
      ]),
    );
  });

  it('normalizes server-pagination proposal limits', () => {
    expect(
      normalizeDocumentQuery({
        search: '  قرارداد  ',
        page: -4,
        pageSize: 500,
      }),
    ).toMatchObject({ search: 'قرارداد', page: 1, pageSize: 50 });
  });

  it('filters, sorts and paginates preview records', () => {
    const query = normalizeDocumentQuery({
      confidentiality: 'CONFIDENTIAL',
      sortBy: 'sizeBytes',
      sortDirection: 'desc',
    });
    const filtered = filterPreviewDocuments(previewDocuments, query);
    expect(filtered).toHaveLength(2);
    expect(paginatePreviewDocuments(filtered, 1, 1)).toHaveLength(1);
  });

  it('blocks every synthetic download and explains scan/quarantine gates', () => {
    expect(shouldBlockPreviewDownload(previewDocuments[0]!)).toBe(
      'PREVIEW_NO_SIGNED_URL',
    );
    expect(shouldBlockPreviewDownload(previewDocuments[1]!)).toBe(
      'SCAN_REQUIRED',
    );
    expect(shouldBlockPreviewDownload(previewDocuments[2]!)).toBe(
      'QUARANTINED',
    );
    expect(shouldBlockPreviewDownload(previewDocuments[3]!)).toBe(
      'SENSITIVE_PERMISSION_REQUIRED',
    );
    expect(shouldBlockPreviewDownload(previewDocuments[4]!)).toBe(
      'DOCUMENT_ARCHIVED',
    );
  });

  it('defines all required UI state copy', () => {
    for (const state of [
      'preview',
      'loading',
      'empty',
      'error',
      'unauthorized',
      'forbidden',
      'conflict',
    ] as const) {
      expect(stateDescription(state)).not.toHaveLength(0);
    }
    expect(defaultDocumentQuery.archiveStatus).toBe('ALL');
  });
});
