import type { LegacyServiceParty } from './legacy-service-parties';
import type { SalesPassengerHotelStayV1 } from './passenger-hotel-stays';

export interface SalesPassengerCompletionFormV1 {
  version: number;
  departureDate: string;
  services: {
    key: string;
    title: string;
    kind: string;
    direction: string | null;
    party: LegacyServiceParty;
  }[];
  hotel: {
    serviceKey: string;
    checkInDate: string;
    checkOutDate: string;
  } | null;
  available: boolean;
}
export interface SalesPassengerCompletionCommandV1 {
  operationId: string;
  expectedVersion: number;
  passengers: {
    customerId: string;
    /** Booked category when the person's birth date is unknown; never a fabricated birth date. */
    ageCategory?: 'ADT' | 'CHD' | 'INF';
    serviceClientKeys: string[];
    hotelStay?: SalesPassengerHotelStayV1;
  }[];
}
