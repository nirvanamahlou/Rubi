import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
  VoucherSettingsV1,
} from '@nora/contracts';
import {
  hotelPurchaseTotal,
  transferPurchaseTotal,
  reservationHotelPassengers,
  reservationTransferPassengers,
  reservationPurchaseServices,
  SupplierFormPurchaseContext,
  ReservationHotelPurchase,
} from './reservation-hotel-purchase';

const request = (workflow?: TravelWorkflowStateV1) =>
  ({
    id: 'request',
    snapshot: { serviceSelections: [] },
    workflow,
  }) as unknown as ReservationIntakeV1 & {
    workflow?: TravelWorkflowStateV1;
  };

it('shows the frozen supplier form as the purchase-price context', () => {
  const settings = {
    text: {
      checkIn: '2026-10-01',
      checkOut: '2026-10-05',
      roomType: 'DBL',
    },
    numbers: {
      singleRooms: 1,
      doubleRooms: 2,
      extraBeds: 1,
      customRooms: 0,
    },
    passengers: [
      { id: 'one', selected: true, roomType: 'DBL', age: 'ADL' },
      { id: 'two', selected: true, roomType: 'DBL', age: 'CHD' },
    ],
  } as unknown as VoucherSettingsV1;
  const html = renderToStaticMarkup(
    <SupplierFormPurchaseContext
      request={request({
        sentSupplierFormSettings: settings,
        sentSupplierFormVersion: 7,
      } as TravelWorkflowStateV1)}
    />,
  );
  expect(html).toContain('آخرین فرم ارسال‌شده به کارگزار');
  expect(html).toContain('2026-10-01');
  expect(html).toContain('DBL:');
  expect(html).toContain('CHD:');
  expect(html).toContain('نسخهٔ ارسال‌شده 7');
});

