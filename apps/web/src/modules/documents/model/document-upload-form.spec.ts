import { describe, expect, it } from 'vitest';

import {
  emptyDocumentUploadValues,
  hydrateDocumentUploadDefaults,
  validateDocumentUpload,
} from './document-upload-form';

const options = {
  currentUserId: 'user-1',
  branches: [{ id: 'branch-1', code: 'TEH', name: 'تهران' }],
  documentTypes: [
    {
      id: 'type-1',
      code: 'CONTRACT',
      name: 'قرارداد',
      domain: 'SALES' as const,
      defaultConfidentiality: 'INTERNAL' as const,
      allowedMimeTypes: ['image/png'],
      maxFileSizeBytes: 1_000_000,
      requiresExpiry: true,
    },
  ],
  categories: [{ id: 'category-1', code: 'SALES', name: 'فروش' }],
  owners: [{ id: 'owner-1', displayName: 'نیروانا' }],
  uploadPolicy: {
    maxFileSizeBytes: 1_000_000,
    allowedMimeTypes: ['image/png'],
    antivirusAvailable: true,
  },
};

describe('Documents upload form state', () => {
  it('hydrates controlled dropdown values from one authenticated options response', () => {
    expect(
      hydrateDocumentUploadDefaults(
        { ...emptyDocumentUploadValues },
        options,
        options.branches,
      ),
    ).toMatchObject({
      documentTypeId: 'type-1',
      categoryId: 'category-1',
      branchId: 'branch-1',
      ownerUserId: 'owner-1',
    });
  });

  it('preserves user choices when options refresh', () => {
    const selected = {
      ...emptyDocumentUploadValues,
      documentTypeId: 'chosen-type',
      categoryId: 'chosen-category',
      branchId: 'chosen-branch',
      ownerUserId: 'chosen-owner',
    };
    expect(
      hydrateDocumentUploadDefaults(selected, options, options.branches),
    ).toMatchObject(selected);
  });

  it('requires every non-native dropdown and an expiry for expiry-aware types', () => {
    const hydrated = hydrateDocumentUploadDefaults(
      { ...emptyDocumentUploadValues },
      options,
      options.branches,
    );
    expect(validateDocumentUpload(hydrated, true, true)).toBe(
      'عنوان سند را وارد کنید.',
    );
    expect(
      validateDocumentUpload(
        {
          ...hydrated,
          title: 'قرارداد آزمایشی',
          sourceModule: 'sales',
          sourceEntityType: 'contract',
          sourceEntityId: 'synthetic-1',
          sourceDisplayLabel: 'پرونده آزمایشی',
          validUntil: '2027-01-01',
        },
        true,
        true,
      ),
    ).toBeNull();
  });
});
