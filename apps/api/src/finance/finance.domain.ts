import {
  hasFinancePermission,
  type CheckDirection,
  type CheckStatus,
  type FinanceAction,
  type FinancePublicReference,
  type FinancialReleaseBasis,
  type FinancialReleaseStatus,
} from '@rubi/contracts';

import { FinanceDomainError, Money } from './finance.money';

export type AccountType =
  'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountLevel = 'GENERAL' | 'SUBSIDIARY' | 'DETAIL';
export type JournalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'REVERSED'
  | 'CANCELLED';

export interface Account {
  id: string;
  legalEntityReference: string;
  code: string;
  title: string;
  type: AccountType;
  level: AccountLevel;
  parentAccountReference: string | null;
  currencyMode: 'BASE_ONLY' | 'MULTI_CURRENCY';
  postingAllowed: boolean;
  active: boolean;
  version: number;
}

export interface PartyAccount {
  id: string;
  partyReference: FinancePublicReference;
  accountReference: string;
  legalEntityReference: string;
  active: boolean;
}

export interface SubLedgerDimension {
  partyReference: FinancePublicReference | null;
  costCenterReference: string | null;
  projectReference: string | null;
  contractReference: FinancePublicReference | null;
  tourReference: FinancePublicReference | null;
  routeReference: FinancePublicReference | null;
  serviceReference: FinancePublicReference | null;
  sellerReference: string | null;
}

export interface ExchangeRateSnapshot {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rate: string;
  sourceReference: string;
  validAt: string;
  approvalStatus: 'DRAFT' | 'APPROVED';
  approvedByReference: string | null;
}

export interface JournalLineInput {
  accountReference: string;
  direction: 'DEBIT' | 'CREDIT';
  transactionAmount: Money;
  baseAmount: Money;
  dimension: SubLedgerDimension;
  exchangeRate: ExchangeRateSnapshot | null;
}

export class JournalEntry {
  readonly lines: readonly JournalLineInput[];

  constructor(
    public readonly id: string,
    public readonly legalEntityReference: string,
    public readonly fiscalPeriodReference: string,
    public readonly documentDate: string,
    public readonly description: string,
    lines: readonly JournalLineInput[],
    public readonly sourceReference: FinancePublicReference | null,
    public readonly status: JournalStatus,
    public readonly version: number,
  ) {
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(documentDate)
    ) {
      throw new FinanceDomainError(
        'INVALID_UTC_TIME',
        'Journal document time must be UTC ISO-8601.',
      );
    }
    if (description.trim().length < 3) {
      throw new FinanceDomainError(
        'INVALID_DESCRIPTION',
        'Journal description is required.',
      );
    }
    if (lines.length < 2) {
      throw new FinanceDomainError(
        'INSUFFICIENT_LINES',
        'A journal entry requires at least two lines.',
      );
    }
    for (const line of lines) {
      if (!line.accountReference.trim()) {
        throw new FinanceDomainError(
          'ACCOUNT_REQUIRED',
          'Every journal line requires an account reference.',
        );
      }
      if (line.baseAmount.isNegative) {
        throw new FinanceDomainError(
          'NEGATIVE_JOURNAL_LINE',
          'Journal line amounts must not be negative.',
        );
      }
      if (line.transactionAmount.isNegative) {
        throw new FinanceDomainError(
          'NEGATIVE_JOURNAL_LINE',
          'Transaction amounts must not be negative.',
        );
      }
      if (
        line.transactionAmount.currencyCode !== line.baseAmount.currencyCode &&
        !line.exchangeRate
      ) {
        throw new FinanceDomainError(
          'FX_SNAPSHOT_REQUIRED',
          'Foreign-currency lines require an exchange-rate snapshot.',
        );
      }
    }
    this.lines = Object.freeze([...lines]);
  }

  balance(): { debit: Money; credit: Money; balanced: boolean } {
    const currencyCode = this.lines[0]!.baseAmount.currencyCode;
    let debit = Money.zero(currencyCode);
    let credit = Money.zero(currencyCode);
    for (const line of this.lines) {
      if (line.baseAmount.currencyCode !== currencyCode) {
        throw new FinanceDomainError(
          'BASE_CURRENCY_MISMATCH',
          'All base amounts must use the legal entity base currency.',
        );
      }
      if (line.direction === 'DEBIT') debit = debit.add(line.baseAmount);
      else credit = credit.add(line.baseAmount);
    }
    return { debit, credit, balanced: debit.equals(credit) };
  }

  validateForPosting(): void {
    if (this.status !== 'APPROVED') {
      throw new FinanceDomainError(
        'JOURNAL_NOT_APPROVED',
        'Only an approved journal can be proposed for posting.',
      );
    }
    if (!this.balance().balanced) {
      throw new FinanceDomainError(
        'UNBALANCED_JOURNAL',
        'Debit and credit must balance in base currency.',
      );
    }
  }
}

