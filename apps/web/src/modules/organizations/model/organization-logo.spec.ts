import type {
  DocumentDetailResponseV1,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentsApi } from '@/modules/documents/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  ORGANIZATION_LOGO_MAX_BYTES,
  organizationLogoPreview,
  saveOrganizationLogo,
} from './organization-logo';

const organization = {
  id: '11111111-1111-4111-8111-111111111111',
  resource: 'organizations',
  code: 'ORG_LOGO_TEST',
  name: 'سازمان آزمون',
  status: 'active',
  version: 7,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  attributes: { roleCodes: 'SUPPLIER,AGENCY,CORPORATE_CUSTOMER' },
} as MasterDataRecord;
const uploadGrants: IamPermissionCode[] = [
  'master_data.update',
  'documents.upload',
  'documents.list',
  'documents.brand.read',
];
const readGrants: IamPermissionCode[] = [
  'documents.metadata.read',
  'documents.brand.read',
  'documents.file.read',
];
const file = () => new File(['synthetic'], 'logo.png', { type: 'image/png' });
const detail = () =>
  ({
    data: {
      id: 'logo-document',
      type: { domain: 'BRAND' },
      archiveStatus: 'ACTIVE',
      confidentiality: 'INTERNAL',
      requiresStepUpVerification: false,
      capabilities: { viewFile: true },
      currentVersion: { scanStatus: 'CLEAN' },
    },
  }) as DocumentDetailResponseV1;
afterEach(() => vi.restoreAllMocks());

describe('organization header logo save', () => {
  it.each(uploadGrants)('requires %s before any owner write', (grant) => {
    const persist = vi.spyOn(masterDataApi, 'persistWithLogo');
    expect(() =>
      saveOrganizationLogo(
        organization,
        { kind: 'replace', file: file() },
        uploadGrants.filter((item) => item !== grant),
      ),
    ).toThrow('مجوز');
    expect(persist).not.toHaveBeenCalled();
  });
  it.each([
    new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }),
    new File([], 'empty.png', { type: 'image/png' }),
    new File([new Uint8Array(ORGANIZATION_LOGO_MAX_BYTES + 1)], 'large.png', {
      type: 'image/png',
    }),
  ])(
    'rejects unsupported, empty and oversized files before writes',
    (invalid) => {
      const persist = vi.spyOn(masterDataApi, 'persistWithLogo');
      expect(() =>
        saveOrganizationLogo(
          organization,
          { kind: 'replace', file: invalid },
          uploadGrants,
        ),
      ).toThrow();
      expect(persist).not.toHaveBeenCalled();
    },
  );
  it.each([{ resource: 'branches' }, { id: '' }, { version: 0 }])(
    'rejects unsaved or foreign records (%j)',
    (patch) => {
      const persist = vi.spyOn(masterDataApi, 'persistWithLogo');
      expect(() =>
        saveOrganizationLogo(
          { ...organization, ...patch } as MasterDataRecord,
          { kind: 'remove' },
          uploadGrants,
        ),
      ).toThrow('ذخیره یا تازه‌سازی');
      expect(persist).not.toHaveBeenCalled();
    },
  );
  it('preserves all roles and optimistic version through the public owner, including partial-save warnings', async () => {
    const result = { data: organization, warning: 'بارگذاری کامل نشد' };
    const persist = vi
      .spyOn(masterDataApi, 'persistWithLogo')
      .mockResolvedValue(result);
    const change = { kind: 'replace' as const, file: file() };
    await expect(
      saveOrganizationLogo(organization, change, uploadGrants),
    ).resolves.toBe(result);
    expect(persist).toHaveBeenCalledExactlyOnceWith({
      resource: 'organizations',
      existing: organization,
      values: { roleCodes: 'SUPPLIER,AGENCY,CORPORATE_CUSTOMER' },
      title: 'لوگوی سازمان سازمان آزمون',
      logoChange: change,
    });
  });
  it('uses the owner detach/archive workflow for removal and requires edit permission', async () => {
    const persist = vi
      .spyOn(masterDataApi, 'persistWithLogo')
      .mockResolvedValue({ data: organization });
    expect(() =>
      saveOrganizationLogo(organization, { kind: 'remove' }, []),
    ).toThrow('مجوز');
    expect(persist).not.toHaveBeenCalled();
    await saveOrganizationLogo(organization, { kind: 'remove' }, [
      'master_data.update',
    ]);
    expect(persist).toHaveBeenCalledOnce();
    expect(persist.mock.calls[0]?.[0].logoChange).toEqual({ kind: 'remove' });
  });
});

