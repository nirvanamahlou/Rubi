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

export const accountingDetailLevels = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type AccountingDetailLevel = (typeof accountingDetailLevels)[number];
export type AccountingDetailField = `detail${AccountingDetailLevel}Id`;
export type AccountingSourceDetailField =
  `sourceDetail${AccountingDetailLevel}Id`;
export type AccountingDetailIds = {
  detail4Id: string | null;
  detail5Id: string | null;
  detail6Id: string | null;
} & Partial<Record<AccountingDetailField, string | null>>;

export const defaultAccountingDetailLevel = 8;
export const maxAccountingDetailLevel = 12;

export function accountingDetailLevelLimit(attributes: AccountingAttributes) {
  const limit = Number(attributes.detailLevelLimit);
  return Number.isInteger(limit) &&
    limit >= defaultAccountingDetailLevel &&
    limit <= maxAccountingDetailLevel
    ? limit
    : defaultAccountingDetailLevel;
}

export function isAccountingDetailLevelEnabled(
  attributes: AccountingAttributes,
  level: AccountingDetailLevel,
) {
  if (level > accountingDetailLevelLimit(attributes)) return false;
  return Array.isArray(attributes.detailLevels)
    ? attributes.detailLevels.includes(String(level))
    : level <= 6;
}

export function accountingDetailTypeIds(
  attributes: AccountingAttributes,
  level: AccountingDetailLevel,
): string[] {
  const ids = attributes[`detail${level}TypeIds`];
  if (Array.isArray(ids)) return ids;
  const legacy = attributes[`detail${level}TypeId`];
  return typeof legacy === 'string' && legacy ? [legacy] : [];
}
export interface AccountingStatementRowV1 {
  id: string;
  journalId: string;
  number: number | null;
  position: number;
  reference: string | null;
  documentDate: string;
  description: string;
  descriptionEn: string;
  currency: string;
  currencyName: string;
  debit: string;
  credit: string;
  foreignDebit: string;
  foreignCredit: string;
}
export interface AccountingStatementBasisV1 {
  checksum: string;
  journalId: string;
  journalVersion: number;
  periodId: string;
  recipientId: string;
  recipientCode: string;
  recipientTitle: string;
  level: number;
  currencyMode: boolean;
  type: 'DEBIT' | 'CREDIT' | 'BOTH';
  balance: string;
  rows: AccountingStatementRowV1[];
}
export interface AccountingStatementV1 {
  id: string;
  bookId: string;
  journalId: string;
  periodId: string;
  number: number;
  recipientNumber: number;
  documentDate: string;
  description: string;
  status: 'CREATED' | 'SENT' | 'CANCELLED';
  makerId: string;
  lastModifierId: string | null;
  makerName?: string | null;
  lastModifierName?: string | null;
  version: number;
  snapshot: AccountingStatementBasisV1;
  notes: unknown[];
}
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
  legalEntityId?: string | null;
  code: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  notes?: string | null;
  baseCurrency: string;
  isMain: boolean;
  allowsPosting: boolean;
  active: boolean;
  version: number;
}
export interface AccountingLedgerCompanyV1 {
  id: string;
  code: string;
  title: string;
}
export interface AccountingBooksV1 {
  books: AccountingBookV1[];
  branches: { id: string; name: string }[];
  company?: AccountingLedgerCompanyV1 | null;
  companies?: AccountingLedgerCompanyV1[];
  isAggregate?: boolean;
  unassignedBooks?: AccountingBookV1[];
}
export interface AccountingPeriodV1 {
  id: string;
  bookId: string;
  fiscalYearId: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  version: number;
  isDefault?: boolean;
}
export interface AccountingAccountV1 extends AccountingRecord {
  parentId: string | null;
  level: 'GROUP' | 'GENERAL' | 'SUBSIDIARY';
  nature: 'DEBIT' | 'CREDIT' | 'ANY';
  permanent: boolean;
}
export interface AccountingDetailV1 extends AccountingRecord {
  sourceConfigurationId?: string | null;
  sourceAccountId?: string | null;
  customerId?: string | null;
  typeId: string;
  parentId: string | null;
  currency: string | null;
}
export interface AccountingConfigurationV1 extends AccountingRecord {
  kind: string;
}
export interface AccountingAccountGroupV1 {
  id: string;
  bookId: string;
  code: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  active: boolean;
  notes?: unknown;
  version: number;
  members: { accountId: string }[];
  detailAllocations?: { accountId: string; detailId: string }[];
}
export interface AccountingDetailGroupV1 {
  id: string;
  bookId: string;
  code: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  active: boolean;
  notes?: unknown;
  version: number;
  members: { detailId: string }[];
}
export interface AccountingTemplateLineV1 extends AccountingDetailIds {
  id: string;
  position: number;
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  role?: 'SOURCE' | 'TARGET' | 'OFFSET' | 'BASIS' | null;
  parentPosition?: number | null;
  percentage: string;
  include: boolean;
}
export interface AccountingTemplateV1 {
  id: string;
  bookId: string;
  kind: 'AUTOMATIC' | 'REVALUATION' | 'CLOSING';
  code: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  active: boolean;
  attributes?: AccountingAttributes;
  version: number;
  voucherTypeId: string | null;
  gainAccountId: string | null;
  lossAccountId: string | null;
  retainedAccountId: string | null;
  lines: AccountingTemplateLineV1[];
}
export interface AccountingJournalStateEventV1 {
  id: string;
  journalId: string;
  commandId: string;
  actorId: string;
  sequence: number;
  eventType: 'CREATE' | 'STATUS' | 'MOVE';
  fromStatus: AccountingJournalStatus | null;
  toStatus: AccountingJournalStatus | null;
  journalVersion: number;
  oldPeriodId: string | null;
  newPeriodId: string | null;
  oldDocumentDate: string | null;
  newDocumentDate: string | null;
  reason: string | null;
  occurredAt: string;
}
export interface AccountingLineV1 extends AccountingDetailIds {
  id?: string;
  accountId: string | null;
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
  | 'MEMORANDUM'
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'CANCELLED';
export interface AccountingJournalV1 {
  hasVisibleAttachment?: boolean;
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
  makerName?: string | null;
  approverName?: string | null;
  lastModifierName?: string | null;
  deletedAt?: string | null;
  deletedByName?: string | null;
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
  accountGroups: AccountingAccountGroupV1[];
  detailGroups: AccountingDetailGroupV1[];
  templates: AccountingTemplateV1[];
  subsidiaryMappings?: AccountingSubsidiaryMappingV1[];
  detailConversions?: AccountingDetailTypeConversionV1[];
}
export interface AccountingSubsidiaryMappingV1
  extends
    AccountingDetailIds,
    Partial<Record<AccountingSourceDetailField, string | null>> {
  id: string;
  bookId: string;
  sourceAccountId: string;
  sourceKey?: string;
  targetAccountId: string;
  version: number;
}
export interface AccountingDetailTypeConversionV1 {
  id: string;
  bookId: string;
  userTypeId: string;
  systemTypeId: string;
  entity: string;
  date: string;
  description: string | null;
  state: 'REGISTERED' | 'CONVERTED';
  notes?: unknown;
  version: number;
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
  /** Gross movement before the selected range; never inferred from net opening. */
  priorDebit?: string;
  priorCredit?: string;
}
export interface AccountingReportV1 {
  generatedAt: string;
  rows: AccountingReportRowV1[];
  debit: string;
  credit: string;
  table?: {
    structure: string;
    headers: string[];
    rows: { accountId: string; values: string[] }[];
    totals: string[];
  };
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
