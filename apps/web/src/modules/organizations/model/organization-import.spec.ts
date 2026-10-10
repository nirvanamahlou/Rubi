import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  importOrganizations,
  previewOrganizations,
  syntheticOrganizations,
  validateOrganizationRows,
} from './organization-import';
afterEach(() => vi.restoreAllMocks());
describe('organization import boundaries', () => {
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
