import { describe, expect, it, vi } from 'vitest';
import { MasterTravelDirectory } from './master-travel-directory';
import type { MasterDataService } from './master-data.service';

describe('public travel reference boundary', () => {
  const input = {
    originId: 'origin',
    destinationId: 'destination',
    hotelIds: ['hotel'],
    insuranceId: 'plan',
  };
  it('resolves through the public master service and rejects the wrong hotel city', async () => {
    const detail = vi.fn(async () => ({
      data: { status: 'active', attributes: { cityId: 'destination' } },
    }));
    const directory = new MasterTravelDirectory({
      detail,
    } as unknown as MasterDataService);
    await expect(
      directory.assertTourReferences(input),
    ).resolves.toBeUndefined();
    expect(detail.mock.calls).toHaveLength(4);
    detail.mockResolvedValue({
      data: { status: 'active', attributes: { cityId: 'other' } },
    });
    await expect(directory.assertTourReferences(input)).rejects.toThrow(
      'شهر مقصد',
    );
  });
  it('rejects inactive references rather than pretending they are available', async () => {
    const detail = vi.fn(async () => ({
      data: { status: 'inactive', attributes: {} },
    }));
    const directory = new MasterTravelDirectory({
      detail,
    } as unknown as MasterDataService);
    await expect(directory.assertTourReferences(input)).rejects.toThrow();
  });

  it('matches only an active XLSX manifest template for the airline and destination', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'draft',
          name: 'Draft',
          attributes: {
            airlineName: 'IRAN AIRTOUR',
            destinationCityId: 'antalya',
            publicationStatus: 'DRAFT',
            fileFormat: 'XLSX',
            fileReferenceId: 'draft-file',
          },
        },
        {
          id: 'active',
          name: 'Sparta Antalya',
          attributes: {
            airlineName: 'ایران ایرتور',
            destinationCityId: 'antalya',
            publicationStatus: 'ACTIVE',
            fileFormat: 'XLSX',
            fileReferenceId: 'manifest-file',
            versionNumber: 3,
            validFrom: '2026-09-01',
            validTo: '2026-09-30',
          },
        },
      ],
      meta: { page: 1, pageSize: 100, total: 2 },
    });
    const directory = new MasterTravelDirectory({ list } as never);

    await expect(
      directory.manifestTemplate('ایران ایر تور', 'antalya', '2026-09-20'),
    ).resolves.toEqual({
      id: 'active',
      name: 'Sparta Antalya',
      versionNumber: 3,
      fileReferenceId: 'manifest-file',
    });
  });

  it('validates the exact template selected on a published ticket', async () => {
    const record = {
      id: 'chosen',
      name: 'قالب ازمیر',
      status: 'active',
      attributes: {
        airlineName: 'IRAN AIRTOUR',
        destinationCityId: 'izmir',
        publicationStatus: 'ACTIVE',
        fileFormat: 'XLSX',
        fileReferenceId: 'historical-file',
        versionNumber: 4,
        validFrom: '2026-09-01',
      },
    };
    const detail = vi.fn().mockResolvedValue({ data: record });
    const directory = new MasterTravelDirectory({ detail } as never);
    await expect(
      directory.manifestTemplateById(
        'chosen',
        'IRAN AIRTOUR',
        'izmir',
        '2026-09-15',
      ),
    ).resolves.toEqual({
      id: 'chosen',
      name: 'قالب ازمیر',
      versionNumber: 4,
      fileReferenceId: 'historical-file',
    });
    record.status = 'inactive';
    await expect(
      directory.manifestTemplateById(
        'chosen',
        'IRAN AIRTOUR',
        'izmir',
        '2026-09-15',
      ),
    ).rejects.toThrow('فعال نیست');
    expect(detail).toHaveBeenCalledWith('manifest-templates', 'chosen');
  });
});
