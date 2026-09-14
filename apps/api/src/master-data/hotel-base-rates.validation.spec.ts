import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  hotelRateNights,
  validateHotelRatePeriod,
} from './hotel-base-rates.validation';

const input = {
  branchId: '11111111-1111-4111-8111-111111111111',
  cityId: '22222222-2222-4222-8222-222222222222',
  title: 'Antalya autumn',
  checkIn: '2026-10-20',
  checkOut: '2026-10-24',
  currencyCode: 'EUR',
  reason: 'initial hotel rate grid',
  rows: [
    {
      hotelId: '33333333-3333-4333-8333-333333333333',
      hotelVersion: 2,
      hotelName: 'Hotel',
      starRating: 5,
      included: true,
      baseAmount: '125.5000',
      factors: {
        double: '1',
        single: '1.5',
        triple: '0.85',
        childWithBed: '0.75',
        childWithoutBed: '0.5',
        infant: '0',
      },
    },
  ],
};

describe('hotel base-rate validation', () => {
  it('computes stay nights in UTC and accepts decimal strings', () => {
    expect(hotelRateNights(input.checkIn, input.checkOut)).toBe(4);
    expect(validateHotelRatePeriod(input)).toMatchObject({ nights: 4 });
  });

  it('rejects zero-night periods and included hotels without a positive rate', () => {
    expect(() =>
      validateHotelRatePeriod({ ...input, checkOut: input.checkIn }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateHotelRatePeriod({ ...input, checkIn: '2026-02-30' }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateHotelRatePeriod({
        ...input,
        rows: [{ ...input.rows[0], baseAmount: '0' }],
      }),
    ).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'HOTEL_RATE_INVALID_AMOUNT' }),
      }),
    );
  });

  it('rejects duplicate hotels and an empty tour selection', () => {
    expect(() =>
      validateHotelRatePeriod({ ...input, rows: [input.rows[0], input.rows[0]] }),
    ).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'HOTEL_RATE_DUPLICATE_HOTEL',
        }),
      }),
    );
    expect(() =>
      validateHotelRatePeriod({
        ...input,
        rows: [{ ...input.rows[0], included: false, baseAmount: null }],
      }),
    ).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({
          code: 'HOTEL_RATE_NO_INCLUDED_HOTEL',
        }),
      }),
    );
  });
});
