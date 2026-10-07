import type { FinanceHistoryItemV1 } from './finance';
/** Finance-owned accounting v1. Money and rates are canonical decimal strings. */
export const ACCOUNTING_PERMISSIONS = [
  'finance.journal.read',
  'finance.journal.create',
  'finance.journal.approve',
  'finance.journal.post',
  'finance.journal.reverse',
  'finance.period.close',
] as const;

export type AccountingAttributes = Record<string, string | boolean | string[]>;
export interface AccountingRecord {
  id: string;
  bookId: string;
  code: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  active: boolean;
  version: number;
  attributes: AccountingAttributes;
}
export interface AccountingBookV1 {
  id: string;
  branchId: string;
  code: string;
  title: string;
  baseCurrency: string;
  isMain: boolean;
  allowsPosting: boolean;
  active: boolean;
  version: number;
}
export interface AccountingPeriodV1 {
  id: string;
  bookId: string;
  fiscalYearId: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  version: number;
}
export interface AccountingAccountV1 extends AccountingRecord {
  parentId: string | null;
  level: 'GROUP' | 'GENERAL' | 'SUBSIDIARY';
  nature: 'DEBIT' | 'CREDIT';
  permanent: boolean;
}
export interface AccountingDetailV1 extends AccountingRecord {
  typeId: string;
  parentId: string | null;
  currency: string | null;
}
export interface AccountingConfigurationV1 extends AccountingRecord {
  kind: string;
}
export interface AccountingLineV1 {
  accountId: string | null;
  detail4Id: string | null;
  detail5Id: string | null;
  detail6Id: string | null;
  description: string;
  debit: string;
  credit: string;
  currency: string | null;
  foreignAmount: string | null;
  rate: string | null;
  fxSnapshotId?: string | null;
  attributes: AccountingAttributes;
}
export type AccountingJournalStatus =
  'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'POSTED' | 'CANCELLED';
export interface AccountingJournalV1 {
  id: string;
  bookId: string;
  periodId: string | null;
  typeId: string | null;
  documentDate: string | null;
  description: string;
  reference: string | null;
  status: AccountingJournalStatus;
  number: number | null;
  makerId: string;
  approverId: string | null;
  sourceKey: string | null;
  reversalOfId: string | null;
  postedAt: string | null;
  version: number;
  attributes: AccountingAttributes;
  lines: AccountingLineV1[];
}
export interface AccountingSnapshotV1 {
  book: AccountingBookV1;
  periods: AccountingPeriodV1[];
  accounts: AccountingAccountV1[];
  details: AccountingDetailV1[];
  configurations: AccountingConfigurationV1[];
  fxRates: AccountingFxSnapshotV1[];
}
export interface AccountingFxSnapshotV1 {
  id: string;
  bookId: string;
  currency: string;
  rate: string;
  source: string;
  validFrom: string;
  validTo: string;
  status: 'DRAFT' | 'APPROVED';
  makerId: string;
  approverId: string | null;
  version: number;
}
export interface AccountingCommandV1 {
  key: string;
  expectedVersion?: number;
  payload: Record<string, unknown>;
}
export interface AccountingReportRowV1 {
  accountId: string;
  code: string;
  title: string;
  opening: string;
  debit: string;
  credit: string;
  balance: string;
}
export interface AccountingReportV1 {
  generatedAt: string;
  rows: AccountingReportRowV1[];
  debit: string;
  credit: string;
}
export interface AccountingTurnoverV1 {
  opening: string;
  closing: string;
  page: number;
  total: number;
  rows: {
    journalId: string;
    number: number;
    date: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
  }[];
}
export interface AccountingSourcePageV1 {
  nextCursor: string | null;
  items: (FinanceHistoryItemV1 & {
    accounting: {
      id: string;
      status: AccountingJournalStatus;
      number: number | null;
    } | null;
  })[];
}
