import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { columnFilterWhere } from './catalog-filters';
import {
  MasterDataRepository,
  toMasterDataRecord,
} from './master-data.repository';

describe('column filters', () => {
  it('combines independent filters before pagination and count', async () => {
    const findMany = vi.fn().mockResolvedValue([]),
      count = vi.fn().mockResolvedValue(0);
    const repository = new MasterDataRepository({
      client: { masterAircraftType: { findMany, count } },
    } as unknown as DatabaseService);
    await repository.list('aircraft-types', {
      search: '320',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 2,
      pageSize: 10,
      columnFilter1: 'Airbus',
      columnFilter2: 'NARROW_BODY',
    });
    const expected = {
      AND: [
        { manufacturer: { contains: 'Airbus', mode: 'insensitive' } },
        { bodyType: 'NARROW_BODY' },
      ],
      isActive: true,
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(expected),
        skip: 10,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: findMany.mock.calls[0]![0].where,
    });
  });
  it('filters nested services without reading another module', () => {
    expect(columnFilterWhere('suppliers', { columnFilter2: 'هتل' })).toEqual([
      {
        services: {
          some: { service: { name: { contains: 'هتل', mode: 'insensitive' } } },
        },
      },
    ]);
  });
  it('keeps false as a real boolean filter', () => {
    expect(columnFilterWhere('hotels', { columnFilter2: 'false' })).toEqual([
      { isSaleableReference: false },
    ]);
  });
  it.each([true, 42, {}, [], 'x'.repeat(101)])(
    'rejects malformed values %s',
    (value) => {
      expect(() =>
        columnFilterWhere('countries', { columnFilter1: value as string }),
      ).toThrow();
    },
  );
  it('rejects values from another catalog and ignores cleared fields', () => {
    expect(() =>
      columnFilterWhere('aircraft-types', { columnFilter2: 'SLEEPER' }),
    ).toThrow();
    expect(
      columnFilterWhere('countries', {
        columnFilter1: '',
        columnFilter2: '   ',
      }),
    ).toEqual([]);
  });
  it('returns real dependency counts, without leaking ORM relations', () => {
    const record = toMasterDataRecord('countries', {
      id: 'id',
      version: 1,
      code: 'TR',
      name: 'ترکیه',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { cities: 2, regions: 2, banks: 1 },
    });
    expect(record.attributes).toMatchObject({
      citiesCount: 2,
      regionsCount: 2,
      banksCount: 1,
      dependencyCount: 5,
    });
    expect(record.attributes).not.toHaveProperty('_count');
  });
});
