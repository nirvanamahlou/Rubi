import type { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { allocateHotelIdentificationCode } from './hotel-identification-code';

const cityId = '11111111-1111-4111-8111-111111111111';

describe('hotel identification codes', () => {
  it('reuses the existing city prefix and pads a short issued number', async () => {
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ prefix: 'AYT' }])
        .mockResolvedValueOnce([{ number: '7' }]),
      masterCity: { findUniqueOrThrow: vi.fn() },
    };
    expect(
      await allocateHotelIdentificationCode(
        tx as unknown as Prisma.TransactionClient,
        cityId,
      ),
    ).toBe('HTL-AYT-007');
    expect(tx.masterCity.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    ['LHR', 'London', 'لندن', [{ iataCode: 'LGW' }], 'LHR'],
    ['CITY_123', 'Isparta', 'اسپارتا', [{ iataCode: 'ISE' }], 'ISE'],
    ['CITY_123', 'Zürich', 'زوریخ', [], 'ZUR'],
    ['CITY_123', null, 'مهران', [], 'MHR'],
  ] as const)(
    'derives a prefix for a city without hotels (%s, %s)',
    async (code, englishName, name, airports, prefix) => {
      const tx = {
        $queryRaw: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ number: '1000' }]),
        masterCity: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ code, englishName, name, airports }),
        },
      };
      expect(
        await allocateHotelIdentificationCode(
          tx as unknown as Prisma.TransactionClient,
          cityId,
        ),
      ).toBe(`HTL-${prefix}-1000`);
    },
  );
});
