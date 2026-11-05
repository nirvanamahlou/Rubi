export const ledgerPersonTextKeys = [
  'salutation',
  'firstNameSecond',
  'lastNameSecond',
  'alias',
  'economicCode',
  'foreignCode',
  'vatExpiry',
  'group',
  'nationality',
  'citizenship',
  'religion',
  'denomination',
  'education',
  'mobile',
  'telephone',
  'email',
  'marital',
  'marriageDate',
  'identityNumber',
  'identitySerial',
  'fatherName',
  'birthPlace',
  'issueDate',
  'issuePlace',
  'workflowCode',
  'workflowEmail',
] as const;
export type LedgerPersonTextKey = (typeof ledgerPersonTextKeys)[number];
export const ledgerTaxKinds = [
  'registered',
  'article81',
  'exempt',
  'consumer',
] as const;
export type LedgerTaxKind = (typeof ledgerTaxKinds)[number];
export interface PersonTaxRow {
  operation: 'purchase' | 'sale';
  kind: LedgerTaxKind;
}
export interface PersonAddress {
  id: string;
  primary: boolean;
  title: string;
  region: string;
  address: string;
  phone: string;
  postalCode: string;
  fax: string;
  email: string;
}
export interface PersonNote {
  id: string;
  title: string;
  date: string;
  text: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}
export interface LedgerPersonExtras {
  fields: Partial<Record<LedgerPersonTextKey, string>>;
  addresses: PersonAddress[];
  taxRows: PersonTaxRow[];
  notes: PersonNote[];
}
export interface LedgerPersonInput extends LedgerPersonExtras {
  code: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  birthDate: string;
  nationalId?: string;
  version?: number;
}
export interface LedgerPersonView extends Omit<LedgerPersonInput, 'gender'> {
  id: string;
  gender: 'M' | 'F' | '';
  version: number;
}
export const personTitles = ['خانم', 'آقا'] as const;
export const personReligions = ['اسلام', 'زرتشت', 'مسیحیت', 'یهودیت'] as const;
export const personEducation = [
  'بیسواد',
  'ابتدایی',
  'سیکل',
  'دیپلم',
  'کاردانی',
  'لیسانس',
  'فوق لیسانس',
  'دکترا',
  'فوق دکترا',
] as const;
export const personMarital = ['مجرد', 'متأهل', 'معیل'] as const;
