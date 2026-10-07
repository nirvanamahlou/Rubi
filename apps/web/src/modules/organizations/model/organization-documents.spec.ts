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
  awaitOrganizationSignatoryProof,
  formatOrganizationDocumentExpiry,
  loadOrganizationSignatoryProofs,
  mergeOrganizationSignatoryProof,
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
  confidentialAccessCode: '573921',
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
  type: { domain: 'ORGANIZATION' },
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
      confidentialAccessCode: '573921',
      sourceModule: 'master-data',
      sourceEntityType: 'organizations',
      sourceEntityId: 'organization-1',
      sourceDisplayLabel: 'ORG_TEST',
      requiresStepUpVerification: 'true',
      validUntil: '2026-12-01T20:29:59.999Z',
    });
  });
  it('sends optional financial notes with the uploaded document and bounds their length', () => {
    const form = organizationDocumentForm(
      organization,
      { ...input, description: '  رسید پرداخت مرحله نخست  ' },
      file(),
      options,
      permissions,
    );
    expect(form.get('description')).toBe('رسید پرداخت مرحله نخست');
    expect(() =>
      organizationDocumentForm(
        organization,
        { ...input, description: 'x'.repeat(1001) },
        file(),
        options,
        permissions,
      ),
    ).toThrow('۱۰۰۰');
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
  it('requires the existing six-digit access code for a confidential type', () => {
    const inputWithoutCode = { ...input };
    delete inputWithoutCode.confidentialAccessCode;
    for (const confidentialAccessCode of [undefined, '', '12345', '۱۲۳۴۵۶'])
      expect(() =>
        organizationDocumentForm(
          organization,
          confidentialAccessCode === undefined
            ? inputWithoutCode
            : { ...inputWithoutCode, confidentialAccessCode },
          file(),
          options,
          permissions,
        ),
      ).toThrow('کد شش‌رقمی');
  });
  it('polls a new proof within the bounded schedule and pins only its clean current version', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            ...proof,
            currentVersion: {
              ...proof.currentVersion,
              scanStatus: 'PENDING_SCAN',
            },
          },
        ],
        meta: { totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...proof,
            currentVersion: {
              ...proof.currentVersion,
              scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
            },
          },
        ],
        meta: { totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [proof],
        meta: { totalPages: 1 },
      });
    const wait = vi.fn().mockResolvedValue(true);
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions,
        list,
        new AbortController().signal,
        [2_000, 4_000],
        wait,
      ),
    ).resolves.toEqual({
      state: 'ready',
      documentId: proof.id,
      documentVersionId: proof.currentVersion.id,
    });
    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([2_000, 4_000]);
    expect(list).toHaveBeenCalledTimes(3);
  });
  it('finds the exact uploaded proof beyond the first authorized page', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: [],
        meta: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [proof],
        meta: { totalPages: 2 },
      });
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions,
        list,
        new AbortController().signal,
        [],
        vi.fn(),
      ),
    ).resolves.toMatchObject({ state: 'ready' });
    expect(list.mock.calls.map(([query]) => query.page)).toEqual([1, 2]);
  });
  it('fails closed for denied, terminal and exhausted proof polling', async () => {
    const deniedList = vi.fn();
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions.filter((item) => item !== 'documents.metadata.read'),
        deniedList,
        new AbortController().signal,
        [],
        vi.fn(),
      ),
    ).resolves.toEqual({ state: 'denied' });
    expect(deniedList).not.toHaveBeenCalled();

    const terminalList = vi.fn().mockResolvedValue({
      data: [
        {
          ...proof,
          currentVersion: {
            ...proof.currentVersion,
            scanStatus: 'INFECTED',
          },
        },
      ],
      meta: { totalPages: 1 },
    });
    const terminalWait = vi.fn();
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions,
        terminalList,
        new AbortController().signal,
        [2_000],
        terminalWait,
      ),
    ).resolves.toMatchObject({ state: 'rejected' });
    expect(terminalWait).not.toHaveBeenCalled();

    const pendingList = vi.fn().mockResolvedValue({
      data: [],
      meta: { totalPages: 1 },
    });
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions,
        pendingList,
        new AbortController().signal,
        [2_000],
        vi.fn().mockResolvedValue(true),
      ),
    ).resolves.toEqual({ state: 'pending' });
    expect(pendingList).toHaveBeenCalledTimes(2);
  });
  it('aborts a delayed proof result and preserves concurrent signatory edits when merging', async () => {
    const controller = new AbortController();
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          ...proof,
          currentVersion: {
            ...proof.currentVersion,
            scanStatus: 'PENDING_SCAN',
          },
        },
      ],
      meta: { totalPages: 1 },
    });
    const wait = vi.fn().mockImplementation(async () => {
      controller.abort();
      return false;
    });
    await expect(
      awaitOrganizationSignatoryProof(
        'organization-1',
        'branch',
        proof.id,
        proofPermissions,
        list,
        controller.signal,
        [2_000],
        wait,
      ),
    ).resolves.toEqual({ state: 'aborted' });
    expect(list).toHaveBeenCalledTimes(1);

    expect(
      mergeOrganizationSignatoryProof(
        { contactId: 'new-contact', notes: 'ویرایش هم‌زمان' },
        { documentId: 'document-2', documentVersionId: 'version-2' },
      ),
    ).toEqual({
      contactId: 'new-contact',
      notes: 'ویرایش هم‌زمان',
      documentId: 'document-2',
      documentVersionId: 'version-2',
    });
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
