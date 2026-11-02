/** Read-only Sales projection for one exact dated Ticket Catalog offer. */
export interface FlightLoadCompositionV1 {
  adults: number;
  children2To6: number;
  children6To12: number;
  childrenUnknownAge: number;
  infants: number;
  passengers: number;
  seats: number;
}
export interface FlightLoadContractV1 extends FlightLoadCompositionV1 {
  id: string;
  contractNumber: string;
  customerName: string;
  status: string;
  direction: 'OUTBOUND' | 'RETURN';
  originId: string;
  destinationId: string;
  originName: string;
  destinationName: string;
  departureAt: string;
  outboundAt: string | null;
  returnAt: string | null;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: string;
}
export interface FlightLoadContractsV1 {
  version: 1;
  offerId: string;
  data: FlightLoadContractV1[];
  totals: FlightLoadCompositionV1 & { contracts: number };
}
