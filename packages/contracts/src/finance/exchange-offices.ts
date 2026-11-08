export interface ExchangeOfficeV1 {
  id: string;
  title: string;
  countryId: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  version: number;
  balances: { currencyCode: string; amount: string }[];
}
export interface ExchangeOfficeInputV1 {
  title: string;
  countryId?: string | null;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
  balances?: { currencyCode: string; amount: string }[];
  requestId?: string;
  expectedVersion?: number;
}
export interface ExchangeOfficeListV1 {
  items: ExchangeOfficeV1[];
  page: number;
  hasMore: boolean;
  kpis: { total: number; active: number; usd: string; eur: string };
}
export interface ExchangeOfficeOptionsV1 {
  countries: { id: string; name: string }[];
  currencies: { code: string; name: string }[];
  canManage: boolean;
}
