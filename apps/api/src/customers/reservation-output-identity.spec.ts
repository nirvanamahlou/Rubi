import { expect, it, vi } from 'vitest';
import { CustomerService } from './customer.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor = {
  permissions: ['reservations.read'],
  branchIds: ['branch'],
} as AuthenticatedActor;
it.each([
  ['2024-10-19', null],
  ['2024-10-18', 'CHD_2_TO_6'],
  ['2020-10-19', 'CHD_2_TO_6'],
  ['2020-10-18', 'CHD_6_TO_12'],
  ['2014-10-19', 'CHD_6_TO_12'],
  ['2014-10-18', null],
])(
  'derives the hotel band for birthday %s at travel day without exposing DOB',
  async (birth, band) => {
    const find = vi.fn().mockResolvedValue({
      passportFirstName: ' ALI ',
      passportLastName: ' EXAMPLE ',
      birthDate: new Date(birth + 'T00:00:00Z'),
      passportNumber: 'PRIVATE',
    });
    const service = new CustomerService(
      { find } as never,
      {} as never,
      {} as never,
    );
    const result = await service.reservationOutputIdentity(
      'person',
      '2026-10-18',
      actor,
    );
    expect(result).toEqual({
      customerId: 'person',
      passportName: 'EXAMPLE / ALI',
      hotelChildAgeBand: band,
      gender: null,
    });
    expect(find).toHaveBeenCalledWith('person', ['branch']);
    expect(JSON.stringify(result)).not.toContain(birth);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  },
);
it('requires native Reservations read before querying and keeps missing branches unavailable', async () => {
  const find = vi.fn().mockResolvedValue(null);
  const service = new CustomerService(
    { find } as never,
    {} as never,
    {} as never,
  );
  await expect(
    service.reservationOutputIdentity('p', '2026-10-18', {
      ...actor,
      permissions: [],
    }),
  ).rejects.toThrow();
  expect(find).not.toHaveBeenCalled();
  await expect(
    service.reservationOutputIdentity('p', '2026-10-18', actor),
  ).rejects.toThrow();
});
it('does not fabricate incomplete passport identity or a band without a travel date', async () => {
  const find = vi.fn().mockResolvedValue({
    passportFirstName: 'ALI',
    passportLastName: null,
    birthDate: new Date('2020-01-01'),
  });
  const service = new CustomerService(
    { find } as never,
    {} as never,
    {} as never,
  );
  expect(
    await service.reservationOutputIdentity('p', undefined, actor),
  ).toEqual({
    customerId: 'p',
    passportName: null,
    hotelChildAgeBand: null,
    gender: null,
  });
});

it.each(['M', 'F', null, undefined, 'invalid'])(
  'exposes registered gender %s without inferring from names',
  async (gender) => {
    const find = vi.fn().mockResolvedValue({
      passportFirstName: 'EXAMPLE',
      passportLastName: 'PERSON',
      gender,
    });
    const service = new CustomerService(
      { find } as never,
      {} as never,
      {} as never,
    );
    const result = await service.reservationOutputIdentity(
      'p',
      undefined,
      actor,
    );
    expect(result.gender).toBe(
      gender === 'M' || gender === 'F' ? gender : null,
    );
    expect(find).toHaveBeenCalledWith('p', ['branch']);
  },
);
