/** Finance-owned company accounts; all identifiers in ordinary lists are masked. */
export interface CompanyBankAccountV1 {
  accountingCode?: string | null;
  id: string;
  bankId: string;
  branchId: string | null;
  title: string;
  currencyCode: string | null;
  version: number;
  isActive: boolean;
  isExternal?: boolean;
  accountNumber: string | null;
  cardNumber: string | null;
  iban: string | null;
}
export interface CompanyBankAccountInputV1 {
  branchId?: string | null;
  title: string;
  currencyCode: string | null;
  accountNumber?: string | null;
  cardNumber?: string | null;
  iban?: string | null;
  isActive: boolean;
  isExternal?: boolean;
}
export interface CompanyBankAccountOptionsV1 {
  branches: readonly { id: string; name: string }[];
  currencies: readonly { code: string; name: string }[];
  canManage: boolean;
}
