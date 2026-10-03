import {
  b2bSignatoryIssue,
  type B2bSignatoryInputV1,
  type DocumentListItemV1,
  type IamPermissionCode,
  type MasterDataRecord,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  canAttachOrganizationDocument,
  formatOrganizationDocumentExpiry,
  loadOrganizationSignatoryProofs,
  organizationDocumentForm,
  organizationDocumentQuery,
  resolveOrganizationSignatoryProof,
  type OrganizationDocumentInput,
  type OrganizationDocumentOptions,
} from './organization-documents';

const organization = {
  id: 'organization-1',
  resource: 'organizations',
  code: 'ORG_TEST',
} as MasterDataRecord;
const permissions: IamPermissionCode[] = [
  'documents.list',
  'documents.upload',
  'documents.organization.read',
];
const options: OrganizationDocumentOptions = {
  currentUserId: 'owner',
  branches: [{ id: 'branch', code: 'B1', name: 'شعبه آزمون' }],
  owners: [{ id: 'owner', displayName: 'مالک آزمون' }],
  categories: [{ id: 'category', code: 'ORG', name: 'سازمان' }],
  documentTypes: [
    {
      id: 'type',
      code: 'LICENSE',
      name: 'مجوز',
      domain: 'ORGANIZATION',
      defaultConfidentiality: 'CONFIDENTIAL',
      requiresExpiry: true,
      maxFileSizeBytes: 100,
      allowedMimeTypes: ['application/pdf'],
    },
  ],
  uploadPolicy: {
    maxFileSizeBytes: 100,
    allowedMimeTypes: ['application/pdf'],
    antivirusAvailable: true,
  },
};
const input: OrganizationDocumentInput = {
  title: 'مجوز آزمایشی',
  branchId: 'branch',
  categoryId: 'category',
  documentTypeId: 'type',
  validUntil: '2026-12-01',
  requiresStepUpVerification: true,
};
const file = () =>
  new File(['%PDF-test'], 'synthetic.pdf', { type: 'application/pdf' });
const proofPermissions: IamPermissionCode[] = [
  'documents.list',
  'documents.organization.read',
  'documents.metadata.read',
];
const proof = {
  id: 'document-1',
  branchId: 'branch',
  archiveStatus: 'ACTIVE',
  isIncomplete: false,
  validUntil: '2027-01-01T00:00:00.000Z',
  currentVersion: { id: 'version-1', scanStatus: 'CLEAN' },
} as DocumentListItemV1;

