import { expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatesController } from './hotel-rates.module';

it('projects only active public countries and country-filtered cities via Master Data owner', async () => {
  const list = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'city',
        name: 'آنتالیا',
        attributes: {
          countryId: 'country',
          englishName: 'Antalya',
          secret: 'not-public',
        },
      },
    ],
    meta: { total: 1 },
  });
  const directory = new MasterTravelDirectory({ list } as never);
  const result = await directory.hotelRatePackChoices(
    'cities',
    'آنت',
    2,
    undefined,
    'country',
  );
  expect(list).toHaveBeenCalledWith(
    'cities',
    expect.objectContaining({
      countryId: 'country',
      status: 'active',
      search: 'آنت',
      page: 2,
    }),
  );
  expect(result.data[0]).toMatchObject({ id: 'city', countryId: 'country' });
  expect(result.data[0]).not.toHaveProperty('secret');
  await directory.hotelRatePackChoices('countries', '', 1);
  expect(list).toHaveBeenLastCalledWith(
    'countries',
    expect.objectContaining({ status: 'active', pageSize: 100 }),
  );
  expect(list.mock.calls[1]?.[1]).not.toHaveProperty('countryId');
});
it('resolves an existing pack city by canonical ID, rejecting inactive or mismatched countries', async () => {
  const detail = vi.fn().mockResolvedValue({
    data: {
      id: 'city',
      name: 'Antalya',
      status: 'active',
      attributes: { countryId: 'country' },
    },
  });
  const directory = new MasterTravelDirectory({ detail } as never);
  const result = await directory.hotelRatePackChoices('cities', '', 1, 'city');
  expect(result.data[0]).toMatchObject({ id: 'city', countryId: 'country' });
  expect(detail).toHaveBeenCalledWith('cities', 'city');
  expect(
    (await directory.hotelRatePackChoices('cities', '', 1, 'city', 'another'))
      .data,
  ).toEqual([]);
  detail.mockResolvedValue({ data: { status: 'inactive' } });
  await expect(
    directory.hotelRatePackChoices('cities', '', 1, 'city'),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('keeps legacy city choices and saleable hotel filtering unchanged', async () => {
  const list = vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
  const directory = new MasterTravelDirectory({ list } as never);
  await directory.hotelRatePackChoices('cities', '', 1);
  expect(list.mock.calls[0]?.[1]).not.toHaveProperty('countryId');
  await directory.hotelRatePackChoices('hotels', '', 1, 'city');
  expect(list).toHaveBeenLastCalledWith(
    'hotels',
    expect.objectContaining({
      cityId: 'city',
      saleableOnly: true,
      status: 'active',
    }),
  );
  await expect(
    directory.hotelRatePackChoices('hotels', '', 1),
  ).rejects.toThrow();
});
it('requires Reservations permission before exposing countries, and validates country UUIDs', async () => {
  const requirePermission = vi.fn();
  const choices = vi.fn().mockResolvedValue({ data: [] });
  const controller = new HotelRatesController(
    {} as never,
    { require: requirePermission } as never,
    { hotelRatePackChoices: choices } as never,
  );
  const req = { actor: { permissions: ['reservations.read'] } } as never;
  const country = randomUUID();
  await controller.packOptions(req, 'cities', '', '1', undefined, country);
  expect(choices).toHaveBeenCalledWith('cities', '', 1, undefined, country);
  await controller.packOptions(req, 'countries');
  expect(() =>
    controller.packOptions(req, 'cities', '', '1', undefined, 'bad-country'),
  ).toThrow(BadRequestException);
  expect(() => controller.packOptions(req, 'secrets')).toThrow(
    BadRequestException,
  );
  choices.mockClear();
  requirePermission.mockImplementation(() => {
    throw new ForbiddenException();
  });
  expect(() => controller.packOptions(req, 'countries')).toThrow(
    ForbiddenException,
  );
  expect(choices).not.toHaveBeenCalled();
});
