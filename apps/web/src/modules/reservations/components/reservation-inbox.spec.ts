import { describe, expect, it } from 'vitest';
import type { ReservationIntakeV1 } from '@rubi/contracts';
import { initialDraft } from './reservation-inbox';

const request: ReservationIntakeV1 = {
  id: '10000000-0000-4000-8000-000000000001',
  requestId: '10000000-0000-4000-8000-000000000002',
  contractId: '10000000-0000-4000-8000-000000000003',
  contractVersion: 1,
  branchId: '10000000-0000-4000-8000-000000000004',
  status: 'QUEUED',
  receivedAt: '2026-09-06T00:00:00Z',
  arrangement: null,
  snapshot: {
    version: 1,
    requestId: '10000000-0000-4000-8000-000000000002',
    contractId: '10000000-0000-4000-8000-000000000003',
    contractNumber: 'TEST-1',
    contractVersion: 1,
    customerId: '10000000-0000-4000-8000-000000000005',
    passengerIds: ['guest-1', 'guest-2'],
    passengerAssignments: [
      {
        customerId: 'guest-1',
        displayNameSnapshot: 'مهمان اول',
        ageCategory: 'ADT',
        serviceClientKeys: ['hotel'],
      },
      {
        customerId: 'guest-2',
        displayNameSnapshot: 'مهمان دوم',
        ageCategory: 'CHD',
        serviceClientKeys: [],
      },
    ],
    serviceSelections: [
      { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'هتل' },
    ],
    selectedTicketOfferIds: [],
    hotelSelection: {
      serviceClientKey: 'hotel',
      hotelId: 'hotel',
      hotelNameSnapshot: 'هتل تست',
      cityId: 'city',
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
      roomCount: 2,
      singleRoomCount: 1,
      doubleRoomCount: 1,
      extraBedCount: 0,
      roomTypeId: 'room',
      occupancy: 1,
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    },
    createdAt: '2026-09-06T00:00:00Z',
  },
};

describe('reservation hotel arrangement draft', () => {
  it('starts from the Sales room split and assigned hotel members', () => {
    expect(initialDraft(request)).toMatchObject({
      expectedVersion: 0,
      roomCount: 2,
      singleRoomCount: 1,
      doubleRoomCount: 1,
      hotelGuestCustomerIds: ['guest-1'],
    });
  });
  it('continues from the latest reservation revision', () => {
    expect(
      initialDraft({
        ...request,
        arrangement: {
          version: 3,
          roomCount: 1,
          singleRoomCount: 0,
          doubleRoomCount: 1,
          extraBedCount: 1,
          hotelGuestCustomerIds: ['guest-1', 'guest-2'],
          reason: 'تغییر',
          updatedAt: '2026-09-06T01:00:00Z',
          updatedByUserId: 'user',
        },
      }),
    ).toMatchObject({
      expectedVersion: 3,
      roomCount: 1,
      extraBedCount: 1,
      hotelGuestCustomerIds: ['guest-1', 'guest-2'],
    });
  });
});