export interface Receivable {
  id: string;
  invoiceReference: string;
  partyAccountReference: string;
  originalAmount: Money;
  openAmount: Money;
  dueAt: string;
  status: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'OVERDUE' | 'DISPUTED';
  version: number;
}

export interface Payable extends Omit<Receivable, 'status'> {
  status: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'OVERDUE' | 'ON_HOLD';
}

export interface Receipt {
  id: string;
  financialAccountReference: string;
  partyAccountReference: string;
  amount: Money;
  method:
    'CASH' | 'CARD' | 'TRANSFER' | 'GATEWAY' | 'CHECK' | 'CREDIT' | 'MIXED';
  allocationReferences: readonly string[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONFIRMED' | 'REVERSED';
  version: number;
}

export interface Payment extends Receipt {
  payableReferences: readonly string[];
}

export interface Transfer {
  id: string;
  fromFinancialAccountReference: string;
  toFinancialAccountReference: string;
  amount: Money;
  fee: Money;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONFIRMED' | 'REVERSED';
  version: number;
}

export interface Invoice {
  id: string;
  kind: 'SALES' | 'PURCHASE';
  partyReference: FinancePublicReference;
  contractReference: FinancePublicReference | null;
  lines: readonly {
    serviceReference: FinancePublicReference | null;
    descriptionSnapshot: string;
    quantity: string;
    unitAmount: Money;
    discountAmount: Money;
    taxRuleReference: string | null;
    lineTotal: Money;
  }[];
  total: Money;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
  version: number;
}

export interface Settlement {
  id: string;
  partyAccountReference: string;
  allocationReferences: readonly string[];
  amount: Money;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED' | 'REVERSED';
  version: number;
}

export interface FiscalPeriod {
  id: string;
  legalEntityReference: string;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
  version: number;
}

export interface Budget {
  id: string;
  fiscalPeriodReference: string;
  accountReference: string;
  costCenterReference: string | null;
  projectReference: string | null;
  amount: Money;
  status: 'DRAFT' | 'APPROVED' | 'LOCKED';
  version: number;
}

export interface ClosingState {
  fiscalPeriodReference: string;
  checklistVersion: number;
  unresolvedItemReferences: readonly string[];
  retainedEarningsJournalReference: string | null;
  status: 'NOT_STARTED' | 'IN_REVIEW' | 'READY' | 'CLOSED';
}

const receivedCheckTransitions: Readonly<
  Record<CheckStatus, readonly CheckStatus[]>
> = {
  RECEIVED: ['DEPOSITED', 'ENDORSED', 'RETURNED', 'CANCELLED', 'DUE'],
  DEPOSITED: ['CLEARED', 'BOUNCED', 'RETURNED'],
  CLEARED: [],
  BOUNCED: ['DEPOSITED', 'RETURNED', 'CANCELLED'],
  RETURNED: [],
  ENDORSED: ['CLEARED', 'BOUNCED', 'RETURNED'],
  ISSUED: [],
  DELIVERED: [],
  DUE: ['DEPOSITED', 'ENDORSED', 'RETURNED', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

const paidCheckTransitions: Readonly<
  Record<CheckStatus, readonly CheckStatus[]>
> = {
  RECEIVED: [],
  DEPOSITED: [],
  CLEARED: [],
  BOUNCED: ['DELIVERED', 'CANCELLED'],
  RETURNED: ['DELIVERED', 'CANCELLED'],
  ENDORSED: [],
  ISSUED: ['DELIVERED', 'CANCELLED', 'DUE'],
  DELIVERED: ['DUE', 'PAID', 'BOUNCED', 'RETURNED', 'CANCELLED'],
  DUE: ['PAID', 'BOUNCED', 'RETURNED', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export function canTransitionCheck(
  direction: CheckDirection,
  current: CheckStatus,
  target: CheckStatus,
): boolean {
  const transitions =
    direction === 'RECEIVABLE'
      ? receivedCheckTransitions
      : paidCheckTransitions;
  return transitions[current]!.includes(target);
}

export interface ApprovalRuleProposal {
  operationType:
    'PURCHASE' | 'PAYMENT' | 'REFUND' | 'MANUAL_JOURNAL' | 'RELEASE_EXCEPTION';
  branchReference: string | 'ANY';
  currencyCode: string | 'ANY';
  minimumAmount: Money;
  requiredCheckerPermission: string;
}

export function validateMakerChecker(input: {
  makerReference: string;
  checkerReference: string;
  checkerPermissions: readonly string[];
  requiredCheckerPermission: string;
}): void {
  if (input.makerReference === input.checkerReference) {
    throw new FinanceDomainError(
      'SELF_APPROVAL_FORBIDDEN',
      'Maker cannot approve the same sensitive operation.',
    );
  }
  if (!input.checkerPermissions.includes(input.requiredCheckerPermission)) {
    throw new FinanceDomainError(
      'CHECKER_PERMISSION_REQUIRED',
      'Checker lacks the required permission.',
    );
  }
}

export function assertFinancePermission(
  permissions: readonly string[],
  action: FinanceAction,
): void {
  if (!hasFinancePermission(permissions, action)) {
    throw new FinanceDomainError(
      'FINANCE_PERMISSION_DENIED',
      'Finance permission is deny-by-default.',
    );
  }
}

export interface FinancialReleaseFacts {
  fullySettled: boolean;
  approvedCreditAvailable: boolean;
  approvedPaymentPlanActive: boolean;
  validCheckAvailable: boolean;
}

export interface FinancialReleaseRequest {
  requestedStatus: FinancialReleaseStatus;
  basis: FinancialReleaseBasis;
  reason: string;
  makerReference: string;
  secondApproverReference: string | null;
  exceptionExpiresAt: string | null;
  now: string;
}

export interface FinancialReleaseEvaluation {
  status: FinancialReleaseStatus;
  allowed: boolean;
  reasons: readonly string[];
  requiresAudit: true;
}

export function evaluateFinancialRelease(
  facts: FinancialReleaseFacts,
  request: FinancialReleaseRequest,
): FinancialReleaseEvaluation {
  const reasons: string[] = [];
  const qualifies: Readonly<
    Record<Exclude<FinancialReleaseBasis, 'MANAGER_EXCEPTION'>, boolean>
  > = {
    FULL_SETTLEMENT: facts.fullySettled,
    APPROVED_CREDIT: facts.approvedCreditAvailable,
    APPROVED_PAYMENT_PLAN: facts.approvedPaymentPlanActive,
    VALID_CHECK: facts.validCheckAvailable,
  };

  if (request.requestedStatus === 'BLOCKED') {
    return {
      status: 'BLOCKED',
      allowed: true,
      reasons: [
        request.reason.trim() || 'Financial conditions are not satisfied.',
      ],
      requiresAudit: true,
    };
  }

  if (request.basis === 'MANAGER_EXCEPTION') {
    if (request.reason.trim().length < 10)
      reasons.push('Exception requires a detailed reason.');
    if (!request.secondApproverReference)
      reasons.push('Exception requires a second approver.');
    if (request.secondApproverReference === request.makerReference)
      reasons.push('Second approver must differ from maker.');
    if (
      !request.exceptionExpiresAt ||
      Date.parse(request.exceptionExpiresAt) <= Date.parse(request.now)
    ) {
      reasons.push('Exception requires a future UTC expiry.');
    }
  } else if (!qualifies[request.basis]) {
    reasons.push('Selected financial basis is not satisfied.');
  }

  if (
    request.requestedStatus === 'APPROVED' &&
    request.basis === 'APPROVED_PAYMENT_PLAN'
  ) {
    reasons.push(
      'An active payment plan can only produce CONDITIONAL release.',
    );
  }

  return {
    status: reasons.length === 0 ? request.requestedStatus : 'BLOCKED',
    allowed: reasons.length === 0,
    reasons,
    requiresAudit: true,
  };
}

export function assertExpectedVersion(
  actualVersion: number,
  expectedVersion: number,
): void {
  if (!Number.isInteger(expectedVersion) || actualVersion !== expectedVersion) {
    throw new FinanceDomainError(
      'CONCURRENT_MODIFICATION',
      'Aggregate version does not match expectedVersion.',
    );
  }
}

export function validateIdempotencyContract(input: {
  key: string;
  requestFingerprint: string;
}): void {
  if (!/^[A-Za-z0-9:_-]{12,128}$/.test(input.key)) {
    throw new FinanceDomainError(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency key must be stable and 12-128 safe characters.',
    );
  }
  if (!/^[a-f0-9]{64}$/.test(input.requestFingerprint)) {
    throw new FinanceDomainError(
      'INVALID_REQUEST_FINGERPRINT',
      'Request fingerprint must be a SHA-256 hex digest.',
    );
  }
}
