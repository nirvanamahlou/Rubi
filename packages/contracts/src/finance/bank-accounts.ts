/** Finance-owned company accounts; all identifiers in ordinary lists are masked. */
export interface CompanyBankAccountV1 {
  id: string;
  bankId: string;
  branchId: string;
  title: string;
  currencyCode: string;
  version: number;
  isActive: boolean;
  accountNumber: string | null;
  cardNumber: string | null;
  iban: string | null;
}
export interface CompanyBankAccountInputV1 {
  title: string;
  currencyCode: string;
  accountNumber?: string | null;
  cardNumber?: string | null;
  iban?: string | null;
  isActive: boolean;
}
export interface CompanyBankAccountOptionsV1 {
  branches: readonly { id: string; name: string }[];
  currencies: readonly { code: string; name: string }[];
  canManage: boolean;
}
