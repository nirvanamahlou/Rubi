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
    serviceClientKeys: string[];
    hotelStay?: SalesPassengerHotelStayV1;
  }[];
}
