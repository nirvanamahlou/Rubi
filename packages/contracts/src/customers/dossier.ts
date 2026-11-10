export type CustomerDossierSectionId =
  | 'requests'
  | 'contracts'
  | 'services'
  | 'tickets'
  | 'vouchers'
  | 'insurance'
  | 'payments'
  | 'checks'
  | 'support';
export interface CustomerDossierRow {
  id: string;
  reference: string;
  status: string;
  occurredAt: string;
  amount?: string;
  currencyCode?: string;
}
export interface CustomerDossierSection {
  id: CustomerDossierSectionId;
  state: 'ready' | 'forbidden' | 'unavailable';
  rows: CustomerDossierRow[];
  hasMore: boolean;
}
export interface CustomerDossierResponse {
  data: { customerId: string; sections: CustomerDossierSection[] };
}
