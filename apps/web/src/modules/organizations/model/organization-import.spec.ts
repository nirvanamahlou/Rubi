import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  importOrganizations,
  previewOrganizations,
  syntheticOrganizations,
  validateOrganizationRows,
  type OrganizationPreviewRow,
} from './organization-import';
afterEach(() => vi.restoreAllMocks());
describe('organization import boundaries', () => {
  it('rejects an overlong combined partial address before creating an identity', () => {
    const [row] = validateOrganizationRows([
      { ...syntheticOrganizations[0]!, city: '', addressLine: 'x'.repeat(500) },
    ]);
    expect(row?.reviewFields).toContain('addressLine');
  });
  it.each([
    { province: 'تهران', city: '' },
    { province: '', city: 'قم' },
  ])(
    'preserves a partial location without requiring its missing counterpart',
    async (location) => {
      const rows = validateOrganizationRows([
        {
          code: '',
          legalName: 'آژانس نمونه',
          personType: '',
          nationalId: '',
          roleCodes: '',
          ...location,
        },
      ]);
      expect(rows[0]?.issue).toBeUndefined();
      vi.spyOn(masterDataApi, 'list').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, pageSize: 100 },
      });
      vi.spyOn(masterDataApi, 'create').mockResolvedValue({
        data: { id: 'org-1', code: 'ORG-1' } as MasterDataRecord,
      });
      const address = vi
        .spyOn(masterDataApi, 'createOrganizationAddress')
        .mockResolvedValue({ data: {} as never });
      await importOrganizations(rows, () => {});
      expect(address).toHaveBeenCalledWith('org-1', {
        addressLine: location.province ? 'استان: تهران' : 'شهر: قم',
        label: 'نشانی دفتر مرکزی',
        isPrimary: true,
      });
    },
  );
  it('accepts a name-only agency and creates no empty contacts or addresses', async () => {
    const rows = validateOrganizationRows([
      {
        code: '',
        legalName: 'آژانس نمونه',
        personType: '',
        nationalId: '',
        roleCodes: '',
      },
    ]);
    expect(rows[0]?.issue).toBeUndefined();
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    });
    const create = vi.spyOn(masterDataApi, 'create').mockResolvedValue({
      data: { id: 'org-1', code: 'ORG-1' } as MasterDataRecord,
    });
    const address = vi.spyOn(masterDataApi, 'createOrganizationAddress');
    const results = await importOrganizations(rows, () => {});
    expect(results[0]?.result).toBe('created');
    expect(create).toHaveBeenCalledTimes(1);
    expect(address).not.toHaveBeenCalled();
  });

  it('still rejects a missing name and saves a non-email optional value for review', () => {
    expect(
      validateOrganizationRows([
        { ...syntheticOrganizations[0]!, legalName: '' },
      ])[0]?.issue,
    ).toBeTruthy();
    const [row] = validateOrganizationRows([
      { ...syntheticOrganizations[0]!, email: 'https://example.com' },
    ]);
    expect(row?.issue).toBeUndefined();
    expect(row?.email).toBe('');
    expect(row?.reviewFields).toContain('email');
  });
  it('accepts blank email and tourism license values', () => {
    const [row] = validateOrganizationRows([
      {
        ...syntheticOrganizations[0]!,
        email: '',
        tourismLicenseNumber: '',
      },
    ]);
    expect(row?.issue).toBeUndefined();
    expect(row?.email).toBe('');
    expect(row?.tourismLicenseNumber).toBe('');
  });

  it('registers an invalid optional phone as a review record without sending the malformed value', async () => {
    const agency = {
      code: '',
      personType: 'LEGAL',
      nationalId: '',
      roleCodes: 'AGENCY',
    };
    const source = [
      { ...agency, legalName: 'آژانس یک' },
      { ...agency, legalName: 'آژانس دو', officePhone: '۱۲۳' },
      { ...agency, legalName: 'آژانس سه' },
    ];
    const list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    });
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockImplementation(async () => ({
        data: {
          id: `org-${create.mock.calls.length}`,
          code: `ORG-${create.mock.calls.length}`,
        } as MasterDataRecord,
      }));
    const preview = await previewOrganizations(source);
    expect(preview.map((row) => Boolean(row.issue))).toEqual([
      false,
      false,
      false,
    ]);
    expect(preview[1]?.reviewFields).toEqual(['officePhone']);
    expect(list).toHaveBeenCalledTimes(3);

    const snapshots: OrganizationPreviewRow[][] = [];
    const result = await importOrganizations(preview, (rows) => {
      snapshots.push(rows);
    });
    expect(result.map((row) => row.result)).toEqual([
      'created',
      'review',
      'created',
    ]);
    expect(result.map((row) => row.rowNumber)).toEqual([2, 3, 4]);
    expect(snapshots.at(-1)?.map((row) => row.result)).toEqual([
      'created',
      'review',
      'created',
    ]);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.map(([, body]) => body.values.legalName)).toEqual([
      'آژانس یک',
      'آژانس دو',
      'آژانس سه',
    ]);
    expect(create.mock.calls[1]?.[1].values).toMatchObject({
      importReviewFields: 'officePhone',
    });
  });

  it('never turns a formula-like optional email into an allowed blank', () => {
    const [row] = validateOrganizationRows([
      { ...syntheticOrganizations[0]!, email: '=HYPERLINK("x")' },
    ]);
    expect(row?.issue).toContain('فرمول');
    expect(row?.warning).toBeUndefined();
  });

  it('rejects case-insensitive duplicates, formulas and unrelated roles before writing', () => {
    const rows = validateOrganizationRows([
      syntheticOrganizations[0]!,
      { ...syntheticOrganizations[0]!, code: 'b2b-demo-001' },
      { ...syntheticOrganizations[1]!, legalName: '=HYPERLINK("x")' },
      { ...syntheticOrganizations[2]!, roleCodes: 'SUPPLIER' },
    ]);
    expect(rows.map((row) => Boolean(row.issue))).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
  it('finds an existing identity of any role and never overwrites it', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [
        {
          id: 'existing',
          name: syntheticOrganizations[0]!.legalName,
          code: 'B2B-DEMO-001',
          attributes: { roleCodes: 'SUPPLIER' },
        } as unknown as MasterDataRecord,
      ],
      meta: { total: 1, page: 1, pageSize: 100 },
    } as Awaited<ReturnType<typeof masterDataApi.list>>);
    const create = vi.spyOn(masterDataApi, 'create');
    const update = vi.spyOn(masterDataApi, 'update');
    const preview = await previewOrganizations([syntheticOrganizations[0]!]);
    expect(preview[0]?.existing?.id).toBe('existing');
    const results = await importOrganizations(preview, () => {});
    expect(results[0]?.result).toBe('skipped');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('stops a batch after an uncertain write and does not retry it', async () => {
    vi.spyOn(masterDataApi, 'list').mockImplementation(async (resource) =>
      resource === 'cities'
        ? ({
            data: [
              {
                id: 'city-1',
                name: 'تهران',
                attributes: {
                  countryId: 'country-1',
                  regionName: 'تهران',
                },
              } as unknown as MasterDataRecord,
            ],
            meta: { total: 1, page: 1, pageSize: 100 },
          } as Awaited<ReturnType<typeof masterDataApi.list>>)
        : ({
            data: [],
            meta: { total: 0, page: 1, pageSize: 100 },
          } as Awaited<ReturnType<typeof masterDataApi.list>>),
    );
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValueOnce({
        data: { id: 'org-1', code: 'ORG-1' } as MasterDataRecord,
      })
      .mockResolvedValueOnce({ data: {} as MasterDataRecord })
      .mockRejectedValueOnce(new Error('network unavailable'));
    vi.spyOn(masterDataApi, 'createOrganizationAddress').mockResolvedValue({
      data: {} as never,
    });
    const results = await importOrganizations(
      validateOrganizationRows(syntheticOrganizations.slice(0, 3)),
      () => {},
    );
    expect(results.map((row) => row.result)).toEqual(['created', 'failed']);
    expect(create).toHaveBeenCalledTimes(3);
  });
  it('uses the server-generated code for new organizations', async () => {
    vi.spyOn(masterDataApi, 'list').mockImplementation(async (resource) =>
      resource === 'cities'
        ? ({
            data: [
              {
                id: 'city-1',
                name: 'تهران',
                attributes: {
                  countryId: 'country-1',
                  regionName: 'تهران',
                },
              } as unknown as MasterDataRecord,
            ],
            meta: { total: 1, page: 1, pageSize: 100 },
          } as Awaited<ReturnType<typeof masterDataApi.list>>)
        : ({
            data: [],
            meta: { total: 0, page: 1, pageSize: 100 },
          } as Awaited<ReturnType<typeof masterDataApi.list>>),
    );
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockImplementation(async (resource) => ({
        data: {
          id: resource === 'organizations' ? 'org-1' : 'contact-1',
          code: resource === 'organizations' ? 'ORG_GENERATED' : 'CONTACT-1',
        } as MasterDataRecord,
      }));
    const createAddress = vi
      .spyOn(masterDataApi, 'createOrganizationAddress')
      .mockResolvedValue({ data: {} as never });
    const results = await importOrganizations(
      validateOrganizationRows([syntheticOrganizations[0]!]),
      () => {},
    );
    expect(create).toHaveBeenCalledWith('organizations', {
      values: {
        legalName: syntheticOrganizations[0]!.legalName,
        personType: 'LEGAL',
        nationalId: syntheticOrganizations[0]!.nationalId,
        registrationNumber: syntheticOrganizations[0]!.registrationNumber,
        economicCode: syntheticOrganizations[0]!.economicCode || null,
        tourismLicenseNumber: syntheticOrganizations[0]!.tourismLicenseNumber,
        roleCodes: 'AGENCY',
      },
    });
    expect(create).toHaveBeenCalledWith(
      'organization-contacts',
      expect.objectContaining({
        values: expect.objectContaining({
          organizationId: 'org-1',
          nationalId: syntheticOrganizations[0]!.chiefExecutiveNationalId,
          phone: syntheticOrganizations[0]!.chiefExecutiveMobile,
        }),
      }),
    );
    expect(createAddress).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ cityId: 'city-1', countryId: 'country-1' }),
    );
    expect(results[0]).toMatchObject({
      result: 'created',
      code: 'ORG_GENERATED',
    });
  });
  it('rejects unknown system codes and mismatched identities without writes', async () => {
    vi.spyOn(masterDataApi, 'list')
      .mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 1, pageSize: 100 },
      })
      .mockResolvedValueOnce({
        data: [{ code: 'ORG_OTHER', name: 'نام متفاوت' } as MasterDataRecord],
        meta: { total: 1, page: 1, pageSize: 100 },
      });
    const create = vi.spyOn(masterDataApi, 'create');
    const preview = await previewOrganizations([
      { ...syntheticOrganizations[0]!, code: 'ORG_UNKNOWN' },
      { ...syntheticOrganizations[1]!, code: 'ORG_OTHER' },
    ]);
    expect(preview[0]?.issue).toContain('کد سیستمی یافت نشد');
    expect(preview[1]?.issue).toContain('مطابقت ندارند');
    expect(create).not.toHaveBeenCalled();
  });
});