it('shows service-level base and factor inputs and contract nights without passenger price fields', () => {
  const html = renderToStaticMarkup(
    <ReservationHotelPurchase
      request={
        {
          id: 'request',
          snapshot: {
            contractNumber: 'SC-TEST',
            passengerIds: [],
            serviceSelections: [
              { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
              {
                clientKey: 'transfer',
                kind: 'TRANSFER',
                titleSnapshot: 'Transfer',
              },
            ],
            hotelSelection: {
              serviceClientKey: 'hotel',
              hotelNameSnapshot: 'Hotel',
              checkInDate: '2026-10-01',
              checkOutDate: '2026-10-05',
            },
          },
        } as unknown as ReservationIntakeV1
      }
      onSaved={() => {}}
    />,
  );
  expect(html).toContain('قیمت پایه هتل');
  expect(html).toContain('ضریب هتل');
  expect(html).toContain('قیمت ترانسفر هر نفر');
  expect(html).toContain('تعداد نفرات محاسبه‌شونده');
  expect(html).not.toContain('ضریب ترانسفر');
  expect(html).not.toContain('تعداد شب قرارداد');
  expect(html).toContain('تعداد شب اقامت: 4');
  expect(html).not.toContain('قیمت هر شب');
  expect(html).not.toContain('ترانسفر هر مسافر');
});

it('does not present an unsent draft as purchase context', () => {
  const html = renderToStaticMarkup(
    <SupplierFormPurchaseContext
      request={request({
        supplierFormSettings: {} as VoucherSettingsV1,
      } as TravelWorkflowStateV1)}
    />,
  );
  expect(html).toContain(
    'هنوز نسخه‌ای از فرم رزواسیون برای کارگزار ارسال نشده',
  );
  expect(html).not.toContain('مبنای قیمت خرید:');
});

it('converts a nightly hotel rate into the payable total using the sent stay dates', () => {
  expect(
    hotelPurchaseTotal('125.50', 'NIGHT', '2026-10-01', '2026-10-05'),
  ).toBe('502');
  expect(
    hotelPurchaseTotal('125.50', 'TOTAL', '2026-10-01', '2026-10-05'),
  ).toBe('125.5');
  expect(() =>
    hotelPurchaseTotal('125', 'NIGHT', '2026-10-05', '2026-10-01'),
  ).toThrow();
});

it('keeps ticket purchases out of the Reservations broker form', () => {
  const services = [
    { clientKey: 'flight', kind: 'FLIGHT', titleSnapshot: 'Flight' },
    { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
    { clientKey: 'transfer', kind: 'TRANSFER', titleSnapshot: 'Transfer' },
  ] as unknown as ReservationIntakeV1['snapshot']['serviceSelections'];
  expect(
    reservationPurchaseServices({
      serviceSelections: services,
      hotelSelection: null,
    } as ReservationIntakeV1['snapshot']).map((service) => service.clientKey),
  ).toEqual(['hotel', 'transfer']);
});

it('offers a legacy hotel selection even when its old snapshot lacks services', () => {
  expect(
    reservationPurchaseServices({
      serviceSelections: [],
      hotelSelection: {
        serviceClientKey: 'hotel-legacy',
        hotelNameSnapshot: 'رویال وینگز',
      },
    } as unknown as ReservationIntakeV1['snapshot']).map(
      (service) => service.clientKey,
    ),
  ).toEqual(['hotel-legacy']);
});

it('lists only passengers assigned to the purchased hotel', () => {
  expect(
    reservationHotelPassengers(
      {
        passengerIds: ['one', 'two'],
        passengerAssignments: [
          {
            customerId: 'one',
            displayNameSnapshot: 'مسافر اول',
            ageCategory: 'ADL',
            serviceClientKeys: ['hotel'],
          },
          {
            customerId: 'two',
            displayNameSnapshot: 'مسافر دوم',
            ageCategory: 'ADL',
            serviceClientKeys: ['transfer'],
          },
        ],
      } as unknown as ReservationIntakeV1['snapshot'],
      'hotel',
    ),
  ).toEqual([{ id: 'one', name: 'مسافر اول', age: 'ADL' }]);
});

it('counts a passenger assigned to both transfer directions only once', () => {
  const snapshot = {
    passengerIds: ['one', 'two'],
    passengerAssignments: [
      {
        customerId: 'one',
        displayNameSnapshot: 'مسافر اول',
        ageCategory: 'ADT',
        serviceClientKeys: ['outbound', 'return'],
      },
      {
        customerId: 'two',
        displayNameSnapshot: 'مسافر دوم',
        ageCategory: 'CHD',
        serviceClientKeys: ['return'],
      },
    ],
  } as unknown as ReservationIntakeV1['snapshot'];
  expect(
    reservationTransferPassengers(snapshot, ['outbound', 'return']),
  ).toEqual([
    { id: 'one', name: 'مسافر اول', age: 'ADT' },
    { id: 'two', name: 'مسافر دوم', age: 'CHD' },
  ]);
});

it('calculates transfer by integer passenger count with exact money arithmetic', () => {
  expect(transferPurchaseTotal('25.5', '3')).toBe('76.5');
  expect(transferPurchaseTotal('9007199254740993', '2')).toBe(
    '18014398509481986',
  );
  for (const count of ['0', '-1', '1.5', '', 'NaN', '1e2'])
    expect(() => transferPurchaseTotal('25', count)).toThrow();
});

it('restores separate brokers and separate per-leg amounts without hotel dates', () => {
  const html = renderToStaticMarkup(
    <ReservationHotelPurchase
      request={
        {
          id: 'request',
          snapshot: {
            contractNumber: 'SC-TEST',
            passengerIds: ['one', 'two'],
            serviceSelections: [
              {
                clientKey: 'out',
                kind: 'TRANSFER',
                titleSnapshot: 'ترانسفر رفت',
              },
              {
                clientKey: 'back',
                kind: 'TRANSFER',
                titleSnapshot: 'ترانسفر برگشت',
              },
            ],
          },
          servicePurchases: [
            {
              serviceClientKey: 'out',
              coveredServiceClientKeys: ['out'],
              supplierOrganizationId: 'broker-a',
              supplierName: 'Broker A',
              amount: '50',
              currencyCode: 'USD',
              pricingCalculation: {
                baseAmount: '25',
                factor: '2',
                nights: 1,
                chargeablePassengerCount: 2,
              },
            },
            {
              serviceClientKey: 'back',
              coveredServiceClientKeys: ['back'],
              supplierOrganizationId: 'broker-b',
              supplierName: 'Broker B',
              amount: '90',
              currencyCode: 'EUR',
              pricingCalculation: {
                baseAmount: '30',
                factor: '3',
                nights: 1,
                chargeablePassengerCount: 3,
              },
            },
          ],
        } as unknown as ReservationIntakeV1
      }
      onSaved={() => {}}
    />,
  );
  expect(html).toContain('کارگزار جدا برای ترانسفر رفت و برگشت');
  expect(html).toContain('checked=""');
  expect(html).toContain('Broker A');
  expect(html).toContain('Broker B');
  expect(html).toContain('50');
  expect(html).toContain('90');
  expect(html).not.toContain('disabled=""');
});
