import { afterEach, describe, expect, it, vi } from 'vitest';

import { MasterDataApiError, masterDataApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('master data browser client', () => {
  it('deletes only the requested record with credentials and its expected version', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const response = {
      data: { id: 'bank/id', resource: 'banks', deleted: true },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    await expect(masterDataApi.remove('banks', 'bank/id', 3)).resolves.toEqual(
      response,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/master-data/banks/bank%2Fid',
      expect.objectContaining({
        credentials: 'include',
        method: 'DELETE',
        body: JSON.stringify({ version: 3 }),
      }),
    );
  });

  it('preserves a dependency conflict instead of pretending deletion succeeded', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { message: 'رکورد دارای وابستگی است.' } }),
      }),
    );
    await expect(
      masterDataApi.remove('banks', 'bank-id', 1),
    ).rejects.toMatchObject({
      status: 409,
      message: 'رکورد دارای وابستگی است.',
    });
  });

  it('sends credentialed requests to the configured versioned API', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, pageSize: 25, total: 0 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await masterDataApi.list('countries', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/master-data/countries?'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('downloads a credentialed XLSX file from the direct endpoint', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const blob = new Blob(['xlsx']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === 'content-disposition'
            ? 'attachment; filename="master-data-countries.xlsx"'
            : null,
      },
      blob: async () => blob,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await masterDataApi.downloadExcel({
      resource: 'countries',
      format: 'xlsx',
      filters: {
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
      },
      columns: ['code', 'name', 'status', 'updatedAt'],
      locale: 'fa-IR',
      timezone: 'Asia/Tehran',
    });

    expect(result).toEqual({ blob, fileName: 'master-data-countries.xlsx' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/master-data/exports/xlsx/download',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('preserves forbidden status for the permission state', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'دسترسی کافی نیست.' } }),
      }),
    );

    await expect(
      masterDataApi.detail('countries', 'record-id'),
    ).rejects.toMatchObject({
      status: 403,
      message: 'دسترسی کافی نیست.',
    });
  });

  it('rejects temporary logo source ids before calling the backend', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });

    await expect(
      masterDataApi.uploadLogo({
        file,
        resource: 'organizations',
        recordId: 'draft-client-id',
        title: 'لوگو',
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates the real record before the server uploads and attaches the logo', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      resource: 'organizations',
      code: 'AGENCY',
      name: 'آژانس',
      status: 'active',
      attributes: {},
      version: 1,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    } as const;
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValue({ data: created });
    const upload = vi.spyOn(masterDataApi, 'uploadLogo').mockResolvedValue({
      data: {
        ...created,
        attributes: { logoFileReference: 'document-id' },
        version: 2,
      },
    });
    const update = vi.spyOn(masterDataApi, 'update');
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });

    await masterDataApi.persistWithLogo({
      resource: 'organizations',
      values: { legalName: 'آژانس' },
      logoChange: { kind: 'replace', file },
      title: 'لوگوی آژانس',
    });

    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      upload.mock.invocationCallOrder[0]!,
    );
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: created.id, version: 1 }),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('sends logo file and optimistic version only to the bounded Master Data endpoint', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const file = new File(['same-logo'], 'logo.png', { type: 'image/png' });
    const result = {
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        resource: 'airlines',
        version: 4,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => result,
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      masterDataApi.uploadLogo({
        file,
        resource: 'airlines',
        recordId: '11111111-1111-4111-8111-111111111111',
        title: 'لوگوی ایرلاین',
        version: 3,
      }),
    ).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/v1/master-data/airlines/11111111-1111-4111-8111-111111111111/logo',
    );
    const form = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.get('title')).toBe('لوگوی ایرلاین');
    expect(form.get('version')).toBe('3');
  });

  it('keeps the saved record and reports an actionable upload failure', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      resource: 'organizations',
      code: 'AGENCY',
      name: 'آژانس',
      status: 'active',
      attributes: {},
      version: 1,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    } as const;
    vi.spyOn(masterDataApi, 'create').mockResolvedValue({ data: created });
    vi.spyOn(masterDataApi, 'uploadLogo').mockRejectedValue(
      new Error('اسکن فایل در دسترس نیست.'),
    );

    await expect(
      masterDataApi.persistWithLogo({
        resource: 'organizations',
        values: { legalName: 'آژانس' },
        logoChange: {
          kind: 'replace',
          file: new File(['logo'], 'logo.png', { type: 'image/png' }),
        },
        title: 'لوگوی آژانس',
      }),
    ).resolves.toMatchObject({
      data: { id: created.id },
      warning: expect.stringContaining('بدون لوگو'),
    });
  });

  it('surfaces a concurrent logo attach as a retryable warning', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      resource: 'organizations',
      code: 'AGENCY',
      name: 'آژانس',
      status: 'active',
      attributes: {},
      version: 1,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    } as const;
    vi.spyOn(masterDataApi, 'create').mockResolvedValue({ data: created });
    vi.spyOn(masterDataApi, 'uploadLogo').mockRejectedValue(
      new MasterDataApiError('هم‌زمانی', 409),
    );

    const result = await masterDataApi.persistWithLogo({
      resource: 'organizations',
      values: { legalName: 'آژانس' },
      logoChange: {
        kind: 'replace',
        file: new File(['logo'], 'logo.png', { type: 'image/png' }),
      },
      title: 'لوگوی آژانس',
    });

    expect(result.warning).toContain('تغییر هم‌زمان');
  });

  it('stores an XLSX manifest template in Documents with canonical travel metadata', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const file = new File(['PK\u0003\u0004'], 'antalya.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            currentUserId: 'user-id',
            branches: [{ id: 'branch-id', name: 'مرکزی' }],
            owners: [{ id: 'user-id', displayName: 'کاربر' }],
            categories: [
              {
                id: 'category-id',
                code: 'TRAVEL_RESERVATIONS',
                name: 'سفر',
              },
            ],
            documentTypes: [
              {
                id: 'type-id',
                code: 'MANIFEST',
                name: 'Manifest',
                domain: 'TRAVEL',
                allowedMimeTypes: [file.type],
                maxFileSizeBytes: 1_000_000,
              },
            ],
            uploadPolicy: {
              maxFileSizeBytes: 1_000_000,
              allowedMimeTypes: [file.type],
              antivirusAvailable: true,
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'manifest-document-id',
            currentVersion: { scanStatus: 'CLEAN' },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      masterDataApi.uploadManifestTemplateFile({
        file,
        recordId: '11111111-1111-4111-8111-111111111111',
        title: 'ایران ایرتور · آنتالیا',
      }),
    ).resolves.toEqual({
      id: 'manifest-document-id',
      scanStatus: 'CLEAN',
      reused: false,
    });
    expect(fetchMock.mock.calls[1]?.[0]).toContain('domain=TRAVEL');
    const uploadRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const body = uploadRequest.body as FormData;
    expect(body.get('documentTypeId')).toBe('type-id');
    expect(body.get('categoryId')).toBe('category-id');
    expect(body.get('sourceEntityType')).toBe('manifest-templates');
    expect(body.get('file')).toBe(file);
  });

  it('creates the manifest draft before upload and then attaches its document id', async () => {
    const created = {
      id: '11111111-1111-4111-8111-111111111111',
      resource: 'manifest-templates',
      code: 'MANIFEST_TEST',
      name: 'antalya',
      status: 'active',
      attributes: {
        airlineId: 'airline-id',
        destinationCityId: 'city-id',
        publicationStatus: 'DRAFT',
      },
      version: 1,
      createdAt: '2026-09-12T00:00:00.000Z',
      updatedAt: '2026-09-12T00:00:00.000Z',
    } as const;
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValue({ data: created });
    const upload = vi
      .spyOn(masterDataApi, 'uploadManifestTemplateFile')
      .mockResolvedValue({
        id: 'manifest-document-id',
        scanStatus: 'CLEAN',
        reused: false,
      });
    const update = vi.spyOn(masterDataApi, 'update').mockResolvedValue({
      data: { ...created, version: 2 },
    });
    const file = new File(['PK'], 'antalya.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await masterDataApi.persistManifestTemplate({
      values: {
        name: 'antalya',
        airlineId: 'airline-id',
        destinationCityId: 'city-id',
      },
      file,
      title: 'قالب آنتالیا',
    });

    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      upload.mock.invocationCallOrder[0]!,
    );
    expect(update).toHaveBeenCalledWith('manifest-templates', created.id, {
      values: { fileReferenceId: 'manifest-document-id' },
      version: 1,
    });
  });
});
