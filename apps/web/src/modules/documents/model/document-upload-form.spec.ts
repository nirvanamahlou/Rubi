import { describe, expect, it } from 'vitest';

import {
  emptyDocumentUploadValues,
  documentUploadBranchChoices,
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
  it('keeps both HR organizations even when they share one IAM branch', () => {
    expect(
      documentUploadBranchChoices(
        {
          ...options,
          organizationBranches: [
            { id: 'hr-a', branchId: 'branch-1', name: 'جهان باستان' },
            { id: 'hr-b', branchId: 'branch-1', name: 'نیایش سیر' },
          ],
        },
        options.branches,
      ),
    ).toEqual([
      { id: 'hr-a', branchId: 'branch-1', name: 'جهان باستان' },
      { id: 'hr-b', branchId: 'branch-1', name: 'نیایش سیر' },
    ]);
  });
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
          sourceRelationId: 'relation-1',
          validUntil: '2027-01-01',
        },
        true,
        true,
      ),
    ).toBeNull();
  });

  it('allows an unlinked document in the main upload form', () => {
    const values = {
      ...hydrateDocumentUploadDefaults(
        { ...emptyDocumentUploadValues },
        options,
        options.branches,
      ),
      title: 'یادداشت شخصی',
    };
    expect(validateDocumentUpload(values, true, false)).toBeNull();
  });

  it('requires six numeric digits when the upload is confidential', () => {
    const values = {
      ...hydrateDocumentUploadDefaults(
        { ...emptyDocumentUploadValues },
        options,
        options.branches,
      ),
      title: 'قرارداد محرمانه',
      sourceRelationId: 'relation-1',
      confidentiality: 'CONFIDENTIAL',
    };
    expect(validateDocumentUpload(values, true, false, true)).toBe(
      'برای سند محرمانه، کد شش‌رقمی تعیین کنید.',
    );
    expect(
      validateDocumentUpload(
        { ...values, confidentialAccessCode: '573921' },
        true,
        false,
        true,
      ),
    ).toBeNull();
  });
});
