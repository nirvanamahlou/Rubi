import { describe, expect, it } from 'vitest';
import type { CustomerDetail } from '@nora/contracts';
import type { RequestView } from '../foundation/model';
import type { ReservationFormIntake } from '../model/reservation-form';
import {
  loadReservationContractParty,
  reservationGeneralDetailGroups,
  RESERVATION_CUSTOMER_AUDIT_REASON,
} from './reservation-general-details';

const request = {
  id: 'request-1',
  contractNumber: 'SC-TEST-001',
  branchId: 'branch-1',
  branchName: 'دفتر مرکزی',
  issuerName: 'فروشنده نمونه',
  customerName: 'مشتری نمونه',
  salesCounter: 'کاربر فروش',
  assignee: 'کاربر رزرواسیون',
  passengerNames: ['SAMPLE / ADULT', 'SAMPLE / CHILD'],
  services: [],
  priority: 'UNSPECIFIED',
  deadline: null,
  createdAt: '2026-09-10T08:00:00Z',
  status: 'WAITING_SUPPLIER',
  issues: [],
  hotelNotes: 'TWIN BED',
} as RequestView;

const intake = {
  receivedAt: '2026-09-10T08:00:00Z',
  snapshot: {
    contractNumber: 'SC-TEST-001',
    customerId: 'customer-1',
    createdAt: '2026-09-09T08:00:00Z',
    passengerIds: ['adult-1', 'child-1'],
    passengerAssignments: [
      {
        customerId: 'adult-1',
        displayNameSnapshot: 'SAMPLE / ADULT',
        ageCategory: 'ADT',
      },
      {
        customerId: 'child-1',
        displayNameSnapshot: 'SAMPLE / CHILD',
        ageCategory: 'CHD',
      },
    ],
    serviceSelections: [
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        titleSnapshot: 'اقامت هتل',
        metadata: {
          supplierName: 'Sample Supplier',
          reservationNote: 'اتاق‌ها کنار هم باشند',
        },
        pricing: [
          {
            version: 1,
            currencyCode: 'USD',
            daySale: { basis: 'TOTAL', amount: '1200' },
            agreed: { basis: 'TOTAL', amount: '1100' },
          },
        ],
      },
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        titleSnapshot: 'بلیط رفت و برگشت',
      },
    ],
    ticketSelections: [
      {
        serviceClientKey: 'flight',
        direction: 'OUTBOUND',
        offerId: 'offer-1',
        originId: 'origin-1',
        destinationId: 'city-1',
        departureAt: '2026-10-01T07:30:00Z',
        arrivalAt: '2026-10-01T10:00:00Z',
        carrierNameSnapshot: 'SAMPLE AIR',
        serviceNumberSnapshot: 'SA101',
        cabinClassCode: 'Y',
      },
    ],
    hotelSelection: {
      hotelId: 'hotel-1',
      hotelNameSnapshot: 'Sample Hotel',
      cityId: 'city-1',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-07',
      roomCount: 2,
      doubleRoomCount: 1,
      singleRoomCount: 1,
      extraBedCount: 0,
      roomTypeId: 'room-1',
      mealServiceId: 'meal-1',
    },
  },
  workflow: {
    supplierStatus: 'REQUESTED',
    voucherIssued: false,
    insuranceIssued: false,
    roomOrder: ['adult-1', 'child-1'],
    ageOverrides: {},
    note: '',
  },
} as unknown as ReservationFormIntake;

