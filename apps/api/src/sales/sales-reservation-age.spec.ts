import 'reflect-metadata';
import { it, expect, vi } from 'vitest';
import {
  reservationChildAgeBand,
  reservationChildBandFields,
} from './sales-reservation-age';
import { SalesOperationalAmendmentService } from './sales-operational-amendment.module';
it('derives exact hotel child age bands at check-in including birthday boundaries', () => {
  for (const [birth, band] of [
    ['2026-10-01', 'AGE_2_6'],
    ['2020-10-02', 'AGE_2_6'],
    ['2020-10-01', 'AGE_6_12'],
    ['2014-10-02', 'AGE_6_12'],
    ['2014-10-01', undefined],
    ['invalid', undefined],
  ] as const)
    expect(reservationChildAgeBand(birth, '2026-10-01')).toBe(band);
  expect(
    reservationChildBandFields(
      { birthDate: '2020-10-02', ageCategory: 'CHD' },
      '2026-10-01',
    ),
  ).toEqual({ childAgeBand: 'AGE_2_6' });
  expect(
    reservationChildBandFields(
      { birthDate: '2025-10-02', ageCategory: 'INF' },
      '2026-10-01',
    ),
  ).toEqual({});
});
it('scopes historical child band reads to contract, branch and requested members without exposing birth dates', async () => {
  const findFirst = vi.fn().mockResolvedValue({
    departureDate: new Date('2026-10-01'),
    passengers: [{ customerId: 'child', birthDate: new Date('2020-10-02') }],
  });
  const service = new SalesOperationalAmendmentService();
  const result = await service.hotelChildAgeBandsFor(
    { salesContract: { findFirst } } as never,
    'contract',
    ['branch'],
    '2026-10-01',
    ['child'],
  );
  expect(result).toEqual({ child: 'AGE_2_6' });
  expect(
    await service.hotelChildAgeBandsFor(
      { salesContract: { findFirst } } as never,
      'contract',
      ['branch'],
      undefined,
      ['child'],
    ),
  ).toEqual(result);
  expect(findFirst).toHaveBeenCalledWith({
    where: { id: 'contract', branchId: { in: ['branch'] } },
    select: {
      departureDate: true,
      passengers: {
        where: { customerId: { in: ['child'] } },
        select: { customerId: true, birthDate: true },
      },
    },
  });
  findFirst.mockResolvedValue(null);
  await expect(
    service.hotelChildAgeBandsFor(
      { salesContract: { findFirst } } as never,
      'foreign',
      ['branch'],
      '2026-10-01',
      ['child'],
    ),
  ).rejects.toThrow();
});