describe('organization header logo preview', () => {
  it.each(readGrants)(
    'requires %s before reading metadata or file',
    async (grant) => {
      const metadata = vi.spyOn(documentsApi, 'detail');
      const preview = vi.spyOn(documentsApi, 'preview');
      const result = await organizationLogoPreview(
        'logo-document',
        readGrants.filter((item) => item !== grant),
        new AbortController().signal,
      );
      expect(result).toHaveProperty('reason');
      expect(metadata).not.toHaveBeenCalled();
      expect(preview).not.toHaveBeenCalled();
    },
  );
  it.each([
    { type: { domain: 'ORGANIZATION' } },
    { archiveStatus: 'ARCHIVED' },
    { capabilities: { viewFile: false } },
    { currentVersion: { scanStatus: 'PENDING' } },
    { currentVersion: { scanStatus: 'INFECTED' } },
    { requiresStepUpVerification: true },
    { confidentiality: 'CONFIDENTIAL' },
  ])(
    'does not request file bytes when owner metadata restricts preview (%j)',
    async (patch) => {
      const response = detail();
      Object.assign(response.data, patch);
      vi.spyOn(documentsApi, 'detail').mockResolvedValue(response);
      const preview = vi.spyOn(documentsApi, 'preview');
      await expect(
        organizationLogoPreview(
          'logo-document',
          readGrants,
          new AbortController().signal,
        ),
      ).resolves.toHaveProperty('reason');
      expect(preview).not.toHaveBeenCalled();
    },
  );
  it('loads a clean permitted brand image through authenticated Documents preview', async () => {
    const metadata = vi
      .spyOn(documentsApi, 'detail')
      .mockResolvedValue(detail());
    const blob = new Blob(['synthetic'], { type: 'image/png' });
    const preview = vi
      .spyOn(documentsApi, 'preview')
      .mockResolvedValue({ blob, disposition: null });
    const signal = new AbortController().signal;
    await expect(
      organizationLogoPreview('logo-document', readGrants, signal),
    ).resolves.toEqual({ blob });
    expect(metadata).toHaveBeenCalledExactlyOnceWith('logo-document');
    expect(preview).toHaveBeenCalledExactlyOnceWith(
      'logo-document',
      undefined,
      signal,
    );
  });
  it('does not expose an unexpected file returned by the owner as a logo', async () => {
    vi.spyOn(documentsApi, 'detail').mockResolvedValue(detail());
    vi.spyOn(documentsApi, 'preview').mockResolvedValue({
      blob: new Blob(['%PDF-test'], { type: 'application/pdf' }),
      disposition: null,
    });
    await expect(
      organizationLogoPreview(
        'logo-document',
        readGrants,
        new AbortController().signal,
      ),
    ).resolves.toHaveProperty('reason');
  });
  it('does not start file access after navigation cancels the metadata lookup', async () => {
    const controller = new AbortController();
    vi.spyOn(documentsApi, 'detail').mockImplementation(async () => {
      controller.abort();
      return detail();
    });
    const preview = vi.spyOn(documentsApi, 'preview');
    await expect(
      organizationLogoPreview('logo-document', readGrants, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(preview).not.toHaveBeenCalled();
  });
});
