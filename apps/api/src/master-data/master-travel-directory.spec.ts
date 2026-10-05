import { describe, expect, it, vi } from 'vitest';
import { MasterTravelDirectory } from './master-travel-directory';
import type { MasterDataService } from './master-data.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

it('lists independent active registered brokers without requiring an organization role', async () => {
  const list = vi.fn().mockResolvedValue({
    data: [{ id: 'broker', name: 'Registered', attributes: {} }],
    meta: { total: 1 },
  });
  const directory = new MasterTravelDirectory({ list } as never);
  expect(await directory.hotelRateChoices('brokers', 'Registered', 2)).toEqual({
    data: [{ id: 'broker', name: 'Registered' }],
    meta: { total: 1 },
  });
  expect(list).toHaveBeenCalledWith(
    'brokers',
    expect.objectContaining({
      page: 2,
      search: 'Registered',
      status: 'active',
    }),
  );
  expect(list.mock.calls[0]![1]).not.toHaveProperty('organizationRole');
});

it('validates an independent broker and never falls back for an inactive broker', async () => {
  const detail = vi.fn().mockResolvedValue({
    data: { id: 'broker', name: 'Registered', status: 'active' },
  });
  const directory = new MasterTravelDirectory({ detail } as never);
  expect(await directory.brokerReference('broker')).toEqual({
    id: 'broker',
    name: 'Registered',
    source: 'BROKER',
  });
  detail.mockResolvedValue({ data: { status: 'inactive' } });
  await expect(directory.brokerReference('broker')).rejects.toBeInstanceOf(
    BadRequestException,
  );
  expect(detail).toHaveBeenCalledTimes(2);
});

it('preserves legacy organization references only when no registered broker exists', async () => {
  const detail = vi
    .fn()
    .mockRejectedValueOnce(new NotFoundException())
    .mockResolvedValueOnce({
      data: {
        id: 'legacy',
        name: 'Legacy',
        status: 'active',
        attributes: { roleCodes: 'BROKER' },
      },
    });
  expect(
    await new MasterTravelDirectory({ detail } as never).brokerReference(
      'legacy',
    ),
  ).toEqual({ id: 'legacy', name: 'Legacy', source: 'ORGANIZATION' });
  expect(detail).toHaveBeenLastCalledWith('organizations', 'legacy');
});

it('does not hide broker lookup failures by trying a legacy reference', async () => {
  const detail = vi.fn().mockRejectedValue(new Error('Unavailable'));
  await expect(
    new MasterTravelDirectory({ detail } as never).brokerReference('broker'),
  ).rejects.toThrow('Unavailable');
  expect(detail).toHaveBeenCalledTimes(1);
});

it('creates an inline voucher leader under the selected broker and its city', async () => {
  const detail = vi.fn().mockImplementation(async (resource: string) => ({
    data:
      resource === 'brokers'
        ? { status: 'active', attributes: { cityId: 'city-1' } }
        : { status: 'active', name: 'Tehran' },
  }));
  const create = vi.fn().mockResolvedValue({ data: { id: 'leader-1' } });
  const directory = new MasterTravelDirectory({ detail, create } as never);
  const actor = { userId: 'synthetic-user' } as never;
  await directory.addVoucherLeader(
    'broker-1',
    undefined,
    'Synthetic Leader',
    '+989000000000',
    actor,
  );
  expect(create).toHaveBeenCalledWith(
    'leaders',
    expect.objectContaining({
      brokerId: 'broker-1',
      cityId: 'city-1',
      name: 'Synthetic Leader',
      primaryPhone: '+989000000000',
    }),
    actor,
  );
});

describe('explicit manifest template public boundary', () => {
  const record = {
    id: 'template',
    name: 'Stored template',
    status: 'active',
    attributes: {
      publicationStatus: 'ACTIVE',
      fileFormat: 'XLSX',
      fileReferenceId: 'file',
      airlineName: 'Synthetic Air',
      destinationCityName: 'Destination',
      versionNumber: 2,
      validFrom: '2026-10-01',
      validTo: '2026-10-31',
    },
  };

  it('uses airline/destination labels and paginates without returning draft files', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        record,
        {
          ...record,
          id: 'draft',
          attributes: { ...record.attributes, publicationStatus: 'DRAFT' },
        },
      ],
      meta: { total: 2 },
    });
    const directory = new MasterTravelDirectory({ list } as never);
    expect(await directory.manifestTemplateChoices('Synthetic', 1)).toEqual({
      data: [{ id: 'template', name: 'Synthetic Air — Destination' }],
      hasMore: false,
    });
    expect(list).toHaveBeenCalledWith(
      'manifest-templates',
      expect.objectContaining({
        search: '',
        page: 1,
        status: 'active',
      }),
    );
  });

  it('searches destination labels across source pages and paginates eligible choices', async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      ...record,
      id: `template-${i}`,
    }));
    const list = vi.fn().mockImplementation(async (_resource, query) => ({
      data: query.page === 1 ? rows.slice(0, 20) : rows.slice(20),
      meta: { total: 26 },
    }));
    const directory = new MasterTravelDirectory({ list } as never);
    const first = await directory.manifestTemplateChoices('Destination', 1);
    expect(first.data).toHaveLength(25);
    expect(first.hasMore).toBe(true);
    const second = await directory.manifestTemplateChoices('Destination', 2);
    expect(second).toEqual({
      data: [{ id: 'template-25', name: 'Synthetic Air — Destination' }],
      hasMore: false,
    });
    expect(
      (await directory.manifestTemplateChoices('missing', 1)).data,
    ).toEqual([]);
  });

  it('checks inclusive validity dates and rejects expired/draft selections', async () => {
    const detail = vi.fn().mockResolvedValue({ data: record });
    const directory = new MasterTravelDirectory({ detail } as never);
    expect(
      await directory.manifestTemplateById('template', '2026-10-01'),
    ).toMatchObject({ id: 'template', fileReferenceId: 'file' });
    await expect(
      directory.manifestTemplateById('template', '2026-11-01'),
    ).rejects.toThrow('معتبر');
    detail.mockResolvedValue({
      data: {
        ...record,
        attributes: { ...record.attributes, publicationStatus: 'DRAFT' },
      },
    });
    await expect(
      directory.manifestTemplateById('template', '2026-10-01'),
    ).rejects.toThrow('فعال');
  });
});

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

  it('matches a Persian airline template through the flight-number airline code', async () => {
    const list = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'active-b9',
          name: 'Iran Airtour Antalya',
          attributes: {
            airlineName: 'ایران ایرتور',
            airlineCode: 'B9',
            destinationCityId: 'antalya',
            publicationStatus: 'ACTIVE',
            fileFormat: 'XLSX',
            fileReferenceId: 'manifest-file',
            versionNumber: 4,
            validFrom: '2026-09-01',
          },
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
    const directory = new MasterTravelDirectory({ list } as never);

    await expect(
      directory.manifestTemplate(
        'IRAN AIRTOUR',
        'antalya',
        '2026-09-27',
        'B9-9103',
      ),
    ).resolves.toMatchObject({ id: 'active-b9', versionNumber: 4 });
  });
});
