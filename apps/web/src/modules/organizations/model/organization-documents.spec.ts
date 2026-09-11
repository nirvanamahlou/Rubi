import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import {
  organizationDocumentForm,
  organizationDocumentQuery,
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
  it('keeps expiry on the selected Tehran day through the last millisecond', () => {
    const form = organizationDocumentForm(
      organization,
      { ...input, validUntil: '2026-10-02' },
      file(),
      options,
      permissions,
    );
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
