/** Finance-owned company accounts; all identifiers in ordinary lists are masked. */
export type TreasuryBankReferencesV1 = {
  treasuryBookId: string;
  bankAccountTypeId: string;
  bankBranchId: string;
};
export const bankInstitutionKinds = [
  { value: 'BANK', label: 'بانک' },
  { value: 'FINANCIAL_INSTITUTION', label: 'مؤسسه مالی و اعتباری' },
  { value: 'QARD_HASAN_FUND', label: 'صندوق قرض‌الحسنه' },
] as const;

export interface TreasuryBankProfileInputV1 {
  creditLimit: string | null;
  reserveBalance: string | null;
  materiality: string | null;
  backupAccountId: string | null;
  automaticTransfer: boolean;
  transferMethodId: string | null;
  description: string;
  descriptionEn: string;
  notes: string;
  signerIds: string[];
}

export interface CompanyBankAccountV1 {
  bankProfile?: TreasuryBankProfileInputV1 & {
    signers: { id: string; name: string }[];
  };
  treasury?: TreasuryBankReferencesV1;
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
  bankProfile?: TreasuryBankProfileInputV1;
  treasury?: TreasuryBankReferencesV1;
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
