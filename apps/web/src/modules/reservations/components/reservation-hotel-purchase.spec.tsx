import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
  VoucherSettingsV1,
} from '@nora/contracts';
import {
  hotelPurchaseTotal,
  hotelPassengerPurchaseInput,
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
    snapshot: { serviceSelections: [], passengerIds: [] },
    workflow,
  }) as unknown as ReservationIntakeV1 & {
    workflow?: TravelWorkflowStateV1;
  };

it('prices unnamed legacy hotel guests from service counts without customer identities', () => {
  const snapshot = {
    passengerIds: [],
    passengerAssignments: [],
    serviceSelections: [
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        metadata: {
          legacyServicePartiesV2: JSON.stringify({
            hotel: { adults: 2, children: 1, infants: 1 },
          }),
        },
      },
    ],
    hotelSelection: {
      serviceClientKey: 'hotel',
      hotelNameSnapshot: 'Hotel',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-07',
    },
  } as unknown as ReservationIntakeV1['snapshot'];
  const guests = reservationHotelPassengers(snapshot, 'hotel');
  expect(guests.map((p) => [p.name, p.age])).toEqual([
    ['مسافر 1', 'ADT'],
    ['مسافر 2', 'ADT'],
    ['مسافر 3', 'CHD'],
    ['مسافر 4', 'INF'],
  ]);
  const pricing = hotelPassengerPurchaseInput(
    guests,
    { 'legacy:0': '10', 'legacy:2': '5' },
    6,
  );
  expect(pricing).toEqual({
    amount: '90',
    passengerPrices: [],
    legacyGuestPrices: [
      { guestIndex: 0, nightlyAmount: '10' },
      { guestIndex: 2, nightlyAmount: '5' },
    ],
  });
  const html = renderToStaticMarkup(
    <ReservationHotelPurchase
      request={{ ...request(), snapshot }}
      onSaved={() => {}}
    />,
  );
  expect(html).toContain('قیمت هر شب مسافر 1');
  expect(html).toContain('نوزاد');
  expect(snapshot.passengerIds).toEqual([]);
});

it('shows contract purchase margin in the purchase form only for finance', () => {
  const render = (permissions: string[]) =>
    renderToStaticMarkup(
      <AccessPermissionsProvider value={permissions}>
        <ReservationHotelPurchase
          request={{ ...request(), contractId: 'synthetic-contract' }}
          onSaved={() => undefined}
        />
      </AccessPermissionsProvider>,
    );
  expect(render(['reservations.read'])).not.toContain(
    'هزینه خرید و سود قرارداد',
  );
  expect(render(['finance.read'])).toContain('هزینه خرید و سود قرارداد');
});

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

it('shows passenger nightly fields and contractual nights instead of hotel formula inputs', () => {
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
  expect(html).not.toContain('قیمت پایه هتل');
  expect(html).not.toContain('ضریب هتل');
  expect(html).toContain('قیمت ترانسفر هر نفر');
  expect(html).toContain('تعداد نفرات محاسبه‌شونده');
  expect(html).not.toContain('ضریب ترانسفر');
  expect(html).toContain('تعداد شب قرارداد');
  expect(html).toContain('تعداد شب اقامت: 4');
  expect(html).toContain('قیمت هر شب');
  expect(html).not.toContain('ترانسفر هر مسافر');
});

it('keeps an unsent draft out of purchase context without asking the user to wait', () => {
  const html = renderToStaticMarkup(
    <SupplierFormPurchaseContext
      request={request({
        supplierFormSettings: {} as VoucherSettingsV1,
      } as TravelWorkflowStateV1)}
    />,
  );
  expect(html).toBe('');
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

it('prices only entered guests with exact nightly arithmetic and leaves blank guests absent', () => {
  const passengers = [
    { id: 'one', name: 'Guest One', age: 'ADT' as const },
    { id: 'two', name: 'Guest Two', age: 'CHD' as const },
  ];
  expect(
    hotelPassengerPurchaseInput(passengers, { one: '12.3456', two: '' }, 7),
  ).toEqual({
    amount: '86.4192',
    passengerPrices: [{ customerId: 'one', nightlyAmount: '12.3456' }],
  });
  expect(
    hotelPassengerPurchaseInput(passengers, { one: '10', two: '5.5' }, 3)
      .amount,
  ).toBe('46.5');
  expect(() => hotelPassengerPurchaseInput(passengers, {}, 7)).toThrow();
  expect(() =>
    hotelPassengerPurchaseInput(passengers, { one: '10', two: 'bad' }, 7),
  ).toThrow();
  expect(hotelPassengerPurchaseInput(passengers, { one: '0' }, 7)).toEqual({
    amount: '0',
    passengerPrices: [{ customerId: 'one', nightlyAmount: '0' }],
  });
  expect(transferPurchaseTotal('0', '2')).toBe('0');
  expect(() => hotelPassengerPurchaseInput(passengers, {}, 7)).toThrow();
  expect(() =>
    hotelPassengerPurchaseInput(passengers, { one: '-1' }, 7),
  ).toThrow();
});
it('renders hotel guest names and age categories and restores only saved passenger prices', () => {
  const value = {
    ...request(),
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['one', 'two'],
      passengerAssignments: [
        {
          customerId: 'one',
          displayNameSnapshot: 'Guest One',
          ageCategory: 'ADT',
          serviceClientKeys: ['hotel'],
        },
        {
          customerId: 'two',
          displayNameSnapshot: 'Guest Two',
          ageCategory: 'CHD',
          serviceClientKeys: ['hotel'],
        },
      ],
      serviceSelections: [{ clientKey: 'hotel', kind: 'HOTEL' }],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelNameSnapshot: 'Hotel',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-08',
      },
    },
    servicePurchases: [
      {
        serviceClientKey: 'hotel',
        supplierOrganizationId: 'supplier',
        supplierName: 'Broker',
        currencyCode: 'EUR',
        amount: '70',
        passengerPrices: [
          { customerId: 'one', nightlyAmount: '10', totalAmount: '70' },
        ],
      },
    ],
  } as unknown as ReservationIntakeV1;
  const html = renderToStaticMarkup(
    <ReservationHotelPurchase request={value} onSaved={() => {}} />,
  );
  expect(html).toContain('Guest One');
  expect(html).toContain('Guest Two');
  expect(html).toContain('بزرگسال');
  expect(html).toContain('کودک');
  expect(html).toContain('value="10"');
  expect(html).toContain('جمع خرید هتل: 70');
  expect(html).not.toContain('disabled=""');
});
