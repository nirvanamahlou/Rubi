import { expect, it } from 'vitest';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
it('keeps recorded operational reservation data out of the sales contract', () => {
  const settings = {
    text: {
      contractPartyName: 'AMENDED CONTRACT PARTY',
      hotel: 'AMENDED HOTEL',
      roomType: 'SGL AMENDMENT',
      meal: 'UALL AMENDMENT',
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
    },
    numbers: { singleRooms: 1 },
    passengers: [] as Array<{
      id: string;
      selected: boolean;
      roomType: string;
      age: string;
      hotelChildAgeBand: string;
    }>,
  };
  const output = structuredClone(printFixture);
  settings.passengers = [
    {
      id: output.contract.passengersDetail[0]!.customerId,
      selected: true,
      roomType: 'SGL AMENDMENT',
      age: 'CHD',
      hotelChildAgeBand: 'CHD_2_TO_6',
    },
  ];
  const original = structuredClone(output.contract.hotelSelection);
  output.contract.servicesDetail[0]!.metadata = {
    reservationFormAmendment: JSON.stringify({ version: 1, settings }),
  };
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('مشتری نمونه');
  expect(html).not.toContain('AMENDED CONTRACT PARTY');
  expect(html).not.toContain('AMENDED HOTEL');
  expect(html).not.toContain('SGL AMENDMENT');
  expect(html).not.toContain('UALL AMENDMENT');
  expect(html).not.toContain('کودک · ۲ تا ۶ سال');
  expect(html).not.toContain('اصلاحات عملیاتی ثبت‌شده در قرارداد');
  expect(output.contract.hotelSelection).toEqual(original);
  expect(output.contract.priceComponents).toEqual(
    printFixture.contract.priceComponents,
  );
});
