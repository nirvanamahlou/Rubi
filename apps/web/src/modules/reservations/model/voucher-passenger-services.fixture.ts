import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from './reservation-form';
import { defaultVoucherSettings } from './voucher-settings';
export function voucherServiceFixture() {
  const services = [
    {
      clientKey: 'flight-out',
      kind: 'FLIGHT',
      metadata: { direction: 'OUTBOUND' },
    },
    {
      clientKey: 'flight-return',
      kind: 'FLIGHT',
      metadata: { direction: 'RETURN' },
    },
    {
      clientKey: 'transfer-out',
      kind: 'TRANSFER',
      metadata: { direction: 'OUTBOUND' },
    },
    {
      clientKey: 'transfer-return',
      kind: 'TRANSFER',
      metadata: { direction: 'RETURN' },
    },
    { clientKey: 'visa', kind: 'VISA', metadata: {} },
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      metadata: {
        passengerHotelStaysV1: JSON.stringify({
          adult: {
            checkInDate: '2026-10-21',
            checkOutDate: '2026-10-24',
            different: false,
          },
          child: {
            checkInDate: '2026-10-22',
            checkOutDate: '2026-10-25',
            different: true,
          },
        }),
      },
    },
  ];
  const intake = {
    id: '00000000-0000-4000-8000-000000000001',
    receivedAt: '2026-10-01T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC-VOUCHER',
      passengerIds: ['adult', 'child', 'flight', 'hidden'],
      serviceSelections: services,
      ticketSelections: [],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'hotel',
        cityId: 'city',
        roomTypeId: 'room',
        mealServiceId: 'meal',
        hotelNameSnapshot: 'هتل نمونه',
        roomCount: 1,
        checkInDate: '2026-10-21',
        checkOutDate: '2026-10-24',
      },
      passengerAssignments: [
        {
          customerId: 'adult',
          displayNameSnapshot: 'نام فارسی',
          ageCategory: 'ADT',
          serviceClientKeys: [
            'flight-out',
            'flight-return',
            'transfer-out',
            'transfer-return',
            'hotel',
            'visa',
          ],
        },
        {
          customerId: 'child',
          displayNameSnapshot: 'کودک',
          ageCategory: 'CHD',
          childAgeBand: 'AGE_6_12',
          serviceClientKeys: ['flight-out', 'hotel', 'transfer-return'],
        },
        {
          customerId: 'flight',
          displayNameSnapshot: 'فقط پرواز',
          ageCategory: 'ADT',
          serviceClientKeys: ['flight-return'],
        },
        {
          customerId: 'hidden',
          displayNameSnapshot: 'HIDDEN PASSENGER',
          ageCategory: 'ADT',
          serviceClientKeys: ['hotel'],
        },
      ],
    },
    workflow: {
      roomOrder: ['child', 'adult', 'flight', 'hidden'],
      ageOverrides: {},
      note: 'Synthetic notice',
      branding: {
        kind: 'OWN',
        companyCode: 'JAHAN_BASTAN',
        name: 'جهان باستان',
      },
    },
    outputPassengers: [
      {
        customerId: 'adult',
        passportName: 'ADULT PASSPORT',
        hotelChildAgeBand: null,
      },
      {
        customerId: 'child',
        passportName: 'CHILD PASSPORT',
        hotelChildAgeBand: 'CHD_6_TO_12',
      },
      {
        customerId: 'flight',
        passportName: 'FLIGHT ONLY',
        hotelChildAgeBand: null,
      },
    ],
  } as unknown as ReservationFormIntake;
  const refs = Object.fromEntries(
    [
      ['hotel', 'هتل نمونه', 'SAMPLE HOTEL'],
      ['city', 'شهر نمونه', 'SAMPLE CITY'],
      ['meal', 'صبحانه', 'BB'],
      ['room', 'دبل', 'DOUBLE'],
    ].map(([id, name, englishName]) => [
      id,
      { id, name, attributes: { englishName } },
    ]),
  ) as ReservationFormReferences;
  const settings = defaultVoucherSettings(intake, refs);
  settings.flags.withLetterhead = false;
  settings.text.checkIn = '2026-11-01';
  settings.text.checkOut = '2026-11-04';
  settings.text.hotel = 'هتل نمونه';
  settings.text.city = 'شهر نمونه';
  settings.text.roomType = 'دبل';
  settings.passengers.find((p) => p.id === 'hidden')!.selected = false;
  intake.workflow.voucherSettings = settings;
  return { intake, refs };
}
