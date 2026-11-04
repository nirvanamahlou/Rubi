import type { PersonAddress, PersonNote, PersonTaxRow } from './ledger-person';
export const ledgerCompanyTypes = [
  'سهامی عام',
  'سهامی خاص',
  'با مسئولیت محدود',
  'تعاونی',
  'سازمان',
  'اداره کل',
  'ارگان دولتی',
  'وزارتخانه',
  'تضامنی',
  'سایر',
] as const;
export const ledgerCompanyFields = [
  'secondName',
  'abbreviation',
  'foreignCode',
  'companyType',
  'activity',
  'group',
  'referenceCompany',
  'website',
  'email',
  'telephone',
  'vatExpiry',
  'workflowCode',
  'workflowEmail',
] as const;
export interface LedgerCompanyExtras {
  fields: Partial<Record<(typeof ledgerCompanyFields)[number], string>>;
  addresses: PersonAddress[];
  notes: PersonNote[];
  taxRows: PersonTaxRow[];
}
export interface LedgerCompanyInput extends LedgerCompanyExtras {
  code: string;
  name: string;
  nationalId: string;
  economicCode: string;
  registrationNumber: string;
  version?: number;
  organizationVersion?: number;
}
export interface LedgerCompanyView extends LedgerCompanyInput {
  id: string;
  version: number;
  organizationVersion: number;
}
