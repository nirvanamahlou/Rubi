import { describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '../api/client';
import {
  importPartners,
  partnerImportHeaders,
  validatePartnerRows,
} from './partner-import';
vi.mock('../api/client', () => ({ masterDataApi: { create: vi.fn() } }));
const cities = [
  {
    id: 'city',
    name: 'کوش آداسی',
    attributes: { countryId: 'country', countryName: 'ترکیه' },
  },
] as unknown as MasterDataRecord[];
const row = [
  'Legal Name',
  'ترکیه / کوش اداسی',
  '+905551234567',
  '+989121234567',
  'qa@example.test',
];
describe('partner Excel validation and persistence', () => {
  it('resolves the combined country/city cell without whitespace/Arabic letter sensitivity', () => {
    expect(
      validatePartnerRows([partnerImportHeaders, row], cities)[0],
    ).toMatchObject({
      cityId: 'city',
      countryId: 'country',
      name: 'Legal Name',
    });
  });
  it('rejects an unknown or ambiguous location rather than guessing its FK', () => {
    expect(
      validatePartnerRows(
        [partnerImportHeaders, row],
        [...cities, ...cities],
      )[0]?.error,
    ).toBeTruthy();
    expect(
      validatePartnerRows(
        [
          partnerImportHeaders,
          [...row.slice(0, 1), 'missing', ...row.slice(2)],
        ],
        cities,
      )[0]?.error,
    ).toBeTruthy();
  });
  it('rejects duplicate rows and spreadsheet formulas', () => {
    expect(
      validatePartnerRows([partnerImportHeaders, row, row], cities)[1]?.error,
    ).toBeTruthy();
    expect(
      validatePartnerRows(
        [partnerImportHeaders, ['=SUM(A1)', ...row.slice(1)]],
        cities,
      )[0]?.error,
    ).toBeTruthy();
  });
  it('requires the supplied five-column template and limits batch size', () => {
    expect(() => validatePartnerRows([['wrong'], row], cities)).toThrow();
    expect(() =>
      validatePartnerRows(
        [partnerImportHeaders, ...Array.from({ length: 201 }, () => row)],
        cities,
      ),
    ).toThrow();
  });
  it('uses one atomic backend command for identity, real city references and protected contacts', async () => {
    vi.mocked(masterDataApi.create).mockResolvedValue({
      data: { attributes: {} },
    } as never);
    const result = await importPartners(
      'brokers',
      validatePartnerRows([partnerImportHeaders, row], cities),
      vi.fn(),
    );
    expect(result[0]?.result).toBe('created');
    expect(masterDataApi.create).toHaveBeenLastCalledWith('brokers', {
      values: expect.objectContaining({
        countryId: 'country',
        cityId: 'city',
        cityIds: 'city',
        dossierVersion: '1',
        dossierImport: 'true',
        dossierEmail: 'qa@example.test',
        dossierMobile: '+989121234567',
      }),
    });
  });
  it('stops after an unknown write outcome, leaving subsequent rows unsubmitted', async () => {
    vi.mocked(masterDataApi.create)
      .mockClear()
      .mockRejectedValue(new Error('Connection lost'));
    const valid = validatePartnerRows([partnerImportHeaders, row], cities)[0]!;
    const result = await importPartners(
      'suppliers',
      [valid, { ...valid, rowNumber: 3, name: 'Other' }],
      vi.fn(),
    );
    expect(masterDataApi.create).toHaveBeenCalledTimes(1);
    expect(result[0]?.result).toBe('failed');
    expect(result[1]?.result).toBeUndefined();
  });
});
