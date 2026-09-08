import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  importOrganizations,
  previewOrganizations,
  syntheticOrganizations,
  validateOrganizationRows,
} from './organization-import';
afterEach(() => vi.restoreAllMocks());
describe('organization import boundaries', () => {
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
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as unknown as Awaited<ReturnType<typeof masterDataApi.list>>);
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValueOnce({ data: {} as MasterDataRecord })
      .mockRejectedValueOnce(new Error('network unavailable'));
    const results = await importOrganizations(
      validateOrganizationRows(syntheticOrganizations.slice(0, 3)),
      () => {},
    );
    expect(results.map((row) => row.result)).toEqual(['created', 'failed']);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('uses the server-generated code for new organizations', async () => {
    vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    });
    const create = vi.spyOn(masterDataApi, 'create').mockResolvedValue({
      data: { code: 'ORG_GENERATED' } as MasterDataRecord,
    });
    const results = await importOrganizations(
      validateOrganizationRows([syntheticOrganizations[0]!]),
      () => {},
    );
    expect(create).toHaveBeenCalledWith('organizations', {
      values: {
        legalName: syntheticOrganizations[0]!.legalName,
        personType: 'LEGAL',
        roleCodes: 'AGENCY',
      },
    });
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
