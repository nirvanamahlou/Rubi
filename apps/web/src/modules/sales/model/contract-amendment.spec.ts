import { expect, it } from 'vitest';
import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  type VoucherSettingsV1,
} from '@rubi/contracts';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
it('renders the recorded operational hotel amendment while preserving commercial totals and base data', () => {
  const settings = {
    text: Object.fromEntries(voucherTextKeys.map((k) => [k, ''])),
    numbers: Object.fromEntries(voucherNumberKeys.map((k) => [k, 0])),
    flags: Object.fromEntries(voucherFlagKeys.map((k) => [k, true])),
    passengers: [],
  } as unknown as VoucherSettingsV1;
  Object.assign(settings.text, {
    hotel: 'AMENDED HOTEL',
    roomType: 'SGL AMENDMENT',
    meal: 'UALL AMENDMENT',
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
  });
  settings.numbers.singleRooms = 1;
  const output = structuredClone(printFixture);
  settings.passengers = [
    {
      id: output.contract.passengersDetail[0]!.customerId,
      selected: true,
      roomType: 'SGL AMENDMENT',
      age: 'INF',
    },
  ];
  const original = structuredClone(output.contract.hotelSelection);
  output.contract.servicesDetail[0]!.metadata = {
    reservationFormAmendment: JSON.stringify({ version: 1, settings }),
  };
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('AMENDED HOTEL');
  expect(html).toContain('SGL AMENDMENT');
  expect(html).toContain('UALL AMENDMENT');
  expect(html).toContain('نوزاد');
  expect(html).toContain(
    'مبالغ و تعهدات مالی قرارداد با این اصلاح تغییر نکرده‌اند.',
  );
  expect(output.contract.hotelSelection).toEqual(original);
  expect(output.contract.priceComponents).toEqual(
    printFixture.contract.priceComponents,
  );
});
