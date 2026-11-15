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
}
export interface FloatingTourImportOptions {
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
