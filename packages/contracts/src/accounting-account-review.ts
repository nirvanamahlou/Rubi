export const accountReviewAxes = [
  'GROUP',
  'GENERAL',
  'SUBSIDIARY',
  'DETAIL4',
  'DETAIL5',
  'DETAIL6',
  'DETAIL',
  'DETAIL_TYPE',
  'CURRENCY',
  'TRACKING',
] as const;

export type AccountReviewAxis = (typeof accountReviewAxes)[number];

export interface AccountReviewSelection {
  axis: AccountReviewAxis;
  key: string;
  typeId?: string;
  trackingDate?: string | null;
}

export interface AccountReviewRow {
  key: string;
  code: string;
  title: string;
  classificationNumber: string | null;
  trackingDate: string | null;
  opening: string;
  debit: string;
  credit: string;
  balance: string;
  balanceDebit: string;
  balanceCredit: string;
  foreignOpening: string | null;
  foreignDebit: string | null;
  foreignCredit: string | null;
  foreignBalance: string | null;
}

export interface AccountReviewLine {
  id: string;
  journalId: string;
  number: number | null;
  position: number;
  date: string;
  reference: string | null;
  secondaryNumber: string | null;
  status: string;
  journalDescription: string;
  description: string;
  accountCode: string;
  accountTitle: string;
  detail4: string | null;
  detail5: string | null;
  detail6: string | null;
  currency: string | null;
  foreignAmount: string | null;
  rate: string | null;
  trackingNumber: string | null;
  trackingDate: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface AccountReviewResult {
  periodId: string;
  from: string;
  to: string;
  opening: string | null;
  page: number;
  pageSize: number;
  hasNext: boolean;
  rows: AccountReviewRow[];
  lines: AccountReviewLine[];
}
