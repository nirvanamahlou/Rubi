export interface HotelRegisteredPeriodsQueryV1 {
  branchId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
}

/** Read-only latest active pack metadata; no purchase/sale amounts. */
export interface HotelRegisteredPeriodV1 {
  hotelRateId: string;
  packId: string;
  batchId: string;
  branchId: string;
  cityId: string;
  cityName: string;
  hotelId: string;
  hotelName: string;
  brokerName: string;
  currencyCode: string;
  checkIn: string;
  checkOut: string;
  version: number;
  tourDepartureId: string | null;
  sharedPeriod: boolean;
}

export interface HotelRegisteredPeriodsPageV1 {
  version: 1;
  data: readonly HotelRegisteredPeriodV1[];
  total: number;
  page: number;
  pageSize: 50;
}
