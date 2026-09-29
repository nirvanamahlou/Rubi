import { describe, expect, it } from 'vitest';
import { contractPrintHtml, contractRoomSummary } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';

describe('Purchased room summary in contract output', () => {
  it.each([
    [1, 1, 0, 0, 'مجموع 1 اتاق: 1 سینگل'],
    [2, 2, 0, 0, 'مجموع 2 اتاق: 2 سینگل'],
    [1, 0, 1, 0, 'مجموع 1 اتاق: 1 دبل'],
    [1, 0, 1, 2, 'مجموع 1 اتاق: 1 دبل، 2 تخت اضافه'],
    [3, 2, 1, 2, 'مجموع 3 اتاق: 2 سینگل، 1 دبل، 2 تخت اضافه'],
  ])(
    'summarizes %s rooms, %s single, %s double, %s extra beds',
    (roomCount, singleRoomCount, doubleRoomCount, extraBedCount, expected) => {
      expect(
        contractRoomSummary({
          ...printFixture.contract.hotelSelection!,
          roomCount: Number(roomCount),
          singleRoomCount: Number(singleRoomCount),
          doubleRoomCount: Number(doubleRoomCount),
          extraBedCount: Number(extraBedCount),
        }),
      ).toBe(expected);
    },
  );
  it('does not invent a room type for older or incomplete counts', () => {
    expect(
      contractRoomSummary({
        ...printFixture.contract.hotelSelection!,
        roomCount: 2,
      }),
    ).toBe('مجموع 2 اتاق: 2 اتاق با ترکیب ثبت‌نشده');
    expect(
      contractRoomSummary({
        ...printFixture.contract.hotelSelection!,
        roomCount: 3,
        singleRoomCount: 1,
        doubleRoomCount: 1,
      }),
    ).toBe('مجموع 3 اتاق: 1 سینگل، 1 دبل، 1 اتاق با ترکیب ثبت‌نشده');
    expect(
      contractRoomSummary({
        ...printFixture.contract.hotelSelection!,
        roomCount: 1,
        singleRoomCount: 2,
      }),
    ).toContain('نیازمند بررسی');
  });
  it.each(['person', 'organization'] as const)(
    'removes passenger room column and uses only saved purchased counts for %s',
    (kind) => {
      const output = structuredClone(printFixture);
      output.customer.kind = kind;
      output.contract.hotelSelection = {
        ...output.contract.hotelSelection!,
        roomCount: 1,
        singleRoomCount: 0,
        doubleRoomCount: 1,
        extraBedCount: 2,
      };
      output.contract.passengersDetail = Array.from({ length: 6 }, (_, i) => ({
        ...printFixture.contract.passengersDetail[0]!,
        id: String(i),
        accommodationKind: 'SINGLE',
      }));
      const html = contractPrintHtml(output, printReferences);
      const passengers = html
        .split('PASSENGERS & PRICING')[1]!
        .split('</section>')[0]!;
      expect(passengers).not.toContain('<th>اتاق</th>');
      expect(passengers).not.toContain('سینگل');
      const hotel = html.split('HOTEL INFORMATION')[1]!.split('</section>')[0]!;
      expect(hotel).toContain('مجموع 1 اتاق: 1 دبل، 2 تخت اضافه');
      expect(hotel).not.toContain('6 سینگل');
      expect(
        html.split('OTHER SERVICES')[1]!.split('</section>')[0],
      ).not.toContain('اتاق‌های قرارداد:');
      expect(
        html.split('HOTEL INFORMATION')[1]!.split('</section>')[0],
      ).toContain('دوتخته');
    },
  );
  it('does not add a room summary when no hotel was selected', () => {
    const output = structuredClone(printFixture);
    output.contract.hotelSelection = null;
    expect(contractPrintHtml(output, printReferences)).not.toContain(
      'اتاق‌های قرارداد:',
    );
    expect(contractRoomSummary(null)).toBe('ندارد');
  });
});