describe('reservation general details', () => {
  it.each(['persian', 'gregorian'] as const)(
    'uses the saved %s hotel calendar in hotel-only route dates',
    (calendar) => {
      const saved = structuredClone(intake);
      saved.snapshot.ticketSelections = [];
      saved.snapshot.serviceSelections =
        saved.snapshot.serviceSelections.filter(
          (service) => service.kind === 'HOTEL',
        );
      saved.snapshot.serviceSelections[0]!.metadata = {
        dateCalendarSystem: calendar,
      };
      saved.snapshot.hotelSelection!.serviceClientKey = 'hotel';
      const groups = reservationGeneralDetailGroups(saved, request);
      const field = (label: string) =>
        groups
          .flatMap((group) => group.fields)
          .find(([key]) => key === label)?.[1];
      const expected = calendar === 'gregorian' ? '01/10/2026' : '۱۴۰۵/۷/۹';
      expect(field('تاریخ رفت')).toBe(expected);
      expect(field('ورود هتل')).toBe(expected);
    },
  );

  it('keeps flight and hotel calendars independent and uses Tehran flight days', () => {
    const saved = structuredClone(intake);
    saved.snapshot.hotelSelection!.serviceClientKey = 'hotel';
    saved.snapshot.serviceSelections[0]!.metadata = {
      dateCalendarSystem: 'persian',
    };
    saved.snapshot.serviceSelections[1]!.metadata = {
      dateCalendarSystem: 'gregorian',
    };
    saved.snapshot.ticketSelections![0]!.departureAt = '2026-10-01T23:00:00Z';
    saved.snapshot.serviceSelections = [
      ...saved.snapshot.serviceSelections,
      {
        ...saved.snapshot.serviceSelections[1]!,
        clientKey: 'return',
        metadata: { dateCalendarSystem: 'persian' },
      },
    ];
    saved.snapshot.ticketSelections = [
      ...saved.snapshot.ticketSelections!,
      {
        ...saved.snapshot.ticketSelections![0]!,
        serviceClientKey: 'return',
        direction: 'RETURN',
        departureAt: '2026-10-07T07:30:00Z',
      },
    ];
    const groups = reservationGeneralDetailGroups(saved, request);
    const field = (label: string) =>
      groups
        .flatMap((group) => group.fields)
        .find(([key]) => key === label)?.[1];
    expect(field('تاریخ رفت')).toBe('02/10/2026');
    expect(field('زمان رفت')).toContain('02/10/2026');
    expect(field('ورود هتل')).toBe('۱۴۰۵/۷/۹');
    expect(field('تاریخ برگشت')).toBe('۱۴۰۵/۷/۱۵');
    expect(field('زمان برگشت')).toContain('۱۴۰۵/۷/۱۵');
  });

  it('uses compatible calendars when old contracts have no recorded basis', () => {
    const groups = reservationGeneralDetailGroups(intake, request);
    const field = (label: string) =>
      groups
        .flatMap((group) => group.fields)
        .find(([key]) => key === label)?.[1];
    expect(field('تاریخ رفت')).toBe('۱۴۰۵/۷/۹');
    expect(field('ورود هتل')).toBe('01/10/2026');
    expect(field('زمان برگشت')).toBe('در اطلاعات قرارداد ثبت نشده');
  });
  it('shows the recorded contract, hotel, rooms, passengers, flight and prices', () => {
    const groups = reservationGeneralDetailGroups(
      intake,
      request,
      {
        'hotel-1': {
          attributes: { englishName: 'SAMPLE HOTEL', starRating: 5 },
        } as never,
        'city-1': {
          attributes: { englishName: 'ANTALYA', countryId: 'country-1' },
        } as never,
        'room-1': { attributes: { englishName: 'SUPERIOR ROOM' } } as never,
        'meal-1': { attributes: { englishName: 'UALL' } } as never,
      },
      {
        displayName: 'طرف قرارداد نمونه',
        kind: 'person',
        status: 'active',
        maskedPrimaryContact: '0912***4321',
        contacts: [
          {
            id: 'phone-1',
            type: 'phone',
            isPrimary: true,
            maskedValue: '0912***4321',
            value: '09123454321',
          },
          {
            id: 'email-1',
            type: 'email',
            isPrimary: false,
            maskedValue: 's***@example.test',
            value: 'sample@example.test',
          },
        ],
        addresses: [{ label: 'آدرس نمونه' }],
      } as unknown as CustomerDetail,
      'TURKEY',
      true,
    );
    const content = JSON.stringify(groups);

    for (const expected of [
      'SC-TEST-001',
      'طرف قرارداد نمونه',
      '09123454321',
      'sample@example.test',
      'آدرس نمونه',
      'درخواست پشتیبانی',
      'TURKEY',
      'ANTALYA',
      'SAMPLE HOTEL',
      'SUPERIOR ROOM',
      'UALL',
      'DBL 1',
      'SGL 1',
      'ADL 1',
      'CHD 1',
      'SAMPLE AIR',
      'SA101',
      '1,200 $',
      '1,100 $',
      'اتاق‌ها کنار هم باشند',
    ])
      expect(content).toContain(expected);
    expect(content).toContain('در اطلاعات ارسالی به رزرواسیون موجود نیست');
    expect(intake.snapshot.hotelSelection?.roomCount).toBe(2);
  });

  it('uses the audited sensitive customer read and falls back to masked detail', async () => {
    const calls: (string | undefined)[] = [];
    const customer = { displayName: 'Sample' } as CustomerDetail;
    const revealed = await loadReservationContractParty(
      'customer-1',
      async (_id, reason) => {
        calls.push(reason);
        return { data: customer };
      },
    );
    expect(revealed).toEqual({ customer, sensitive: true });
    expect(calls).toEqual([RESERVATION_CUSTOMER_AUDIT_REASON]);

    calls.length = 0;
    const masked = await loadReservationContractParty(
      'customer-1',
      async (_id, reason) => {
        calls.push(reason);
        if (reason) throw new Error('forbidden');
        return { data: customer };
      },
    );
    expect(masked).toEqual({ customer, sensitive: false });
    expect(calls).toEqual([RESERVATION_CUSTOMER_AUDIT_REASON, undefined]);
  });
});