describe('organization Documents public integration', () => {
  it('locks the query to canonical identity, branch and organization domain', () => {
    expect(
      organizationDocumentQuery('organization-1', 'branch', 3, 'EXPIRED'),
    ).toMatchObject({
      sourceModule: 'master-data',
      sourceEntityType: 'organizations',
      sourceEntityId: 'organization-1',
      branchId: 'branch',
      domain: 'ORGANIZATION',
      archiveStatus: 'ACTIVE',
      page: 3,
      pageSize: 20,
      validity: 'EXPIRED',
    });
    expect(() => organizationDocumentQuery('organization-1', '')).toThrow();
  });
  it('loads signatory proofs only with the complete public-reference capability', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [proof],
      meta: { page: 2, pageSize: 100, total: 1, totalPages: 2 },
    });
    await expect(
      loadOrganizationSignatoryProofs(
        'organization-1',
        'branch',
        2,
        proofPermissions,
        list,
      ),
    ).resolves.toMatchObject({ data: [proof] });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'master-data',
        sourceEntityType: 'organizations',
        sourceEntityId: 'organization-1',
        branchId: 'branch',
        domain: 'ORGANIZATION',
        page: 2,
        pageSize: 100,
      }),
    );

    for (const permission of proofPermissions) {
      const deniedList = vi.fn();
      await expect(
        loadOrganizationSignatoryProofs(
          'organization-1',
          'branch',
          1,
          proofPermissions.filter((item) => item !== permission),
          deniedList,
        ),
      ).resolves.toBeNull();
      expect(deniedList).not.toHaveBeenCalled();
    }
    expect(canAttachOrganizationDocument(permissions)).toBe(false);
  });
  it('pins the selected clean proof version in a valid saved form', () => {
    const selected = resolveOrganizationSignatoryProof(
      [proof],
      proof.id,
      Date.parse('2026-10-03T00:00:00.000Z'),
    );
    expect(selected).toEqual({
      documentId: 'document-1',
      documentVersionId: 'version-1',
    });
    const saved: B2bSignatoryInputV1 = {
      branchId: 'branch',
      contactId: 'contact-1',
      documentTypes: ['FRAMEWORK_AGREEMENT'],
      authorityLimit: '100',
      currencyCode: 'IRR',
      validFrom: '2026-10-03',
      validTo: null,
      ...selected,
      isActive: true,
      notes: '',
    };
    expect(b2bSignatoryIssue(saved)).toBeUndefined();
    expect(b2bSignatoryIssue({ ...saved, currencyCode: null })).toContain(
      'ارز',
    );
  });
  it.each([
    { currentVersion: { id: 'version-1', scanStatus: 'PENDING_SCAN' } },
    { isIncomplete: true },
    { validUntil: '2026-01-01T00:00:00.000Z' },
    { validUntil: 'not-a-date' },
  ])('fails closed for an ineligible proof %j', (patch) => {
    expect(
      resolveOrganizationSignatoryProof(
        [{ ...proof, ...patch } as DocumentListItemV1],
        proof.id,
        Date.parse('2026-10-03T00:00:00.000Z'),
      ),
    ).toEqual({
      documentId: null,
      documentVersionId: null,
      isActive: false,
    });
  });
  it('uses owner classification and existing identity while retaining step-up and UTC expiry', () => {
    const form = organizationDocumentForm(
      organization,
      input,
      file(),
      options,
      permissions,
    );
    expect(
      Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file')),
    ).toEqual({
      title: input.title,
      documentTypeId: 'type',
      categoryId: 'category',
      branchId: 'branch',
      ownerUserId: 'owner',
      confidentiality: 'CONFIDENTIAL',
      sourceModule: 'master-data',
      sourceEntityType: 'organizations',
      sourceEntityId: 'organization-1',
      sourceDisplayLabel: 'ORG_TEST',
      requiresStepUpVerification: 'true',
      validUntil: '2026-12-01T20:29:59.999Z',
    });
  });
  it('keeps and displays expiry on the selected Tehran day without a date shift', () => {
    const form = organizationDocumentForm(
      organization,
      { ...input, validUntil: '2026-10-02' },
      file(),
      options,
      permissions,
    );
    expect(form.get('validUntil')).toBe('2026-10-02T20:29:59.999Z');
    expect(
      formatOrganizationDocumentExpiry(String(form.get('validUntil'))),
    ).toBe('۱۴۰۵/۷/۱۰');
    const expiry = new Date(String(form.get('validUntil')));
    const day = (date: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    expect(day(expiry)).toBe('2026-10-02');
    expect(day(new Date(expiry.getTime() + 1))).toBe('2026-10-03');
  });
  it.each(permissions)(
    'denies missing grant %s before creating a request',
    (permission) => {
      expect(() =>
        organizationDocumentForm(
          organization,
          input,
          file(),
          options,
          permissions.filter((item) => item !== permission),
        ),
      ).toThrow('مجوز');
    },
  );
  it.each([
    { branchId: 'foreign' },
    { documentTypeId: 'foreign' },
    { categoryId: 'foreign' },
    { validUntil: '' },
    { validUntil: '2026-02-30' },
  ])('rejects invalid or foreign input %j', (patch) => {
    expect(() =>
      organizationDocumentForm(
        organization,
        { ...input, ...patch },
        file(),
        options,
        permissions,
      ),
    ).toThrow();
  });
  it('rejects another document domain, oversized content and unapproved MIME', () => {
    expect(() =>
      organizationDocumentForm(
        organization,
        input,
        file(),
        {
          ...options,
          documentTypes: [
            { ...options.documentTypes[0]!, domain: 'CUSTOMER_IDENTITY' },
          ],
        },
        permissions,
      ),
    ).toThrow();
    expect(() =>
      organizationDocumentForm(
        organization,
        input,
        new File(['x'.repeat(101)], 'test.pdf', { type: 'application/pdf' }),
        options,
        permissions,
      ),
    ).toThrow('اندازه');
    expect(() =>
      organizationDocumentForm(
        organization,
        input,
        new File(['x'], 'test.html', { type: 'text/html' }),
        options,
        permissions,
      ),
    ).toThrow('نوع فایل');
  });
});
