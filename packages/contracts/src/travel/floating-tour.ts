import type { SalesFlightAirportV1 } from '../sales/contract-flights';

/** Sales-only floating tour prices; never procurement costs or charter seats. */
export type FloatingTourMoney = {
  currency: 'IRR' | 'USD' | 'EUR' | 'TRY';
  amount: string;
};
export type FloatingTourGroup =
  'double' | 'single' | 'extra' | 'childBed' | 'childNoBed' | 'infant';
export interface FloatingTourStay {
  hotelId: string;
  hotelName: string;
  cityId: string;
  room: string;
  service: string;
  location: string;
  nights: number;
}
export interface FloatingTourSaleRow {
  sourceRows: number[];
  startsOn: string | null;
  endsOn: string | null;
  nights: number;
  stays: FloatingTourStay[];
  prices: Partial<Record<FloatingTourGroup, FloatingTourMoney[]>>;
  commission: FloatingTourMoney[];
  flightSchedule?: FloatingTourFlightSchedule;
}

export interface FloatingTourFlightLeg {
  departureAt: string;
  arrivalAt: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: 'ECONOMY' | 'BUSINESS' | 'FIRST';
  originAirport: SalesFlightAirportV1;
  destinationAirport: SalesFlightAirportV1;
}

/** Civil dates are Tehran dates. Stored flight timestamps are UTC. */
export interface FloatingTourFlightSchedule {
  startsOn: string;
  endsOn: string;
  outbound: FloatingTourFlightLeg;
  inbound: FloatingTourFlightLeg;
}
export interface FloatingTourFlightPattern {
  outbound: FloatingTourFlightInput;
  inbound: FloatingTourFlightInput;
}

export interface FloatingTourFlightInput extends Omit<
  FloatingTourFlightLeg,
  'departureAt' | 'arrivalAt'
> {
  departureClock: string;
  arrivalClock: string;
}

export interface FloatingTourImportOptions {
  flightPattern?: FloatingTourFlightPattern | undefined;
  /** Ordered stay nights; cities are resolved from the Excel hotel references. */
  destinationNights?: number[] | undefined;
  nights: number;
  mode: 'DATED' | 'MONTHLY';
  calendar?: 'PERSIAN' | 'GREGORIAN';
  months?: number[];
  combined?: boolean;
}
export interface FloatingTourSaleSet {
  version: number;
  dated: FloatingTourSaleRow[];
  monthly: {
    calendar: 'PERSIAN' | 'GREGORIAN';
    months: number[];
    rows: FloatingTourSaleRow[];
  } | null;
}
export interface FloatingTourImportPreview {
  exchangeRates: Record<string, string>;
  packageVersion: number;
  expectedVersion: number;
  digest: string;
  rows: FloatingTourSaleRow[];
  options: FloatingTourImportOptions;
  warnings: string[];
}

export interface FloatingTourWebsiteCandidate {
  id: string;
  branchId: string;
  name: string;
  destinationId: string;
  destinationIds: string[];
  canPublish: boolean;
  periods: FloatingTourWebsitePeriod[];
}
export interface FloatingTourWebsitePeriod {
  key: string;
  startsOn: string | null;
  endsOn: string | null;
  nights: number;
  monthly: { calendar: 'PERSIAN' | 'GREGORIAN'; months: number[] } | null;
}
